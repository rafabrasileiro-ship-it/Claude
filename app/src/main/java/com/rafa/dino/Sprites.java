package com.rafa.dino;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;

/** Todos os desenhos do jogo (personagens, prédios, bolas de fogo, céu e chão). */
public class Sprites {

    public static final float GROUND_Y = 240f;
    public static final float WORLD_H = 300f;

    public static final String[] NAMES = {"DINO", "GODZILLA", "PREDADOR", "ALIEN", "CABRA", "SALSICHA"};
    public static final int COUNT = NAMES.length;
    /** Altura em pé de cada personagem (também usada na colisão). */
    public static final int[] HEIGHT = {47, 52, 52, 48, 38, 26};
    /** Altura abaixado. */
    public static final int[] DUCK_H = {28, 34, 34, 30, 26, 20};

    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();

    public Sprites() {
        p.setStrokeCap(Paint.Cap.ROUND);
    }

    // ---------------- utilidades ----------------

    public static int mix(int a, int b, float t) {
        t = Math.max(0f, Math.min(1f, t));
        return Color.rgb(
                (int) (Color.red(a) + (Color.red(b) - Color.red(a)) * t),
                (int) (Color.green(a) + (Color.green(b) - Color.green(a)) * t),
                (int) (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t));
    }

    private static int alpha(int a, int rgb) {
        return Color.argb(a, Color.red(rgb), Color.green(rgb), Color.blue(rgb));
    }

    private static int hash(int a) {
        a *= 0x9E3779B1;
        a ^= a >>> 15;
        a *= 0x85EBCA6B;
        a ^= a >>> 13;
        return a & 0x7fffffff;
    }

    private void rect(Canvas c, float l, float t, float rr, float b, int col) {
        p.setStyle(Paint.Style.FILL);
        p.setColor(col);
        c.drawRect(l, t, rr, b, p);
    }

    private void rrect(Canvas c, float l, float t, float rr, float b, float rad, int col) {
        p.setStyle(Paint.Style.FILL);
        p.setColor(col);
        r.set(l, t, rr, b);
        c.drawRoundRect(r, rad, rad, p);
    }

    private void oval(Canvas c, float l, float t, float rr, float b, int col) {
        p.setStyle(Paint.Style.FILL);
        p.setColor(col);
        r.set(l, t, rr, b);
        c.drawOval(r, p);
    }

    private void circle(Canvas c, float cx, float cy, float rad, int col) {
        p.setStyle(Paint.Style.FILL);
        p.setColor(col);
        c.drawCircle(cx, cy, rad, p);
    }

    private void tri(Canvas c, float x1, float y1, float x2, float y2, float x3, float y3, int col) {
        p.setStyle(Paint.Style.FILL);
        p.setColor(col);
        path.reset();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
        path.lineTo(x3, y3);
        path.close();
        c.drawPath(path, p);
    }

    private void line(Canvas c, float x1, float y1, float x2, float y2, float w, int col) {
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(w);
        p.setColor(col);
        c.drawLine(x1, y1, x2, y2, p);
        p.setStyle(Paint.Style.FILL);
    }

    private void eyeX(Canvas c, float ex, float ey, int col) {
        line(c, ex - 2, ey - 2, ex + 2, ey + 2, 1.2f, col);
        line(c, ex + 2, ey - 2, ex - 2, ey + 2, 1.2f, col);
    }

    private static float lift(int leg, int which) {
        return leg == which ? 4f : 0f;
    }

    // ---------------- personagens ----------------

