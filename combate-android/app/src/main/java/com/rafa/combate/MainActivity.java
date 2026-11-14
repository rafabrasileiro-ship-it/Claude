package com.rafa.combate;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
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
    private LinearLayout menu;
    private Button resume, stopHost;
    private EditText ipField;
    private TextView hostInfo;
    private boolean inGame;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.parseColor("#12161D"));
        getWindow().setNavigationBarColor(Color.parseColor("#12161D"));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#12161D"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#12161D"));
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        web.setWebViewClient(new WebViewClient() {
            @SuppressWarnings("deprecation")
            @Override public void onReceivedError(WebView v, int code, String desc, String url) {
                Toast.makeText(MainActivity.this, "Não foi possível conectar: " + url, Toast.LENGTH_LONG).show();
                web.loadUrl("about:blank");
                showMenu(false);
            }
        });
        web.setVisibility(View.GONE);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        menu = new LinearLayout(this);
        menu.setOrientation(LinearLayout.VERTICAL);
        menu.setGravity(Gravity.CENTER);
        int pad = dp(24);
        menu.setPadding(pad, pad, pad, pad);

        TextView title = text("COMBATE", 40, Color.WHITE, true);
        title.setLetterSpacing(0.15f);
        menu.addView(title);
        menu.addView(text("Estratégia para 2 jogadores, cada um no seu celular, na mesma rede Wi-Fi.", 15, Color.parseColor("#98A2B3"), false));
        space(20);

        resume = button("Voltar à partida", "#2F9E5B");
        resume.setOnClickListener(v -> showGame());
        resume.setVisibility(View.GONE);
        menu.addView(resume, lp());

        Button host = button("Hospedar partida", "#D94B4B");
        host.setOnClickListener(v -> host());
        menu.addView(host, lp());
        hostInfo = text("Seu celular vira o servidor. O outro jogador toca em “Entrar” e digita o IP que aparece na tela de espera.", 13, Color.parseColor("#98A2B3"), false);
        menu.addView(hostInfo);
        space(16);

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
        space(16);

        stopHost = button("Encerrar hospedagem", "#A03A3A");
        stopHost.setOnClickListener(v -> {
            stopService(new Intent(this, ServerService.class));
            stopServer();
            web.loadUrl("about:blank");
            inGame = false;
            showMenu(false);
        });
        menu.addView(stopHost, lp());

        root.addView(menu, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        showMenu(false);
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
        b.setPadding(dp(8), dp(14), dp(8), dp(14));
        return b;
    }

    private void showMenu(boolean keepGame) {
        menu.setVisibility(View.VISIBLE);
        web.setVisibility(View.GONE);
        resume.setVisibility(inGame ? View.VISIBLE : View.GONE);
        stopHost.setVisibility(server != null ? View.VISIBLE : View.GONE);
    }
    private void showGame() {
        inGame = true;
        menu.setVisibility(View.GONE);
        web.setVisibility(View.VISIBLE);
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
        if (web.getVisibility() == View.VISIBLE) showMenu(true);
        else super.onBackPressed();
    }
}
