package com.rafa.patriota;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Random;

/** Telas (menus, briefing, jogo, HUD), entrada por toque e laço principal. */
final class GameView extends View {
    static final int SC_SPLASH = 0, SC_MENU = 1, SC_SELECT = 2, SC_STAGES = 3, SC_OPTIONS = 4, SC_CREDITS = 5,
            SC_BRIEF = 6, SC_PLAY = 7, SC_PAUSE = 8, SC_OVER = 9, SC_WIN = 10, SC_COOP = 11, SC_WAIT = 12;

    // ids de botões de menu
    private static final int B_PLAY = 1, B_STAGES = 2, B_OPTIONS = 3, B_CREDITS = 4, B_BACK = 5, B_NEXT = 6,
            B_RESUME = 7, B_RESTART = 8, B_MENU = 9, B_CONTINUE = 10, B_COOP = 11, B_HOST = 12, B_JOIN = 13, B_BTSET = 14, B_HOSTW = 15, B_JOINW = 16, B_DEV = 80, B_HERO = 20, B_STAGE = 40, B_OPT = 60;

    private final Sfx sfx;
    private final Game game;
    private final Snap.Relay relay;
    private final Net net = new Net();
    private final SharedPreferences prefs;
    private final Random rnd = new Random();

    private int screen = SC_SPLASH;
    private float screenT;
    private int cleared;
    private int hero, stageSel;
    private boolean fromStageList;
    private int sfxLv = 3, voiceLv = 3, musicLv = 2, sensLv = 1, gfx = 2, vibOn = 1;
    private String unlockMsg = "";

    private float sc = 1, ox, oy;
    private int vw, vh;
    private long last;
    private boolean running = true;
    private float briefT;

    private final Draw.Look[] kindLooks = new Draw.Look[Data.KINDS.length];
    private final Draw.Look[] heroLooks = new Draw.Look[6];
    private Draw.Look heroTorn;
    private Draw.Look helenao;

    // ---- botões de menu
    private static final class Btn { final RectF r = new RectF(); int id; boolean on; }
    private final ArrayList<Btn> btns = new ArrayList<>();
    private int btnN;
    private int downBtn = -1;

    // ---- controles de toque
    private final int[] role = new int[32];
    private float joyCx, joyCy, joyX, joyY;
    private boolean joyActive;
    private final boolean[] btnDown = new boolean[4];
    private float u; // unidade de tamanho dos controles (px)

    private final ArrayList<Ent> drawList = new ArrayList<>();
    private final Jet jet;
    // ---- modo dupla (Bluetooth)
    private boolean coop;            // sessão em dupla ativa
    private int coopSub;             // 0 escolha, 1 criando sala, 2 lista de aparelhos, 3 conectando
    private boolean coopWifi;       // true = Wi-Fi, false = Bluetooth
    private float pingT, fpsAcc, fpsT;
    private int autoMax = 2;
    private final ArrayList<String[]> wifiList = new ArrayList<>();
    private int partnerHero = -1;
    private String netMsg = "";
    private float netMsgT, snapT, moveT;
    private float sentJx, sentJy, curJx, curJy;
    private int pendingBt;           // ação à espera da permissão (1 criar, 2 entrar)
    private ArrayList<android.bluetooth.BluetoothDevice> devices = new ArrayList<>();
    private boolean jetMode;
    private static final Comparator<Ent> BY_Y = (a, b) -> Float.compare(a.y, b.y);

    GameView(Context ctx) {
        super(ctx);
        prefs = ctx.getSharedPreferences("patriota", Context.MODE_PRIVATE);
        sfx = new Sfx(ctx);
        relay = new Snap.Relay(sfx);
        game = new Game(relay);
        jet = new Jet(sfx);
        java.util.Arrays.fill(role, -1);
        loadPrefs();
        buildLooks();
        setKeepScreenOn(true);
        last = System.nanoTime();
    }

    // ---------------------------------------------------------------- preferências
    private void loadPrefs() {
        try {
            cleared = prefs.getInt("cleared", 0);
            sfxLv = prefs.getInt("sfx", 3); voiceLv = prefs.getInt("voice", 3); musicLv = prefs.getInt("music", 2);
            sensLv = prefs.getInt("sens", 1); gfx = prefs.getInt("gfx", 2); vibOn = prefs.getInt("vib", 1);
            hero = prefs.getInt("hero", 0);
        } catch (Exception ignored) { }
        if (hero < 0 || hero > 5 || !heroUnlocked(hero)) hero = 0;
        Draw.q = gfx == 3 ? 2 : gfx;
        applyAudio();
    }

    private void savePrefs() {
        try {
            prefs.edit().putInt("cleared", cleared).putInt("sfx", sfxLv).putInt("voice", voiceLv).putInt("music", musicLv)
                    .putInt("sens", sensLv).putInt("gfx", gfx).putInt("vib", vibOn).putInt("hero", hero).apply();
        } catch (Exception ignored) { }
    }

    private void applyAudio() {
        sfx.sfxVol = sfxLv / 3f; sfx.voiceVol = voiceLv / 3f; sfx.vibrateOn = vibOn == 1;
        sfx.setMusicVol(musicLv / 3f * 0.8f);
    }

    private boolean heroUnlocked(int h) { return h == 0 || h >= 4 || cleared >= h; }

    private void buildLooks() {
        for (int i = 0; i < Data.KINDS.length; i++) {
            Data.Kind k = Data.KINDS[i];
            Draw.Look l = new Draw.Look();
            l.skin = k.skin; l.shirt = k.shirt; l.pants = k.pants; l.hair = k.hair; l.acc = k.acc; l.scale = k.scale;
            if (i == Data.K_CHEFAO || i == Data.K_DOMINGAO || i == Data.K_ATILA) l.girth = 1.2f;
            kindLooks[i] = l;
        }
        for (int i = 0; i < 6; i++) {
            Draw.Look l = new Draw.Look();
            int[] c = Data.HERO_COL[i];
            l.skin = c[0]; l.shirt = c[1]; l.pants = c[2]; l.hair = c[3]; l.hero = i;
            if (i == 1) l.girth = 1.25f;
            if (i == 5) l.girth = 1.13f;
            heroLooks[i] = l;
        }
        heroTorn = new Draw.Look();
        int[] c = Data.HERO_COL[0];
        heroTorn.skin = c[0]; heroTorn.shirt = c[1]; heroTorn.pants = c[2]; heroTorn.hair = c[3]; heroTorn.hero = 0; heroTorn.torn = true;
        helenao = new Draw.Look();
        helenao.scale = 1.4f; helenao.skin = Data.SK1; helenao.shirt = 0xFF556B2F; helenao.pants = 0xFF3E4A28; helenao.hair = 0xFFBBBBBB;
    }

    // ---------------------------------------------------------------- ciclo de vida
    void pause() {
        running = false;
        sfx.pauseAll();
        if (screen == SC_PLAY) screen = SC_PAUSE;
        resetTouch();
    }

    void resume() {
        running = true;
        last = System.nanoTime();
        sfx.resumeAll();
        postInvalidateOnAnimation();
    }

    void release() { net.close(); sfx.release(); }

    boolean onBack() {
        switch (screen) {
            case SC_PLAY: screen = SC_PAUSE; resetTouch(); return true;
            case SC_PAUSE: screen = SC_PLAY; last = System.nanoTime(); return true;
            case SC_MENU: case SC_SPLASH: return false;
            case SC_COOP: if (coopSub != 0) { net.close(); coopSub = 0; } else goMenu(); return true;
            case SC_WAIT: endCoop(""); return true;
            case SC_SELECT: case SC_STAGES: case SC_BRIEF: if (coop) { onButton(B_BACK); return true; } goMenu(); return true;
            case SC_OVER: case SC_WIN: if (coop) { endCoop(""); return true; } goMenu(); return true;
            default: goMenu(); return true;
        }
    }

    private void goMenu() {
        screen = SC_MENU; screenT = 0; sfx.music(2);
        resetTouch();
    }

    // ---------------------------------------------------------------- layout
    @Override protected void onSizeChanged(int w, int h, int ow, int oh) {
        vw = w; vh = h;
        sc = Math.min(w / (float) Game.W, h / (float) Game.H);
        ox = (w - Game.W * sc) / 2f; oy = (h - Game.H * sc) / 2f;
        u = Math.min(w, h) * 0.108f;
    }