    /**
     * Desenha o personagem com os pés em {@code bottom} e a borda esquerda em {@code x}.
     * leg: 0/1 = fase da corrida, -1 = no ar.
     */
    public void drawCharacter(Canvas c, int id, float x, float bottom, boolean duck, int leg, boolean dead) {
        if (id == 0) {
            dino(c, x, bottom, duck, leg, dead);
            return;
        }
        if (duck) {
            c.save();
            c.translate(x, bottom);
            c.scale(1.18f, (float) DUCK_H[id] / HEIGHT[id]);
            c.translate(-x, -bottom);
        }
        switch (id) {
            case 1: godzilla(c, x, bottom, leg, dead); break;
            case 2: predator(c, x, bottom, leg, dead); break;
            case 3: alien(c, x, bottom, leg, dead); break;
            case 4: goat(c, x, bottom, leg, dead); break;
            default: dachshund(c, x, bottom, leg, dead); break;
        }
        if (duck) c.restore();
    }

    private void dino(Canvas c, float x, float b, boolean duck, int leg, boolean dead) {
        final int body = 0xFF4CAF50, belly = 0xFFC8E6C9, dark = 0xFF333333;
        if (duck) {
            float y = b - 28;
            rrect(c, x - 4, y + 6, x + 40, y + 22, 8, body);
            rrect(c, x + 32, y, x + 56, y + 16, 6, body);
            dinoEye(c, x + 47, y + 5, dead);
            dinoLegs(c, x + 6, y + 21, leg, body, 7);
            return;
        }
        float y = b - 47;
        tri(c, x, y + 18, x - 6, y + 28, x + 10, y + 32, body);
        rrect(c, x + 2, y + 16, x + 32, y + 40, 10, body);
        oval(c, x + 12, y + 24, x + 30, y + 38, belly);
        rect(c, x + 20, y + 6, x + 32, y + 26, body);
        rrect(c, x + 20, y, x + 46, y + 16, 7, body);
        rrect(c, x + 30, y + 24, x + 36, y + 28, 2, body);
        dinoEye(c, x + 36, y + 5, dead);
        rect(c, x + 38, y + 12, x + 45, y + 13, dark);
        dinoLegs(c, x + 8, y + 38, leg, body, 9);
    }

    private void dinoEye(Canvas c, float ex, float ey, boolean dead) {
        circle(c, ex + 2.5f, ey + 2.5f, 3.2f, 0xFFFFFFFF);
        if (dead) eyeX(c, ex + 2.5f, ey + 2.5f, 0xFF282828);
        else circle(c, ex + 3.2f, ey + 2.5f, 1.6f, 0xFF282828);
    }

    private void dinoLegs(Canvas c, float lx, float ly, int leg, int col, float len) {
        float l1 = leg == 0 ? len - 4 : len;
        float l2 = leg == 1 ? len - 4 : len;
        rect(c, lx, ly, lx + 5, ly + l1, col);
        rect(c, lx + 13, ly, lx + 18, ly + l2, col);
        rect(c, lx, ly + l1 - 2, lx + 8, ly + l1, col);
        rect(c, lx + 13, ly + l2 - 2, lx + 21, ly + l2, col);
    }

    private void godzilla(Canvas c, float x, float b, int leg, boolean dead) {
        final int body = 0xFF3D4A43, dark = 0xFF2A352F, belly = 0xFF6B7B70, plate = 0xFFB4C0BA;
        float y = b - 52;
        // placas nas costas
        float[][] pl = {{21, 8}, {15, 14}, {9, 21}, {4, 30}, {-3, 38}};
        for (float[] q : pl) {
            tri(c, x + q[0], y + q[1] + 4, x + q[0] + 5, y + q[1] - 1, x + q[0] - 4, y + q[1] - 7, plate);
        }
        // cauda
        tri(c, x + 10, y + 24, x - 13, y + 47, x + 14, y + 43, body);
        // pernas grossas
        float l1 = lift(leg, 0), l2 = lift(leg, 1);
        rrect(c, x + 9, y + 38, x + 21, b - l1, 3, dark);
        rrect(c, x + 24, y + 38, x + 36, b - l2, 3, dark);
        rect(c, x + 9, b - l1 - 2, x + 25, b - l1, dark);
        rect(c, x + 24, b - l2 - 2, x + 40, b - l2, dark);
        // tronco, barriga, pescoço
        rrect(c, x + 8, y + 14, x + 37, y + 44, 10, body);
        oval(c, x + 22, y + 22, x + 37, y + 42, belly);
        rect(c, x + 22, y + 8, x + 35, y + 22, body);
        // cabeça e mandíbula
        rrect(c, x + 22, y, x + 46, y + 15, 5, body);
        rrect(c, x + 28, y + 12, x + 47, y + 19, 3, dark);
        for (int i = 0; i < 4; i++) {
            float tx = x + 31 + i * 3.8f;
            tri(c, tx, y + 12, tx + 2.6f, y + 12, tx + 1.3f, y + 15, 0xFFF5F5F5);
        }
        circle(c, x + 44, y + 3.5f, 0.9f, dark);
        if (dead) eyeX(c, x + 35, y + 5, 0xFFFFEB3B);
        else {
            circle(c, x + 35, y + 5, 2.4f, 0xFFFFEB3B);
            rect(c, x + 34.6f, y + 3.6f, x + 35.4f, y + 6.4f, 0xFF111111);
        }
        // bracinhos
        rrect(c, x + 33, y + 25, x + 41, y + 29, 2, body);
    }

