package com.rafa.patriota;

import java.util.ArrayList;
import java.util.Random;

import com.rafa.patriota.Data.Kind;

/** Lógica do beat 'em up. Não depende de Android (pode ser testada na JVM). */
final class Game {
    static final int W = 800, H = 450, Y0 = 285, Y1 = 420;
    static final float GRAV = 900f;

    interface Listener {
        void sfx(int id);
        void voice(String line);
        /** true se existe gravação (mp3) para esta fala; sem gravação a fala não é exibida nem tocada. */
        boolean hasClip(String line);
        void vibrate(int ms);
    }

    static final int SFX_HIT = 0, SFX_HEAVY = 1, SFX_JUMP = 2, SFX_HURT = 3, SFX_SPECIAL = 4, SFX_ITEM = 5,
            SFX_BREAK = 6, SFX_ROAR = 7, SFX_WIN = 8, SFX_LOSE = 9, SFX_THROW = 10;

    // estados
    static final int S_IDLE = 0, S_ATK = 1, S_JUMP = 2, S_JKICK = 3, S_HURT = 4, S_DOWN = 5, S_GETUP = 6,
            S_GRAB = 7, S_SPECIAL = 8, S_CHARGE = 9, S_DEAD = 10, S_WIND = 11, S_HELD = 12;

    // projéteis
    static final int PJ_SYRINGE = 0, PJ_WAVE = 1, PJ_TROPHY = 2, PJ_PAPER = 3, PJ_BOOK = 4, PJ_MULTA = 5,
            PJ_NOTIF = 6, PJ_WATCH = 7;

    // especiais
    static final int SP_RIDE = 0, SP_TRUCK = 1, SP_BURST = 2, SP_SPIN = 3, SP_LANCE = 4, SP_ROAR = 5, SP_PRAY = 6;

    // botões
    static final int BA = 0, BB = 1, BC = 2, BD = 3;

    static final int LOCK0 = 200, LOCK_GAP = 700;

    // ---------------------------------------------------------------- estado público
    final Listener L;
    final Random rnd = new Random();
    Ent p;
    /** Estado individual de cada jogador (modo dupla). Os campos soltos abaixo guardam o jogador "ativo" (use(i)). */
    static final class PS {
        Ent p; int hero; float meter; boolean mounted; int weapon = -1, wUses;
        float coffeeT, penT, blurT, slowT, rootT; boolean cloroImmune;
        float jx, jy; boolean heldA, charged; float aHold; int spK; float spDur;
        float bufA, bufB, bufC, bufD, pvx, pvy; int comboStep; boolean comboQueued; float comboT;
        Ent grabbed; int grabHits; float grabT, spTick; boolean roared; float lastHurtT;
    }
    final PS[] ps = {new PS(), new PS()};
    int np = 1, curP = 0, nextNid = 0, auraIdx, local = 0;
    /** true no celular convidado: o jogo só espelha o que o anfitrião envia. */
    boolean mirror;
    float camTx;
    ArrayList<Data.Sp> sps = new ArrayList<>();
    final ArrayList<Ent> ents = new ArrayList<>();
    final ArrayList<Pop> pops = new ArrayList<>();
    final ArrayList<Fx> fxs = new ArrayList<>();

    static final class Pop {
        String s; float x, y, t, life; int color;
        Pop(String s, float x, float y, float life, int color) { this.s = s; this.x = x; this.y = y; this.life = life; this.color = color; }
    }

    static final class Fx {
        int kind; float x, y, h, t, life, r, x2, y2; int color;
        Fx(int kind, float x, float y, float h, float life, float r, int color) {
            this.kind = kind; this.x = x; this.y = y; this.h = h; this.life = life; this.r = r; this.color = color;
        }
    }

    static final int FX_RING = 0, FX_SPARK = 1, FX_LINE = 2, FX_BOOM = 3, FX_DUST = 4;

    int hero, stageIdx;
    Data.Stage stage;
    int segIdx;
    Data.Seg cur;
    boolean segActive;
    boolean[] spDone = new boolean[0];
    float segT;
    float camX, camMin, camMax;
    float shake, time;
    int score;
    float meter;
    boolean mounted;
    int weapon = -1, wUses;
    float coffeeT, penT, blurT, slowT, rootT;
    boolean cloroImmune;
    float jx, jy;
    boolean heldA;
    boolean charged;
    float aHold;
    int result;            // 0 jogando, 1 vitória, 2 derrota
    float endT;
    String radio = "";
    float radioT;
    float goT;
    Ent bossRef;
    float mountT;
    int spK;
    float spDur;
    float voiceCd;
    float lastHurtT;

    // controle interno
    private static final float BUF = 0.2f;
    private float bufA, bufB, bufC, bufD;
    private float pvx, pvy, hitStop, camLead, ambT;
    int comboStep;
    private boolean comboQueued;
    private float comboT;
    private Ent grabbed;
    private int grabHits;
    private float grabT;
    private float auraT;
    private boolean auraNow;
    private float spTick;
    private float introT;
    int combo, maxCombo;
    float comboTimer, slowT2, punch, dustT;
    private boolean roared;

    Game(Listener l) { L = l; }

    private void save(PS q) {
        q.p = p; q.hero = hero; q.meter = meter; q.mounted = mounted; q.weapon = weapon; q.wUses = wUses;
        q.coffeeT = coffeeT; q.penT = penT; q.blurT = blurT; q.slowT = slowT; q.rootT = rootT; q.cloroImmune = cloroImmune;
        q.jx = jx; q.jy = jy; q.heldA = heldA; q.charged = charged; q.aHold = aHold; q.spK = spK; q.spDur = spDur;
        q.bufA = bufA; q.bufB = bufB; q.bufC = bufC; q.bufD = bufD; q.pvx = pvx; q.pvy = pvy;
        q.comboStep = comboStep; q.comboQueued = comboQueued; q.comboT = comboT; q.grabbed = grabbed; q.grabHits = grabHits;
        q.grabT = grabT; q.spTick = spTick; q.roared = roared; q.lastHurtT = lastHurtT;
    }

    private void load(PS q) {
        p = q.p; hero = q.hero; meter = q.meter; mounted = q.mounted; weapon = q.weapon; wUses = q.wUses;
        coffeeT = q.coffeeT; penT = q.penT; blurT = q.blurT; slowT = q.slowT; rootT = q.rootT; cloroImmune = q.cloroImmune;
        jx = q.jx; jy = q.jy; heldA = q.heldA; charged = q.charged; aHold = q.aHold; spK = q.spK; spDur = q.spDur;
        bufA = q.bufA; bufB = q.bufB; bufC = q.bufC; bufD = q.bufD; pvx = q.pvx; pvy = q.pvy;
        comboStep = q.comboStep; comboQueued = q.comboQueued; comboT = q.comboT; grabbed = q.grabbed; grabHits = q.grabHits;
        grabT = q.grabT; spTick = q.spTick; roared = q.roared; lastHurtT = q.lastHurtT;
    }

    /** Prepara o jogo-espelho do celular convidado (o estado chega por Bluetooth). */
    void resetMirror() {
        mirror = true; local = 1; np = 2; curP = 1; stage = null; stageIdx = -1; result = 0;
        ents.clear(); pops.clear(); fxs.clear(); bossRef = null;
        ps[0].p = null; ps[1].p = null; camX = 0; camTx = 0; time = 0; score = 0; combo = 0; radioT = 0; goT = 0; shake = 0; punch = 0;
        p = new Ent(); p.x = 0;
    }

    /** Torna o jogador i o "ativo" (os campos p, hero, meter... passam a ser os dele). */
    void use(int i) {
        if (i == curP) return;
        save(ps[curP]); curP = i; load(ps[i]);
    }

    /** Passa a usar o jogador i sem salvar o atual (após ler um snapshot). */
    void adopt(int i) { curP = i; load(ps[i]); }

    /** Grava o jogador ativo em ps[] (para serializar). */
    void sync() { save(ps[curP]); }

    static boolean isDown(Ent q) { return q.st == S_DEAD || q.dying; }

    /** Jogador vivo mais próximo do ponto (o ativo, se só houver um). */
    private int nearest(float x, float y) {
        if (np == 1) return 0;
        int best = 0; float bd = 1e9f;
        for (int i = 0; i < np; i++) {
            Ent q = ps[i].p;
            if (isDown(q)) continue;
            float d = Math.abs(q.x - x) + Math.abs(q.y - y) * 1.6f;
            if (d < bd) { bd = d; best = i; }
        }
        return best;
    }

    private boolean allDead() {
        for (int i = 0; i < np; i++) if (ps[i].p.st != S_DEAD) return false;
        return true;
    }

    /** Entrada do jogador i (0 = anfitrião, 1 = convidado). */
    void setMove(int i, float x, float y) { use(i); jx = x; jy = y; use(0); }
    void press(int i, int b) { use(i); press(b); use(0); }
    void release(int i, int b) { use(i); release(b); use(0); }

    // ---------------------------------------------------------------- entrada
    void setMove(float x, float y) { jx = x; jy = y; }

    void press(int b) {
        // os toques ficam "na fila" por um instante, para não se perderem no meio de outra animação
        if (b == BA) { bufA = BUF; heldA = true; aHold = 0; charged = false; }
        else if (b == BB) bufB = BUF;
        else if (b == BC) bufC = BUF;
        else if (b == BD) bufD = BUF;
    }

    void release(int b) {
        if (b == BA) {
            heldA = false;
            if (charged && result == 0 && p.st == S_IDLE) startCharge();
            charged = false; aHold = 0;
        }
    }

    // ---------------------------------------------------------------- início
    void start(int stageIndex, int heroIndex) { start(stageIndex, heroIndex, -1); }

    private void initPlayer(int h, float x, float y) {
        hero = h;
        p = new Ent();
        p.type = Ent.PLAYER; p.kind = h; p.x = x; p.y = y; p.face = 1;
        p.maxHp = Data.HERO_HP[hero]; p.hp = p.maxHp; p.st = S_IDLE; p.inv = 1f;
        meter = 25; mounted = false; weapon = -1; wUses = 0;
        coffeeT = penT = blurT = slowT = rootT = 0; cloroImmune = false;
        comboStep = 0; comboT = 0; comboQueued = false; grabbed = null; grabHits = 0; grabT = 0;
        bufA = bufB = bufC = bufD = 0; pvx = pvy = 0; heldA = false; charged = false; aHold = 0;
        jx = jy = 0; spK = 0; spDur = 0; spTick = 0; roared = false;
    }

    /** Inicia a fase. heroB >= 0 liga o modo dupla (inimigos em dobro, chefes com o dobro de vida). */
    void start(int stageIndex, int heroIndex, int heroB) {
        np = heroB >= 0 ? 2 : 1; curP = 0; nextNid = 0;
        stageIdx = stageIndex; stage = Data.STAGES.get(stageIndex);
        ents.clear(); pops.clear(); fxs.clear();
        if (np == 2) {
            initPlayer(heroB, 40, 392); save(ps[1]);
        }
        initPlayer(heroIndex, 70, 330); save(ps[0]);
        score = 0; result = 0; endT = 0; radio = ""; radioT = 0; bossRef = null; mountT = 0;
        segIdx = 0; segActive = false; cur = null; camX = 0; camMin = 0; camMax = LOCK0; shake = 0; time = 0;
        hitStop = 0; camLead = 0; ambT = 5f; sps = new ArrayList<>();
        voiceCd = 0; goT = 0; auraT = 0;
        voice(stageIdx == 2 && hero == 0 ? "A maioria ali é militante." : Data.HERO_START[hero], true);
        introT = stageIdx == Data.STAGES.size() - 1 ? 1.4f : 0f;
        combo = 0; comboTimer = 0; slowT2 = 0; punch = 0; dustT = 0;
    }

