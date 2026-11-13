package com.rafa.patriota;

import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;

import com.rafa.patriota.Draw.Look;

/**
 * Renderizador 3D por software: câmera em perspectiva, modelos feitos de blocos articulados,
 * iluminação por face, remoção de faces ocultas e ordenação por profundidade.
 * Mundo: X = lateral, Y = altura, Z = profundidade (fundo da rua = Z maior).
 */
final class R3 {
    private R3() {}

    // ---------------------------------------------------------------- câmera
    static final float ZK = 2.0f;                       // escala da profundidade da rua
    private static final float CY = 620, CZ = -760;     // posição da câmera (relativa ao centro)
    private static final float FY, FZ, UY, UZ;          // vetores frente/cima
    private static final float F;                       // distância focal (escala 1 na fileira da frente)
    private static final float OFFY = 125;
    static float cx;
    static float px, py, pd;                            // resultado da projeção
    static float zoom = 1f;                             // "soco" de câmera (zoom rápido nos impactos)
    static int alphaMul = 255;
    static int fog = 0xFFB9DDF2;                        // cor da neblina (por cenário)
    static float fogK = 0.22f;
    static final float Z_BACK;                          // onde o piso encontra o cenário de fundo

    static {
        float fy = -620, fz = 895;
        float l = (float) Math.sqrt(fy * fy + fz * fz);
        FY = fy / l; FZ = fz / l; UY = FZ; UZ = -FY;
        F = -CY * FY + (0 - CZ) * FZ;
        float lo = 270, hi = 3000;
        for (int i = 0; i < 40; i++) {
            float m = (lo + hi) / 2;
            cx = 0; proj(0, 0, m);
            if (py > Scene.FLOOR_TOP) lo = m; else hi = m;
        }
        Z_BACK = lo;
    }

    static float zOf(float gameY) { return (Game.Y1 - gameY) * ZK; }

    static void proj(float X, float Y, float Z) {
        float ry = Y - CY, rz = Z - CZ;
        float zc = ry * FY + rz * FZ;
        float yc = ry * UY + rz * UZ;
        if (zc < 50) zc = 50;
        // escala lateral pela profundidade do chão: mantém as verticais retas (lente "tilt-shift")
        float zg = -CY * FY + rz * FZ;
        if (zg < 50) zg = 50;
        px = 400 + F * (X - cx) / zg;
        py = 225 - F * yc / zc + OFFY;
        if (zoom != 1f) { px = 400 + (px - 400) * zoom; py = 300 + (py - 300) * zoom; }
        pd = zc;
    }

    // ---------------------------------------------------------------- lista de faces
    private static final int MAXQ = 9000;
    private static final float[] QX = new float[MAXQ * 4], QY = new float[MAXQ * 4];
    private static final int[] QC = new int[MAXQ];
    private static final long[] KEY = new long[MAXQ];
    private static int nq;
    private static final Path PATH = new Path();
    private static final Paint PT = new Paint(Paint.ANTI_ALIAS_FLAG);
    // luz (vinda de cima, da esquerda e da frente)
    private static final float LX = -0.42f, LY = 0.78f, LZ = -0.46f;

    static void begin(float camX) { cx = camX + 400; nq = 0; tp = 0; ta = 1; tb = 0; tc = 0; td = 1; tx = 0; ty = 0; bias = 0; }

    static void flush(Canvas c) {
        java.util.Arrays.sort(KEY, 0, nq);
        PT.setStyle(Paint.Style.FILL_AND_STROKE);
        PT.setStrokeWidth(0.7f);
        PT.setStrokeJoin(Paint.Join.ROUND);
        for (int k = nq - 1; k >= 0; k--) {
            int i = (int) (KEY[k] & 0xFFFFFFFFL), j = i * 4;
            PATH.reset();
            PATH.moveTo(QX[j], QY[j]); PATH.lineTo(QX[j + 1], QY[j + 1]); PATH.lineTo(QX[j + 2], QY[j + 2]); PATH.lineTo(QX[j + 3], QY[j + 3]);
            PATH.close();
            PT.setColor(QC[i]);
            c.drawPath(PATH, PT);
        }
        PT.setStyle(Paint.Style.FILL);
        nq = 0;
    }

    // ---------------------------------------------------------------- transformação do modelo
    private static float ox, oy, oz, mir = 1, sc = 1;
    private static float ta = 1, tb, tc, td = 1, tx, ty; // afim 2D (plano XY local)
    private static final float[] ST = new float[6 * 16];
    private static int tp;
    private static float bias;
    private static float flashK;

    private static void push() { int i = tp * 6; ST[i] = ta; ST[i + 1] = tb; ST[i + 2] = tc; ST[i + 3] = td; ST[i + 4] = tx; ST[i + 5] = ty; tp++; }
    private static void pop() { tp--; int i = tp * 6; ta = ST[i]; tb = ST[i + 1]; tc = ST[i + 2]; td = ST[i + 3]; tx = ST[i + 4]; ty = ST[i + 5]; }

    /** Gira (graus, anti-horário) em torno do pivô local. Positivo = membro pendurado vai para a frente. */
    private static void rot(float deg, float pxl, float pyl) {
        float r = (float) Math.toRadians(deg), cs = (float) Math.cos(r), sn = (float) Math.sin(r);
        // T = T * Trans(p) * R * Trans(-p)
        float na = ta * cs + tb * sn, nb = -ta * sn + tb * cs;
        float nc = tc * cs + td * sn, nd = -tc * sn + td * cs;
        float ntx = ta * pxl + tb * pyl + tx - (na * pxl + nb * pyl);
        float nty = tc * pxl + td * pyl + ty - (nc * pxl + nd * pyl);
        ta = na; tb = nb; tc = nc; td = nd; tx = ntx; ty = nty;
    }

    /** Ampliação visual dos modelos (as colisões continuam nas unidades do jogo). */
    static final float BIG = 1.3f;

    private static void model(float X, float Y, float Z, int face, float scale, float flash) {
        ox = X; oy = Y; oz = Z; mir = face >= 0 ? 1 : -1; sc = scale * BIG;
        ta = 1; tb = 0; tc = 0; td = 1; tx = 0; ty = 0; tp = 0; bias = 0;
        flashK = flash > 0 ? 0.7f : 0f;
    }

    private static final float[] WX = new float[8], WY = new float[8], WZ = new float[8], SX = new float[8], SY = new float[8], SD = new float[8];
    private static final int[][] FACE = {{0, 4, 6, 2}, {1, 3, 7, 5}, {0, 1, 5, 4}, {2, 6, 7, 3}, {0, 2, 3, 1}, {4, 5, 7, 6}};

    /** Bloco alinhado aos eixos locais (depois transformado). */
    private static void box(float x0, float y0, float z0, float x1, float y1, float z1, int color) {
        if (nq > MAXQ - 8) return;
        if (flashK > 0) color = Draw.mix(color, 0xFFFFFFFF, flashK);
        for (int i = 0; i < 8; i++) {
            float lx = (i & 1) == 0 ? x0 : x1, ly = (i & 2) == 0 ? y0 : y1, lz = (i & 4) == 0 ? z0 : z1;
            float rx = ta * lx + tb * ly + tx, ry = tc * lx + td * ly + ty;
            WX[i] = ox + mir * sc * rx; WY[i] = oy + sc * ry; WZ[i] = oz + sc * lz;
            proj(WX[i], WY[i], WZ[i]);
            SX[i] = px; SY[i] = py; SD[i] = pd;
        }
        for (int f = 0; f < 6; f++) {
            float nx, ny, nz;
            switch (f) {
                case 0: nx = -ta * mir; ny = -tc; nz = 0; break;
                case 1: nx = ta * mir; ny = tc; nz = 0; break;
                case 2: nx = -tb * mir; ny = -td; nz = 0; break;
                case 3: nx = tb * mir; ny = td; nz = 0; break;
                case 4: nx = 0; ny = 0; nz = -1; break;
                default: nx = 0; ny = 0; nz = 1; break;
            }
            int[] q = FACE[f];
            float mx = (WX[q[0]] + WX[q[2]]) * 0.5f, my = (WY[q[0]] + WY[q[2]]) * 0.5f, mz = (WZ[q[0]] + WZ[q[2]]) * 0.5f;
            // visível se a normal aponta para a câmera
            if (nx * (cx - mx) + ny * (CY - my) + nz * (CZ - mz) <= 0) continue;
            float lit = nx * LX + ny * LY + nz * LZ;
            float k = 0.62f + 0.38f * Math.max(0f, lit);
            if (ny < -0.5f) k = 0.45f;
            int a = (color >>> 24) * alphaMul / 255, r = (int) (((color >> 16) & 255) * k), g = (int) (((color >> 8) & 255) * k), b = (int) ((color & 255) * k);
            if (Draw.q >= 1) { // neblina por profundidade + luz de contorno suave
                float dd = (SD[q[0]] + SD[q[2]]) * 0.5f;
                float fk = Math.max(0f, Math.min(fogK, (dd - 1250f) / 2600f));
                if (fk > 0) { r += (int) ((((fog >> 16) & 255) - r) * fk); g += (int) ((((fog >> 8) & 255) - g) * fk); b += (int) (((fog & 255) - b) * fk); }
            }
            if (lit > 0.75f && Draw.q >= 2) { r = Math.min(255, r + 14); g = Math.min(255, g + 14); b = Math.min(255, b + 12); }
            int j = nq * 4;
            float d = 0;
            for (int v = 0; v < 4; v++) { QX[j + v] = SX[q[v]]; QY[j + v] = SY[q[v]]; d += SD[q[v]]; }
            QC[nq] = (a << 24) | (r << 16) | (g << 8) | b;
            int key = (int) ((d * 0.25f - bias) * 64f);
            KEY[nq] = ((long) key << 32) | nq;
            nq++;
        }
    }