    private void predator(Canvas c, float x, float b, int leg, boolean dead) {
        final int skin = 0xFF9C8B57, skinD = 0xFF6B5E3A, armor = 0xFF5B5F55, metal = 0xFF9AA0A6, dread = 0xFF1A1A1A;
        float y = b - 52;
        // dreads
        for (int i = 0; i < 5; i++) {
            line(c, x + 20, y + 4 + i * 2.2f, x + 9 - i * 1.2f, y + 24 + i * 2.5f, 2f, dread);
        }
        // pernas
        float l1 = lift(leg, 0), l2 = lift(leg, 1);
        rect(c, x + 14, y + 34, x + 22, b - l1, skin);
        rect(c, x + 25, y + 34, x + 33, b - l2, skin);
        rect(c, x + 13.5f, y + 43, x + 22.5f, b - l1 - 2, metal);
        rect(c, x + 24.5f, y + 43, x + 33.5f, b - l2 - 2, metal);
        rect(c, x + 13, b - l1 - 2, x + 27, b - l1, skinD);
        rect(c, x + 24, b - l2 - 2, x + 38, b - l2, skinD);
        // tronco com rede
        rrect(c, x + 12, y + 16, x + 32, y + 37, 4, armor);
        for (int i = 0; i < 5; i++) {
            line(c, x + 13, y + 19 + i * 3.6f, x + 31, y + 19 + i * 3.6f, 0.9f, skin);
        }
        rect(c, x + 16, y + 35, x + 28, y + 41, skinD);
        // braço e lâmina do pulso
        line(c, x + 30, y + 20, x + 38, y + 29, 4, skin);
        line(c, x + 38, y + 29, x + 51, y + 25, 1.6f, 0xFFE0E0E0);
        // canhão no ombro
        rrect(c, x + 15, y + 8, x + 27, y + 15, 2, metal);
        circle(c, x + 28.5f, y + 11, 1.6f, 0xFFFF1744);
        // cabeça, máscara e mandíbulas
        rrect(c, x + 19, y + 1, x + 34, y + 17, 5, skin);
        rrect(c, x + 24, y + 2, x + 36, y + 14, 3, metal);
        rect(c, x + 24, y + 4, x + 36, y + 5, 0xFF555B61);
        if (dead) eyeX(c, x + 32, y + 8, 0xFFFFEB3B);
        else rect(c, x + 29, y + 7, x + 35, y + 9, 0xFFFFD600);
        line(c, x + 29, y + 14, x + 26.5f, y + 21, 2, skinD);
        line(c, x + 34, y + 14, x + 37, y + 21, 2, skinD);
        line(c, x + 31.5f, y + 14, x + 31.5f, y + 20, 1.5f, skinD);
    }