    /** Continua depois do game over: reinicia o bloco atual com vida cheia. */
    void continueGame() {
        for (int i = ents.size() - 1; i >= 0; i--) {
            Ent e = ents.get(i);
            if (e.type == Ent.ENEMY || e.type == Ent.PROJ || e.type == Ent.DESK) ents.remove(i);
        }
        for (int i = 0; i < np; i++) {
            use(i);
            p.hp = p.maxHp; p.st = S_IDLE; p.t = 0; p.h = 0; p.vh = 0; p.inv = 2.5f; p.dying = false;
            blurT = slowT = rootT = 0; weapon = -1; meter = Math.max(meter, 25);
        }
        use(0);
        result = 0; endT = 0; bossRef = null;
        if (segActive) {
            camMin = camMax = lockX(segIdx);
            segT = 0; spDone = new boolean[sps.size()];
            if (cur.mount && !mounted) mountT = 2.5f;
        }
    }

    static float lockX(int i) { return LOCK0 + i * LOCK_GAP; }

    int theme() {
        int i = Math.min(segIdx, stage.segs.size() - 1);
        return stage.segs.get(i).theme;
    }

    // ---------------------------------------------------------------- loop
    void update(float dt) {
        if (dt > 0.05f) dt = 0.05f;
        if (slowT2 > 0) { slowT2 -= dt; dt *= 0.35f; }
        if (punch > 0) punch = Math.max(0f, punch - dt * 2.5f);
        if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
        time += dt;
        if (result != 0) {
            for (int i = fxs.size() - 1; i >= 0; i--) { Fx f = fxs.get(i); f.t += dt; if (f.t > f.life) fxs.remove(i); }
            return;
        }
        if (shake > 0) shake = Math.max(0, shake - dt * 30);
        if (voiceCd > 0) voiceCd -= dt;
        if (radioT > 0) radioT -= dt;
        if (goT > 0) goT -= dt;
        if (hitStop > 0) { // micro-pausa no impacto: dá peso aos golpes
            hitStop -= dt;
            for (int i = fxs.size() - 1; i >= 0; i--) { Fx f = fxs.get(i); f.t += dt; if (f.t > f.life) fxs.remove(i); }
            return;
        }
        if (introT > 0) { introT -= dt; if (introT <= 0 && L.hasClip("Se prepare!")) { L.voice("Se prepare!"); pop("\u201CSe prepare!\u201D", camX + W / 2f, 150, 1.6f, 0xFFFFE082); ambT = Math.max(ambT, 7f); } }
        updateAmbient(dt);

        for (int i = 0; i < np; i++) { use(i); updatePlayer(dt); }
        use(0);
        updateSeg(dt);
        auraNow = false;
        for (int i = 0; i < ents.size(); i++) {
            Ent e = ents.get(i);
            if (!e.alive) continue;
            switch (e.type) {
                case Ent.ENEMY: use(nearest(e.x, e.y)); updateEnemy(e, dt); break;
                case Ent.PROJ: use(e.friendly ? 0 : nearest(e.x, e.y)); updateProj(e, dt); break;
                case Ent.ITEM: use(nearest(e.x, e.y)); updateItem(e, dt); break;
                case Ent.CRATE: case Ent.DESK: if (e.flash > 0) e.flash -= dt; break;
                default: break;
            }
        }
        use(auraNow ? auraIdx : 0);
        if (auraNow) auraT += dt; else auraT = Math.max(0, auraT - dt * 2);
        if (auraT > 1.5f) {
            slowT = Math.max(slowT, 1.5f); auraT = 1.0f;
            pop("PALESTRINHA! (lento)", p.x, p.y - 90, 1.2f, 0xFFFFA000);
        }
        use(0);
        for (int i = ents.size() - 1; i >= 0; i--) if (!ents.get(i).alive) ents.remove(i);
        if (bossRef != null && !bossRef.alive) bossRef = null;

        updateCamera(dt);
        for (int i = pops.size() - 1; i >= 0; i--) { Pop q = pops.get(i); q.t += dt; q.y -= 22 * dt; if (q.t > q.life) pops.remove(i); }
        for (int i = fxs.size() - 1; i >= 0; i--) { Fx f = fxs.get(i); f.t += dt; if (f.t > f.life) fxs.remove(i); }

        if (endT > 0) {
            endT -= dt;
            if (endT <= 0) { result = 1; L.sfx(SFX_WIN); }
        }
    }

    private void updateCamera(float dt) {
        float sx = 0, sf = 0; int n = 0;
        for (int i = 0; i < np; i++) { Ent q = ps[i].p; if (isDown(q) && np > 1) continue; sx += q.x; sf += q.face; n++; }
        if (n == 0) { sx = ps[0].p.x; sf = ps[0].p.face; n = 1; }
        float mx = sx / n, mf = sf / n;
        camLead += (mf * 45 - camLead) * Math.min(1f, 2.5f * dt);
        float target = mx - 350 + camLead;
        camX += (target - camX) * Math.min(1f, 5f * dt);
        if (camX < camMin) camX = camMin;
        if (camX > camMax) camX = camMax;
        if (!segActive && camX > camMin) camMin = camX;
        if (segActive) camMin = camMax;
    }