    // ---------------------------------------------------------------- desenho
    @Override protected void onDraw(Canvas c) {
        long now = System.nanoTime();
        float dt = Math.min(0.05f, (now - last) / 1e9f);
        last = now;
        if (!running) return;
        if (gfx == 3 && screen == SC_PLAY) {
            // gráficos automáticos: se o quadro demora, baixa a qualidade; se sobra folga, sobe
            fpsAcc += dt; fpsT += 1;
            if (fpsAcc >= 2f) {
                float avg = fpsAcc / fpsT;
                if (avg > 1f / 42f && Draw.q > 0) { Draw.q--; autoMax = Draw.q; }
                else if (avg < 1f / 57f && Draw.q < autoMax) Draw.q++;
                fpsAcc = 0; fpsT = 0;
            }
        }
        screenT += dt;
        if (netMsgT > 0) netMsgT -= dt;
        Draw.time += dt;
        pollNet();
        c.drawColor(0xFF000000);
        btnN = 0;

        c.save();
        c.translate(ox, oy);
        c.scale(sc, sc);
        c.clipRect(0, 0, Game.W, Game.H);
        switch (screen) {
            case SC_SPLASH: drawSplash(c); if (screenT > 2.2f) { screen = SC_MENU; screenT = 0; sfx.music(2); } break;
            case SC_MENU: drawMenu(c); break;
            case SC_SELECT: drawSelect(c); break;
            case SC_STAGES: drawStages(c); break;
            case SC_OPTIONS: drawOptions(c); break;
            case SC_CREDITS: drawCredits(c); break;
            case SC_COOP: drawCoop(c); break;
            case SC_WAIT: drawWait(c); break;
            case SC_BRIEF: drawBrief(c, dt); break;
            case SC_PLAY: case SC_PAUSE: case SC_OVER: case SC_WIN: drawPlay(c, dt); break;
            default: break;
        }
        c.restore();
        if (screen == SC_PLAY) drawControls(c);
        postInvalidateOnAnimation();
    }

    // ---- utilidades de UI
    private void addBtn(Canvas c, int id, float l, float t, float r, float b, String label, boolean on, int color) {
        Btn bt;
        if (btnN < btns.size()) bt = btns.get(btnN); else { bt = new Btn(); btns.add(bt); }
        btnN++;
        bt.r.set(l, t, r, b); bt.id = id; bt.on = on;
        boolean pressed = downBtn == id && on;
        int fill = !on ? 0xFF555555 : pressed ? Draw.shade(color, 0.35f) : color;
        Draw.P.setStyle(Paint.Style.FILL);
        Draw.P.setColor(0x88000000);
        c.drawRoundRect(l + 3, t + 4, r + 3, b + 4, 12, 12, Draw.P);
        Draw.P.setColor(fill);
        c.drawRoundRect(l, t, r, b, 12, 12, Draw.P);
        Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(3); Draw.P.setColor(0xFFFFD400);
        c.drawRoundRect(l, t, r, b, 12, 12, Draw.P);
        Draw.P.setStyle(Paint.Style.FILL);
        float size = Math.min(22f, (b - t) * 0.5f);
        Draw.P.setTextSize(size);
        while (Draw.P.measureText(label) > (r - l) - 16 && size > 10) { size -= 1; Draw.P.setTextSize(size); }
        Draw.text(c, label, (l + r) / 2, (t + b) / 2 + size * 0.36f, size, on ? 0xFFFFFFFF : 0xFFAAAAAA, Paint.Align.CENTER);
    }

    private void title(Canvas c, String s, float y) {
        Draw.text(c, s, 400, y, 34, 0xFFFFD400, Paint.Align.CENTER);
    }

    private void panelBg(Canvas c, int theme) {
        Scene.bg(c, theme, screenT * 40, screenT, Draw.q == 0);
        Draw.rect(c, 0x99000000, 0, 0, Game.W, Game.H);
    }

    private void wrap(Canvas c, String text, float x, float y, float maxW, float size, int color, Paint.Align al) {
        Draw.P.setTextSize(size);
        String[] words = text.split(" ");
        StringBuilder line = new StringBuilder();
        float yy = y;
        for (String w : words) {
            String test = line.length() == 0 ? w : line + " " + w;
            if (w.equals("\n")) { Draw.text(c, line.toString(), x, yy, size, color, al); line.setLength(0); yy += size * 1.25f; continue; }
            if (Draw.P.measureText(test) > maxW && line.length() > 0) {
                Draw.text(c, line.toString(), x, yy, size, color, al);
                line.setLength(0); line.append(w); yy += size * 1.25f;
            } else { line.setLength(0); line.append(test); }
        }
        if (line.length() > 0) Draw.text(c, line.toString(), x, yy, size, color, al);
    }

    // ---------------------------------------------------------------- modo dupla (Bluetooth)
    private final Game.Listener noVoice = new Game.Listener() {
        @Override public void sfx(int id) { sfx.sfx(id); }
        @Override public void voice(String line) { /* as falas tocam no celular do anfitrião */ }
        @Override public boolean hasClip(String line) { return sfx.hasClip(line); }
        @Override public void vibrate(int ms) { sfx.vibrate(ms); }
    };

    private MainActivity act() { return getContext() instanceof MainActivity ? (MainActivity) getContext() : null; }

    private int localIdx() { return coop && !net.host ? 1 : 0; }

    private boolean guestMode() { return coop && !net.host; }

    /** Próxima fase da campanha (na dupla pula o jet-ski, que é só solo); -1 se acabou. */
    private int nextStage() {
        int nx = stageSel + 1;
        while (nx < Data.STAGES.size() && coop && Data.STAGES.get(nx).jet) nx++;
        return nx < Data.STAGES.size() ? nx : -1;
    }

    private String dots() { return "...".substring(0, 1 + (int) (screenT * 2) % 3); }

    private void coopMsg(String m) { netMsg = m; netMsgT = 5f; }

    private boolean btReady() {
        if (!Net.supported()) { coopMsg("Este aparelho não tem Bluetooth."); pendingBt = 0; return false; }
        MainActivity a = act();
        if (a != null && !a.hasBtPerm()) { a.askBtPerm(); return false; }
        return true;
    }

    void onBtPermission(boolean ok) {
        int a = pendingBt; pendingBt = 0;
        if (!ok) { coopMsg("Sem a permissão de Bluetooth não dá para jogar em dupla."); return; }
        if (a == 1) startHost(); else if (a == 2) openDevices();
    }

    private void startHost() {
        if (!Net.enabled()) { coopMsg("Ligue o Bluetooth do celular e tente de novo."); return; }
        net.listen(); coopSub = 1;
    }

    private void openDevices() {
        if (!Net.enabled()) { coopMsg("Ligue o Bluetooth do celular e tente de novo."); return; }
        devices = Net.paired(); coopSub = 2;
    }

    private void beginCoop() {
        coop = true; partnerHero = -1; fromStageList = false; stageSel = 0;
        screen = SC_SELECT; screenT = 0; coopSub = 0;
        net.send(Snap.msg(Snap.M_HERO, hero, 0, 0));
    }

    private void endCoop(String msg) {
        if (coop || net.state != Net.IDLE) net.bye();
        coop = false; game.mirror = false; game.local = 0; game.np = 1; relay.rec = false; partnerHero = -1;
        coopSub = 0;
        goMenu();
        if (!msg.isEmpty()) coopMsg(msg);
    }

    private void startGuest(int stage, int hostHero, int myHero) {
        stageSel = stage; jetMode = false; hero = myHero;
        game.resetMirror(); relay.rec = false;
        screen = SC_PLAY; screenT = 0; resetTouch(); curJx = curJy = sentJx = sentJy = 0;
        playStageMusic(stage);
        last = System.nanoTime();
    }

    private void pollNet() {
        if (screen == SC_COOP) {
            int st = net.state;
            if (st == Net.CONNECTED) beginCoop();
            else if (st == Net.IDLE) return;
            else if (st == Net.FAILED) { coopMsg(net.info); net.close(); coopSub = 0; }
            return;
        }
        if (!coop) return;
        if (net.state != Net.CONNECTED) { endCoop(net.info.isEmpty() ? "Conexão perdida." : net.info); return; }
        byte[] m;
        while ((m = net.poll()) != null) {
            switch (m[0]) {
                case Snap.M_HERO: if (m.length > 1) partnerHero = Math.max(0, Math.min(5, m[1])); break;
                case Snap.M_START: if (guestMode() && m.length > 3) startGuest(m[1], m[2], m[3]); break;
                case Snap.M_INPUT: if (!guestMode() && !game.mirror && game.np == 2) Snap.applyInput(game, m); break;
                case Snap.M_BYE: endCoop("O amigo saiu da partida."); return;
                default: break;
            }
        }
    }