    // ---------------------------------------------------------------- piso, sombras e efeitos no chão
    private static final float[] GX = new float[40], GY = new float[40];

    private static void groundPoly(Canvas c, int color, int n) {
        PATH.reset();
        PATH.moveTo(GX[0], GY[0]);
        for (int i = 1; i < n; i++) PATH.lineTo(GX[i], GY[i]);
        PATH.close();
        PT.setStyle(Paint.Style.FILL);
        PT.setColor(color);
        c.drawPath(PATH, PT);
    }

    private static void gquad(Canvas c, int color, float x0, float z0, float x1, float z1, float y) {
        proj(x0, y, z0); GX[0] = px; GY[0] = py;
        proj(x1, y, z0); GX[1] = px; GY[1] = py;
        proj(x1, y, z1); GX[2] = px; GY[2] = py;
        proj(x0, y, z1); GX[3] = px; GY[3] = py;
        groundPoly(c, color, 4);
    }

    static void shadow(Canvas c, float X, float Z, float rx, float rz, float h) {
        float k = 1f / (1f + h / 120f);
        int n = 12;
        for (int pass = 0; pass < (Draw.q >= 1 ? 2 : 1); pass++) {
            float m = pass == 0 ? 1.25f : 0.8f;
            for (int i = 0; i < n; i++) {
                double a = i * Math.PI * 2 / n;
                proj(X + rx * 0.3f + (float) Math.cos(a) * rx * m * k, 0, Z + rz * 0.2f + (float) Math.sin(a) * rz * m * k);
                GX[i] = px; GY[i] = py;
            }
            groundPoly(c, pass == 0 ? 0x33000000 : 0x44000000, n);
        }
    }

    static void ringFx(Canvas c, float X, float Y, float Z, float r, int color, float w) {
        PATH.reset();
        for (int i = 0; i <= 24; i++) {
            double a = i * Math.PI * 2 / 24;
            proj(X + (float) Math.cos(a) * r, Y, Z + (float) Math.sin(a) * r * 0.9f);
            if (i == 0) PATH.moveTo(px, py); else PATH.lineTo(px, py);
        }
        PT.setStyle(Paint.Style.STROKE); PT.setStrokeWidth(w); PT.setColor(color);
        c.drawPath(PATH, PT);
        PT.setStyle(Paint.Style.FILL);
    }

    private static final int[][] FLOOR = { // cor do piso, linha
            {0xFF4B4B50, 0xFF606068}, {0xFF5A5F66, 0xFF70767E}, {0xFF5BA85A, 0xFF4C9150}, {0xFF3C3C44, 0xFF4E4E58},
            {0xFF8B5A2B, 0xFF6B4520}, {0xFF2B1B55, 0xFF4A2E96}, {0xFFD7B98E, 0xFFB99A6E}, {0xFF90A4AE, 0xFFB4C2CA},
            {0xFFDCD3C3, 0xFFBDB29E}};

    static void floor(Canvas c, int theme, float camX) {
        int col = FLOOR[theme][0], ln = FLOOR[theme][1];
        float x0 = cx - 900, x1 = cx + 900;
        int strips = 10;
        float zn = -160;
        for (int i = 0; i < strips; i++) {
            float za = zn + (Z_BACK - zn) * i / strips, zb = zn + (Z_BACK - zn) * (i + 1) / strips;
            gquad(c, Draw.shade(col, -0.30f * i / strips + 0.04f), x0, za, x1, zb, 0);
        }
        // juntas do piso (perspectiva real)
        PT.setStyle(Paint.Style.STROKE); PT.setStrokeWidth(1.4f); PT.setColor(ln);
        float gx = (float) Math.floor((cx - 900) / 100f) * 100f;
        for (float x = gx; x < cx + 900; x += 100) {
            proj(x, 0, zn); float ax = px, ay = py; proj(x, 0, Z_BACK); c.drawLine(ax, ay, px, py, PT);
        }
        for (float z = -100; z < Z_BACK; z += 100) {
            proj(x0, 0, z); float ax = px, ay = py; proj(x1, 0, z); c.drawLine(ax, ay, px, py, PT);
        }
        PT.setStyle(Paint.Style.FILL);
        if (theme == Data.TH_PAULISTA) { // faixa tracejada
            float s = (float) Math.floor((cx - 600) / 160f) * 160f;
            for (float x = s; x < cx + 600; x += 160) gquad(c, 0xFFFFD600, x, 70, x + 70, 78, 0.2f);
        }
        if (theme == Data.TH_CAMPUS) gquad(c, 0xFFD8C9A0, x0, 40, x1, 200, 0.2f);
        // meio-fio ao fundo
        gquad(c, Draw.shade(col, -0.45f), x0, Z_BACK - 14, x1, Z_BACK, 0.3f);
    }

    /** Objetos 3D de cenário ao fundo da rua (postes, colunas, árvores...). */
    static void props(int theme, float camX) {
        float zb = zOf(Game.Y0) + 70;
        float s = (float) Math.floor((cx - 700) / 260f) * 260f;
        for (float x = s; x < cx + 700; x += 260) {
            model(x + 60, 0, zb, 1, 1, 0);
            switch (theme) {
                case Data.TH_PAULISTA: case Data.TH_PORTAO: // poste de luz
                    box(-3, 0, -3, 3, 150, 3, 0xFF54585F); box(-3, 146, -3, 34, 151, 3, 0xFF54585F); box(22, 140, -5, 38, 146, 5, 0xFFFFF3B0);
                    box(-9, 0, -9, 9, 8, 9, 0xFF3C4046);
                    break;
                case Data.TH_QUARENT: // barreira e cone
                    box(-40, 0, -6, 40, 34, 6, 0xFFE8E8E8); box(-40, 22, -6.5f, 40, 30, 6.5f, 0xFFFFC400); box(-40, 34, -2, 40, 70, 2, 0x6690CAF9);
                    box(70, 0, -8, 86, 3, 8, 0xFFFF6D00); box(74, 3, -4, 82, 26, 4, 0xFFFF6D00);
                    break;
                case Data.TH_CAMPUS: // árvore
                    box(-6, 0, -6, 6, 60, 6, 0xFF6D4C41); box(-34, 56, -34, 34, 96, 34, 0xFF2E7D32); box(-24, 96, -24, 24, 128, 24, 0xFF388E3C); box(-13, 128, -13, 13, 150, 13, 0xFF43A047);
                    break;
                case Data.TH_NOVELA: case Data.TH_PALCO: case Data.TH_BBB: case Data.TH_JORNAL: // refletor de estúdio
                    box(-2.5f, 0, -2.5f, 2.5f, 120, 2.5f, 0xFF2B2B2B); box(-16, 0, -2, 16, 3, 2, 0xFF2B2B2B); box(-2, 0, -16, 2, 3, 16, 0xFF2B2B2B);
                    box(-13, 116, -11, 13, 140, 9, 0xFF1C1C1C); box(-10, 119, -14, 10, 137, -11, theme == Data.TH_PALCO ? 0xFFE1BEE7 : 0xFFFFF8D0);
                    break;
                default: // coluna de mármore
                    box(-22, 0, -22, 22, 12, 22, 0xFFE3DED2); box(-15, 12, -15, 15, 170, 15, 0xFFF7F4EC); box(-22, 170, -22, 22, 182, 22, 0xFFE3DED2);
            }
        }
    }

