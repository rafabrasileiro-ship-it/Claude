package com.rafa.patriota;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.MediaPlayer;

import java.util.Locale;
import java.util.Random;

/** Efeitos sonoros e música gerados por código + voz por síntese (TTS) quando disponível. */
final class Sfx implements Game.Listener {
    private static final int RATE = 22050;
    private final AudioTrack[] fx = new AudioTrack[11];
    private AudioTrack musicBattle, musicTriumph;
    private AudioTrack currentMusic;
    private Context ctx;
    private MediaPlayer mp, mpAmb, mpStage;
    /** frase -> nome do arquivo em res/raw (sem extensão). Se o arquivo existir, toca a gravação. */
    private static final java.util.HashMap<String, String> CLIPS = new java.util.HashMap<>();
    static {
        CLIPS.put("E daí? Lamento, quer que eu faça o quê?", "voz_inicio");
        CLIPS.put("Tem que se fuder, porra!", "voz_combo");
        CLIPS.put("Acabou, porra!", "voz_acabou");
        CLIPS.put("Imbroxável!", "voz_imbroxavel");
        CLIPS.put("Isso aqui é uma maravilha, pô!", "voz_maravilha");
        CLIPS.put("O Brasil acabou!", "voz_lula_brasil_acabou");
        CLIPS.put("A maioria ali é militante.", "voz_maioria_militante");
        CLIPS.put("Jacaré!", "voz_jacare");
        CLIPS.put("Para de mentir, Lula!", "voz_para_de_mentir");
        CLIPS.put("Hahahaha!", "voz_risada");
        CLIPS.put("Bora pra rua, gente!", "voz_lula_bora_pra_rua");
        CLIPS.put("Boa noite.", "voz_boa_noite");
        CLIPS.put("Um forte abraço!", "voz_forte_abraco");
        CLIPS.put("Cara sem dente!", "voz_lula_cara_sem_dente");
        CLIPS.put("Por favor, me ajuda!", "voz_lula_me_ajuda");
        CLIPS.put("Se prepare!", "voz_lula_se_prepare");
        CLIPS.put("Lula!", "voz_lula_grito_1,voz_lula_grito_2,voz_lula_nome_1,voz_lula_nome_2,voz_lula_nome_3,voz_lula_nome_4");
        CLIPS.put("É Lula!", "voz_lula_e_lula_final");
        CLIPS.put("O maior presidente da história do Brasil!", "voz_lula_maior_presidente_1,voz_lula_maior_presidente_2");
        CLIPS.put("É Lula, é Lula!", "voz_lula_e_lula");
        CLIPS.put("Agora é Lula!", "voz_lula_agora_e_lula");
        CLIPS.put("(Mula sobre a fome)", "voz_lula_fome");
        CLIPS.put("(Mula no alto-falante)", "voz_lula_game");
        CLIPS.put("Filho da puta!", "voz_filho_da_puta_1,voz_filho_da_puta_2");
        CLIPS.put("Vagabundo!", "voz_vagabundo");
        CLIPS.put("Escrota!", "voz_escrota");
        CLIPS.put("Fudido!", "voz_fudido");
        CLIPS.put("Não tem credibilidade!", "voz_nao_tem_credibilidade");
        CLIPS.put("Canalhas!", "voz_canalhas");
        CLIPS.put("São uns idiotas úteis!", "voz_idiotas_uteis");
        CLIPS.put("São vagabundos!", "voz_sao_vagabundos");
        CLIPS.put("Vai pra puta que o pariu, porra!", "voz_vai_pra_puta");
    }
    float sfxVol = 1f, voiceVol = 1f, musicVol = 0.6f;
    private final Random rnd = new Random(7);
    private android.os.Vibrator vib;
    boolean vibrateOn = true;
    private long lastVib;

    Sfx(Context context) {
        this.ctx = context.getApplicationContext();
        final Context ctx = context;
        try { vib = (android.os.Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE); } catch (Exception ignored) { }
        try {
            fx[Game.SFX_HIT] = track(noise(0.07f, 0.9f, 220));
            fx[Game.SFX_HEAVY] = track(thump(0.2f));
            fx[Game.SFX_JUMP] = track(sweep(0.16f, 300, 640, 0.5f));
            fx[Game.SFX_HURT] = track(sweep(0.18f, 260, 120, 0.7f));
            fx[Game.SFX_SPECIAL] = track(sweep(0.55f, 160, 900, 0.6f));
            fx[Game.SFX_ITEM] = track(arp(new float[]{660, 990}, 0.07f));
            fx[Game.SFX_BREAK] = track(noise(0.22f, 1f, 90));
            fx[Game.SFX_ROAR] = track(roar(0.8f));
            fx[Game.SFX_WIN] = track(arp(new float[]{523, 659, 784, 1047, 784, 1047}, 0.13f));
            fx[Game.SFX_LOSE] = track(arp(new float[]{330, 294, 262, 196}, 0.2f));
            fx[Game.SFX_THROW] = track(noise(0.09f, 0.4f, 700));
            musicBattle = loop(song(true));
            musicTriumph = loop(song(false));
        } catch (Throwable ignored) { }
    }

