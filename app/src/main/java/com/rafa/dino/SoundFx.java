package com.rafa.dino;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

/** Sons curtos gerados por código (ondas quadradas, estilo 8 bits). */
public class SoundFx {

    private static final int RATE = 22050;

    private final AudioTrack jump = build(new float[][]{{380, 0.07f}, {560, 0.07f}, {760, 0.06f}});
    private final AudioTrack die = build(new float[][]{{440, 0.10f}, {330, 0.10f}, {220, 0.12f}, {140, 0.22f}});

    public void playJump() {
        play(jump);
    }

    public void playDie() {
        play(die);
    }

    public void release() {
        jump.release();
        die.release();
    }

    private static void play(AudioTrack t) {
        try {
            t.stop();
            t.reloadStaticData();
            t.play();
        } catch (Exception ignored) {
        }
    }

    /** Cada nota = {frequência em Hz, duração em segundos}. */
    private static AudioTrack build(float[][] notes) {
        int total = 0;
        for (float[] n : notes) total += (int) (n[1] * RATE);
        short[] pcm = new short[total];
        int pos = 0;
        for (float[] n : notes) {
            int len = (int) (n[1] * RATE);
            double period = RATE / n[0];
            for (int i = 0; i < len; i++) {
                double env = 1.0 - (double) i / len * 0.6; // some um pouco
                short v = (short) (((i % period) < period / 2 ? 1 : -1) * 9000 * env);
                pcm[pos++] = v;
            }
        }
        AudioTrack t = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build())
                .setAudioFormat(new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build())
                .setBufferSizeInBytes(pcm.length * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build();
        t.write(pcm, 0, pcm.length);
        return t;
    }
}