    // ---------------------------------------------------------------- pessoa 3D
    private static float aHipF, aKneeF, aHipB, aKneeB, aShN, aElN, aShF, aElF, aLean;

    private static void leg(float z, float hip, float knee, int pants, int shoe, float g) {
        push();
        rot(hip, 0, 42);
        box(-4.6f * g, 20, z - 4.6f, 4.6f * g, 43, z + 4.6f, pants);
        rot(knee, 0, 21);
        box(-4f * g, 3, z - 4f, 4f * g, 22, z + 4f, pants);
        box(-4.4f, 0, z - 4.4f, 9.5f, 4.5f, z + 4.4f, shoe);
        pop();
    }

    /** Desenha a pessoa; devolve nada. Deixa a transformação da mão do braço próximo em pilha via callback simples. */
    static void person(Canvas c, float X, float H, float Z, int face, Look lk, float walk, float mv, int pose, float pt,
                       float flash, int weapon, boolean guard, boolean shadowOn) {
        float s = lk.scale;
        if (shadowOn) shadow(c, X, Z, 20 * s, 9 * s, H);
        model(X, H, Z, face, s, flash);
        int skin = lk.skin, shirt = lk.shirt, pants = lk.pants, hair = lk.hair, shoe = 0xFF1B1B1B;
        float g = lk.girth;
        boolean fem = lk.acc == Data.AC_DRESS || lk.acc == Data.AC_DANCER;
        boolean robe = lk.acc == Data.AC_TOGA || lk.acc == Data.AC_REITOR;
        boolean longS = lk.acc == Data.AC_SUIT || lk.acc == Data.AC_ANCHOR || lk.acc == Data.AC_COAT || robe
                || lk.acc == Data.AC_KNIFE || lk.hero == 3 || lk.acc == Data.AC_MULA;
        float ph = walk * 0.12f, sw = (float) Math.sin(ph) * mv;
        float breath = (float) Math.sin(Draw.time * 2.4f + X * 0.013f);
        // ---- ângulos por pose
        aHipF = 32 * sw; aHipB = -32 * sw;
        aKneeF = -(8 + 34 * Math.max(0f, -(float) Math.cos(ph))) * mv; aKneeB = -(8 + 34 * Math.max(0f, (float) Math.cos(ph))) * mv;
        aShN = -26 * sw + 4; aShF = 26 * sw + 4; aElN = 14 + 10 * mv; aElF = 14 + 10 * mv; aLean = -3 * mv;
        float ext = pt < 0.5f ? pt * 2 : 1f;
        switch (pose) {
            case Draw.P_PUNCH: aShN = 20 + 72 * ext; aElN = 95 * (1 - ext); aShF = 55; aElF = 95; aLean = -7 * ext; aHipF = 16; aHipB = -14; aKneeB = -8; break;
            case Draw.P_KICK: case Draw.P_JKICK: aHipF = 84; aKneeF = -4; aHipB = pose == Draw.P_JKICK ? -30 : -6; aKneeB = pose == Draw.P_JKICK ? -60 : -4; aLean = 13; aShN = -30; aShF = 40; aElN = 60; aElF = 80; break;
            case Draw.P_JUMP: aHipF = 55; aKneeF = -80; aHipB = 20; aKneeB = -60; aShN = 150; aShF = 130; aElN = 20; aElF = 20; break;
            case Draw.P_WIND: aShN = 155; aElN = 25; aShF = 30; aElF = 60; aLean = 5; break;
            case Draw.P_CHARGE: aShN = 170; aShF = 170; aElN = 10; aElF = 10; aHipF = 20; aHipB = -20; break;
            case Draw.P_GRAB: aShN = 82; aShF = 76; aElN = 12; aElF = 12; aLean = -6; break;
            case Draw.P_HURT: aLean = 15; aShN = -35; aShF = -25; aElN = 40; aElF = 40; aHipF = 12; aHipB = -6; break;
            case Draw.P_DOWN: aLean = 88; aShN = -20; aShF = 20; aHipF = 8; aHipB = -8; break;
            case Draw.P_SPIN: aShN = 90 + (float) Math.sin(walk * 0.6f) * 60; aShF = 90 - (float) Math.sin(walk * 0.6f) * 60; aElN = 0; aElF = 0; break;
            case Draw.P_SPEC: aHipF = 70; aKneeF = -75; aHipB = 62; aKneeB = -70; aShN = 62; aShF = 58; aElN = 10; aElF = 10; aLean = -8; break;
            default: break;
        }
        if (pose == Draw.P_DOWN) { oy += 6 * s; }
        rot(aLean, 0, pose == Draw.P_DOWN ? 4 : 30);
        float bob = -Math.abs(sw) * 1.4f;
        ty += td * bob; tx += tb * bob;
        // ---- pernas / saia / toga
        if (robe) {
            int rc = lk.acc == Data.AC_TOGA ? 0xFF141414 : shirt;
            box(-11, 0, -13, 11, 44, 13, rc);
            box(-9, 0, -13.4f, 9, 44, -12.6f, Draw.shade(rc, 0.12f));
        } else {
            leg(5.6f, aHipB, aKneeB, Draw.shade(pants, -0.1f), shoe, g);
            leg(-5.6f, aHipF, aKneeF, pants, shoe, g);
            if (fem) box(-8, 26, -12, 8, 46, 12, shirt);
        }
        // ---- tronco
        float ch = breath * 0.4f;
        int torso = robe && lk.acc == Data.AC_TOGA ? 0xFF141414 : shirt;
        box(-7 * g, 42, -11.5f, 7 * g + ch, 72, 11.5f, torso);
        if (!robe && !fem) box(-7.2f * g, 40, -11.8f, 7.2f * g, 44.5f, 11.8f, 0xFF1A1A1A); // cinto
        bias = 3;
        if (lk.hero == 0) { box(2, 67, -11.9f, 7.3f * g, 72.3f, 11.9f, 0xFF1B8F3A); box(2, 56, -12, 6, 61, -11.4f, 0xFF1D3E9A); }
        if (lk.torn) { box(-2, 46, -12, 5, 56, -11.4f, skin); box(-6, 60, -12, -1, 64, -11.4f, 0xFF7A5A20); }
        if (lk.acc == Data.AC_VEST) { box(-7.4f * g, 46, -12, 7.4f * g, 70, 12, 0xFFFFEB3B); box(-7.6f * g, 54, -12.2f, 7.6f * g, 58, 12.2f, 0xFFBDBDBD); }
        if (lk.acc == Data.AC_SUIT || lk.acc == Data.AC_ANCHOR) { box(5, 56, -3, 7.4f * g, 72, 3, 0xFFEEEEEE); box(6, 50, -1.3f, 7.7f * g, 70, 1.3f, 0xFFC62828); }
        if (lk.acc == Data.AC_HAWAII) { for (int i = 0; i < 5; i++) box(-5 + i * 2.6f, 48 + (i * 7) % 20, -12, -2 + i * 2.6f, 52 + (i * 7) % 20, -11.4f, i % 2 == 0 ? 0xFFFFEB3B : 0xFFE91E63); }
        if (lk.acc == Data.AC_COAT) { box(-7.6f * g, 22, -12.2f, 7.6f * g, 72.3f, 12.2f, 0xFFF4F4F4); box(6, 24, -1, 7.9f * g, 70, 1, 0xFF90A4AE); }
        if (lk.acc == Data.AC_MULA) { box(-7.4f * g, 44, -12, 7.4f * g, 72.2f, 12, 0xFFB71C1C); box(6, 44, -2.5f, 7.7f * g, 72, 2.5f, 0xFFEEEEEE); }
        if (lk.acc == Data.AC_DANCER) box(-7.3f, 58, -12, 7.3f, 66, 12, 0xFFFFFF00);
        if (lk.hero == 3) box(6, 50, -1.4f, 7.5f, 70, 1.4f, 0xFF2E7D32);
        bias = 0;
        // ---- pescoço e cabeça
        box(-3, 71, -3.2f, 3.4f, 76, 3.2f, Draw.shade(skin, -0.15f));
        push();
        rot(pose == Draw.P_HURT ? 10 : (pose == Draw.P_DOWN ? 0 : -aLean * 0.6f), 0, 75);
        box(-7, 75, -7, 7, 91, 7, skin);
        bias = 3;
        box(7, 80, -1.6f, 9.6f, 84.5f, 1.6f, Draw.shade(skin, -0.1f));           // nariz
        box(2.6f, 83, -7.4f, 5.4f, 86, -6.9f, 0xFF161616);                        // olho (lado da câmera)
        box(2.6f, 83, 6.9f, 5.4f, 86, 7.4f, 0xFF161616);
        box(6.9f, 83, -5, 7.4f, 86, -2, 0xFF161616); box(6.9f, 83, 2, 7.4f, 86, 5, 0xFF161616); // olhos de frente
        box(1.5f, 86.6f, -7.5f, 6.6f, 87.8f, -6.9f, Draw.shade(hair, -0.3f));     // sobrancelha
        box(3, 78, -7.4f, 7.3f, 79.2f, -6.9f, Draw.shade(skin, -0.5f));           // boca
        box(-2.2f, 80.5f, -8.2f, 0.6f, 85, -7, Draw.shade(skin, -0.2f));          // orelha
        // cabelo / chapéus
        if (lk.acc == Data.AC_KNIFE) { box(-8, 76, -8, 5, 93, 8, 0xFF1A1A1A); box(-8, 88, -8, 8, 93, 8, 0xFF1A1A1A); }
        else if (fem) { box(-8, 87, -8, 6, 93, 8, hair); box(-8.5f, 64, -8, -3, 90, 8, hair); }
        else { box(-7.6f, 87.5f, -7.6f, 5.5f, 92.6f, 7.6f, hair); box(-7.6f, 79, -7.6f, -4.2f, 90, 7.6f, hair); }
        if (lk.acc == Data.AC_MULA) { box(-1, 75.5f, -7.5f, 7.6f, 80.5f, 7.5f, 0xFFF2F2F2); }
        if (lk.acc == Data.AC_MASK) { box(1, 76.5f, -7.5f, 7.7f, 82, 7.5f, 0xFFFFFFFF); box(9, 75, -8.5f, 9.8f, 92, 8.5f, 0x6680DEEA); }
        if (lk.acc == Data.AC_COAT || lk.acc == Data.AC_ANCHOR || lk.hero == 2) { box(1.8f, 82.3f, -7.8f, 6.2f, 86.8f, -7.3f, 0x8890CAF9); box(-4, 84.5f, -7.7f, 2, 85.4f, -7.3f, 0xFF222222); }
        if (lk.acc == Data.AC_SUIT) { box(1, 82.5f, -7.8f, 7.6f, 86.5f, 7.8f, 0xFF0A0A0A); }
        if (lk.acc == Data.AC_REITOR) { box(-11, 92, -11, 11, 94, 11, 0xFF111111); box(-5, 90, -5, 5, 92, 5, 0xFF111111); box(8, 86, 9, 9.5f, 94, 10.5f, 0xFFFFD400); }
        if (lk.acc == Data.AC_DANCER) box(-7.8f, 86, -7.8f, 7.8f, 88.5f, 7.8f, 0xFFFF4081);
        if (lk.hero == 1) { box(-7.8f, 88, -7.8f, 7.8f, 93, 7.8f, 0xFF2E7D32); box(7, 88, -6, 13, 89.5f, 6, 0xFF1B5E20); }
        bias = 0;
        pop();
        // ---- braços
        int up = fem ? skin : (lk.acc == Data.AC_COAT ? 0xFFF4F4F4 : lk.acc == Data.AC_MULA ? 0xFFB71C1C : lk.acc == Data.AC_TOGA ? 0xFF141414 : shirt);
        int fo = longS ? up : skin;
        arm(15f, aShF, aElF, Draw.shade(up, -0.08f), Draw.shade(fo, -0.08f), skin, lk, -1, false, pose, guard);
        arm(-15f, aShN, aElN, up, fo, skin, lk, weapon, true, pose, guard);
    }