    private void alien(Canvas c, float x, float b, int leg, boolean dead) {
        final int base = 0xFF14141C, hi = 0xFF3B4166, mid = 0xFF262A44;
        float y = b - 48;
        // cauda com lâmina
        line(c, x + 10, y + 28, x - 4, y + 36, 4, base);
        line(c, x - 4, y + 36, x - 12, y + 22, 3, base);
        line(c, x - 12, y + 22, x - 12, y + 10, 2, base);
        tri(c, x - 14, y + 11, x - 10, y + 11, x - 12, y + 4, base);
        // tubos nas costas
        line(c, x + 16, y + 17, x + 5, y + 10, 2.4f, mid);
        line(c, x + 19, y + 19, x + 8, y + 15, 2.4f, mid);
        // pernas
        float l1 = lift(leg, 0), l2 = lift(leg, 1);
        line(c, x + 15, y + 34, x + 12, y + 41, 5, base);
        line(c, x + 12, y + 41, x + 17, b - l1 - 1, 3.5f, base);
        line(c, x + 17, b - l1 - 1, x + 23, b - l1 - 1, 3, base);
        line(c, x + 27, y + 34, x + 24, y + 41, 5, base);
        line(c, x + 24, y + 41, x + 29, b - l2 - 1, 3.5f, base);
        line(c, x + 29, b - l2 - 1, x + 35, b - l2 - 1, 3, base);
        // tronco
        oval(c, x + 9, y + 15, x + 35, y + 39, base);
        oval(c, x + 14, y + 17, x + 29, y + 23, hi);
        for (int i = 0; i < 3; i++) line(c, x + 15 + i * 4, y + 26, x + 17 + i * 4, y + 34, 1, mid);
        // braço
        line(c, x + 30, y + 26, x + 39, y + 31, 3, base);
        line(c, x + 39, y + 31, x + 44, y + 29, 1.6f, base);
        // cabeça alongada
        oval(c, x + 6, y + 1, x + 40, y + 17, base);
        oval(c, x + 12, y + 3, x + 33, y + 8, hi);
        rrect(c, x + 30, y + 9, x + 44, y + 19, 4, base);
        // boca com dentes
        rect(c, x + 38, y + 12, x + 47, y + 15, 0xFF2B0F0F);
        for (int i = 0; i < 4; i++) rect(c, x + 38.5f + i * 2.3f, y + 11.5f, x + 39.5f + i * 2.3f, y + 13.6f, 0xFFE8E8E8);
        for (int i = 0; i < 3; i++) rect(c, x + 39.5f + i * 2.3f, y + 13.6f, x + 40.5f + i * 2.3f, y + 15.6f, 0xFFE8E8E8);
        if (dead) eyeX(c, x + 33, y + 8, 0xFFB0BEC5);
    }

    private void goat(Canvas c, float x, float b, int leg, boolean dead) {
        final int white = 0xFFF2EFE6, shade = 0xFFCFC9B8, hoof = 0xFF3E3A34, horn = 0xFFB9A77A;
        float y = b - 38;
        // rabinho
        tri(c, x + 4, y + 15, x - 2, y + 8, x + 8, y + 17, white);
        // pernas de trás e da frente
        float a = lift(leg, 0) * 0.75f, d = lift(leg, 1) * 0.75f;
        rect(c, x + 7, y + 26, x + 11, b - a, shade);
        rect(c, x + 28, y + 26, x + 32, b - a, shade);
        rect(c, x + 7, b - a - 2.5f, x + 11, b - a, hoof);
        rect(c, x + 28, b - a - 2.5f, x + 32, b - a, hoof);
        rect(c, x + 13, y + 26, x + 17, b - d, white);
        rect(c, x + 34, y + 26, x + 38, b - d, white);
        rect(c, x + 13, b - d - 2.5f, x + 17, b - d, hoof);
        rect(c, x + 34, b - d - 2.5f, x + 38, b - d, hoof);
        // corpo e pescoço
        oval(c, x + 3, y + 12, x + 38, y + 31, white);
        oval(c, x + 6, y + 22, x + 34, y + 31, shade);
        rrect(c, x + 29, y + 4, x + 40, y + 20, 4, white);
        // chifre curvo
        line(c, x + 35, y + 3, x + 31, y - 4, 3, horn);
        line(c, x + 31, y - 4, x + 25, y - 3, 2.4f, horn);
        // cabeça, orelha, focinho, barba
        rrect(c, x + 32, y + 1, x + 46, y + 14, 5, white);
        rrect(c, x + 40, y + 6, x + 50, y + 15, 4, white);
        oval(c, x + 27, y + 3, x + 36, y + 8, shade);
        circle(c, x + 48.5f, y + 9, 1.4f, 0xFF4A3F38);
        if (dead) eyeX(c, x + 40, y + 6, 0xFF333333);
        else circle(c, x + 40, y + 6, 1.5f, 0xFF333333);
        tri(c, x + 43, y + 14, x + 47, y + 14, x + 45, y + 21, 0xFFE6E1D3);
    }

