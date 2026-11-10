package com.rafa.bid;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.rafa.bid.core.Creditos;
import com.rafa.bid.core.Csv;
import com.rafa.bid.core.Dia;

import org.json.JSONTokener;

import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Navegador do BID com captura de dados. Quem resolve o CAPTCHA e faz a consulta é VOCÊ,
 * na tela; o app só lê as tabelas que já estão carregadas e guarda no aparelho.
 */
public class MainActivity extends Activity {
    private static final String HOME = "https://bid.cbf.com.br/home";
    private static final int REQ_EXPORT = 42;

    private WebView web;
    private TextView status;
    private Button btnModo, btnAuto;
    private BidDb db;
    private Capturador capturador;
    private String extrator = "";
    private volatile boolean historico = false;
    private boolean auto = false;
    private String pendente;      // o que será gravado no próximo arquivo
    private String diagHtml = ""; // HTML da página para diagnóstico

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        db = new BidDb(this);
        capturador = new Capturador(db);
        try (InputStream in = getAssets().open("extrator.js")) {
            java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            extrator = bo.toString("UTF-8");
        } catch (Exception e) {
            Toast.makeText(this, "Falha ao carregar extrator: " + e, Toast.LENGTH_LONG).show();
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        btnModo = botao("Modo: Eventos", new View.OnClickListener() {
            @Override public void onClick(View v) { alternarModo(); }
        });
        Button btnCap = botao("Capturar", new View.OnClickListener() {
            @Override public void onClick(View v) { capturarAgora(); }
        });
        btnAuto = botao("Auto: OFF", new View.OnClickListener() {
            @Override public void onClick(View v) { alternarAuto(); }
        });
        Button btnDados = botao("Dados", new View.OnClickListener() {
            @Override public void onClick(View v) { menuDados(); }
        });
        bar.addView(btnModo); bar.addView(btnCap); bar.addView(btnAuto); bar.addView(btnDados);

        status = new TextView(this);
        status.setTextSize(12);
        status.setPadding(16, 4, 16, 4);
        status.setText("Resolva o CAPTCHA, faça a consulta e toque em Capturar.");

        web = new WebView(this);
        configurarWeb();

        root.addView(bar, new LinearLayout.LayoutParams(-1, -2));
        root.addView(status, new LinearLayout.LayoutParams(-1, -2));
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1f));
        setContentView(root);

        if (b == null) web.loadUrl(HOME);
        else web.restoreState(b);
    }

    private Button botao(String t, View.OnClickListener l) {
        Button x = new Button(this);
        x.setText(t);
        x.setTextSize(11);
        x.setAllCaps(false);
        x.setOnClickListener(l);
        x.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1f));
        return x;
    }

    private void configurarWeb() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        web.addJavascriptInterface(new Ponte(), "BIDApp");
        web.setWebViewClient(new WebViewClient() {
            private boolean bloquear(Uri u) {
                String host = u.getHost();
                if (host != null && (host.equals("cbf.com.br") || host.endsWith(".cbf.com.br"))) return false;
                Toast.makeText(MainActivity.this, "Navegação restrita ao site da CBF.", Toast.LENGTH_SHORT).show();
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return bloquear(r.getUrl());
            }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return bloquear(Uri.parse(url));
            }
            @Override public void onPageStarted(WebView v, String url, Bitmap f) { injetar(v); }
            @Override public void onPageFinished(WebView v, String url) { injetar(v); }
        });
    }

    private void injetar(WebView v) {
        v.evaluateJavascript(extrator, null);
        v.evaluateJavascript("window.__bidAuto=" + auto + ";", null);
    }

    /** Chamado pelo JavaScript da página (extrator.js). */
    private class Ponte {
        @JavascriptInterface public void onCapture(final String json) {
            final String msg = capturador.processar(json, historico);
            runOnUiThread(new Runnable() { @Override public void run() { status.setText(msg); } });
        }
    }

    private void alternarModo() {
        historico = !historico;
        btnModo.setText(historico ? "Modo: Histórico" : "Modo: Eventos");
        status.setText(historico
            ? "Histórico: abra a página de um atleta e toque em Capturar."
            : "Eventos: abra a lista do BID (após o CAPTCHA) e toque em Capturar.");
    }

    private void alternarAuto() {
        auto = !auto;
        btnAuto.setText(auto ? "Auto: ON" : "Auto: OFF");
        web.evaluateJavascript("window.__bidAuto=" + auto + ";", null);
        status.setText(auto ? "Auto ligado: captura a cada mudança da página (você continua fazendo as consultas)."
                            : "Auto desligado.");
    }

    private void capturarAgora() {
        status.setText("Lendo a página...");
        web.evaluateJavascript("window.__bidCapture ? (window.__bidCapture(), 'ok') : 'sem-extrator'",
            new android.webkit.ValueCallback<String>() {
                @Override public void onReceiveValue(String v) {
                    if (v != null && v.contains("sem-extrator")) status.setText("Página ainda carregando; tente de novo.");
                }
            });
    }

    // ---- Menu de dados / exportação ------------------------------------------------
    private void menuDados() {
        final String[] itens = {
            "Exportar eventos (CSV)",
            "Exportar históricos (CSV)",
            "Exportar triagem de créditos (CSV)",
            "Salvar página atual (diagnóstico)",
            "Apagar todos os dados"};
        new AlertDialog.Builder(this)
            .setTitle("Eventos: " + db.count("eventos") + " · Atletas: " + db.count("atletas")
                + " · Vínculos: " + db.count("vinculos"))
            .setItems(itens, new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int i) {
                    switch (i) {
                        case 0: pedirArquivo("eventos", "bid_eventos.csv", "text/csv"); break;
                        case 1: pedirArquivo("vinculos", "bid_historicos.csv", "text/csv"); break;
                        case 2: pedirArquivo("creditos", "bid_creditos.csv", "text/csv"); break;
                        case 3: diagnostico(); break;
                        default: confirmarApagar();
                    }
                }
            }).show();
    }

    private void confirmarApagar() {
        new AlertDialog.Builder(this).setTitle("Apagar todos os dados coletados?")
            .setPositiveButton("Apagar", new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface d, int w) {
                    db.apagarTudo();
                    status.setText("Dados apagados.");
                }
            }).setNegativeButton("Cancelar", null).show();
    }

    private void diagnostico() {
        web.evaluateJavascript("document.documentElement.outerHTML", new android.webkit.ValueCallback<String>() {
            @Override public void onReceiveValue(String v) {
                try {
                    Object o = new JSONTokener(v).nextValue();
                    diagHtml = "<!-- " + web.getUrl() + " -->\n" + (o instanceof String ? (String) o : "");
                } catch (Exception e) {
                    diagHtml = "";
                }
                pedirArquivo("diag", "bid_pagina.html", "text/html");
            }
        });
    }

    private void pedirArquivo(String tipo, String nome, String mime) {
        pendente = tipo;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(mime);
        i.putExtra(Intent.EXTRA_TITLE, nome);
        startActivityForResult(i, REQ_EXPORT);
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_EXPORT || res != RESULT_OK || data == null || data.getData() == null || pendente == null) return;
        final Uri uri = data.getData();
        final String tipo = pendente;
        pendente = null;
        new Thread(new Runnable() {
            @Override public void run() {
                String msg;
                try {
                    String conteudo = gerar(tipo);
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        out.write(conteudo.getBytes("UTF-8"));
                    }
                    msg = "Arquivo salvo.";
                } catch (Exception e) {
                    msg = "Falha ao salvar: " + e.getMessage();
                }
                final String m = msg;
                runOnUiThread(new Runnable() { @Override public void run() { status.setText(m); } });
            }
        }).start();
    }

    @SuppressWarnings("unchecked")
    private String gerar(String tipo) {
        switch (tipo) {
            case "diag":
                return diagHtml;
            case "eventos": {
                Object[] t = db.exportar("eventos", "data_bid DESC");
                return Csv.build((List<String>) t[0], (List<List<String>>) t[1]);
            }
            case "vinculos": {
                Object[] t = db.exportar("vinculos", "atleta_id, inicio");
                return Csv.build((List<String>) t[0], (List<List<String>>) t[1]);
            }
            default: {
                List<Creditos.Indicio> ind = Creditos.analisar(db.listEventos(), db.mapaAtletas(),
                    new Creditos.Opcoes(), Dia.hoje());
                List<List<String>> rows = new ArrayList<>();
                for (Creditos.Indicio i : ind) rows.add(i.row());
                return Csv.build(Creditos.Indicio.COLS, rows);
            }
        }
    }

    @Override protected void onSaveInstanceState(Bundle b) {
        super.onSaveInstanceState(b);
        web.saveState(b);
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
