package com.rafa.patriota;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;

/** Serialização do estado do jogo para o modo dupla (Bluetooth). Lógica pura, sem Android. */
final class Snap {
    static final byte M_SNAP = 1, M_INPUT = 2, M_HERO = 3, M_START = 4, M_BYE = 5, M_HELLO = 6, M_PING = 7, M_PONG = 8;
    static final byte I_MOVE = 0, I_PRESS = 1, I_RELEASE = 2;

    private Snap() { }

    /** Repassa os sons/falas ao celular local e guarda uma cópia para enviar ao convidado. */
    static final class Relay implements Game.Listener {
        final Game.Listener to;
        final ArrayList<String> ev = new ArrayList<>();
        boolean rec;
        Relay(Game.Listener to) { this.to = to; }
        @Override public void sfx(int id) { to.sfx(id); if (rec && ev.size() < 40) ev.add("s" + id); }
        @Override public void voice(String line) { to.voice(line); if (rec && ev.size() < 40) ev.add("v" + line); }
        @Override public boolean hasClip(String line) { return to.hasClip(line); }
        @Override public void vibrate(int ms) { to.vibrate(ms); }
    }

    // ---------------------------------------------------------------- mensagens pequenas
    static byte[] msgInput(byte kind, float a, float b) {
        try {
            ByteArrayOutputStream bo = new ByteArrayOutputStream(16);
            DataOutputStream o = new DataOutputStream(bo);
            o.writeByte(M_INPUT); o.writeByte(kind); o.writeFloat(a); o.writeFloat(b);
            return bo.toByteArray();
        } catch (IOException e) { return new byte[]{M_INPUT}; }
    }

    static byte[] msg(byte type, int a, int b, int c) {
        return new byte[]{type, (byte) a, (byte) b, (byte) c};
    }

    /** Aplica uma mensagem de entrada do convidado no jogador 1. */
    static void applyInput(Game g, byte[] m) {
        try {
            DataInputStream in = new DataInputStream(new java.io.ByteArrayInputStream(m));
            in.readByte();
            byte kind = in.readByte();
            float a = in.readFloat(), b = in.readFloat();
            if (g.np < 2) return;
            if (kind == I_MOVE) g.setMove(1, a, b);
            else if (kind == I_PRESS) g.press(1, (int) a);
            else if (kind == I_RELEASE) g.release(1, (int) a);
        } catch (IOException ignored) { }
    }

    // ---------------------------------------------------------------- snapshot
    private static short q4(float v) { return (short) Math.max(-32000, Math.min(32000, Math.round(v * 4f))); }
    private static short q100(float v) { return (short) Math.max(-32000, Math.min(32000, Math.round(v * 100f))); }

    private static void wEnt(DataOutputStream o, Game g, Ent e) throws IOException {
        if (e.nid == 0) { g.nextNid = g.nextNid % 32000 + 1; e.nid = g.nextNid; }
        o.writeByte(e.type); o.writeByte(e.kind); o.writeShort(e.nid);
        o.writeShort(q4(e.x)); o.writeShort(q4(e.y)); o.writeShort(q4(e.h));
        int fl = (e.face > 0 ? 1 : 0) | (e.dying ? 2 : 0) | (e.guardUp ? 4 : 0) | (e.friendly ? 8 : 0) | (e.tall ? 16 : 0)
                | (e.arc ? 32 : 0) | (e.thrown ? 64 : 0) | (e.invul ? 128 : 0);
        o.writeByte(fl);
        o.writeByte(e.st);
        o.writeShort(q4(e.hp)); o.writeShort(q4(e.maxHp));
        o.writeShort(q100(Math.min(e.t, 300f)));
        o.writeByte((int) Math.max(0, Math.min(255, e.flash * 400f)));
        o.writeShort(q4(e.walk));
        o.writeShort(q4(e.shield));
        o.writeByte((int) Math.max(0, Math.min(255, e.confT * 40f)));
        o.writeShort(q100(Math.min(e.life, 300f)));
        o.writeByte((int) Math.max(0, Math.min(255, e.w)));
        o.writeByte((int) Math.max(0, Math.min(255, e.inv * 40f)));
    }