    private void dachshund(Canvas c, float x, float b, int leg, boolean dead) {
        final int black = 0xFF222226, ear = 0xFF0E0E10, car = 0xFFC68642, carL = 0xFFDDA45E;
        float y = b - 26;
        // rabo
        line(c, x + 3, y + 12, x - 5, y + 6, 3, black);
        // patas curtinhas (caramelo)
        float a = lift(leg, 0) * 0.7f, d = lift(leg, 1) * 0.7f;
        rrect(c, x + 3, y + 17, x + 8, b - a, 2, car);
        rrect(c, x + 10, y + 17, x + 15, b - d, 2, carL);
        rrect(c, x + 26, y + 17, x + 31, b - d, 2, car);
        rrect(c, x + 33, y + 17, x + 38, b - a, 2, carL);
        // corpo comprido
        rrect(c, x, y + 8, x + 36, y + 20, 6, black);
        // peito caramelo
        oval(c, x + 25, y + 11, x + 38, y + 22, car);
        // cabeça, focinho, orelha
        rrect(c, x + 33, y + 3, x + 45, y + 16, 5, black);
        rrect(c, x + 40, y + 9, x + 51, y + 16, 3, black);
        circle(c, x + 50, y + 10.5f, 1.9f, 0xFF4A4A50);
        oval(c, x + 31, y + 6, x + 39, y + 18, ear);
        circle(c, x + 41, y + 6.2f, 1.1f, car);
        if (dead) eyeX(c, x + 42, y + 8.5f, 0xFFDDDDDD);
        else {
            circle(c, x + 42, y + 8.5f, 1.5f, 0xFF5D4037);
            circle(c, x + 42.4f, y + 8f, 0.5f, 0xFFFFFFFF);
        }
    }

    // ---------------- obstáculos ----------------

