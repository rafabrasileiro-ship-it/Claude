package com.rafa.patriota;

import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

/** Desenho "low poly" feito com polígonos chapados (sem imagens). */
final class Draw {
    private Draw() {}

    static final Paint P = new Paint(Paint.ANTI_ALIAS_FLAG);
    static boolean noShadow;
    /** Qualidade gráfica: 0 leve (chapado), 1 normal (contorno, sombras, gradientes), 2 alta (+texturas e luz). */
    static int q = 2;
    /** Escala de perspectiva da entidade atual (fundo menor, frente maior). */
    static float persp = 1f;
    static final Path PATH = new Path();
    static final RectF RF = new RectF();

    static final class Look {
        int skin, shirt, pants, hair, acc;
        boolean torn;
        float scale = 1f;
        float girth = 1f;
        int hero = -1; // 0..3 heróis
    }

    // poses
    static final int P_IDLE = 0, P_PUNCH = 1, P_KICK = 2, P_HURT = 3, P_DOWN = 4, P_JUMP = 5, P_WIND = 6, P_GRAB = 7,
            P_SPIN = 8, P_SPEC = 9, P_JKICK = 10, P_CHARGE = 11;

    // ---------------------------------------------------------------- primitivas
    static int mix(int a, int b, float t) {
        int ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
        int br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
        return 0xFF000000 | ((int) (ar + (br - ar) * t) << 16) | ((int) (ag + (bg - ag) * t) << 8) | (int) (ab + (bb - ab) * t);
    }

    static int shade(int c, float f) { return f >= 0 ? mix(c, 0xFFFFFFFF, f) : mix(c, 0xFF000000, -f); }

    static void poly(Canvas c, int color, float... pts) {
        PATH.reset();
        PATH.moveTo(pts[0], pts[1]);
        for (int i = 2; i < pts.length; i += 2) PATH.lineTo(pts[i], pts[i + 1]);
        PATH.close();
        P.setStyle(Paint.Style.FILL);
        P.setColor(color);
        c.drawPath(PATH, P);
        if (q >= 1 && (color >>> 24) == 255) {
            P.setStyle(Paint.Style.STROKE);
            P.setStrokeWidth(1.2f);
            P.setColor(shade(color, -0.45f));
            c.drawPath(PATH, P);
            P.setStyle(Paint.Style.FILL);
        }
    }

    /** Gradiente vertical por faixas (barato e sem shaders). */
    static void grad(Canvas c, float l, float t, float r, float b, int top, int bot) {
        int n = q == 0 ? 2 : 14;
        float h = (b - t) / n;
        for (int i = 0; i < n; i++) rect(c, mix(top, bot, i / (float) (n - 1)), l, t + i * h, r, t + (i + 1) * h + 1);
    }

    /** Sombra suave projetada no chão (luz vindo da esquerda e do alto). */
    static void softShadow(Canvas c, float x, float y, float rx, float ry) {
        if (noShadow) return;
        if (q == 0) { oval(c, 0x55000000, x, y + 2, rx, ry); return; }
        float ox = rx * 0.25f;
        oval(c, 0x14000000, x + ox, y + 2, rx * 1.25f, ry * 1.3f);
        oval(c, 0x22000000, x + ox, y + 2, rx * 1.0f, ry * 1.0f);
        oval(c, 0x38000000, x + ox * 0.7f, y + 2, rx * 0.7f, ry * 0.7f);
        oval(c, 0x50000000, x + ox * 0.4f, y + 2, rx * 0.4f, ry * 0.45f);
    }

    static void rect(Canvas c, int color, float l, float t, float r, float b) {
        P.setStyle(Paint.Style.FILL);
        P.setColor(color);
        c.drawRect(l, t, r, b, P);
    }

    static void circle(Canvas c, int color, float x, float y, float r) {
        P.setStyle(Paint.Style.FILL);
        P.setColor(color);
        c.drawCircle(x, y, r, P);
    }

    static void ring(Canvas c, int color, float x, float y, float r, float w) {
        P.setStyle(Paint.Style.STROKE);
        P.setStrokeWidth(w);
        P.setColor(color);
        c.drawCircle(x, y, r, P);
        P.setStyle(Paint.Style.FILL);
    }

    static void line(Canvas c, int color, float x1, float y1, float x2, float y2, float w) {
        P.setStyle(Paint.Style.STROKE);
        P.setStrokeWidth(w);
        P.setStrokeCap(Paint.Cap.ROUND);
        P.setColor(color);
        c.drawLine(x1, y1, x2, y2, P);
        P.setStyle(Paint.Style.FILL);
    }

    static void oval(Canvas c, int color, float cx, float cy, float rx, float ry) {
        RF.set(cx - rx, cy - ry, cx + rx, cy + ry);
        P.setStyle(Paint.Style.FILL);
        P.setColor(color);
        c.drawOval(RF, P);
    }

    static void text(Canvas c, String s, float x, float y, float size, int color, Paint.Align al) {
        P.setStyle(Paint.Style.FILL);
        P.setTextSize(size);
        P.setTextAlign(al);
        P.setFakeBoldText(true);
        P.setColor((color >>> 24) << 24);
        c.drawText(s, x + size * 0.07f, y + size * 0.07f, P);
        P.setColor(color);
        c.drawText(s, x, y, P);
        P.setFakeBoldText(false);
    }

    /** Relógio global para animações de respiração/tecido. */
    static float time;
    private static final float[] J = new float[2];