    // ---------------------------------------------------------------- segmentos
    private void updateSeg(float dt) {
        if (stage == null) return;
        if (!segActive) {
            if (segIdx < stage.segs.size() && camX >= lockX(segIdx) - 0.6f && endT <= 0) startSeg();
            return;
        }
        if (mountT > 0) {
            mountT -= dt;
            if (mountT <= 0) {
                for (int i = 0; i < np; i++) {
                    use(i);
                    mounted = true; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5f);
                    fxs.add(new Fx(FX_RING, p.x, p.y, 0, 0.8f, 160, 0xFFFFD400));
                    pop("VELOCIRAPTOR!", p.x, p.y - 120, 1.6f, 0xFF76FF03);
                }
                use(0);
                L.sfx(SFX_ROAR); shake = 14;
            }
        }
        segT += dt;
        int alive = 0, living = 0;
        for (Ent e : ents) if (e.type == Ent.ENEMY && e.alive) { living++; if (!e.dying && !Data.KINDS[e.kind].boss) alive++; }
        boolean allSpawned = true;
        int maxAlive = np == 2 ? 7 : 4;
        for (int i = 0; i < sps.size(); i++) {
            if (spDone[i]) continue;
            allSpawned = false;
            Data.Sp sp = sps.get(i);
            if (segT >= sp.delay && mountT <= 0 && (Data.KINDS[sp.kind].boss || alive < maxAlive)) {
                spDone[i] = true;
                spawnEnemy(sp.kind, sp.side);
                alive++;
            }
        }
        if (allSpawned && living == 0 && mountT <= 0) clearSeg();
    }

    private void startSeg() {
        cur = stage.segs.get(segIdx);
        sps = new ArrayList<>();
        for (Data.Sp q : cur.sps) {
            sps.add(q);
            // dupla: o dobro de inimigos comuns (chegando um pouco depois, do lado oposto)
            if (np == 2 && !Data.KINDS[q.kind].boss) sps.add(new Data.Sp(q.kind, -q.side, q.delay + 0.7f));
            // dupla na fase final: a Xanxa, esposa do Mula, entra junto com ele
            if (np == 2 && q.kind == Data.K_MULA) sps.add(new Data.Sp(Data.K_XANXA, -1, q.delay));
        }
        segActive = true; segT = 0; spDone = new boolean[sps.size()];
        camMin = camMax = lockX(segIdx); camX = camMax;
        for (float[] c : cur.crates) spawnCrate(camX + c[0], Y0 + 10 + rnd.nextFloat() * (Y1 - Y0 - 20), (int) c[1]);
        if (cur.radio != null) { radio = cur.radio; radioT = 5f; }
        if (cur.mount && !mounted) mountT = 2.5f;
    }

    private void clearSeg() {
        segActive = false; segIdx++;
        if (segIdx >= stage.segs.size()) {
            endT = 2.2f;
            return;
        }
        camMax = lockX(segIdx);
        goT = 4f;
        // recompensa leve entre blocos; na dupla, quem caiu levanta com metade da vida
        for (int i = 0; i < np; i++) {
            use(i);
            if (isDown(p)) {
                p.hp = p.maxHp * 0.5f; p.st = S_IDLE; p.t = 0; p.h = 0; p.vh = 0; p.vx = 0; p.dying = false; p.inv = 2.5f;
                Ent o = ps[1 - i].p; p.x = o.x; p.y = o.y;
                pop("DE VOLTA!", p.x, p.y - 100, 1.3f, 0xFF76FF03);
            } else p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08f);
        }
        use(0);
    }

    // ---------------------------------------------------------------- criação
    Ent spawnEnemy(int kind, int side) {
        Kind k = Data.KINDS[kind];
        Ent e = new Ent();
        e.type = Ent.ENEMY; e.kind = kind; e.hp = e.maxHp = k.hp * (np == 2 && k.boss ? 2f : 1f);
        e.y = Y0 + 8 + rnd.nextFloat() * (Y1 - Y0 - 16);
        e.x = side > 0 ? camX + W + 40 : camX - 40;
        e.face = -side; e.st = S_IDLE; e.cd = 0.6f + rnd.nextFloat();
        e.slot = rnd.nextBoolean() ? 1 : -1;
        if (kind == Data.K_ABELIO) e.aux = side; // lado de flanco
        if (kind == Data.K_XANXA) {
            e.x = camX + 130; e.y = 320; e.face = 1; e.cd = 2.0f;
            pop("XANXA, a esposa do Mula, entrou na luta!", e.x, e.y - 160, 2.4f, 0xFFFFCC80);
        } else if (k.boss) {
            bossRef = e;
            e.x = camX + W - 100; e.y = 350; e.face = -1;
            if (kind == Data.K_BONE) {
                e.invul = true; e.aux2 = 1; e.y = 330;
                Ent d = new Ent();
                d.type = Ent.DESK; d.x = e.x - 70; d.y = 342; d.hp = d.maxHp = 110;
                ents.add(d);
            }
            if (kind == Data.K_REITOR) { e.aux = 34; }
            if (kind == Data.K_MULA) { e.cd = 1.5f; bossSay(e, "O Brasil acabou!"); }
            if (kind == Data.K_BONE) { bossSay(e, "Boa noite."); }
        }
        ents.add(e);
        return e;
    }

    private Ent spawnEnemyAt(int kind, float x, float y) {
        Ent e = spawnEnemy(kind, 1);
        e.x = x; e.y = Math.max(Y0, Math.min(Y1, y)); e.face = -1;
        return e;
    }

    private void spawnCrate(float x, float y, int item) {
        Ent c = new Ent();
        c.type = Ent.CRATE; c.x = x; c.y = y; c.hp = c.maxHp = 3; c.kind = item;
        ents.add(c);
    }

    void dropItem(float x, float y, int kind) {
        Ent it = new Ent();
        it.type = Ent.ITEM; it.kind = kind; it.x = x; it.y = y; it.h = 24; it.vh = 120; it.life = 0;
        ents.add(it);
    }

    private int randomItem() {
        float r = rnd.nextFloat();
        if (r < 0.15f) return Data.IT_PAO;
        if (r < 0.38f) return Data.IT_PASTEL;
        if (r < 0.50f) return Data.IT_CAFE;
        if (r < 0.55f) return Data.IT_PEN;
        if (r < 0.67f) return Data.IT_JBL;
        if (r < 0.78f) return Data.IT_VUVU;
        if (r < 0.90f) return Data.IT_GUARDA;
        return Data.IT_FACA;
    }

    Ent spawnProj(int kind, float x, float y, float h, float vx, float vy, float vh, float dmg, boolean friendly,
                  float life, boolean tall, boolean arc, float w) {
        Ent e = new Ent();
        e.type = Ent.PROJ; e.kind = kind; e.x = x; e.y = y; e.h = h; e.vx = vx; e.vy = vy; e.vh = vh;
        e.dmg = dmg; e.friendly = friendly; e.life = life; e.tall = tall; e.arc = arc; e.w = w;
        e.face = vx >= 0 ? 1 : -1;
        ents.add(e);
        return e;
    }

    void pop(String s, float x, float y, float life, int color) { pops.add(new Pop(s, x, y, life, color)); }

    private float bossVoiceCd;

    /** Fala de chefe: balão sobre ele + áudio (arquivo em res/raw ou voz sintetizada). */
    private void bossSay(Ent e, String s) {
        if (!L.hasClip(s)) return;
        pop("\u201C" + s + "\u201D", e.x, e.y - 160, 2.2f, 0xFFFFE082);
        if (time - bossVoiceCd > 8f || bossVoiceCd == 0) { bossVoiceCd = time; ambT = Math.max(ambT, clipLen(s) + 6f); L.voice(s); }
    }

    private static final String[] GROBO = {"Não tem credibilidade!", "Canalhas!", "Hahahaha!"};
    private static final String[] QUARENTENA = {"Jacaré!"};
    private static final String[] CONTRA_MULA = {"Para de mentir, Lula!"};
    // falas "de fundo" (alto-falante) por fase
    private static final String[] AMB_MANIF = {"Bora pra rua, gente!", "(Mula sobre a fome)", "(Mula no alto-falante)",
            "Lula!", "O maior presidente da história do Brasil!", "É Lula, é Lula!", "Agora é Lula!", "É Lula!", "Cara sem dente!"};
    private static final String[] AMB_UNIV = {"(Mula sobre a fome)", "Lula!", "O maior presidente da história do Brasil!", "É Lula, é Lula!", "Agora é Lula!", "É Lula!"};
    private static final String[] AMB_FINAL = {"(Mula no alto-falante)", "O Brasil acabou!", "Cara sem dente!", "Por favor, me ajuda!"};

    /** Duração aproximada de cada gravação (s), para não cortar uma fala com a seguinte. */
    private static float clipLen(String s) {
        switch (s) {
            case "A maioria ali é militante.": return 7.8f;
            case "Hahahaha!": return 6.0f;
            case "Para de mentir, Lula!": return 4.6f;
            case "São uns idiotas úteis!": return 5.5f;
            case "Canalhas!": return 4.3f;
            case "Não tem credibilidade!": case "São vagabundos!": return 2.9f;
            case "(Mula no alto-falante)": return 6.4f;
            case "O Brasil acabou!": return 4.3f;
            case "(Mula sobre a fome)": return 3.4f;
            case "Bora pra rua, gente!": return 1.8f;
            case "Boa noite.": return 1.8f;
            case "Um forte abraço!": return 8.3f;
            case "Cara sem dente!": return 6.2f;
            case "Por favor, me ajuda!": return 5.2f;
            case "Se prepare!": return 1.3f;
            case "O maior presidente da história do Brasil!": return 2.5f;
            case "Lula!": return 2.3f;
            default: return 1.4f;
        }
    }

    private void updateAmbient(float dt) {
        ambT -= dt;
        if (ambT > 0 || p.st == S_DEAD) return;
        String[] pool = stageIdx == 0 ? AMB_MANIF : stageIdx == 2 ? AMB_UNIV : stageIdx == Data.STAGES.size() - 1 ? AMB_FINAL : null;
        if (pool == null) { ambT = 30f; return; }
        String s = pool[rnd.nextInt(pool.length)];
        if (!L.hasClip(s)) { ambT = 5f; return; }
        L.voice(s);
        pop("\uD83D\uDD0A " + s, camX + W / 2f, 150, Math.min(4f, clipLen(s)), 0xFFFFE082);
        ambT = clipLen(s) + 7f + rnd.nextFloat() * 7f;
        bossVoiceCd = time;
    }
    private static final String[] UNIVERSIDADE = {"São vagabundos!", "São uns idiotas úteis!"};
    private static final String[] BRIGA = {"Filho da puta!", "Vagabundo!", "Escrota!", "Fudido!", "Vai pra puta que o pariu, porra!"};

    /** Provocação do Jair no meio da briga (gravações reais, se existirem em res/raw). */
    private void brawlVoice() {
        if (hero != 0 || voiceCd > 0) return;
        String[] pool = BRIGA;
        // falas específicas por fase: estúdios da Grobo (4.1 a 4.4) e universidade (fase 3)
        if (bossRef != null && bossRef.kind == Data.K_MULA && rnd.nextFloat() < 0.6f) pool = CONTRA_MULA;
        else if (stageIdx == 1 && rnd.nextFloat() < 0.5f) pool = QUARENTENA;
        else if (stageIdx >= 3 && stageIdx <= 6 && rnd.nextFloat() < 0.7f) pool = GROBO;
        else if (stageIdx == 2 && rnd.nextFloat() < 0.7f) pool = UNIVERSIDADE;
        voice(pool[rnd.nextInt(pool.length)], false);
    }

    private void voice(String s, boolean force) {
        if (!L.hasClip(s)) return;
        pop(s, p.x, p.y - 110, 1.8f, 0xFFFFFFFF);
        if (force || voiceCd <= 0) { L.voice(s); voiceCd = clipLen(s) + 2f; }
    }

    // ---------------------------------------------------------------- jogador
    private float atkSpeed() { return coffeeT > 0 ? 1.5f : 1f; }

    private float dmgMul() { return Data.HERO_DMG[hero] * (mounted ? 1.3f : 1f); }

    private void updatePlayer(float dt) {
        final Ent o = p;
        o.t += dt;
        if (o.inv > 0) o.inv -= dt;
        if (o.flash > 0) o.flash -= dt;
        if (coffeeT > 0) coffeeT -= dt;
        if (penT > 0) penT -= dt;
        if (blurT > 0) blurT -= dt;
        if (slowT > 0) slowT -= dt;
        if (rootT > 0) rootT -= dt;
        if (comboT > 0) comboT -= dt;
        if (heldA) { aHold += dt; if (aHold >= 1f && !charged && o.st != S_SPECIAL) { charged = true; pop("CARREGADO!", o.x, o.y - 100, 0.8f, 0xFFFFD400); } }

        final boolean pA = bufA > 0, pB = bufB > 0, pC = bufC > 0, pD = bufD > 0;
        bufA -= dt; bufB -= dt; bufC -= dt; bufD -= dt;

        if (o.st == S_IDLE && (Math.abs(pvx) > 90 || Math.abs(pvy) > 60)) {
            dustT -= dt;
            if (dustT <= 0) { dustT = 0.11f; fxs.add(new Fx(FX_DUST, o.x - o.face * 8, o.y, 4, 0.45f, 12, 0xFFD7CCC8)); }
        }
        float spd = Data.HERO_SPD[hero] * (mounted ? 1.3f : 1f) * (slowT > 0 ? 0.5f : 1f) * (coffeeT > 0 ? 1.1f : 1f);
        float ad = dt * atkSpeed();

        switch (o.st) {
            case S_IDLE: {
                float tvx = rootT <= 0 ? jx * 168 * spd : 0, tvy = rootT <= 0 ? jy * 104 * spd : 0;
                float kk = Math.min(1f, 18f * dt); // aceleração suave
                pvx += (tvx - pvx) * kk; pvy += (tvy - pvy) * kk;
                o.x += pvx * dt; o.y += pvy * dt;
                o.walk += (Math.abs(pvx) + Math.abs(pvy)) * dt;
                if (Math.abs(jx) > 0.2f) o.face = jx > 0 ? 1 : -1;
                if (pB) { bufB = 0; o.st = S_JUMP; o.vh = mounted ? 380 : 340; o.t = 0; L.sfx(SFX_JUMP); }
                else if (pD) { bufD = 0; startSpecial(); }
                else if (pC) { bufC = 0; pressC(); }
                else if (pA) { bufA = 0; pressA(); }
                break;
            }
            case S_JUMP: {
                o.x += jx * 110 * spd * dt; o.y += jy * 40 * dt;
                if (Math.abs(jx) > 0.2f) o.face = jx > 0 ? 1 : -1;
                o.vh -= GRAV * dt; o.h += o.vh * dt;
                if (pA) { bufA = 0; o.st = S_JKICK; o.t = 0; o.hit.clear(); spTick = 0; L.sfx(SFX_THROW); }
                if (o.h <= 0) { o.h = 0; o.vh = 0; o.st = S_IDLE; o.t = 0; for (int i = 0; i < 3; i++) fxs.add(new Fx(FX_DUST, o.x + (i - 1) * 14, o.y, 4, 0.5f, 16, 0xFFD7CCC8)); }
                break;
            }
            case S_JKICK: {
                o.x += o.face * 170 * dt + jx * 40 * dt;
                o.vh -= GRAV * dt * 0.8f; o.h += o.vh * dt;
                spTick += dt;
                if (mounted) {
                    if (spTick > 0.16f) { spTick = 0; o.hit.clear(); }
                    for (Ent t : targets(o.x - 95, o.x + 95, 38, 80)) if (!o.hit.contains(t)) { o.hit.add(t); landHit(t, 9 * dmgMul(), 1, o.x < t.x ? 1 : -1, true); }
                } else {
                    for (Ent t : targets(o.x - 8, o.x + o.face * 62, 30, 70)) if (!o.hit.contains(t)) { o.hit.add(t); landHit(t, 8 * dmgMul(), 1, o.face, true); }
                }
                if (o.h <= 0) { o.h = 0; o.vh = 0; o.st = S_IDLE; o.t = 0; }
                break;
            }
            case S_ATK: {
                o.t += ad - dt;
                int n = mounted ? 3 : 4;
                float dur = attackDur();
                float act = dur * 0.35f;
                if (o.t < act) o.x += o.face * 70 * dt;
                if (!o.did && o.t >= act) { o.did = true; doAttackHit(); }
                if (pA && o.t >= dur * 0.3f) { comboQueued = true; bufA = 0; }
                // cancelamentos: depois do golpe conectar dá para emendar pulo ou especial
                if (o.did && o.t >= act + 0.04f && weapon < 0) {
                    if (pB) { bufB = 0; pvx = o.face * 60; o.st = S_JUMP; o.vh = mounted ? 380 : 340; o.t = 0; comboStep = 0; L.sfx(SFX_JUMP); break; }
                    if (pD && meter >= 50) { bufD = 0; comboStep = 0; startSpecial(); break; }
                }
                if (o.t >= dur) {
                    if (comboQueued && weapon < 0 && !(hero == 2 && !mounted) && comboStep < n) startAttack(true);
                    else { o.st = S_IDLE; o.t = 0; comboT = comboStep >= n ? 0 : 0.4f; if (comboStep >= n) comboStep = 0; }
                }
                break;
            }
            case S_CHARGE: {
                if (o.t > 0.25f && !o.did) {
                    o.did = true; shake = 10; L.sfx(SFX_HEAVY);
                    fxs.add(new Fx(FX_RING, o.x, o.y, 0, 0.6f, 140, 0xFFFFD400));
                    for (Ent t : targets(o.x - 140, o.x + 140, 70, 90)) {
                        if (t.type == Ent.ENEMY) {
                            Kind k = Data.KINDS[t.kind];
                            landHit(t, 5 * dmgMul(), 0, t.x >= o.x ? 1 : -1, true);
                            if (t.alive && !t.dying && t.type == Ent.ENEMY && !k.boss) { t.st = S_HURT; t.t = 0; t.stunT = 2.0f; }
                        } else landHit(t, 5, 0, 1, true);
                    }
                }
                if (o.t > 0.6f) { o.st = S_IDLE; o.t = 0; }
                break;
            }
            case S_GRAB: {
                updateGrab(dt, pA);
                if (pA) bufA = 0;
                break;
            }
            case S_SPECIAL: {
                updateSpecial(dt);
                break;
            }
            case S_HURT: {
                if (o.t > 0.3f) { o.st = S_IDLE; o.t = 0; }
                o.x += o.vx * dt; o.vx *= 0.9f;
                break;
            }
            case S_DOWN: {
                if (o.h > 0 || o.vh > 0) {
                    o.x += o.vx * dt; o.vh -= GRAV * dt; o.h += o.vh * dt;
                    if (o.h <= 0) {
                        o.h = 0; o.vh = 0; o.vx = 0; o.aux = 0;
                        if (o.dying) { o.st = S_DEAD; o.t = 0; }
                    }
                } else {
                    o.aux += dt;
                    if (o.aux > 0.6f) { o.st = S_GETUP; o.t = 0; }
                }
                break;
            }
            case S_GETUP: {
                if (o.t > 0.3f) { o.st = S_IDLE; o.t = 0; }
                break;
            }
            case S_DEAD: {
                if (o.t > 1.4f && result == 0 && allDead()) { result = 2; L.sfx(SFX_LOSE); }
                break;
            }
            default: break;
        }
        if (!(o.st == S_SPECIAL && (spK == SP_RIDE || spK == SP_TRUCK))) {
            o.x = Math.max(camX + 18, Math.min(camX + W - 18, o.x));
        }
        o.y = Math.max(Y0, Math.min(Y1, o.y));
    }

    /** Progresso 0..1 do ataque atual do jogador (para animação). */
    float atkProg() { return Math.max(0f, Math.min(1f, p.t / attackDur())); }

    private void pressA() {
        if (weapon >= 0) { useWeapon(); return; }
        if (hero == 2 && !mounted) { shootNotif(); return; }
        startAttack(false);
    }

    private void shootNotif() {
        Ent o = p;
        o.st = S_ATK; o.t = 0; o.did = true; comboStep = 1; comboQueued = false;
        spawnProj(PJ_NOTIF, o.x + o.face * 30, o.y, 42, o.face * 360, 0, 0, 5 * dmgMul(), true, 1.6f, false, false, 12);
        L.sfx(SFX_THROW);
    }

    private float attackDur() {
        if (weapon >= 0) return weapon == Data.IT_VUVU ? 0.5f : weapon == Data.IT_JBL ? 0.6f : 0.3f;
        if (hero == 2) return 0.28f;
        if (mounted) return comboStep == 3 ? 0.5f : 0.32f;
        return comboStep == 4 ? 0.42f : comboStep == 3 ? 0.3f : 0.22f;
    }

    private void startAttack(boolean chain) {
        Ent o = p;
        int n = mounted ? 3 : 4;
        if (!chain && comboT <= 0) comboStep = 0;
        comboStep++;
        if (comboStep > n) comboStep = 1;
        o.st = S_ATK; o.t = 0; o.did = false; comboQueued = false;
    }

    private void doAttackHit() {
        Ent o = p;
        if (weapon >= 0) { weaponHit(); return; }
        if (hero == 2 && !mounted) return;
        float[] dm = mounted ? new float[]{10, 10, 18} : new float[]{6, 6, 9, 14};
        float dmg = dm[Math.min(comboStep, dm.length) - 1] * dmgMul();
        boolean finisher = comboStep == dm.length;
        ArrayList<Ent> ts;
        if (mounted && !finisher) ts = targets(o.x - 95, o.x + 95, 36, 80);
        else if (mounted) ts = targets(o.x, o.x + o.face * 140, 30, 80);
        else ts = targets(o.x - 6, o.x + o.face * 62, 28, 60);
        int hits = 0;
        for (Ent t : ts) {
            int dir = mounted && !finisher ? (t.x >= o.x ? 1 : -1) : o.face;
            if (landHit(t, dmg, finisher ? 1 : 0, dir, false)) hits++;
            if (mounted && finisher && t.alive && t.type == Ent.ENEMY) t.vy = -140;
        }
        L.sfx(finisher ? SFX_HEAVY : SFX_HIT);
        if (finisher && hits > 0) { shake = 6; voice(Data.HERO_FINISH[hero], false); }
    }

    private void useWeapon() {
        Ent o = p;
        o.st = S_ATK; o.t = 0; o.did = false; comboQueued = false; comboStep = 1;
        // usos descontados no golpe
    }

    private void weaponHit() {
        Ent o = p;
        int w = weapon;
        wUses--;
        int hits = 0;
        switch (w) {
            case Data.IT_FACA:
                for (Ent t : targets(o.x - 6, o.x + o.face * 58, 28, 60)) if (landHit(t, 14 * dmgMul(), 0, o.face, false)) hits++;
                L.sfx(SFX_HIT);
                break;
            case Data.IT_GUARDA:
                for (Ent t : targets(o.x - 10, o.x + o.face * 88, 34, 60)) if (landHit(t, 10 * dmgMul(), 0, o.face, false)) hits++;
                L.sfx(SFX_HEAVY);
                break;
            case Data.IT_VUVU:
                fxs.add(new Fx(FX_RING, o.x + o.face * 60, o.y, 30, 0.5f, 80, 0xFFFFEB3B));
                for (Ent t : targets(o.x, o.x + o.face * 170, 46, 90)) {
                    if (t.type == Ent.ENEMY && !Data.KINDS[t.kind].boss) { landHit(t, 3, 0, o.face, true); if (t.alive && !t.dying) { t.st = S_HURT; t.t = 0; t.stunT = 2.2f; } }
                    else landHit(t, 3, 0, o.face, true);
                }
                L.sfx(SFX_ROAR);
                break;
            case Data.IT_JBL:
                fxs.add(new Fx(FX_RING, o.x, o.y, 20, 0.7f, 230, 0xFF43A047));
                pop("HINO NACIONAL!", o.x, o.y - 100, 1.4f, 0xFFFFEB3B);
                for (Ent t : targets(o.x - 230, o.x + 230, 80, 100)) {
                    int dir = t.x >= o.x ? 1 : -1;
                    landHit(t, 4, 0, dir, true);
                    if (t.type == Ent.ENEMY && t.alive && !t.dying && !Data.KINDS[t.kind].boss) { t.st = S_HURT; t.t = 0; t.stunT = 1.6f; t.vx = dir * 260; }
                }
                L.sfx(SFX_SPECIAL);
                break;
            default: break;
        }
        if (wUses <= 0) { pop("Quebrou!", o.x, o.y - 80, 1f, 0xFFFFFFFF); weapon = -1; }
    }

    private void pressC() {
        Ent o = p;
        if (mounted) { startSpecialKind(SP_LANCE); return; }
        // pegar item (arma)
        Ent best = null; float bd = 40;
        for (Ent e : ents) if (e.type == Ent.ITEM && e.alive && e.kind >= Data.IT_JBL && Math.abs(e.y - o.y) < 28) {
            float d = Math.abs(e.x - o.x);
            if (d < bd) { bd = d; best = e; }
        }
        if (best != null) {
            weapon = best.kind; wUses = Data.WEAPON_USES[weapon]; best.alive = false; L.sfx(SFX_ITEM);
            pop(Data.ITEM_NAME[weapon] + "!", o.x, o.y - 100, 1.2f, 0xFFFFFFFF);
            return;
        }
        // agarrar inimigo
        Ent g = null; bd = 58;
        for (Ent e : ents) if (e.type == Ent.ENEMY && e.alive && !e.dying && !Data.KINDS[e.kind].boss
                && e.st != S_DOWN && e.st != S_DEAD && e.st != S_HELD && e.st != S_GETUP && e.h < 20
                && Math.abs(e.y - o.y) < 26) {
            float d = Math.abs(e.x - o.x);
            if (d < bd) { bd = d; g = e; }
        }
        if (g != null) {
            grabbed = g; grabHits = 0; grabT = 3f;
            g.st = S_HELD; g.holder = o; g.t = 0; g.guardUp = false;
            o.st = S_GRAB; o.t = 0; o.face = g.x >= o.x ? 1 : -1;
            L.sfx(SFX_HIT);
        }
    }

    private void releaseGrab(boolean knock) {
        if (grabbed != null) {
            Ent e = grabbed;
            if (e.alive && e.st == S_HELD) {
                e.holder = null;
                if (knock) launch(e, p.face, 1); else { e.st = S_HURT; e.t = 0; e.stunT = 0.3f; }
            }
        }
        grabbed = null;
        if (p.st == S_GRAB) { p.st = S_IDLE; p.t = 0; }
    }

    private void updateGrab(float dt, boolean pA) {
        Ent o = p, g = grabbed;
        if (g == null || !g.alive || g.st != S_HELD) { grabbed = null; o.st = S_IDLE; o.t = 0; return; }
        g.x = o.x + o.face * 30; g.y = o.y; g.h = 0; g.face = -o.face;
        grabT -= dt;
        if (Math.abs(jx) > 0.2f && o.t > 0.15f && pA) {
            // arremesso
            int dir = jx > 0 ? 1 : -1;
            o.face = dir;
            g.holder = null; g.st = S_DOWN; g.thrown = true; g.hit.clear(); g.t = 0;
            g.vx = dir * 380; g.vh = 200; g.h = 0.5f; g.aux = 0;
            damageSimple(g, 8 * dmgMul());
            grabbed = null; o.st = S_IDLE; o.t = 0;
            L.sfx(SFX_HEAVY); shake = 4;
            return;
        }
        if (pA) {
            damageSimple(g, 6 * dmgMul());
            grabHits++; L.sfx(SFX_HIT); meter = Math.min(100, meter + 3);
            fxs.add(new Fx(FX_SPARK, g.x, g.y, 30, 0.25f, 14, 0xFFFFFFFF));
            if (g.alive && !g.dying && grabHits >= 3) { releaseGrab(true); }
            return;
        }
        if (grabT <= 0 || (g.dying)) releaseGrab(false);
    }

    private void damageSimple(Ent e, float dmg) {
        e.hp -= dmg; e.flash = 0.15f;
        if (e.hp <= 0 && !e.dying) killEnemy(e, p.face);
    }

    private void startCharge() {
        Ent o = p;
        if (o.st != S_IDLE || mounted) return;
        o.st = S_CHARGE; o.t = 0; o.did = false;
    }

    // ---------------------------------------------------------------- especiais
    private void startSpecial() {
        if (meter < 50) { pop("Patriotismo baixo!", p.x, p.y - 100, 1f, 0xFFFFA000); return; }
        startSpecialKind(mounted ? SP_ROAR : Data.HERO_SPEC[hero]);
    }

    private void startSpecialKind(int sp) {
        Ent o = p;
        if (sp == SP_LANCE) {
            o.st = S_SPECIAL; o.t = 0; spK = SP_LANCE; spDur = 0.9f; o.hit.clear();
            o.vx = o.face * 520; o.inv = Math.max(o.inv, 1f);
            L.sfx(SFX_THROW);
            return;
        }
        meter -= 50;
        o.st = S_SPECIAL; o.t = 0; spK = sp; o.hit.clear(); spTick = 0; roared = false;
        o.inv = 99f; o.h = 0; o.vh = 0;
        L.sfx(SFX_SPECIAL); punch = 1f;
        switch (sp) {
            case SP_RIDE:
                spDur = 1.05f; o.x = o.face > 0 ? camX - 50 : camX + W + 50; o.vx = o.face * 900; break;
            case SP_TRUCK:
                spDur = 1.45f; o.x = o.face > 0 ? camX - 80 : camX + W + 80; o.vx = o.face * 640; break;
            case SP_BURST:
                spDur = 0.6f;
                for (int i = 0; i < 10; i++) {
                    float ang = (float) (i * Math.PI * 2 / 10);
                    spawnProj(PJ_NOTIF, o.x, o.y, 40, (float) Math.cos(ang) * 340, (float) Math.sin(ang) * 150, 0, 8 * dmgMul(), true, 1.4f, false, false, 12);
                }
                break;
            case SP_SPIN:
                spDur = 1.2f; break;
            case SP_ROAR:
                spDur = 1.1f; break;
            case SP_PRAY:
                spDur = 1.0f; break;
            default: spDur = 0.8f; break;
        }
        voice(mounted ? "Acabou, porra!" : Data.HERO_SPECIAL[hero], true);
    }

    private void updateSpecial(float dt) {
        Ent o = p;
        switch (spK) {
            case SP_RIDE: case SP_TRUCK: {
                o.x += o.vx * dt;
                shake = 3;
                for (Ent t : targets(o.x - 55, o.x + 55, 62, 120)) {
                    if (o.hit.contains(t)) continue;
                    o.hit.add(t);
                    landHit(t, (spK == SP_TRUCK ? 45 : 35) * Data.HERO_DMG[hero] / (spK == SP_TRUCK ? 1.5f : 1f), 2, o.face, true);
                }
                if (o.t >= spDur) {
                    o.x = Math.max(camX + 40, Math.min(camX + W - 40, o.x)); endSpecial();
                }
                break;
            }
            case SP_SPIN: {
                spTick += dt;
                if (spTick > 0.2f) {
                    spTick = 0; o.hit.clear();
                    fxs.add(new Fx(FX_RING, o.x, o.y, 20, 0.3f, 100, 0xFF9AE600));
                    L.sfx(SFX_HEAVY);
                }
                o.x += jx * 90 * dt;
                for (Ent t : targets(o.x - 100, o.x + 100, 50, 90)) if (!o.hit.contains(t)) { o.hit.add(t); landHit(t, 10 * dmgMul(), 1, t.x >= o.x ? 1 : -1, true); }
                if (o.t >= spDur) endSpecial();
                break;
            }
            case SP_PRAY: {
                if (!roared && o.t >= 0.3f) {
                    roared = true; shake = 8; L.sfx(SFX_ROAR);
                    fxs.add(new Fx(FX_RING, o.x, o.y, 0, 0.7f, 170, 0xFFFFFFFF));
                    fxs.add(new Fx(FX_RING, o.x, o.y, 0, 0.9f, 110, 0xFFFFE082));
                    for (int i = 0; i < np; i++) {
                        Ent q = ps[i].p;
                        if (isDown(q)) continue;
                        q.hp = Math.min(q.maxHp, q.hp + q.maxHp * 0.35f);
                        pop("+35% VIDA", q.x, q.y - 100, 1.2f, 0xFFFFFFFF);
                    }
                    for (Ent t : targets(o.x - 170, o.x + 170, 80, 90)) {
                        if (t.type == Ent.ENEMY) {
                            landHit(t, 6 * dmgMul(), 1, t.x >= o.x ? 1 : -1, true);
                            if (t.alive && !t.dying && !Data.KINDS[t.kind].boss) { t.st = S_HURT; t.t = 0; t.stunT = 1.6f; }
                        }
                    }
                }
                if (o.t >= spDur) endSpecial();
                break;
            }
            case SP_BURST: {
                if (o.t >= spDur) endSpecial();
                break;
            }
            case SP_LANCE: {
                o.x += o.vx * dt;
                for (Ent t : targets(o.x, o.x + o.face * 100, 36, 80)) {
                    if (!o.hit.contains(t)) { o.hit.add(t); landHit(t, 14 * dmgMul(), 0, o.face, true); }
                }
                for (Ent t : o.hit) if (t.type == Ent.ENEMY && t.alive && !t.dying && !Data.KINDS[t.kind].boss) {
                    t.x = o.x + o.face * 60; t.y += (o.y - t.y) * 0.3f; t.st = S_HURT; t.t = 0; t.stunT = 0.25f;
                }
                if (o.t >= spDur) {
                    for (Ent t : o.hit) if (t.type == Ent.ENEMY && t.alive && !t.dying && !Data.KINDS[t.kind].boss) launch(t, o.face, 2);
                    o.inv = 0.4f; o.vx = 0; o.st = S_IDLE; o.t = 0;
                }
                break;
            }
            case SP_ROAR: {
                if (!roared && o.t >= 0.3f) {
                    roared = true; shake = 16; L.sfx(SFX_ROAR);
                    fxs.add(new Fx(FX_RING, o.x, o.y, 40, 0.8f, 420, 0xFFFFD400));
                    fxs.add(new Fx(FX_RING, o.x, o.y, 40, 1.0f, 300, 0xFFFF5722));
                    for (Ent t : new ArrayList<>(ents)) {
                        if (!t.alive) continue;
                        if (t.type == Ent.ENEMY && t.st != S_DEAD && !t.dying) {
                            landHit(t, 30 * dmgMul(), 0, t.x >= o.x ? 1 : -1, true);
                            if (t.alive && !t.dying) {
                                t.stunT = Data.KINDS[t.kind].boss ? 1.4f : 2.5f;
                                if (t.st != S_DOWN) { t.st = S_HURT; t.t = 0; }
                            }
                        } else if (t.type == Ent.PROJ && !t.friendly) t.alive = false;
                    }
                }
                if (o.t >= spDur) endSpecial();
                break;
            }
            default: endSpecial();
        }
    }

    private void endSpecial() {
        Ent o = p;
        o.inv = 0.5f; o.vx = 0; o.st = S_IDLE; o.t = 0;
    }

    // ---------------------------------------------------------------- combate
    /** Alvos amigos (inimigos, caixas, bancada) dentro da caixa x0..x1, |dy|<dy, |dh|<dh. */
    private ArrayList<Ent> targets(float x0, float x1, float dy, float dh) {
        ArrayList<Ent> r = new ArrayList<>();
        float lo = Math.min(x0, x1), hi = Math.max(x0, x1);
        for (Ent e : ents) {
            if (!e.alive) continue;
            if (e.type == Ent.ENEMY) {
                if (e.dying || e.st == S_DOWN || e.st == S_DEAD || e.st == S_HELD || e.st == S_GETUP) continue;
            } else if (e.type != Ent.CRATE && e.type != Ent.DESK) continue;
            float pad = 14 * (e.type == Ent.ENEMY ? Data.KINDS[e.kind].scale : 1.3f);
            if (e.x < lo - pad || e.x > hi + pad) continue;
            if (Math.abs(e.y - p.y) > dy) continue;
            if (Math.abs(e.h - p.h) > dh) continue;
            r.add(e);
        }
        return r;
    }

    /** Golpe do jogador sobre um alvo. knock: 0 leve, 1 derruba, 2 derruba longe. */
    private boolean landHit(Ent t, float dmg, int knock, int dir, boolean breaks) {
        if (t.type == Ent.CRATE) {
            t.hp -= 1; t.flash = 0.15f; L.sfx(SFX_HIT);
            fxs.add(new Fx(FX_SPARK, t.x, t.y, 20, 0.25f, 12, 0xFFFFD27F));
            if (t.hp <= 0) {
                t.alive = false; L.sfx(SFX_BREAK);
                fxs.add(new Fx(FX_BOOM, t.x, t.y, 20, 0.4f, 30, 0xFFC68B3E));
                dropItem(t.x, t.y, t.kind >= 0 ? t.kind : randomItem());
            }
            return true;
        }
        if (t.type == Ent.DESK) {
            if (t.hp <= 0) return false;
            t.hp -= dmg; t.flash = 0.15f; L.sfx(SFX_HEAVY);
            fxs.add(new Fx(FX_SPARK, t.x, t.y, 30, 0.25f, 16, 0xFFFFFFFF));
            if (t.hp <= 0) destroyDesk(t);
            return true;
        }
        Kind k = Data.KINDS[t.kind];
        if (t.invul) { fxs.add(new Fx(FX_SPARK, t.x, t.y, 40, 0.2f, 10, 0xFF90CAF9)); return false; }
        if (t.guardUp && !breaks && t.face == -dir) {
            dmg *= 0.15f; knock = 0;
            pop("BLOQUEOU!", t.x, t.y - 80, 0.6f, 0xFFB0BEC5);
            fxs.add(new Fx(FX_SPARK, t.x, t.y, 40, 0.2f, 12, 0xFFB0BEC5));
            L.sfx(SFX_HIT);
            t.hp -= dmg; t.flash = 0.1f;
            return true;
        }
        if (t.shield > 0) {
            t.shield -= dmg; t.flash = 0.1f; L.sfx(SFX_HIT);
            fxs.add(new Fx(FX_SPARK, t.x, t.y, 50, 0.2f, 14, 0xFF80DEEA));
            if (t.shield <= 0) { t.shield = 0; pop("BARREIRA QUEBRADA!", t.x, t.y - 110, 1f, 0xFF80DEEA); shake = 6; }
            return true;
        }
        if (t.st == S_WIND && !k.boss) {
            meter = Math.min(100, meter + (t.kind == Data.K_ABELIO ? 18 : 10));
            pop("CONTRA-ATAQUE!", t.x, t.y - 90, 0.8f, 0xFFFFD400);
        }
        if (t.kind == Data.K_MULA && t.st == S_WIND && t.atk == 0) {
            t.st = S_HURT; t.t = 0; t.stunT = 1.4f; t.cd = 2.5f; t.atk = -1;
            pop("INTERROMPIDO!", t.x, t.y - 120, 1.2f, 0xFFFFD400);
        }
        t.hp -= dmg; t.flash = 0.15f;
        meter = Math.min(100, meter + 4);
        combo++; comboTimer = 1.8f; if (combo > maxCombo) maxCombo = combo;
        score += 10 * Math.max(1, 1 + combo / 10);
        if (combo > 0 && combo % 10 == 0) { meter = Math.min(100, meter + 10); pop("COMBO x" + combo + "!", t.x, t.y - 130, 1.1f, 0xFFFFD400); punch = 0.5f; }
        if (rnd.nextFloat() < 0.12f) brawlVoice();
        fxs.add(new Fx(FX_SPARK, t.x, t.y, 40 + t.h, 0.25f, 16, 0xFFFFFFFF));
        L.vibrate(10);
        if (p.st != S_SPECIAL) hitStop = Math.max(hitStop, knock > 0 ? 0.075f : 0.035f);
        if (t.hp <= 0) { killEnemy(t, dir); return true; }
        if (k.boss) {
            t.poise += dmg;
            if (t.poise >= 45 && t.st != S_DOWN && t.kind != Data.K_BONE) {
                t.poise = 0; t.st = S_HURT; t.t = 0; t.stunT = 0.6f; t.vx = dir * 40;
            } else if (t.poise >= 45) t.poise = 0;
            if (knock >= 2 && t.st != S_DOWN) { t.st = S_HURT; t.t = 0; t.stunT = 0.8f; }
        } else if (knock > 0) {
            launch(t, dir, knock);
        } else {
            t.st = S_HURT; t.t = 0; t.stunT = 0.32f; t.vx = dir * 80;
        }
        return true;
    }

    private void launch(Ent t, int dir, int level) {
        t.st = S_DOWN; t.t = 0; t.aux = 0; t.holder = null;
        t.vh = level == 1 ? 170 : 250; t.vx = dir * (level == 1 ? 170 : 330); t.h = Math.max(t.h, 0.5f);
        t.guardUp = false;
    }

    private void killEnemy(Ent t, int dir) {
        Kind k = Data.KINDS[t.kind];
        t.dying = true; t.hp = 0; t.guardUp = false; t.holder = null;
        t.st = S_DOWN; t.t = 0; t.vh = 220; t.vx = dir * 220; t.h = Math.max(t.h, 0.5f); t.aux = 0;
        score += k.score;
        L.sfx(SFX_HEAVY);
        if (!k.boss && rnd.nextFloat() < 0.3f) brawlVoice();
        if (grabbed == t) grabbed = null;
        if (k.boss) {
            shake = 12; slowT2 = 0.9f; punch = 1f;
            voice("Isso aqui é uma maravilha, pô!", true);
            for (Ent e : ents) if (e.type == Ent.PROJ && !e.friendly) e.alive = false;
            for (Ent e : ents) if (e.type == Ent.DESK) e.alive = false;
        }
        if (t.kind == Data.K_ABELIO && rnd.nextFloat() < 0.5f) dropItem(t.x, t.y, Data.IT_FACA);
        else if (!k.boss && rnd.nextFloat() < 0.07f) dropItem(t.x, t.y, Data.IT_PASTEL);
    }

    private void destroyDesk(Ent d) {
        d.alive = false; shake = 12; L.sfx(SFX_BREAK);
        fxs.add(new Fx(FX_BOOM, d.x, d.y, 40, 0.6f, 70, 0xFFB0BEC5));
        pop("BANCADA DESTRUÍDA!", d.x, d.y - 100, 1.6f, 0xFFFFD400);
        for (Ent e : ents) if (e.type == Ent.ENEMY && e.kind == Data.K_BONE) {
            e.invul = false; e.aux2 = 0; e.st = S_HURT; e.t = 0; e.stunT = 0.9f;
        }
    }

    /** Dano ao jogador. knock: 0 leve, 1 derruba. Retorna true se acertou. */
    private boolean hurtPlayer(float dmg, int fromDir, int knock) {
        Ent o = p;
        if (o.inv > 0 || penT > 0 || o.st == S_DEAD || o.st == S_SPECIAL || o.st == S_DOWN || o.st == S_GETUP) return false;
        if (mounted) dmg *= 0.75f;
        o.hp -= dmg; o.flash = 0.2f; lastHurtT = time;
        shake = Math.max(shake, 5);
        L.sfx(SFX_HURT); L.vibrate(25);
        fxs.add(new Fx(FX_SPARK, o.x, o.y, 50, 0.25f, 16, 0xFFFF5252));
        if (grabbed != null) { releaseGrab(false); }
        charged = false; comboStep = 0; comboQueued = false;
        if (o.hp <= 0) {
            o.hp = 0; o.dying = true;
            o.st = S_DOWN; o.t = 0; o.vh = 220; o.vx = -fromDir * 200; o.h = 0.5f; o.aux = 0;
            return true;
        }
        if (knock > 0) {
            o.st = S_DOWN; o.t = 0; o.vh = 170; o.vx = -fromDir * 150; o.h = 0.5f; o.aux = 0; o.inv = 1.4f;
        } else {
            o.st = S_HURT; o.t = 0; o.vx = -fromDir * 60; o.inv = 0.4f;
        }
        return true;
    }

    // ---------------------------------------------------------------- itens
    private void updateItem(Ent e, float dt) {
        if (e.vh > 0 || e.h > 0) { e.vh -= GRAV * dt; e.h += e.vh * dt; if (e.h < 0) { e.h = 0; e.vh = 0; } }
        e.life += dt;
        if (e.kind >= Data.IT_JBL) return;
        if (Math.abs(e.x - p.x) < 26 && Math.abs(e.y - p.y) < 22 && p.st != S_DEAD) {
            e.alive = false; L.sfx(SFX_ITEM);
            switch (e.kind) {
                case Data.IT_PAO: p.hp = p.maxHp; pop("VIDA 100%", p.x, p.y - 100, 1.2f, 0xFF76FF03); break;
                case Data.IT_PASTEL: p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5f); pop("+50% VIDA", p.x, p.y - 100, 1.2f, 0xFF76FF03); break;
                case Data.IT_CAFE: coffeeT = 15; pop("ATAQUE RÁPIDO!", p.x, p.y - 100, 1.2f, 0xFFFFD400); break;
                case Data.IT_PEN: penT = 8; pop("INVENCÍVEL!", p.x, p.y - 100, 1.5f, 0xFF40C4FF); break;
                case Data.IT_CLORO: p.hp = p.maxHp; cloroImmune = true; blurT = 0; pop("CLOROQUINA! Imune ao álcool", p.x, p.y - 100, 1.8f, 0xFFFFFFFF); break;
                default: break;
            }
        }
    }

    // ---------------------------------------------------------------- projéteis
    private void updateProj(Ent e, float dt) {
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.walk += dt;
        if (e.arc) { e.vh -= 700 * dt; e.h += e.vh * dt; if (e.h <= 0) { e.alive = false; return; } }
        e.life -= dt;
        if (e.life <= 0 || e.x < camX - 140 || e.x > camX + W + 140 || e.y < Y0 - 40 || e.y > Y1 + 40) { e.alive = false; return; }
        if (e.friendly) {
            for (Ent t : new ArrayList<>(ents)) {
                if (!t.alive) continue;
                if (t.type == Ent.ENEMY) { if (t.dying || t.st == S_DOWN || t.st == S_DEAD || t.st == S_HELD) continue; }
                else if (t.type != Ent.CRATE && t.type != Ent.DESK) continue;
                if (Math.abs(t.x - e.x) < e.w + 16 && Math.abs(t.y - e.y) < 24) {
                    int dir = e.vx >= 0 ? 1 : -1;
                    boolean boss = t.type == Ent.ENEMY && Data.KINDS[t.kind].boss;
                    landHit(t, e.dmg, 0, dir, true);
                    if (t.type == Ent.ENEMY && t.alive && !t.dying && e.kind == PJ_NOTIF) { t.confT = boss ? 0.8f : 2.4f; pop("?!", t.x, t.y - 90, 0.8f, 0xFF66BB6A); }
                    e.alive = false; return;
                }
            }
            return;
        }
        if (e.did) return;
        if (p.st == S_DEAD) return;
        boolean inY = Math.abs(p.y - e.y) < 22;
        boolean inX = Math.abs(p.x - e.x) < e.w + 12;
        boolean inH = e.tall ? p.h < 45 : Math.abs(p.h - e.h) < 45;
        if (inX && inY && inH) {
            int dir = e.vx >= 0 ? 1 : -1;
            boolean hit = hurtPlayer(e.dmg, dir, e.kind == PJ_WAVE || e.kind == PJ_TROPHY ? 1 : 0);
            if (hit) {
                if (e.kind == PJ_MULTA) {
                    meter = Math.max(0, meter - 30);
                    pop("MULTA DIÁRIA! -Patriotismo", p.x, p.y - 100, 1.4f, 0xFFFF5252);
                }
                if (e.kind == PJ_WAVE) e.did = true; else e.alive = false;
            }
        }
    }

    // ---------------------------------------------------------------- inimigos
    private void separate(Ent e, float dt) {
        for (Ent o : ents) {
            if (o == e || o.type != Ent.ENEMY || !o.alive || o.st == S_DOWN || o.st == S_DEAD) continue;
            float dx = e.x - o.x, dy = e.y - o.y;
            if (Math.abs(dx) < 34 && Math.abs(dy) < 14) {
                float push = 60 * dt;
                e.x += (dx >= 0 ? 1 : -1) * push;
                e.y += (dy >= 0 ? 1 : -1) * push * 0.4f;
            }
        }
    }

    private void steer(Ent e, float tx, float ty, float sp, float dt) {
        tx = Math.max(camX + 40, Math.min(camX + W - 40, tx));
        float dx = tx - e.x, dy = ty - e.y;
        float d = (float) Math.sqrt(dx * dx + dy * dy);
        if (d < 3) return;
        float vx = dx / d * sp, vy = dy / d * sp * 0.7f;
        e.x += vx * dt; e.y += vy * dt;
        e.walk += (Math.abs(vx) + Math.abs(vy)) * dt;
    }

    private int attackers(Ent self) {
        int n = 0;
        for (Ent o : ents) if (o != self && o.type == Ent.ENEMY && o.alive && (o.st == S_WIND || o.st == S_ATK) && !Data.KINDS[o.kind].boss) n++;
        return n;
    }

    private void updateEnemy(Ent e, float dt) {
        Kind k = Data.KINDS[e.kind];
        if (e.flash > 0) e.flash -= dt;
        if (e.shield > 0) { e.shieldT -= dt; if (e.shieldT <= 0) e.shield = 0; }
        if (e.type == Ent.ENEMY && (e.kind == Data.K_INFLU || e.kind == Data.K_EXBBB) && !e.dying && e.st != S_DOWN) {
            if (Math.abs(p.x - e.x) < 110 && Math.abs(p.y - e.y) < 50) { auraNow = true; auraIdx = curP; }
        }
        switch (e.st) {
            case S_DOWN: updateEnemyDown(e, dt); return;
            case S_DEAD:
                e.t += dt;
                if (e.t > 1.0f) e.alive = false;
                return;
            case S_GETUP:
                e.t += dt;
                if (e.t > 0.35f) { e.st = S_IDLE; e.t = 0; e.cd = Math.max(e.cd, 0.4f); }
                return;
            case S_HELD:
                return;
            case S_HURT:
                e.t += dt;
                e.x += e.vx * dt; e.vx *= 0.88f;
                if (e.t >= e.stunT) { e.st = S_IDLE; e.t = 0; e.cd = Math.max(e.cd, 0.3f); }
                return;
            default: break;
        }
        // mantém dentro das bordas
        e.y = Math.max(Y0, Math.min(Y1, e.y));
        if (k.boss) { aiBoss(e, dt); separate(e, dt); return; }
        aiNormal(e, dt, k);
        separate(e, dt);
    }

    private void updateEnemyDown(Ent e, float dt) {
        e.t += dt;
        if (e.h > 0 || e.vh > 0) {
            e.x += e.vx * dt; e.vh -= GRAV * dt; e.h += e.vh * dt;
            if (e.thrown) {
                for (Ent o : new ArrayList<>(ents)) {
                    if (o == e || o.type != Ent.ENEMY || !o.alive || o.dying || o.st == S_DOWN || o.st == S_DEAD || o.st == S_HELD) continue;
                    if (e.hit.contains(o)) continue;
                    if (Math.abs(o.x - e.x) < 40 && Math.abs(o.y - e.y) < 28) {
                        e.hit.add(o); landHit(o, 12 * dmgMul(), 1, e.vx >= 0 ? 1 : -1, true);
                    }
                }
            }
            if (e.h <= 0) {
                e.h = 0; e.vh = 0; e.aux = 0; e.vx *= 0.3f;
                if (e.dying) { e.st = S_DEAD; e.t = 0; }
            }
        } else {
            e.x += e.vx * dt; e.vx *= 0.85f;
            e.aux += dt;
            if (e.aux > 0.8f) { e.st = S_GETUP; e.t = 0; e.thrown = false; }
        }
    }

    private void aiNormal(Ent e, float dt, Kind k) {
        float dx = p.x - e.x, dy = p.y - e.y;
        float adx = Math.abs(dx), ady = Math.abs(dy);
        e.cd -= dt;
        switch (e.st) {
            case S_IDLE: {
                e.guardUp = k.guard && adx < 260;
                if (e.confT > 0) {
                    e.confT -= dt;
                    e.walk += 60 * dt;
                    e.x += (float) Math.cos(time * 3 + e.slot * 2 + e.hp) * 50 * dt;
                    e.y += (float) Math.sin(time * 2.3 + e.hp) * 30 * dt;
                    return;
                }
                if (p.st == S_DEAD) return;
                e.face = dx >= 0 ? 1 : -1;
                float sp = k.spd * (p.st == S_CHARGE ? 0.5f : 1f);
                switch (k.atk) {
                    case Data.AT_THROW: case Data.AT_POSE: {
                        float want = k.atk == Data.AT_POSE ? 200 : 240;
                        float tx = p.x - e.face * want;
                        if (adx < want - 70 && k.atk == Data.AT_THROW) steer(e, e.x - e.face * 80, p.y, sp, dt);
                        else if (adx > want + 40) steer(e, tx, p.y, sp, dt);
                        else steer(e, e.x, p.y, sp * 0.8f, dt);
                        if (e.cd <= 0 && ady < 24 && adx < 380) {
                            e.atk = (k.atk == Data.AT_POSE && adx < 100) ? 1 : 0;
                            startWindup(e);
                        }
                        break;
                    }
                    case Data.AT_STAB: {
                        float edge = e.aux > 0 ? camX + W - 50 : camX + 50;
                        if (e.aux2 == 0) {
                            steer(e, edge, p.y, k.spd, dt);
                            if (Math.abs(e.x - edge) < 25) e.aux2 = 1;
                        } else {
                            if (adx > 230) steer(e, p.x - e.face * 200, p.y, k.spd, dt);
                            else steer(e, e.x, p.y, k.spd * 0.9f, dt);
                            if (ady < 14 && adx < 260 && e.cd <= 0 && attackers(e) < 3) { e.atk = 0; startWindup(e); }
                        }
                        break;
                    }
                    default: {
                        float range = k.atk == Data.AT_GEL ? 105 : k.atk == Data.AT_RIBBON ? 125 : k.range;
                        float tx = p.x - e.slot * range * 0.7f;
                        if (adx > range * 0.8f || ady > 14) steer(e, tx, p.y, sp, dt);
                        else if (e.cd > 0) steer(e, e.x, p.y + (float) Math.sin(time * 2 + e.slot) * 30, sp * 0.3f, dt);
                        if (adx <= range && ady <= 16 && e.cd <= 0 && attackers(e) < 2) { e.atk = 0; startWindup(e); }
                    }
                }
                break;
            }
            case S_WIND: {
                e.t += dt;
                e.guardUp = false;
                if (e.t >= k.windup) { e.st = S_ATK; e.t = 0; e.did = false; enemyStrike(e, k); }
                break;
            }
            case S_ATK: {
                e.t += dt;
                if (k.atk == Data.AT_STAB && e.t < 0.3f) {
                    e.x += e.face * 430 * dt;
                    if (!e.did && Math.abs(p.x - e.x) < 30 && Math.abs(p.y - e.y) < 20 && p.h < 30) {
                        if (hurtPlayer(k.dmg, e.face, 1)) e.did = true;
                    }
                }
                if (e.t >= 0.45f) { e.st = S_IDLE; e.t = 0; e.cd = k.cd * (0.7f + rnd.nextFloat() * 0.7f); e.walk = 0; }
                break;
            }
            default: break;
        }
    }

    private void startWindup(Ent e) {
        e.st = S_WIND; e.t = 0; e.did = false;
        if (rnd.nextFloat() < 0.18f) {
            Kind k = Data.KINDS[e.kind];
            if (k.lines != null && k.lines.length > 0) pop(k.lines[rnd.nextInt(k.lines.length)], e.x, e.y - 100 * k.scale, 1.1f, 0xFFFFE0B2);
        }
    }

    private void meleeBox(Ent e, float reach, float dmg, int knock) {
        if (Math.abs(p.y - e.y) < 26 && p.h < 32) {
            float lo = Math.min(e.x - 10, e.x + e.face * reach), hi = Math.max(e.x - 10, e.x + e.face * reach);
            if (p.x >= lo - 10 && p.x <= hi + 10) hurtPlayer(dmg, e.face, knock);
        }
    }

    private void enemyStrike(Ent e, Kind k) {
        switch (k.atk) {
            case Data.AT_MELEE:
                meleeBox(e, k.range, k.dmg, 0); L.sfx(SFX_THROW);
                break;
            case Data.AT_THROW:
                spawnProj(PJ_BOOK, e.x + e.face * 20, e.y, 36, e.face * 270, 0, 0, k.dmg, false, 3f, false, false, 10);
                L.sfx(SFX_THROW);
                break;
            case Data.AT_GEL: {
                float rng = 115;
                fxs.add(new Fx(FX_SPARK, e.x + e.face * 50, e.y, 40, 0.5f, 40, 0xFFE0F7FA));
                if (Math.abs(p.x - e.x) < rng && p.x * e.face >= e.x * e.face - 20 && Math.abs(p.y - e.y) < 30 && p.h < 40) {
                    if (!cloroImmune) { blurT = 2f; pop("ÁLCOOL EM GEL!", p.x, p.y - 100, 1f, 0xFFE0F7FA); }
                    hurtPlayer(k.dmg, e.face, 0);
                }
                L.sfx(SFX_THROW);
                break;
            }
            case Data.AT_RIBBON: {
                Fx f = new Fx(FX_LINE, e.x, e.y, 40, 0.35f, 0, 0xFFFFEB3B);
                f.x2 = p.x; f.y2 = p.y; fxs.add(f);
                if (Math.abs(p.x - e.x) < 140 && p.x * e.face >= e.x * e.face - 20 && Math.abs(p.y - e.y) < 28 && p.h < 40) {
                    if (hurtPlayer(k.dmg, e.face, 0)) { rootT = 1.3f; pop("IMOBILIZADO!", p.x, p.y - 100, 1f, 0xFFFFEB3B); }
                }
                L.sfx(SFX_THROW);
                break;
            }
            case Data.AT_STAB:
                break; // o ataque acontece em S_ATK (investida)
            case Data.AT_POSE:
                if (e.atk == 1) {
                    fxs.add(new Fx(FX_RING, e.x, e.y, 20, 0.5f, 95, 0xFFE040FB));
                    pop("CANCELADO!", e.x, e.y - 100, 0.9f, 0xFFE040FB);
                    if (Math.abs(p.x - e.x) < 95 && Math.abs(p.y - e.y) < 45 && p.h < 35) hurtPlayer(k.dmg, p.x >= e.x ? 1 : -1, 1);
                    L.sfx(SFX_HEAVY);
                } else {
                    spawnProj(PJ_TROPHY, e.x + e.face * 20, e.y, 40, e.face * 240, 0, 150, k.dmg, false, 3f, false, true, 10);
                    L.sfx(SFX_THROW);
                }
                break;
            default: break;
        }
    }

    // ---------------------------------------------------------------- chefes
    private void aiBoss(Ent e, float dt) {
        Kind k = Data.KINDS[e.kind];
        float dx = p.x - e.x, dy = p.y - e.y;
        float adx = Math.abs(dx), ady = Math.abs(dy);
        e.cd -= dt;
        if (e.kind == Data.K_REITOR) { e.h = e.aux + (float) Math.sin(time * 2.2) * 6f; }
        if (e.kind == Data.K_MULA && e.aux > 0) e.aux -= dt; // recarga da pinga
        switch (e.st) {
            case S_IDLE: {
                if (e.confT > 0) { e.confT -= dt; return; }
                if (p.st == S_DEAD) return;
                e.face = dx >= 0 ? 1 : -1;
                boolean stationary = e.aux2 > 0;
                float pref;
                switch (e.kind) {
                    case Data.K_ATILA: pref = 240; break;
                    case Data.K_DOMINGAO: pref = 210; break;
                    case Data.K_REITOR: pref = 170; break;
                    case Data.K_BONE: pref = e.invul ? 0 : 80; break;
                    default: pref = 70;
                }
                if (!stationary) {
                    float tx = p.x - e.face * pref;
                    if (adx > pref + 30) steer(e, tx, p.y, k.spd, dt);
                    else if (adx < pref - 60 && pref > 100) steer(e, e.x - e.face * 80, p.y, k.spd * 0.8f, dt);
                    else steer(e, e.x, p.y, k.spd * 0.6f, dt);
                }
                if (e.cd <= 0 && (ady < 40 || pref > 100 || stationary)) chooseBoss(e, adx, ady);
                break;
            }
            case S_WIND: {
                e.t += dt;
                if (e.t >= e.wind) { bossStrike(e); }
                break;
            }
            case S_ATK: {
                e.t += dt;
                if (e.life > 0) {
                    e.life -= dt; e.x += e.vx * dt;
                    if (!e.did && Math.abs(p.x - e.x) < 38 && Math.abs(p.y - e.y) < 28 && p.h < 30) {
                        if (hurtPlayer(e.dmg, e.face, 1)) e.did = true;
                    }
                }
                if (e.t >= e.rec) { e.st = S_IDLE; e.t = 0; e.vx = 0; e.life = 0; e.cd = k.cd * (0.7f + rnd.nextFloat() * 0.8f); }
                break;
            }
            default: break;
        }
    }

    private void setBossAtk(Ent e, int atk, float wind, float rec) {
        e.st = S_WIND; e.t = 0; e.atk = atk; e.did = false; e.walk = 0;
        e.life = 0; e.hit.clear(); e.wind = wind; e.rec = rec;
    }

    private void chooseBoss(Ent e, float adx, float ady) {
        float r = rnd.nextFloat();
        switch (e.kind) {
            case Data.K_CHEFAO:
                if (adx < 95) setBossAtk(e, 0, 0.45f, 0.5f);
                else if (r < 0.6f) setBossAtk(e, 1, 0.6f, 0.6f);
                else e.cd = 0.3f;
                break;
            case Data.K_ATILA:
                if (adx < 85) setBossAtk(e, 0, 0.5f, 0.5f);
                else if (r < 0.5f) setBossAtk(e, 1, 0.55f, 0.7f);
                else setBossAtk(e, 2, 0.75f, 0.9f);
                break;
            case Data.K_REITOR: {
                int gv = 0;
                for (Ent o : ents) if (o.type == Ent.ENEMY && o.alive && !o.dying && o.kind == Data.K_GREVISTA) gv++;
                if (gv < 3 && r < 0.55f) setBossAtk(e, 1, 0.9f, 0.8f);
                else setBossAtk(e, 0, 0.6f, 0.9f);
                break;
            }
            case Data.K_DOMINGAO:
                if (adx < 110) setBossAtk(e, 3, 0.6f, 0.6f);
                else if (r < 0.5f) setBossAtk(e, 0, 0.7f, 0.8f);
                else setBossAtk(e, 1, 0.6f, 0.8f);
                break;
            case Data.K_BONE:
                if (e.invul) setBossAtk(e, 0, 0.55f, 0.9f);
                else if (adx < 110) setBossAtk(e, 1, 0.5f, 0.5f);
                else if (r < 0.5f) setBossAtk(e, 0, 0.55f, 0.9f);
                else setBossAtk(e, 2, 0.5f, 0.6f);
                break;
            case Data.K_XEREX:
                if (adx < 90) setBossAtk(e, 0, 0.8f, 0.7f);
                else if (r < 0.4f) setBossAtk(e, 1, 0.55f, 0.8f);
                else if (r < 0.7f) setBossAtk(e, 2, 0.5f, 0.5f);
                else setBossAtk(e, 0, 0.8f, 0.7f);
                break;
            case Data.K_XANXA:
                if (adx < 95) setBossAtk(e, 0, 0.5f, 0.5f);
                else if (r < 0.55f) setBossAtk(e, 1, 0.6f, 0.7f);
                else e.cd = 0.4f;
                break;
            case Data.K_MULA:
                if (e.hp < e.maxHp * 0.75f && e.aux <= 0 && e.shield <= 0) { e.aux = 14; setBossAtk(e, 0, 1.8f, 0.3f); pop("Glub glub glub...", e.x, e.y - 130, 1.6f, 0xFFFFE082); }
                else if (adx < 90) { if (r < 0.5f) setBossAtk(e, 3, 0.55f, 0.5f); else setBossAtk(e, 2, 0.7f, 0.7f); }
                else if (e.shield <= 0 && r < 0.4f) setBossAtk(e, 1, 0.6f, 0.5f);
                else e.cd = 0.4f;
                break;
            default:
                setBossAtk(e, 0, 0.5f, 0.5f);
        }
    }

    private void bossStrike(Ent e) {
        Kind k = Data.KINDS[e.kind];
        e.st = S_ATK; e.t = 0; e.did = false; e.life = 0; e.vx = 0;
        e.dmg = k.dmg;
        int f = e.face;
        switch (e.kind) {
            case Data.K_CHEFAO:
                if (e.atk == 0) { meleeBox(e, 85, 11, 1); L.sfx(SFX_HEAVY); }
                else { e.vx = f * 400; e.life = 0.5f; e.dmg = 14; L.sfx(SFX_THROW); }
                break;
            case Data.K_ATILA:
                if (e.atk == 0) { meleeBox(e, 75, 9, 1); L.sfx(SFX_HEAVY); }
                else if (e.atk == 1) {
                    for (int i = -1; i <= 1; i++) spawnProj(PJ_SYRINGE, e.x + f * 40, e.y + i * 24, 45, f * 330, 0, 0, 8, false, 3f, false, false, 16);
                    pop("SERINGAS!", e.x, e.y - 130, 0.9f, 0xFF80DEEA); L.sfx(SFX_THROW);
                } else {
                    spawnProj(PJ_WAVE, e.x + f * 40, e.y, 0, f * 180, 0, 0, 10, false, 4f, true, false, 24);
                    pop("OITENTA MIL MORTES!", e.x, e.y - 130, 1.2f, 0xFFFFFFFF); L.sfx(SFX_ROAR);
                }
                break;
            case Data.K_REITOR:
                if (e.atk == 1) {
                    spawnEnemyAt(Data.K_GREVISTA, e.x - 80, e.y - 20);
                    spawnEnemyAt(Data.K_GREVISTA, e.x + 80, e.y + 20);
                    pop("GREVISTAS, ATACAR!", e.x, e.y - 140, 1.2f, 0xFFFFFFFF); L.sfx(SFX_ROAR);
                } else {
                    float dir = p.x >= e.x ? 1 : -1; e.face = (int) dir;
                    e.vx = dir * 400; e.life = Math.min(0.7f, Math.abs(p.x - e.x) / 400f + 0.1f); e.dmg = 11; L.sfx(SFX_THROW);
                }
                break;
            case Data.K_DOMINGAO:
                if (e.atk == 0) {
                    spawnProj(PJ_WAVE, e.x + f * 40, e.y, 0, f * 210, 0, 0, 9, false, 4f, true, false, 26);
                    pop("OLOKO, BICHO!", e.x, e.y - 140, 1.2f, 0xFFFFD400); L.sfx(SFX_ROAR);
                } else if (e.atk == 1) {
                    for (int i = -1; i <= 1; i++) spawnProj(i == 0 ? PJ_WATCH : PJ_TROPHY, e.x + f * 30, e.y + i * 18, 50, f * (220 + i * 20), i * 25, 140, 8, false, 3f, false, true, 10);
                    L.sfx(SFX_THROW);
                } else {
                    fxs.add(new Fx(FX_RING, e.x, e.y, 30, 0.6f, 125, 0xFFFFD400));
                    pop("VINHETA!", e.x, e.y - 140, 1f, 0xFFFFD400);
                    if (Math.abs(p.x - e.x) < 125 && Math.abs(p.y - e.y) < 55 && p.h < 40) hurtPlayer(8, p.x >= e.x ? 1 : -1, 1);
                    L.sfx(SFX_ROAR);
                }
                break;
            case Data.K_BONE:
                if (e.atk == 0) {
                    for (int i = -1; i <= 1; i++) spawnProj(PJ_PAPER, e.x + f * 30, e.y, 40, f * 430, (p.y - e.y) * 0.8f + i * 30, 0, 6, false, 2.5f, false, false, 12);
                    L.sfx(SFX_THROW);
                } else if (e.atk == 1) { meleeBox(e, 105, 14, 1); bossSay(e, "Boa noite."); L.sfx(SFX_HEAVY); }
                else { e.vx = f * 360; e.life = 0.45f; e.dmg = 12; L.sfx(SFX_THROW); }
                break;
            case Data.K_XEREX:
                if (e.atk == 0) {
                    meleeBox(e, 80, 14, 1);
                    spawnProj(PJ_WAVE, e.x + 30, e.y, 0, 260, 0, 0, 11, false, 3f, false, false, 16);
                    spawnProj(PJ_WAVE, e.x - 30, e.y, 0, -260, 0, 0, 11, false, 3f, false, false, 16);
                    shake = 12; pop("CANETADA!", e.x, e.y - 140, 1f, 0xFFFFD400); L.sfx(SFX_HEAVY);
                } else if (e.atk == 1) {
                    for (int i = -1; i <= 1; i += 2) spawnProj(PJ_MULTA, e.x + f * 30, e.y, 45, f * 330, (p.y - e.y) * 0.4f + i * 25, 0, 4, false, 3f, false, false, 12);
                    pop("MULTA DIÁRIA!", e.x, e.y - 140, 1f, 0xFFFF5252); L.sfx(SFX_THROW);
                } else { e.vx = f * 360; e.life = 0.4f; e.dmg = 12; L.sfx(SFX_THROW); }
                break;
            case Data.K_XANXA:
                if (e.atk == 0) { meleeBox(e, 85, 11, 1); L.sfx(SFX_HEAVY); }
                else {
                    for (int i = -1; i <= 1; i++) spawnProj(PJ_BOOK, e.x + f * 30, e.y, 50, f * 300, (p.y - e.y) * 0.35f + i * 30, 0, 6, false, 3f, false, false, 12);
                    pop("BOLSA VOADORA!", e.x, e.y - 140, 1f, 0xFFFFCC80); L.sfx(SFX_THROW);
                }
                break;
            case Data.K_MULA:
                if (e.atk == 0) {
                    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.18f);
                    pop("RECUPEROU!", e.x, e.y - 140, 1.2f, 0xFF76FF03); L.sfx(SFX_ITEM);
                } else if (e.atk == 1) {
                    e.shield = 45; e.shieldT = 7f;
                    fxs.add(new Fx(FX_RING, e.x, e.y, 40, 0.6f, 70, 0xFF80DEEA));
                    pop("BARREIRA DE DISCURSO!", e.x, e.y - 140, 1.3f, 0xFF80DEEA);
                } else if (e.atk == 2) {
                    fxs.add(new Fx(FX_RING, e.x, e.y, 30, 0.6f, 115, 0xFFFF5252));
                    pop("DISCURSO!", e.x, e.y - 140, 1f, 0xFFFF5252);
                    bossSay(e, "O Brasil acabou!");
                    if (Math.abs(p.x - e.x) < 115 && Math.abs(p.y - e.y) < 55 && p.h < 40) hurtPlayer(10, p.x >= e.x ? 1 : -1, 1);
                    L.sfx(SFX_ROAR);
                } else { meleeBox(e, 90, 12, 1); L.sfx(SFX_HEAVY); }
                break;
            default: meleeBox(e, 80, k.dmg, 1);
        }
    }
}