    public void drawBuilding(Canvas c, float x, float bottom, float w, float h, int seed, float night) {
        int[] pal = {0xFF78909C, 0xFFA1887F, 0xFF8D6E63, 0xFF90A4AE, 0xFF7E8CA6};
        int hs = hash(seed);
        int wall = mix(pal[hs % pal.length], 0xFF1A1E2A, 0.6f * night);
        int roof = mix(wall, 0xFF000000, 0.25f);
        float top = bottom - h;
        rect(c, x, top, x + w, bottom, wall);
        rect(c, x - 1.5f, top - 3, x + w + 1.5f, top, roof);
        // lateral levemente mais escura para dar volume
        rect(c, x + w - 3, top, x + w, bottom, mix(wall, 0xFF000000, 0.15f));
        // janelas
        int cols = Math.max(1, (int) ((w - 6) / 8));
        int rows = Math.max(1, (int) ((h - 10) / 11));
        float gx = (w - cols * 8 + 4) / 2f;
        for (int rr = 0; rr < rows; rr++) {
            for (int cc = 0; cc < cols; cc++) {
                boolean lit = hash(seed * 31 + rr * 7 + cc * 13) % 5 < 2;
                int col = night > 0.5f
                        ? (lit ? 0xFFFFE082 : 0xFF2A2F45)
                        : (lit ? 0xFFB3E5FC : mix(wall, 0xFF37474F, 0.45f));
                float wx = x + gx + cc * 8;
                float wy = top + 6 + rr * 11;
                rect(c, wx, wy, wx + 4, wy + 6, col);
            }
        }
        // porta no térreo
        rect(c, x + w / 2 - 3, bottom - 7, x + w / 2 + 3, bottom, mix(wall, 0xFF000000, 0.45f));
        // detalhe no telhado
        switch (hs / 7 % 3) {
            case 0:
                line(c, x + w * 0.65f, top - 3, x + w * 0.65f, top - 11, 1.2f, roof);
                circle(c, x + w * 0.65f, top - 11, 1.4f, 0xFFFF5252);
                break;
            case 1:
                rect(c, x + 4, top - 8, x + 12, top - 3, mix(wall, 0xFF000000, 0.35f));
                rect(c, x + 5, top - 3, x + 6, top, roof);
                rect(c, x + 10, top - 3, x + 11, top, roof);
                break;
            default:
                rect(c, x + w - 13, top - 6, x + w - 5, top - 3, mix(wall, 0xFFFFFFFF, 0.2f));
        }
    }

    public void drawFireball(Canvas c, float x, float y, float w, float h, float t) {
        float cy = y + h / 2, rad = h / 2;
        circle(c, x + rad, cy, rad * 1.7f, alpha(55, 0xFF9800));
        for (int i = 0; i < 3; i++) {
            float f = (float) Math.sin(t * 28 + i * 2.1f) * 2f;
            float yy = cy + (i - 1) * 5f;
            float tipX = x + w - i * 5 + f;
            float tipY = cy + (i - 1) * 9f + f;
            tongue(c, x + rad, yy, tipX, tipY, rad * (0.85f - i * 0.1f), 0xFFE53935);
            tongue(c, x + rad, yy, tipX - 5, tipY, rad * (0.6f - i * 0.08f), 0xFFFF9800);
        }
        circle(c, x + rad, cy, rad, 0xFFE53935);
        circle(c, x + rad - 1, cy, rad * 0.78f, 0xFFFF9800);
        circle(c, x + rad - 2, cy, rad * 0.5f, 0xFFFFEB3B);
        circle(c, x + rad - 3, cy, rad * 0.26f, 0xFFFFFDE7);
    }

    private void tongue(Canvas c, float bx, float by, float tx, float ty, float thick, int col) {
        p.setStyle(Paint.Style.FILL);
        p.setColor(col);
        path.reset();
        path.moveTo(bx, by - thick);
        path.quadTo((bx + tx) / 2, by - thick * 0.6f, tx, ty);
        path.quadTo((bx + tx) / 2, by + thick * 0.6f, bx, by + thick);
        path.close();
        c.drawPath(path, p);
    }

    // ---------------- cenário ----------------

