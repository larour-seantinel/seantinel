package com.seantinel.spike;

import android.content.Context;
import android.content.res.AssetManager;
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

public class NativeBridge {
    private final Context ctx;
    private String loadStatus = null;
    private boolean loadedOk = false;

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
