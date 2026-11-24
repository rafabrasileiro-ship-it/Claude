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
    // ---- tela virtual e modo de visão (horizontal ou vertical)
    /** tamanho da tela virtual em que o mundo 3D é desenhado (horizontal: 450 de altura; vertical: 450 de largura). */
    static float vw = 800, vh = 450;
    static boolean portrait;
    private static float scx = 400, scy = 350, kz = 1f, zcy = 300; // centro da projeção, zoom da lente e centro do "soco" de câmera
    private static float latC, zoff, zw = 1f;           // vertical: centro da faixa, profundidade em camX, alargamento lateral dos modelos
    /** y (tela) onde o piso termina e começa o cenário de fundo. */
    static float ftop = Scene.FLOOR_TOP;
    /** vertical: distância (ao longo da fase) visível até o horizonte. */
    static float xfar = 1200;
    static float cx;
    static float px, py, pd;                            // resultado da projeção
    static float zoom = 1f;                             // "soco" de câmera (zoom rápido nos impactos)
    static int alphaMul = 255;
    static int fog = 0xFFB9DDF2;                        // cor da neblina (por cenário)
    static float fogK = 0.22f;
    static final float Z_BACK;                          // onde o piso encontra o cenário de fundo (visão horizontal)
    private static float fx0, fx1, fzLo, fzHi;          // extensão do piso (estágio, faixa)
    private static int vmode = -1; private static float vA, vB;

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
        setLandscape(800);
    }

    /** visão horizontal: a tela virtual tem 450 de altura e w de largura (>= 800 quando o aparelho é mais comprido que 16:9). */
    static void setLandscape(float w) {
        portrait = false; vmode = 0; vA = w;
        vw = w; vh = 450; scx = w / 2; scy = 350; kz = 1f; zcy = 300; zw = 1f; latC = 0; zoff = 0;
        ftop = Scene.FLOOR_TOP;
    }

    /** visão vertical: câmera atrás do herói; o avanço da fase vai de baixo para cima na tela (w x h virtuais, w = 450). */
    static void setPortrait(float w, float h) {
        portrait = true; vmode = 1; vA = w; vB = h;
        vw = w; vh = h; kz = 1.1f; zw = 1.3f; latC = zOf((Game.Y0 + Game.Y1) / 2f);
        zoff = -330; scx = w / 2; zcy = h * 0.62f;
        float g0 = gAt(zoff), gt = g0 + (h + 6 - 0.26f * h) / (kz * F);
        float lo = zoff, hi = 8000;
        for (int i = 0; i < 40; i++) { float m = (lo + hi) / 2; if (gAt(m) < gt) lo = m; else hi = m; }
        xfar = lo - zoff;
        scy = h + 6 + kz * F * g0;
        ftop = 0.26f * h;
    }

    private static void restoreView() { if (vmode == 1) setPortrait(vA, vB); else setLandscape(vA); }

    /** inclinação do chão (y da câmera / z da câmera) para um ponto do piso à profundidade z. */
    private static float gAt(float z) {
        float rz = z - CZ;
        return (-CY * UY + rz * UZ) / (-CY * FY + rz * FZ);
    }

    static float zOf(float gameY) { return (Game.Y1 - gameY) * ZK; }

    /** ponto do mundo do jogo (X = ao longo da fase, Z = faixa) -> tela. */
    static void proj(float X, float Y, float Z) {
        if (portrait) projV(latC - Z, Y, X - cx + zoff); else projV(X - cx, Y, Z);
    }

    /** espaço da câmera: xl = lateral (0 = centro da tela), zv = profundidade. */
    private static void projV(float xl, float Y, float zv) {
        float ry = Y - CY, rz = zv - CZ;
        float zc = ry * FY + rz * FZ;
        float yc = ry * UY + rz * UZ;
        if (zc < 50) zc = 50;
        // escala lateral pela profundidade do chão: mantém as verticais retas (lente "tilt-shift")
        float zg = -CY * FY + rz * FZ;
        if (zg < 50) zg = 50;
        px = scx + kz * F * xl / zg;
        py = scy - kz * F * yc / zc;
        if (zoom != 1f) { px = scx + (px - scx) * zoom; py = zcy + (py - zcy) * zoom; }
        pd = zc;
    }

    // ---------------------------------------------------------------- lista de faces
    private static final int MAXQ = 14000;
    private static final float[] QX = new float[MAXQ * 4], QY = new float[MAXQ * 4];
    private static final int[] QC = new int[MAXQ];
    private static final byte[] QT = new byte[MAXQ];   // 0 = face, 1 = fumaça suave, 2 = brilho (fogo/fagulha)
    private static final long[] KEY = new long[MAXQ];
    private static int nq;
    private static final Path PATH = new Path();
    private static final Path SHP = new Path();        // união das sombras projetadas no chão
    private static boolean shAny;
    private static final Paint PT = new Paint(Paint.ANTI_ALIAS_FLAG);
    // luz principal (vinda de cima, da esquerda e da frente) e luz de contorno (por trás, à direita)
    private static final float LX = -0.42f, LY = 0.78f, LZ = -0.46f;
    private static final float L2X = 0.62f, L2Y = 0.42f, L2Z = 0.66f;
    private static final float SKX = 0.42f, SKZ = 0.36f; // inclinação da sombra projetada
    private static final int REFL = 1 << 21;             // chave extra: reflexos são desenhados antes de tudo

    /** o modelo atual projeta sombra / o piso é espelhado / o material emite luz própria. */
    static boolean cast, reflect, glow;
    /** giro em torno do eixo vertical (1 = de lado; passa por 0 = de frente; -1 = virado). */
    static float yawK = 1f;
    /** cor da luz ambiente (0..256 por canal), luz de contorno e sombra. */
    static int tR = 256, tG = 256, tB = 256, rimCol = 0xFFFFFFFF, shadowCol = 0x46000000, floorTone = 0xFF808080;
    static float rim = 0f;
    private static float aoH;                           // altura do degradê de oclusão do modelo
    private static int tex, texN;                        // textura por faixas: 1 = horizontais, 2 = verticais
    static final int TEX_H = 1, TEX_V = 2;

    static void begin(float camX) {
        cx = portrait ? camX : camX + vw / 2; nq = 0;
        if (portrait) { fx0 = cx - 300; fx1 = cx + xfar; fzLo = latC - 540; fzHi = latC + 540; }
        else { fx0 = cx - 900; fx1 = cx + 900; fzLo = -160; fzHi = Z_BACK; } tp = 0; ta = 1; tb = 0; tc = 0; td = 1; tx = 0; ty = 0; bias = 0;
        SHP.reset(); shAny = false; glow = false; tex = 0; yawK = 1f;
    }

    private static void drawShadows(Canvas c) {
        if (!shAny) return;
        PT.setStyle(Paint.Style.FILL);
        PT.setColor(shadowCol);
        c.save();
        c.clipRect(-200, ftop, vw + 200, vh + 300); // a sombra fica só no piso (não sobe pela parede do fundo)
        c.drawPath(SHP, PT);
        c.restore();
        SHP.reset(); shAny = false;
    }

    static int lastN;

    static void flush(Canvas c) {
        lastN = nq;
        java.util.Arrays.sort(KEY, 0, nq);
        boolean shDone = false;
        for (int k = nq - 1; k >= 0; k--) {
            long kk = KEY[k];
            int i = (int) (kk & 0xFFFFFFFFL), j = i * 4;
            if (!shDone && (kk >> 32) < REFL) { drawShadows(c); shDone = true; }
            if (QT[i] != 0) {
                float r = QX[j + 1];
                if (QT[i] == 1) Draw.puff(c, QC[i], QX[j], QY[j], r);
                else {
                    int col = QC[i];
                    Draw.puff(c, ((col >>> 25) << 24) | (col & 0xFFFFFF), QX[j], QY[j], r * 2.6f);
                    Draw.circle(c, col, QX[j], QY[j], Math.max(0.7f, r * 0.55f));
                }
                continue;
            }
            PATH.reset();
            PATH.moveTo(QX[j], QY[j]); PATH.lineTo(QX[j + 1], QY[j + 1]); PATH.lineTo(QX[j + 2], QY[j + 2]); PATH.lineTo(QX[j + 3], QY[j + 3]);
            PATH.close();
            PT.setStyle(Paint.Style.FILL_AND_STROKE);
            PT.setStrokeWidth(0.7f);
            PT.setStrokeJoin(Paint.Join.ROUND);
            PT.setColor(QC[i]);
            c.drawPath(PATH, PT);
        }
        if (!shDone) drawShadows(c);
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
    /** desliga as sombras projetadas (ícones de menu). */
    static boolean noCast;

    private static void model(float X, float Y, float Z, int face, float scale, float flash) {
        ox = X; oy = Y; oz = Z; mir = (face >= 0 ? 1 : -1) * yawK; sc = scale * BIG;
        ta = 1; tb = 0; tc = 0; td = 1; tx = 0; ty = 0; tp = 0; bias = 0;
        flashK = flash > 0 ? 0.7f : 0f;
        cast = Draw.q >= 1 && !noCast; glow = false; tex = 0; aoH = 0;
    }

    private static final float[] WX = new float[16], WY = new float[16], WZ = new float[16], SX = new float[16], SY = new float[16], SD = new float[16];
    private static final float[] RX = new float[16], RY = new float[16], HX = new float[16], HY = new float[16];
    private static final int[][] FACE = {{0, 4, 6, 2}, {1, 3, 7, 5}, {0, 1, 5, 4}, {2, 6, 7, 3}, {0, 2, 3, 1}, {4, 5, 7, 6}};
    private static final int[] SIDE = {2, 1, 0, 0, 1, 2}; // qual par de arestas da face é vertical

    private static void vert(int i, float lx, float ly, float lz) {
        float rx = ta * lx + tb * ly + tx, ry = tc * lx + td * ly + ty;
        float gx = ox + mir * sc * rx, gz = oz + sc * lz * zw;
        // espaço da câmera (lateral centrada / profundidade): na vertical o mundo é girado 90° em torno do eixo vertical
        if (portrait) { WX[i] = latC - gz; WZ[i] = gx - cx + zoff; } else { WX[i] = gx - cx; WZ[i] = gz; }
        WY[i] = oy + sc * ry;
        projV(WX[i], WY[i], WZ[i]);
        SX[i] = px; SY[i] = py; SD[i] = pd;
    }

    /** depois dos vértices: reflexo no piso e sombra projetada (casco convexo dos pontos achatados no chão). */
    private static void extras(int n, int color) {
        boolean solid = (color >>> 24) > 200 && alphaMul > 200 && !glow;
        if (reflect && solid) for (int i = 0; i < n; i++) { projV(WX[i], -WY[i], WZ[i]); RX[i] = px; RY[i] = py; }
        if (!cast || !solid) return;
        int start = 0;
        for (int i = 0; i < n; i++) {
            float h = WY[i] > 0 ? WY[i] : 0;
            projV(WX[i] + SKX * h, 0, WZ[i] + SKZ * h);
            HX[i] = px; HY[i] = py;
            if (px < HX[start]) start = i;
        }
        int cur = start, cnt = 0;
        do {
            if (cnt == 0) SHP.moveTo(HX[cur], HY[cur]); else SHP.lineTo(HX[cur], HY[cur]);
            int nxt = cur == 0 ? 1 : 0;
            for (int j = 0; j < n; j++) {
                if (j == cur) continue;
                float cr = (HX[nxt] - HX[cur]) * (HY[j] - HY[cur]) - (HY[nxt] - HY[cur]) * (HX[j] - HX[cur]);
                if (cr < -0.0001f) nxt = j;
                else if (cr < 0.0001f) { // colineares: fica com o mais distante
                    float da = Math.abs(HX[nxt] - HX[cur]) + Math.abs(HY[nxt] - HY[cur]), db = Math.abs(HX[j] - HX[cur]) + Math.abs(HY[j] - HY[cur]);
                    if (db > da) nxt = j;
                }
            }
            cur = nxt; cnt++;
        } while (cur != start && cnt <= n);
        SHP.close();
        shAny = true;
    }

    /** Emite uma face (se visível) já iluminada: difusa + contorno + oclusão + neblina + cor do ambiente. */
    private static void face(int a, int b, int c2, int d, float nx, float ny, float nz, int color, int side) {
        if (nq > MAXQ - 12) return;
        float mx = (WX[a] + WX[c2]) * 0.5f, my = (WY[a] + WY[c2]) * 0.5f, mz = (WZ[a] + WZ[c2]) * 0.5f;
        if (portrait) { float t = nx; nx = -nz; nz = t; } // normal do espaço do jogo -> espaço da câmera
        if (nx * (0 - mx) + ny * (CY - my) + nz * (CZ - mz) <= 0) return; // de costas para a câmera
        int al = (color >>> 24) * alphaMul / 255, r = (color >> 16) & 255, g = (color >> 8) & 255, bl = color & 255;
        if (!glow) {
            float lit = nx * LX + ny * LY + nz * LZ;
            float k = 0.60f + 0.40f * Math.max(0f, lit);
            if (ny < -0.5f) k = 0.45f;
            if (aoH > 0) { float hk = (my - oy) / aoH; if (hk < 1f) k *= 0.82f + 0.18f * Math.max(0f, hk); }
            r = (int) (r * k); g = (int) (g * k); bl = (int) (bl * k);
            if (Draw.q >= 1 && ny > 0.5f) { // luz do céu nas faces de cima
                r += (((fog >> 16) & 255) - r) >> 3; g += (((fog >> 8) & 255) - g) >> 3; bl += ((fog & 255) - bl) >> 3;
            }
            if (lit > 0.75f && Draw.q >= 2) { r += 14; g += 14; bl += 12; }
            r = r * tR >> 8; g = g * tG >> 8; bl = bl * tB >> 8;
            if (rim > 0) {
                float rl = nx * L2X + ny * L2Y + nz * L2Z;
                if (rl > 0) { rl *= rim; r += (int) (((rimCol >> 16) & 255) * rl); g += (int) (((rimCol >> 8) & 255) * rl); bl += (int) ((rimCol & 255) * rl); }
            }
            if (Draw.q >= 1) { // neblina por profundidade
                float dd = (SD[a] + SD[c2]) * 0.5f;
                float fk = Math.max(0f, Math.min(fogK, (dd - 1250f) / 2600f));
                if (fk > 0) { r += (int) ((((fog >> 16) & 255) - r) * fk); g += (int) ((((fog >> 8) & 255) - g) * fk); bl += (int) (((fog & 255) - bl) * fk); }
            }
            if (r > 255) r = 255; if (g > 255) g = 255; if (bl > 255) bl = 255;
        }
        int col = (al << 24) | (r << 16) | (g << 8) | bl;
        int j = nq * 4;
        QX[j] = SX[a]; QY[j] = SY[a]; QX[j + 1] = SX[b]; QY[j + 1] = SY[b]; QX[j + 2] = SX[c2]; QY[j + 2] = SY[c2]; QX[j + 3] = SX[d]; QY[j + 3] = SY[d];
        QC[nq] = col; QT[nq] = 0;
        int key = (int) (((SD[a] + SD[b] + SD[c2] + SD[d]) * 0.25f - bias) * 64f);
        KEY[nq] = ((long) key << 32) | nq;
        nq++;
        if (tex != 0 && side != 0 && Draw.q >= 2 && al > 200) { // textura: frisos finos mais escuros
            int dk = Draw.shade(col, -0.2f);
            boolean horiz = tex == TEX_H;
            // arestas "trilho": os frisos ligam pontos de mesmo t nas duas arestas
            int e0a, e0b, e1a, e1b;
            if ((side == 1) == horiz) { e0a = a; e0b = b; e1a = d; e1b = c2; } else { e0a = a; e0b = d; e1a = b; e1b = c2; }
            for (int s = 1; s <= texN && nq < MAXQ - 4; s++) {
                float t0 = s / (float) (texN + 1), t1 = t0 + 0.035f;
                int q4 = nq * 4;
                QX[q4] = SX[e0a] + (SX[e0b] - SX[e0a]) * t0; QY[q4] = SY[e0a] + (SY[e0b] - SY[e0a]) * t0;
                QX[q4 + 1] = SX[e1a] + (SX[e1b] - SX[e1a]) * t0; QY[q4 + 1] = SY[e1a] + (SY[e1b] - SY[e1a]) * t0;
                QX[q4 + 2] = SX[e1a] + (SX[e1b] - SX[e1a]) * t1; QY[q4 + 2] = SY[e1a] + (SY[e1b] - SY[e1a]) * t1;
                QX[q4 + 3] = SX[e0a] + (SX[e0b] - SX[e0a]) * t1; QY[q4 + 3] = SY[e0a] + (SY[e0b] - SY[e0a]) * t1;
                QC[nq] = dk; QT[nq] = 0; KEY[nq] = ((long) (key - 3) << 32) | nq; nq++;
            }
        }
        if (reflect && al > 200 && !glow && nq < MAXQ - 4) { // reflexo no piso polido
            int q4 = nq * 4;
            QX[q4] = RX[a]; QY[q4] = RY[a]; QX[q4 + 1] = RX[b]; QY[q4 + 1] = RY[b]; QX[q4 + 2] = RX[c2]; QY[q4 + 2] = RY[c2]; QX[q4 + 3] = RX[d]; QY[q4 + 3] = RY[d];
            float fade = Math.max(0.15f, 1f - (my > 0 ? my : 0) / 190f);
            QC[nq] = ((int) (70 * fade) << 24) | (Draw.mix(col, floorTone, 0.35f) & 0xFFFFFF); QT[nq] = 0;
            KEY[nq] = ((long) (key + REFL) << 32) | nq; nq++;
        }
    }

    /** Bloco alinhado aos eixos locais (depois transformado). */
    private static void box(float x0, float y0, float z0, float x1, float y1, float z1, int color) {
        if (nq > MAXQ - 12) return;
        if (flashK > 0) color = Draw.mix(color, 0xFFFFFFFF, flashK);
        for (int i = 0; i < 8; i++) vert(i, (i & 1) == 0 ? x0 : x1, (i & 2) == 0 ? y0 : y1, (i & 4) == 0 ? z0 : z1);
        extras(8, color);
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
            face(q[0], q[1], q[2], q[3], nx, ny, nz, color, SIDE[f]);
        }
    }

    private static final float[] OUX = {1, 1, 0, 0, -1, -1, 0, 0}, OUZ = {0, 0, 1, 1, 0, 0, -1, -1};
    private static final float[] CXU = {0, 0, 1, -1, 0, 0, -1, 1}, CZU = {-1, 1, 0, 0, 1, -1, 0, 0};

    /**
     * Prisma de base octogonal (cantos chanfrados) e afunilado: s0/s1 = escala da seção na base/topo,
     * ch = quanto da face plana sobra (0.45 = quase redondo, 0.85 = quase um bloco).
     */
    private static void oct(float x0, float y0, float z0, float x1, float y1, float z1, int color, float s0, float s1, float ch) {
        if (Draw.q < 1) { box(x0, y0, z0, x1, y1, z1, color); return; }
        if (nq > MAXQ - 30) return;
        if (flashK > 0) color = Draw.mix(color, 0xFFFFFFFF, flashK);
        float cxl = (x0 + x1) * 0.5f, czl = (z0 + z1) * 0.5f, hx = (x1 - x0) * 0.5f, hz = (z1 - z0) * 0.5f;
        for (int i = 0; i < 8; i++) {
            float ux = OUX[i] + CXU[i] * ch, uz = OUZ[i] + CZU[i] * ch;
            vert(i, cxl + hx * s0 * ux, y0, czl + hz * s0 * uz);
            vert(8 + i, cxl + hx * s1 * ux, y1, czl + hz * s1 * uz);
        }
        extras(16, color);
        float dl = (float) Math.sqrt(hx * hx + hz * hz);
        float dx = hz / dl, dz = hx / dl;
        for (int i = 0; i < 8; i++) {
            float lnx, lnz;
            switch (i) {
                case 0: lnx = 1; lnz = 0; break;
                case 1: lnx = dx; lnz = dz; break;
                case 2: lnx = 0; lnz = 1; break;
                case 3: lnx = -dx; lnz = dz; break;
                case 4: lnx = -1; lnz = 0; break;
                case 5: lnx = -dx; lnz = -dz; break;
                case 6: lnx = 0; lnz = -1; break;
                default: lnx = dx; lnz = -dz; break;
            }
            int n = (i + 1) & 7;
            face(i, n, 8 + n, 8 + i, ta * lnx * mir, tc * lnx, lnz, color, 2);
        }
        float tnx = tb * mir, tny = td;
        face(8, 9, 10, 15, tnx, tny, 0, color, 0); face(10, 11, 14, 15, tnx, tny, 0, color, 0); face(11, 12, 13, 14, tnx, tny, 0, color, 0);
        face(0, 1, 2, 7, -tnx, -tny, 0, color, 0); face(2, 3, 6, 7, -tnx, -tny, 0, color, 0); face(3, 4, 5, 6, -tnx, -tny, 0, color, 0);
    }

    private static void oct(float x0, float y0, float z0, float x1, float y1, float z1, int color) { oct(x0, y0, z0, x1, y1, z1, color, 1f, 1f, 0.45f); }

    /** Partícula suave (fumaça, poeira) em coordenadas do mundo, ordenada por profundidade com os modelos. */
    static void puff(float X, float Y, float Z, float r, int color) { sprite(X, Y, Z, r, color, (byte) 1); }

    /** Ponto de luz (chama, fagulha). */
    static void spark(float X, float Y, float Z, float r, int color) { sprite(X, Y, Z, r, color, (byte) 2); }

    private static void sprite(float X, float Y, float Z, float r, int color, byte type) {
        if (nq > MAXQ - 4 || (color >>> 24) < 3) return;
        proj(X, Y, Z);
        float sx = px, sy = py, d = pd;
        proj(X + r, Y, Z);
        int j = nq * 4;
        QX[j] = sx; QY[j] = sy; QX[j + 1] = Math.abs(px - sx);
        QC[nq] = color; QT[nq] = type;
        KEY[nq] = ((long) (int) ((d - bias) * 64f) << 32) | nq;
        nq++;
    }

    /** partícula em coordenadas locais do modelo atual. */
    private static void lpuff(float lx, float ly, float lz, float r, int color, boolean fire) {
        float rx = ta * lx + tb * ly + tx, ry = tc * lx + td * ly + ty;
        sprite(ox + mir * sc * rx, oy + sc * ry, oz + sc * lz, r * sc, color, (byte) (fire ? 2 : 1));
    }

    /** coluna de fumaça subindo de um ponto do mundo (n baforadas em ciclo contínuo). */
    static void smoke(float X, float Y, float Z, float rise, float r0, int rgb, int alpha, int n, float seed) {
        for (int i = 0; i < n; i++) {
            float sp = (Draw.time * 0.32f + i / (float) n + seed) % 1f;
            float wob = (float) Math.sin(sp * 5.3f + i * 1.7f + seed * 9f);
            int al = (int) (alpha * (sp < 0.15f ? sp / 0.15f : 1f - (sp - 0.15f) / 0.85f));
            puff(X + wob * r0 * (0.4f + sp) + sp * rise * 0.35f, Y + sp * rise, Z, r0 * (0.7f + sp * 2.2f), (al << 24) | (rgb & 0xFFFFFF));
        }
    }

    /** chama animada (línguas de fogo feitas de pontos de luz) em coordenadas do mundo. */
    static void flame(float X, float Y, float Z, float size, float seed) {
        float t = Draw.time;
        puff(X, Y + size * 0.3f, Z, size * 0.95f, 0x50FF6A1A); // clarão
        for (int i = 0; i < 6; i++) {
            float sp = (t * 1.3f + i / 6f + seed) % 1f;
            float wob = (float) Math.sin(sp * 6f + i * 2.1f + seed * 7f + t * 3) * size * 0.16f * (0.4f + sp);
            int col = sp < 0.25f ? 0xFFF59D : sp < 0.55f ? 0xFFA726 : 0xE64A19;
            int al = (int) (250 * (1f - sp * sp));
            puff(X + wob, Y + sp * size, Z - 1, size * 0.34f * (1.15f - sp * 0.8f), (al << 24) | col);
        }
        spark(X + (float) Math.sin(t * 9 + seed * 5) * size * 0.08f, Y + size * 0.12f, Z - 2, size * 0.1f, 0xE0FFFDE0);
        // fagulha que se solta e sobe
        float sp = (t * 0.7f + seed * 3.3f) % 1f;
        spark(X + (float) Math.sin(sp * 9 + seed) * size * 0.5f + sp * size * 0.6f, Y + size * (0.8f + sp * 1.8f), Z, 1.1f, (((int) (230 * (1f - sp))) << 24) | 0xFFC04A);
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

    /** aplica a cor da luz ambiente a uma cor do chão. */
    private static int lit(int col) {
        if (tR == 256 && tG == 256 && tB == 256) return col;
        return (col & 0xFF000000) | (Math.min(255, ((col >> 16) & 255) * tR >> 8) << 16) | (Math.min(255, ((col >> 8) & 255) * tG >> 8) << 8) | Math.min(255, (col & 255) * tB >> 8);
    }

    private static void gquad(Canvas c, int color, float x0, float z0, float x1, float z1, float y) {
        proj(x0, y, z0); GX[0] = px; GY[0] = py;
        proj(x1, y, z0); GX[1] = px; GY[1] = py;
        proj(x1, y, z1); GX[2] = px; GY[2] = py;
        proj(x0, y, z1); GX[3] = px; GY[3] = py;
        groundPoly(c, lit(color), 4);
    }

    private static void gline(Canvas c, int color, float x0, float y0, float z0, float x1, float y1, float z1, float w) {
        proj(x0, y0, z0); float ax = px, ay = py; proj(x1, y1, z1);
        PT.setStyle(Paint.Style.STROKE); PT.setStrokeWidth(w); PT.setColor(lit(color));
        c.drawLine(ax, ay, px, py, PT);
        PT.setStyle(Paint.Style.FILL);
    }

    /** Sombra de contato (oclusão) sob o modelo; a sombra projetada vem dos próprios blocos. */
    static void shadow(Canvas c, float X, float Z, float rx, float rz, float h) {
        float k = 1f / (1f + h / 120f);
        int n = 12;
        boolean proj3 = Draw.q >= 1 && !noCast;
        for (int pass = 0; pass < (Draw.q >= 1 ? 2 : 1); pass++) {
            float m = (pass == 0 ? 1.15f : 0.7f) * (proj3 ? 0.8f : 1.1f);
            for (int i = 0; i < n; i++) {
                double a = i * Math.PI * 2 / n;
                proj(X + (proj3 ? 0 : rx * 0.3f) + (float) Math.cos(a) * rx * m * k, 0, Z + (proj3 ? 0 : rz * 0.2f) + (float) Math.sin(a) * rz * m * k);
                GX[i] = px; GY[i] = py;
            }
            groundPoly(c, proj3 ? (pass == 0 ? 0x1E000000 : 0x2C000000) : (pass == 0 ? 0x33000000 : 0x44000000), n);
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
            {0xFFDCD3C3, 0xFFBDB29E}, {0xFF7C5634, 0xFF5E3F24}};

    private static float hash(float a, float b) {
        float v = (float) Math.sin(a * 12.9898f + b * 78.233f) * 43758.547f;
        return v - (float) Math.floor(v);
    }

    static void floor(Canvas c, int theme, float camX) {
        int col = FLOOR[theme][0], ln = FLOOR[theme][1];
        floorTone = lit(col);
        float x0 = fx0, x1 = fx1, zB = fzHi;
        float l600 = portrait ? fx0 : cx - 600, h600 = portrait ? fx1 : cx + 600, l700 = portrait ? fx0 : cx - 700, h700 = portrait ? fx1 : cx + 700;
        int strips = 12;
        float zn = fzLo;
        for (int i = 0; i < strips; i++) {
            float za = zn + (zB - zn) * i / strips, zb = zn + (zB - zn) * (i + 1) / strips;
            int sc0 = Draw.shade(col, -0.30f * i / strips + 0.04f);
            if (Draw.q >= 1) sc0 = Draw.mix(sc0, fog, 0.16f * i / strips);
            gquad(c, sc0, x0, za, x1, zb, 0);
        }
        boolean hi = Draw.q >= 2;
        float gx = (float) Math.floor(fx0 / 100f) * 100f;
        switch (theme) {
            case Data.TH_NOVELA: case Data.TH_BBB: { // assoalho: tábuas corridas com emendas alternadas
                for (float z = zs(-150, 50); z < zB; z += 50) {
                    int row = (int) Math.floor(z / 50f);
                    if (hi && (row & 1) == 0) gquad(c, 0x12000000, x0, z, x1, Math.min(zB, z + 50), 0.1f);
                    gline(c, ln, x0, 0.1f, z, x1, 0.1f, z, 1.3f);
                    float sh = (row & 1) * 110 + (row % 3) * 37;
                    for (float x = gx - 220 + sh; x < fx1; x += 220) gline(c, ln, x, 0.1f, z, x, 0.1f, Math.min(zB, z + 50), 1.2f);
                }
                break;
            }
            case Data.TH_CAMPUS: { // gramado com tufos e caminho de saibro
                if (hi) for (float x = gx; x < fx1; x += 100) for (float z = zs(-100, 100); z < zB; z += 100) {
                    float h = hash(x * 0.01f, z * 0.01f);
                    if (h > 0.55f) gquad(c, h > 0.8f ? 0x16FFFFFF : 0x14003300, x + h * 30, z + h * 20, x + 60 + h * 30, z + 44, 0.1f);
                }
                gquad(c, 0xFFD8C9A0, x0, 40, x1, 200, 0.2f);
                gquad(c, 0xFFC4B48A, x0, 40, x1, 48, 0.25f); gquad(c, 0xFFC4B48A, x0, 192, x1, 200, 0.25f);
                if (Draw.q >= 1) for (float x = gx; x < fx1; x += 50) for (int k = 0; k < 3; k++) {
                    float h = hash(x * 0.02f, k * 3.1f), z = k == 0 ? -120 + h * 150 : 210 + h * (zB - 240), bx = x + h * 40;
                    gline(c, k == 1 ? 0xFF3E8E41 : 0xFF7CC36A, bx, 0, z, bx + 3, 9 + h * 6, z, 1.5f);
                    gline(c, 0xFF4C9A4E, bx + 4, 0, z, bx + 1, 7 + h * 5, z, 1.3f);
                }
                break;
            }
            case Data.TH_FAZENDA: { // terra batida com sulcos do arado, palha e manchas de queimado
                for (float z = zs(-140, 42); z < zB; z += 42) {
                    gquad(c, 0x24000000, x0, z, x1, z + 9, 0.1f);
                    if (hi) gquad(c, 0x12FFE0B0, x0, z + 9, x1, z + 14, 0.1f);
                }
                if (Draw.q >= 1) for (float x = gx; x < fx1; x += 100) for (float z = zs(-100, 100); z < zB; z += 100) {
                    float h = hash(x * 0.013f, z * 0.017f);
                    if (h > 0.7f) { // mancha de queimado (irregular)
                        float bx = x + h * 40, bz = z + 10;
                        gquad(c, 0x26100A06, bx, bz, bx + 44 + h * 40, bz + 30, 0.12f); gquad(c, 0x26100A06, bx + 12, bz - 8, bx + 30 + h * 50, bz + 18, 0.12f); gquad(c, 0x22100A06, bx - 10, bz + 8, bx + 26, bz + 40, 0.12f);
                    }
                    else if (h > 0.4f) { float bx = x + h * 90, bz = z + h * 60; gline(c, 0xFFD9B45A, bx, 0.3f, bz, bx + 16, 0.3f, bz + 5, 1.6f); gline(c, 0xFFC49A3C, bx + 5, 0.3f, bz + 8, bx + 19, 0.3f, bz - 2, 1.4f); } // palha
                    else if (h > 0.25f) { float bx = x + h * 200, bz = z + 30; gline(c, 0xFF2A1A10, bx, 0, bz, bx + 2, 12, bz, 1.6f); gline(c, 0xFF2A1A10, bx + 5, 0, bz, bx + 8, 8, bz, 1.4f); } // toco queimado
                }
                break;
            }
            default: { // placas/ladrilhos em perspectiva real
                boolean checker = theme == Data.TH_TRIBUNAL || theme == Data.TH_PALCO || theme == Data.TH_JORNAL;
                if (Draw.q >= 1) for (float x = gx; x < fx1; x += 100) for (float z = zs(-200, 100); z < zB; z += 100) {
                    int ix = (int) Math.floor(x / 100f), iz = (int) Math.floor(z / 100f);
                    float h = hash(ix, iz);
                    float za = Math.max(zn, z), zb = Math.min(zB, z + 100);
                    if (checker) { if (((ix + iz) & 1) == 0) gquad(c, theme == Data.TH_TRIBUNAL ? 0x24604830 : 0x26000000, x, za, x + 100, zb, 0.1f); }
                    else if (h > 0.6f) gquad(c, h > 0.8f ? 0x12FFFFFF : 0x16000000, x, za, x + 100, zb, 0.1f);
                    if (hi && !checker && h > 0.3f && h < 0.5f) { // remendo e rachadura no asfalto/concreto
                        float bx = x + 20 + h * 100, bz = za + 30;
                        gline(c, 0x50000000, bx, 0.1f, bz, bx + 22, 0.1f, bz + 16, 1.2f); gline(c, 0x50000000, bx + 22, 0.1f, bz + 16, bx + 30, 0.1f, bz + 42, 1.1f);
                    }
                    if (hi && theme == Data.TH_TRIBUNAL && h > 0.45f) gline(c, 0x40FFFFFF, x + h * 60, 0.1f, za + 10, x + 30 + h * 60, 0.1f, zb - 20, 1.1f); // veio do mármore
                }
                PT.setStyle(Paint.Style.STROKE); PT.setStrokeWidth(1.4f); PT.setColor(lit(ln));
                for (float x = gx; x < fx1; x += 100) { proj(x, 0, zn); float ax = px, ay = py; proj(x, 0, zB); c.drawLine(ax, ay, px, py, PT); }
                for (float z = zs(-100, 100); z < zB; z += 100) { proj(x0, 0, z); float ax = px, ay = py; proj(x1, 0, z); c.drawLine(ax, ay, px, py, PT); }
                PT.setStyle(Paint.Style.FILL);
            }
        }
        if (theme == Data.TH_PAULISTA) { // faixa tracejada e sarjeta
            float s = (float) Math.floor(l600 / 160f) * 160f;
            for (float x = s; x < h600; x += 160) gquad(c, 0xFFFFD600, x, 70, x + 70, 78, 0.2f);
            gquad(c, 0xFFE8E8E8, x0, zB - 60, x1, zB - 54, 0.2f);
        }
        if (theme == Data.TH_QUARENT) { // marcação de distanciamento no chão
            float s = (float) Math.floor(l600 / 240f) * 240f;
            for (float x = s; x < h600; x += 240) { gquad(c, 0xFFFFD600, x, 60, x + 60, 66, 0.2f); gquad(c, 0xFFFFD600, x, 114, x + 60, 120, 0.2f); gquad(c, 0xFFFFD600, x, 60, x + 6, 120, 0.2f); gquad(c, 0xFFFFD600, x + 54, 60, x + 60, 120, 0.2f); }
        }
        if (reflect && Draw.q >= 2) { // brilho especular do piso polido
            float s = (float) Math.floor(l700 / 260f) * 260f;
            for (float x = s; x < h700; x += 260) gquad(c, 0x14FFFFFF, x + 40, -140, x + 70, zB, 0.15f);
        }
        // oclusão ao pé da parede do fundo + meio-fio
        if (Draw.q >= 1) for (int i = 0; i < 4; i++) gquad(c, 0x12000000, x0, zB - 70 + i * 16, x1, zB, 0.25f);
        gquad(c, Draw.shade(col, -0.45f), x0, zB - 14, x1, zB, 0.3f);
        horizonHaze(c);
    }

    /** vertical: o piso se dissolve em névoa perto do horizonte. */
    private static void horizonHaze(Canvas c) {
        if (!portrait || Draw.q < 1) return;
        int n = 14;
        for (int i = 0; i < n; i++) {
            float t = i / (float) n;
            Draw.rect(c, ((int) (0xA8 * (1f - t) * (1f - t)) << 24) | (fog & 0xFFFFFF), 0, ftop - 2 + t * 110, vw, ftop + 110 * (i + 1f) / n);
        }
    }

    /** Objetos 3D de cenário ao fundo da rua (postes, colunas, árvores...). */
    static void props(int theme, float camX) {
        propsRow(theme, zOf(Game.Y0) + 70, 0);
        if (portrait) propsRow(theme, zOf(Game.Y1) - 110, 1); // na vertical também há objetos do outro lado da pista
    }

    private static float zs(float c0, float step) { return portrait ? (float) Math.floor(fzLo / step) * step : c0; }

    private static void propsRow(int theme, float zb, int pass) {
        float s = (float) Math.floor((portrait ? fx0 : cx - 700) / 260f) * 260f, xe = portrait ? fx1 : cx + 700;
        for (float x = s; x < xe; x += 260) {
            int idx = (int) Math.floor(x / 260f) + pass * 3;
            boolean alt = (idx & 1) != 0;
            model(x + 60, 0, zb, 1, 1, 0);
            switch (theme) {
                case Data.TH_PAULISTA: case Data.TH_PORTAO: // poste de luz, lixeira e banco
                    oct(-9, 0, -9, 9, 8, 9, 0xFF3C4046, 1f, 0.6f, 0.45f); oct(-3.2f, 8, -3.2f, 3.2f, 150, 3.2f, 0xFF54585F, 1f, 0.7f, 0.45f);
                    box(-3, 146, -3, 34, 151, 3, 0xFF54585F); box(20, 141, -6, 40, 147, 6, 0xFF3C4046);
                    glow = true; box(22, 139, -5, 38, 141.5f, 5, 0xFFFFF3B0); glow = false;
                    if (theme == Data.TH_PORTAO || Draw.q >= 2) { cast = false; box(18, 60, -9, 42, 139, 9, theme == Data.TH_PORTAO ? 0x16FFE9A0 : 0x0CFFF3B0); cast = Draw.q >= 1; }
                    if (alt) { // lixeira
                        oct(96, 0, -9, 114, 28, 9, 0xFF2E7D32, 0.85f, 1f, 0.45f); oct(95, 28, -10, 115, 31, 10, 0xFF1B5E20);
                    } else { // banco de praça
                        tex = TEX_H; texN = 2; box(84, 16, -10, 136, 20, 8, 0xFF8D6E63); box(84, 20, 5, 136, 38, 8, 0xFF8D6E63); tex = 0;
                        box(88, 0, -8, 92, 16, 8, 0xFF37474F); box(128, 0, -8, 132, 16, 8, 0xFF37474F);
                    }
                    break;
                case Data.TH_QUARENT: // barreira, cone e totem de álcool em gel
                    box(-40, 0, -6, 40, 34, 6, 0xFFE8E8E8); box(-40, 22, -6.5f, 40, 30, 6.5f, 0xFFFFC400); box(-40, 34, -2, 40, 70, 2, 0x6690CAF9);
                    box(-42, 0, -8, -36, 4, 8, 0xFF9E9E9E); box(36, 0, -8, 42, 4, 8, 0xFF9E9E9E);
                    box(68, 0, -10, 88, 3, 10, 0xFFFF6D00); oct(71, 3, -7, 85, 28, 7, 0xFFFF6D00, 1f, 0.25f, 0.45f);
                    bias = 2; oct(73.5f, 12, -5.2f, 82.5f, 17, 5.2f, 0xFFFFFFFF, 1f, 0.8f, 0.45f); bias = 0;
                    if (alt) { oct(118, 0, -7, 132, 4, 7, 0xFF546E7A); oct(122.5f, 4, -2.5f, 127.5f, 46, 2.5f, 0xFFB0BEC5); box(118, 46, -6, 132, 62, 6, 0xFFE0F7FA); bias = 2; box(121, 50, -6.5f, 129, 58, -6, 0xFF26A69A); bias = 0; }
                    break;
                case Data.TH_CAMPUS: { // árvore de copa cheia
                    tex = TEX_V; texN = 2; oct(-7, 0, -7, 7, 62, 7, 0xFF6D4C41, 1.25f, 0.8f, 0.45f); tex = 0;
                    push(); rot(-38, 0, 46); oct(-3, 44, -3, 3, 70, 3, 0xFF5D4037); pop();
                    oct(-36, 56, -36, 36, 92, 36, 0xFF2E7D32, 0.7f, 1f, 0.45f); oct(-30, 92, -30, 30, 122, 30, 0xFF388E3C, 1f, 0.8f, 0.45f);
                    oct(-18, 122, -18, 18, 148, 18, 0xFF43A047, 1f, 0.5f, 0.45f);
                    oct(18, 70, -24, 46, 98, 8, 0xFF388E3C, 0.8f, 0.7f, 0.45f); oct(-48, 76, -6, -20, 104, 22, 0xFF2E7D32, 0.8f, 0.7f, 0.45f);
                    bias = 2; box(-12, 100, -31, -2, 108, -30, 0xFF66BB6A); box(8, 78, -37, 20, 86, -36, 0xFF4CAF50); bias = 0;
                    if (alt) { tex = TEX_H; texN = 2; box(90, 14, -9, 140, 18, 9, 0xFFA1887F); tex = 0; box(94, 0, -7, 98, 14, 7, 0xFF5D4037); box(132, 0, -7, 136, 14, 7, 0xFF5D4037); }
                    break;
                }
                case Data.TH_NOVELA: case Data.TH_PALCO: case Data.TH_BBB: case Data.TH_JORNAL: { // refletor de estúdio e câmera
                    oct(-2.5f, 0, -2.5f, 2.5f, 120, 2.5f, 0xFF2B2B2B); box(-16, 0, -2, 16, 3, 2, 0xFF2B2B2B); box(-2, 0, -16, 2, 3, 16, 0xFF2B2B2B);
                    oct(-13, 116, -11, 13, 140, 9, 0xFF1C1C1C, 1f, 1f, 0.7f);
                    int lc = theme == Data.TH_PALCO ? (alt ? 0xFFE1BEE7 : 0xFF80DEEA) : 0xFFFFF8D0;
                    glow = true; box(-10, 119, -14, 10, 137, -11, lc); glow = false;
                    if (Draw.q >= 2) { cast = false; box(-12, 20, -60, 12, 119, -14, (0x12 << 24) | (lc & 0xFFFFFF)); cast = true; }
                    if (alt) { // câmera de estúdio sobre pedestal
                        oct(104, 0, -10, 126, 5, 10, 0xFF212121); oct(112, 5, -3, 118, 70, 3, 0xFF424242);
                        box(100, 70, -9, 132, 90, 9, 0xFF263238); oct(132, 74, -6, 146, 86, 6, 0xFF111111); bias = 2; box(146, 76, -4, 147, 84, 4, 0xFF4FC3F7); bias = 0;
                        box(96, 78, -3, 100, 94, 3, 0xFF37474F);
                    }
                    break;
                }
                case Data.TH_FAZENDA: farmProp(x + 60, zb, idx); break;
                default: // coluna de mármore canelada
                    box(-22, 0, -22, 22, 12, 22, 0xFFE3DED2); oct(-18, 12, -18, 18, 17, 18, 0xFFD8D2C4);
                    tex = TEX_V; texN = 2; oct(-15, 17, -15, 15, 165, 15, 0xFFF7F4EC, 1f, 0.88f, 0.45f); tex = 0;
                    oct(-18, 165, -18, 18, 170, 18, 0xFFD8D2C4); box(-22, 170, -22, 22, 182, 22, 0xFFE3DED2);
                    if (alt) { oct(96, 0, -8, 112, 30, 8, 0xFF8D6E63, 0.8f, 1f, 0.45f); oct(88, 30, -16, 120, 52, 16, 0xFF2E7D32, 0.6f, 1f, 0.45f); oct(94, 52, -10, 114, 66, 10, 0xFF388E3C, 1f, 0.5f, 0.45f); }
            }
        }
    }

    /** Fazenda invadida: barraca de lona preta do MST, cerca, bandeira e touceiras da plantação em chamas. */
    private static void farmProp(float X, float zb, int idx) {
        float d = Scene.dusk;
        int kind = ((idx % 3) + 3) % 3;
        if (kind == 0) { // barraca de lona preta (estrutura em A) + bandeira do MST
            for (int sgn = -1; sgn <= 1; sgn += 2) {
                push(); rot(sgn * 38, sgn * 34, 0);
                tex = TEX_V; texN = 3; box(sgn * 34 - 1.5f, 0, -30, sgn * 34 + 1.5f, 56, 30, 0xFF1E1E22); tex = 0;
                pop();
            }
            box(-1.5f, 0, -31, 1.5f, 48, -29, 0xFF6D4C41); box(-1.5f, 0, 29, 1.5f, 48, 31, 0xFF6D4C41); box(-1, 44, -31, 1, 46, 31, 0xFF6D4C41);
            box(-20, 0, 26, 20, 30, 27, 0xFF15151A);
            mstFlag(52, 0, -6, 104);
            // fogueira do acampamento
            box(70, 0, -20, 88, 4, -12, 0xFF3E2723); box(74, 0, -24, 80, 5, -8, 0xFF4E342E);
            flame(X + 79, 5, zb - 16, 20, idx * 0.37f);
            if (Draw.q >= 1) smoke(X + 79, 24, zb - 16, 110, 7, 0x3A3A3A, 110, 5, idx * 0.21f);
        } else if (kind == 1) { // plantação pegando fogo
            for (int i = 0; i < 7; i++) {
                float h = hash(idx, i), bx = -70 + i * 24 + h * 8, bz = (i & 1) * 26 - 6;
                int burnt = h < d * 1.2f ? 0xFF1A120C : (i % 3 == 0 ? 0xFF9E9D24 : 0xFF7CB342);
                push(); rot((h - 0.5f) * 14 + (float) Math.sin(Draw.time * 2 + i) * 2, bx, 0);
                box(bx - 1.3f, 0, bz - 1.3f, bx + 1.3f, 58 + h * 22, bz + 1.3f, burnt);
                box(bx - 9, 30 + h * 10, bz - 0.8f, bx + 9, 33 + h * 10, bz + 0.8f, burnt); box(bx - 0.8f, 44 + h * 8, bz - 8, bx + 0.8f, 47 + h * 8, bz + 8, burnt);
                pop();
                if (h < 0.25f + d * 0.75f) flame(X + bx, 6 + h * 30, zb + bz, 26 + d * 30 + h * 14, idx * 0.31f + i * 0.17f);
            }
            if (Draw.q >= 1) smoke(X - 10, 60, zb + 10, 150 + d * 60, 12 + d * 6, 0x2E2A28, (int) (90 + d * 90), 6, idx * 0.13f);
        } else { // cerca de arame farpado derrubada + fardo de feno + bandeira
            for (int i = 0; i < 3; i++) { push(); rot(i == 1 ? -24 : 3, -60 + i * 60, 0); oct(-63 + i * 60, 0, -3, -57 + i * 60, 46, 3, 0xFF6D4C41, 1f, 0.8f, 0.5f); pop(); }
            box(-60, 30, -0.5f, 60, 31, 0.5f, 0xFF9E9E9E); box(-60, 16, -0.5f, 60, 17, 0.5f, 0xFF9E9E9E);
            tex = TEX_V; texN = 3; oct(74, 0, -16, 112, 30, 16, 0xFFD9B45A, 1f, 1f, 0.7f); tex = 0;
            bias = 2; box(73.5f, 12, -16.5f, 112.5f, 15, 16.5f, 0xFF8D6E63); bias = 0;
            mstFlag(-90, 0, 8, 92);
            if (d > 0.3f) { flame(X + 93, 30, zb, 18 + d * 16, idx * 0.41f); if (Draw.q >= 1) smoke(X + 93, 46, zb, 120, 8, 0x333333, (int) (d * 130), 4, idx * 0.29f); }
        }
    }

    /** bandeira vermelha do MST num mastro fincado no chão (círculo branco com o mapa verde no meio). */
    private static void mstFlag(float x, float y, float z, float h) {
        oct(x - 1.3f, y, z - 1.3f, x + 1.3f, y + h, z + 1.3f, 0xFF8D6E63);
        float wv = (float) Math.sin(Draw.time * 5 + x) * 4;
        push(); rot(wv, x, y + h - 12);
        box(x + 1.3f, y + h - 26, z - 0.6f, x + 20, y + h - 1, z + 0.6f, 0xFFD32F2F);
        push(); rot(wv * 0.8f, x + 20, y + h - 12);
        box(x + 20, y + h - 26, z - 0.6f, x + 40, y + h - 1, z + 0.6f, 0xFFC62828);
        pop();
        bias = 2;
        box(x + 12, y + h - 19, z - 1f, x + 28, y + h - 8, z + 1f, 0xFFFFFFFF); box(x + 14.5f, y + h - 21.5f, z - 1f, x + 25.5f, y + h - 5.5f, z + 1f, 0xFFFFFFFF);
        bias = 3; box(x + 16.5f, y + h - 17.5f, z - 1.3f, x + 23.5f, y + h - 9.5f, z + 1.3f, 0xFF2E7D32); bias = 0;
        pop();
    }

    // ---------------------------------------------------------------- pessoa 3D
    private static float aHipF, aKneeF, aHipB, aKneeB, aShN, aElN, aShF, aElF, aLean;
    /** cavaleiro: 1 = chicote na mão próxima e bandeira do Brasil na outra; velocidade faz a bandeira tremular. */
    static int riderGear;
    static float gearSpeed, riderLean;

    private static void leg(float z, float hip, float knee, int pants, int shoe, float g) {
        push();
        rot(hip, 0, 42);
        oct(-4.9f * g, 20, z - 4.9f, 4.9f * g, 43.5f, z + 4.9f, pants, 0.8f, 1f, 0.5f);
        rot(knee, 0, 21);
        oct(-4.2f * g, 3, z - 4.2f, 4.2f * g, 22.5f, z + 4.2f, pants, 0.74f, 1f, 0.5f);
        box(-4.4f, 0, z - 4.2f, 6, 4.6f, z + 4.2f, shoe);
        box(6, 0, z - 3.8f, 10, 3.3f, z + 3.8f, shoe);
        if (Draw.q >= 2) { bias = 1; box(-4.6f, 0, z - 4.4f, 10.2f, 1.1f, z + 4.4f, Draw.shade(shoe, 0.35f)); bias = 0; }
        pop();
    }

    /** Desenha a pessoa; devolve nada. Deixa a transformação da mão do braço próximo em pilha via callback simples. */
    static void person(Canvas c, float X, float H, float Z, int face, Look lk, float walk, float mv, int pose, float pt,
                       float flash, int weapon, boolean guard, boolean shadowOn) {
        float s = lk.scale;
        if (shadowOn) shadow(c, X, Z, 20 * s, 9 * s, H);
        model(X, H, Z, face, s, flash);
        aoH = 74 * sc;
        int skin = lk.skin, shirt = lk.shirt, pants = lk.pants, hair = lk.hair, shoe = 0xFF1B1B1B;
        float g = lk.girth;
        boolean fem = lk.acc == Data.AC_DRESS || lk.acc == Data.AC_DANCER || lk.acc == Data.AC_XANXA || lk.hero == 4;
        boolean lady = lk.acc == Data.AC_XANXA || lk.hero == 4; // mangas compridas
        boolean robe = lk.acc == Data.AC_TOGA || lk.acc == Data.AC_REITOR;
        boolean longS = lk.acc == Data.AC_SUIT || lk.acc == Data.AC_ANCHOR || lk.acc == Data.AC_COAT || robe
                || lk.acc == Data.AC_KNIFE || lk.hero == 3 || lk.acc == Data.AC_MULA;
        boolean mst = lk.acc == Data.AC_FOICE || lk.acc == Data.AC_FOICEB || lk.acc == Data.AC_FOICE2;
        float ph = walk * 0.12f, sw = (float) Math.sin(ph) * mv;
        float breath = (float) Math.sin(Draw.time * 2.4f + X * 0.013f);
        // ---- ângulos por pose
        aHipF = 32 * sw; aHipB = -32 * sw;
        aKneeF = -(8 + 34 * Math.max(0f, -(float) Math.cos(ph))) * mv; aKneeB = -(8 + 34 * Math.max(0f, (float) Math.cos(ph))) * mv;
        aShN = -26 * sw + 4; aShF = 26 * sw + 4; aElN = 14 + 10 * mv; aElF = 14 + 10 * mv; aLean = -3 * mv;
        float ext = pt < 0.5f ? pt * 2 : 1f;
        switch (pose) {
            case Draw.P_PUNCH:
                if (Draw.atkArm == 1) { aShF = 20 + 72 * ext; aElF = 95 * (1 - ext); aShN = 52; aElN = 105; } // soco com o braço de trás
                else { aShN = 20 + 72 * ext; aElN = 95 * (1 - ext); aShF = 55; aElF = 95; }
                aLean = -7 * ext; aHipF = 16; aHipB = -14; aKneeB = -8; break;
            case Draw.P_KICK: // chute baixo, de lado, na altura do meio da coxa do inimigo
                aHipF = 30 + 36 * ext; aKneeF = -62 * (1 - ext) - 3; aHipB = -8; aKneeB = -12; aLean = 9 * ext;
                aShN = 48; aElN = 108; aShF = -20; aElF = 50; break;
            case Draw.P_JKICK: // voadora de lado: uma perna esticada, a outra recolhida ("losango aberto")
                aHipF = 86; aKneeF = -2; aHipB = 64; aKneeB = -122; aLean = 16;
                aShN = -42; aElN = 28; aShF = 58; aElF = 96; break;
            case Draw.P_GUARD: // guarda de boxe: punhos na altura do rosto, joelhos flexionados
                aShN = 58; aElN = 118; aShF = 46; aElF = 126; aLean = -5;
                aHipF = 16 + 6 * sw; aKneeF = -18; aHipB = -12 - 6 * sw; aKneeB = -16; break;
            case Draw.P_RIDE: // montado: pernas abertas sobre a sela
                aHipF = 58; aKneeF = -70; aHipB = 58; aKneeB = -70; aLean = -3;
                aShF = 34; aElF = 72;
                if (pt > 0) { aShN = 150 - 60 * ext; aElN = 46 * (1 - ext); aLean = -3 - 6 * ext; } else { aShN = 28; aElN = 52; }
                break;
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
        aLean += riderLean;
        if (pose == Draw.P_DOWN) { oy += 6 * s; }
        rot(aLean, 0, pose == Draw.P_DOWN ? 4 : 30);
        float bob = -Math.abs(sw) * 1.4f;
        ty += td * bob; tx += tb * bob;
        // ---- pernas / saia / toga
        float lz = pose == Draw.P_RIDE ? 16.5f : 5.6f;
        if (robe) {
            int rc = lk.acc == Data.AC_TOGA ? 0xFF141414 : shirt;
            oct(-11, 0, -13, 11, 44, 13, rc, 1.08f, 0.9f, 0.7f);
            bias = 2; box(-9, 0, -14.2f, 9, 44, -13.2f, Draw.shade(rc, 0.12f)); bias = 0;
        } else {
            leg(lz, aHipB, aKneeB, Draw.shade(pants, -0.1f), shoe, g);
            leg(-lz, aHipF, aKneeF, pants, shoe, g);
            if (fem) oct(-8, 26, -12, 8, 46, 12, shirt, 1.12f, 0.9f, 0.7f);
            if (lk.hero == 4) { oct(-9.5f, 10, -13.5f, 9.5f, 30, 13.5f, shirt, 1.1f, 0.92f, 0.7f); bias = 3; box(-10.2f, 10, -14.6f, 10.2f, 12.5f, 14.6f, 0xFFD4AF37); bias = 0; }
            if (lk.acc == Data.AC_XANXA) { oct(-9.5f, 12, -13.5f, 9.5f, 36, 13.5f, 0xFF111111, 1.08f, 0.92f, 0.7f); }
        }
        // ---- tronco (cintura mais estreita, ombros largos)
        float ch = breath * 0.4f;
        int torso = robe && lk.acc == Data.AC_TOGA ? 0xFF141414 : shirt;
        oct(-7 * g, 42, -11.5f, 7 * g + ch, 72, 11.5f, torso, fem ? 0.82f : 0.9f, 1f, 0.8f);
        if (!robe && !fem) box(-6.7f * g, 40, -10.9f, 6.7f * g, 44.5f, 10.9f, 0xFF1A1A1A); // cinto
        if (!robe && !fem && Draw.q >= 2) { bias = 2; box(5.6f * g, 40.6f, -1.8f, 6.9f * g, 43.9f, 1.8f, 0xFFBFA14A); bias = 0; } // fivela
        if (Draw.q >= 2 && !fem && !robe && !longS) { bias = 2; box(5.5f * g, 68.5f, -5, 7.2f * g, 72.2f, 5, Draw.shade(torso, -0.18f)); bias = 0; } // gola
        bias = 3;
        if (lk.hero == 0) { box(2, 67, -11.9f, 7.3f * g, 72.3f, 11.9f, 0xFF1B8F3A); box(2, 56, -12, 6, 61, -11.4f, 0xFF1D3E9A); }
        if (lk.torn) { box(-2, 46, -12, 5, 56, -11.4f, skin); box(-6, 60, -12, -1, 64, -11.4f, 0xFF7A5A20); }
        if (lk.acc == Data.AC_VEST) { box(-7.4f * g, 46, -12, 7.4f * g, 70, 12, 0xFFE53935); box(-7.6f * g, 54, -12.2f, 7.6f * g, 58, 12.2f, 0xFFBDBDBD); }
        if (lk.acc == Data.AC_SUIT || lk.acc == Data.AC_ANCHOR) { box(5, 56, -3, 7.4f * g, 72, 3, 0xFFEEEEEE); box(6, 50, -1.3f, 7.7f * g, 70, 1.3f, 0xFFC62828); }
        if (lk.acc == Data.AC_HAWAII) { for (int i = 0; i < 5; i++) box(-5 + i * 2.6f, 48 + (i * 7) % 20, -12, -2 + i * 2.6f, 52 + (i * 7) % 20, -11.4f, i % 2 == 0 ? 0xFFE53935 : 0xFFE91E63); }
        if (lk.acc == Data.AC_COAT) { box(-7.6f * g, 22, -12.2f, 7.6f * g, 72.3f, 12.2f, 0xFFF4F4F4); box(6, 24, -1, 7.9f * g, 70, 1, 0xFF90A4AE); }
        if (lk.acc == Data.AC_MULA) { box(-7.4f * g, 44, -12, 7.4f * g, 72.2f, 12, 0xFFB71C1C); box(6, 44, -2.5f, 7.7f * g, 72, 2.5f, 0xFFEEEEEE); }
        if (lk.acc == Data.AC_DANCER) box(-7.3f, 58, -12, 7.3f, 66, 12, 0xFFFFFF00);
        if (lk.hero == 3) box(6, 50, -1.4f, 7.5f, 70, 1.4f, 0xFF2E7D32);
        if (lk.hero == 5) { box(2, 67, -11.9f, 7.3f * g, 72.3f, 11.9f, 0xFFFFD400); box(2, 56, -12, 6, 61, -11.4f, 0xFF1B8F3A); }
        if (lk.hero == 4) { // cinto dourado e colar de pérolas
            box(-7.3f, 41, -11.9f, 7.3f, 44.5f, 11.9f, 0xFFD4AF37);
            for (int i = 0; i < 7; i++) box(7.4f, 66 - (float) Math.abs(i - 3) * 1.4f, -6 + i * 1.9f, 8.6f, 68 - (float) Math.abs(i - 3) * 1.4f, -4.4f + i * 1.9f, 0xFFFFFFF0);
        }
        if (lk.acc == Data.AC_XANXA) { box(-7.3f, 58, -11.9f, 7.3f, 63, 11.9f, 0xFF111111); box(6, 62, -5, 8, 70, 5, 0xFF111111); box(7.4f, 52, -1, 8.6f, 56, 1, 0xFFD4AF37); }
        if (mst) { // lenço vermelho no pescoço e faixa na cintura
            int band = lk.acc == Data.AC_FOICEB ? 0xFFD32F2F : 0xFF5D4037;
            box(-7.3f * g, 67.5f, -11.9f, 7.4f * g, 72.3f, 11.9f, lk.acc == Data.AC_FOICE ? 0xFF8E1B1B : 0xFFD32F2F);
            box(-7.2f * g, 44.5f, -11.8f, 7.3f * g, 48, 11.8f, band);
            if (lk.acc == Data.AC_FOICE2) { box(-7.5f * g, 46, -12.1f, 2, 68, 12.1f, 0xFF4E342E); } // colete de couro
        }
        bias = 0;
        // ---- pescoço e cabeça
        oct(-3, 71, -3.2f, 3.4f, 76, 3.2f, Draw.shade(skin, -0.15f));
        push();
        rot(pose == Draw.P_HURT ? 10 : (pose == Draw.P_DOWN ? 0 : -aLean * 0.6f), 0, 75);
        oct(-7, 75, -7, 7, 91, 7, skin, 0.86f, 1f, 0.72f);
        bias = 3;
        box(7, 80, -1.6f, 9.6f, 84.5f, 1.6f, Draw.shade(skin, -0.1f));           // nariz
        if (Draw.q >= 1) { bias = 2; box(1.4f, 82.6f, -7.3f, 5.5f, 86.4f, -6.9f, 0xFFF4F4F4); box(1.4f, 82.6f, 6.9f, 5.5f, 86.4f, 7.3f, 0xFFF4F4F4); bias = 3; }
        box(3.2f, 83, -7.5f, 5.3f, 86, -6.9f, 0xFF161616);                        // olho (lado da câmera)
        box(3.2f, 83, 6.9f, 5.3f, 86, 7.5f, 0xFF161616);
        box(6.9f, 83, -5, 7.4f, 86, -2, 0xFF161616); box(6.9f, 83, 2, 7.4f, 86, 5, 0xFF161616); // olhos de frente
        box(1.5f, 86.8f, -7.5f, 6.4f, 88, -6.9f, Draw.shade(hair, -0.3f));        // sobrancelha
        box(3, 77.8f, -7f, 6.8f, 79f, -6.3f, Draw.shade(skin, -0.5f));            // boca
        box(-2.2f, 80.5f, -8.2f, 0.6f, 85, -7, Draw.shade(skin, -0.2f));          // orelha
        // cabelo / chapéus
        if (lk.acc == Data.AC_KNIFE) { box(-8, 76, -8, 5, 93, 8, 0xFF1A1A1A); oct(-8, 88, -8, 8, 93.5f, 8, 0xFF1A1A1A, 1f, 0.85f, 0.72f); }
        else if (fem) { oct(-8, 87, -8, 6, 93.5f, 8, hair, 1f, 0.8f, 0.72f); box(-8.5f, 64, -8, -3, 90, 8, hair); if (lk.hero == 4) { box(-8, 86, -8.4f, 7, 91, -6.5f, hair); box(-8, 86, 6.5f, 7, 91, 8.4f, hair); box(-10, 52, -8, -4, 66, 8, hair); } }
        else { oct(-7.6f, 87.5f, -7.6f, 5.8f, 93, 7.6f, hair, 1f, 0.8f, 0.72f); box(-7.6f, 79, -7.6f, -4.2f, 90, 7.6f, hair); }
        if (lk.acc == Data.AC_MULA) { box(-1, 75.5f, -7.5f, 7.6f, 80.5f, 7.5f, 0xFFF2F2F2); }
        if (lk.acc == Data.AC_MASK) { box(1, 76.5f, -7.5f, 7.7f, 82, 7.5f, 0xFFFFFFFF); box(9, 75, -8.5f, 9.8f, 92, 8.5f, 0x6680DEEA); }
        if (lk.acc == Data.AC_COAT || lk.acc == Data.AC_ANCHOR || lk.hero == 2) { box(1.8f, 82.3f, -7.8f, 6.2f, 86.8f, -7.3f, 0x8890CAF9); box(-4, 84.5f, -7.7f, 2, 85.4f, -7.3f, 0xFF222222); }
        if (lk.acc == Data.AC_SUIT) { box(1, 82.5f, -7.8f, 7.6f, 86.5f, 7.8f, 0xFF0A0A0A); }
        if (lk.acc == Data.AC_REITOR) { box(-11, 92, -11, 11, 94, 11, 0xFF111111); box(-5, 90, -5, 5, 92, 5, 0xFF111111); box(8, 86, 9, 9.5f, 94, 10.5f, 0xFFFFD400); }
        if (lk.acc == Data.AC_FOICE) { oct(-13, 90.5f, -13, 13, 92, 13, 0xFFE0C068); oct(-7.2f, 92, -7.2f, 7.2f, 97.5f, 7.2f, 0xFFD4B052, 1f, 0.85f, 0.45f); box(-7.4f, 92, -7.4f, 7.4f, 93.5f, 7.4f, 0xFF8E1B1B); }
        if (lk.acc == Data.AC_FOICEB) { oct(-7.8f, 87.5f, -7.8f, 7.8f, 93.5f, 7.8f, 0xFFD32F2F, 1f, 0.85f, 0.72f); box(7, 87.5f, -6, 13.5f, 89, 6, 0xFFB71C1C); }
        if (lk.acc == Data.AC_FOICE2) { oct(-9, 89, -9, 8, 93.5f, 9, 0xFFC62828, 1f, 0.8f, 0.6f); box(0, 75.2f, -7.5f, 7.6f, 80.5f, 7.5f, 0xFF3E2723); box(-2, 75.2f, -7.4f, 3, 83, -6.9f, 0xFF3E2723); }
        if (lk.joint) { // cigarro de maconha aceso na boca + fumacinha subindo
            box(5.5f, 78.2f, -1.1f, 13, 79.8f, 1.1f, 0xFFF5F5DC);
            glow = true; box(12.4f, 77.9f, -1.3f, 14.2f, 80.1f, 1.3f, (((int) (Draw.time * 6) & 1) == 0) ? 0xFFFF6D00 : 0xFFFF9100); glow = false;
            for (int i = 0; i < 5; i++) {
                float sp = (Draw.time * 0.5f + i * 0.2f + X * 0.002f) % 1f;
                float sx = 14.5f + sp * 7 + (float) Math.sin(sp * 7 + i * 2) * 2.2f, sy = 81 + sp * 30;
                lpuff(sx, sy, 0, 1.8f + sp * 5.5f, ((int) ((sp < 0.15f ? sp / 0.15f : 1f - sp) * 120) << 24) | 0xECECE4, false);
            }
        }
        if (lk.acc == Data.AC_DANCER) box(-7.8f, 86, -7.8f, 7.8f, 88.5f, 7.8f, 0xFFFF4081);
        if (lk.hero == 1) { oct(-7.8f, 88, -7.8f, 7.8f, 93.5f, 7.8f, 0xFF2E7D32, 1f, 0.85f, 0.72f); box(7, 88, -6, 13, 89.5f, 6, 0xFF1B5E20); }
        bias = 0;
        pop();
        // ---- braços
        int up = fem && !lady ? skin : (lk.acc == Data.AC_COAT ? 0xFFF4F4F4 : lk.acc == Data.AC_MULA ? 0xFFB71C1C : lk.acc == Data.AC_TOGA ? 0xFF141414 : shirt);
        int fo = longS ? up : skin;
        arm(15f, aShF, aElF, Draw.shade(up, -0.08f), Draw.shade(fo, -0.08f), skin, lk, -1, false, pose, guard, pt);
        arm(-15f, aShN, aElN, up, fo, skin, lk, weapon, true, pose, guard, pt);
    }

    private static void arm(float z, float sh, float el, int up, int fo, int skin, Look lk, int weapon, boolean near, int pose, boolean guard, float pt) {
        push();
        rot(sh, 0, 69);
        float ag = 1f + Math.min(0.35f, (lk.girth - 1f) * 1.3f);
        oct(-3.6f * ag, 54, z - 3.6f * ag, 3.6f * ag, 72, z + 3.6f * ag, up, 0.82f, 1.05f, 0.5f);
        rot(el, 0, 55);
        oct(-3.1f * ag, 41, z - 3.1f * ag, 3.1f * ag, 56.5f, z + 3.1f * ag, fo, 0.78f, 1f, 0.5f);
        oct(-3.1f, 35.5f, z - 3.1f, 3.3f, 41.5f, z + 3.1f, skin, 0.85f, 1f, 0.6f);
        if (riderGear == 1) {
            if (near) whip(z, sh + el, pose == Draw.P_RIDE ? pt : 0); else brFlag(z, sh + el);
        } else if (near) {
            // o que está na mão (o antebraço aponta para -y local; "para a frente" do punho = +x local)
            if (weapon >= 0) heldWeapon(weapon, z);
            else heldAcc(lk, z, guard);
        }
        pop();
    }

    /** chicote de couro: cabo + tira articulada que serpenteia e estala esticada para a frente no golpe. */
    private static void whip(float z, float armAng, float pt) {
        box(-1.2f, 31, z - 1.2f, 1.2f, 43, z + 1.2f, 0xFF4E342E);
        box(-1.5f, 41.5f, z - 1.5f, 1.5f, 43.5f, z + 1.5f, 0xFFD4AF37);
        int n = 10; float len = 11.5f, yj = 31;
        float ext = pt <= 0 ? 0 : (pt < 0.5f ? pt * 2 : 1f);
        push();
        boolean c0 = cast; cast = false;
        for (int i = 0; i < n; i++) {
            float a;
            if (pt > 0) a = (float) Math.sin(ext * 5.2f - i * 0.75f) * 42 * (1f - ext) + (ext < 1f ? 0 : (float) Math.sin(Draw.time * 40 + i) * 1.5f);
            else a = -(armAng * 1.25f) / n + (float) Math.sin(Draw.time * 3 + i * 0.6f) * 3; // pendurado, balançando
            rot(a, 0, yj);
            float w = 1.1f - i * 0.07f;
            box(-w, yj - len, z - w, w, yj + 0.5f, z + w, i >= n - 2 ? 0xFF8D6E63 : 0xFF3E2723);
            yj -= len;
        }
        if (pt > 0.35f && pt < 0.75f) { glow = true; lpuff(0, yj, z, 5, 0xCCFFFFFF, true); glow = false; } // estalo
        cast = c0;
        pop();
    }

    /** bandeira do Brasil no mastro (mão de trás): tremula mais quanto mais rápido o cavalo anda. */
    private static void brFlag(float z, float armAng) {
        push();
        rot(-armAng + 9 + gearSpeed * 7, 0, 38);
        oct(-1.2f, 8, z - 1.2f, 1.2f, 128, z + 1.2f, 0xFF8D6E63);
        oct(-2, 128, z - 2, 2, 132, z + 2, 0xFFD4AF37, 1f, 0.3f, 0.45f);
        float sp = gearSpeed, t = Draw.time;
        float x = -1.2f, wdt = 9.5f;
        for (int i = 0; i < 6; i++) {
            float wave = (float) Math.sin(t * (6 + 7 * sp) - i * 0.95f);
            rot((1f - sp) * 10 + wave * (3 + 6 * sp), x, 108);
            float zo = z + wave * (0.6f + 2.4f * sp) * (i / 5f);
            box(x - wdt, 90, zo - 0.6f, x, 126, zo + 0.6f, (i & 1) == 0 ? 0xFF009C3B : 0xFF00943A);
            float u = (i + 0.5f) / 6f, hh = 15.5f * (1f - Math.abs(2 * u - 1)) ;
            bias = 2;
            if (hh > 2) box(x - wdt, 108 - hh, zo - 0.9f, x, 108 + hh, zo + 0.9f, 0xFFFFDF00);
            bias = 3;
            if (i == 2) box(x - wdt, 102.5f, zo - 1.2f, x - 2.5f, 113.5f, zo + 1.2f, 0xFF002776);
            if (i == 3) box(x - wdt + 2.5f, 102.5f, zo - 1.2f, x, 113.5f, zo + 1.2f, 0xFF002776);
            if (i == 2 || i == 3) { bias = 4; box(x - wdt, 107.6f, zo - 1.4f, x, 109, zo + 1.4f, 0xFFFFFFFF); }
            bias = 0;
            x -= wdt;
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
            case Data.AC_FLAGS: { // bandeira vermelha maior, com estrela branca no meio
                box(-1, 30, z - 1, 1, 112, z + 1, 0xFF8D6E63); box(1, 84, z - 0.6f, 38, 111, z + 0.6f, 0xFFD62828);
                float cx = 19.5f, cy = 97.5f, rr = 6.5f;
                for (int k = 0; k < 5; k++) { // estrela de 5 pontas = pentagrama de 5 barras
                    double a0 = Math.toRadians(90 + 72 * k), a1 = Math.toRadians(90 + 72 * ((k + 2) % 5));
                    float x0 = cx + rr * (float) Math.cos(a0), y0 = cy + rr * (float) Math.sin(a0), x1 = cx + rr * (float) Math.cos(a1), y1 = cy + rr * (float) Math.sin(a1);
                    float mx = (x0 + x1) / 2, my = (y0 + y1) / 2, len = (float) Math.hypot(x1 - x0, y1 - y0);
                    push(); rot((float) Math.toDegrees(Math.atan2(y1 - y0, x1 - x0)), mx, my);
                    box(mx - len / 2, my - 0.8f, z - 0.8f, mx + len / 2, my + 0.8f, z + 0.8f, 0xFFFFFFFF);
                    pop();
                }
                break;
            }
            case Data.AC_FOICE: case Data.AC_FOICEB: { // foice de mão: cabo de madeira + lâmina curva
                box(-1.2f, 33, z - 1.2f, 1.2f, 52, z + 1.2f, 0xFF6D4C41);
                push(); float yj = 52; rot(150, 0, yj);
                for (int i = 0; i < 6; i++) { box(-0.6f, yj - 6.5f, z - 0.5f, 2.2f - i * 0.25f, yj + 0.6f, z + 0.5f, 0xFFCFD8DC); yj -= 6.5f; rot(-36, 0, yj); }
                pop();
                break;
            }
            case Data.AC_FOICE2: { // foice grande de cabo longo
                box(-1.4f, 4, z - 1.4f, 1.4f, 112, z + 1.4f, 0xFF5D4037);
                push(); float yj = 111; rot(84, 0, yj);
                for (int i = 0; i < 6; i++) { box(-0.7f, yj - 9, z - 0.6f, 4.2f - i * 0.6f, yj + 0.6f, z + 0.6f, 0xFFB0BEC5); yj -= 9; rot(-17, 0, yj); }
                pop();
                break;
            }
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
            case Data.AC_XANXA: box(-5, 20, z - 4, 5, 32, z + 4, 0xFF111111); box(-3, 31, z - 0.6f, 3, 34, z + 0.6f, 0xFF6D4C33); break;
            case Data.AC_MULA: box(-3, 24, z - 3, 3, 40, z + 3, 0xFF6D4C41); box(-1.5f, 18, z - 1.5f, 1.5f, 24, z + 1.5f, 0xFF8D6E63); break;
            default: break;
        }
        if (lk.hero == 1) { box(-1.2f, 26, z - 1.2f, 1.2f, 116, z + 1.2f, 0xFF8D6E63); box(1.2f, 92, z - 0.6f, 32, 115, z + 0.6f, 0xFF1B8F3A); box(9, 97, z - 0.9f, 24, 110, z + 0.9f, 0xFFFFD400); }
        if (lk.hero == 2) { box(-1, 28, z - 4, 1.5f, 40, z + 4, 0xFF222222); box(-1.3f, 30, z - 3.2f, -0.9f, 38, z + 3.2f, 0xFF66BB6A); }
        if (lk.hero == 3) { box(-2.5f, 10, z - 2.5f, 2.5f, 38, z + 2.5f, 0xFF2E7D32); box(-3.5f, 4, z - 3.5f, 3.5f, 11, z + 3.5f, 0xFF43A047); box(-1.2f, -4, z - 1.2f, 1.2f, 4, z + 1.2f, 0xFFFFC107); }
    }

    // ---------------------------------------------------------------- cavalo com armadura leve de couro
    private static void hLeg(float x, float z, float ang, float knee, int coat, boolean far) {
        int cl = far ? Draw.shade(coat, -0.12f) : coat;
        push(); rot(ang, x, 52);
        oct(x - 5, 28, z - 4, x + 5, 54, z + 4, cl, 0.66f, 1f, 0.5f);
        rot(knee, x, 28);
        oct(x - 3.1f, 6, z - 3.1f, x + 3.1f, 29, z + 3.1f, cl, 0.85f, 1f, 0.5f);
        bias = 1; oct(x - 3.6f, 9, z - 3.6f, x + 3.6f, 17, z + 3.6f, 0xFF7B4A26, 0.95f, 1f, 0.5f); bias = 0; // caneleira de couro
        oct(x - 3.4f, 0, z - 3.6f, x + 4.6f, 6.5f, z + 3.6f, 0xFF2B2420, 1.12f, 0.9f, 0.6f);
        pop();
    }

    /**
     * Cavalo branco com peitoral, testeira, manta e garupeira de couro; o cavaleiro leva chicote e a bandeira do Brasil.
     * mode: 0 normal, 1 coice (kick 0..1 = pernas traseiras esticadas), 2 comendo (cabeça no chão), 3 salto.
     */
    static void horse(Canvas c, float X, float H, float Z, int face, float walk, float mv, int mode, float kick, float flash,
                      Look rider, float whipPt, float speed) {
        shadow(c, X, Z, 58, 17, H);
        model(X, H, Z, face, 1.2f, flash);
        aoH = 80 * sc;
        final int coat = 0xFFEDE6DA, mane = 0xFFBFB4A2, LE = 0xFF7B4A26, LE2 = 0xFF4E2E14, GOLD = 0xFFD4AF37;
        float ph = walk * 0.085f, gal = mv;
        float pitch = mode == 1 ? -20 * kick : (mode == 3 ? 7 : (float) Math.sin(ph * 2) * 2.2f * gal);
        float bobY = Math.abs((float) Math.sin(ph)) * 3.2f * gal;
        ty += bobY;
        rot(pitch, 22, 0);
        // pernas (galope: dianteiras e traseiras em oposição)
        float fa = (float) Math.sin(ph) * 34 * gal, ra = (float) Math.sin(ph + 2.6f) * 34 * gal;
        float fk = -Math.max(0f, (float) Math.cos(ph)) * 55 * gal, rk = Math.max(0f, -(float) Math.cos(ph + 2.6f)) * 40 * gal;
        if (mode == 1) { fa = 20 * kick; fk = 0; ra = -78 * kick; rk = 10 * kick; }
        if (mode == 3) { fa = 48; fk = -80; ra = -34; rk = 36; }
        hLeg(21, 7.5f, mode == 1 ? fa : -fa * 0.8f + 4, mode == 1 ? 0 : Math.min(0, fk + 20), coat, true);
        hLeg(-23, 7.5f, mode == 1 ? ra * 0.9f : -ra * 0.8f - 4, rk * 0.6f, coat, true);
        hLeg(21, -7.5f, fa, fk, coat, false);
        hLeg(-23, -7.5f, ra, rk, coat, false);
        // corpo
        oct(-31, 47, -11, 31, 77, 11, coat, 0.9f, 1f, 0.7f);
        oct(-36, 52, -10, -26, 76, 10, coat, 0.85f, 1f, 0.6f);
        oct(25, 50, -9.6f, 36, 79, 9.6f, coat, 0.85f, 1f, 0.6f);
        // cauda (articulada, esvoaça no galope)
        push();
        float ty0 = 72, tx0 = -35;
        rot(-28 - 26 * gal + (float) Math.sin(Draw.time * 3) * 5 - (mode == 1 ? 40 * kick : 0), tx0, ty0);
        for (int i = 0; i < 4; i++) {
            oct(tx0 - 3.2f + i * 0.4f, ty0 - 13, -3 + i * 0.4f, tx0 + 3.2f - i * 0.4f, ty0 + 1, 3 - i * 0.4f, mane);
            ty0 -= 13;
            rot((float) Math.sin(Draw.time * 5 + i) * 7 * (0.4f + gal) + 7 * (1 - gal), tx0, ty0);
        }
        pop();
        // armadura de couro: manta sob a sela, flanqueira, garupeira com tiras e peitoral com tachas
        bias = 2;
        tex = TEX_V; texN = 4;
        box(-14, 62, -11.7f, 14, 78, 11.7f, 0xFF1B8F3A);
        tex = 0;
        box(-14.4f, 62, -11.9f, 14.4f, 64.5f, 11.9f, 0xFFFFD400);
        box(-36.6f, 60, -11.5f, -15, 78, 11.5f, LE);
        for (int i = 0; i < 4; i++) box(-35.5f + i * 5.4f, 51 - (i & 1) * 2, -11.6f, -31.5f + i * 5.4f, 60, 11.6f, (i & 1) == 0 ? LE : LE2);
        box(15, 50, -11.4f, 36.6f, 76, 11.4f, LE);
        box(24, 46, -9, 36.8f, 52, 9, LE2);
        bias = 3;
        box(-36.8f, 68, -11.8f, -15, 70, 11.8f, LE2); box(15, 64, -11.7f, 36.8f, 66, 11.7f, LE2);
        for (int i = 0; i < 4; i++) { box(18 + i * 5, 69, -11.9f, 20 + i * 5, 71, 11.9f, GOLD); box(-33 + i * 5, 73, -12, -31 + i * 5, 75, 12, GOLD); }
        bias = 0;
        // sela
        oct(-12, 77, -8.5f, 9, 81.5f, 8.5f, 0xFF3E2414, 1f, 0.9f, 0.7f); box(-13, 80, -7.5f, -9, 86, 7.5f, 0xFF3E2414); box(7, 80, -4, 10, 85, 4, 0xFF3E2414);
        box(-1, 56, -12.6f, 0.5f, 78, -12, LE2); box(-3.5f, 52, -13.6f, 3, 56, -12, 0xFF9E9E9E); // estribo
        // ponto do assento (para posicionar o cavaleiro)
        float seatX = ox + mir * sc * (ta * -2 + tb * 80 + tx), seatY = oy + sc * (tc * -2 + td * 80 + ty);
        // pescoço e cabeça
        float neck = mode == 2 ? -118 : -24 - 6 * gal + (mode == 1 ? -16 * kick : 0) + (float) Math.sin(ph * 2) * 3 * gal;
        push(); rot(neck, 27, 70);
        oct(20, 64, -7, 36, 108, 7, coat, 1.1f, 0.72f, 0.6f);
        box(17.5f, 70, -1.6f, 22, 110, 1.6f, mane); box(15.5f, 78, -1.2f, 18, 104, 1.2f, mane);
        bias = 2; for (int i = 0; i < 3; i++) box(33, 72 + i * 10, -6.6f + i * 0.5f, 36.6f - i * 0.8f, 80 + i * 10, 6.6f - i * 0.5f, LE); bias = 0; // placas do pescoço
        rot(mode == 2 ? -18 + (float) Math.sin(Draw.time * 14) * 5 : 62 + (mode == 1 ? 10 * kick : 0), 28, 104);
        oct(22, 97, -6, 46, 111, 6, coat, 1f, 0.9f, 0.7f);
        oct(44, 96, -4.8f, 58, 108, 4.8f, coat, 1f, 0.85f, 0.6f);
        box(22, 110, -5.4f, 25.5f, 118, -2.6f, coat); box(22, 110, 2.6f, 25.5f, 118, 5.4f, coat);                // orelhas
        box(23, 110, -1.5f, 34, 113, 1.5f, mane);                                                                 // topete
        bias = 3;
        box(36, 104, -6.3f, 40, 107.5f, -5.8f, 0xFF1A1A1A); box(36, 104, 5.8f, 40, 107.5f, 6.3f, 0xFF1A1A1A);     // olhos
        box(55, 100.5f, -5, 58.3f, 103, -4.4f, 0xFF4A3A36); box(50, 97, -5, 58.2f, 98, -4.4f, 0xFF3A2A26);        // narina e boca
        box(28, 108, -5, 54, 111.6f, 5, LE); box(41, 111.4f, -1.6f, 45, 112.6f, 1.6f, GOLD);                      // testeira de couro
        box(45, 95.6f, -5.2f, 47, 111, 5.2f, LE2); box(30, 96.6f, -6.2f, 32, 111, 6.2f, LE2);                     // cabresto
        bias = 0;
        pop();
        // cavaleiro
        if (rider != null) {
            float old = rider.scale; rider.scale = 0.8f;
            riderGear = 1; gearSpeed = speed; riderLean = pitch * 0.5f;
            person(c, seatX, seatY - 42 * 0.8f * BIG + 3, Z, face, rider, 0, 0, Draw.P_RIDE, whipPt, flash, -1, false, false);
            riderGear = 0; riderLean = 0; rider.scale = old;
        }
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
            harley();
        }
    }

    /** Harley-Davidson clássica preta (cromados, banco de couro, alforjes) com a bandeira do Brasil hasteada atrás. */
    private static void harley() {
        final int BK = 0xFF121212, CH = 0xFFD7DEE2, CH2 = 0xFF8E9AA0, LE = 0xFF3E2723, GOLD = 0xFFD4AF37;
        // rodas (pneu largo + aro cromado)
        for (int w = 0; w < 2; w++) {
            float cx = w == 0 ? -34 : 36;
            box(cx - 13, 6, -4.5f, cx + 13, 20, 4.5f, 0xFF0A0A0A); box(cx - 9, 2, -4.5f, cx + 9, 24, 4.5f, 0xFF0A0A0A); box(cx - 5, 0, -4.5f, cx + 5, 26, 4.5f, 0xFF0A0A0A);
            bias = 2; box(cx - 7, 6, -4.9f, cx + 7, 20, 4.9f, CH2); box(cx - 3, 10, -5.2f, cx + 3, 16, 5.2f, CH); bias = 0;
        }
        // escapamentos cromados e alforjes
        box(-56, 7, 5, -6, 12, 8.5f, CH); box(-56, 7, -8.5f, -6, 12, -5, CH);
        box(-56, 6, 4.6f, -52, 13, 9, CH2); box(-56, 6, -9, -52, 13, -4.6f, CH2);
        box(-46, 12, 8.5f, -22, 27, 13.5f, BK); box(-46, 12, -13.5f, -22, 27, -8.5f, BK);
        bias = 2; box(-44, 22, 13.3f, -24, 24, 13.9f, CH); box(-44, 22, -13.9f, -24, 24, -13.3f, CH); bias = 0;
        // motor V-twin
        box(-9, 6, -6, 14, 18, 6, 0xFF263238);
        push(); rot(-22, 2, 16); box(-4, 16, -4, 3, 35, 4, CH2); box(-4.6f, 33, -4.6f, 3.6f, 36, 4.6f, 0xFF37474F); pop();
        push(); rot(22, 2, 16); box(-4, 16, -4, 3, 35, 4, CH2); box(-4.6f, 33, -4.6f, 3.6f, 36, 4.6f, 0xFF37474F); pop();
        // tanque, banco e para-lamas
        box(-8, 30, -7, 18, 41, 7, BK); box(-4, 41, -5, 14, 44, 5, BK);
        bias = 2; box(-8.2f, 35.5f, -7.4f, 18.2f, 37, 7.4f, CH); box(-1, 43.5f, -2.5f, 3, 44.6f, 2.5f, CH); bias = 0;
        box(-32, 27, -8, -8, 32, 8, LE); box(-37, 27, -7, -32, 39, 7, LE);
        box(-50, 24, -7.4f, -20, 28.5f, 7.4f, BK); box(-52, 18, -7.4f, -47, 28.5f, 7.4f, BK);
        box(26, 28, -6.4f, 48, 32.5f, 6.4f, BK); box(42, 20, -6.4f, 48, 32.5f, 6.4f, BK);
        bias = 2; box(-52.4f, 24, -2.5f, -51, 28, 2.5f, 0xFFD32F2F); bias = 0;
        // garfo, guidão alto e farol
        push(); rot(-18, 34, 38);
        box(32, 8, -4.6f, 35, 48, -2.6f, CH); box(32, 8, 2.6f, 35, 48, 4.6f, CH);
        box(30, 45, -5.5f, 38, 48.5f, 5.5f, CH2);
        box(32, 48, -2, 35, 58, 2, CH);
        box(31, 56, -19, 36, 59, 19, CH); box(31, 56, -22, 36.5f, 61, -17, BK); box(31, 56, 17, 36.5f, 61, 22, BK);
        box(38, 34, -5.5f, 44, 44, 5.5f, CH); bias = 2; box(44, 35.5f, -4, 45, 42.5f, 4, 0xFFFFF59D); bias = 0;
        pop();
        // bandeira do Brasil hasteada na traseira
        box(-50, 24, -1.2f, -48, 103, 1.2f, CH2); box(-50.8f, 103, -1.8f, -47.2f, 106, 1.8f, GOLD);
        push();
        rot((float) Math.sin(Draw.time * 7) * 5, -50, 86);
        box(-92, 72, -0.8f, -50, 100, 0.8f, 0xFF009C3B);
        bias = 2;
        box(-74, 96.5f, -1.1f, -68, 98.5f, 1.1f, 0xFFFFDF00);
        box(-80, 92.5f, -1.1f, -62, 96.5f, 1.1f, 0xFFFFDF00);
        box(-86, 86, -1.1f, -56, 92.5f, 1.1f, 0xFFFFDF00);
        box(-80, 79.5f, -1.1f, -62, 86, 1.1f, 0xFFFFDF00);
        box(-74, 75.5f, -1.1f, -68, 79.5f, 1.1f, 0xFFFFDF00);
        bias = 3;
        box(-77, 83, -1.4f, -65, 91, 1.4f, 0xFF002776);
        box(-78, 86.2f, -1.5f, -64, 87.6f, 1.5f, 0xFFFFFFFF);
        bias = 0;
        pop();
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
        boolean pt0 = portrait; int vm0 = vmode; float va0 = vA, vb0 = vB;
        if (pt0) setLandscape(800); // ícones sempre na projeção horizontal
        int r0 = tR, g0 = tG, b0 = tB, sh0 = shadowCol; float rm0 = rim; boolean rf0 = reflect;
        neutral(); noCast = true;
        begin(0);
        person(c, 400, 0, 0, 1, lk, walk, 0, pose, 0, 0, -1, false, false);
        proj(400, 0, 0);
        c.save();
        c.translate(sx, sy);
        c.scale(k, k);
        c.translate(-px, -py);
        flush(c);
        c.restore();
        noCast = false; tR = r0; tG = g0; tB = b0; shadowCol = sh0; rim = rm0; reflect = rf0;
        if (pt0) { vmode = vm0; vA = va0; vB = vb0; restoreView(); }
        zoom = oz0;
    }

    // ---------------------------------------------------------------- cena completa
    private static final int[] FOG = {0xFFBFDDF0, 0xFFC9D6DF, 0xFFCFEAF8, 0xFF8F5A66, 0xFFE8DCC0, 0xFF2A1A50, 0xFFE8A6C0, 0xFF1B3F72, 0xFFEAF2F8, 0xFFD9C9A8};

    /** luz neutra de estúdio (menus e ícones). */
    static void neutral() { tR = tG = tB = 256; rim = 0; shadowCol = 0x46000000; reflect = false; yawK = 1f; }

    private static int lerp3(int a, int b, int c3, float d) { return d < 0.5f ? Draw.mix(a, b, d * 2) : Draw.mix(b, c3, (d - 0.5f) * 2); }

    /** iluminação por cenário: cor do ambiente, luz de contorno, reflexo do piso e hora do dia (fazenda). */
    static void light(int theme, float dusk, float time) {
        neutral();
        fog = FOG[theme]; Scene.dusk = dusk;
        reflect = Draw.q >= 2 && (theme == Data.TH_PALCO || theme == Data.TH_JORNAL || theme == Data.TH_TRIBUNAL);
        switch (theme) {
            case Data.TH_PORTAO: tG = 228; tB = 205; rim = 0.16f; rimCol = 0xFFFFA566; break;
            case Data.TH_PALCO: tR = 226; tG = 212; rim = 0.2f; rimCol = 0xFFE040FB; break;
            case Data.TH_NOVELA: tG = 245; tB = 228; break;
            case Data.TH_JORNAL: tR = 238; tG = 246; rim = 0.12f; rimCol = 0xFF4FC3F7; break;
            case Data.TH_QUARENT: tR = 244; tG = 250; break;
            case Data.TH_FAZENDA: {
                int t = lerp3(0xFFFFFCF4, 0xFFFFC496, 0xFF80769F, dusk);
                tR = ((t >> 16) & 255) * 256 / 255; tG = ((t >> 8) & 255) * 256 / 255; tB = (t & 255) * 256 / 255;
                fog = lerp3(0xFFD9C9A8, 0xFFE08A4A, 0xFF3A1A14, dusk);
                float fl = 0.82f + 0.12f * (float) Math.sin(time * 11) + 0.06f * (float) Math.sin(time * 27 + 1);
                rim = (0.08f + 0.5f * dusk) * fl; rimCol = 0xFFFF7A20;
                shadowCol = ((int) (0x46 - 0x14 * dusk) << 24);
                break;
            }
            default: break;
        }
    }

    /** desenha o fundo 2D do cenário (feito para 800 x 450) cobrindo a tela virtual atual: lado a lado na horizontal, ampliado no horizonte na vertical. */
    static void backdrop(Canvas c, boolean lake, int theme, float camX, float time, boolean lite) {
        if (portrait) {
            float s = Math.max(ftop / Scene.FLOOR_TOP, vw / 800f);
            c.save();
            c.clipRect(0, 0, vw, ftop + 4);
            c.translate((vw - 800 * s) / 2f, ftop - Scene.FLOOR_TOP * s);
            c.scale(s, s);
            if (lake) Scene.lake(c, camX * 0.3f, time, lite); else Scene.bg(c, theme, camX * 0.3f, time, lite);
            c.restore();
            return;
        }
        float dx = (vw - 800) / 2f;
        for (int k = vw > 801 ? -1 : 0; k <= (vw > 801 ? 1 : 0); k++) {
            c.save();
            if (vw > 801) c.clipRect(k < 0 ? 0 : k == 0 ? dx : dx + 800, 0, k < 0 ? dx : k == 0 ? dx + 800 : vw, 450);
            c.translate(dx + k * 800, 0);
            if (lake) Scene.lake(c, camX, time, lite); else Scene.bg(c, theme, camX, time, lite);
            c.restore();
        }
    }

    static void world(Canvas c, Game g, Look[] kindLooks, Look[] heroLooks, Look heroTorn, boolean lite) {
        int theme = g.theme();
        zoom = 1f + 0.035f * g.punch;
        light(theme, g.dusk(), g.time);
        backdrop(c, false, theme, g.camX, g.time, lite);
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
                if (e.shield > 0) { model(e.x, e.h, Z, 1, k.scale, 0); cast = false; box(-30, 0, -30, 30, 104, 30, 0x4480DEEA); }
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
                boolean fin = g.comboStep == 3;
                pose = (fin && g.weapon < 0 && g.hero != 2) ? Draw.P_KICK : Draw.P_PUNCH;
                break;
            }
            case Game.S_JUMP: pose = Draw.P_JUMP; break;
            case Game.S_JKICK: pose = g.mounted ? Draw.P_SPIN : Draw.P_JKICK; break;
            case Game.S_HURT: pose = Draw.P_HURT; break;
            case Game.S_DOWN: case Game.S_DEAD: pose = Draw.P_DOWN; break;
            case Game.S_GRAB: pose = Draw.P_GRAB; break;
            case Game.S_CHARGE: pose = Draw.P_CHARGE; break;
            case Game.S_GUARD: pose = Draw.P_GUARD; mv = moving ? 0.5f : 0f; break;
            case Game.S_SPECIAL: pose = g.spK == Game.SP_SPIN ? Draw.P_SPIN : g.spK == Game.SP_BURST ? Draw.P_WIND : Draw.P_SPEC; break;
            default: break;
        }
        if (o.st == Game.S_SPECIAL && (g.spK == Game.SP_RIDE || g.spK == Game.SP_TRUCK)) {
            boolean truck = g.spK == Game.SP_TRUCK;
            moto(c, o.x, Z, o.face, truck);
            person(c, o.x - o.face * (truck ? 20 : 6), truck ? 62 : 8, Z, o.face, lk, 0, 0, Draw.P_SPEC, 0, 0, -1, false, false);
            return;
        }
        if (g.mounted && g.horse()) {
            if (o.st == Game.S_DOWN || o.st == Game.S_DEAD) { person(c, o.x, o.h, Z, o.face, lk, 0, 0, Draw.P_DOWN, 0, o.flash, -1, false, true); return; }
            int mode = 0; float kick = 0, wp = 0, yk = 1f;
            boolean lance = o.st == Game.S_SPECIAL && g.spK == Game.SP_LANCE;
            if (o.st == Game.S_SPECIAL && g.spK == Game.SP_COICE) {
                float u = Math.min(1f, o.t / Math.max(0.1f, g.spDur));
                mode = 1; kick = Math.abs((float) Math.sin(u * Math.PI * 5)); yk = (float) Math.cos(u * Math.PI * 4);
            } else if (o.eat > 0) mode = 2;
            else if (o.h > 6) mode = 3;
            if (o.st == Game.S_ATK) wp = Math.max(0.02f, pt);
            else if (o.st == Game.S_JKICK) wp = 0.3f + 0.4f * Math.abs((float) Math.sin(g.time * 14));
            yawK = yk;
            horse(c, o.x, o.h, Z, o.face, lance ? g.time * 900 : o.walk, lance ? 1.3f : mv, mode, kick, o.flash, lk, wp, lance ? 1f : (mv > 0 ? 0.85f : 0.12f));
            yawK = 1f;
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
        // 1º soco = braço esquerdo, 2º = braço direito (o esquerdo é o de trás quando o herói olha para a direita)
        Draw.atkArm = (o.st == Game.S_ATK && g.weapon < 0 && g.comboStep < 3 && ((g.comboStep == 1) == (o.face > 0))) ? 1 : 0;
        person(c, o.x, o.h, Z, o.face, lk, o.walk, mv, pose, pt, o.flash, g.weapon, false, true);
        Draw.atkArm = 0;
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
        zoom = 1f; neutral(); Scene.dusk = 0; fog = 0xFFCFEAF8; fogK = 0.3f;
        backdrop(c, true, 0, j.camX, j.time, lite);
        reflect = Draw.q >= 2; floorTone = 0xFF3A9CC0;
        begin(j.camX);
        water(c, j.camX, j.time);
        for (Jet.Whale w : j.whales) { if (w.x > j.camX - 250 && w.x < j.camX + Game.W + 250) whale(c, w, zOf(w.y), j.time); }
        for (Jet.Patriot p : j.patriots) jetski(c, p.x, zOf(p.y), 0, 1, 0, heroLooks[p.look], 0, true, j.time, true);
        for (int i = 0; i < j.np; i++) {
            Jet.JS q = j.ps[i];
            if (q.hp <= 0) continue;
            boolean blink = q.inv > 0 && q.inv < 3 && ((int) (j.time * 14) & 1) == 0 && q.specialT <= 0;
            if (!blink) jetski(c, q.x, zOf(q.y), q.h + (float) Math.sin(j.time * 9 + i) * 1.4f, 1, q.bank, heroLooks[q.hero], q.flash, false, j.time, q.ramT > 0);
        }
        flush(c);
        reflect = false;
        fogK = 0.22f;
    }

    static void water(Canvas c, float camX, float time) {
        float x0 = fx0, x1 = fx1, zn = fzLo, zB = fzHi;
        int strips = 12;
        for (int i = 0; i < strips; i++) {
            float za = zn + (zB - zn) * i / strips, zb = zn + (zB - zn) * (i + 1) / strips;
            float t = i / (float) (strips - 1);
            gquad(c, Draw.mix(0xFF0B6E99, 0xFF6FD0E6, t), x0, za, x1, zb, 0);
        }
        PT.setStyle(Paint.Style.STROKE);
        for (float z = zs(-120, 46); z < zB - 20; z += 46) {
            float t = (z - zn) / (zB - zn);
            PT.setStrokeWidth(1.2f + (1f - t) * 1.6f);
            PT.setColor(((int) (60 + (1f - t) * 70) << 24) | 0xFFFFFF);
            PATH.reset();
            boolean first = true;
            for (float x = fx0; x <= fx1; x += 50) {
                float wy = (float) Math.sin(x * 0.022f + time * 2.1f + z * 0.07f) * 2.4f;
                proj(x, wy, z);
                if (first) { PATH.moveTo(px, py); first = false; } else PATH.lineTo(px, py);
            }
            c.drawPath(PATH, PT);
        }
        PT.setStyle(Paint.Style.FILL);
        if (portrait && Draw.q >= 1) { // marolas atravessadas que passam pela câmera: dão a noção de avanço
            PT.setStyle(Paint.Style.STROKE); PT.setStrokeWidth(1.6f); PT.setColor(0x55FFFFFF);
            for (float x = (float) Math.floor(fx0 / 70f) * 70f; x < fx1; x += 70) {
                for (int k = 0; k < 4; k++) {
                    float h = hash(x * 0.07f, k * 5.3f), z = zn + 40 + h * (zB - zn - 80);
                    gline(c, 0x55FFFFFF, x + h * 30, 0.4f, z, x + h * 30, 0.4f, z + 18 + h * 26, 1.5f);
                }
            }
            PT.setStyle(Paint.Style.FILL);
        }
        horizonHaze(c);
        // brilhos do sol na água
        for (int i = 0; i < 40; i++) {
            float sx = fx0 + ((i * 197 + (float) Math.floor(camX * 0.4f)) % (fx1 - fx0));
            float sz = zn + (i * 53 % 100) / 100f * (zB - zn);
            float tw = (float) Math.sin(time * 3 + i) * 0.5f + 0.5f;
            proj(sx, 0.5f, sz);
            Draw.circle(c, ((int) (40 + tw * 120) << 24) | 0xFFFFFF, px, py, 1.4f + tw * 1.8f);
        }
    }
}
