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
            SC_BRIEF = 6, SC_PLAY = 7, SC_PAUSE = 8, SC_OVER = 9, SC_WIN = 10;

    // ids de botões de menu
    private static final int B_PLAY = 1, B_STAGES = 2, B_OPTIONS = 3, B_CREDITS = 4, B_BACK = 5, B_NEXT = 6,
            B_RESUME = 7, B_RESTART = 8, B_MENU = 9, B_CONTINUE = 10, B_HERO = 20, B_STAGE = 40, B_OPT = 60;

    private final Sfx sfx;
    private final Game game;
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
    private final Draw.Look[] heroLooks = new Draw.Look[4];
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
    private static final Comparator<Ent> BY_Y = (a, b) -> Float.compare(a.y, b.y);

    GameView(Context ctx) {
        super(ctx);
        prefs = ctx.getSharedPreferences("patriota", Context.MODE_PRIVATE);
        sfx = new Sfx(ctx);
        game = new Game(sfx);
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
        if (hero < 0 || hero > 3 || !heroUnlocked(hero)) hero = 0;
        Draw.q = gfx;
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

    private boolean heroUnlocked(int h) { return h == 0 || cleared >= h; }

    private void buildLooks() {
        for (int i = 0; i < Data.KINDS.length; i++) {
            Data.Kind k = Data.KINDS[i];
            Draw.Look l = new Draw.Look();
            l.skin = k.skin; l.shirt = k.shirt; l.pants = k.pants; l.hair = k.hair; l.acc = k.acc; l.scale = k.scale;
            if (i == Data.K_CHEFAO || i == Data.K_DOMINGAO || i == Data.K_ATILA) l.girth = 1.2f;
            kindLooks[i] = l;
        }
        for (int i = 0; i < 4; i++) {
            Draw.Look l = new Draw.Look();
            int[] c = Data.HERO_COL[i];
            l.skin = c[0]; l.shirt = c[1]; l.pants = c[2]; l.hair = c[3]; l.hero = i;
            if (i == 1) l.girth = 1.25f;
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

    void release() { sfx.release(); }

    boolean onBack() {
        switch (screen) {
            case SC_PLAY: screen = SC_PAUSE; resetTouch(); return true;
            case SC_PAUSE: screen = SC_PLAY; last = System.nanoTime(); return true;
            case SC_MENU: case SC_SPLASH: return false;
            case SC_BRIEF: case SC_OVER: case SC_WIN: goMenu(); return true;
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
        screenT += dt;
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
        Scene.bg(c, theme, screenT * 40, screenT, gfx == 0);
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
        Scene.bg(c, Data.TH_PAULISTA, screenT * 30, screenT, gfx == 0);
        Draw.rect(c, 0x66000000, 0, 0, Game.W, Game.H);
        Draw.text(c, "OPERAÇÃO PATRIOTA 3D", 400, 70, 42, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, "Beat 'em up de rua — Jair Bonossauro", 400, 96, 16, 0xFFFFFFFF, Paint.Align.CENTER);
        Draw.person(c, 150, 400, 0, 1, heroLooks[hero], screenT * 60, 0, Draw.P_IDLE, 0, 0, -1, false);
        c.save(); c.translate(0, 0);
        addBtn(c, B_PLAY, 290, 125, 560, 183, "JOGAR (MODO HISTÓRIA)", true, 0xFF1B8F3A);
        addBtn(c, B_STAGES, 290, 195, 560, 253, "SELEÇÃO DE FASES", true, 0xFF1D3E9A);
        addBtn(c, B_OPTIONS, 290, 265, 560, 323, "OPÇÕES", true, 0xFF6A4C93);
        addBtn(c, B_CREDITS, 290, 335, 560, 393, "CRÉDITOS", true, 0xFFB35C00);
        c.restore();
        Draw.text(c, "Progresso: " + Math.min(cleared, Data.STAGES.size()) + "/" + Data.STAGES.size() + " fases", 790, 440, 14, 0xFFFFFFFF, Paint.Align.RIGHT);
    }

    private void drawSelect(Canvas c) {
        panelBg(c, Data.TH_CAMPUS);
        title(c, "ESCOLHA SEU PERSONAGEM", 44);
        for (int i = 0; i < 4; i++) {
            float x0 = 20 + i * 192, x1 = x0 + 180;
            boolean ok = heroUnlocked(i);
            boolean sel = i == hero;
            Draw.rect(c, sel ? 0xCC1B8F3A : 0xCC222222, x0, 70, x1, 360);
            Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(sel ? 5 : 2); Draw.P.setColor(sel ? 0xFFFFD400 : 0xFF888888);
            c.drawRect(x0, 70, x1, 360, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
            Draw.person(c, (x0 + x1) / 2, 215, 0, 1, heroLooks[i], screenT * 60, 0, Draw.P_IDLE, 0, 0, -1, false);
            Draw.text(c, Data.HERO_NAME[i], (x0 + x1) / 2, 245, 14, 0xFFFFFFFF, Paint.Align.CENTER);
            String[] ds = Data.HERO_DESC[i].split("\n");
            for (int k = 0; k < ds.length; k++) Draw.text(c, ds[k], (x0 + x1) / 2, 268 + k * 16, 11.5f, 0xFFDDDDDD, Paint.Align.CENTER);
            Draw.text(c, "HP " + (int) Data.HERO_HP[i] + "  VEL " + (int) (Data.HERO_SPD[i] * 100) + "  DANO " + (int) (Data.HERO_DMG[i] * 100), (x0 + x1) / 2, 312, 11, 0xFFFFD400, Paint.Align.CENTER);
            if (!ok) {
                Draw.rect(c, 0xCC000000, x0, 70, x1, 360);
                Draw.text(c, "BLOQUEADO", (x0 + x1) / 2, 200, 18, 0xFFFF5252, Paint.Align.CENTER);
                Draw.text(c, "Vença a fase " + Data.STAGES.get(i - 1).id, (x0 + x1) / 2, 224, 12, 0xFFFFFFFF, Paint.Align.CENTER);
            }
            addBtn(c, B_HERO + i, x0 + 10, 325, x1 - 10, 352, ok ? (sel ? "ESCOLHER ✔" : "ESCOLHER") : "—", ok, ok ? 0xFF1D3E9A : 0xFF555555);
        }
        addBtn(c, B_BACK, 30, 385, 230, 435, "VOLTAR", true, 0xFF7B1FA2);
        addBtn(c, B_NEXT, 570, 385, 770, 435, "AVANÇAR ▶", true, 0xFF1B8F3A);
    }

    private void drawStages(Canvas c) {
        panelBg(c, Data.TH_PAULISTA);
        title(c, "SELEÇÃO DE FASES", 44);
        int n = Data.STAGES.size();
        for (int i = 0; i < n; i++) {
            int col = i / 4, row = i % 4;
            float x0 = 30 + col * 385, y0 = 70 + row * 74;
            boolean ok = i <= cleared;
            String name = Data.STAGES.get(i).id + " · " + Data.STAGES.get(i).title.split(" — ")[0];
            addBtn(c, B_STAGE + i, x0, y0, x0 + 365, y0 + 62, ok ? name : "🔒 " + Data.STAGES.get(i).id + " · bloqueada", ok, ok ? (i < cleared ? 0xFF1B8F3A : 0xFF1D3E9A) : 0xFF555555);
        }
        addBtn(c, B_BACK, 30, 385, 230, 435, "VOLTAR", true, 0xFF7B1FA2);
    }

    private static final String[] LV = {"0%", "33%", "66%", "100%"};

    private void drawOptions(Canvas c) {
        panelBg(c, Data.TH_QUARENT);
        title(c, "OPÇÕES", 44);
        addBtn(c, B_OPT + 0, 120, 70, 680, 118, "Efeitos sonoros: " + LV[sfxLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 1, 120, 128, 680, 176, "Volume das vozes: " + LV[voiceLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 2, 120, 186, 680, 234, "Música: " + LV[musicLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 3, 120, 244, 680, 292, "Sensibilidade do analógico: " + new String[]{"Baixa", "Normal", "Alta"}[sensLv], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 4, 120, 302, 680, 350, "Gráficos: " + new String[]{"Leve", "Normal", "Alta (texturas e sombras)"}[gfx], true, 0xFF1D3E9A);
        addBtn(c, B_OPT + 5, 120, 360, 680, 408, "Vibração: " + (vibOn == 1 ? "Ligada" : "Desligada"), true, 0xFF1D3E9A);
        addBtn(c, B_BACK, 30, 395, 190, 440, "VOLTAR", true, 0xFF7B1FA2);
    }

    private void drawCredits(Canvas c) {
        Scene.bg(c, Data.TH_TRIBUNAL, screenT * 90, screenT, gfx == 0);
        Draw.rect(c, 0x55000000, 0, 0, Game.W, Game.H);
        // motociata triunfal
        for (int i = 0; i < 5; i++) {
            float x = ((screenT * 260 + i * 210) % 1300) - 200;
            c.save();
            Draw.noShadow = true;
            Draw.moto(c, x, 420 - (i % 2) * 10, 1, screenT + i, false);
            Draw.person(c, x - 4, 410 - (i % 2) * 10, 8, 1, heroLooks[i % 4], 0, 0, Draw.P_IDLE, 0, 0, -1, false);
            Draw.noShadow = false;
            c.restore();
        }
        String[] lines = {"OPERAÇÃO PATRIOTA 3D", "", "Um beat 'em up satírico", "", "Design de jogo: Rafa", "Programação: Claude", "", "Personagens: Jair Bonossauro, Coronel Helenão,",
                "Patriota do Caminhão, Tiozão do Zap, Véio da Havan-a", "", "Chefes: Doutor Atila-mento, Reitor Desconstruído,", "Apresentador Domingão, William Boné,", "Xerxes de Moraes e Mula", "",
                "Obra de ficção e paródia.", "Qualquer semelhança é mera coincidência.", "", "Obrigado por jogar!"};
        float y = 460 - (screenT * 38) % (lines.length * 26 + 520);
        for (String s : lines) { Draw.text(c, s, 400, y, 20, 0xFFFFFFFF, Paint.Align.CENTER); y += 26; }
        addBtn(c, B_BACK, 30, 395, 190, 440, "VOLTAR", true, 0xFF7B1FA2);
    }

    private void drawBrief(Canvas c, float dt) {
        Data.Stage st = Data.STAGES.get(stageSel);
        Scene.bg(c, st.segs.get(0).theme, screenT * 20, screenT, gfx == 0);
        Draw.rect(c, 0xAA000000, 0, 0, Game.W, Game.H);
        Draw.text(c, "MISSÃO " + st.id, 400, 44, 30, 0xFFFFD400, Paint.Align.CENTER);
        Draw.text(c, st.title, 400, 72, 18, 0xFFFFFFFF, Paint.Align.CENTER);
        // Coronel Helenão
        c.save();
        c.clipRect(30, 95, 190, 255);
        Draw.rect(c, 0xFF2E3B2A, 30, 95, 190, 255);
        Draw.person(c, 110, 285, 0, 1, helenao, 0, 0, Draw.P_IDLE, 0, 0, -1, false);
        c.save();
        c.translate(110, 285); c.scale(1.4f, 1.4f);
        Draw.poly(c, 0xFF556B2F, -12, -91, -2, -101, 14, -96, 13, -87, -10, -86); // boina
        Draw.rect(c, 0xFF9E9E9E, 1, -77.5f, 13, -74.5f); // bigode
        c.restore();
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
        Draw.text(c, "Personagem: " + Data.HERO_NAME[hero], 400, 372, 15, 0xFFFFD400, Paint.Align.CENTER);
        addBtn(c, B_BACK, 30, 392, 210, 440, "VOLTAR", true, 0xFF7B1FA2);
        addBtn(c, B_NEXT, 560, 392, 770, 440, cnt < full.length() ? "AVANÇAR ▶▶" : "AVANÇAR ▶", true, 0xFF1B8F3A);
    }

    // ---------------------------------------------------------------- jogo
    private void startStage(int idx) {
        stageSel = idx;
        game.start(idx, hero);
        screen = SC_PLAY; screenT = 0;
        resetTouch();
        sfx.music(1);
        last = System.nanoTime();
    }

    private void drawPlay(Canvas c, float dt) {
        Game g = game;
        if (screen == SC_PLAY) {
            g.update(dt);
            if (g.result == 2) { screen = SC_OVER; screenT = 0; resetTouch(); sfx.music(0); }
            else if (g.result == 1) onWin();
        } else {
            // animação leve de efeitos mesmo em overlays
            if (screen == SC_WIN || screen == SC_OVER) g.update(0);
        }
        c.save();
        if (g.shake > 0 && screen == SC_PLAY) c.translate((rnd.nextFloat() - 0.5f) * g.shake, (rnd.nextFloat() - 0.5f) * g.shake);
        Scene.bg(c, g.theme(), g.camX, g.time, gfx == 0);
        drawList.clear();
        drawList.addAll(g.ents);
        drawList.add(g.p);
        Collections.sort(drawList, BY_Y);
        for (int i = 0; i < drawList.size(); i++) drawEnt(c, drawList.get(i));
        drawFx(c);
        Scene.post(c, g.theme());
        for (Game.Pop q : g.pops) {
            float a = Math.max(0f, Math.min(1f, (q.life - q.t) / 0.35f));
            Draw.text(c, q.s, q.x - g.camX, q.y, 15, ((int) (a * 255) << 24) | (q.color & 0xFFFFFF), Paint.Align.CENTER);
        }
        c.restore();
        if (g.blurT > 0) {
            Draw.rect(c, ((int) (Math.min(1f, g.blurT) * 150) << 24) | 0xFFFFFF, 0, 0, Game.W, Game.H);
            for (int i = 0; i < 12; i++) Draw.circle(c, 0x66FFFFFF, (i * 97 + g.time * 40) % 800, (i * 53) % 450, 18 + (i % 4) * 8);
        }
        drawHud(c);
        if (screen == SC_PAUSE) {
            Draw.rect(c, 0xAA000000, 0, 0, Game.W, Game.H);
            title(c, "PAUSADO", 110);
            addBtn(c, B_RESUME, 290, 140, 510, 196, "CONTINUAR", true, 0xFF1B8F3A);
            addBtn(c, B_RESTART, 290, 208, 510, 264, "REINICIAR FASE", true, 0xFF1D3E9A);
            addBtn(c, B_MENU, 290, 276, 510, 332, "MENU PRINCIPAL", true, 0xFFB35C00);
        } else if (screen == SC_OVER) {
            Draw.rect(c, 0xBB200000, 0, 0, Game.W, Game.H);
            Draw.text(c, "GAME OVER", 400, 110, 54, 0xFFFF5252, Paint.Align.CENTER);
            Draw.text(c, "CORONEL HELENÃO (rádio): “Levanta, recruta!”", 400, 160, 20, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "Pontuação: " + g.score, 400, 195, 18, 0xFFFFD400, Paint.Align.CENTER);
            addBtn(c, B_CONTINUE, 290, 225, 510, 285, "CONTINUAR", true, 0xFF1B8F3A);
            addBtn(c, B_MENU, 290, 300, 510, 350, "MENU PRINCIPAL", true, 0xFFB35C00);
        } else if (screen == SC_WIN) {
            Draw.rect(c, 0xBB001A00, 0, 0, Game.W, Game.H);
            Draw.text(c, "MISSÃO CUMPRIDA!", 400, 100, 46, 0xFFFFD400, Paint.Align.CENTER);
            Draw.text(c, Data.STAGES.get(stageSel).title, 400, 135, 18, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "Pontuação: " + g.score, 400, 175, 26, 0xFFFFFFFF, Paint.Align.CENTER);
            Draw.text(c, "Vida restante: " + (int) g.p.hp + " / " + (int) g.p.maxHp, 400, 205, 16, 0xFFCCFFCC, Paint.Align.CENTER);
            if (!unlockMsg.isEmpty()) Draw.text(c, unlockMsg, 400, 235, 18, 0xFF76FF03, Paint.Align.CENTER);
            boolean more = stageSel + 1 < Data.STAGES.size();
            if (more) addBtn(c, B_NEXT, 270, 262, 530, 322, "PRÓXIMA MISSÃO ▶", true, 0xFF1B8F3A);
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
    }

    private void drawEnt(Canvas c, Ent e) {
        Game g = game;
        float sx = e.x - g.camX;
        if (sx < -120 || sx > Game.W + 120) return;
        Draw.persp = Draw.q >= 1 ? 0.88f + 0.2f * Math.max(0f, Math.min(1f, (e.y - Game.Y0) / (float) (Game.Y1 - Game.Y0))) : 1f;
        drawEntInner(c, e, sx);
        Draw.persp = 1f;
    }

    private void drawEntInner(Canvas c, Ent e, float sx) {
        Game g = game;
        switch (e.type) {
            case Ent.CRATE: Draw.crate(c, sx, e.y, e.flash, g.theme(), e.hp / e.maxHp); break;
            case Ent.ITEM: Draw.item(c, sx, e.y, e.h, e.kind, e.life); break;
            case Ent.PROJ: Draw.proj(c, e, sx, e.y, g.time); break;
            case Ent.DESK: Draw.desk(c, sx, e.y, e.flash, e.hp / e.maxHp); break;
            case Ent.ENEMY: drawEnemy(c, e, sx); break;
            case Ent.PLAYER: drawPlayer(c, e, sx); break;
            default: break;
        }
    }

    private void drawEnemy(Canvas c, Ent e, float sx) {
        Data.Kind k = Data.KINDS[e.kind];
        int pose; float pt = 0; float mv = 1f;
        switch (e.st) {
            case Game.S_WIND: pose = Draw.P_WIND; pt = e.t / Math.max(0.1f, e.wind > 0 ? e.wind : k.windup); mv = 0; break;
            case Game.S_ATK: pose = Draw.P_PUNCH; pt = Math.min(1f, e.t / 0.3f); mv = 0; break;
            case Game.S_HURT: pose = Draw.P_HURT; mv = 0; break;
            case Game.S_DOWN: case Game.S_DEAD: pose = Draw.P_DOWN; mv = 0; break;
            case Game.S_HELD: pose = Draw.P_HURT; mv = 0; break;
            default: pose = Draw.P_IDLE; break;
        }
        if (e.st == Game.S_DEAD && ((int) (e.t * 14) & 1) == 0) return; // pisca ao sumir
        Draw.Look lk = kindLooks[e.kind];
        float flash = e.flash;
        if (e.st == Game.S_WIND && ((int) (e.t * 20) & 1) == 0) flash = 0.01f;
        boolean airDown = e.st == Game.S_DOWN && e.h > 0;
        Draw.person(c, sx, e.y, e.h, e.face, lk, e.walk, mv, pose, pt, flash, -1, e.guardUp);
        if (e.shield > 0) {
            Draw.P.setStyle(Paint.Style.FILL); Draw.P.setColor(0x4480DEEA);
            c.drawCircle(sx, e.y - 50 * k.scale - e.h, 52 * k.scale, Draw.P);
            Draw.ring(c, 0xAA80DEEA, sx, e.y - 50 * k.scale - e.h, 52 * k.scale, 3);
        }
        if (e.st == Game.S_WIND && !airDown) Draw.text(c, "!", sx, e.y - 104 * k.scale - e.h, 22, 0xFFFF5252, Paint.Align.CENTER);
        if (e.confT > 0) Draw.text(c, "? ? ?", sx, e.y - 104 * k.scale - e.h, 16, 0xFF66BB6A, Paint.Align.CENTER);
        if (!k.boss && e.hp < e.maxHp && !e.dying) {
            float bw = 36;
            Draw.rect(c, 0xAA000000, sx - bw / 2, e.y - 104 * k.scale - e.h + 6, sx + bw / 2, e.y - 104 * k.scale - e.h + 10);
            Draw.rect(c, 0xFFE53935, sx - bw / 2, e.y - 104 * k.scale - e.h + 6, sx - bw / 2 + bw * Math.max(0, e.hp) / e.maxHp, e.y - 104 * k.scale - e.h + 10);
        }
    }

    private void drawPlayer(Canvas c, Ent o, float sx) {
        Game g = game;
        if (g.penT > 0) { Draw.ring(c, 0xAA40C4FF, sx, o.y - 50 - o.h, 46 + (float) Math.sin(g.time * 12) * 3, 4); }
        if (g.charged) Draw.ring(c, 0xAAFFD400, sx, o.y - 40 - o.h, 36 + (float) Math.sin(g.time * 20) * 5, 5);
        if (o.inv > 0 && o.inv < 3 && o.st != Game.S_SPECIAL && ((int) (g.time * 14) & 1) == 0 && o.st != Game.S_DOWN) return;
        Draw.Look lk = (g.hero == 0 && g.stageIdx == 7) ? heroTorn : heroLooks[g.hero];
        float pt = 0; int pose = Draw.P_IDLE; float mv = 0;
        boolean moving = (Math.abs(g.jx) > 0.2f || Math.abs(g.jy) > 0.2f) && g.rootT <= 0;
        switch (o.st) {
            case Game.S_IDLE: pose = Draw.P_IDLE; mv = moving ? 1f : 0f; break;
            case Game.S_ATK: {
                pt = g.atkProg();
                boolean fin = g.mounted ? g.comboStep == 3 : g.comboStep == 4;
                pose = (fin && g.weapon < 0 && g.hero != 2) ? Draw.P_KICK : Draw.P_PUNCH;
                if (g.mounted) pose = g.comboStep == 3 ? Draw.P_KICK : Draw.P_PUNCH;
                break;
            }
            case Game.S_JUMP: pose = Draw.P_JUMP; break;
            case Game.S_JKICK: pose = g.mounted ? Draw.P_SPIN : Draw.P_JKICK; break;
            case Game.S_HURT: pose = Draw.P_HURT; break;
            case Game.S_DOWN: case Game.S_DEAD: pose = Draw.P_DOWN; break;
            case Game.S_GRAB: pose = Draw.P_GRAB; break;
            case Game.S_CHARGE: pose = Draw.P_CHARGE; break;
            case Game.S_SPECIAL:
                if (g.spK == Game.SP_SPIN) pose = Draw.P_SPIN;
                else if (g.spK == Game.SP_BURST) pose = Draw.P_WIND;
                else pose = Draw.P_SPEC;
                break;
            default: break;
        }
        if (o.st == Game.S_SPECIAL && (g.spK == Game.SP_RIDE || g.spK == Game.SP_TRUCK)) {
            boolean truck = g.spK == Game.SP_TRUCK;
            Draw.moto(c, sx, o.y, o.face, g.time, truck);
            Draw.noShadow = true;
            Draw.person(c, sx - o.face * 4, o.y, truck ? 36 : 22, o.face, lk, 0, 0, Draw.P_IDLE, 0, 0, -1, false);
            Draw.noShadow = false;
            return;
        }
        if (g.mounted) {
            boolean roar = o.st == Game.S_SPECIAL && g.spK == Game.SP_ROAR;
            int rp = Draw.P_IDLE;
            if (o.st == Game.S_ATK) rp = g.comboStep == 3 ? Draw.P_KICK : Draw.P_PUNCH;
            else if (o.st == Game.S_JKICK) rp = Draw.P_SPIN;
            else if (o.st == Game.S_SPECIAL && g.spK == Game.SP_LANCE) rp = Draw.P_SPEC;
            if (o.st == Game.S_DOWN || o.st == Game.S_DEAD) {
                Draw.person(c, sx, o.y, o.h, o.face, lk, 0, 0, Draw.P_DOWN, 0, o.flash, -1, false);
                return;
            }
            Draw.raptor(c, sx, o.y, o.h, o.face, o.walk, mv, rp, pt, o.flash, roar);
            Draw.noShadow = true;
            Draw.Look rl = lk;
            float old = rl.scale; rl.scale = 0.78f;
            Draw.person(c, sx - o.face * 6, o.y, o.h + 66, o.face, rl, 0, 0, Draw.P_IDLE, 0, o.flash, -1, false);
            rl.scale = old;
            Draw.noShadow = false;
            return;
        }
        Draw.person(c, sx, o.y, o.h, o.face, lk, o.walk, mv, pose, pt, o.flash, g.weapon, false);
    }

    private void drawFx(Canvas c) {
        Game g = game;
        for (Game.Fx f : g.fxs) {
            float k = Math.min(1f, f.t / f.life);
            int a = (int) ((1f - k) * 255);
            int col = (a << 24) | (f.color & 0xFFFFFF);
            float sx = f.x - g.camX, sy = f.y - f.h;
            switch (f.kind) {
                case Game.FX_RING: {
                    float r = f.r * k;
                    Draw.RF.set(sx - r, sy - r * 0.45f, sx + r, sy + r * 0.45f);
                    Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(6 * (1f - k) + 2); Draw.P.setColor(col);
                    c.drawOval(Draw.RF, Draw.P); Draw.P.setStyle(Paint.Style.FILL);
                    break;
                }
                case Game.FX_SPARK: {
                    float r = f.r * (0.4f + k);
                    for (int i = 0; i < 6; i++) {
                        float ang = i * 1.047f + f.x;
                        Draw.line(c, col, sx + (float) Math.cos(ang) * r * 0.4f, sy + (float) Math.sin(ang) * r * 0.4f, sx + (float) Math.cos(ang) * r, sy + (float) Math.sin(ang) * r, 3);
                    }
                    break;
                }
                case Game.FX_LINE:
                    Draw.line(c, col, sx, sy, f.x2 - g.camX, f.y2 - 30, 4);
                    break;
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
        Draw.Look lk = (g.hero == 0 && g.stageIdx == 7) ? heroTorn : heroLooks[g.hero];
        float old = lk.scale; lk.scale = 1.5f;
        Draw.noShadow = true;
        Draw.person(c, 36, 140, 0, 1, lk, 0, 0, Draw.P_IDLE, 0, 0, -1, false);
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
        String[] sub = {"SOCO", "PULO", "AGARRA", "ESPECIAL"};
        int[] col = {0xFFD32F2F, 0xFF1976D2, 0xFF388E3C, 0xFFFBC02D};
        for (int i = 0; i < 4; i++) {
            float x = bx(i), y = by(i), r = (i == 0 ? 0.88f : 0.76f) * u;
            boolean glow = i == 3 && game.meter >= 50 && (((int) (game.time * 6)) & 1) == 0;
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
        try { game.setMove(0, 0); if (game.p != null) game.release(Game.BA); } catch (Exception ignored) { }
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
                    role[id] = i + 1; btnDown[i] = true; game.press(i);
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
        if (mag < dead) { game.setMove(0, 0); return; }
        float k = Math.min(1f, (mag - dead) / (1f - dead) * gain) / mag;
        game.setMove(nx * k, ny * k);
    }

    private void touchUp(int id, float x, float y) {
        if (id >= role.length) return;
        int r = role[id];
        role[id] = -1;
        if (screen == SC_PLAY) {
            if (r == 0) { joyActive = false; joyX = joyY = 0; game.setMove(0, 0); }
            else if (r >= 1 && r <= 4) { btnDown[r - 1] = false; game.release(r - 1); }
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
            case B_OPTIONS: screen = SC_OPTIONS; screenT = 0; break;
            case B_CREDITS: screen = SC_CREDITS; screenT = 0; sfx.music(2); break;
            case B_BACK:
                if (screen == SC_BRIEF) { screen = fromStageList ? SC_STAGES : SC_SELECT; }
                else if (screen == SC_SELECT && fromStageList) screen = SC_STAGES;
                else goMenu();
                screenT = 0;
                break;
            case B_NEXT:
                if (screen == SC_SELECT) { screen = SC_BRIEF; briefT = 0; screenT = 0; savePrefs(); }
                else if (screen == SC_BRIEF) { startStage(stageSel); }
                else if (screen == SC_WIN) {
                    if (stageSel + 1 < Data.STAGES.size()) { stageSel++; screen = SC_BRIEF; briefT = 0; screenT = 0; sfx.music(2); }
                    else { screen = SC_CREDITS; screenT = 0; }
                }
                break;
            case B_RESUME: screen = SC_PLAY; last = System.nanoTime(); resetTouch(); break;
            case B_RESTART: startStage(stageSel); break;
            case B_MENU: goMenu(); break;
            case B_CONTINUE:
                game.continueGame(); screen = SC_PLAY; resetTouch(); last = System.nanoTime(); sfx.music(1);
                break;
            default:
                if (id >= B_HERO && id < B_HERO + 4) { int h = id - B_HERO; if (heroUnlocked(h)) { hero = h; savePrefs(); } }
                else if (id >= B_STAGE && id < B_STAGE + 20) {
                    int s = id - B_STAGE;
                    if (s <= cleared && s < Data.STAGES.size()) { stageSel = s; fromStageList = true; screen = SC_SELECT; screenT = 0; }
                } else if (id >= B_OPT && id < B_OPT + 10) {
                    switch (id - B_OPT) {
                        case 0: sfxLv = (sfxLv + 1) % 4; sfx.sfx(Game.SFX_ITEM); break;
                        case 1: voiceLv = (voiceLv + 1) % 4; break;
                        case 2: musicLv = (musicLv + 1) % 4; break;
                        case 3: sensLv = (sensLv + 1) % 3; break;
                        case 4: gfx = (gfx + 1) % 3; Draw.q = gfx; break;
                        case 5: vibOn = 1 - vibOn; break;
                        default: break;
                    }
                    applyAudio(); savePrefs();
                    if (id - B_OPT == 1) sfx.voice("Vagabundo!");
                }
        }
    }
}