    private static void arm(float z, float sh, float el, int up, int fo, int skin, Look lk, int weapon, boolean near, int pose, boolean guard) {
        push();
        rot(sh, 0, 69);
        box(-3.3f, 54, z - 3.3f, 3.3f, 71, z + 3.3f, up);
        rot(el, 0, 55);
        box(-2.9f, 41, z - 2.9f, 2.9f, 56, z + 2.9f, fo);
        box(-3.1f, 35.5f, z - 3.1f, 3.1f, 41.5f, z + 3.1f, skin);
        if (near) {
            // o que está na mão (o antebraço aponta para -y local; "para a frente" do punho = +x local)
            if (weapon >= 0) heldWeapon(weapon, z);
            else heldAcc(lk, z, guard);
        }
        pop();
    }

    private static void heldWeapon(int w, float z) {
        switch (w) {
            case Data.IT_FACA: box(-1, 20, z - 0.6f, 2.5f, 36, z + 0.6f, 0xFFCFD8DC); box(-1.5f, 34, z - 1.5f, 3, 40, z + 1.5f, 0xFF4E342E); break;
            case Data.IT_GUARDA: box(-1, 2, z - 1, 1, 40, z + 1, 0xFF5D4037); box(-5, 2, z - 5, 5, 24, z + 5, 0xFF1B8F3A); box(-5.2f, 10, z - 5.2f, 5.2f, 16, z + 5.2f, 0xFFFFD400); break;
            case Data.IT_VUVU: box(-1.5f, 14, z - 1.5f, 1.5f, 40, z + 1.5f, 0xFFFFEB3B); box(-4, 6, z - 4, 4, 15, z + 4, 0xFFFDD835); break;
            case Data.IT_JBL: box(-7, 18, z - 6, 7, 38, z + 6, 0xFF212121); box(-4, 22, z - 6.5f, 4, 34, z - 6, 0xFF607D8B); break;
            default: break;
        }
    }

    private static void heldAcc(Look lk, float z, boolean guard) {
        switch (lk.acc) {
            case Data.AC_FLAG: box(-1, 30, z - 1, 1, 108, z + 1, 0xFF8D6E63); box(1, 86, z - 0.6f, 30, 107, z + 0.6f, 0xFFD62828); break;
            case Data.AC_MEGA: box(-3, 26, z - 3, 3, 40, z + 3, 0xFFE0E0E0); box(-6, 18, z - 6, 6, 27, z + 6, 0xFFEEEEEE); break;
            case Data.AC_BOOK: box(-2, 26, z - 6, 2.5f, 40, z + 6, 0xFF5E35B1); box(-1.4f, 27, z - 6.4f, 1.9f, 39, z + 6.4f, 0xFFFFF59D); break;
            case Data.AC_GUITAR: box(-2, 20, z - 8, 3, 40, z + 8, 0xFFB5651D); box(-1, -8, z - 1.6f, 2, 22, z + 1.6f, 0xFF5D4037); break;
            case Data.AC_KNIFE: box(-0.8f, 20, z - 0.6f, 2.6f, 36, z + 0.6f, 0xFFE0E0E0); break;
            case Data.AC_TROPHY: box(-3.5f, 22, z - 3.5f, 3.5f, 32, z + 3.5f, 0xFFFFC107); box(-1.2f, 32, z - 1.2f, 1.2f, 38, z + 1.2f, 0xFFFFA000); break;
            case Data.AC_RING: {
                float r = guard ? 20 : 12, cy0 = guard ? 28 : 26;
                box(-1, cy0 - r, z - r, 1.5f, cy0 - r + 3, z + r, 0xFFFFFFFF); box(-1, cy0 + r - 3, z - r, 1.5f, cy0 + r, z + r, 0xFFFFFFFF);
                box(-1, cy0 - r, z - r, 1.5f, cy0 + r, z - r + 3, 0xFFFFFFFF); box(-1, cy0 - r, z + r - 3, 1.5f, cy0 + r, z + r, 0xFFFFFFFF);
                break;
            }
            case Data.AC_TRIPOD: box(-1.2f, -20, z - 1.2f, 1.2f, 40, z + 1.2f, 0xFF37474F); box(-6, -32, z - 8, 8, -20, z + 8, 0xFF212121); box(8, -29, z - 3, 12, -23, z + 3, 0xFF90A4AE); break;
            case Data.AC_TOGA: box(-1.4f, 14, z - 1.4f, 1.4f, 40, z + 1.4f, 0xFF5D4037); box(-5, 8, z - 4, 5, 16, z + 4, 0xFF3E2723); break;
            case Data.AC_HAWAII: box(-1.5f, 24, z - 1.5f, 1.5f, 40, z + 1.5f, 0xFF212121); box(-3, 19, z - 3, 3, 25, z + 3, 0xFF9E9E9E); break;
            case Data.AC_COAT: box(-3, 8, z - 3, 3, 40, z + 3, 0xFFE0F7FA); box(-2, 14, z - 3.3f, 2, 30, z + 3.3f, 0xFFE53935); box(-0.6f, -8, z - 0.6f, 0.6f, 8, z + 0.6f, 0xFFB0BEC5); break;
            case Data.AC_ANCHOR: box(-1.8f, 4, z - 1.8f, 1.8f, 40, z + 1.8f, 0xFF1A237E); box(-1, -3, z - 1, 1, 4, z + 1, 0xFFB0BEC5); break;
            case Data.AC_MULA: box(-3, 24, z - 3, 3, 40, z + 3, 0xFF6D4C41); box(-1.5f, 18, z - 1.5f, 1.5f, 24, z + 1.5f, 0xFF8D6E63); break;
            default: break;
        }
        if (lk.hero == 1) { box(-1.2f, 26, z - 1.2f, 1.2f, 116, z + 1.2f, 0xFF8D6E63); box(1.2f, 92, z - 0.6f, 32, 115, z + 0.6f, 0xFF1B8F3A); box(9, 97, z - 0.9f, 24, 110, z + 0.9f, 0xFFFFD400); }
        if (lk.hero == 2) { box(-1, 28, z - 4, 1.5f, 40, z + 4, 0xFF222222); box(-1.3f, 30, z - 3.2f, -0.9f, 38, z + 3.2f, 0xFF66BB6A); }
        if (lk.hero == 3) { box(-2.5f, 10, z - 2.5f, 2.5f, 38, z + 2.5f, 0xFF2E7D32); box(-3.5f, 4, z - 3.5f, 3.5f, 11, z + 3.5f, 0xFF43A047); box(-1.2f, -4, z - 1.2f, 1.2f, 4, z + 1.2f, 0xFFFFC107); }
    }

