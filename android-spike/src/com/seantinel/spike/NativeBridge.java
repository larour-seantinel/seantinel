package com.seantinel.spike;

import android.content.Context;
import android.content.res.AssetManager;
import android.system.Os;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;

public class NativeBridge {
    private final Context ctx;
    private String loadStatus = null;
    private boolean loadedOk = false;
    private volatile Thread runThread = null;
    private volatile String runResult = null;
    private volatile boolean runRunning = false;
    private volatile Process runProcess = null;

    public NativeBridge(Context ctx) {
        this.ctx = ctx;
    }

    private static final String[] LIBS = {
        "c++_shared",
        "z",
        "android-shmem",
        "openblas",
        "mpi",
        "mpifort",
        "mpicxx",
        "metis",
        "parmetis",
        "slatec",
        "scalapack",
        "petsc",
        "issmstatics",
        "ISSMCore",
        "spike"
    };

    @JavascriptInterface
    public String load() {
        if (loadStatus != null) return loadStatus;
        StringBuilder sb = new StringBuilder();
        boolean ok = true;
        for (String lib : LIBS) {
            try {
                System.loadLibrary(lib);
                sb.append("OK   lib").append(lib).append(".so\n");
            } catch (Throwable t) {
                sb.append("FAIL lib").append(lib).append(".so\n     ").append(t.toString()).append("\n");
                ok = false;
                break;
            }
        }
        loadedOk = ok;
        loadStatus = sb.toString();
        return loadStatus;
    }

    public static native String nativeHello();
    public static native String nativeRunTest(String dir, String testName, String solution);

    @JavascriptInterface
    public String helloFromNative() {
        if (!loadedOk) return "lib load failed, cannot call native";
        try {
            return nativeHello();
        } catch (Throwable t) {
            return "nativeHello error: " + t.toString();
        }
    }

    @JavascriptInterface
    public String runTest(String testName, String solution) {
        if (!loadedOk) return "lib load failed, cannot run " + testName;
        try {
            File dir = new File(ctx.getFilesDir(), testName);
            if (!dir.exists() && !dir.mkdirs()) {
                return "runTest error: mkdirs failed for " + dir.getAbsolutePath();
            }
            copyAsset(testName + "/" + testName + ".bin", new File(dir, testName + ".bin"));
            copyAsset(testName + "/" + testName + ".toolkits", new File(dir, testName + ".toolkits"));
            return nativeRunTest(dir.getAbsolutePath(), testName, solution);
        } catch (Throwable t) {
            StringWriter sw = new StringWriter();
            t.printStackTrace(new PrintWriter(sw));
            return "runTest error:\n" + sw.toString();
        }
    }

    @JavascriptInterface
    public String execRunTest(final String testName, final String solution, final int np) {
        if (runRunning) return "FAIL already running (call execKill or wait)";
        runResult = null;
        runRunning = true;
        runThread = new Thread(new Runnable() {
            @Override public void run() {
                try {
                    runResult = doExec(testName, solution, Math.max(np, 1));
                } catch (Throwable t) {
                    StringWriter sw = new StringWriter();
                    t.printStackTrace(new PrintWriter(sw));
                    runResult = "FAIL execRunTest:\n" + sw.toString();
                } finally {
                    runProcess = null;
                    runRunning = false;
                }
            }
        }, "issm-exec");
        runThread.start();
        return "OK started · " + testName + " / " + solution + " · np=" + np;
    }

    @JavascriptInterface
    public boolean execRunning() { return runRunning; }

    @JavascriptInterface
    public String execResult() { return runResult != null ? runResult : ""; }

    @JavascriptInterface
    public String execKill() {
        Process p = runProcess;
        if (p == null) return "no process";
        p.destroyForcibly();
        return "SIGKILL sent";
    }