    private static Ent rEnt(DataInputStream in, Ent e) throws IOException {
        e.type = in.readByte(); e.kind = in.readByte(); e.nid = in.readShort();
        e.tx = in.readShort() / 4f; e.ty = in.readShort() / 4f; e.th = in.readShort() / 4f;
        int fl = in.readUnsignedByte();
        e.face = (fl & 1) != 0 ? 1 : -1; e.dying = (fl & 2) != 0; e.guardUp = (fl & 4) != 0; e.friendly = (fl & 8) != 0;
        e.tall = (fl & 16) != 0; e.arc = (fl & 32) != 0; e.thrown = (fl & 64) != 0; e.invul = (fl & 128) != 0;
        e.st = in.readByte();
        e.hp = in.readShort() / 4f; e.maxHp = in.readShort() / 4f;
        e.t = in.readShort() / 100f;
        e.flash = in.readUnsignedByte() / 400f;
        e.walk = in.readShort() / 4f;
        e.shield = in.readShort() / 4f;
        e.confT = in.readUnsignedByte() / 40f;
        e.life = in.readShort() / 100f;
        e.w = in.readUnsignedByte();
        e.inv = in.readUnsignedByte() / 40f;
        return e;
    }

    static byte[] write(Game g, Relay relay) {
        try {
            g.sync();
            ByteArrayOutputStream bo = new ByteArrayOutputStream(2048);
            DataOutputStream o = new DataOutputStream(bo);
            o.writeByte(M_SNAP);
            o.writeByte(g.stageIdx); o.writeByte(g.segIdx); o.writeByte(g.result); o.writeByte(g.np);
            o.writeInt(g.score);
            o.writeFloat(g.camX); o.writeFloat(g.shake); o.writeFloat(g.punch);
            o.writeShort(g.combo); o.writeFloat(g.comboTimer);
            o.writeFloat(g.radioT); o.writeUTF(g.radioT > 0 && g.radio != null ? g.radio : "");
            o.writeFloat(g.goT);
            o.writeShort(g.ents.indexOf(g.bossRef));
            for (int i = 0; i < g.np; i++) {
                Game.PS q = g.ps[i];
                o.writeByte(q.hero); o.writeFloat(q.meter);
                o.writeByte((q.mounted ? 1 : 0) | (q.cloroImmune ? 2 : 0) | (q.charged ? 4 : 0));
                o.writeByte(q.weapon); o.writeByte(q.wUses);
                o.writeFloat(q.coffeeT); o.writeFloat(q.penT); o.writeFloat(q.blurT); o.writeFloat(q.slowT); o.writeFloat(q.rootT);
                o.writeFloat(q.jx); o.writeFloat(q.jy);
                o.writeByte(q.spK); o.writeFloat(q.spDur); o.writeByte(q.comboStep);
                wEnt(o, g, q.p);
                o.writeFloat(q.p.aux);
            }
            ArrayList<Ent> list = g.ents;
            int n = Math.min(list.size(), 120);
            o.writeShort(n);
            for (int i = 0; i < n; i++) wEnt(o, g, list.get(i));
            n = Math.min(g.pops.size(), 12);
            o.writeByte(n);
            for (int i = 0; i < n; i++) {
                Game.Pop p = g.pops.get(i);
                o.writeUTF(p.s); o.writeShort(q4(p.x)); o.writeShort(q4(p.y)); o.writeShort(q100(p.t)); o.writeShort(q100(p.life)); o.writeInt(p.color);
            }
            n = Math.min(g.fxs.size(), 40);
            o.writeByte(n);
            for (int i = 0; i < n; i++) {
                Game.Fx f = g.fxs.get(i);
                o.writeByte(f.kind); o.writeShort(q4(f.x)); o.writeShort(q4(f.y)); o.writeShort(q4(f.h)); o.writeShort(q100(f.t));
                o.writeShort(q100(f.life)); o.writeShort(q4(f.r)); o.writeInt(f.color); o.writeShort(q4(f.x2)); o.writeShort(q4(f.y2));
            }
            int ne = relay == null ? 0 : relay.ev.size();
            o.writeByte(ne);
            for (int i = 0; i < ne; i++) o.writeUTF(relay.ev.get(i));
            if (relay != null) relay.ev.clear();
            return bo.toByteArray();
        } catch (IOException e) { return new byte[]{M_SNAP}; }
    }

    private static final HashMap<Integer, Ent> OLD = new HashMap<>();

