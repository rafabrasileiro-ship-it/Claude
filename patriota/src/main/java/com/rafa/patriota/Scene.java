package com.rafa.patriota;

import android.graphics.Canvas;
import android.graphics.Paint;

/** Cenários em camadas (parallax) feitos de polígonos chapados. */
final class Scene {
    private Scene() {}

    static final float FLOOR_TOP = 255f;

    private static float off(float cam, float f, float tile) { return -((cam * f) % tile); }

    private static void floor(Canvas c, float cam, int col, int line, int edge) {
        Draw.rect(c, col, 0, FLOOR_TOP, 800, 450);
        Draw.rect(c, edge, 0, FLOOR_TOP, 800, FLOOR_TOP + 7);
        float o = off(cam, 1f, 90);
        for (int i = -1; i < 11; i++) {
            float x0 = o + i * 90;
            Draw.line(c, line, x0, FLOOR_TOP + 7, x0 + (x0 - 400) * 0.55f, 450, 1.5f);
        }
        Draw.line(c, line, 0, 330, 800, 330, 1.2f);
        Draw.line(c, line, 0, 390, 800, 390, 1.2f);
        if (Draw.q >= 1) { // fundo do piso mais escuro (profundidade)
            for (int i = 0; i < 6; i++) Draw.rect(c, ((0x42 - i * 0x0B) << 24), 0, FLOOR_TOP + 7 + i * 16, 800, FLOOR_TOP + 23 + i * 16);
        }
        texture(c, cam);
    }

    private static final int NT = 260;
    private static final float[] TX = new float[NT], TY = new float[NT], TS = new float[NT];
    static {
        java.util.Random r = new java.util.Random(11);
        for (int i = 0; i < NT; i++) { TX[i] = r.nextFloat() * 900; TY[i] = r.nextFloat(); TS[i] = r.nextFloat(); }
    }
    private static int texTheme;

    /** Textura procedural do piso (granulado, grama, madeira, mármore...). */
    private static void texture(Canvas c, float cam) {
        if (Draw.q < 2) return;
        float scroll = cam % 900;
        int th = texTheme;
        for (int i = 0; i < NT; i++) {
            float x = TX[i] - scroll; if (x < -40) x += 900; if (x > 820) continue;
            float depth = TY[i];
            float y = FLOOR_TOP + 10 + depth * (450 - FLOOR_TOP - 12);
            float k = 0.4f + depth * 1.1f;
            switch (th) {
                case Data.TH_CAMPUS: // grama
                    Draw.line(c, TS[i] > 0.5f ? 0x553E8E41 : 0x5586C36A, x, y, x + 2 * k, y - 6 * k, 1.3f);
                    break;
                case Data.TH_NOVELA: case Data.TH_BBB: // veios de madeira
                    Draw.line(c, 0x30000000, x, y, x + (30 + TS[i] * 50) * k, y, 1.1f);
                    break;
                case Data.TH_TRIBUNAL: // mármore
                    if (TS[i] > 0.6f) Draw.line(c, 0x30909090, x, y, x + 26 * k, y + 5 * k, 1f);
                    else Draw.rect(c, 0x18FFFFFF, x, y, x + 3 * k, y + 2 * k);
                    break;
                case Data.TH_PALCO: case Data.TH_JORNAL: // piso brilhante/reflexo
                    if (TS[i] > 0.7f) Draw.rect(c, 0x16FFFFFF, x, y, x + 2 * k, y + 22 * k);
                    else Draw.rect(c, 0x14000000, x, y, x + 3 * k, y + 2 * k);
                    break;
                default: // asfalto/concreto
                    Draw.rect(c, TS[i] > 0.5f ? 0x30000000 : 0x1EFFFFFF, x, y, x + (1 + TS[i] * 3) * k, y + (1 + TS[i] * 2) * k);
            }
        }
    }

    /** Pós-processamento: tom de cor do cenário e vinheta. */
    static void post(Canvas c, int theme) {
        if (theme == Data.TH_FAZENDA) embers(c, Draw.time, dusk);
        if (Draw.q < 2) return;
        int tint;
        switch (theme) {
            case Data.TH_PORTAO: tint = 0x1CFF8A3D; break;
            case Data.TH_QUARENT: tint = 0x14A5C8E0; break;
            case Data.TH_PALCO: tint = 0x18401080; break;
            case Data.TH_NOVELA: tint = 0x14FFC070; break;
            case Data.TH_TRIBUNAL: tint = 0x10FFF2D0; break;
            case Data.TH_FAZENDA: tint = ((int) (12 + 30 * dusk) << 24) | (l3(0xFFFFE8B0, 0xFFFF7A30, 0xFF1A1030, dusk) & 0xFFFFFF); break;
            default: tint = 0x0CFFE8B0;
        }
        float sw = R3.vw, sh = R3.vh;
        Draw.rect(c, tint, 0, 0, sw, sh);
        // vinheta: escurece de leve o topo e a base
        for (int i = 0; i < 6; i++) {
            Draw.rect(c, 0x07000000, 0, 0, sw, 36 - i * 6);
            Draw.rect(c, 0x07000000, 0, sh - 36 + i * 6, sw, sh);
        }
        Draw.P.setStyle(Paint.Style.FILL);
    }