    public void drawSky(Canvas c, float w, float night, float t) {
        final int bands = 16;
        float bh = GROUND_Y / bands;
        for (int i = 0; i < bands; i++) {
            float f = i / (bands - 1f);
            int col = mix(mix(0xFF6EB6E8, 0xFFD6EEFA, f), mix(0xFF080C22, 0xFF2A3262, f), night);
            rect(c, 0, i * bh, w, (i + 1) * bh + 1, col);
        }
        if (night > 0.05f) {
            for (int i = 0; i < 55; i++) {
                float sx = (hash(i * 3) % 1000) / 1000f * w;
                float sy = (hash(i * 3 + 1) % 1000) / 1000f * 160f;
                float tw = 0.5f + 0.5f * (float) Math.sin(t * 2 + i);
                circle(c, sx, sy, i % 5 == 0 ? 1.4f : 0.8f,
                        alpha((int) (255 * night * (0.35f + 0.65f * tw)), 0xFFFFFF));
            }
        }
        float cx = w - 90, cy = 52;
        if (night < 0.95f) {
            int a = (int) (255 * (1 - night));
            circle(c, cx, cy, 24, alpha(a / 5, 0xFFF3B0));
            circle(c, cx, cy, 17, alpha(a / 3, 0xFFF3B0));
            circle(c, cx, cy, 12, alpha(a, 0xFFD54F));
        }
        if (night > 0.05f) {
            int a = (int) (255 * night);
            circle(c, cx, cy, 13, alpha(a, 0xF1F0DC));
            circle(c, cx - 4, cy - 3, 2.6f, alpha(a, 0xD6D4BE));
            circle(c, cx + 4, cy + 2, 3.2f, alpha(a, 0xD6D4BE));
            circle(c, cx - 1, cy + 6, 1.8f, alpha(a, 0xD6D4BE));
        }
        // riscos finos de nuvem para dar textura
        int streak = alpha((int) (46 - 30 * night), 0xFFFFFF);
        for (int i = 0; i < 7; i++) {
            float sy = 18 + i * 27 + (hash(i) % 9);
            float sx = (((hash(i + 50) % 1000) / 1000f * w + t * (2 + i % 3)) % (w + 120)) - 60;
            oval(c, sx, sy, sx + 70 + (i % 3) * 20, sy + 2.2f, streak);
        }
    }

    public void drawCloud(Canvas c, float x, float y, float s, float night) {
        int col = mix(0xFFFFFFFF, 0xFF4A5075, night);
        int shade = mix(0xFFD9E6EE, 0xFF383E63, night);
        for (int pass = 0; pass < 2; pass++) {
            int cc = pass == 0 ? shade : col;
            float oy = pass == 0 ? 2f * s : 0f;
            circle(c, x + 12 * s, y + 9 * s + oy, 9 * s, cc);
            circle(c, x + 26 * s, y + 5 * s + oy, 12 * s, cc);
            circle(c, x + 41 * s, y + 10 * s + oy, 8 * s, cc);
            rrect(c, x + 4 * s, y + 9 * s + oy, x + 50 * s, y + 18 * s + oy, 5 * s, cc);
        }
    }

    public void drawSkyline(Canvas c, float worldW, float scroll, float night, int layer) {
        float spacing = layer == 0 ? 52 : 44;
        float maxH = layer == 0 ? 100 : 70, minH = layer == 0 ? 42 : 28;
        int col = mix(layer == 0 ? 0xFFC3D2DC : 0xFFA8BAC6, layer == 0 ? 0xFF1F2440 : 0xFF171B33, night);
        int winDay = mix(col, 0xFF000000, 0.08f);
        int i0 = (int) Math.floor(scroll / spacing);
        float off = scroll - i0 * spacing;
        for (int k = -1; k * spacing < worldW + spacing; k++) {
            int idx = i0 + k;
            int hs = hash(idx * 7 + layer * 1013);
            float bw = spacing * (0.55f + (hs % 100) / 100f * 0.4f);
            float bh = minH + ((hs >> 8) % 100) / 100f * (maxH - minH);
            float bx = k * spacing - off;
            rect(c, bx, GROUND_Y - bh, bx + bw, GROUND_Y, col);
            if ((hs >> 16) % 4 == 0) rect(c, bx + bw / 2 - 1, GROUND_Y - bh - 8, bx + bw / 2 + 1, GROUND_Y - bh, col);
            for (float wy = GROUND_Y - bh + 6; wy < GROUND_Y - 6; wy += 9) {
                for (float wx = bx + 4; wx < bx + bw - 5; wx += 7) {
                    boolean lit = hash(idx * 131 + (int) wy * 17 + (int) (wx - bx)) % 4 == 0;
                    if (night > 0.5f) {
                        if (lit) rect(c, wx, wy, wx + 2.5f, wy + 3.5f, 0xFFFFE08A);
                    } else {
                        rect(c, wx, wy, wx + 2.5f, wy + 3.5f, winDay);
                    }
                }
            }
        }
    }

