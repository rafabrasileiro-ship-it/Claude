package com.rafa.patriota;

import java.util.ArrayList;
import java.util.Random;

/** Fase do jet-ski: lógica pura (sem Android). Mundo no mesmo sistema do Game (x lateral, y = faixa de água). */
final class Jet {
    static final int W = Game.W;
    static final float GOAL = 16000f;           // distância até o cais
    static final float Y_MIN = Game.Y0 + 22, Y_MAX = Game.Y1 - 6;

    final Random rnd = new Random();

    // ---------------------------------------------------------------- entidades
    static final class Whale {
        float x, y, vx, h, t, flash, sinkT, tx, ty;
        int type;              // 0 = Dino, 1 = Gilmar
        float hp, maxHp, size;
        boolean dying;
        int rammedBy;          // 0 = ninguém; senão (jogador+1) que está batendo
        float breachT;         // >0 enquanto salta
        int id;
    }

    static final class Patriot {
        float x, y, tx, ty, t, ramCd, life;
        int look;
        Whale target;
        boolean gone;
    }

    final ArrayList<Whale> whales = new ArrayList<>();
    final ArrayList<Patriot> patriots = new ArrayList<>();
    final ArrayList<Game.Pop> pops = new ArrayList<>();
    final ArrayList<Game.Fx> fxs = new ArrayList<>();

    // ---------------------------------------------------------------- jogador(es)
    /** Estado de um jogador (na dupla há dois jet-skis; os campos soltos abaixo são os do jogador "ativo"). */
    static final class JS {
        int hero; float x, y, h, vh, hp, maxHp, meter, jx, jy, ramT, ramCd, inv, hurtT, flash, specialT, bufA, bufB, bufD, bank, wakeT, deadT;
        boolean turbo, rammed;
        float tx, ty;
    }
    final JS[] ps = {new JS(), new JS()};
    int np = 1, cur = 0, local = 0;
    boolean mirror;
    int hero;
    float camX, camTx, x, y, h, vh;
    float hp, maxHp, meter;
    float jx, jy;
    boolean turbo;
    float ramT, ramCd, inv, hurtT, flash;
    boolean rammed;
    int result;
    float endT, time, shake, specialT, spawnT;
    int score, kills, combo;
    float comboTimer;
    private float bufA, bufB, bufD;
    int nextId;
    float wakeT, deadT;
    float bank;

    Game.Listener L;

    Jet(Game.Listener l) { L = l; }

    private void save(JS q) {
        q.hero = hero; q.x = x; q.y = y; q.h = h; q.vh = vh; q.hp = hp; q.maxHp = maxHp; q.meter = meter; q.jx = jx; q.jy = jy;
        q.ramT = ramT; q.ramCd = ramCd; q.inv = inv; q.hurtT = hurtT; q.flash = flash; q.specialT = specialT;
        q.bufA = bufA; q.bufB = bufB; q.bufD = bufD; q.bank = bank; q.wakeT = wakeT; q.deadT = deadT; q.turbo = turbo; q.rammed = rammed;
    }

    private void load(JS q) {
        hero = q.hero; x = q.x; y = q.y; h = q.h; vh = q.vh; hp = q.hp; maxHp = q.maxHp; meter = q.meter; jx = q.jx; jy = q.jy;
        ramT = q.ramT; ramCd = q.ramCd; inv = q.inv; hurtT = q.hurtT; flash = q.flash; specialT = q.specialT;
        bufA = q.bufA; bufB = q.bufB; bufD = q.bufD; bank = q.bank; wakeT = q.wakeT; deadT = q.deadT; turbo = q.turbo; rammed = q.rammed;
    }

    /** Passa a controlar o jogador i (guarda o anterior). */
    void use(int i) { save(ps[cur]); cur = i; load(ps[i]); }

    /** Para o jogador local ser o "ativo" nos HUDs. */
    void sync() { save(ps[cur]); }

    void start(int heroIndex) { start(heroIndex, -1); }