    private static void skyline(Canvas c, float cam, int col, int win, boolean lite, float f, int seed) {
        float o = off(cam, f, 400);
        for (int i = -1; i < 11; i++) {
            float bx = o + i * 80;
            int idx = (((i % 5) + 5) + seed) % 5;
            float bh = 70 + idx * 26;
            Draw.rect(c, col, bx, FLOOR_TOP - bh, bx + 76, FLOOR_TOP);
            if (Draw.q >= 1) {
                Draw.rect(c, 0x30000000, bx + 52, FLOOR_TOP - bh, bx + 76, FLOOR_TOP);
                Draw.rect(c, 0x26FFFFFF, bx, FLOOR_TOP - bh, bx + 76, FLOOR_TOP - bh + 4);
                Draw.rect(c, 0x22000000, bx, FLOOR_TOP - 40, bx + 76, FLOOR_TOP);
            }
            if (!lite) {
                for (int wy = 0; wy < bh - 14; wy += 16)
                    for (int wx = 8; wx < 70; wx += 16)
                        Draw.rect(c, ((wx + wy + idx) % 3 == 0) ? win : Draw.shade(col, 0.08f), bx + wx, FLOOR_TOP - bh + 8 + wy, bx + wx + 7, FLOOR_TOP - bh + 14 + wy);
            }
        }
        if (Draw.q >= 1) { // neblina atmosférica: camadas distantes ficam mais claras
            int a = (int) (Math.max(0f, 0.55f - f) * 200);
            Draw.rect(c, (a << 24) | 0xC8DCEB, 0, FLOOR_TOP - 190, 800, FLOOR_TOP);
        }
    }

    static void bg(Canvas c, int theme, float cam, float time, boolean lite) {
        texTheme = theme;
        switch (theme) {
            case Data.TH_PAULISTA: paulista(c, cam, time, lite); break;
            case Data.TH_QUARENT: quarentena(c, cam, time, lite); break;
            case Data.TH_CAMPUS: campus(c, cam, time, lite); break;
            case Data.TH_PORTAO: portao(c, cam, time, lite); break;
            case Data.TH_NOVELA: novela(c, cam, time, lite); break;
            case Data.TH_PALCO: palco(c, cam, time, lite); break;
            case Data.TH_BBB: bbb(c, cam, time, lite); break;
            case Data.TH_JORNAL: jornal(c, cam, time, lite); break;
            case Data.TH_FAZENDA: fazenda(c, cam, time, lite); break;
            default: tribunal(c, cam, time, lite); break;
        }
    }