    private void drawCoop(Canvas c) {
        panelBg(c, Data.TH_PAULISTA);
        title(c, "2 JOGADORES", 44);
        if (coopSub == 0) {
            String[] help = {"Os dois heróis jogam na mesma tela: o dobro de inimigos e chefões com o dobro de vida.",
                    "Wi-Fi é o mais rápido e fluido: os dois celulares na mesma rede (ou no ponto de acesso de um deles).",
                    "Um jogador CRIA A SALA; o outro toca em ENTRAR. O anfitrião escolhe a fase (jet-ski é só solo)."};
            for (int i = 0; i < help.length; i++) Draw.text(c, help[i], 400, 80 + i * 22, 13, 0xFFFFFFFF, Paint.Align.CENTER);
            addBtn(c, B_HOSTW, 60, 160, 390, 216, "CRIAR SALA — Wi-Fi (recomendado)", true, 0xFF1B8F3A);
            addBtn(c, B_JOINW, 410, 160, 740, 216, "ENTRAR NA SALA — Wi-Fi", true, 0xFF1D3E9A);
            addBtn(c, B_HOST, 60, 232, 390, 282, "Criar sala — Bluetooth", true, 0xFF2E7D32);
            addBtn(c, B_JOIN, 410, 232, 740, 282, "Entrar na sala — Bluetooth", true, 0xFF283593);
            addBtn(c, B_BTSET, 60, 298, 740, 340, "Parear aparelhos (só para Bluetooth): abrir config.", true, 0xFF6A4C93);
        } else if (coopSub == 1) {
            String dots = dots();
            Draw.text(c, "Sala criada (" + (coopWifi ? "Wi-Fi" : "Bluetooth") + ")! Aguardando o amigo" + dots, 400, 170, 24, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "No outro celular: DUPLA > ENTRAR NA SALA > toque no nome deste aparelho.", 400, 210, 14, 0xFFDDDDDD, Paint.Align.CENTER);
        } else if (coopSub == 2 && coopWifi) {
            wifiList.clear();
            java.util.ArrayList<String> keys = new java.util.ArrayList<>(net.found.keySet());
            java.util.Collections.sort(keys);
            for (String k : keys) { Object[] v = net.found.get(k); if (v != null) wifiList.add(new String[]{k, (String) v[0]}); }
            if (wifiList.isEmpty()) {
                Draw.text(c, "Procurando salas na rede" + dots(), 400, 150, 20, 0xFFFFFFFF, Paint.Align.CENTER);
                Draw.text(c, "O amigo precisa tocar em CRIAR SALA — Wi-Fi, na mesma rede.", 400, 180, 14, 0xFFDDDDDD, Paint.Align.CENTER);
            } else {
                Draw.text(c, "Salas encontradas — toque na do amigo:", 400, 80, 15, 0xFFFFFFFF, Paint.Align.CENTER);
                for (int i = 0; i < Math.min(8, wifiList.size()); i++) {
                    int col = i / 4, row = i % 4;
                    float x0 = 40 + col * 370, y0 = 100 + row * 62;
                    addBtn(c, B_DEV + i, x0, y0, x0 + 350, y0 + 52, wifiList.get(i)[1], true, 0xFF1D3E9A);
                }
            }
        } else if (coopSub == 2) {
            if (devices.isEmpty()) {
                Draw.text(c, "Nenhum aparelho pareado.", 400, 150, 20, 0xFFFFFFFF, Paint.Align.CENTER);
                Draw.text(c, "Volte e use PAREAR APARELHOS; depois entre de novo aqui.", 400, 180, 14, 0xFFDDDDDD, Paint.Align.CENTER);
            } else {
                Draw.text(c, "Toque no aparelho do anfitrião (que já criou a sala):", 400, 80, 15, 0xFFFFFFFF, Paint.Align.CENTER);
                for (int i = 0; i < Math.min(8, devices.size()); i++) {
                    int col = i / 4, row = i % 4;
                    float x0 = 40 + col * 370, y0 = 100 + row * 62;
                    addBtn(c, B_DEV + i, x0, y0, x0 + 350, y0 + 52, Net.nameOf(devices.get(i)), true, 0xFF1D3E9A);
                }
            }
        } else {
            String dots = dots();
            Draw.text(c, "Conectando a " + net.info + dots, 400, 190, 22, 0xFFFFFFFF, Paint.Align.CENTER);
        }
        if (netMsgT > 0) Draw.text(c, netMsg, 400, 360, 15, 0xFFFFAB91, Paint.Align.CENTER);
        addBtn(c, B_BACK, 30, 392, 230, 440, coopSub == 0 ? "VOLTAR" : "CANCELAR", true, 0xFF7B1FA2);
    }

    private void drawWait(Canvas c) {
        panelBg(c, Data.TH_CAMPUS);
        title(c, "PRONTO!", 70);
        R3.icon(c, heroLooks[hero], 400, 290, 1.6f, 0, Draw.P_WIND);
        Draw.text(c, "Seu herói: " + Data.HERO_NAME[hero], 400, 305, 18, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, "Aguardando o anfitrião escolher a fase" + dots(), 400, 110, 18, 0xFFFFFFFF, Paint.Align.CENTER);
        addBtn(c, B_BACK, 30, 392, 230, 440, "SAIR DA SALA", true, 0xFF7B1FA2);
    }

    /** Barra de vida do parceiro (modo dupla). */
    private void drawPartnerHud(Canvas c, Game g) {
        int oi = 1 - g.local;
        Game.PS q = g.ps[oi];
        if (q.p == null) return;
        Draw.rect(c, 0x99000000, 560, 56, 792, 92);
        c.save(); c.clipRect(562, 58, 592, 90);
        Draw.noShadow = true;
        R3.icon(c, heroLooks[q.hero], 577, 160, 0.8f, 0, Draw.P_IDLE);
        Draw.noShadow = false;
        c.restore();
        Draw.text(c, (oi == 0 ? "1P " : "2P ") + Data.HERO_NAME[q.hero] + (Game.isDown(q.p) ? " (caído)" : ""), 598, 68, 11, oi == 0 ? 0xFF76FF03 : 0xFF40C4FF, Paint.Align.LEFT);
        float f = Math.max(0f, q.p.hp / q.p.maxHp);
        Draw.rect(c, 0xFF000000, 597, 72, 789, 82);
        Draw.rect(c, f > 0.3f ? 0xFF2E9B3A : 0xFFE53935, 598, 73, 598 + 190 * f, 81);
        Draw.text(c, (net.isWifi() ? "Wi-Fi" : "Bluetooth") + (net.rtt >= 0 && net.rtt < 5000 ? " " + net.rtt + " ms" : ""), 790, 102, 10, 0xFFBBBBBB, Paint.Align.RIGHT);
        Draw.rect(c, 0xFF000000, 597, 84, 789, 89);
        Draw.rect(c, 0xFFC9A400, 598, 85, 598 + 190 * Math.min(1f, q.meter / 100f), 88);
    }

    // ---- telas
    private void drawSplash(Canvas c) {
        Draw.rect(c, 0xFF0B8A3A, 0, 0, Game.W, Game.H);
        Draw.poly(c, 0xFFFFD400, 400, 40, 760, 225, 400, 410, 40, 225);
        Draw.circle(c, 0xFF1D3E9A, 400, 225, 120);
        Draw.rect(c, 0xFFFFFFFF, 290, 215, 510, 235);
        Draw.text(c, "OPERAÇÃO", 400, 150, 40, 0xFFFFFFFF, Paint.Align.CENTER);
        Draw.text(c, "PATRIOTA 3D", 400, 290, 46, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, "Paródia satírica — qualquer semelhança é mera coincidência", 400, 435, 14, 0xFFFFFFFF, Paint.Align.CENTER);
    }

    private void drawMenu(Canvas c) {
        Scene.bg(c, Data.TH_PAULISTA, screenT * 30, screenT, Draw.q == 0);
        Draw.rect(c, 0x66000000, 0, 0, Game.W, Game.H);
        Draw.text(c, "OPERAÇÃO PATRIOTA 3D", 400, 70, 42, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, "Beat 'em up de rua — Jair Bonossauro", 400, 96, 16, 0xFFFFFFFF, Paint.Align.CENTER);
        R3.icon(c, heroLooks[hero], 150, 405, 1.9f, 0, Draw.P_IDLE);
        c.save(); c.translate(0, 0);
        addBtn(c, B_PLAY, 290, 108, 560, 158, "JOGAR (MODO HISTÓRIA)", true, 0xFF1B8F3A);
        addBtn(c, B_COOP, 290, 166, 560, 216, "2 JOGADORES", true, 0xFFC62828);
        addBtn(c, B_STAGES, 290, 224, 560, 274, "SELEÇÃO DE FASES", true, 0xFF1D3E9A);
        addBtn(c, B_OPTIONS, 290, 282, 560, 332, "OPÇÕES", true, 0xFF6A4C93);
        addBtn(c, B_CREDITS, 290, 340, 560, 390, "CRÉDITOS", true, 0xFFB35C00);
        if (netMsgT > 0) { Draw.text(c, netMsg, 400, 418, 15, 0xFFFFAB91, Paint.Align.CENTER); }
        c.restore();
        Draw.text(c, "Progresso: " + Math.min(cleared, Data.STAGES.size()) + "/" + Data.STAGES.size() + " fases", 790, 440, 14, 0xFFFFFFFF, Paint.Align.RIGHT);
    }