    // ---------------------------------------------------------------- API
    @Override public void sfx(int id) {
        if (sfxVol <= 0 || id < 0 || id >= fx.length || fx[id] == null) return;
        try {
            AudioTrack t = fx[id];
            t.setVolume(sfxVol);
            t.stop();
            t.setPlaybackHeadPosition(0);
            t.play();
        } catch (Throwable ignored) { }
    }

    @Override public void voice(String line) {
        if (voiceVol <= 0) return;
        playClip(line);
    }

    @Override public boolean hasClip(String line) {
        String name = CLIPS.get(line);
        if (name == null) return false;
        try {
            for (String n : name.split(",")) if (ctx.getResources().getIdentifier(n, "raw", ctx.getPackageName()) == 0) return false;
            return true;
        } catch (Throwable t) { return false; }
    }

    private boolean playClip(String line) {
        String name = CLIPS.get(line);
        if (name == null) return false;
        if (name.indexOf(',') >= 0) { String[] opts = name.split(","); name = opts[rnd.nextInt(opts.length)]; }
        try {
            int id = ctx.getResources().getIdentifier(name, "raw", ctx.getPackageName());
            if (id == 0) return false;
            final boolean amb = name.startsWith("voz_lula");
            MediaPlayer oldP = amb ? mpAmb : mp;
            if (oldP != null) { try { oldP.release(); } catch (Throwable ignored) { } }
            MediaPlayer m = MediaPlayer.create(ctx, id);
            if (amb) mpAmb = m; else mp = m;
            if (m == null) return false;
            float v = amb ? voiceVol * 0.8f : voiceVol;
            m.setVolume(v, v);
            m.setOnCompletionListener(x -> { try { x.release(); } catch (Throwable ignored) { } if (mp == x) mp = null; if (mpAmb == x) mpAmb = null; });
            m.start();
            return true;
        } catch (Throwable t) { return false; }
    }

    @Override public void vibrate(int ms) {
        if (!vibrateOn || vib == null) return;
        long now = System.currentTimeMillis();
        if (now - lastVib < 80) return;
        lastVib = now;
        try { vib.vibrate(ms); } catch (Throwable ignored) { }
    }

    /** Música de fundo de uma fase (arquivo em loop, volume mais baixo para as falas aparecerem). */
    boolean stageMusic(String resName) {
        stopStageMusic();
        try {
            try { if (currentMusic != null) currentMusic.pause(); } catch (Throwable ignored) { }
            currentMusic = null;
            int id = ctx.getResources().getIdentifier(resName, "raw", ctx.getPackageName());
            if (id == 0) return false;
            MediaPlayer m = MediaPlayer.create(ctx, id);
            if (m == null) return false;
            m.setLooping(true);
            float v = Math.min(1f, musicVol * 0.45f);
            m.setVolume(v, v);
            if (musicVol > 0) m.start();
            mpStage = m;
            return true;
        } catch (Throwable t) { return false; }
    }

    private void stopStageMusic() {
        if (mpStage != null) { try { mpStage.release(); } catch (Throwable ignored) { } mpStage = null; }
    }

    void music(int which) { // 0 nada, 1 batalha, 2 triunfo
        stopStageMusic();
        AudioTrack want = which == 1 ? musicBattle : which == 2 ? musicTriumph : null;
        if (want == currentMusic && want != null) { try { want.setVolume(musicVol); } catch (Throwable ignored) { } return; }
        try { if (currentMusic != null) { currentMusic.pause(); } } catch (Throwable ignored) { }
        currentMusic = want;
        if (want != null && musicVol > 0) {
            try { want.setVolume(musicVol); want.play(); } catch (Throwable ignored) { }
        }
    }

    void pauseAll() {
        try { if (currentMusic != null) currentMusic.pause(); } catch (Throwable ignored) { }
        try { if (mp != null) mp.pause(); } catch (Throwable ignored) { }
        try { if (mpAmb != null) mpAmb.pause(); } catch (Throwable ignored) { }
        try { if (mpStage != null) mpStage.pause(); } catch (Throwable ignored) { }
    }

    void resumeAll() {
        try { if (mpStage != null && musicVol > 0) mpStage.start(); } catch (Throwable ignored) { }
        try { if (currentMusic != null && musicVol > 0) { currentMusic.setVolume(musicVol); currentMusic.play(); } } catch (Throwable ignored) { }
    }

    void setMusicVol(float v) {
        musicVol = v;
        try { if (mpStage != null) { mpStage.setVolume(Math.min(1f, v * 0.45f), Math.min(1f, v * 0.45f)); if (v <= 0) mpStage.pause(); else mpStage.start(); } } catch (Throwable ignored) { }
        try {
            if (currentMusic != null) { currentMusic.setVolume(v); if (v <= 0) currentMusic.pause(); else currentMusic.play(); }
        } catch (Throwable ignored) { }
    }