    // ---------------------------------------------------------------- 1. Paulista
    private static void paulista(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF5E9FD6, 0xFFD2EAF8);
        skyline(c, cam, 0xFF6C8AA6, 0xFFE3F2FD, lite, 0.2f, 0);
        skyline(c, cam, 0xFF566F8A, 0xFFFFF59D, lite, 0.35f, 2);
        // MASP: caixa vermelha suspensa
        float o = off(cam, 0.55f, 1400);
        for (int k = 0; k < 2; k++) {
            float x0 = o + k * 1400;
            if (x0 > 820 || x0 < -1000) continue;
            Draw.rect(c, 0xFFD32F2F, x0 + 120, 120, x0 + 720, 176);
            Draw.rect(c, 0xFFB71C1C, x0 + 120, 170, x0 + 720, 176);
            Draw.rect(c, 0xFFD32F2F, x0 + 150, 176, x0 + 172, FLOOR_TOP);
            Draw.rect(c, 0xFFD32F2F, x0 + 668, 176, x0 + 690, FLOOR_TOP);
            Draw.rect(c, 0x558FC7E8, x0 + 172, 190, x0 + 668, FLOOR_TOP);
            Draw.text(c, "MASP", x0 + 420, 160, 26, 0xFFFFFFFF, Paint.Align.CENTER);
        }
        // árvores
        float o2 = off(cam, 0.8f, 500);
        for (int i = -1; i < 3; i++) {
            float x = o2 + i * 500 + 120;
            Draw.rect(c, 0xFF6D4C41, x - 4, 205, x + 4, FLOOR_TOP);
            Draw.poly(c, 0xFF388E3C, x - 28, 215, x, 150, x + 28, 215);
            Draw.poly(c, 0xFF2E7D32, x - 22, 235, x, 180, x + 22, 235);
        }
        floor(c, cam, 0xFF4B4B50, 0xFF5F5F66, 0xFF9E9E9E);
        float od = off(cam, 1f, 160);
        for (int i = -1; i < 7; i++) Draw.rect(c, 0xFFFFD600, od + i * 160, 372, od + i * 160 + 70, 378);
    }

    // ---------------------------------------------------------------- 2. Quarentena
    private static void quarentena(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF9FB4C4, 0xFFDCE6EC);
        skyline(c, cam, 0xFF8FA3B3, 0xFFFFFFFF, lite, 0.2f, 1);
        skyline(c, cam, 0xFF73869A, 0xFFE0F7FA, lite, 0.35f, 3);
        float o = off(cam, 0.7f, 300);
        for (int i = -1; i < 4; i++) {
            float x = o + i * 300;
            Draw.rect(c, 0xFF37474F, x, 175, x + 6, FLOOR_TOP);
            // fita zebrada
            for (int s = 0; s < 10; s++) {
                float x0 = x + 6 + s * 29.4f;
                Draw.poly(c, s % 2 == 0 ? 0xFFFFD600 : 0xFF212121, x0, 182, x0 + 14.7f, 182, x0 + 14.7f, 196, x0, 196);
            }
            // barreira de acrílico
            Draw.rect(c, 0x5590CAF9, x + 90, 195, x + 190, FLOOR_TOP);
            Draw.rect(c, 0xAA90CAF9, x + 90, 195, x + 190, 199);
            Draw.rect(c, 0xFF37474F, x + 87, 195, x + 91, FLOOR_TOP);
            Draw.rect(c, 0xFF37474F, x + 189, 195, x + 193, FLOOR_TOP);
        }
        floor(c, cam, 0xFF5A5F66, 0xFF6F757C, 0xFF9E9E9E);
        float od = off(cam, 1f, 120);
        for (int i = -1; i < 8; i++) {
            float x = od + i * 120;
            Draw.poly(c, (i & 1) == 0 ? 0xFFFFD600 : 0xFF212121, x, FLOOR_TOP, x + 60, FLOOR_TOP, x + 54, FLOOR_TOP + 7, x - 6, FLOOR_TOP + 7);
        }
    }

    // ---------------------------------------------------------------- 3. Campus
    private static void campus(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF6FB6EA, 0xFFD6F0FB);
        Draw.circle(c, 0x33FFF59D, 650, 60, 46);
        Draw.circle(c, 0xFFFFF59D, 650, 60, 30);
        float o = off(cam, 0.5f, 1500);
        for (int k = 0; k < 2; k++) {
            float x0 = o + k * 1500;
            if (x0 > 820 || x0 < -1100) continue;
            Draw.rect(c, 0xFFE8D9B5, x0 + 100, 140, x0 + 800, FLOOR_TOP);
            Draw.poly(c, 0xFFD6C49A, x0 + 80, 140, x0 + 450, 80, x0 + 820, 140);
            Draw.poly(c, 0xFFEFE3C6, x0 + 150, 138, x0 + 450, 92, x0 + 750, 138);
            for (int i = 0; i < 7; i++) Draw.rect(c, 0xFFFFFFFF, x0 + 130 + i * 100, 144, x0 + 154 + i * 100, FLOOR_TOP);
            Draw.rect(c, 0xFF5D4037, x0 + 410, 200, x0 + 490, FLOOR_TOP);
            Draw.text(c, "UFB", x0 + 450, 128, 22, 0xFF6D4C41, Paint.Align.CENTER);
        }
        float o2 = off(cam, 0.8f, 380);
        for (int i = -1; i < 4; i++) {
            float x = o2 + i * 380 + 90;
            Draw.rect(c, 0xFF6D4C41, x - 5, 190, x + 5, FLOOR_TOP);
            Draw.poly(c, 0xFF2E7D32, x - 38, 205, x, 120, x + 38, 205);
            Draw.poly(c, 0xFF388E3C, x - 30, 235, x, 160, x + 30, 235);
        }
        floor(c, cam, 0xFF5BA85A, 0xFF4F9650, 0xFF3E7D3F);
        Draw.poly(c, 0xFFD8C9A0, 300, FLOOR_TOP + 7, 500, FLOOR_TOP + 7, 640, 450, 160, 450);
    }

    // ---------------------------------------------------------------- 3b. Portão
    private static void portao(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, 140, 0xFF3A2160, 0xFFB3506B);
        Draw.grad(c, 0, 140, 800, FLOOR_TOP, 0xFFB3506B, 0xFFFFA566);
        Draw.circle(c, 0xFFFFE082, 560, 215, 40);
        skyline(c, cam, 0xFF3A2A4D, 0xFFFFD54F, lite, 0.25f, 4);
        float o = off(cam, 0.6f, 700);
        for (int k = 0; k < 3; k++) {
            float x0 = o + k * 700;
            if (x0 > 820 || x0 < -400) continue;
            Draw.rect(c, 0xFF8D8D8D, x0 + 60, 110, x0 + 110, FLOOR_TOP);
            Draw.rect(c, 0xFF9E9E9E, x0 + 50, 100, x0 + 120, 118);
            Draw.rect(c, 0xFF8D8D8D, x0 + 400, 110, x0 + 450, FLOOR_TOP);
            Draw.rect(c, 0xFF9E9E9E, x0 + 390, 100, x0 + 460, 118);
            for (int b = 0; b < 12; b++) Draw.rect(c, 0xFF212121, x0 + 118 + b * 23, 130, x0 + 122 + b * 23, FLOOR_TOP);
            Draw.rect(c, 0xFF212121, x0 + 110, 128, x0 + 400, 134);
        }
        // multidão (silhuetas)
        float o2 = off(cam, 0.9f, 240);
        for (int i = -1; i < 5; i++) {
            float x = o2 + i * 240;
            for (int j = 0; j < 4; j++) {
                float bx = x + j * 58 + (i * 7 % 3) * 5;
                float bob = lite ? 0 : (float) Math.sin(time * 3 + j + i) * 2;
                Draw.circle(c, 0xFF1D1428, bx, 222 + bob, 9);
                Draw.rect(c, 0xFF1D1428, bx - 10, 230 + bob, bx + 10, FLOOR_TOP);
            }
        }
        floor(c, cam, 0xFF3C3C44, 0xFF4B4B55, 0xFF6B6B70);
    }

    // ---------------------------------------------------------------- 4.1 Novela
    private static void novela(Canvas c, float cam, float time, boolean lite) {
        Draw.rect(c, 0xFF1F1B2E, 0, 0, 800, 50);
        Draw.grad(c, 0, 50, 800, FLOOR_TOP, 0xFFD6C29E, 0xFFF5E9D0);
        if (!lite) for (int i = 0; i < 9; i++) Draw.circle(c, 0xFFFFF59D, 50 + i * 95 + (cam * 0.1f % 95), 24, 6);
        float o = off(cam, 0.5f, 1000);
        for (int k = 0; k < 2; k++) {
            float x0 = o + k * 1000;
            if (x0 > 820 || x0 < -900) continue;
            Draw.rect(c, 0xFFF5EBD5, x0 + 80, 80, x0 + 880, FLOOR_TOP);
            Draw.poly(c, 0xFFD7C49E, x0 + 60, 80, x0 + 480, 40, x0 + 900, 80);
            for (int i = 0; i < 6; i++) Draw.rect(c, 0xFFFFFFFF, x0 + 110 + i * 150, 90, x0 + 140 + i * 150, FLOOR_TOP);
            for (int i = 0; i < 5; i++) {
                Draw.rect(c, 0xFF5D4037, x0 + 150 + i * 150, 120, x0 + 210 + i * 150, 190);
                Draw.rect(c, 0xFFFFCC80, x0 + 154 + i * 150, 124, x0 + 206 + i * 150, 186);
                Draw.rect(c, 0xFFB71C1C, x0 + 154 + i * 150, 124, x0 + 168 + i * 150, 186);
                Draw.rect(c, 0xFFB71C1C, x0 + 192 + i * 150, 124, x0 + 206 + i * 150, 186);
            }
        }
        // trilho de câmera
        Draw.rect(c, 0xFF212121, 0, 60, 800, 66);
        float cx = 400 + (float) Math.sin(time * 0.7f) * 300;
        Draw.rect(c, 0xFF37474F, cx - 22, 66, cx + 22, 92);
        Draw.circle(c, 0xFF90A4AE, cx + 22, 80, 7);
        Draw.circle(c, 0xFFE53935, cx - 14, 72, 3);
        floor(c, cam, 0xFF8B5A2B, 0xFF6F4720, 0xFF5D3A1A);
    }

    // ---------------------------------------------------------------- 4.2 Palco
    private static void palco(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF0A0516, 0xFF241548);
        // painel de LED
        float o = off(cam, 0.4f, 600);
        for (int k = -1; k < 3; k++) {
            float x0 = o + k * 600;
            for (int i = 0; i < 10; i++) for (int j = 0; j < 4; j++) {
                int ph = (int) (time * 2 + i + j * 3 + k) % 4;
                int col = ph == 0 ? 0xFFE91E63 : ph == 1 ? 0xFF3F51B5 : ph == 2 ? 0xFF00BCD4 : 0xFFFFC107;
                if (lite) col = 0xFF3F51B5;
                Draw.rect(c, col, x0 + i * 60 + 2, 60 + j * 38, x0 + i * 60 + 58, 60 + j * 38 + 34);
            }
        }
        Draw.rect(c, 0xFF0C0618, 0, 0, 800, 50);
        // dançarinos de fundo
        for (int i = 0; i < 9; i++) {
            float x = 40 + i * 92;
            float bob = (float) Math.sin(time * 5 + i) * 5;
            Draw.circle(c, 0xFF0B0616, x, 210 + bob, 9);
            Draw.rect(c, 0xFF0B0616, x - 9, 219 + bob, x + 9, FLOOR_TOP);
            Draw.line(c, 0xFF0B0616, x - 8, 222 + bob, x - 20, 200 + bob + (i % 2) * 14, 4);
            Draw.line(c, 0xFF0B0616, x + 8, 222 + bob, x + 20, 200 + bob - (i % 2) * 14, 4);
        }
        // holofotes
        for (int i = 0; i < 4; i++) {
            float a = (float) Math.sin(time * 0.8f + i * 1.7f) * 120;
            float bx = 100 + i * 200;
            Draw.poly(c, i % 2 == 0 ? 0x33FFF59D : 0x33B388FF, bx - 8, 0, bx + 8, 0, bx + a + 70, FLOOR_TOP, bx + a - 70, FLOOR_TOP);
        }
        floor(c, cam, 0xFF2B1B55, 0xFF42298A, 0xFF8E24AA);
        if (!lite) for (int i = 0; i < 12; i++) Draw.circle(c, 0x88FFFFFF, ((i * 83 + cam * 0.5f) % 800 + 800) % 800, 300 + (i * 37) % 130, 1.8f);
    }

    // ---------------------------------------------------------------- 4.3 BBB
    private static void bbb(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFFB5154F, 0xFFF0508A);
        float o = off(cam, 0.5f, 800);
        for (int k = -1; k < 3; k++) {
            float x0 = o + k * 800;
            Draw.rect(c, 0xFF00BCD4, x0, 40, x0 + 400, FLOOR_TOP);
            // parede acolchoada
            for (int i = 0; i < 8; i++) for (int j = 0; j < 4; j++) {
                Draw.rect(c, ((i + j) & 1) == 0 ? 0xFFF8BBD0 : 0xFFF48FB1, x0 + 410 + i * 48, 60 + j * 48, x0 + 410 + i * 48 + 46, 60 + j * 48 + 46);
                Draw.circle(c, 0xFFAD1457, x0 + 434 + i * 48, 84 + j * 48, 2);
            }
            // olho gigante
            Draw.circle(c, 0xFFFFFFFF, x0 + 200, 130, 60);
            Draw.circle(c, 0xFF3F51B5, x0 + 200 + (float) Math.sin(time) * 14, 130, 30);
            Draw.circle(c, 0xFF000000, x0 + 200 + (float) Math.sin(time) * 14, 130, 14);
        }
        // piscina
        float o2 = off(cam, 0.8f, 700);
        for (int k = -1; k < 3; k++) {
            float x0 = o2 + k * 700;
            Draw.rect(c, 0xFF4FC3F7, x0 + 100, 205, x0 + 500, FLOOR_TOP);
            Draw.rect(c, 0xFFE1F5FE, x0 + 90, 200, x0 + 510, 207);
            if (!lite) for (int i = 0; i < 8; i++) Draw.line(c, 0xAAFFFFFF, x0 + 110 + i * 50, 225 + (i % 2) * 10 + (float) Math.sin(time * 2 + i) * 2, x0 + 135 + i * 50, 225 + (i % 2) * 10, 2);
        }
        floor(c, cam, 0xFFD7B98E, 0xFFBFA073, 0xFF8D6E63);
    }

    // ---------------------------------------------------------------- 4.4 Jornal
    private static void jornal(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF061226, 0xFF17407A);
        // cidade ao fundo (vidro)
        skyline(c, cam, 0xFF18407A, 0xFFFFF59D, lite, 0.2f, 0);
        float o = off(cam, 0.45f, 800);
        for (int k = -1; k < 3; k++) {
            float x0 = o + k * 800;
            Draw.circle(c, 0xFF1565C0, x0 + 400, 110, 56);
            Draw.ring(c, 0xFF90CAF9, x0 + 400, 110, 56, 4);
            Draw.line(c, 0xFF90CAF9, x0 + 344, 110, x0 + 456, 110, 3);
            Draw.line(c, 0xFF90CAF9, x0 + 400, 54, x0 + 400, 166, 3);
            Draw.text(c, "TN", x0 + 400, 124, 36, 0xFFFFFFFF, Paint.Align.CENTER);
            for (int i = 0; i < 4; i++) {
                float mx = x0 + 60 + i * 90;
                Draw.rect(c, 0xFF263238, mx, 185, mx + 70, 235);
                Draw.rect(c, ((int) (time * 1.5f) + i) % 2 == 0 ? 0xFF4FC3F7 : 0xFF81D4FA, mx + 4, 189, mx + 66, 231);
            }
        }
        for (int i = 0; i < 10; i++) Draw.rect(c, 0x2290CAF9, 0, 0, 800, 0);
        float og = off(cam, 0.45f, 200);
        for (int i = -1; i < 6; i++) Draw.rect(c, 0x3390CAF9, og + i * 200, 0, og + i * 200 + 6, FLOOR_TOP);
        floor(c, cam, 0xFF90A4AE, 0xFFB0BEC5, 0xFF607D8B);
    }

    // ---------------------------------------------------------------- 5 Tribunal
    private static void tribunal(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF78B4E6, 0xFFDCEEF9);
        float o = off(cam, 0.5f, 1100);
        for (int k = -1; k < 2; k++) {
            float x0 = o + k * 1100;
            Draw.rect(c, 0xFFF3F3F3, x0 + 20, 70, x0 + 1080, FLOOR_TOP);
            Draw.rect(c, 0xFFE0E0E0, x0 + 0, 60, x0 + 1100, 86);
            Draw.poly(c, 0xFFEDEDED, x0 + 0, 60, x0 + 550, 10, x0 + 1100, 60);
            for (int i = 0; i < 9; i++) {
                Draw.rect(c, 0xFFFFFFFF, x0 + 50 + i * 120, 86, x0 + 92 + i * 120, FLOOR_TOP);
                Draw.rect(c, 0xFFD0D0D0, x0 + 82 + i * 120, 86, x0 + 92 + i * 120, FLOOR_TOP);
            }
            Draw.text(c, "SUBLIME TRIBUNAL NACIONAL", x0 + 550, 52, 22, 0xFF6D6D6D, Paint.Align.CENTER);
        }
        // bandeiras
        float o2 = off(cam, 0.75f, 550);
        for (int i = -1; i < 3; i++) {
            float x = o2 + i * 550 + 60;
            Draw.rect(c, 0xFF8D6E63, x, 130, x + 4, FLOOR_TOP);
            float w = lite ? 0 : (float) Math.sin(time * 4 + i) * 3;
            Draw.poly(c, 0xFF1B8F3A, x + 4, 134, x + 50, 134 + w, x + 50, 170 + w, x + 4, 170);
            Draw.poly(c, 0xFFFFD400, x + 27, 138, x + 44, 152 + w, x + 27, 166, x + 10, 152);
        }
        floor(c, cam, 0xFFDCD3C3, 0xFFC4BAA6, 0xFFB0A590);
    }

    // ---------------------------------------------------------------- Fazenda invadida (MST) — do dia para a noite
    /** 0 = dia claro, 0.5 = pôr do sol, 1 = noite com a plantação em chamas. */
    static float dusk;

    private static int l3(int a, int b, int c3, float d) { return d < 0.5f ? Draw.mix(a, b, d * 2) : Draw.mix(b, c3, (d - 0.5f) * 2); }
    private static float hs(float a) { float v = (float) Math.sin(a * 127.1f + 3.7f) * 43758.547f; return v - (float) Math.floor(v); }
    private static int al(int rgb, float a) { return ((int) Math.max(0, Math.min(255, a)) << 24) | (rgb & 0xFFFFFF); }

    /** língua de fogo animada (três camadas de cor). */
    private static void fire(Canvas c, float x, float y, float h, float w, float t, float seed) {
        float f1 = (float) Math.sin(t * 9 + seed * 5) * 0.18f, f2 = (float) Math.sin(t * 13 + seed * 9) * 0.2f;
        Draw.poly(c, 0xFED84315, x - w, y, x - w * 0.5f, y - h * (0.55f + f2), x - w * 0.15f, y - h * 0.4f, x + w * f1, y - h * (1f + f1), x + w * 0.3f, y - h * 0.45f, x + w * 0.6f, y - h * (0.7f - f2), x + w, y);
        Draw.poly(c, 0xFEFF9800, x - w * 0.6f, y, x - w * 0.2f, y - h * (0.5f + f1), x + w * f2 * 0.6f, y - h * (0.72f + f2), x + w * 0.3f, y - h * 0.4f, x + w * 0.6f, y);
        Draw.poly(c, 0xFEFFF176, x - w * 0.3f, y, x + w * f1 * 0.4f, y - h * (0.38f + f1 * 0.5f), x + w * 0.3f, y);
    }

    private static void mstFlag(Canvas c, float x, float y, float h, float time, boolean lite, boolean text) {
        Draw.rect(c, 0xFF5D4037, x, y - h, x + 3, y);
        float w = lite ? 0 : (float) Math.sin(time * 5 + x * 0.05f) * 3;
        Draw.poly(c, 0xFFD32F2F, x + 3, y - h, x + 43, y - h + w, x + 43, y - h + 26 + w, x + 3, y - h + 26);
        Draw.circle(c, 0xFFFFFFFF, x + 23, y - h + 13 + w * 0.5f, 8);
        Draw.circle(c, 0xFF2E7D32, x + 23, y - h + 13 + w * 0.5f, 4);
        if (text) Draw.text(c, "MST", x + 23, y - h + 36, 9, 0xFFD32F2F, Paint.Align.CENTER);
    }

    private static void fazenda(Canvas c, float cam, float time, boolean lite) {
        float d = dusk;
        // céu: azul de dia, laranja no pôr do sol, noite avermelhada pelo incêndio
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, l3(0xFF5E9FD6, 0xFF5B3468, 0xFF0A0916, d), l3(0xFFEADFC0, 0xFFFF9A4A, 0xFF8A2A10, d));
        if (d > 0.55f) { // estrelas e lua (meio encobertas pela fumaça)
            float sa = (d - 0.55f) / 0.45f;
            for (int i = 0; i < 46; i++) {
                float tw = 0.6f + 0.4f * (float) Math.sin(time * 2.5f + i * 1.7f);
                Draw.rect(c, al(0xFFFFFF, 200 * sa * tw * (1f - hs(i + 9) * 0.5f)), hs(i) * 800, hs(i + 50) * 150, hs(i) * 800 + 1.6f, hs(i + 50) * 150 + 1.6f);
            }
            Draw.puff(c, al(0xFFE0B0, 70 * sa), 130, 62, 46);
            Draw.circle(c, al(0xFFE9C8, 235 * sa), 130, 62, 16); Draw.circle(c, al(0xD9BFA0, 120 * sa), 125, 58, 4); Draw.circle(c, al(0xD9BFA0, 110 * sa), 135, 68, 3);
        }
        float sy = 70 + d * 300; // sol descendo
        if (sy < FLOOR_TOP + 30) {
            int sc = Draw.mix(0xFFFFF59D, 0xFFFF5722, Math.min(1f, d * 1.8f));
            Draw.puff(c, al(sc, 90), 610, sy, 90); Draw.circle(c, sc, 610, sy, 26);
        }
        // clarão do incêndio no horizonte
        float glowA = 40 + 190 * d, flick = 0.9f + 0.1f * (float) Math.sin(time * 7);
        float og = off(cam, 0.1f, 400);
        for (int i = -1; i < 4; i++) Draw.puff(c, al(0xFF6A1A, glowA * flick * (0.7f + 0.3f * hs(i + 3))), og + i * 400 + 150, FLOOR_TOP - 6, 170 + 80 * d);
        // serras ao longe
        float o = off(cam, 0.08f, 800);
        int hill = l3(0xFF86A070, 0xFF6B4046, 0xFF1C1014, d);
        for (int k = -1; k < 3; k++) {
            float x0 = o + k * 800;
            Draw.poly(c, hill, x0, FLOOR_TOP, x0, 208, x0 + 160, 178, x0 + 340, 212, x0 + 520, 186, x0 + 700, 204, x0 + 800, 208, x0 + 800, FLOOR_TOP);
        }
        // colunas de fumaça distantes, inclinadas pelo vento
        if (!lite) {
            float os = off(cam, 0.16f, 520);
            int smk = l3(0xFF6A625C, 0xFF3E2C2A, 0xFF1A1212, d);
            for (int k = -1; k < 3; k++) {
                float bx = os + k * 520 + 120;
                for (int i = 0; i < 9; i++) {
                    float u = (i + (time * 0.12f + k * 0.37f) % 1f) / 9f;
                    Draw.puff(c, al(smk, (110 + 90 * d) * (1f - u * 0.75f)), bx + u * 150 + (float) Math.sin(u * 7 + k) * 10, 236 - u * 230, 16 + u * 62);
                }
            }
        }
        // sede da fazenda, celeiro e caixa d'água tomados pelo movimento
        int wall = l3(0xFFE8DCC0, 0xFFC9905E, 0xFF2A1A1C, d), roof = l3(0xFFA1503A, 0xFF7A3626, 0xFF1A0E0E, d), barn = l3(0xFF9E3B2E, 0xFF7E2A20, 0xFF200F10, d), wood = l3(0xFF6D4C41, 0xFF4E2E22, 0xFF120A0A, d);
        int win = d > 0.45f ? 0xFFFF9D3A : 0xFF6A8CA8;
        float om = off(cam, 0.35f, 1300);
        for (int k = -1; k < 2; k++) {
            float x0 = om + k * 1300;
            if (x0 > 820 || x0 < -1200) continue;
            // casa sede
            Draw.rect(c, wall, x0 + 120, 176, x0 + 330, FLOOR_TOP);
            Draw.poly(c, roof, x0 + 104, 180, x0 + 225, 132, x0 + 346, 180);
            Draw.rect(c, Draw.shade(wall, -0.2f), x0 + 120, 236, x0 + 330, FLOOR_TOP);
            for (int i = 0; i < 4; i++) { Draw.rect(c, win, x0 + 138 + i * 50, 196, x0 + 162 + i * 50, 222); Draw.rect(c, wood, x0 + 149 + i * 50, 196, x0 + 151 + i * 50, 222); }
            Draw.rect(c, 0xFFD32F2F, x0 + 150, 228, x0 + 300, 244);
            Draw.text(c, "FAZENDA OCUPADA", x0 + 225, 240, 11, 0xFFFFFFFF, Paint.Align.CENTER);
            mstFlag(c, x0 + 222, 134, 46, time, lite, false);
            // celeiro
            Draw.rect(c, barn, x0 + 520, 160, x0 + 700, FLOOR_TOP);
            Draw.poly(c, roof, x0 + 506, 164, x0 + 560, 124, x0 + 660, 124, x0 + 714, 164);
            Draw.rect(c, wood, x0 + 580, 196, x0 + 640, FLOOR_TOP);
            Draw.line(c, Draw.shade(barn, 0.3f), x0 + 580, 196, x0 + 640, FLOOR_TOP, 2); Draw.line(c, Draw.shade(barn, 0.3f), x0 + 640, 196, x0 + 580, FLOOR_TOP, 2);
            Draw.text(c, "MST", x0 + 610, 186, 20, 0xFFFFFFFF, Paint.Align.CENTER);
            if (d > 0.5f) { fire(c, x0 + 690, 160, 40 * d, 22, time, k + 2); fire(c, x0 + 540, 162, 30 * d, 16, time, k + 5); }
            // caixa d'água e cata-vento
            Draw.rect(c, wood, x0 + 868, 170, x0 + 872, FLOOR_TOP); Draw.rect(c, wood, x0 + 908, 170, x0 + 912, FLOOR_TOP);
            Draw.line(c, wood, x0 + 870, 250, x0 + 910, 190, 2); Draw.line(c, wood, x0 + 910, 250, x0 + 870, 190, 2);
            Draw.rect(c, Draw.shade(wall, -0.25f), x0 + 858, 138, x0 + 922, 172);
            Draw.poly(c, roof, x0 + 852, 138, x0 + 890, 120, x0 + 928, 138);
            Draw.rect(c, wood, x0 + 1040, 130, x0 + 1043, FLOOR_TOP);
            for (int b = 0; b < 6; b++) { double a = b * Math.PI / 3 + (lite ? 0 : time * 1.6f); Draw.line(c, Draw.shade(wall, -0.1f), x0 + 1041, 130, x0 + 1041 + (float) Math.cos(a) * 20, 130 + (float) Math.sin(a) * 20, 3); }
            mstFlag(c, x0 + 1150, FLOOR_TOP, 70, time, lite, false);
        }
        // plantação: fileiras de pés de milho/cana, uns verdes, outros já queimados, com fogo avançando
        float op = off(cam, 0.6f, 600);
        Draw.rect(c, l3(0xFF7C9A3A, 0xFF6B5A2A, 0xFF1A0F0A, d), 0, 222, 800, FLOOR_TOP);
        for (int row = 0; row < 3; row++) {
            float by = 232 + row * 11, hgt = 20 + row * 7;
            float orow = off(cam, 0.6f + row * 0.08f, 600);
            for (int i = -1; i < 105; i++) {
                float x = orow + i * 8 + row * 3;
                if (x < -10 || x > 810) continue;
                int wi = ((i % 75) + 75) % 75;
                float h = hs(wi * 3.1f + row * 17);
                boolean burnt = h < d * 1.15f - 0.08f;
                int col = burnt ? 0xFF140C08 : l3(h > 0.5f ? 0xFF7CB342 : 0xFFA4B03A, h > 0.5f ? 0xFF8A7A2A : 0xFF9A6A2A, 0xFF3A2414, d);
                Draw.line(c, col, x, by, x + (h - 0.5f) * 6, by - hgt * (burnt ? 0.6f : 0.8f + h * 0.4f), 2.2f);
                if (!burnt && !lite) Draw.line(c, col, x + 1, by - hgt * 0.5f, x + 6, by - hgt * 0.7f, 1.6f);
            }
            if (!lite || row == 2) for (int i = -1; i < 12; i++) {
                float x = orow + i * 75 + row * 31;
                int wi = ((i % 8) + 8) % 8;
                float h = hs(wi * 7.3f + row * 5);
                if (h < 0.22f + d * 0.78f) {
                    float fh = (14 + 34 * d) * (0.6f + h) * (0.7f + row * 0.25f);
                    if (!lite) Draw.puff(c, al(0xFF8A2A, 90 + 80 * d), x, by - fh * 0.4f, fh * 1.3f);
                    fire(c, x, by + 2, fh, 9 + 7 * d + row * 2, time, wi + row * 3);
                }
            }
        }
        // acampamento: barracas de lona preta, bandeiras do MST e cerca de arame
        float on = off(cam, 0.85f, 640);
        int tarp = l3(0xFF26262B, 0xFF1E1A1E, 0xFF0C0A0C, d);
        for (int i = -1; i < 3; i++) {
            float x = on + i * 640;
            Draw.poly(c, tarp, x + 60, FLOOR_TOP, x + 110, 206, x + 160, FLOOR_TOP);
            Draw.poly(c, Draw.shade(tarp, 0.12f), x + 110, 206, x + 160, FLOOR_TOP, x + 196, FLOOR_TOP - 6, x + 146, 204);
            Draw.poly(c, 0xFF0A0A0A, x + 96, FLOOR_TOP, x + 110, 226, x + 124, FLOOR_TOP);
            Draw.line(c, wood, x + 110, 200, x + 110, 210, 2);
            mstFlag(c, x + 210, FLOOR_TOP, 78, time, lite, true);
            Draw.poly(c, tarp, x + 380, FLOOR_TOP, x + 420, 216, x + 460, FLOOR_TOP);
            Draw.poly(c, Draw.shade(tarp, 0.12f), x + 420, 216, x + 460, FLOOR_TOP, x + 488, FLOOR_TOP - 5, x + 448, 214);
            if (d > 0.3f) Draw.puff(c, al(0xFFA040, 60 * d), x + 300, FLOOR_TOP - 14, 60);
        }
        float of = off(cam, 1f, 90);
        for (int i = -1; i < 11; i++) {
            float x = of + i * 90;
            Draw.rect(c, wood, x, FLOOR_TOP - 26, x + 4, FLOOR_TOP);
        }
        Draw.line(c, 0xFF8A8A8A, 0, FLOOR_TOP - 20, 800, FLOOR_TOP - 20, 1); Draw.line(c, 0xFF8A8A8A, 0, FLOOR_TOP - 10, 800, FLOOR_TOP - 10, 1);
        floor(c, cam, 0xFF7C5634, 0xFF5E3F24, 0xFF4A2F1A);
    }

    /** Fagulhas e cinzas do incêndio: sobem em redemoinho, estalam e caem por todo o cenário. */
    static void embers(Canvas c, float time, float d) {
        float sw = R3.vw, sh = R3.vh, fy = R3.portrait ? R3.ftop : 250;
        int n = (int) (((Draw.q == 0 ? 10 : 22) + (Draw.q == 0 ? 20 : 70) * d) * (sw * sh / 360000f));
        for (int i = 0; i < n; i++) {
            float sp = 0.10f + hs(i) * 0.14f;
            float t = (time * sp + hs(i + 31)) % 1f;
            boolean rising = (i & 3) == 0;
            float x = (hs(i + 77) * (sw + 100) + t * (120 + hs(i + 5) * 160) * sw / 800f + (float) Math.sin(t * 11 + i) * 18) % (sw + 60) - 30;
            float y = rising ? fy - t * (fy + 20) + (float) Math.sin(t * 8 + i) * 10 : -20 + t * (sh + 50);
            float fl = 0.55f + 0.45f * (float) Math.sin(time * 17 + i * 5.3f);
            float fade = rising ? 1f - t : Math.min(1f, (1f - t) * 3f);
            boolean ash = (i % 7) == 3;
            if (ash) { Draw.rect(c, al(0x2A2420, 170 * fade), x, y, x + 2.4f, y + 1.6f); continue; }
            int col = (i % 3) == 0 ? 0xFFE082 : (i % 3) == 1 ? 0xFF8F00 : 0xFF5722;
            float dx = 5 + hs(i + 5) * 5, dy = rising ? -5 : 7;
            Draw.line(c, al(col, 230 * fl * fade), x, y, x - dx, y - dy, 1.3f + hs(i + 2));
            if (Draw.q >= 2 && (i & 1) == 0) Draw.puff(c, al(0xFF7A20, 90 * fl * fade), x, y, 5 + hs(i) * 4);
        }
        // estalos: pequenas explosões de fagulhas na linha do fogo
        for (int k = 0; k < 2; k++) {
            float tt = time * (2.2f + k * 0.9f) + k * 0.5f;
            float bucket = (float) Math.floor(tt), age = tt - bucket;
            if (hs(bucket + k * 13) > 0.35f + 0.4f * (1f - d)) continue;
            float bx = hs(bucket * 1.7f + k) * sw, by = fy - 40 + hs(bucket * 2.3f) * 38;
            for (int j = 0; j < 6; j++) {
                double a = j * 1.05 + bucket;
                float r0 = age * 10, r1 = age * 22 + 3;
                Draw.line(c, al(0xFFE082, 255 * (1f - age)), bx + (float) Math.cos(a) * r0, by + (float) Math.sin(a) * r0 * 0.8f - age * 8, bx + (float) Math.cos(a) * r1, by + (float) Math.sin(a) * r1 * 0.8f - age * 8, 1.4f);
            }
        }
        Draw.P.setStyle(Paint.Style.FILL);
        if (d > 0.2f) Draw.rect(c, al(0xFF5A00, (d - 0.2f) * 22 * (0.8f + 0.2f * (float) Math.sin(time * 9))), 0, 0, sw, sh);
    }

    // ---------------------------------------------------------------- Lago (jet-ski)
    static void lake(Canvas c, float cam, float time, boolean lite) {
        Draw.grad(c, 0, 0, 800, FLOOR_TOP, 0xFF5FA8E0, 0xFFFBE5C4);
        Draw.circle(c, 0x33FFF3C0, 600, 150, 70);
        Draw.circle(c, 0x55FFF3C0, 600, 150, 44);
        Draw.circle(c, 0xFFFFF6D8, 600, 150, 26);
        // colinas distantes
        float o = off(cam, 0.08f, 800);
        for (int k = -1; k < 3; k++) {
            float x0 = o + k * 800;
            Draw.poly(c, 0xFF7F9FB0, x0, FLOOR_TOP, x0, 215, x0 + 200, 190, x0 + 420, 222, x0 + 620, 196, x0 + 800, 218, x0 + 800, FLOOR_TOP);
        }
        // Brasília ao longe: Congresso, Catedral e Ponte JK
        float o2 = off(cam, 0.16f, 1600);
        for (int k = -1; k < 2; k++) {
            float x0 = o2 + k * 1600;
            if (x0 > 820 || x0 < -1700) continue;
            Draw.rect(c, 0xFF6C8296, x0 + 300, 214, x0 + 520, FLOOR_TOP);
            Draw.rect(c, 0xFF5E7388, x0 + 340, 188, x0 + 372, 214); Draw.rect(c, 0xFF5E7388, x0 + 448, 188, x0 + 480, 214);
            Draw.poly(c, 0xFF5E7388, x0 + 300, 214, x0 + 350, 202, x0 + 400, 214);
            Draw.poly(c, 0xFF5E7388, x0 + 420, 214, x0 + 470, 202, x0 + 520, 214);
            Draw.rect(c, 0xFF55697D, x0 + 540, 198, x0 + 556, FLOOR_TOP); Draw.rect(c, 0xFF55697D, x0 + 560, 198, x0 + 576, FLOOR_TOP);
            Draw.poly(c, 0xFF778EA2, x0 + 640, FLOOR_TOP, x0 + 660, 204, x0 + 700, 204, x0 + 720, FLOOR_TOP);
            // arcos da ponte
            for (int a = 0; a < 3; a++) {
                float ax = x0 + 800 + a * 260;
                Draw.P.setStyle(Paint.Style.STROKE); Draw.P.setStrokeWidth(5); Draw.P.setColor(0xFF8A9DAE);
                Draw.RF.set(ax, 168, ax + 240, 330);
                c.drawArc(Draw.RF, 180, 180, false, Draw.P);
                Draw.P.setStyle(Paint.Style.FILL);
            }
            Draw.rect(c, 0xFF7C90A1, x0 + 800, 246, x0 + 1600, 252);
        }
        Draw.rect(c, 0x22FFFFFF, 0, 200, 800, FLOOR_TOP);
    }
}