    private String doExec(String testName, String solution, int np) throws Exception {
        File dir = new File(ctx.getFilesDir(), testName);
        if (!dir.exists() && !dir.mkdirs()) {
            return "FAIL execRunTest: mkdirs failed for " + dir.getAbsolutePath();
        }
        copyAsset(testName + "/" + testName + ".bin", new File(dir, testName + ".bin"));
        copyAsset(testName + "/" + testName + ".toolkits", new File(dir, testName + ".toolkits"));

        String nativeDir = ctx.getApplicationInfo().nativeLibraryDir;
        File exe = new File(nativeDir, "libissmexe.so");
        if (!exe.exists()) {
            return "FAIL execRunTest: " + exe.getAbsolutePath() + " not found";
        }

        if (np > 1) {
            File mpiexec = new File(nativeDir, "libmpiexec.so");
            File proxy = new File(nativeDir, "libhydrapmi.so");
            if (!mpiexec.exists() || !proxy.exists()) {
                return "FAIL execRunTest: libmpiexec.so / libhydrapmi.so missing";
            }
        }

        List<String> cmd = new ArrayList<>();
        if (np > 1) {
            // libmpiexec.so is patched so hydra looks for dirname(argv[0])/libhydrapmi.so
            // (both live in nativeDir), so no HYDRA_* env or symlinks are needed.
            cmd.add(new File(nativeDir, "libmpiexec.so").getAbsolutePath());
            cmd.add("-n");
            cmd.add(Integer.toString(np));
            cmd.add("-launcher");
            cmd.add("fork");
        }
        cmd.add(exe.getAbsolutePath());
        cmd.add(solution);
        cmd.add(dir.getAbsolutePath());
        cmd.add(testName);

        File log = new File(dir, testName + ".stdlog");
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.directory(dir);
        pb.redirectErrorStream(true);
        pb.redirectOutput(log);
        pb.environment().put("LD_LIBRARY_PATH", nativeDir);

        long t0 = System.currentTimeMillis();
        runProcess = pb.start();
        int rc = runProcess.waitFor();
        long elapsed = System.currentTimeMillis() - t0;

        StringBuilder sb = new StringBuilder();
        sb.append(rc == 0 ? "OK" : "FAIL").append(" · ")
          .append(testName).append(" / ").append(solution)
          .append(" · np=").append(np)
          .append("\nexit=").append(rc)
          .append(" · total=").append(elapsed).append(" ms")
          .append("\nlog: ").append(log.getAbsolutePath());
        return sb.toString();
    }

    @JavascriptInterface
    public String getAsset(String assetPath) {
        try {
            AssetManager am = ctx.getAssets();
            try (InputStream in = am.open(assetPath)) {
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
                return bos.toString("UTF-8");
            }
        } catch (Throwable t) {
            return "ERROR: " + t.toString();
        }
    }

    @JavascriptInterface
    public String readOutbinBase64(String testName) {
        try {
            File outbin = new File(new File(ctx.getFilesDir(), testName), testName + ".outbin");
            if (!outbin.exists()) return "ERROR: no outbin at " + outbin.getAbsolutePath();
            byte[] buf = new byte[(int) outbin.length()];
            try (InputStream in = new FileInputStream(outbin)) {
                int off = 0;
                while (off < buf.length) {
                    int n = in.read(buf, off, buf.length - off);
                    if (n <= 0) break;
                    off += n;
                }
            }
            return Base64.encodeToString(buf, Base64.NO_WRAP);
        } catch (Throwable t) {
            return "ERROR: " + t.toString();
        }
    }

    @JavascriptInterface
    public String readLog(String testName) {
        try {
            File log = new File(new File(ctx.getFilesDir(), testName), testName + ".stdlog");
            if (!log.exists()) return "(no log at " + log.getAbsolutePath() + ")";
            byte[] buf = new byte[(int) log.length()];
            try (InputStream in = new java.io.FileInputStream(log)) {
                int off = 0;
                while (off < buf.length) {
                    int n = in.read(buf, off, buf.length - off);
                    if (n <= 0) break;
                    off += n;
                }
            }
            return new String(buf);
        } catch (Throwable t) {
            return "readLog error: " + t.toString();
        }
    }

    private void copyAsset(String assetPath, File dest) throws IOException {
        AssetManager am = ctx.getAssets();
        try (InputStream in = am.open(assetPath); OutputStream out = new FileOutputStream(dest)) {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }
}