    // ---------------------------------------------------------------- velociraptor, veículos e objetos
    static void raptor(Canvas c, float X, float H, float Z, int face, float walk, float mv, int pose, float pt, float flash, boolean roar) {
        shadow(c, X, Z, 56, 16, H);
        model(X, H, Z, face, 1.15f, flash);
        int body = 0xFF3F8F2E, belly = 0xFFB8D87A, dark = 0xFF2A6420;
        float sw = (float) Math.sin(walk * 0.1f) * mv;
        rot(-4 + (roar ? 10 : 0), 0, 50);
        // pernas
        for (int i = 0; i < 2; i++) {
            float z = i == 0 ? 8 : -8, a = (i == 0 ? -1 : 1) * 30 * sw;
            push(); rot(a + 20, 0, 52);
            box(-7, 28, z - 5, 7, 56, z + 5, i == 0 ? dark : body);
            rot(-45, 0, 28); box(-4, 6, z - 3.5f, 4, 30, z + 3.5f, i == 0 ? dark : body);
            rot(25, 0, 6); box(-4, 0, z - 5, 14, 6, z + 5, 0xFFFFF59D);
            pop();
        }
        // corpo, cauda
        box(-26, 46, -10, 30, 74, 10, body);
        box(-20, 44, -8, 26, 48, 8, belly);
        push(); rot(-12 + (float) Math.sin(walk * 0.05f) * 4, -24, 62);
        box(-52, 52, -7, -24, 70, 7, body);
        rot(-10, -52, 60); box(-78, 55, -4.5f, -52, 66, 4.5f, dark);
        rot(-8, -78, 60); box(-100, 57, -2.5f, -78, 63, 2.5f, dark);
        pop();
        // pescoço e cabeça
        push(); rot(-28, 26, 70);
        box(18, 66, -6, 32, 104, 6, body);
        rot(28 + (roar ? 14 : 0), 26, 100);
        box(16, 96, -8, 52, 112, 8, body);
        bias = 3;
        box(30, 105, -8.5f, 35, 109, -7.9f, 0xFFFFEB3B); box(32, 106, -8.8f, 34, 108, -8.4f, 0xFF111111);
        bias = 0;
        push(); rot(roar ? -28 : -6, 20, 96);
        box(20, 90, -7, 50, 96, 7, belly);
        for (int i = 0; i < 4; i++) box(26 + i * 6, 96, -7.3f, 29 + i * 6, 99.5f, -6.6f, 0xFFFFFFFF);
        pop();
        pop();
        // braços + mastro com bandeira
        push();
        float ang;
        if (pose == Draw.P_PUNCH) ang = 60 - pt * 240; else if (pose == Draw.P_SPIN) ang = walk * 40; else if (pose == Draw.P_KICK || pose == Draw.P_SPEC) ang = -90; else ang = -8;
        box(26, 52, -12, 40, 58, -8, dark); box(26, 52, 8, 40, 58, 12, dark);
        rot(ang, 40, 55);
        box(38.5f, 10, -11.5f, 41.5f, 150, -8.5f, 0xFF8D6E63);
        float wv = (float) Math.sin(Draw.time * 7) * 2;
        box(41.5f, 112, -10.6f, 80, 148, -9.4f, 0xFF2E7D32);
        bias = 3;
        box(50, 120 + wv * 0.3f, -11.2f, 72, 140, -10.4f, 0xFFFFD400);
        box(57, 126, -11.7f, 65, 134, -11, 0xFF1D3E9A);
        box(76, 112, -10.8f, 84, 122, -9.2f, 0xFF2E7D32); box(76, 134, -10.8f, 86, 142, -9.2f, 0xFF2E7D32); // pontas rasgadas
        bias = 0;
        pop();
    }

    static void moto(Canvas c, float X, float Z, int face, boolean truck) {
        shadow(c, X, Z, truck ? 70 : 50, 16, 0);
        model(X, 0, Z, face, 1, 0);
        if (truck) {
            box(-62, 14, -18, 12, 64, 18, 0xFFB71C1C); box(12, 14, -18, 52, 50, 18, 0xFF1B8F3A); box(18, 34, -18.5f, 46, 48, 18.5f, 0xFF90CAF9);
            box(-62, 14, -18.6f, 52, 20, 18.6f, 0xFFFFD400);
            for (int i = 0; i < 2; i++) { float wx = i == 0 ? -36 : 32; box(wx - 11, 0, -20, wx + 11, 22, -13, 0xFF1A1A1A); box(wx - 11, 0, 13, wx + 11, 22, 20, 0xFF1A1A1A); }
            box(-52, 64, -1.5f, -49, 104, 1.5f, 0xFF5D4037); box(-49, 84, -0.8f, -18, 104, 0.8f, 0xFF1B8F3A);
        } else {
            box(-36, 0, -4, -14, 24, 4, 0xFF1A1A1A); box(16, 0, -4, 38, 24, 4, 0xFF1A1A1A);
            box(-26, 14, -6, 28, 30, 6, 0xFFFFD400); box(-22, 28, -5, 4, 36, 5, 0xFF1B8F3A); box(6, 26, -6.5f, 24, 38, 6.5f, 0xFFFFD400);
            push(); rot(-20, 26, 30); box(24, 28, -1.5f, 28, 56, 1.5f, 0xFF9E9E9E); box(22, 54, -12, 30, 58, 12, 0xFF616161); pop();
            box(-48 - (float) Math.sin(Draw.time * 40) * 6, 14, -2, -36, 20, 2, 0xFFFF9800);
        }
    }

