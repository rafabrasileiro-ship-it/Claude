package com.rafa.combate;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

public class MainActivity extends Activity {
    private static final int PORT = 3000;
    private static GameServer server;

    static synchronized void stopServer() {
        if (server != null) { server.stop(); server = null; }
    }

    private WebView web;
    private ScrollView menuScroll;
    private LinearLayout menu;
    private Button resume, stopHost;
    private Button[] levelBtns = new Button[3];
    private EditText ipField;
    private boolean inGame;
    private int level = 1;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#12161D"));
        getWindow().setNavigationBarColor(Color.parseColor("#12161D"));
        level = getPreferences(MODE_PRIVATE).getInt("level", 1);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#12161D"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#12161D"));
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void menu() {
                runOnUiThread(() -> { web.loadUrl("about:blank"); inGame = false; showMenu(); });
            }
        }, "AndroidHost");
        web.setWebViewClient(new WebViewClient() {
            @SuppressWarnings("deprecation")
            @Override public void onReceivedError(WebView v, int code, String desc, String url) {
                Toast.makeText(MainActivity.this, "Não foi possível conectar: " + url, Toast.LENGTH_LONG).show();
                web.loadUrl("about:blank");
                inGame = false;
                showMenu();
            }
        });
        web.setVisibility(View.GONE);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        menu = new LinearLayout(this);
        menu.setOrientation(LinearLayout.VERTICAL);
        menu.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = dp(20);
        menu.setPadding(pad, pad, pad, pad);

        TextView title = text("COMBATE", 38, Color.WHITE, true);
        title.setLetterSpacing(0.15f);
        menu.addView(title);

        resume = button("Voltar à partida", "#2F9E5B");
        resume.setOnClickListener(v -> showGame());
        resume.setVisibility(View.GONE);
        menu.addView(resume, lp());

        // ---- jogador x máquina ----
        menu.addView(text("Jogar sozinho", 14, Color.parseColor("#98A2B3"), false));
        Button ai = button("🤖 Jogador x Máquina", "#2F9E5B");
        ai.setOnClickListener(v -> startAI());
        menu.addView(ai, lp());
        LinearLayout lv = new LinearLayout(this);
        lv.setOrientation(LinearLayout.HORIZONTAL);
        String[] names = {"Fácil", "Médio", "Difícil"};
        for (int i = 0; i < 3; i++) {
            final int idx = i;
            Button lb = button(names[i], "#262E3A");
            lb.setTextSize(15);
            lb.setOnClickListener(v -> { level = idx; getPreferences(MODE_PRIVATE).edit().putInt("level", idx).apply(); paintLevels(); });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1);
            p.leftMargin = i == 0 ? 0 : dp(6);
            lv.addView(lb, p);
            levelBtns[i] = lb;
        }
        menu.addView(lv, lp());
        paintLevels();

        // ---- 2 celulares ----
        space(14);
        menu.addView(text("Jogar com um amigo (2 celulares, mesmo Wi-Fi)", 14, Color.parseColor("#98A2B3"), false));
        Button host = button("Hospedar partida", "#D94B4B");
        host.setOnClickListener(v -> host());
        menu.addView(host, lp());
        menu.addView(text("Seu celular vira o servidor. O outro jogador toca em “Entrar” e digita o IP que aparece na tela de espera.", 12, Color.parseColor("#98A2B3"), false));

        ipField = new EditText(this);
        ipField.setHint("IP do anfitrião (ex.: 192.168.0.15)");
        ipField.setHintTextColor(Color.parseColor("#667085"));
        ipField.setTextColor(Color.WHITE);
        ipField.setSingleLine(true);
        ipField.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        ipField.setText(getPreferences(MODE_PRIVATE).getString("ip", ""));
        menu.addView(ipField, lp());
        Button join = button("Entrar em partida", "#3D86E0");
        join.setOnClickListener(v -> join());
        menu.addView(join, lp());

        stopHost = button("Encerrar hospedagem", "#A03A3A");
        stopHost.setOnClickListener(v -> {
            stopService(new Intent(this, ServerService.class));
            stopServer();
            web.loadUrl("about:blank");
            inGame = false;
            showMenu();
        });
        menu.addView(stopHost, lp());

        menuScroll = new ScrollView(this);
        menuScroll.setFillViewport(true);
        menuScroll.addView(menu, new FrameLayout.LayoutParams(-1, -2));
        root.addView(menuScroll, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        showMenu();
    }

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density); }
    private LinearLayout.LayoutParams lp() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
        p.topMargin = dp(8); return p;
    }
    private void space(int dp) { menu.addView(new View(this), new LinearLayout.LayoutParams(1, dp(dp))); }
    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(color); t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, dp(6), 0, dp(6));
        return t;
    }
    private Button button(String s, String color) {
        Button b = new Button(this);
        b.setText(s); b.setAllCaps(false); b.setTextSize(17); b.setTextColor(Color.WHITE);
        b.setBackgroundColor(Color.parseColor(color));
        b.setPadding(dp(8), dp(12), dp(8), dp(12));
        return b;
    }
    private void paintLevels() {
        for (int i = 0; i < 3; i++) levelBtns[i].setBackgroundColor(Color.parseColor(i == level ? "#3D86E0" : "#262E3A"));
    }

    @SuppressWarnings("deprecation")
    private void fullscreen(boolean on) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c == null) return;
            if (on) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            } else c.show(WindowInsets.Type.systemBars());
        } else {
            getWindow().getDecorView().setSystemUiVisibility(on
                    ? View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    : View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && web != null && web.getVisibility() == View.VISIBLE) fullscreen(true);
    }

    private void showMenu() {
        menuScroll.setVisibility(View.VISIBLE);
        web.setVisibility(View.GONE);
        fullscreen(false);
        resume.setVisibility(inGame ? View.VISIBLE : View.GONE);
        stopHost.setVisibility(server != null ? View.VISIBLE : View.GONE);
    }
    private void showGame() {
        inGame = true;
        menuScroll.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
        fullscreen(true);
    }

    /** Contra a máquina: roda 100% no aparelho, carregando a página embutida no app. */
    private void startAI() {
        web.loadUrl("file:///android_asset/index.html?t=" + System.currentTimeMillis() + "#ia=" + level);
        showGame();
    }

    private void host() {
        synchronized (MainActivity.class) {
            if (server == null) {
                final android.content.res.AssetManager am = getApplicationContext().getAssets();
                try {
                    GameServer s = new GameServer(PORT, name -> {
                        try (InputStream in = am.open(name)) {
                            ByteArrayOutputStream bo = new ByteArrayOutputStream();
                            byte[] buf = new byte[8192]; int n;
                            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                            return bo.toByteArray();
                        }
                    });
                    s.start();
                    server = s;
                } catch (IOException e) {
                    Toast.makeText(this, "Não foi possível iniciar o servidor (porta " + PORT + " em uso?)", Toast.LENGTH_LONG).show();
                    return;
                }
            }
        }
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
        try {
            Intent svc = new Intent(this, ServerService.class);
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc); else startService(svc);
        } catch (Exception ignored) { /* sem serviço o servidor ainda funciona com o app aberto */ }
        List<String> ips = GameServer.lanIps();
        Toast.makeText(this, ips.isEmpty() ? "Conecte-se ao Wi-Fi para o outro jogador entrar" : "IP: " + ips.get(0), Toast.LENGTH_LONG).show();
        web.loadUrl("http://127.0.0.1:" + PORT + "/");
        showGame();
    }

    private void join() {
        String ip = ipField.getText().toString().trim().replace("http://", "").replace("/", "");
        if (ip.isEmpty()) { Toast.makeText(this, "Digite o IP do anfitrião", Toast.LENGTH_SHORT).show(); return; }
        if (!ip.contains(":")) ip += ":" + PORT;
        getPreferences(MODE_PRIVATE).edit().putString("ip", ip.replace(":" + PORT, "")).apply();
        web.loadUrl("http://" + ip + "/");
        showGame();
    }

    @Override public void onBackPressed() {
        if (web.getVisibility() == View.VISIBLE) showMenu();
        else super.onBackPressed();
    }
}