    private void drawSelect(Canvas c) {
        panelBg(c, Data.TH_CAMPUS);
        title(c, coop ? "ESCOLHA SEU PERSONAGEM (DUPLA)" : "ESCOLHA SEU PERSONAGEM", 44);
        for (int i = 0; i < 6; i++) {
            float x0 = 6 + i * 132, x1 = x0 + 126;
            boolean ok = heroUnlocked(i);
            boolean sel = i == hero;
            Draw.rect(c, sel ? 0xCC1B8F3A : 0xCC222222, x0, 70, x1, 360);
            Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(sel ? 5 : 2); Draw.P.setColor(sel ? 0xFFFFD400 : 0xFF888888);
            c.drawRect(x0, 70, x1, 360, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
            R3.icon(c, heroLooks[i], (x0 + x1) / 2, 222, 1.15f, 0, i == hero ? Draw.P_WIND : Draw.P_IDLE);
            Draw.text(c, Data.HERO_NAME[i], (x0 + x1) / 2, 245, 11, 0xFFFFFFFF, Paint.Align.CENTER);
            String[] ds = Data.HERO_DESC[i].split("\n");
            for (int k = 0; k < ds.length; k++) Draw.text(c, ds[k], (x0 + x1) / 2, 268 + k * 15, 9.2f, 0xFFDDDDDD, Paint.Align.CENTER);
            Draw.text(c, "HP " + (int) Data.HERO_HP[i] + "  VEL " + (int) (Data.HERO_SPD[i] * 100) + "  DANO " + (int) (Data.HERO_DMG[i] * 100), (x0 + x1) / 2, 314, 8.5f, 0xFFFFD400, Paint.Align.CENTER);
            if (!ok) {
                Draw.rect(c, 0xCC000000, x0, 70, x1, 360);
                Draw.text(c, "BLOQUEADO", (x0 + x1) / 2, 200, 18, 0xFFFF5252, Paint.Align.CENTER);
                Draw.text(c, "Vença a fase " + Data.STAGES.get(i - 1).id, (x0 + x1) / 2, 224, 12, 0xFFFFFFFF, Paint.Align.CENTER);
            }
            addBtn(c, B_HERO + i, x0 + 10, 325, x1 - 10, 352, ok ? (sel ? "ESCOLHER ✔" : "ESCOLHER") : "—", ok, ok ? 0xFF1D3E9A : 0xFF555555);
        }
        addBtn(c, B_BACK, 30, 385, 230, 435, "VOLTAR", true, 0xFF7B1FA2);
        addBtn(c, B_NEXT, 570, 385, 770, 435, coop && localIdx() == 1 ? "PRONTO ▶" : "AVANÇAR ▶", true, 0xFF1B8F3A);
    }

    private void drawStages(Canvas c) {
        panelBg(c, Data.TH_PAULISTA);
        title(c, "SELEÇÃO DE FASES", 44);
        int n = Data.STAGES.size();
        for (int i = 0; i < n; i++) {
            int col = i / 5, row = i % 5;
            float x0 = 30 + col * 385, y0 = 62 + row * 64;
            boolean solo = coop && Data.STAGES.get(i).jet;
            boolean ok = i <= cleared && !solo;
            String name = Data.STAGES.get(i).id + " · " + Data.STAGES.get(i).title.split(" — ")[0];
            addBtn(c, B_STAGE + i, x0, y0, x0 + 365, y0 + 56, solo ? Data.STAGES.get(i).id + " · só no modo solo" : ok ? name : "🔒 " + Data.STAGES.get(i).id + " · bloqueada", ok, ok ? (i < cleared ? 0xFF1B8F3A : 0xFF1D3E9A) : 0xFF555555);
        }
        addBtn(c, B_BACK, 30, 392, 230, 438, "VOLTAR", true, 0xFF7B1FA2);
    }

    private static final String[] LV = {"0%", "33%", "66%", "100%"};

    private void drawOptions(Canvas c) {
        panelBg(c, Data.TH_QUARENT);
        title(c, "OPÇÕES", 44);
        addBtn(c, B_OPT + 0, 120, 70, 680, 118, "Efeitos sonoros: " + LV[sfxLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 1, 120, 128, 680, 176, "Volume das vozes: " + LV[voiceLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 2, 120, 186, 680, 234, "Música: " + LV[musicLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 3, 120, 244, 680, 292, "Sensibilidade do analógico: " + new String[]{"Baixa", "Normal", "Alta"}[sensLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 4, 120, 302, 680, 350, "Gráficos 3D: " + new String[]{"Leve", "Normal", "Alta", "Automático (ajusta pelo desempenho)"}[gfx], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 5, 120, 360, 680, 408, "Vibração: " + (vibOn == 1 ? "Ligada" : "Desligada"), true, 0xFF1D3E9A);
        addBtn(c, B_BACK, 30, 395, 190, 440, "VOLTAR", true, 0xFF7B1FA2);
    }

    private void drawCredits(Canvas c) {
        Scene.bg(c, Data.TH_TRIBUNAL, screenT * 90, screenT, Draw.q == 0);
        Draw.rect(c, 0x55000000, 0, 0, Game.W, Game.H);
        // motociata triunfal
        R3.zoom = 1f;
        R3.begin(0);
        for (int i = 0; i < 5; i++) {
            float x = ((screenT * 260 + i * 210) % 1300) - 200;
            float z = 10 + (i % 2) * 60;
            R3.moto(c, x, z, 1, false);
            R3.person(c, x - 6, 8, z, 1, heroLooks[i % 4], 0, 0, Draw.P_SPEC, 0, 0, -1, false, false);
        }
        R3.flush(c);
        String[] lines = {"OPERAÇÃO PATRIOTA 3D", "", "Um beat 'em up satírico", "", "Design de jogo: Rafa", "Programação: Claude", "", "Personagens: Jair Bonossauro, Coronel Helenão,",
                "Patriota do Caminhão, Tiozão do Zap, Véio da Havan-a", "", "Chefes: Doutor Atila-mento, Reitor Desconstruído,", "Apresentador Domingão, William Boné,", "Xerxes de Moraes e Mula", "",
                "Obra de ficção e paródia.", "Qualquer semelhança é mera coincidência.", "", "Obrigado por jogar!"};
        float y = 460 - (screenT * 38) % (lines.length * 26 + 520);
        for (String s : lines) { Draw.text(c, s, 400, y, 20, 0xFFFFFFFF, Paint.Align.CENTER); y += 26; }
        addBtn(c, B_BACK, 30, 395, 190, 440, "VOLTAR", true, 0xFF7B1FA2);
    }

    private void drawBrief(Canvas c, float dt) {
        Data.Stage st = Data.STAGES.get(stageSel);
        if (st.jet) Scene.lake(c, screenT * 40, screenT, Draw.q == 0); else Scene.bg(c, st.segs.get(0).theme, screenT * 20, screenT, Draw.q == 0);
        Draw.rect(c, 0xAA000000, 0, 0, Game.W, Game.H);
        Draw.text(c, "MISSÃO " + st.id, 400, 44, 30, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, st.title, 400, 72, 18, 0xFFFFFFFF, Paint.Align.CENTER);
        // Coronel Helenão
        c.save();
        c.clipRect(30, 95, 190, 255);
        Draw.rect(c, 0xFF2E3B2A, 30, 95, 190, 255);
        R3.icon(c, helenao, 110, 330, 1.5f, 0, Draw.P_IDLE);
        c.restore();
        Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(3); Draw.P.setColor(0xFFFFD400);
        c.drawRect(30, 95, 190, 255, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
        Draw.text(c, "CORONEL HELENÃO", 110, 275, 13, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, "(via rádio)", 110, 291, 11, 0xFFBBBBBB, Paint.Align.CENTER);
        // texto
        briefT += dt * 45;
        String full = "“" + st.briefing + "”";
        int cnt = Math.min(full.length(), (int) briefT);
        Draw.rect(c, 0xCC101810, 210, 95, 770, 255);
        wrap(c, full.substring(0, cnt), 226, 125, 530, 19, 0xFFFFFFFF, Paint.Align.LEFT);
        // dicas de controle
        Draw.text(c, "Controles: analógico à esquerda • A soco (segure 1s = onda de choque) • B pulo (B+A voadora)", 400, 322, 13, 0xFFDDDDDD, Paint.Align.CENTER);
        Draw.text(c, "C agarrar/pegar arma (perto do inimigo: A soca, direção+A arremessa) • D especial (gasta 50 de Patriotismo)", 400, 342, 13, 0xFFDDDDDD, Paint.Align.CENTER);
        Draw.text(c, coop ? "Dupla: " + Data.HERO_NAME[hero] + " + " + (partnerHero >= 0 ? Data.HERO_NAME[partnerHero] : "(amigo escolhendo...)") : "Personagem: " + Data.HERO_NAME[hero], 400, 372, 15, 0xFFFFD400, Paint.Align.CENTER);
        addBtn(c, B_BACK, 30, 392, 210, 440, "VOLTAR", true, 0xFF7B1FA2);
        addBtn(c, B_NEXT, 560, 392, 770, 440, cnt < full.length() ? "AVANÇAR ▶▶" : "AVANÇAR ▶", !coop || partnerHero >= 0, 0xFF1B8F3A);
    }

    // ---------------------------------------------------------------- jogo
    private void startStage(int idx) {
        stageSel = idx;
        jetMode = Data.STAGES.get(idx).jet && !coop;
        game.mirror = false; game.local = 0; relay.rec = coop; relay.ev.clear();
        if (jetMode) jet.start(hero);
        else if (coop) { game.start(idx, hero, partnerHero >= 0 ? partnerHero : 0); net.send(Snap.msg(Snap.M_START, idx, hero, partnerHero >= 0 ? partnerHero : 0)); }
        else game.start(idx, hero);
        screen = SC_PLAY; screenT = 0;
        resetTouch();
        playStageMusic(idx);
        last = System.nanoTime();
    }

    private void playStageMusic(int idx) {
        if (idx == 6 && sfx.stageMusic("voz_jornal_vinheta")) { /* vinheta do telejornal como música de fundo */ } else sfx.music(1);
    }

    private void drawPlay(Canvas c, float dt) {
        if (jetMode) { drawJetPlay(c, dt); return; }
        Game g = game;
        if (g.mirror) {
            // celular convidado: o estado chega do anfitrião
            byte[] m = net.takeSnap();
            if (m != null) { Snap.read(g, m, noVoice); g.adopt(1); }
            if (g.stage == null || g.ps[0].p == null) {
                Draw.rect(c, 0xFF000000, 0, 0, Game.W, Game.H);
                Draw.text(c, "Sincronizando com o anfitrião...", 400, 225, 20, 0xFFFFFFFF, Paint.Align.CENTER);
                return;
            }
            Snap.smooth(g, dt);
            pingT += dt; if (pingT > 1f) { pingT = 0; net.ping(); }
            if (screen == SC_PLAY || screen == SC_PAUSE) {
                if (g.result == 2) { screen = SC_OVER; screenT = 0; resetTouch(); sfx.music(0); }
                else if (g.result == 1) onWin();
            } else if ((screen == SC_OVER || screen == SC_WIN) && g.result == 0) {
                screen = SC_PLAY; screenT = 0; resetTouch(); playStageMusic(stageSel);
            }
            if (screen == SC_PLAY && (Math.abs(curJx - sentJx) > 0.03f || Math.abs(curJy - sentJy) > 0.03f || ((curJx == 0 && curJy == 0) && (sentJx != 0 || sentJy != 0)))) {
                sentJx = curJx; sentJy = curJy; net.send(Snap.msgInput(Snap.I_MOVE, curJx, curJy));
            }
        } else if (screen == SC_PLAY) {
            g.update(dt);
            if (g.result == 2) { screen = SC_OVER; screenT = 0; resetTouch(); sfx.music(0); }
            else if (g.result == 1) onWin();
        } else {
            // animação leve de efeitos mesmo em overlays
            if (screen == SC_WIN || screen == SC_OVER) g.update(0);
        }
        c.save();
        if (g.shake > 0 && screen == SC_PLAY) c.translate((rnd.nextFloat() - 0.5f) * g.shake, (rnd.nextFloat() - 0.5f) * g.shake);
        if (coop && !g.mirror && net.connected()) {
            snapT += dt;
            if (snapT >= 1f / net.rate) { snapT = 0; net.sendSnap(Snap.write(g, relay)); }
        }
        R3.world(c, g, kindLooks, heroLooks, heroTorn, Draw.q == 0);
        drawOverlays(c);
        drawFx(c, g.fxs, g.camX);
        Scene.post(c, g.theme());
        drawPops(c, g.pops);
        c.restore();
        if (g.blurT > 0) {
            Draw.rect(c, ((int) (Math.min(1f, g.blurT) * 150) << 24) | 0xFFFFFF, 0, 0, Game.W, Game.H);
            for (int i = 0; i < 12; i++) Draw.circle(c, 0x66FFFFFF, (i * 97 + g.time * 40) % 800, (i * 53) % 450, 18 + (i % 4) * 8);
        }
        drawHud(c);
        if (g.np == 2) drawPartnerHud(c, g);
        drawEndOverlays(c, g.score, g.p.hp, g.p.maxHp);
    }

    private void drawEndOverlays(Canvas c, int scoreV, float hpV, float maxHpV) {
        if (screen == SC_PAUSE) {
            Draw.rect(c, 0xAA000000, 0, 0, Game.W, Game.H);
            title(c, "PAUSADO", 110);
            addBtn(c, B_RESUME, 290, 140, 510, 196, "CONTINUAR", true, 0xFF1B8F3A);
            addBtn(c, B_RESTART, 290, 208, 510, 264, "REINICIAR FASE", !guestMode(), 0xFF1D3E9A);
            addBtn(c, B_MENU, 290, 276, 510, 332, "MENU PRINCIPAL", true, 0xFFB35C00);
        } else if (screen == SC_OVER) {
            Draw.rect(c, 0xBB200000, 0, 0, Game.W, Game.H);
            Draw.text(c, "GAME OVER", 400, 110, 54, 0xFFFF5252, Paint.Align.CENTER);
            Draw.text(c, "CORONEL HELENÃO (rádio): “Levanta, recruta!”", 400, 160, 20, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "Pontuação: " + scoreV, 400, 195, 18, 0xFFFFD400, Paint.Align.CENTER);
            addBtn(c, B_CONTINUE, 290, 225, 510, 285, guestMode() ? "Aguardando o anfitrião..." : "CONTINUAR", !guestMode(), 0xFF1B8F3A);
            addBtn(c, B_MENU, 290, 300, 510, 350, "MENU PRINCIPAL", true, 0xFFB35C00);
        } else if (screen == SC_WIN) {
            Draw.rect(c, 0xBB001A00, 0, 0, Game.W, Game.H);
            Draw.text(c, "MISSÃO CUMPRIDA!", 400, 100, 46, 0xFFFFD400, Paint.Align.CENTER);
            Draw.text(c, Data.STAGES.get(stageSel).title, 400, 135, 18, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "Pontuação: " + scoreV, 400, 175, 26, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "Vida restante: " + (int) hpV + " / " + (int) maxHpV, 400, 205, 16, 0xFFCCFFCC, Paint.Align.CENTER);
            if (!unlockMsg.isEmpty()) Draw.text(c, unlockMsg, 400, 235, 18, 0xFF76FF03, Paint.Align.CENTER);
            boolean more = nextStage() >= 0;
            if (guestMode()) addBtn(c, B_NEXT, 270, 262, 530, 322, "Aguardando o anfitrião...", false, 0xFF1B8F3A);
            else if (more) addBtn(c, B_NEXT, 270, 262, 530, 322, "PRÓXIMA MISSÃO ▶", true, 0xFF1B8F3A);
            else addBtn(c, B_NEXT, 270, 262, 530, 322, "VER CRÉDITOS ▶", true, 0xFF1B8F3A);
            addBtn(c, B_MENU, 270, 336, 530, 386, "MENU PRINCIPAL", true, 0xFFB35C00);
        }
    }

    private void onWin() {
        screen = SC_WIN; screenT = 0; resetTouch();
        unlockMsg = "";
        int before = cleared;
        cleared = Math.max(cleared, stageSel + 1);
        if (cleared > before && cleared >= 1 && cleared <= 3) unlockMsg = "Desbloqueado: " + Data.HERO_NAME[cleared] + "!";
        savePrefs();
        sfx.music(2);
        sfx.voice("Um forte abraço!");
    }

    // ---------------------------------------------------------------- fase do jet-ski
    private void drawJetPlay(Canvas c, float dt) {
        Jet j = jet;
        if (screen == SC_PLAY) {
            j.update(dt);
            if (j.result == 2) { screen = SC_OVER; screenT = 0; resetTouch(); sfx.music(0); }
            else if (j.result == 1) onWin();
        } else if (screen == SC_WIN || screen == SC_OVER) j.update(0);
        c.save();
        if (j.shake > 0 && screen == SC_PLAY) c.translate((rnd.nextFloat() - 0.5f) * j.shake, (rnd.nextFloat() - 0.5f) * j.shake);
        R3.jetWorld(c, j, heroLooks, Draw.q == 0);
        for (Jet.Whale w : j.whales) {
            if (w.dying || w.x < j.camX - 100 || w.x > j.camX + Game.W + 100) continue;
            R3.proj(w.x, 70 * w.size + w.h, R3.zOf(w.y));
            float sx = R3.px, sy = R3.py;
            Draw.text(c, w.type == 0 ? "Baleia Dino" : "Baleia Gilmar", sx, sy - 6, 12, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.rect(c, 0xAA000000, sx - 24, sy, sx + 24, sy + 4);
            Draw.rect(c, 0xFFE53935, sx - 24, sy, sx - 24 + 48 * Math.max(0, w.hp) / w.maxHp, sy + 4);
        }
        drawFx(c, j.fxs, j.camX);
        Scene.post(c, Data.TH_PAULISTA);
        drawPops(c, j.pops);
        c.restore();
        drawJetHud(c);
        drawEndOverlays(c, j.score, j.hp, j.maxHp);
    }

    private void drawJetHud(Canvas c) {
        Jet j = jet;
        Draw.rect(c, 0xFF223322, 8, 8, 66, 66);
        c.save(); c.clipRect(8, 8, 66, 66);
        R3.icon(c, heroLooks[j.hero], 30, 278, 1.5f, 0, Draw.P_IDLE);
        c.restore();
        Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(3); Draw.P.setColor(0xFFFFD400);
        c.drawRect(8, 8, 66, 66, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
        Draw.text(c, Data.HERO_NAME[j.hero] + " (jet-ski)", 74, 20, 13, 0xFFFFFFFF, Paint.Align.LEFT);
        float hpf = Math.max(0f, j.hp / j.maxHp);
        Draw.rect(c, 0xFF000000, 73, 25, 277, 41);
        Draw.rect(c, hpf > 0.3f ? 0xFF2E9B3A : 0xFFE53935, 75, 27, 75 + 200 * hpf, 39);
        Draw.rect(c, 0xFF000000, 73, 45, 237, 57);
        Draw.rect(c, j.meter >= 50 ? (((int) (j.time * 6) & 1) == 0 ? 0xFFFFEA00 : 0xFFFFB300) : 0xFFC9A400, 75, 47, 75 + 160 * j.meter / 100f, 55);
        Draw.rect(c, 0xFF000000, 155, 45, 157, 57);
        Draw.text(c, j.meter >= 50 ? "D: PATRIOTAS!" : "PATRIOTISMO", 243, 56, 10, 0xFFFFFFFF, Paint.Align.LEFT);
        if (j.combo >= 2) Draw.text(c, "COMBO x" + j.combo, 74, 78, 14, 0xFFFFD400, Paint.Align.LEFT);
        Draw.text(c, String.format("%07d", j.score), 730, 30, 22, 0xFFFFFFFF, Paint.Align.RIGHT);
        Draw.text(c, "Baleias: " + j.kills, 730, 48, 12, 0xFFDDDDDD, Paint.Align.RIGHT);
        Draw.rect(c, 0xAA000000, 742, 8, 792, 50);
        Draw.rect(c, 0xFFFFFFFF, 758, 18, 764, 40);
        Draw.rect(c, 0xFFFFFFFF, 772, 18, 778, 40);
        // progresso da travessia
        Draw.rect(c, 0xAA000000, 290, 10, 610, 24);
        Draw.rect(c, 0xFF1B8F3A, 292, 12, 292 + 316 * j.progress(), 22);
        Draw.circle(c, 0xFFFFD400, 292 + 316 * j.progress(), 17, 7);
        Draw.text(c, "TRAVESSIA DO LAGO", 450, 40, 12, 0xFFFFFFFF, Paint.Align.CENTER);
        Draw.text(c, "CAIS", 622, 22, 11, 0xFFFFD400, Paint.Align.LEFT);
        if (j.specialT > 0) Draw.text(c, "PATRIOTAS DE JET-SKI!", 400, 70, 20, 0xFFFFE082, Paint.Align.CENTER);
        if (j.time < 6f) Draw.text(c, "A bater de frente • B pula • C turbo • D chama os patriotas", 400, 436, 13, 0xFFFFFFFF, Paint.Align.CENTER);
    }

    // entrada: despacha para o modo de jogo atual
    private void inPress(int b) { if (jetMode) jet.press(b); else if (game.mirror) net.send(Snap.msgInput(Snap.I_PRESS, b, 0)); else game.press(b); }
    private void inRelease(int b) { if (jetMode) jet.release(b); else if (game.mirror) net.send(Snap.msgInput(Snap.I_RELEASE, b, 0)); else game.release(b); }
    private void inMove(float x, float y) { if (jetMode) jet.setMove(x, y); else if (game.mirror) { curJx = x; curJy = y; } else game.setMove(x, y); }


    /** Marcadores 2D sobre o mundo 3D: avisos de ataque, barras de vida e auras. */
    private void drawOverlays(Canvas c) {
        Game g = game;
        for (int pi = 0; pi < g.np; pi++) {
            g.use(pi);
            Ent o = g.p;
            float pz = R3.zOf(o.y);
            if (g.penT > 0) R3.ringFx(c, o.x, o.h + 2, pz, 46 + (float) Math.sin(g.time * 12) * 3, 0xAA40C4FF, 4);
            if (g.charged) R3.ringFx(c, o.x, o.h + 2, pz, 40 + (float) Math.sin(g.time * 20) * 6, 0xCCFFD400, 5);
            if (g.np == 2 && o.st != Game.S_DEAD) {
                R3.proj(o.x, o.h + 112 * R3.BIG, pz);
                boolean me = pi == g.local;
                Draw.text(c, (pi == 0 ? "1P" : "2P") + (me ? " ▼" : ""), R3.px, R3.py - 2, 14, pi == 0 ? 0xFF76FF03 : 0xFF40C4FF, Paint.Align.CENTER);
            }
        }
        g.use(g.local);
        for (int i = 0; i < g.ents.size(); i++) {
            Ent e = g.ents.get(i);
            if (e.type != Ent.ENEMY || !e.alive) continue;
            Data.Kind k = Data.KINDS[e.kind];
            R3.proj(e.x, e.h + 100 * k.scale * R3.BIG, R3.zOf(e.y));
            float sx = R3.px, sy = R3.py;
            if (e.st == Game.S_WIND) Draw.text(c, "!", sx, sy - 4, 24, 0xFFFF5252, Paint.Align.CENTER);
            if (e.confT > 0) Draw.text(c, "? ? ?", sx, sy - 4, 16, 0xFF66BB6A, Paint.Align.CENTER);
            if (!k.boss && e.hp < e.maxHp && !e.dying) {
                float bw = 36;
                Draw.rect(c, 0xAA000000, sx - bw / 2, sy + 2, sx + bw / 2, sy + 6);
                Draw.rect(c, 0xFFE53935, sx - bw / 2, sy + 2, sx - bw / 2 + bw * Math.max(0, e.hp) / e.maxHp, sy + 6);
            }
        }
    }

    private void drawPops(Canvas c, ArrayList<Game.Pop> pops) {
        for (Game.Pop q : pops) {
            float a = Math.max(0f, Math.min(1f, (q.life - q.t) / 0.35f));
            float row = Math.max(Game.Y0, Math.min(Game.Y1, q.y + 95));
            R3.proj(q.x, (row - q.y) * 1.25f, R3.zOf(row));
            float tx = Math.max(60, Math.min(740, R3.px));
            Draw.text(c, q.s, tx, Math.max(20, R3.py), 15, ((int) (a * 255) << 24) | (q.color & 0xFFFFFF), Paint.Align.CENTER);
        }
    }

    private void drawFx(Canvas c, ArrayList<Game.Fx> list, float camX) {
        for (Game.Fx f : list) {
            float k = Math.min(1f, f.t / f.life);
            int a = (int) ((1f - k) * 255);
            int col = (a << 24) | (f.color & 0xFFFFFF);
            float fz = R3.zOf(f.y);
            R3.proj(f.x, f.h * R3.BIG, fz);
            float sx = R3.px, sy = R3.py;
            switch (f.kind) {
                case Game.FX_RING:
                    R3.ringFx(c, f.x, 2, fz, f.r * k, col, 6 * (1f - k) + 2);
                    if (Draw.q >= 1) R3.ringFx(c, f.x, 2, fz, f.r * k * 0.7f, (a / 2 << 24) | (f.color & 0xFFFFFF), 3);
                    break;
                case Game.FX_SPARK: {
                    float r = f.r * (0.4f + k);
                    for (int i = 0; i < 6; i++) {
                        float ang = i * 1.047f + f.x;
                        Draw.line(c, col, sx + (float) Math.cos(ang) * r * 0.4f, sy + (float) Math.sin(ang) * r * 0.4f, sx + (float) Math.cos(ang) * r, sy + (float) Math.sin(ang) * r, 3);
                    }
                    break;
                }
                case Game.FX_LINE: {
                    R3.proj(f.x2, 40, R3.zOf(f.y2));
                    Draw.line(c, col, sx, sy, R3.px, R3.py, 4);
                    break;
                }
                case Game.FX_DUST: {
                    float r = f.r * (0.5f + k * 1.4f);
                    Draw.circle(c, ((int) ((1f - k) * 110) << 24) | (f.color & 0xFFFFFF), sx, sy - 6 * k, r);
                    Draw.circle(c, ((int) ((1f - k) * 70) << 24) | 0xFFFFFF, sx - r * 0.2f, sy - 8 * k, r * 0.6f);
                    break;
                }
                case Game.FX_BOOM: {
                    for (int i = 0; i < 7; i++) {
                        float ang = i * 0.9f;
                        Draw.circle(c, col, sx + (float) Math.cos(ang) * f.r * k * 1.2f, sy + (float) Math.sin(ang) * f.r * k - 20 * k + 30 * k * k, 5 * (1f - k) + 1);
                    }
                    break;
                }
                default: break;
            }
        }
    }

    // ---------------------------------------------------------------- HUD
    private void drawHud(Canvas c) {
        Game g = game;
        // retrato
        c.save();
        c.clipRect(8, 8, 66, 66);
        Draw.rect(c, 0xFF223322, 8, 8, 66, 66);
        Draw.Look lk = (g.hero == 0 && g.stageIdx == Data.STAGES.size() - 1) ? heroTorn : heroLooks[g.hero];
        float old = lk.scale; lk.scale = 1.5f;
        Draw.noShadow = true;
        R3.icon(c, lk, 30, 278, 1.5f, 0, Draw.P_IDLE);
        Draw.noShadow = false;
        lk.scale = old;
        c.restore();
        Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(3); Draw.P.setColor(0xFFFFD400);
        c.drawRect(8, 8, 66, 66, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
        Draw.text(c, Data.HERO_NAME[g.hero], 74, 20, 13, 0xFFFFFFFF, Paint.Align.LEFT);
        float hpf = Math.max(0f, g.p.hp / g.p.maxHp);
        Draw.rect(c, 0xFF000000, 73, 25, 277, 41);
        Draw.rect(c, hpf > 0.3f ? 0xFF2E9B3A : 0xFFE53935, 75, 27, 75 + 200 * hpf, 39);
        Draw.rect(c, 0xFF000000, 73, 45, 237, 57);
        Draw.rect(c, g.meter >= 50 ? (((int) (g.time * 6) & 1) == 0 ? 0xFFFFEA00 : 0xFFFFB300) : 0xFFC9A400, 75, 47, 75 + 160 * g.meter / 100f, 55);
        Draw.rect(c, 0xFF000000, 73 + 80, 45, 75 + 80, 57);
        Draw.text(c, g.meter >= 50 ? "D: ESPECIAL!" : "PATRIOTISMO", 243, 56, 10, 0xFFFFFFFF, Paint.Align.LEFT);
        float yy = 76;
        if (g.weapon >= 0) { Draw.text(c, Data.ITEM_NAME[g.weapon] + " x" + g.wUses, 74, yy, 11, 0xFFFFFFFF, Paint.Align.LEFT); yy += 13; }
        if (g.coffeeT > 0) { Draw.text(c, "Café " + (int) g.coffeeT + "s", 74, yy, 11, 0xFFFFD27F, Paint.Align.LEFT); yy += 13; }
        if (g.penT > 0) { Draw.text(c, "Invencível " + (int) g.penT + "s", 74, yy, 11, 0xFF40C4FF, Paint.Align.LEFT); yy += 13; }
        if (g.cloroImmune) { Draw.text(c, "Imune ao álcool", 74, yy, 11, 0xFFFFFFFF, Paint.Align.LEFT); yy += 13; }
        if (g.slowT > 0) { Draw.text(c, "LENTO", 74, yy, 11, 0xFFFFA000, Paint.Align.LEFT); yy += 13; }
        if (g.rootT > 0) { Draw.text(c, "PRESO!", 74, yy, 11, 0xFFFFEB3B, Paint.Align.LEFT); }
        // pontuação e pausa
        Draw.text(c, String.format("%07d", g.score), 730, 30, 22, 0xFFFFFFFF, Paint.Align.RIGHT);
        Draw.text(c, "Fase " + Data.STAGES.get(stageSel).id, 730, 48, 12, 0xFFDDDDDD, Paint.Align.RIGHT);
        Draw.rect(c, 0xAA000000, 742, 8, 792, 50);
        Draw.rect(c, 0xFFFFFFFF, 758, 18, 764, 40);
        Draw.rect(c, 0xFFFFFFFF, 772, 18, 778, 40);
        // chefe
        Ent b = g.bossRef;
        if (b != null && b.alive) {
            float f = Math.max(0f, b.hp / b.maxHp);
            Draw.rect(c, 0xFF000000, 298, 8, 602, 24);
            Draw.rect(c, 0xFFD32F2F, 300, 10, 300 + 300 * f, 22);
            if (b.shield > 0) Draw.rect(c, 0xFF80DEEA, 300, 22, 300 + 300 * Math.min(1f, b.shield / 45f), 25);
            Draw.text(c, Data.KINDS[b.kind].name.toUpperCase(), 450, 40, 13, 0xFFFFFFFF, Paint.Align.CENTER);
        }
        for (Ent x : g.ents) {
            if (x.type == Ent.ENEMY && x.alive && x.kind == Data.K_XANXA) {
                float f = Math.max(0f, x.hp / x.maxHp);
                Draw.rect(c, 0xFF000000, 298, 44, 602, 58);
                Draw.rect(c, 0xFF8D6E63, 300, 46, 300 + 300 * f, 56);
                Draw.text(c, "XANXA", 450, 70, 12, 0xFFFFFFFF, Paint.Align.CENTER);
                break;
            }
        }
        // rádio
        if (g.radioT > 0 && g.radio != null && !g.radio.isEmpty()) {
            Draw.rect(c, 0xCC101810, 150, 60, 650, 118);
            Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(2); Draw.P.setColor(0xFF76FF03);
            c.drawRect(150, 60, 650, 118, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
            Draw.text(c, "CORONEL HELENÃO (rádio)", 158, 76, 11, 0xFF76FF03, Paint.Align.LEFT);
            wrap(c, "“" + g.radio + "”", 158, 96, 480, 15, 0xFFFFFFFF, Paint.Align.LEFT);
        }
        if (g.goT > 0 && ((int) (g.time * 3) & 1) == 0) {
            Draw.text(c, "VÁ ▶", 735, 230, 30, 0xFFFFD400, Paint.Align.CENTER);
        }
    }

    // ---------------------------------------------------------------- controles virtuais
    private float bx(int i) {
        float cx = vw - 2.35f * u, R = 1.1f * u;
        return i == 0 ? cx + R : i == 1 ? cx : i == 2 ? cx - R : cx;
    }

    private float by(int i) {
        float cy = vh - 2.25f * u, R = 1.1f * u;
        return i == 0 ? cy : i == 1 ? cy + R : i == 2 ? cy : cy - R;
    }

    private void drawControls(Canvas c) {
        Paint p = Draw.P;
        float R = 1.45f * u;
        float jx0 = joyActive ? joyCx : 2.6f * u, jy0 = joyActive ? joyCy : vh - 2.6f * u;
        p.setStyle(Paint.Style.FILL);
        p.setColor(joyActive ? 0x44FFFFFF : 0x22FFFFFF);
        c.drawCircle(jx0, jy0, R, p);
        p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(3); p.setColor(0x88FFFFFF);
        c.drawCircle(jx0, jy0, R, p);
        p.setStyle(Paint.Style.FILL); p.setColor(joyActive ? 0xAAFFFFFF : 0x55FFFFFF);
        c.drawCircle(jx0 + joyX * R * 0.7f, jy0 + joyY * R * 0.7f, 0.62f * u, p);
        String[] lab = {"A", "B", "C", "D"};
        String[] sub = jetMode ? new String[]{"BATER", "PULO", "TURBO", "PATRIOTAS"} : new String[]{"SOCO", "PULO", "AGARRA", "ESPECIAL"};
        int[] col = {0xFFD32F2F, 0xFF1976D2, 0xFF388E3C, 0xFFFBC02D};
        for (int i = 0; i < 4; i++) {
            float x = bx(i), y = by(i), r = (i == 0 ? 0.88f : 0.76f) * u;
            boolean glow = i == 3 && (jetMode ? jet.meter : game.meter) >= 50 && (((int) ((jetMode ? jet.time : game.time) * 6)) & 1) == 0;
            p.setStyle(Paint.Style.FILL);
            p.setColor(btnDown[i] ? 0xDD000000 | (col[i] & 0xFFFFFF) : (glow ? 0xBB000000 | (col[i] & 0xFFFFFF) : 0x77000000 | (col[i] & 0xFFFFFF)));
            c.drawCircle(x, y, r, p);
            p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(4); p.setColor(0xCCFFFFFF);
            c.drawCircle(x, y, r, p);
            p.setStyle(Paint.Style.FILL);
            p.setTextAlign(Paint.Align.CENTER); p.setFakeBoldText(true); p.setColor(0xFFFFFFFF);
            p.setTextSize(r * 0.8f); c.drawText(lab[i], x, y + r * 0.1f, p);
            p.setTextSize(r * 0.3f); c.drawText(sub[i], x, y + r * 0.58f, p);
            p.setFakeBoldText(false);
        }
    }

    private void resetTouch() {
        java.util.Arrays.fill(role, -1);
        joyActive = false; joyX = joyY = 0;
        for (int i = 0; i < 4; i++) btnDown[i] = false;
        downBtn = -1;
        try { inMove(0, 0); if (jetMode) jet.release(Game.BC); else if (game.p != null) inRelease(Game.BA); } catch (Exception ignored) { }
    }

    // ---------------------------------------------------------------- toque
    @Override public boolean onTouchEvent(MotionEvent e) {
        int a = e.getActionMasked();
        int idx = e.getActionIndex();
        switch (a) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_POINTER_DOWN:
                touchDown(e.getPointerId(idx), e.getX(idx), e.getY(idx));
                break;
            case MotionEvent.ACTION_MOVE:
                for (int i = 0; i < e.getPointerCount(); i++) touchMove(e.getPointerId(i), e.getX(i), e.getY(i));
                break;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_POINTER_UP:
                touchUp(e.getPointerId(idx), e.getX(idx), e.getY(idx));
                break;
            case MotionEvent.ACTION_CANCEL:
                resetTouch();
                break;
            default: break;
        }
        return true;
    }

    private float vx(float x) { return (x - ox) / sc; }
    private float vy(float y) { return (y - oy) / sc; }

    private Btn hit(float x, float y) {
        float X = vx(x), Y = vy(y);
        for (int i = 0; i < btnN; i++) { Btn b = btns.get(i); if (b.on && b.r.contains(X, Y)) return b; }
        return null;
    }

    private void touchDown(int id, float x, float y) {
        if (id >= role.length) return;
        if (screen == SC_PLAY) {
            float X = vx(x), Y = vy(y);
            if (X > 735 && X < 800 && Y < 56) { screen = SC_PAUSE; resetTouch(); return; }
            for (int i = 0; i < 4; i++) {
                float dx = x - bx(i), dy = y - by(i), r = (i == 0 ? 0.88f : 0.76f) * u * 1.25f;
                if (dx * dx + dy * dy <= r * r) {
                    role[id] = i + 1; btnDown[i] = true; inPress(i);
                    return;
                }
            }
            if (x < vw * 0.55f && !joyActive) {
                role[id] = 0; joyActive = true; joyCx = x; joyCy = y; joyX = joyY = 0;
                float R = 1.45f * u;
                joyCx = Math.max(R, Math.min(vw - R, joyCx)); joyCy = Math.max(R, Math.min(vh - R, joyCy));
            }
            return;
        }
        if (screen == SC_SPLASH) { screen = SC_MENU; screenT = 0; sfx.music(2); return; }
        Btn b = hit(x, y);
        downBtn = b != null ? b.id : -1;
        if (screen == SC_BRIEF && b == null) briefT += 40;
    }

    private void touchMove(int id, float x, float y) {
        if (id >= role.length || role[id] != 0) return;
        float R = 1.45f * u;
        float dx = x - joyCx, dy = y - joyCy;
        float d = (float) Math.sqrt(dx * dx + dy * dy);
        if (d > R) { // base acompanha o dedo
            joyCx += dx / d * (d - R); joyCy += dy / d * (d - R);
            dx = x - joyCx; dy = y - joyCy; d = R;
        }
        float nx = dx / R, ny = dy / R;
        joyX = nx; joyY = ny;
        float dead = 0.18f;
        float mag = (float) Math.sqrt(nx * nx + ny * ny);
        float gain = sensLv == 0 ? 0.8f : sensLv == 1 ? 1.15f : 1.6f;
        if (mag < dead) { inMove(0, 0); return; }
        float k = Math.min(1f, (mag - dead) / (1f - dead) * gain) / mag;
        inMove(nx * k, ny * k);
    }

    private void touchUp(int id, float x, float y) {
        if (id >= role.length) return;
        int r = role[id];
        role[id] = -1;
        if (screen == SC_PLAY) {
            if (r == 0) { joyActive = false; joyX = joyY = 0; inMove(0, 0); }
            else if (r >= 1 && r <= 4) { btnDown[r - 1] = false; inRelease(r - 1); }
            return;
        }
        Btn b = hit(x, y);
        int pressed = downBtn;
        downBtn = -1;
        if (b != null && b.id == pressed) onButton(b.id);
    }

    private void onButton(int id) {
        switch (id) {
            case B_PLAY: fromStageList = false; stageSel = 0; screen = SC_SELECT; screenT = 0; break;
            case B_STAGES: screen = SC_STAGES; screenT = 0; break;
            case B_COOP: net.close(); coopSub = 0; screen = SC_COOP; screenT = 0; break;
            case B_HOSTW:
                if (!Net.wifiAvailable()) { coopMsg("Conecte os dois celulares na mesma rede Wi-Fi (ou ligue o ponto de acesso de um deles)."); break; }
                coopWifi = true; net.listenWifi(android.os.Build.MODEL); coopSub = 1; break;
            case B_JOINW:
                if (!Net.wifiAvailable()) { coopMsg("Conecte os dois celulares na mesma rede Wi-Fi (ou ligue o ponto de acesso de um deles)."); break; }
                coopWifi = true; net.scanWifi(); coopSub = 2; break;
            case B_HOST: coopWifi = false; pendingBt = 1; if (btReady()) { pendingBt = 0; startHost(); } break;
            case B_JOIN: coopWifi = false; pendingBt = 2; if (btReady()) { pendingBt = 0; openDevices(); } break;
            case B_BTSET: { MainActivity a = act(); if (a != null) a.openBtSettings(); break; }
            case B_OPTIONS: screen = SC_OPTIONS; screenT = 0; break;
            case B_CREDITS: screen = SC_CREDITS; screenT = 0; sfx.music(2); break;
            case B_BACK:
                if (coop) {
                    if (screen == SC_BRIEF) screen = SC_STAGES; else if (screen == SC_STAGES) screen = SC_SELECT; else endCoop("");
                    screenT = 0; break;
                }
                if (screen == SC_COOP) { if (coopSub != 0) { net.close(); coopSub = 0; } else goMenu(); break; }
                if (screen == SC_BRIEF) { screen = fromStageList ? SC_STAGES : SC_SELECT; }
                else if (screen == SC_SELECT && fromStageList) screen = SC_STAGES;
                else goMenu();
                screenT = 0;
                break;
            case B_NEXT:
                if (screen == SC_SELECT && coop) {
                    savePrefs(); net.send(Snap.msg(Snap.M_HERO, hero, 0, 0));
                    if (net.host) { screen = SC_STAGES; screenT = 0; } else { screen = SC_WAIT; screenT = 0; }
                }
                else if (screen == SC_SELECT) { screen = SC_BRIEF; briefT = 0; screenT = 0; savePrefs(); }
                else if (screen == SC_BRIEF) { startStage(stageSel); }
                else if (screen == SC_WIN) {
                    int nx = nextStage();
                    if (nx >= 0) { stageSel = nx; screen = SC_BRIEF; briefT = 0; screenT = 0; sfx.music(2); }
                    else if (coop) endCoop(""); else { screen = SC_CREDITS; screenT = 0; }
                }
                break;
            case B_RESUME: screen = SC_PLAY; last = System.nanoTime(); resetTouch(); break;
            case B_RESTART: startStage(stageSel); break;
            case B_MENU: if (coop) endCoop(""); else goMenu(); break;
            case B_CONTINUE:
                if (jetMode) jet.continueGame(); else game.continueGame();
                screen = SC_PLAY; resetTouch(); last = System.nanoTime(); playStageMusic(stageSel);
                break;
            default:
                if (id >= B_HERO && id < B_HERO + 6) { int h = id - B_HERO; if (heroUnlocked(h)) { hero = h; savePrefs(); if (coop) net.send(Snap.msg(Snap.M_HERO, hero, 0, 0)); } }
                else if (id >= B_DEV && id < B_DEV + 8) { int d = id - B_DEV; if (coopWifi) { if (d < wifiList.size()) { net.connectWifi(wifiList.get(d)[0], wifiList.get(d)[1]); coopSub = 3; } }
                    else if (d < devices.size()) { net.connect(devices.get(d)); coopSub = 3; } }
                else if (id >= B_STAGE && id < B_STAGE + 20) {
                    int s = id - B_STAGE;
                    if (coop) { if (s <= cleared && s < Data.STAGES.size() && !Data.STAGES.get(s).jet) { stageSel = s; screen = SC_BRIEF; briefT = 0; screenT = 0; } }
                    else if (s <= cleared && s < Data.STAGES.size()) { stageSel = s; fromStageList = true; screen = SC_SELECT; screenT = 0; }
                } else if (id >= B_OPT && id < B_OPT + 10) {
                    switch (id - B_OPT) {
                        case 0: sfxLv = (sfxLv + 1) % 4; sfx.sfx(Game.SFX_ITEM); break;
                        case 1: voiceLv = (voiceLv + 1) % 4; break;
                        case 2: musicLv = (musicLv + 1) % 4; break;
                        case 3: sensLv = (sensLv + 1) % 3; break;
                        case 4: gfx = (gfx + 1) % 4; Draw.q = gfx == 3 ? 2 : gfx; break;
                        case 5: vibOn = 1 - vibOn; break;
                        default: break;
                    }
                    applyAudio(); savePrefs();
                    if (id - B_OPT == 1) sfx.voice("Vagabundo!");
                }
        }
    }
}