    static void crate(Canvas c, float X, float Z, float flash, int theme) {
        shadow(c, X, Z, 26, 14, 0);
        model(X, 0, Z, 1, 1, flash);
        if (theme == Data.TH_PAULISTA) { // carrinho de ambulante
            box(-22, 12, -14, 22, 36, 14, 0xFFE53935); box(-24, 36, -15, 24, 40, 15, 0xFFFFEB3B);
            box(-22, 40, -13, -20, 62, -11, 0xFF9E9E9E); box(20, 40, 11, 22, 62, 13, 0xFF9E9E9E);
            box(-27, 62, -17, 27, 66, 17, 0xFFFFFFFF); box(-27, 62, -17.4f, 0, 66, 17.4f, 0xFFE53935);
            box(-16, 0, -16, -6, 14, -13, 0xFF1A1A1A); box(6, 0, -16, 16, 14, -13, 0xFF1A1A1A);
        } else {
            box(-20, 0, -16, 20, 36, 16, 0xFFC68B3E);
            bias = 3;
            box(-20.5f, 0, -16.5f, -16, 36.5f, 16.5f, 0xFF8D6E63); box(16, 0, -16.5f, 20.5f, 36.5f, 16.5f, 0xFF8D6E63);
            box(-20.5f, 30, -16.5f, 20.5f, 36.5f, 16.5f, 0xFF8D6E63); box(-20.5f, 0, -16.5f, 20.5f, 6, 16.5f, 0xFF8D6E63);
            box(-6, 14, -16.8f, 6, 24, -16.3f, 0xFF1B8F3A);
            bias = 0;
        }
    }

    static void desk(Canvas c, float X, float Z, float flash, float frac) {
        shadow(c, X, Z, 74, 26, 0);
        model(X, 0, Z, 1, 1, flash);
        box(-62, 0, -22, 62, 50, 22, 0xFF37474F); box(-68, 50, -26, 68, 57, 26, 0xFF546E7A);
        bias = 3;
        box(-40, 12, -22.6f, 40, 42, -22, 0xFF1565C0); box(-12, 20, -23.2f, 12, 34, -22.6f, 0xFFFFFFFF);
        if (frac < 0.5f) { box(-52, 4, -22.8f, -49, 48, -22.2f, 0xFF000000); box(30, 10, -22.8f, 33, 50, -22.2f, 0xFF000000); }
        bias = 0;
        box(-50, 57, 2, -24, 80, 6, 0xFF212121); box(24, 57, 2, 50, 80, 6, 0xFF212121);
        bias = 3; box(-48, 60, 1.4f, -26, 78, 2, 0xFF4FC3F7); box(26, 60, 1.4f, 48, 78, 2, 0xFF4FC3F7); bias = 0;
    }

    static void item(Canvas c, float X, float H, float Z, int kind, float t) {
        shadow(c, X, Z, 12, 7, H + 10);
        model(X, H + 8 + (float) Math.sin(t * 5) * 2.5f, Z, 1, 1.15f, 0);
        switch (kind) {
            case Data.IT_PAO: box(-11, 0, -6, 11, 9, 6, 0xFFD7A15C); box(-11.4f, 3, -6.4f, 11.4f, 6, 6.4f, 0xFFFFF8E1); break;
            case Data.IT_PASTEL: box(-12, 0, -5, 12, 4, 5, 0xFFE0A030); box(-8, 4, -4, 8, 9, 4, 0xFFE8B040); box(14, 0, -3, 19, 16, 3, 0xFF9CCC65); break;
            case Data.IT_CAFE: box(-6, 0, -6, 6, 13, 6, 0xFFFFFFFF); box(-5, 11, -5, 5, 13.5f, 5, 0xFF5D4037); box(6, 4, -1.2f, 10, 10, 1.2f, 0xFFEEEEEE); break;
            case Data.IT_PEN: box(-8, 0, -4, 8, 4, 4, 0xFF212121); box(8, 0.5f, -3, 13, 3.5f, 3, 0xFF90A4AE); box(-5, 4, -1, -3, 4.6f, 1, 0xFF40C4FF); break;
            case Data.IT_CLORO: box(-12, 0, -8, 12, 18, 8, 0xFFFFFFFF); bias = 3; box(-2.5f, 3, -8.6f, 2.5f, 15, -8, 0xFFE53935); box(-7, 7, -8.6f, 7, 11, -8, 0xFFE53935); bias = 0; break;
            case Data.IT_JBL: box(-9, 0, -7, 9, 20, 7, 0xFF212121); bias = 3; box(-5, 5, -7.6f, 5, 15, -7, 0xFF607D8B); box(-2, 8, -8, 2, 12, -7.6f, 0xFFFF8F00); bias = 0; break;
            case Data.IT_VUVU: box(-14, 2, -1.6f, 6, 5, 1.6f, 0xFFFFEB3B); box(6, 0, -4, 15, 8, 4, 0xFFFDD835); break;
            case Data.IT_GUARDA: box(-1, 0, -1, 1, 20, 1, 0xFF5D4037); box(-12, 14, -12, 12, 18, 12, 0xFF1B8F3A); box(-6, 18, -6, 6, 21, 6, 0xFFFFD400); break;
            case Data.IT_FACA: box(-13, 1, -1.5f, -5, 4, 1.5f, 0xFF4E342E); box(-5, 1.5f, -0.6f, 12, 3.5f, 0.6f, 0xFFCFD8DC); break;
            default: break;
        }
    }

    static void projectile(Canvas c, Ent e, float Z, float time) {
        shadow(c, e.x, Z, 9, 5, e.h);
        float spin = time * 500;
        model(e.x, e.h, Z, e.face, 1, 0);
        switch (e.kind) {
            case Game.PJ_SYRINGE: box(-14, -4, -4, 12, 4, 4, 0xFFE0F7FA); box(-8, -3, -4.4f, 4, 3, 4.4f, 0xFF43A047); box(12, -0.8f, -0.8f, 26, 0.8f, 0.8f, 0xFFB0BEC5); box(-18, -6, -6, -14, 6, 6, 0xFF78909C); break;
            case Game.PJ_WAVE:
                if (e.tall) { box(-3, 0, -34, 3, 70, 34, 0x66FFEB3B); box(-9, 8, -26, -5, 60, 26, 0x44FFFFFF); }
                else { box(-6, 0, -40, 6, 26, 40, 0xAAFFD400); box(-2, 0, -40, 2, 38, 40, 0x88FFFFFF); }
                break;
            case Game.PJ_TROPHY: rot(spin, 0, 0); box(-5, -2, -5, 5, 9, 5, 0xFFFFC107); box(-2, -8, -2, 2, -2, 2, 0xFFFFA000); box(-6, -11, -6, 6, -8, 6, 0xFF6D4C41); break;
            case Game.PJ_WATCH: rot(spin, 0, 0); box(-7, -7, -2, 7, 7, 2, 0xFFFFD400); box(-4.5f, -4.5f, -2.5f, 4.5f, 4.5f, -2, 0xFFFFFFFF); break;
            case Game.PJ_PAPER: rot(spin, 0, 0); box(-9, -0.6f, -9, 9, 0.6f, 9, 0xFFFFFFFF); break;
            case Game.PJ_BOOK: rot(spin, 0, 0); box(-8, -6, -3, 8, 6, 3, 0xFF5E35B1); box(-6.5f, -4.5f, -3.4f, 8.3f, 4.5f, 3.4f, 0xFFFFF59D); break;
            case Game.PJ_MULTA: rot(spin * 0.6f, 0, 0); box(-10, -7, -0.8f, 10, 7, 0.8f, 0xFFFFF176); box(-5, -2, -1.2f, 5, 2, 1.2f, 0xFFD50000); break;
            case Game.PJ_NOTIF: box(-8, -8, -3, 8, 8, 3, 0xFF2E7D32); box(-5, -5, -3.6f, 5, 5, -3, 0xFF66BB6A); box(4, 5, -4, 10, 11, -3.4f, 0xFFE53935); break;
            default: break;
        }
    }

    // ---------------------------------------------------------------- ícone (menus e HUD)
    /** Desenha uma pessoa 3D com os pés em (sx,sy) na tela, com escala k. */
    static void icon(Canvas c, Look lk, float sx, float sy, float k, float walk, int pose) {
        float oz0 = zoom; zoom = 1f;
        begin(0);
        person(c, 400, 0, 0, 1, lk, walk, 0, pose, 0, 0, -1, false, false);
        proj(400, 0, 0);
        c.save();
        c.translate(sx, sy);
        c.scale(k, k);
        c.translate(-px, -py);
        flush(c);
        c.restore();
        zoom = oz0;
    }

    // ---------------------------------------------------------------- cena completa
    private static final int[] FOG = {0xFFBFDDF0, 0xFFC9D6DF, 0xFFCFEAF8, 0xFF8F5A66, 0xFFE8DCC0, 0xFF2A1A50, 0xFFE8A6C0, 0xFF1B3F72, 0xFFEAF2F8};

