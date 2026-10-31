package com.seantinel.todo;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;

public class MainActivity extends Activity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);
        WebView web = (WebView) findViewById(R.id.web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        // Default WebChromeClient enables native dialogs for JS alert/confirm/prompt.
        web.setWebChromeClient(new WebChromeClient());
        web.loadUrl("file:///android_asset/index.html");
    }
}