    void start(int heroA, int heroB) {
        np = heroB >= 0 ? 2 : 1; cur = 0; mirror = false; local = 0;
        whales.clear(); patriots.clear(); pops.clear(); fxs.clear();
        for (int i = 0; i < np; i++) {
            JS q = ps[i];
            q.hero = i == 0 ? heroA : heroB;
            q.x = 220 - i * 30; q.y = np == 2 ? (i == 0 ? 320 : 400) : 350; q.h = 0; q.vh = 0;
            q.maxHp = Data.HERO_HP[q.hero] * 1.1f; q.hp = q.maxHp; q.meter = 30;
            q.inv = 1.2f; q.ramT = q.ramCd = q.hurtT = q.flash = q.specialT = 0; q.bufA = q.bufB = q.bufD = 0; q.bank = 0;
            q.jx = q.jy = 0; q.turbo = false; q.rammed = false; q.deadT = 0; q.wakeT = 0;
        }
        camX = 0; load(ps[0]);
        result = 0; endT = 0; time = 0; shake = 0; spawnT = 2.2f;
        score = 0; kills = 0; combo = 0; comboTimer = 0; nextId = 0;
    }

    void continueGame() {
        for (int i = 0; i < np; i++) { JS q = (i == cur) ? null : ps[i]; if (q != null) { q.hp = q.maxHp; q.inv = 2.5f; q.hurtT = 0; q.deadT = 0; } }
        hp = maxHp; inv = 2.5f; hurtT = 0; deadT = 0; result = 0; endT = 0;
        save(ps[cur]);
        for (int i = whales.size() - 1; i >= 0; i--) if (whales.get(i).x < camX + W + 700) whales.remove(i);
        spawnT = 2.5f;
    }

    boolean anyAlive() { sync(); for (int i = 0; i < np; i++) if (ps[i].hp > 0) return true; return false; }

    void setMove(float ax, float ay) { setMove(0, ax, ay); }
    void setMove(int i, float ax, float ay) { JS q = ps[i]; q.jx = ax; q.jy = ay; if (i == cur) { jx = ax; jy = ay; } }

    void press(int b) { press(0, b); }
    void press(int i, int b) {
        sync();
        JS q = ps[i];
        if (b == Game.BA) q.bufA = 0.22f; else if (b == Game.BB) q.bufB = 0.22f;
        else if (b == Game.BC) q.turbo = true; else if (b == Game.BD) q.bufD = 0.22f;
        load(ps[cur]);
    }

    void release(int b) { release(0, b); }
    void release(int i, int b) { sync(); if (b == Game.BC) ps[i].turbo = false; load(ps[cur]); }

    /** Convidado: passa a exibir o jogador i como o "ativo". */
    void adopt(int i) { cur = i; load(ps[i]); }