    /** Lê um snapshot no jogo-espelho. Os sons/falas recebidos são tocados em L. */
    static void read(Game g, byte[] m, Game.Listener L) {
        try {
            DataInputStream in = new DataInputStream(new java.io.ByteArrayInputStream(m));
            in.readByte();
            int stage = in.readUnsignedByte();
            if (g.stage == null || g.stageIdx != stage) { g.stageIdx = stage; g.stage = Data.STAGES.get(stage); }
            g.segIdx = in.readUnsignedByte(); g.result = in.readUnsignedByte(); g.np = in.readUnsignedByte();
            g.score = in.readInt();
            g.camTx = in.readFloat(); if (g.camTx < g.camX - 300 || g.camX == 0) g.camX = g.camTx; g.shake = in.readFloat(); g.punch = in.readFloat();
            g.combo = in.readShort(); g.comboTimer = in.readFloat();
            g.radioT = in.readFloat(); g.radio = in.readUTF();
            g.goT = in.readFloat();
            int boss = in.readShort();
            OLD.clear();
            for (Ent e : g.ents) OLD.put(e.nid, e);
            for (int i = 0; i < g.np; i++) {
                Game.PS q = g.ps[i];
                q.hero = in.readUnsignedByte(); q.meter = in.readFloat();
                int fl = in.readUnsignedByte(); q.mounted = (fl & 1) != 0; q.cloroImmune = (fl & 2) != 0; q.charged = (fl & 4) != 0;
                q.weapon = in.readByte(); q.wUses = in.readUnsignedByte();
                q.coffeeT = in.readFloat(); q.penT = in.readFloat(); q.blurT = in.readFloat(); q.slowT = in.readFloat(); q.rootT = in.readFloat();
                q.jx = in.readFloat(); q.jy = in.readFloat();
                q.spK = in.readUnsignedByte(); q.spDur = in.readFloat(); q.comboStep = in.readUnsignedByte();
                if (q.p == null) { q.p = new Ent(); q.p.x = Float.NaN; }
                rEnt(in, q.p);
                q.p.aux = in.readFloat();
                place(q.p);
            }
            int n = in.readUnsignedShort();
            ArrayList<Ent> fresh = new ArrayList<>(n);
            for (int i = 0; i < n; i++) {
                // lê o id antes de decidir qual objeto reaproveitar
                in.mark(8);
                in.readByte(); in.readByte(); int id = in.readShort();
                in.reset();
                Ent e = OLD.get(id);
                if (e == null) { e = new Ent(); e.x = Float.NaN; }
                rEnt(in, e);
                place(e);
                fresh.add(e);
            }
            g.ents.clear(); g.ents.addAll(fresh);
            g.bossRef = boss >= 0 && boss < fresh.size() ? fresh.get(boss) : null;
            n = in.readUnsignedByte();
            g.pops.clear();
            for (int i = 0; i < n; i++) {
                String s = in.readUTF(); float x = in.readShort() / 4f, y = in.readShort() / 4f, t = in.readShort() / 100f, life = in.readShort() / 100f;
                Game.Pop p = new Game.Pop(s, x, y, life, in.readInt()); p.t = t; g.pops.add(p);
            }
            n = in.readUnsignedByte();
            g.fxs.clear();
            for (int i = 0; i < n; i++) {
                int kind = in.readUnsignedByte(); float x = in.readShort() / 4f, y = in.readShort() / 4f, h = in.readShort() / 4f, t = in.readShort() / 100f;
                float life = in.readShort() / 100f, r = in.readShort() / 4f; int col = in.readInt();
                Game.Fx f = new Game.Fx(kind, x, y, h, life, r, col); f.t = t; f.x2 = in.readShort() / 4f; f.y2 = in.readShort() / 4f; g.fxs.add(f);
            }
            n = in.readUnsignedByte();
            for (int i = 0; i < n; i++) {
                String s = in.readUTF();
                if (s.charAt(0) == 's') { try { L.sfx(Integer.parseInt(s.substring(1))); } catch (NumberFormatException ignored) { } }
                else if (s.charAt(0) == 'v') L.voice(s.substring(1));
            }
        } catch (IOException | RuntimeException ignored) { }
    }

    /** Define o alvo de posição; objetos novos aparecem direto no lugar. */
    private static void place(Ent e) {
        if (Float.isNaN(e.x)) { e.x = e.tx; e.y = e.ty; e.h = e.th; }
    }

    /** Suaviza as posições entre dois snapshots e avança relógios locais dos efeitos. */
    static void smooth(Game g, float dt) {
        float k = Math.min(1f, 22f * dt);
        for (int i = 0; i < g.np; i++) lerp(g.ps[i].p, k);
        for (Ent e : g.ents) lerp(e, k);
        g.time += dt;
        g.camX += (g.camTx - g.camX) * k;
        for (Game.Fx f : g.fxs) f.t += dt;
        for (Game.Pop p : g.pops) { p.t += dt; p.y -= 22 * dt; }
    }

    private static void lerp(Ent e, float k) {
        if (Math.abs(e.tx - e.x) > 160) e.x = e.tx; else e.x += (e.tx - e.x) * k;
        e.y += (e.ty - e.y) * k;
        e.h += (e.th - e.h) * k;
    }
}