    /** Cinemática inversa de 2 ossos: calcula a articulação (joelho/cotovelo) em J. */
    private static void joint(float x1, float y1, float x2, float y2, float l1, float l2, float bend) {
        float dx = x2 - x1, dy = y2 - y1;
        float d = (float) Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01f) { J[0] = x1; J[1] = y1 + l1; return; }
        if (d >= l1 + l2) { J[0] = x1 + dx * 0.5f; J[1] = y1 + dy * 0.5f; return; }
        float a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
        float hh = (float) Math.sqrt(Math.max(0f, l1 * l1 - a * a));
        float mx = x1 + dx * a / d, my = y1 + dy * a / d;
        J[0] = mx + bend * hh * (-dy / d);
        J[1] = my + bend * hh * (dx / d);
    }

    /** Membro arredondado com contorno e brilho (volume). */
    private static void limb(Canvas c, int col, float x1, float y1, float x2, float y2, float w) {
        line(c, shade(col, -0.5f), x1, y1, x2, y2, w + 2f);
        line(c, col, x1, y1, x2, y2, w);
        if (q >= 2) line(c, shade(col, 0.22f), x1 + 0.8f, y1 - 0.6f, x2 + 0.8f, y2 - 0.6f, w * 0.3f);
    }

    private static void limb2(Canvas c, int colA, int colB, float x1, float y1, float x2, float y2, float l1, float l2, float bend, float w) {
        joint(x1, y1, x2, y2, l1, l2, bend);
        float jx = J[0], jy = J[1];
        limb(c, colA, x1, y1, jx, jy, w);
        limb(c, colB, jx, jy, x2, y2, w * 0.88f);
    }

    private static void shoeR(Canvas c, int col, float x, float y) {
        oval(c, shade(col, -0.4f), x + 3, y - 3, 8.5f, 4.6f);
        oval(c, col, x + 3, y - 3.5f, 7.5f, 3.8f);
        if (q >= 2) oval(c, shade(col, 0.3f), x + 5, y - 5, 3, 1.2f);
        rect(c, 0xFF0A0A0A, x - 4.5f, y - 1.2f, x + 10.5f, y);
    }

    // ---------------------------------------------------------------- pessoa
    /**
     * Desenha uma pessoa low poly. (x,y) = pés no chão; h = altura do pulo.
     * pt = tempo da pose; mv = intensidade do andar 0..1.
     */
    static void person(Canvas c, float x, float y, float h, int face, Look lk, float walk, float mv, int pose, float pt,
                       float flash, int weapon, boolean guard) {
        float sc = lk.scale * persp;
        softShadow(c, x, y, 18 * sc * (1f - Math.min(0.5f, h / 200f)), 5 * sc);
        c.save();
        c.translate(x, y - h);
        if (pose == P_DOWN) {
            c.rotate(face * -82f);
        }
        c.scale(face * sc, sc);
        int skin = flash > 0 ? mix(lk.skin, 0xFFFFFFFF, 0.7f) : lk.skin;
        int shirt = flash > 0 ? mix(lk.shirt, 0xFFFFFFFF, 0.7f) : lk.shirt;
        int pants = flash > 0 ? mix(lk.pants, 0xFFFFFFFF, 0.7f) : lk.pants;
        int hair = flash > 0 ? mix(lk.hair, 0xFFFFFFFF, 0.7f) : lk.hair;
        int shoe = flash > 0 ? 0xFFFFFFFF : 0xFF1B1B1B;
        float sw = (float) Math.sin(walk * 0.12f) * 9f * mv;
        float g = lk.girth;
        boolean fem = lk.acc == Data.AC_DRESS || lk.acc == Data.AC_DANCER;
        boolean toga = lk.acc == Data.AC_TOGA, reitor = lk.acc == Data.AC_REITOR;

        float ph = walk * 0.12f;
        float bob = q >= 1 ? -Math.abs((float) Math.sin(ph)) * 1.6f * mv + (float) Math.sin(time * 2.4f + x * 0.01f) * 0.5f : 0f;
        if (q == 0) {
        // ---- pernas
            float lf = pose == P_JUMP || pose == P_JKICK ? 6 : sw;
            float lb = pose == P_JUMP ? -6 : -sw;
            boolean kick = pose == P_KICK || pose == P_JKICK;
            if (!toga && !reitor) {
                // perna de trás
                poly(c, shade(pants, -0.2f), -9 * g, -40, -3 * g, -40, -3 * g + lb, -6, -10 * g + lb, -6);
                poly(c, shoe, -12 * g + lb, -6, -3 * g + lb, -6, -2 * g + lb, 0, -13 * g + lb, 0);
                // perna da frente (chuta)
                if (kick) {
                    poly(c, pants, -2 * g, -42, 6 * g, -42, 38, -50, 32, -58);
                    poly(c, shoe, 32, -58, 38, -50, 46, -52, 42, -62);
                } else {
                    poly(c, pants, -3 * g, -40, 5 * g, -40, 6 * g + lf, -6, -2 * g + lf, -6);
                    poly(c, shoe, -3 * g + lf, -6, 7 * g + lf, -6, 10 * g + lf, 0, -3 * g + lf, 0);
                }
            }
            if (q >= 1 && !toga && !reitor) { line(c, shade(pants, -0.3f), -1 * g, -34, 0, -16, 1.2f); }
            if (fem) {
                poly(c, shirt, -14, -62, 14, -62, 20, -26, -20, -26);
            }
            if (toga) {
                poly(c, 0xFF0A0A0A, -16, -70, 16, -70, 22, 0, -22, 0);
                poly(c, 0xFF1C1C1C, -4, -70, 16, -70, 22, 0, 4, 0);
            }
            if (reitor) {
                poly(c, lk.shirt, -16, -70, 16, -70, 20, -8, -20, -8);
                poly(c, shade(lk.shirt, 0.15f), -6, -70, 16, -70, 20, -8, 0, -8);
            }

            // ---- tronco
            if (!toga && !reitor && !fem) {
                poly(c, shirt, -13 * g, -70, 13 * g, -70, 10 * g, -38, -10 * g, -38);
                poly(c, shade(shirt, -0.12f), -13 * g, -70, -4 * g, -70, -4 * g, -38, -10 * g, -38);
            }
            if (q >= 1 && !toga && !reitor && !fem) { // luz: lado da frente mais claro, costas escuras, dobras
                poly(c, shade(shirt, 0.16f), 3 * g, -70, 13 * g, -70, 10 * g, -38, 2 * g, -38);
                line(c, shade(shirt, -0.3f), -2 * g, -60, 1 * g, -44, 1.2f);
                line(c, shade(shirt, -0.25f), 4 * g, -56, 6 * g, -42, 1.0f);
            }
        } else {
            boolean kickR = pose == P_KICK || pose == P_JKICK;
            float hipY = -40 + bob;
            float fF = sw * 1.5f, fB = -sw * 1.5f;
            float liftF = Math.max(0f, (float) Math.cos(ph)) * 5f * mv, liftB = Math.max(0f, -(float) Math.cos(ph)) * 5f * mv;
            float ffx = 2 * g + fF, ffy = -4 - liftF, bfx = -6 * g + fB, bfy = -4 - liftB;
            if (pose == P_JUMP) { ffx = 9; ffy = -16; bfx = -8; bfy = -10; }
            if (pose == P_HURT) { ffx = 6; bfx = -9; }
            if (!toga && !reitor) {
                int pb = shade(pants, -0.22f);
                limb2(c, pb, pb, -5 * g, hipY, bfx, bfy, 19, 19, -1, 8.5f * g);
                shoeR(c, shoe, bfx - 3, bfy + 4);
                if (kickR) {
                    limb2(c, pants, pants, 2 * g, hipY - 2, 40, -54, 22, 22, -1, 9f * g);
                    c.save(); c.translate(42, -56); c.rotate(-20); shoeR(c, shoe, -2, 3); c.restore();
                } else {
                    limb2(c, pants, pants, 2 * g, hipY, ffx, ffy, 19, 19, -1, 9f * g);
                    shoeR(c, shoe, ffx - 3, ffy + 4);
                }
            }
            c.translate(0, bob);
            if (fem) {
                poly(c, shade(shirt, -0.2f), -14, -62, 14, -62, 21, -25, -21, -25);
                poly(c, shirt, -6, -62, 14, -62, 21, -25, -2, -25);
            }
            if (toga) {
                poly(c, 0xFF0A0A0A, -16, -70, 16, -70, 22, 0, -22, 0);
                poly(c, 0xFF1C1C1C, -4, -70, 16, -70, 22, 0, 4, 0);
                line(c, 0xFF2A2A2A, 6, -60, 10, -4, 1.2f); line(c, 0xFF000000, -6, -60, -10, -4, 1.2f);
            }
            if (reitor) {
                poly(c, shade(lk.shirt, -0.2f), -16, -70, 16, -70, 20, -8, -20, -8);
                poly(c, lk.shirt, -6, -70, 16, -70, 20, -8, 0, -8);
                line(c, shade(lk.shirt, 0.25f), 8, -62, 12, -12, 1.2f);
            }
            // pescoço
            rect(c, shade(skin, -0.25f), -3, -74, 6, -66);
            if (!toga && !reitor && !fem) {
                // tronco com volume: base escura, corpo, faixa de luz
                circle(c, shade(shirt, -0.35f), -10.5f * g, -65, 5.2f);
                circle(c, shade(shirt, -0.35f), 10.5f * g, -65, 5.2f);
                poly(c, shade(shirt, -0.28f), -13.5f * g, -68, -9 * g, -71, 9 * g, -71, 13.5f * g, -68, 11 * g, -38, -11 * g, -38);
                poly(c, shirt, -7 * g, -70.5f, 9 * g, -70.5f, 13 * g, -67, 10.5f * g, -39, -6 * g, -39);
                if (q >= 2) {
                    poly(c, shade(shirt, 0.18f), 4 * g, -69, 9 * g, -70, 12 * g, -66, 10 * g, -46, 6 * g, -46);
                    line(c, shade(shirt, -0.32f), -3 * g, -58, 0, -44, 1.1f);
                    line(c, shade(shirt, -0.26f), 3 * g, -52, 5 * g, -42, 1.0f);
                    line(c, shade(shirt, -0.2f), -8 * g, -50, -5 * g, -42, 1.0f);
                }
                circle(c, shirt, -10 * g, -65.5f, 4.2f);
                circle(c, shade(shirt, 0.1f), 10 * g, -65.5f, 4.2f);
                // cinto
                rect(c, 0xFF1A1A1A, -10.5f * g, -41, 10.5f * g, -37.5f);
                rect(c, 0xFFBDBDBD, 1 * g, -41, 4 * g, -37.5f);
            }
        }
        if (lk.hero == 0) { // camisa da seleção: gola verde e escudo
            poly(c, 0xFF1B8F3A, -6, -70, 6, -70, 0, -62);
            circle(c, 0xFF1D3E9A, 6, -56, 3);
            if (lk.torn) {
                poly(c, skin, 4 * g, -48, 12 * g, -52, 10 * g, -38, 2 * g, -38);
                poly(c, shade(shirt, -0.3f), -10 * g, -40, -6 * g, -44, -2 * g, -38);
                for (int i = 0; i < 4; i++) circle(c, 0x66402A12, -8 + i * 6, -66 + (i % 2) * 14, 2.4f);
            }
        }
        if (lk.acc == Data.AC_VEST) { rect(c, 0xFFFFEB3B, -9, -68, 9, -40); line(c, 0xFFB0B000, 0, -68, 0, -40, 1.5f); }
        if (lk.acc == Data.AC_SUIT || lk.acc == Data.AC_ANCHOR) {
            poly(c, 0xFFEEEEEE, -4, -70, 4, -70, 0, -54);
            poly(c, lk.acc == Data.AC_ANCHOR ? 0xFFC62828 : 0xFFD32F2F, -1.5f, -66, 1.5f, -66, 2, -48, -2, -48);
        }
        if (lk.acc == Data.AC_HAWAII) {
            for (int i = 0; i < 6; i++) circle(c, i % 2 == 0 ? 0xFFFFEB3B : 0xFFE91E63, -8 + (i % 3) * 8, -64 + (i / 3) * 12, 3);
        }
        if (lk.acc == Data.AC_COAT) { poly(c, 0xFFFFFFFF, -13, -70, 13, -70, 15, -20, -15, -20); rect(c, 0xFF90A4AE, -1, -68, 1, -22); }
        if (lk.acc == Data.AC_MULA) { poly(c, 0xFFB71C1C, -13, -70, 13, -70, 12, -40, -12, -40); rect(c, 0xFFEEEEEE, -2, -70, 2, -40); }
        if (lk.acc == Data.AC_DANCER) { poly(c, 0xFFFFFF00, -14, -64, 14, -64, 12, -54, -12, -54); }

        // ---- cabeça
        float hx = 2;
        if (pose == P_HURT) hx = -2;
        if (q == 0) {
            poly(c, skin, hx - 10, -92, hx + 6, -94, hx + 12, -84, hx + 10, -74, hx - 2, -70, hx - 11, -76);
        } else {
            oval(c, shade(skin, -0.5f), hx + 0.5f, -82, 12, 13.2f);
            oval(c, shade(skin, -0.2f), hx + 0.5f, -82, 11, 12.2f);
            oval(c, skin, hx + 2.2f, -82.5f, 9.2f, 11.2f);
            if (q >= 2) oval(c, shade(skin, 0.14f), hx + 5.5f, -85, 4.2f, 5.5f);
            oval(c, shade(skin, -0.3f), hx - 4.5f, -81, 2.4f, 3.4f); // orelha
            poly(c, shade(skin, -0.12f), hx + 10.5f, -84, hx + 14.5f, -78.5f, hx + 10, -77.5f); // nariz
            line(c, shade(skin, -0.55f), hx + 5.5f, -74, hx + 10.5f, -74.6f, 1.3f); // boca
            oval(c, shade(skin, -0.3f), hx + 1, -70.5f, 6, 1.6f); // sombra do queixo
        }
        // cabelo
        if (lk.acc == Data.AC_MULA || lk.acc == Data.AC_COAT || lk.acc == Data.AC_ANCHOR || lk.hero == 3 || lk.hero == 2) {
            poly(c, hair, hx - 11, -88, hx + 4, -97, hx + 12, -90, hx + 8, -86, hx - 11, -80);
        } else if (fem) {
            poly(c, hair, hx - 13, -90, hx + 5, -98, hx + 12, -90, hx + 12, -64, hx + 6, -66, hx + 6, -84, hx - 12, -64);
        } else if (lk.acc == Data.AC_KNIFE) {
            poly(c, 0xFF1A1A1A, hx - 12, -90, hx + 6, -98, hx + 13, -88, hx + 10, -74, hx - 14, -70);
        } else {
            poly(c, hair, hx - 11, -88, hx + 4, -96, hx + 12, -89, hx + 10, -86, hx - 11, -82);
        }
        // olhos / sobrancelha
        circle(c, 0xFFFFFFFF, hx + 5, -84, 2.6f);
        circle(c, 0xFF111111, hx + 6, -84, 1.4f);
        line(c, 0xFF222222, hx + 1, -89, hx + 9, -86.5f, 1.6f);
        if (lk.acc == Data.AC_MULA || lk.acc == Data.AC_COAT && false) {
            poly(c, 0xFFF5F5F5, hx - 8, -78, hx + 10, -78, hx + 8, -68, hx, -64, hx - 8, -70);
        }
        if (lk.acc == Data.AC_MASK) {
            rect(c, 0xFFFFFFFF, hx - 2, -82, hx + 12, -74);
            rect(c, 0x5580DEEA, hx + 8, -94, hx + 15, -70); // face shield
        }
        if (lk.acc == Data.AC_COAT || lk.acc == Data.AC_ANCHOR || lk.hero == 2) { // óculos
            ring(c, 0xFF222222, hx + 6, -84, 3.6f, 1.2f);
        }
        if (lk.acc == Data.AC_SUIT) rect(c, 0xFF111111, hx + 1, -87, hx + 12, -83); // óculos escuros
        if (reitor) { // capelo
            poly(c, 0xFF111111, hx - 14, -97, hx + 2, -102, hx + 16, -97, hx + 2, -92);
            line(c, 0xFFFFD400, hx + 2, -100, hx + 14, -92, 1.5f);
        }
        if (lk.acc == Data.AC_DANCER) line(c, 0xFFFF4081, hx - 11, -90, hx + 11, -92, 3);
        if (lk.hero == 1) { // boné verde
            poly(c, 0xFF2E7D32, hx - 11, -90, hx + 6, -98, hx + 12, -90, hx + 18, -88, hx - 11, -86);
        }
        if (lk.hero == 3) { // gravata verde-limão + cabelo branco
            poly(c, 0xFF2E7D32, -2, -68, 2, -68, 3, -50, -3, -50);
        }

        // ---- braços
        float ay = -64;
        float sa = (float) Math.sin(walk * 0.12f) * 8f * mv;
        boolean punching = pose == P_PUNCH;
        float ext = punching ? (pt < 0.5f ? pt * 2 : 1f) : 0;
        int armCol = lk.hero == 0 || fem ? skin : shirt;
        if (lk.acc == Data.AC_TOGA) armCol = 0xFF111111;
        if (q == 0) {
        // braço de trás
            poly(c, shade(armCol, -0.15f), -10, ay, -5, ay, -9 - sa, ay + 24, -14 - sa, ay + 24);
            // braço da frente
            if (punching) {
                float fx = 20 + 18 * ext;
                poly(c, armCol, 4, ay - 2, 10, ay + 4, fx + 6, ay + 8 - 4 * ext, fx, ay + 2 - 4 * ext);
                circle(c, skin, fx + 5, ay + 4 - 4 * ext, 5);
            } else if (pose == P_WIND || pose == P_JKICK || pose == P_CHARGE) {
                float up = pose == P_CHARGE ? -28 : -18;
                poly(c, armCol, 4, ay - 2, 10, ay + 4, 20, ay + up + 6, 14, ay + up);
                circle(c, skin, 19, ay + up + 2, 5);
            } else if (pose == P_GRAB) {
                poly(c, armCol, 4, ay - 2, 10, ay + 4, 32, ay + 6, 30, ay - 1);
                circle(c, skin, 34, ay + 3, 5);
            } else if (pose == P_SPIN) {
                float a = (walk * 0.6f);
                float fx = (float) Math.cos(a) * 30, fy = (float) Math.sin(a) * 8;
                poly(c, armCol, 4, ay - 2, 10, ay + 4, fx + 6, ay + fy + 4, fx, ay + fy - 2);
                circle(c, skin, fx + 3, ay + fy + 1, 5);
            } else {
                poly(c, armCol, 4, ay - 2, 10, ay + 4, 12 + sa, ay + 26, 6 + sa, ay + 26);
                circle(c, skin, 10 + sa, ay + 28, 4.5f);
            }
        } else {
            boolean longS = lk.acc == Data.AC_SUIT || lk.acc == Data.AC_ANCHOR || lk.acc == Data.AC_COAT || toga || reitor
                    || lk.acc == Data.AC_KNIFE || lk.hero == 3 || lk.acc == Data.AC_MULA;
            int up = fem ? skin : (lk.acc == Data.AC_COAT ? (flash > 0 ? 0xFFFFFFFF : 0xFFF2F2F2) : lk.acc == Data.AC_MULA ? shade(shirt, -0.3f) : armCol == skin && !fem ? shirt : armCol);
            if (toga) up = 0xFF151515;
            int fo = longS ? up : skin;
            float hxT, hyT;
            if (punching) { hxT = 25 + 18 * ext; hyT = ay + 4 - 4 * ext; }
            else if (pose == P_WIND || pose == P_JKICK || pose == P_CHARGE) { hxT = 19; hyT = ay + (pose == P_CHARGE ? -28 : -18) + 2; }
            else if (pose == P_GRAB) { hxT = 34; hyT = ay + 3; }
            else if (pose == P_SPIN) { float a2 = walk * 0.6f; hxT = (float) Math.cos(a2) * 30 + 3; hyT = ay + (float) Math.sin(a2) * 8 + 1; }
            else { hxT = 10 + sa; hyT = ay + 27; }
            // braço de trás (guarda alta ao socar)
            float bhx = punching || pose == P_GRAB ? 12 : -11 - sa, bhy = punching || pose == P_GRAB ? ay + 4 : ay + 26;
            limb2(c, shade(up, -0.25f), shade(fo, -0.25f), -8 * g, ay - 1, bhx, bhy, 13.5f, 13.5f, 1, 6.5f);
            circle(c, shade(skin, -0.5f), bhx, bhy + 1, 5f); circle(c, shade(skin, -0.2f), bhx, bhy + 1, 4f);
            // braço da frente
            limb2(c, up, fo, 8 * g, ay - 1, hxT, hyT, 13.5f, 13.5f, 1, 7f);
            circle(c, shade(skin, -0.5f), hxT + 0.5f, hyT + 0.5f, 5.6f);
            circle(c, skin, hxT + 0.5f, hyT + 0.5f, 4.6f);
            if (q >= 2) circle(c, shade(skin, 0.2f), hxT + 1.8f, hyT - 1, 1.8f);
        }

        // ---- acessórios de mão
        float hxp = punching ? 38 + 14 * ext : (pose == P_WIND ? 28 : 16 + sa);
        float hyp = pose == P_WIND ? ay - 18 : ay + 26;
        if (weapon >= 0) weaponDraw(c, weapon, hxp, hyp, pose == P_PUNCH || pose == P_WIND, pt);
        else accessory(c, lk.acc, hxp, hyp, pose, guard, pt);
        if (lk.hero == 1 && weapon < 0 && pose != P_PUNCH) { // bandeira como lança
            line(c, 0xFF8D6E63, 14, ay + 30, 30, ay - 52, 3);
            poly(c, 0xFF1B8F3A, 30, ay - 52, 56, ay - 46, 54, ay - 34, 28, ay - 40);
            poly(c, 0xFFFFD400, 42, ay - 48, 50, ay - 42, 42, ay - 37, 34, ay - 43);
        }
        if (lk.hero == 2 && weapon < 0) { // celular
            rect(c, 0xFF222222, hxp - 3, hyp - 12, hxp + 5, hyp);
            rect(c, 0xFF66BB6A, hxp - 2, hyp - 11, hxp + 4, hyp - 3);
        }
        if (lk.hero == 3 && weapon < 0) { // estátua da liberdade em miniatura
            float tx = hxp, ty = hyp;
            if (pose == P_PUNCH) { ty -= 6; }
            rect(c, 0xFF2E7D32, tx - 3, ty - 26, tx + 3, ty);
            circle(c, 0xFF43A047, tx, ty - 29, 4);
            poly(c, 0xFFFFC107, tx + 1, ty - 40, tx + 5, ty - 40, tx + 3, ty - 32);
        }
        c.restore();
    }

    private static void weaponDraw(Canvas c, int w, float x, float y, boolean swing, float pt) {
        switch (w) {
            case Data.IT_FACA:
                poly(c, 0xFFCFD8DC, x, y - 5, x + 20, y - 8, x + 6, y - 1);
                rect(c, 0xFF4E342E, x - 5, y - 3, x + 2, y + 1);
                break;
            case Data.IT_GUARDA:
                line(c, 0xFF5D4037, x, y + 6, x + (swing ? 40 : 6), y - (swing ? 6 : 40), 3);
                poly(c, 0xFF1B8F3A, x + (swing ? 24 : 6) - 18, y - (swing ? 2 : 36), x + (swing ? 46 : 6), y - (swing ? 16 : 52), x + (swing ? 46 : 22), y - (swing ? -2 : 36));
                break;
            case Data.IT_VUVU:
                poly(c, 0xFFFFEB3B, x - 2, y - 4, x + 36, y - 12, x + 36, y + 2, x - 2, y + 2);
                break;
            case Data.IT_JBL:
                rect(c, 0xFF212121, x - 6, y - 22, x + 16, y + 2);
                circle(c, 0xFF455A64, x + 5, y - 12, 7);
                circle(c, 0xFF90A4AE, x + 5, y - 12, 3);
                break;
            default: break;
        }
    }

    private static void accessory(Canvas c, int acc, float hx, float hy, int pose, boolean guard, float pt) {
        switch (acc) {
            case Data.AC_FLAG:
                line(c, 0xFF8D6E63, hx, hy + 6, hx + 4, hy - 64, 2.5f);
                poly(c, 0xFFD62828, hx + 4, hy - 64, hx + 32, hy - 58, hx + 30, hy - 46, hx + 4, hy - 50);
                break;
            case Data.AC_BOOK:
                rect(c, 0xFF5E35B1, hx - 2, hy - 12, hx + 12, hy + 2);
                rect(c, 0xFFFFF59D, hx, hy - 10, hx + 10, hy);
                break;
            case Data.AC_GUITAR:
                oval(c, 0xFFB5651D, hx + 8, hy - 2, 9, 7);
                line(c, 0xFF5D4037, hx + 12, hy - 4, hx + 34, hy - 20, 2.5f);
                break;
            case Data.AC_KNIFE:
                poly(c, 0xFFE0E0E0, hx, hy - 4, hx + 18, hy - 7, hx + 4, hy);
                break;
            case Data.AC_TROPHY:
                rect(c, 0xFFFFC107, hx - 1, hy - 14, hx + 8, hy - 6);
                rect(c, 0xFFFFA000, hx + 2, hy - 6, hx + 5, hy + 1);
                rect(c, 0xFF6D4C41, hx - 2, hy + 1, hx + 9, hy + 4);
                break;
            case Data.AC_RING:
                if (guard) { ring(c, 0xFFFFFFFF, hx + 8, hy - 26, 22, 4); ring(c, 0x55FFF59D, hx + 8, hy - 26, 26, 5); }
                else { ring(c, 0xFFFFFFFF, hx + 2, hy - 8, 11, 3); }
                break;
            case Data.AC_TRIPOD:
                line(c, 0xFF37474F, hx - 6, hy - 50, hx - 14, hy + 4, 2);
                line(c, 0xFF37474F, hx - 6, hy - 50, hx + 6, hy + 4, 2);
                line(c, 0xFF37474F, hx - 6, hy - 50, hx - 4, hy + 4, 2);
                rect(c, 0xFF212121, hx - 14, hy - 62, hx + 4, hy - 50);
                circle(c, 0xFF90A4AE, hx + 6, hy - 56, 3.5f);
                break;
            case Data.AC_TOGA:
                rect(c, 0xFF5D4037, hx - 2, hy - 14, hx + 2, hy + 4);
                rect(c, 0xFF3E2723, hx - 8, hy - 18, hx + 10, hy - 11);
                break;
            case Data.AC_HAWAII:
                rect(c, 0xFF212121, hx - 1, hy - 14, hx + 3, hy + 2);
                circle(c, 0xFF9E9E9E, hx + 1, hy - 17, 5);
                break;
            case Data.AC_COAT:
                // seringa gigante
                rect(c, 0xFFE0F7FA, hx - 2, hy - 6, hx + 30, hy + 2);
                rect(c, 0xFFE53935, hx + 2, hy - 4, hx + 18, hy);
                line(c, 0xFFB0BEC5, hx + 30, hy - 2, hx + 44, hy - 2, 1.6f);
                rect(c, 0xFF78909C, hx - 6, hy - 9, hx - 2, hy + 5);
                break;
            case Data.AC_ANCHOR:
                line(c, 0xFF1A237E, hx - 4, hy + 6, hx + 22, hy - 24, 4);
                poly(c, 0xFFB0BEC5, hx + 22, hy - 24, hx + 28, hy - 31, hx + 24, hy - 22);
                break;
            case Data.AC_MULA:
                rect(c, 0xFF6D4C41, hx - 2, hy - 18, hx + 6, hy + 2);
                rect(c, 0xFF8D6E63, hx, hy - 24, hx + 4, hy - 18);
                break;
            case Data.AC_MEGA:
                poly(c, 0xFFE0E0E0, hx - 2, hy - 6, hx + 14, hy - 16, hx + 14, hy + 2, hx - 2, hy);
                break;
            default: break;
        }
    }

    // ---------------------------------------------------------------- vilões e veículos
    static void moto(Canvas c, float x, float y, int face, float time, boolean truck) {
        c.save();
        c.translate(x, y);
        c.scale(face, 1);
        softShadow(c, 0, 0, 50, 7);
        if (truck) {
            rect(c, 0xFFB71C1C, -60, -62, 10, -14);
            rect(c, 0xFF1B8F3A, 10, -50, 50, -14);
            poly(c, 0xFF90CAF9, 14, -48, 40, -48, 46, -32, 14, -32);
            rect(c, 0xFFFFD400, -60, -22, 50, -16);
            circle(c, 0xFF212121, -34, -8, 12); circle(c, 0xFF9E9E9E, -34, -8, 5);
            circle(c, 0xFF212121, 32, -8, 12); circle(c, 0xFF9E9E9E, 32, -8, 5);
            // bandeira
            line(c, 0xFF5D4037, -50, -62, -50, -100, 3);
            poly(c, 0xFF1B8F3A, -50, -100, -20, -94 + (float) Math.sin(time * 20) * 3, -22, -80, -50, -86);
        } else {
            circle(c, 0xFF212121, -26, -12, 13); circle(c, 0xFFB0BEC5, -26, -12, 5);
            circle(c, 0xFF212121, 28, -12, 13); circle(c, 0xFFB0BEC5, 28, -12, 5);
            poly(c, 0xFFFFD400, -22, -16, 6, -34, 22, -34, 30, -14, 10, -10);
            poly(c, 0xFF1B8F3A, -22, -16, -10, -30, 6, -34, 0, -18);
            line(c, 0xFF9E9E9E, 28, -12, 22, -42, 3);
            line(c, 0xFF9E9E9E, 14, -42, 30, -44, 3);
            // chama de escape
            poly(c, 0xFFFF9800, -38, -16, -60 - (float) Math.sin(time * 40) * 8, -12, -38, -8);
        }
        c.restore();
    }

    static void raptor(Canvas c, float x, float y, float h, int face, float walk, float mv, int pose, float pt, float flash, boolean roar) {
        softShadow(c, x, y, 48 * persp, 8 * persp);
        c.save();
        c.translate(x, y - h);
        c.scale(face * 1.15f * persp, 1.15f * persp);
        int body = flash > 0 ? 0xFFFFFFFF : 0xFF3F8F2E, belly = flash > 0 ? 0xFFFFFFFF : 0xFFB8D87A, dark = flash > 0 ? 0xFFFFFFFF : 0xFF2A6420;
        float sw = (float) Math.sin(walk * 0.1f) * 12f * mv;
        // cauda
        poly(c, dark, -20, -60, -95, -46 + (float) Math.sin(walk * 0.05f) * 3, -96, -52, -18, -82);
        // perna de trás
        poly(c, dark, -2, -52, 14, -52, 14 - sw, -8, -4 - sw, -8);
        poly(c, 0xFFFFF59D, 14 - sw, -8, 24 - sw, 0, -6 - sw, 0);
        // corpo
        poly(c, body, -26, -50, -12, -92, 34, -96, 50, -66, 28, -40, -2, -40);
        poly(c, belly, 8, -44, 34, -50, 46, -66, 28, -40);
        // pescoço + cabeça
        poly(c, body, 28, -94, 46, -92, 62, -126, 48, -128);
        float jaw = roar ? 16 : 4;
        poly(c, body, 48, -132, 94, -128, 96, -114, 56, -108);
        poly(c, belly, 56, -108, 96, -114, 92, -108 + jaw, 60, -102 + jaw);
        for (int i = 0; i < 4; i++) poly(c, 0xFFFFFFFF, 62 + i * 8, -112, 66 + i * 8, -112, 64 + i * 8, -105);
        circle(c, 0xFFFFEB3B, 70, -123, 4); circle(c, 0xFF111111, 71, -123, 2);
        // perna da frente
        poly(c, body, -4, -52, 14, -52, 14 + sw, -8, -4 + sw, -8);
        poly(c, 0xFFFFF59D, 14 + sw, -8, 24 + sw, 0, -6 + sw, 0);
        // braços + mastro com bandeira
        poly(c, dark, 44, -78, 56, -74, 62, -64, 54, -64);
        float ang = pose == P_PUNCH ? -70f + pt * 220f : pose == P_SPIN ? walk * 40f : (pose == P_KICK ? 0f : -85f);
        c.save();
        c.translate(60, -66);
        if (pose == P_KICK || pose == P_SPEC) c.rotate(0); else c.rotate(ang);
        float len = pose == P_KICK || pose == P_SPEC ? 100 : 78;
        if (pose == P_KICK || pose == P_SPEC) { line(c, 0xFF8D6E63, -10, 0, len, 0, 4); poly(c, 0xFFCFD8DC, len, -4, len + 16, 0, len, 4); }
        else {
            line(c, 0xFF8D6E63, 0, 40, 0, -len, 4);
            // bandeira rasgada
            float wv = (float) Math.sin(walk * 0.2f + pt * 10) * 4;
            poly(c, 0xFF2E7D32, 0, -len, 34, -len + 4 + wv, 28, -len + 12, 36, -len + 20 + wv, 0, -len + 28);
            poly(c, 0xFFFFD400, 16, -len + 6, 26, -len + 14, 16, -len + 22, 6, -len + 14);
            circle(c, 0xFF1D3E9A, 16, -len + 14, 3.6f);
        }
        c.restore();
        c.restore();
    }

    // ---------------------------------------------------------------- objetos
    static void crate(Canvas c, float x, float y, float flash, int theme, float hpFrac) {
        softShadow(c, x, y, 22 * persp, 5 * persp);
        int col = flash > 0 ? 0xFFFFFFFF : 0xFFC68B3E;
        if (theme == Data.TH_PAULISTA) { // carrinho de ambulante
            rect(c, flash > 0 ? col : 0xFFE53935, x - 22, y - 34, x + 22, y - 12);
            rect(c, 0xFFFFEB3B, x - 24, y - 38, x + 24, y - 34);
            poly(c, 0xFFFFFFFF, x - 22, y - 38, x + 22, y - 38, x + 26, y - 58, x - 26, y - 58);
            poly(c, 0xFFE53935, x - 22, y - 38, x, y - 38, x - 4, y - 58, x - 26, y - 58);
            circle(c, 0xFF212121, x - 12, y - 6, 7); circle(c, 0xFF212121, x + 12, y - 6, 7);
        } else {
            rect(c, col, x - 20, y - 34, x + 20, y);
            rect(c, shade(col, -0.25f), x - 20, y - 34, x + 20, y - 28);
            line(c, 0xFF6D4C41, x - 20, y - 34, x + 20, y, 2.5f);
            line(c, 0xFF6D4C41, x + 20, y - 34, x - 20, y, 2.5f);
            rect(c, 0xFF1B8F3A, x - 6, y - 40, x + 6, y - 34);
            if (q >= 2) { for (int i = 0; i < 4; i++) line(c, 0x33000000, x - 18, y - 28 + i * 7, x + 18, y - 27 + i * 7, 1f); rect(c, 0x30FFFFFF, x - 20, y - 34, x - 16, y); }
        }
    }

    static void desk(Canvas c, float x, float y, float flash, float frac) {
        softShadow(c, x, y, 60, 8);
        int col = flash > 0 ? 0xFFFFFFFF : 0xFF37474F;
        poly(c, col, x - 60, y - 52, x + 60, y - 52, x + 66, y - 8, x - 66, y - 8);
        poly(c, flash > 0 ? col : 0xFF546E7A, x - 66, y - 60, x + 66, y - 60, x + 60, y - 52, x - 60, y - 52);
        rect(c, 0xFF1565C0, x - 40, y - 46, x + 40, y - 20);
        text(c, "TN", x, y - 26, 22, 0xFFFFFFFF, Paint.Align.CENTER);
        // monitores
        rect(c, 0xFF212121, x - 50, y - 84, x - 24, y - 62); rect(c, 0xFF4FC3F7, x - 48, y - 82, x - 26, y - 66);
        rect(c, 0xFF212121, x + 24, y - 84, x + 50, y - 62); rect(c, 0xFF4FC3F7, x + 26, y - 82, x + 48, y - 66);
        if (frac < 0.5f) { line(c, 0xFF000000, x - 20, y - 52, x - 8, y - 30, 2); line(c, 0xFF000000, x + 20, y - 52, x + 30, y - 24, 2); }
    }

    static void item(Canvas c, float x, float y, float h, int kind, float t) {
        float bob = (float) Math.sin(t * 5) * 2;
        softShadow(c, x, y, 12, 4);
        c.save();
        c.translate(x, y - h - 10 + bob);
        switch (kind) {
            case Data.IT_PAO:
                oval(c, 0xFFD7A15C, 0, 0, 13, 8); rect(c, 0xFFFFF8E1, -11, -1, 11, 2);
                break;
            case Data.IT_PASTEL:
                poly(c, 0xFFE0A030, -13, 4, 13, 4, 0, -10);
                rect(c, 0xFF9CCC65, 8, -14, 12, 4);
                break;
            case Data.IT_CAFE:
                rect(c, 0xFFFFFFFF, -7, -8, 7, 6); rect(c, 0xFF5D4037, -6, -7, 6, -3); ring(c, 0xFFFFFFFF, 9, -1, 4, 2);
                break;
            case Data.IT_PEN:
                rect(c, 0xFF212121, -8, -4, 8, 4); rect(c, 0xFF90A4AE, 8, -2, 12, 2); circle(c, 0xFF40C4FF, -4, 0, 1.5f);
                break;
            case Data.IT_CLORO:
                rect(c, 0xFFFFFFFF, -12, -12, 12, 8); rect(c, 0xFFE53935, -3, -10, 3, 6); rect(c, 0xFFE53935, -10, -3, 10, 3);
                break;
            case Data.IT_JBL:
                rect(c, 0xFF212121, -10, -14, 10, 6); circle(c, 0xFF455A64, 0, -4, 6); circle(c, 0xFFFF8F00, 0, -4, 2);
                break;
            case Data.IT_VUVU:
                poly(c, 0xFFFFEB3B, -14, 2, 14, -6, 14, 2, -14, 6);
                break;
            case Data.IT_GUARDA:
                poly(c, 0xFF1B8F3A, -14, -2, 0, -14, 14, -2); line(c, 0xFF5D4037, 0, -2, 0, 10, 2);
                break;
            case Data.IT_FACA:
                poly(c, 0xFFCFD8DC, -12, 0, 8, -6, -6, 4); rect(c, 0xFF4E342E, -16, -1, -10, 4);
                break;
            default: break;
        }
        c.restore();
        if (kind >= Data.IT_JBL) { // dica de pegar
            P.setColor(0xFFFFFFFF);
        }
    }

    static void proj(Canvas c, Ent e, float x, float y, float time) {
        float sy = y - e.h;
        switch (e.kind) {
            case Game.PJ_SYRINGE:
                c.save(); c.translate(x, sy); c.scale(e.face, 1);
                rect(c, 0xFFE0F7FA, -14, -4, 12, 4); rect(c, 0xFF43A047, -8, -3, 4, 3);
                line(c, 0xFFB0BEC5, 12, 0, 24, 0, 1.6f); rect(c, 0xFF78909C, -18, -6, -14, 6);
                c.restore();
                break;
            case Game.PJ_WAVE: {
                int a = 0xFFFFFFFF;
                if (e.tall) {
                    for (int i = 0; i < 3; i++) ring(c, i == 0 ? 0xFFFFEB3B : 0x88FFFFFF, x, y - 30, 16 + i * 9 + (float) Math.sin(time * 14) * 2, 3);
                } else {
                    poly(c, 0xCCFFD400, x - 12, y, x, y - 30, x + 12, y);
                    poly(c, 0xCCFFFFFF, x - 6, y, x, y - 18, x + 6, y);
                }
                break;
            }
            case Game.PJ_TROPHY:
                c.save(); c.translate(x, sy); c.rotate(time * 500);
                rect(c, 0xFFFFC107, -5, -8, 5, 0); rect(c, 0xFFFFA000, -2, 0, 2, 6); rect(c, 0xFF6D4C41, -6, 6, 6, 9);
                c.restore();
                break;
            case Game.PJ_WATCH:
                c.save(); c.translate(x, sy); c.rotate(time * 400);
                circle(c, 0xFFFFD400, 0, 0, 8); circle(c, 0xFFFFFFFF, 0, 0, 5); line(c, 0xFF000000, 0, 0, 0, -4, 1.4f);
                c.restore();
                break;
            case Game.PJ_PAPER:
                c.save(); c.translate(x, sy); c.rotate(time * 700);
                poly(c, 0xFFFFFFFF, -9, -9, 9, -9, 9, 9, -9, 9); line(c, 0xFF90A4AE, -6, -3, 6, -3, 1.4f); line(c, 0xFF90A4AE, -6, 3, 6, 3, 1.4f);
                c.restore();
                break;
            case Game.PJ_BOOK:
                c.save(); c.translate(x, sy); c.rotate(time * 400);
                rect(c, 0xFF5E35B1, -8, -6, 8, 6); rect(c, 0xFFFFF59D, -6, -4, 8, 4);
                c.restore();
                break;
            case Game.PJ_MULTA:
                c.save(); c.translate(x, sy); c.rotate(time * 300);
                rect(c, 0xFFFFF176, -10, -7, 10, 7); text(c, "R$", 0, 4, 11, 0xFFD50000, Paint.Align.CENTER);
                c.restore();
                break;
            case Game.PJ_NOTIF:
                circle(c, 0xFF2E7D32, x, sy, 9); circle(c, 0xFF66BB6A, x - 2, sy - 2, 5);
                text(c, "1", x, sy + 4, 10, 0xFFFFFFFF, Paint.Align.CENTER);
                break;
            default: break;
        }
    }
}