    /** Convidado: suaviza posições entre dois snapshots. */
    void smooth(float dt) {
        float k = Math.min(1f, 22f * dt);
        time += dt;
        camX += (camTx - camX) * k;
        for (int i = 0; i < np; i++) { JS q = ps[i]; if (Math.abs(q.tx - q.x) > 160) q.x = q.tx; else q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k; }
        for (Whale w : whales) { if (Math.abs(w.tx - w.x) > 160) w.x = w.tx; else w.x += (w.tx - w.x) * k; w.y += (w.ty - w.y) * k; w.t += dt; }
        for (Patriot p : patriots) { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
        for (Game.Fx f : fxs) f.t += dt;
        for (Game.Pop p : pops) { p.t += dt; p.y -= 22 * dt; }
        adopt(local);
    }

    float progress() { return Math.max(0f, Math.min(1f, camX / GOAL)); }

    // ---------------------------------------------------------------- loop
    void update(float dt) {
        if (dt > 0.05f) dt = 0.05f;
        time += dt;
        for (int i = pops.size() - 1; i >= 0; i--) { Game.Pop q = pops.get(i); q.t += dt; q.y -= 22 * dt; if (q.t > q.life) pops.remove(i); }
        for (int i = fxs.size() - 1; i >= 0; i--) { Game.Fx f = fxs.get(i); f.t += dt; if (f.t > f.life) fxs.remove(i); }
        if (result != 0) return;
        int home = cur;
        sync();
        if (shake > 0) shake = Math.max(0, shake - dt * 30);
        if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
        boolean alive = false, turboAny = false, hurtAny = false;
        for (int i = 0; i < np; i++) if (ps[i].hp > 0) { alive = true; turboAny |= ps[i].turbo; hurtAny |= ps[i].hurtT > 0; }
        if (endT > 0) { endT -= dt; if (endT <= 0) { result = !alive ? 2 : 1; L.sfx(!alive ? Game.SFX_LOSE : Game.SFX_WIN); } }

        // rolagem do curso
        float base = 230f + 70f * progress();
        float speed = base * (turboAny ? 1.55f : 1f) * (hurtAny ? 0.6f : 1f);
        if (!alive) speed *= 0.2f;
        if (progress() >= 1f && endT <= 0 && alive) { endT = 1.6f; L.sfx(Game.SFX_WIN); pop("CHEGOU AO CAIS!", camX + 400, 160, 2f, 0xFFFFD400); }
        camX += speed * dt;

        for (int i = 0; i < np; i++) { use(i); updatePlayer(dt); }
        use(home);
        updatePatriots(dt);
        spawn(dt);
        for (Whale w : new ArrayList<>(whales)) updateWhale(w, dt);
        for (int i = whales.size() - 1; i >= 0; i--) {
            Whale w = whales.get(i);
            if (w.x < camX - 260 || (w.dying && w.sinkT > 1.2f)) whales.remove(i);
        }
        // colisões baleia x jet-skis
        for (int i = 0; i < np; i++) {
            use(i);
            if (hp <= 0 || inv > 0 || ramT > 0) continue;
            for (Whale w : whales) {
                if (w.dying) continue;
                if (Math.abs(w.x - x) < 52 * w.size && Math.abs(w.y - y) < 26 + 6 * w.size && h < 38 * w.size + w.h) { hurt(w); break; }
            }
        }
        use(home);
        sync();
        boolean all = true;
        for (int i = 0; i < np; i++) if (ps[i].hp > 0) all = false;
        if (all && endT <= 0) endT = 1.4f;
        score += (int) (speed * dt * 0.1f);
    }

    /** Movimento, pulo, investida e especial do jogador ativo. */
    private void updatePlayer(float dt) {
        boolean pA = bufA > 0, pB = bufB > 0, pD = bufD > 0;
        bufA -= dt; bufB -= dt; bufD -= dt;
        if (inv > 0) inv -= dt;
        if (flash > 0) flash -= dt;
        if (hurtT > 0) hurtT -= dt;
        if (ramCd > 0) ramCd -= dt;
        boolean alive = hp > 0;
        if (!alive && np == 2) {
            // o parceiro vivo "resgata" o caído depois de alguns segundos
            boolean other = false;
            for (int i = 0; i < np; i++) if (i != cur && ps[i].hp > 0) other = true;
            if (other) { deadT += dt; if (deadT > 6f) { hp = maxHp * 0.5f; inv = 2.5f; deadT = 0; x = camX + 240; h = 0; vh = 0; pop("VOLTOU À ÁGUA!", x, y - 80, 1.2f, 0xFF76FF03); } }
            return;
        }
        if (alive) {
            float rel = x - camX;
            float ax = jx * 270f * (Data.HERO_SPD[hero] > 1f ? 1.1f : 1f);
            rel += (ax + (ramT > 0 ? 330f : 0f)) * dt;
            rel = Math.max(90, Math.min(500, rel));
            if (ramT <= 0 && Math.abs(jx) < 0.1f) rel += (240f - rel) * Math.min(1f, 1.2f * dt);
            x = camX + rel;
            y += jy * 190f * dt;
            y = Math.max(Y_MIN, Math.min(Y_MAX, y));
            bank += ((-jy) * 12f - bank) * Math.min(1f, 6f * dt);
            if (pB && h <= 0 && vh <= 0 && ramT <= 0) { bufB = 0; vh = 380f; L.sfx(Game.SFX_JUMP); splash(x, y, 14); }
            if (pA && ramCd <= 0 && ramT <= 0 && h <= 0) { bufA = 0; ramT = 0.38f; ramCd = 0.75f; rammed = false; L.sfx(Game.SFX_THROW); }
            if (pD && meter >= 50 && specialT <= 0) { bufD = 0; callPatriots(); }
        }
        if (h > 0 || vh > 0) {
            vh -= 1000f * dt; h += vh * dt;
            if (h <= 0) { h = 0; vh = 0; splash(x, y, 20); L.sfx(Game.SFX_HEAVY); shake = Math.max(shake, 3); }
        }
        if (ramT > 0) {
            ramT -= dt;
            for (Whale w : new ArrayList<>(whales)) {
                if (w.dying || w.rammedBy == cur + 1) continue;
                if (w.x - w.size * 40 < x + 96 && w.x + w.size * 40 > x + 10 && Math.abs(w.y - y) < 30 + 8 * w.size && h < 38 * w.size) {
                    w.rammedBy = cur + 1;
                    hitWhale(w, 1.5f * Data.HERO_DMG[hero], true);
                }
            }
            if (ramT <= 0) for (Whale w : whales) if (w.rammedBy == cur + 1) w.rammedBy = 0;
            splash(x - 30, y, 2);
        }
        if (specialT > 0) { specialT -= dt; inv = Math.max(inv, 0.2f); }
        wakeT -= dt;
        if (wakeT <= 0 && alive) { wakeT = 0.08f; fxs.add(new Game.Fx(Game.FX_DUST, x - 40, y, 2, 0.7f, 16, 0xFFE0F7FA)); }
    }

    private void spawn(float dt) {
        spawnT -= dt;
        if (spawnT > 0 || progress() >= 0.96f) return;
        float p = progress();
        spawnT = Math.max(0.65f, 2.1f - 1.3f * p) * (0.8f + rnd.nextFloat() * 0.5f);
        int n = (p > 0.5f && rnd.nextFloat() < 0.35f ? 2 : 1) + (np == 2 ? 1 : 0);
        for (int i = 0; i < n; i++) {
            Whale w = new Whale();
            w.type = rnd.nextInt(2);
            w.size = w.type == 0 ? 1.0f : 1.25f;
            w.maxHp = w.hp = w.type == 0 ? 2f : 3f;
            w.x = camX + W + 120 + i * 140;
            w.y = Y_MIN + rnd.nextFloat() * (Y_MAX - Y_MIN);
            w.vx = -(30f + rnd.nextFloat() * 60f);
            w.id = nextId++;
            w.t = rnd.nextFloat() * 6f;
            whales.add(w);
        }
    }

    private void updateWhale(Whale w, float dt) {
        w.t += dt;
        if (w.flash > 0) w.flash -= dt;
        if (w.dying) { w.sinkT += dt; w.x += w.vx * dt; return; }
        w.x += w.vx * dt;
        // pulo da baleia (breach): sobe e desce, fica mais alta
        w.h = Math.max(0f, (float) Math.sin(w.t * 1.7f) * 14f);
    }

    private void hurt(Whale w) {
        hp -= w.type == 0 ? 12 : 16;
        inv = 1.3f; hurtT = 0.7f; flash = 0.25f; shake = 9; if (np == 1) combo = 0;
        x -= 55; if (x < camX + 90) x = camX + 90;
        L.sfx(Game.SFX_HURT); L.vibrate(40);
        splash(x, y, 22);
        pop(w.type == 0 ? "BATEU NA BALEIA!" : "BATEU NA BALEIA!", x, y - 80, 1f, 0xFFFF5252);
        if (hp <= 0) { hp = 0; }
    }

    void hitWhale(Whale w, float dmg, boolean byPlayer) {
        w.hp -= dmg; w.flash = 0.2f;
        shake = Math.max(shake, 5);
        L.sfx(Game.SFX_HEAVY);
        splash(w.x, w.y, 20);
        fxs.add(new Game.Fx(Game.FX_SPARK, w.x - 20, w.y, 40, 0.3f, 22, 0xFFFFFFFF));
        if (byPlayer) {
            meter = Math.min(100, meter + 22);
            combo++; comboTimer = 2f;
            score += 50 * Math.max(1, combo / 3 + 1);
        }
        if (w.hp <= 0 && !w.dying) {
            w.dying = true; w.sinkT = 0; w.vx = -20;
            kills++;
            score += w.type == 0 ? 300 : 450;
            pop(w.type == 0 ? "BALEIA DERROTADA!" : "BALEIÃO DERROTADO!", w.x, w.y - 90, 1.2f, 0xFFFFD400);
            for (int i = 0; i < 3; i++) splash(w.x + (i - 1) * 24, w.y, 22);
            L.sfx(Game.SFX_BREAK);
        } else if (!w.dying) {
            w.x += 60; // recua com o impacto
        }
    }

    // ---------------------------------------------------------------- especial: patriotas de jet-ski
    private void callPatriots() {
        meter -= 50;
        specialT = 7f;
        inv = Math.max(inv, 7f);
        shake = 12;
        L.sfx(Game.SFX_SPECIAL);
        if (L.hasClip(Data.HERO_SPECIAL[hero])) L.voice(Data.HERO_SPECIAL[hero]);
        pop("AVANTE, PATRIOTAS!", x, y - 110, 1.8f, 0xFFFFD400);
        fxs.add(new Game.Fx(Game.FX_RING, x, y, 0, 0.9f, 260, 0xFFFFD400));
        int n = np == 2 ? 3 : 6;
        for (int i = 0; i < n; i++) {
            Patriot p = new Patriot();
            p.x = camX - 120 - i * 40;
            p.y = Y_MIN + (Y_MAX - Y_MIN) * (i + 0.5f) / n;
            p.look = np == 2 ? (i == 0 ? hero : i % 4) : i % 4;
            p.life = 7f;
            p.ty = p.y;
            patriots.add(p);
        }
    }

    private void updatePatriots(float dt) {
        for (Patriot p : patriots) {
            p.t += dt; p.life -= dt;
            if (p.ramCd > 0) p.ramCd -= dt;
            // escolhe o alvo mais próximo à frente
            if (p.target == null || p.target.dying || p.target.x < p.x - 40) {
                p.target = null;
                float best = 1e9f;
                for (Whale w : whales) {
                    if (w.dying) continue;
                    float d = Math.abs(w.y - p.y) * 1.5f + Math.max(0f, w.x - p.x) * 0.25f;
                    if (w.x > p.x - 20 && d < best && w.x < camX + W + 200) { best = d; p.target = w; }
                }
            }
            float vx = 330f, vy = 0;
            if (p.target != null) {
                vx = 560f;
                float dy = p.target.y - p.y;
                vy = Math.max(-260f, Math.min(260f, dy * 4f));
                if (p.ramCd <= 0 && Math.abs(p.target.x - p.x) < 80 && Math.abs(dy) < 30) {
                    p.ramCd = 0.5f;
                    hitWhale(p.target, 2.2f, false);
                    score += 60;
                }
            } else {
                // sem alvo: acompanha o Jair na formação
                vx = ((camX + 260) - p.x) * 2.4f + 230f;
                vy = (p.ty - p.y) * 2f;
            }
            p.x += vx * dt; p.y = Math.max(Y_MIN, Math.min(Y_MAX, p.y + vy * dt));
            if (p.life <= 0 && p.x > camX + W + 80) p.gone = true;
            if (rnd.nextFloat() < 0.5f) fxs.add(new Game.Fx(Game.FX_DUST, p.x - 40, p.y, 2, 0.5f, 12, 0xFFE0F7FA));
        }
        // no fim do especial os patriotas aceleram e saem de cena
        for (int i = patriots.size() - 1; i >= 0; i--) {
            Patriot p = patriots.get(i);
            if (p.life <= 0) { p.x += 500 * dt; }
            if (p.gone || p.x > camX + W + 200) patriots.remove(i);
        }
    }

    // ---------------------------------------------------------------- efeitos
    void splash(float wx, float wy, int n) {
        for (int i = 0; i < Math.min(n, 6); i++) {
            Game.Fx f = new Game.Fx(Game.FX_DUST, wx + (rnd.nextFloat() - 0.5f) * 40, wy, 6 + rnd.nextFloat() * 14, 0.55f, 14, 0xFFE0F7FA);
            fxs.add(f);
        }
    }

    void pop(String s, float px, float py, float life, int color) { pops.add(new Game.Pop(s, px, py, life, color)); }
}
