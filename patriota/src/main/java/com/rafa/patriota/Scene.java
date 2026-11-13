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
    }

    private static void skyline(Canvas c, float cam, int col, int win, boolean lite, float f, int seed) {
        float o = off(cam, f, 400);
        for (int i = -1; i < 11; i++) {
            float bx = o + i * 80;
            int idx = (((i % 5) + 5) + seed) % 5;
            float bh = 70 + idx * 26;
            Draw.rect(c, col, bx, FLOOR_TOP - bh, bx + 76, FLOOR_TOP);
            if (!lite) {
                for (int wy = 0; wy < bh - 14; wy += 16)
                    for (int wx = 8; wx < 70; wx += 16)
                        Draw.rect(c, ((wx + wy + idx) % 3 == 0) ? win : Draw.shade(col, 0.08f), bx + wx, FLOOR_TOP - bh + 8 + wy, bx + wx + 7, FLOOR_TOP - bh + 14 + wy);
            }
        }
    }

    static void bg(Canvas c, int theme, float cam, float time, boolean lite) {
        switch (theme) {
            case Data.TH_PAULISTA: paulista(c, cam, time, lite); break;
            case Data.TH_QUARENT: quarentena(c, cam, time, lite); break;
            case Data.TH_CAMPUS: campus(c, cam, time, lite); break;
            case Data.TH_PORTAO: portao(c, cam, time, lite); break;
            case Data.TH_NOVELA: novela(c, cam, time, lite); break;
            case Data.TH_PALCO: palco(c, cam, time, lite); break;
            case Data.TH_BBB: bbb(c, cam, time, lite); break;
            case Data.TH_JORNAL: jornal(c, cam, time, lite); break;
            default: tribunal(c, cam, time, lite); break;
        }
    }

    // ---------------------------------------------------------------- 1. Paulista
    private static void paulista(Canvas c, float cam, float time, boolean lite) {
        Draw.rect(c, 0xFF7FB8E0, 0, 0, 800, 130);
        Draw.rect(c, 0xFFB9DDF2, 0, 130, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFFB7C9D6, 0, 0, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFFA8DAF5, 0, 0, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFF4A2E6B, 0, 0, 800, 90);
        Draw.rect(c, 0xFFB3506B, 0, 90, 800, 170);
        Draw.rect(c, 0xFFFF8F5A, 0, 170, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFFEADBC0, 0, 50, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFF140C2A, 0, 0, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFFE91E63, 0, 0, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFF0D2347, 0, 0, 800, FLOOR_TOP);
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
        Draw.rect(c, 0xFFA5D2F0, 0, 0, 800, FLOOR_TOP);
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
}