    static void world(Canvas c, Game g, Look[] kindLooks, Look[] heroLooks, Look heroTorn, boolean lite) {
        int theme = g.theme();
        zoom = 1f + 0.035f * g.punch;
        fog = FOG[theme];
        Scene.bg(c, theme, g.camX, g.time, lite);
        begin(g.camX);
        floor(c, theme, g.camX);
        if (Draw.q >= 1) props(theme, g.camX);
        // sombras e entidades (as sombras são desenhadas direto no chão, antes dos blocos)
        for (int i = 0; i < g.ents.size(); i++) ent(c, g, g.ents.get(i), kindLooks);
        for (int i = 0; i < g.np; i++) { g.use(i); player(c, g, heroLooks, heroTorn); }
        g.use(g.local);
        flush(c);
        // (o zoom permanece até o fim do quadro para os marcadores 2D)
    }

    private static void ent(Canvas c, Game g, Ent e, Look[] kindLooks) {
        if (e.x < g.camX - 200 || e.x > g.camX + Game.W + 200) return;
        float Z = zOf(e.y);
        switch (e.type) {
            case Ent.CRATE: crate(c, e.x, Z, e.flash, g.theme()); break;
            case Ent.ITEM: item(c, e.x, e.h, Z, e.kind, e.life); break;
            case Ent.PROJ: projectile(c, e, Z, g.time); break;
            case Ent.DESK: desk(c, e.x, Z, e.flash, e.hp / e.maxHp); break;
            case Ent.ENEMY: {
                Data.Kind k = Data.KINDS[e.kind];
                int pose; float pt = 0, mv = 1f;
                switch (e.st) {
                    case Game.S_WIND: pose = Draw.P_WIND; mv = 0; break;
                    case Game.S_ATK: pose = Draw.P_PUNCH; pt = Math.min(1f, e.t / 0.3f); mv = 0; break;
                    case Game.S_HURT: case Game.S_HELD: pose = Draw.P_HURT; mv = 0; break;
                    case Game.S_DOWN: case Game.S_DEAD: pose = Draw.P_DOWN; mv = 0; break;
                    default: pose = Draw.P_IDLE; break;
                }
                if (e.st == Game.S_DEAD && ((int) (e.t * 14) & 1) == 0) return;
                float flash = e.flash;
                if (e.st == Game.S_WIND && ((int) (e.t * 20) & 1) == 0) flash = 0.01f;
                person(c, e.x, e.h, Z, e.face, kindLooks[e.kind], e.walk, mv, pose, pt, flash, -1, e.guardUp, true);
                if (e.shield > 0) { model(e.x, e.h, Z, 1, k.scale, 0); box(-30, 0, -30, 30, 104, 30, 0x4480DEEA); }
                break;
            }
            default: break;
        }
    }

    private static void player(Canvas c, Game g, Look[] heroLooks, Look heroTorn) {
        Ent o = g.p;
        float Z = zOf(o.y);
        if (o.inv > 0 && o.inv < 3 && o.st != Game.S_SPECIAL && ((int) (g.time * 14) & 1) == 0 && o.st != Game.S_DOWN) return;
        Look lk = (g.hero == 0 && g.stageIdx == Data.STAGES.size() - 1) ? heroTorn : heroLooks[g.hero];
        float pt = 0, mv = 0; int pose = Draw.P_IDLE;
        boolean moving = (Math.abs(g.jx) > 0.2f || Math.abs(g.jy) > 0.2f) && g.rootT <= 0;
        switch (o.st) {
            case Game.S_IDLE: mv = moving ? 1f : 0f; break;
            case Game.S_ATK: {
                pt = g.atkProg();
                boolean fin = g.mounted ? g.comboStep == 3 : g.comboStep == 4;
                pose = (fin && g.weapon < 0 && g.hero != 2) ? Draw.P_KICK : Draw.P_PUNCH;
                break;
            }
            case Game.S_JUMP: pose = Draw.P_JUMP; break;
            case Game.S_JKICK: pose = g.mounted ? Draw.P_SPIN : Draw.P_JKICK; break;
            case Game.S_HURT: pose = Draw.P_HURT; break;
            case Game.S_DOWN: case Game.S_DEAD: pose = Draw.P_DOWN; break;
            case Game.S_GRAB: pose = Draw.P_GRAB; break;
            case Game.S_CHARGE: pose = Draw.P_CHARGE; break;
            case Game.S_SPECIAL: pose = g.spK == Game.SP_SPIN ? Draw.P_SPIN : g.spK == Game.SP_BURST ? Draw.P_WIND : Draw.P_SPEC; break;
            default: break;
        }
        if (o.st == Game.S_SPECIAL && (g.spK == Game.SP_RIDE || g.spK == Game.SP_TRUCK)) {
            boolean truck = g.spK == Game.SP_TRUCK;
            moto(c, o.x, Z, o.face, truck);
            person(c, o.x - o.face * (truck ? 20 : 6), truck ? 62 : 8, Z, o.face, lk, 0, 0, Draw.P_SPEC, 0, 0, -1, false, false);
            return;
        }
        if (g.mounted) {
            if (o.st == Game.S_DOWN || o.st == Game.S_DEAD) { person(c, o.x, o.h, Z, o.face, lk, 0, 0, Draw.P_DOWN, 0, o.flash, -1, false, true); return; }
            boolean roar = o.st == Game.S_SPECIAL && g.spK == Game.SP_ROAR;
            int rp = Draw.P_IDLE;
            if (o.st == Game.S_ATK) rp = g.comboStep == 3 ? Draw.P_KICK : Draw.P_PUNCH;
            else if (o.st == Game.S_JKICK) rp = Draw.P_SPIN;
            else if (o.st == Game.S_SPECIAL && g.spK == Game.SP_LANCE) rp = Draw.P_SPEC;
            raptor(c, o.x, o.h, Z, o.face, o.walk, mv, rp, pt, o.flash, roar);
            float old = lk.scale; lk.scale = 0.8f;
            person(c, o.x - o.face * 4, o.h + 70, Z, o.face, lk, 0, 0, Draw.P_SPEC, 0, o.flash, -1, false, false);
            lk.scale = old;
            return;
        }
        person(c, o.x, o.h, Z, o.face, lk, o.walk, mv, pose, pt, o.flash, g.weapon, false, true);
    }

    // ================================================================ FASE DO JET-SKI
    static void jetski(Canvas c, float X, float Z, float H, int face, float bank, Look rider, float flash, boolean patriot, float time, boolean ram) {
        shadow(c, X, Z, 60, 18, H + 6);
        model(X, H, Z, face, 1.1f, flash);
        rot(ram ? 9 : -2 + bank * 0.3f, -40, 4);
        // casco
        box(-50, 0, -13, 42, 13, 13, 0xFFF4F4F4);
        box(-50, 0, -13.4f, 42, 4, 13.4f, 0xFF1D3E9A);
        box(30, 5, -10, 58, 13, 10, 0xFFF4F4F4); box(52, 8, -6, 68, 13, 6, 0xFFF4F4F4);
        box(-50, 13, -12, 32, 19, 12, 0xFFFFD400);
        bias = 2;
        box(-30, 6, -13.8f, 20, 10, -13.4f, 0xFF1B8F3A);
        bias = 0;
        box(-12, 19, -10, 24, 30, 10, 0xFF1B8F3A);
        box(-48, 19, -6.5f, -14, 25, 6.5f, 0xFF212121);
        box(18, 26, -2, 22, 46, 2, 0xFF9E9E9E); box(17, 44, -15, 23, 48, 15, 0xFF424242);
        box(26, 30, -9, 29, 49, 9, 0x7790CAF9);
        // espuma / esteira
        float sp = (float) Math.sin(time * 30) * 2f;
        box(-74, 0, -12 + sp, -48, 4.5f + sp * 0.3f, 12 - sp, 0xAAFFFFFF);
        box(-96, 0, -8, -74, 3, 8, 0x77FFFFFF);
        if (patriot) { box(-46, 19, -1, -43, 70, 1, 0xFF5D4037); box(-43, 52, -0.6f, -12, 68, 0.6f, 0xFF1B8F3A); box(-34, 56, -0.9f, -22, 64, 0.9f, 0xFFFFD400); }
        // piloto
        float sc0 = rider.scale; rider.scale = 0.74f;
        person(c, X - face * 8, H + 22, Z, face, rider, time * 3, 0, ram ? Draw.P_PUNCH : Draw.P_SPEC, ram ? 1f : 0f, flash, -1, false, false);
        rider.scale = sc0;
    }