    public void drawGround(Canvas c, float worldW, float scroll, float night) {
        int soil = mix(0xFFD6BC8E, 0xFF3B3028, night);
        int strata = mix(0xFFC8A872, 0xFF30261F, night);
        int dark = mix(0xFF9A7B4F, 0xFF241C16, night);
        int light = mix(0xFFE8D3A9, 0xFF54463A, night);
        rect(c, 0, GROUND_Y, worldW, WORLD_H, soil);
        rect(c, 0, 252, worldW, 256, strata);
        rect(c, 0, 267, worldW, 272, strata);
        rect(c, 0, 283, worldW, 288, strata);
        rect(c, 0, GROUND_Y, worldW, GROUND_Y + 2.5f, mix(0xFF5D4630, 0xFFB0B0B0, night * 0.5f));

        // grama na borda
        int grass = mix(0xFF6A9A3A, 0xFF2F4A22, night);
        float gsp = 31;
        int g0 = (int) Math.floor(scroll / gsp);
        float goff = scroll - g0 * gsp;
        for (int k = -1; k * gsp < worldW + gsp; k++) {
            int hs = hash(g0 + k + 777);
            float gx = k * gsp - goff + (hs % 12);
            float gh = 3 + (hs >> 6) % 4;
            tri(c, gx, GROUND_Y, gx + 2, GROUND_Y, gx + 0.5f, GROUND_Y - gh, grass);
            tri(c, gx + 2.5f, GROUND_Y, gx + 4.5f, GROUND_Y, gx + 4.2f, GROUND_Y - gh * 0.7f, grass);
        }
        // grãos em 3 camadas (as de baixo passam mais rápido: efeito de profundidade)
        for (int layer = 0; layer < 3; layer++) {
            float mult = 1f + layer * 0.3f;
            float sp = 15 + layer * 4;
            float s = scroll * mult;
            int i0 = (int) Math.floor(s / sp);
            float off = s - i0 * sp;
            float baseY = 246 + layer * 16;
            for (int k = -1; k * sp < worldW + sp; k++) {
                int hs = hash((i0 + k) * 5 + layer * 997);
                float gx = k * sp - off + (hs % 9);
                float gy = baseY + (hs >> 5) % 14;
                float sz = 1 + (hs >> 10) % 3 * 0.8f;
                rect(c, gx, gy, gx + sz * 1.6f, gy + sz * 0.8f, (hs >> 12) % 2 == 0 ? dark : light);
            }
        }
        // pedras
        float rsp = 83;
        int r0 = (int) Math.floor(scroll * 1.15f / rsp);
        float roff = scroll * 1.15f - r0 * rsp;
        for (int k = -1; k * rsp < worldW + rsp; k++) {
            int hs = hash((r0 + k) * 11 + 5);
            float rx = k * rsp - roff + (hs % 30);
            float ry = 258 + (hs >> 4) % 22;
            float rw = 6 + (hs >> 8) % 5;
            oval(c, rx, ry, rx + rw, ry + 3.8f, mix(0xFFA08C6E, 0xFF4A3F36, night));
            oval(c, rx + 1, ry + 0.4f, rx + rw * 0.6f, ry + 1.6f, light);
        }
        // rachaduras
        float csp = 137;
        int c0 = (int) Math.floor(scroll * 1.1f / csp);
        float coff = scroll * 1.1f - c0 * csp;
        for (int k = -1; k * csp < worldW + csp; k++) {
            int hs = hash((c0 + k) * 13 + 9);
            float cx = k * csp - coff + (hs % 40);
            float cy = 248 + (hs >> 5) % 8;
            line(c, cx, cy, cx + 3, cy + 4, 0.9f, dark);
            line(c, cx + 3, cy + 4, cx + 1, cy + 8, 0.9f, dark);
            line(c, cx + 1, cy + 8, cx + 5, cy + 12, 0.9f, dark);
        }
    }
}