    void release() {
        try { for (AudioTrack t : fx) if (t != null) t.release(); } catch (Throwable ignored) { }
        try { if (musicBattle != null) musicBattle.release(); if (musicTriumph != null) musicTriumph.release(); } catch (Throwable ignored) { }
        try { if (mp != null) mp.release(); } catch (Throwable ignored) { }
        try { if (mpAmb != null) mpAmb.release(); } catch (Throwable ignored) { }
        stopStageMusic();
    }

    // ---------------------------------------------------------------- síntese
    private AudioTrack track(short[] pcm) {
        AudioTrack t = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                .setBufferSizeInBytes(pcm.length * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build();
        t.write(pcm, 0, pcm.length);
        return t;
    }

    private AudioTrack loop(short[] pcm) {
        AudioTrack t = track(pcm);
        t.setLoopPoints(0, pcm.length, -1);
        return t;
    }

    private short[] noise(float sec, float amp, float tone) {
        int n = (int) (sec * RATE);
        short[] s = new short[n];
        for (int i = 0; i < n; i++) {
            float env = 1f - (float) i / n;
            float v = (rnd.nextFloat() * 2 - 1) * 0.7f + (float) Math.sin(2 * Math.PI * tone * i / RATE) * 0.6f;
            s[i] = (short) (v * env * env * amp * 11000);
        }
        return s;
    }

    private short[] thump(float sec) {
        int n = (int) (sec * RATE);
        short[] s = new short[n];
        double ph = 0;
        for (int i = 0; i < n; i++) {
            float f = 110 - 70f * i / n;
            ph += 2 * Math.PI * f / RATE;
            float env = 1f - (float) i / n;
            float v = (float) Math.sin(ph) * 0.8f + (rnd.nextFloat() * 2 - 1) * 0.3f * env;
            s[i] = (short) (v * env * 14000);
        }
        return s;
    }

    private short[] sweep(float sec, float f0, float f1, float amp) {
        int n = (int) (sec * RATE);
        short[] s = new short[n];
        double ph = 0;
        for (int i = 0; i < n; i++) {
            float f = f0 + (f1 - f0) * i / n;
            ph += 2 * Math.PI * f / RATE;
            float env = 1f - 0.8f * i / n;
            s[i] = (short) ((Math.sin(ph) > 0 ? 1 : -1) * 7000 * amp * env);
        }
        return s;
    }

    private short[] arp(float[] notes, float each) {
        int per = (int) (each * RATE);
        short[] s = new short[per * notes.length];
        for (int k = 0; k < notes.length; k++) {
            double period = RATE / notes[k];
            for (int i = 0; i < per; i++) {
                float env = 1f - 0.7f * i / per;
                s[k * per + i] = (short) (((i % period) < period / 2 ? 1 : -1) * 7500 * env);
            }
        }
        return s;
    }

    private short[] roar(float sec) {
        int n = (int) (sec * RATE);
        short[] s = new short[n];
        double ph = 0;
        for (int i = 0; i < n; i++) {
            float t = (float) i / n;
            float f = 70 + (float) Math.sin(t * 40) * 18 + 30 * (1 - t);
            ph += 2 * Math.PI * f / RATE;
            float saw = (float) ((ph / (2 * Math.PI)) % 1.0) * 2 - 1;
            float env = (float) Math.sin(Math.PI * Math.min(1f, t * 1.2f));
            s[i] = (short) ((saw * 0.6f + (rnd.nextFloat() * 2 - 1) * 0.5f) * env * 12000);
        }
        return s;
    }

    /** Trilha 8 bits: batalha (menor, rápida) ou triunfo (maior). */
    private short[] song(boolean battle) {
        float bpm = battle ? 150 : 128;
        int step = (int) (RATE * 60f / bpm / 2f); // colcheia
        float[] root = battle ? new float[]{110f, 110f, 130.8f, 110f, 98f, 98f, 82.4f, 98f}
                : new float[]{130.8f, 130.8f, 164.8f, 130.8f, 196f, 196f, 174.6f, 196f};
        float[] lead = battle
                ? new float[]{440, 0, 523, 440, 659, 0, 587, 523, 392, 0, 494, 392, 587, 0, 523, 494}
                : new float[]{523, 659, 784, 659, 1047, 0, 784, 0, 698, 880, 1047, 880, 784, 0, 659, 0};
        int steps = 16;
        short[] s = new short[step * steps];
        for (int k = 0; k < steps; k++) {
            float bf = root[k / 2] * (k % 2 == 1 ? 2f : 1f);
            float lf = lead[k];
            for (int i = 0; i < step; i++) {
                int idx = k * step + i;
                float env = 1f - 0.6f * i / step;
                float v = 0;
                double bp = RATE / bf;
                v += ((idx % bp) < bp / 2 ? 1 : -1) * 0.5f * (battle ? 1f : 0.8f);
                if (lf > 0) { double lp = RATE / lf; v += ((idx % lp) < lp * 0.25 ? 1 : -1) * 0.28f * env; }
                if (k % 2 == 0 && i < step / 6) v += (rnd.nextFloat() * 2 - 1) * 0.5f * (1f - (float) i / (step / 6f)); // bumbo/caixa
                s[idx] = (short) (v * 4200);
            }
        }
        return s;
    }
}