    static void whale(Canvas c, Jet.Whale w, float Z, float time) {
        float s = w.size;
        shadow(c, w.x, Z, 70 * s, 24 * s, 0);
        float dy = w.dying ? -Math.min(1f, w.sinkT) * 46 * s : 0;
        model(w.x, dy + (w.h > 0 ? w.h : 0), Z, -1, s, w.flash);
        if (w.dying) { alphaMul = Math.max(40, 255 - (int) (w.sinkT * 200)); rot(-w.sinkT * 38, 0, 20); }
        boolean dino = w.type == 0;
        int back = dino ? 0xFF4F6D86 : 0xFF5C6477, belly = dino ? 0xFFB5C9D8 : 0xFFC4C8D2, dark = Draw.shade(back, -0.25f);
        float sway = (float) Math.sin(time * 2.2f + w.id) * 3f;
        // cauda e nadadeira
        push(); rot(sway * 0.6f, -58, 20);
        box(-100, 10, -11, -56, 32, 11, dark);
        box(-124, 26, -32, -98, 31, 32, back);
        pop();
        // corpo
        box(-62, 0, -25, 42, 40, 25, back);
        box(-62, 0, -25.4f, 42, 12, 25.4f, belly);
        box(-40, 40, -14, 10, 47, 14, back);                 // dorso
        box(-8, 47, -2, 0, 62, 2, dark);                     // nadadeira dorsal
        // cabeça
        box(34, 0, -27, 88, 44, 27, back);
        box(34, 0, -27.4f, 88, 13, 27.4f, belly);
        box(88, 6, -19, 102, 36, 19, back);
        box(88, 6, -19.4f, 102, 12, 19.4f, belly);
        // nadadeira peitoral (lado da câmera)
        push(); rot(-22 + sway, 18, 8); box(2, -6, -44, 36, 8, -25, dark); pop();
        // ---- caricatura do rosto (lado visível: -z): placa de "pele" humana sobre a cabeça
        bias = 4;
        float zf = -27.9f;
        int skin = dino ? 0xFFD9A98A : 0xFFE9BFA3;
        box(38, 12, zf, 90, 46, zf + 0.5f, skin);
        box(90, 14, -19.4f, 101, 34, -18.8f, skin);
        bias = 5;
        if (dino) {
            box(38, 40, zf - 0.1f, 90, 47, zf + 0.5f, 0xFFF2D8C4);   // careca reluzente
            box(36, 30, zf - 0.1f, 42, 46, zf + 0.5f, 0xFF9A9A9A);   // cabelo grisalho lateral
            box(62, 4, zf - 0.1f, 84, 13, zf + 0.5f, 0xFFA8A8A8);    // cavanhaque
            box(58, 15, zf - 0.2f, 96, 21, zf + 0.5f, 0xFF3E3E3E);   // bigode escuro
        } else {
            box(28, 44, -19, 72, 56, 19, 0xFFF4F4F4);                // topete branco
            box(10, 42, -16, 40, 52, 16, 0xFFF4F4F4);
            box(36, 42, zf - 0.1f, 90, 49, zf + 0.5f, 0xFFEFEFEF);   // testa coberta de cabelo
            box(58, 14, zf - 0.2f, 98, 22, zf + 0.5f, 0xFFF0F0F0);   // bigodão branco
            box(58, 10, zf - 0.2f, 94, 14, zf + 0.5f, 0xFFD2D2D2);
            box(66, 24, zf - 0.1f, 76, 28, zf + 0.5f, 0xFFE59E94);   // bochecha corada
        }
        // olho + óculos (lentes translúcidas)
        float ex = dino ? 64 : 66;
        box(ex - 8, 26, zf - 0.2f, ex + 8, 39, zf + 0.5f, 0xFFFFFFFF);
        box(ex - 2, 29, zf - 0.3f, ex + 5, 36, zf + 0.5f, dino ? 0xFF3A2A1A : 0xFF2A3A55);
        box(ex, 31, zf - 0.4f, ex + 3, 34, zf + 0.5f, 0xFF000000);
        int fr = 0xFF121212;
        float fw = dino ? 1.7f : 1.2f;
        box(ex - 11, 37.5f, zf - 0.5f, ex + 11, 37.5f + fw * 1.4f, zf + 0.4f, fr);
        box(ex - 11, 23.5f, zf - 0.5f, ex + 11, 23.5f + fw * 1.4f, zf + 0.4f, fr);
        box(ex - 11, 23.5f, zf - 0.5f, ex - 11 + fw * 1.4f, 39, zf + 0.4f, fr);
        box(ex + 11 - fw * 1.4f, 23.5f, zf - 0.5f, ex + 11, 39, zf + 0.4f, fr);
        box(ex + 11, 30, zf - 0.5f, ex + 24, 32, zf + 0.4f, fr);          // haste dos óculos
        // sobrancelha grossa e boca
        box(ex - 11, 40.5f, zf - 0.5f, ex + 11, dino ? 44f : 45.5f, zf + 0.4f, dino ? 0xFF555555 : 0xFFF2F2F2);
        box(ex - 12, 7.5f, zf - 0.4f, ex + 30, 9.5f, zf + 0.4f, 0xFF3B1F1F);
        bias = 0;
        // respiro
        float sp = Math.max(0f, (float) Math.sin(time * 1.4f + w.id * 2f)) * 22f;
        if (sp > 2) box(-2, 47, -1.5f, 2, 47 + sp, 1.5f, 0x66E0F7FA);
        alphaMul = 255;
    }

    static void jetWorld(Canvas c, Jet j, Look[] heroLooks, boolean lite) {
        Scene.lake(c, j.camX, j.time, lite);
        zoom = 1f; fog = 0xFFCFEAF8; fogK = 0.3f;
        begin(j.camX);
        water(c, j.camX, j.time);
        for (Jet.Whale w : j.whales) { if (w.x > j.camX - 250 && w.x < j.camX + Game.W + 250) whale(c, w, zOf(w.y), j.time); }
        for (Jet.Patriot p : j.patriots) jetski(c, p.x, zOf(p.y), 0, 1, 0, heroLooks[p.look], 0, true, j.time, true);
        boolean blink = j.inv > 0 && j.inv < 3 && ((int) (j.time * 14) & 1) == 0 && j.specialT <= 0;
        if (!blink) jetski(c, j.x, zOf(j.y), j.h + (float) Math.sin(j.time * 9) * 1.4f, 1, j.bank, heroLooks[j.hero], j.flash, false, j.time, j.ramT > 0);
        flush(c);
        fogK = 0.22f;
    }

    static void water(Canvas c, float camX, float time) {
        float x0 = cx - 900, x1 = cx + 900, zn = -160;
        int strips = 12;
        for (int i = 0; i < strips; i++) {
            float za = zn + (Z_BACK - zn) * i / strips, zb = zn + (Z_BACK - zn) * (i + 1) / strips;
            float t = i / (float) (strips - 1);
            gquad(c, Draw.mix(0xFF0B6E99, 0xFF6FD0E6, t), x0, za, x1, zb, 0);
        }
        PT.setStyle(Paint.Style.STROKE);
        for (float z = -120; z < Z_BACK - 20; z += 46) {
            float t = (z + 120) / (Z_BACK + 120);
            PT.setStrokeWidth(1.2f + (1f - t) * 1.6f);
            PT.setColor(((int) (60 + (1f - t) * 70) << 24) | 0xFFFFFF);
            PATH.reset();
            boolean first = true;
            for (float x = cx - 900; x <= cx + 900; x += 50) {
                float wy = (float) Math.sin(x * 0.022f + time * 2.1f + z * 0.07f) * 2.4f;
                proj(x, wy, z);
                if (first) { PATH.moveTo(px, py); first = false; } else PATH.lineTo(px, py);
            }
            c.drawPath(PATH, PT);
        }
        PT.setStyle(Paint.Style.FILL);
        // brilhos do sol na água
        for (int i = 0; i < 40; i++) {
            float sx = cx - 800 + ((i * 197 + (float) Math.floor(camX * 0.4f)) % 1600);
            float sz = -60 + (i * 53 % 100) / 100f * (Z_BACK - 40);
            float tw = (float) Math.sin(time * 3 + i) * 0.5f + 0.5f;
            proj(sx, 0.5f, sz);
            Draw.circle(c, ((int) (40 + tw * 120) << 24) | 0xFFFFFF, px, py, 1.4f + tw * 1.8f);
        }
    }
}
