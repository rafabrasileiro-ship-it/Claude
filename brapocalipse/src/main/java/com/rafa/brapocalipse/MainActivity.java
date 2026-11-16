package com.rafa.brapocalipse;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Casca Android: o jogo roda em HTML5/Canvas dentro de um WebView (arquivos em assets); a rede local fica na ponte {@link Bridge}. */
public class MainActivity extends Activity {

    private WebView web;
    private Bridge bridge;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Usa a tela inteira, inclusive a faixa do furo da câmera: sem isso o Android deixa uma tarja preta
        // na lateral e o jogo perde largura (ex.: 2400 → ~2300 px no Galaxy S20 FE).
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11, 10, 8));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // progresso salvo (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient());
        bridge = new Bridge(this);                 // vibração + co-op Wi-Fi (TCP/UDP) para o jogo
        web.addJavascriptInterface(bridge, "BRApp");
        // O desenho ocupa a tela toda; só os botões e menus se afastam do furo da câmera (muda de lado ao virar o celular).
        web.setOnApplyWindowInsetsListener((v, ins) -> {
            if (Build.VERSION.SDK_INT >= 28) {
                DisplayCutout dc = ins.getDisplayCutout();
                float d = getResources().getDisplayMetrics().density;
                if (dc != null) bridge.setInsets(dc.getSafeInsetLeft() / d, dc.getSafeInsetTop() / d, dc.getSafeInsetRight() / d, dc.getSafeInsetBottom() / d);
                else bridge.setInsets(0, 0, 0, 0);
                web.evaluateJavascript("if(window.UI_safe)UI_safe();", null);
            }
            return v.onApplyWindowInsets(ins);
        });
        setContentView(web);
        hideSystemBars();
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.evaluateJavascript("if(window.UI_pause)UI_pause();", null);
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    public void onBackPressed() {
        // Voltar = pausa do jogo (sair pelo botão Home / recentes).
        web.evaluateJavascript("if(window.UI_pause)UI_pause();", null);
    }

    @Override
    protected void onDestroy() {
        bridge.stop();
        web.destroy();
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
}
