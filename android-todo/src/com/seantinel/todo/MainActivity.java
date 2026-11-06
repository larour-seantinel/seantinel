package com.seantinel.todo;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;

import java.io.File;
import java.io.FileInputStream;

public class MainActivity extends Activity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (getActionBar() != null) getActionBar().hide();
        setContentView(R.layout.main);
        applyImmersive();

        if (Build.VERSION.SDK_INT >= 23 &&
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 1);
        }

        WebView web = (WebView) findViewById(R.id.web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Recorder(this), "AndroidRecorder");
        web.loadUrl("file:///android_asset/index.html");

        startBridgeViaTermux();
    }

    // Ask Termux to start the bridge via RUN_COMMAND intent. Safe to call every
    // launch — bridge.py exits immediately if port 8787 is already bound.
    // Requires: `allow-external-apps=true` in ~/.termux/termux.properties.
    private void startBridgeViaTermux() {
        try {
            Intent i = new Intent();
            i.setClassName("com.termux", "com.termux.app.RunCommandService");
            i.setAction("com.termux.RUN_COMMAND");
            i.putExtra("com.termux.RUN_COMMAND_PATH",
                "/data/data/com.termux/files/usr/bin/bash");
            i.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{
                "-c",
                "pgrep -f android-todo/bridge.py >/dev/null || " +
                "python3 /data/data/com.termux/files/home/Seantinel/android-todo/bridge.py " +
                ">>/data/data/com.termux/files/home/tmp/bridge.log 2>&1 &"
            });
            i.putExtra("com.termux.RUN_COMMAND_WORKDIR",
                "/data/data/com.termux/files/home/Seantinel");
            i.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
            i.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0");
            startService(i);
        } catch (Exception e) {
            Log.w("Assistant", "startBridgeViaTermux failed: " + e.getMessage());
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    private void applyImmersive() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }
}

class Recorder {
    private final Activity ctx;
    private MediaRecorder rec;
    private File out;

    Recorder(Activity ctx) { this.ctx = ctx; }

    @JavascriptInterface
    public String start() {
        try {
            if (rec != null) {
                try { rec.stop(); } catch (Exception ignored) {}
                rec.release();
                rec = null;
            }
            out = new File(ctx.getFilesDir(), "speak.m4a");
            if (out.exists()) out.delete();
            rec = new MediaRecorder();
            rec.setAudioSource(MediaRecorder.AudioSource.MIC);
            rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            rec.setAudioChannels(1);
            rec.setAudioSamplingRate(16000);
            rec.setAudioEncodingBitRate(32000);
            rec.setOutputFile(out.getAbsolutePath());
            rec.prepare();
            rec.start();
            return "{\"ok\":true}";
        } catch (Exception e) {
            if (rec != null) { try { rec.release(); } catch (Exception ignored) {} rec = null; }
            return "{\"ok\":false,\"error\":" + jsonStr(String.valueOf(e.getMessage())) + "}";
        }
    }

    @JavascriptInterface
    public String stop() {
        try {
            if (rec == null) return "{\"ok\":false,\"error\":\"not recording\"}";
            try { rec.stop(); } catch (Exception ignored) {}
            rec.release();
            rec = null;
            if (out == null || !out.exists()) return "{\"ok\":false,\"error\":\"no file\"}";
            int len = (int) out.length();
            byte[] data = new byte[len];
            try (FileInputStream fis = new FileInputStream(out)) {
                int off = 0, n;
                while (off < len && (n = fis.read(data, off, len - off)) > 0) off += n;
            }
            String b64 = Base64.encodeToString(data, Base64.NO_WRAP);
            return "{\"ok\":true,\"bytes\":" + len + ",\"b64\":" + jsonStr(b64) + "}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":" + jsonStr(String.valueOf(e.getMessage())) + "}";
        }
    }

    private static String jsonStr(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
        return sb.append('"').toString();
    }
}
