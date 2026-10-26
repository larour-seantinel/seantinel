package com.seantinel.spike;

import android.webkit.JavascriptInterface;

public class NativeBridge {
    private String loadStatus = null;
    private boolean loadedOk = false;

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

    @JavascriptInterface
    public String helloFromNative() {
        if (!loadedOk) return "lib load failed, cannot call native";
        try {
            return nativeHello();
        } catch (Throwable t) {
            return "nativeHello error: " + t.toString();
        }
    }
}
