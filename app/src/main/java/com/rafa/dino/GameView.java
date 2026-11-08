package com.rafa.dino;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Random;

/**
 * Corredor infinito: o dino corre sozinho, toque para pular,
 * segure a parte de baixo da tela para abaixar e desviar dos pássaros.
 */
public class GameView extends View {

    private enum State { READY, RUNNING, GAME_OVER }

    // Mundo em "unidades": a altura da tela vale 300 unidades.
    private static final float WORLD_H = 300f;
    private static final float GROUND_Y = 240f;
    private static final float GRAVITY = 2600f;
    private static final float JUMP_V = -700f;
    private static final float START_SPEED = 330f;
    private static final float MAX_SPEED = 900f;
    private static final float ACCEL = 9f;

    private static final float DINO_X = 50f;
    private static final float DINO_W = 44f;
    private static final float DINO_H = 47f;
    private static final float DUCK_H = 28f;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();
    private final Random rnd = new Random();
    private final SharedPreferences prefs;
    private final SoundFx sfx = new SoundFx();

    private State state = State.READY;
    private float scale = 1f;
    private float worldW = 600f;

    private float dinoY;
    private float dinoVy;
    private boolean onGround = true;
    private boolean ducking = false;
    private boolean holdingJump = false;
    private float runAnim;

    private float speed = START_SPEED;
    private float distance;
    private int highScore;
    private float nextSpawn;
    private float flashTimer;
    private int lastMilestone;
    private float nightAmount;   // 0 = dia, 1 = noite
    private boolean nightTarget;

    private final List<Obstacle> obstacles = new ArrayList<>();
    private final List<float[]> clouds = new ArrayList<>();   // {x, y}
    private final List<float[]> pebbles = new ArrayList<>();  // {x, y, w}

    private long lastFrame;
    private boolean paused;

    private static class Obstacle {
        boolean bird;
        float x, y, w, h;
        int cactusCount;
        boolean bigCactus;
        float flap;
    }

    public GameView(Context context) {
        super(context);
        prefs = context.getSharedPreferences("dino", Context.MODE_PRIVATE);
        highScore = prefs.getInt("high", 0);
        text.setTypeface(android.graphics.Typeface.MONOSPACE);
        text.setFakeBoldText(true);
        for (int i = 0; i < 4; i++) clouds.add(new float[]{100 + i * 170f, 40 + rnd.nextInt(70)});
        for (int i = 0; i < 40; i++) pebbles.add(new float[]{rnd.nextFloat() * 1200f, GROUND_Y + 4 + rnd.nextInt(14), 1 + rnd.nextInt(4)});
        resetGame();
        state = State.READY;
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        scale = h / WORLD_H;
        worldW = w / scale;
    }

    public void destroy() {
        sfx.release();
    }

    public void pause() {
        paused = true;
    }

    public void resume() {
        paused = false;
        lastFrame = 0;
        invalidate();
    }

    private void resetGame() {
        obstacles.clear();
        speed = START_SPEED;
        distance = 0;
        dinoY = GROUND_Y - DINO_H;
        dinoVy = 0;
        onGround = true;
        ducking = false;
        nextSpawn = 1.2f;
        lastMilestone = 0;
        nightAmount = 0;
        nightTarget = false;
        flashTimer = 0;
    }

    private int score() {
        return (int) (distance / 40f);
    }

    // ---------------- Entrada ----------------

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        int action = e.getActionMasked();
        boolean lowerPart = e.getY() > getHeight() * 0.6f;
        switch (action) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_POINTER_DOWN:
                if (state == State.READY) {
                    state = State.RUNNING;
                    jump();
                } else if (state == State.GAME_OVER) {
                    if (flashTimer <= 0) {
                        resetGame();
                        state = State.RUNNING;
                    }
                } else if (lowerPart && !onGround) {
                    dinoVy = Math.max(dinoVy, 900f); // desce rápido
                } else if (lowerPart) {
                    ducking = true;
                } else {
                    jump();
                    holdingJump = true;
                }
                return true;
            case MotionEvent.ACTION_UP:
            case MotionEvent.ACTION_POINTER_UP:
            case MotionEvent.ACTION_CANCEL:
                ducking = false;
                holdingJump = false;
                return true;
        }
        return super.onTouchEvent(e);
    }

    private void jump() {
        if (onGround) {
            dinoVy = JUMP_V;
            sfx.playJump();
            onGround = false;
            ducking = false;
            holdingJump = true;
        }
    }

    // ---------------- Lógica ----------------

    private void update(float dt) {
        // Nuvens e chão se movem mesmo parados na tela inicial (devagar).
        float groundSpeed = state == State.RUNNING ? speed : 0;
        for (float[] c : clouds) {
            c[0] -= (groundSpeed * 0.15f + 8f) * dt;
            if (c[0] < -60) {
                c[0] = worldW + rnd.nextInt(150);
                c[1] = 30 + rnd.nextInt(80);
            }
        }
        if (state == State.GAME_OVER) {
            flashTimer -= dt;
            return;
        }
        if (state != State.RUNNING) return;

        speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
        distance += speed * dt;
        runAnim += dt * speed / 40f;

        for (float[] p : pebbles) {
            p[0] -= speed * dt;
            if (p[0] < -10) p[0] += Math.max(worldW + 20, 1200f);
        }

        // Física do pulo (segurar = pulo mais alto)
        float g = (holdingJump && dinoVy < 0) ? GRAVITY * 0.6f : GRAVITY;
        dinoVy += g * dt;
        dinoY += dinoVy * dt;
        float h = currentDinoH();
        if (dinoY >= GROUND_Y - h) {
            dinoY = GROUND_Y - h;
            dinoVy = 0;
            onGround = true;
        }

        // Obstáculos
        nextSpawn -= dt;
        if (nextSpawn <= 0) spawnObstacle();
        Iterator<Obstacle> it = obstacles.iterator();
        while (it.hasNext()) {
            Obstacle o = it.next();
            o.x -= (o.bird ? speed * 1.08f : speed) * dt;
            o.flap += dt;
            if (o.x + o.w < -20) it.remove();
        }

        // Colisão (caixas um pouco menores para ser justo)
        float dx = DINO_X + 8, dy = dinoY + 6, dw = DINO_W - 16, dh = h - 10;
        for (Obstacle o : obstacles) {
            float ox = o.x + 4, oy = o.y + 4, ow = o.w - 8, oh = o.h - 6;
            if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
                gameOver();
                return;
            }
        }

        // Pisca a cada 100 pontos e alterna dia/noite a cada 700
        int s = score();
        if (s / 100 > lastMilestone) {
            lastMilestone = s / 100;
            if (lastMilestone % 7 == 0) nightTarget = !nightTarget;
        }
        float target = nightTarget ? 1f : 0f;
        nightAmount += (target - nightAmount) * Math.min(1f, dt * 1.5f);
    }

    private float currentDinoH() {
        return (ducking && onGround) ? DUCK_H : DINO_H;
    }

    private void spawnObstacle() {
        Obstacle o = new Obstacle();
        boolean canBird = score() > 300;
        if (canBird && rnd.nextFloat() < 0.25f) {
            o.bird = true;
            o.w = 46;
            o.h = 30;
            float[] heights = {GROUND_Y - 30, GROUND_Y - 58, GROUND_Y - 90};
            o.y = heights[rnd.nextInt(3)];
        } else {
            o.bigCactus = rnd.nextBoolean();
            int maxCount = score() > 150 ? 3 : 2;
            o.cactusCount = 1 + rnd.nextInt(maxCount);
            float unitW = o.bigCactus ? 24 : 17;
            o.w = unitW * o.cactusCount + 2 * (o.cactusCount - 1);
            o.h = o.bigCactus ? 48 : 34;
            o.y = GROUND_Y - o.h;
        }
        o.x = worldW + 20;
        obstacles.add(o);
        // Intervalo mínimo depende da velocidade (precisa dar tempo de pular)
        float minGap = 0.55f + 120f / speed;
        nextSpawn = minGap + rnd.nextFloat() * 1.1f;
    }

    private void gameOver() {
        state = State.GAME_OVER;
        flashTimer = 0.5f; // evita reiniciar sem querer
        sfx.playDie();
        int s = score();
        if (s > highScore) {
            highScore = s;
            prefs.edit().putInt("high", highScore).apply();
        }
    }

    // ---------------- Desenho ----------------

    private int bgColor() {
        return blend(Color.rgb(247, 247, 247), Color.rgb(32, 33, 36), nightAmount);
    }

    private int fgColor() {
        return blend(Color.rgb(83, 83, 83), Color.rgb(220, 220, 220), nightAmount);
    }

    private static int blend(int a, int b, float t) {
        int r = (int) (Color.red(a) + (Color.red(b) - Color.red(a)) * t);
        int g = (int) (Color.green(a) + (Color.green(b) - Color.green(a)) * t);
        int bl = (int) (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * t);
        return Color.rgb(r, g, bl);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        long now = System.nanoTime();
        float dt = lastFrame == 0 ? 0 : (now - lastFrame) / 1e9f;
        lastFrame = now;
        if (!paused) update(Math.min(dt, 1f / 30f));

        canvas.drawColor(bgColor());
        canvas.save();
        canvas.scale(scale, scale);

        int fg = fgColor();
        drawClouds(canvas);
        drawGround(canvas, fg);
        for (Obstacle o : obstacles) {
            if (o.bird) drawBird(canvas, o, fg); else drawCactus(canvas, o);
        }
        drawDino(canvas);
        drawHud(canvas, fg);

        canvas.restore();
        if (!paused) postInvalidateOnAnimation();
    }

    private void drawClouds(Canvas c) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(blend(Color.rgb(225, 225, 225), Color.rgb(70, 72, 76), nightAmount));
        for (float[] cl : clouds) {
            float x = cl[0], y = cl[1];
            c.drawCircle(x + 12, y + 8, 9, paint);
            c.drawCircle(x + 26, y + 4, 12, paint);
            c.drawCircle(x + 40, y + 9, 8, paint);
            r.set(x + 4, y + 8, x + 48, y + 17);
            c.drawRoundRect(r, 5, 5, paint);
        }
        if (nightAmount > 0.05f) {
            paint.setColor(Color.argb((int) (255 * nightAmount), 240, 240, 220));
            c.drawCircle(worldW - 80, 50, 14, paint);
            paint.setColor(bgColor());
            c.drawCircle(worldW - 73, 46, 12, paint);
        }
    }

    private void drawGround(Canvas c, int fg) {
        paint.setColor(fg);
        paint.setStyle(Paint.Style.FILL);
        c.drawRect(0, GROUND_Y, worldW, GROUND_Y + 2, paint);
        for (float[] p : pebbles) {
            if (p[0] < worldW) c.drawRect(p[0], p[1], p[0] + p[2] * 2, p[1] + 1.5f, paint);
        }
    }

    private void drawDino(Canvas c) {
        int body = blend(Color.rgb(76, 175, 80), Color.rgb(129, 199, 132), nightAmount);
        int belly = blend(Color.rgb(200, 230, 201), Color.rgb(200, 230, 201), nightAmount);
        paint.setStyle(Paint.Style.FILL);
        float x = DINO_X;
        float y = dinoY;
        boolean duck = ducking && onGround;
        boolean dead = state == State.GAME_OVER;
        int legPhase = (state == State.RUNNING && onGround) ? ((int) runAnim) % 2 : -1;

        if (duck) {
            // Corpo alongado e baixo
            paint.setColor(body);
            r.set(x - 4, y + 6, x + 40, y + 22);
            c.drawRoundRect(r, 8, 8, paint);
            r.set(x + 32, y, x + 56, y + 16);
            c.drawRoundRect(r, 6, 6, paint);
            drawEye(c, x + 47, y + 5, dead);
            drawLegs(c, x + 6, y + 21, legPhase, body, 7);
            return;
        }

        // Cauda
        paint.setColor(body);
        path.reset();
        path.moveTo(x, y + 18);
        path.lineTo(x - 6, y + 28);
        path.lineTo(x + 10, y + 32);
        path.close();
        c.drawPath(path, paint);
        // Corpo
        r.set(x + 2, y + 16, x + 32, y + 40);
        c.drawRoundRect(r, 10, 10, paint);
        // Barriga
        paint.setColor(belly);
        r.set(x + 12, y + 24, x + 30, y + 38);
        c.drawOval(r, paint);
        // Pescoço e cabeça
        paint.setColor(body);
        r.set(x + 20, y + 6, x + 32, y + 26);
        c.drawRect(r, paint);
        r.set(x + 20, y, x + 46, y + 16);
        c.drawRoundRect(r, 7, 7, paint);
        // Bracinho
        r.set(x + 30, y + 24, x + 36, y + 28);
        c.drawRoundRect(r, 2, 2, paint);
        drawEye(c, x + 36, y + 5, dead);
        // Boca
        paint.setColor(fgColor());
        c.drawRect(x + 38, y + 12, x + 45, y + 13, paint);
        drawLegs(c, x + 8, y + 38, legPhase, body, 9);
    }

    private void drawEye(Canvas c, float ex, float ey, boolean dead) {
        paint.setColor(Color.WHITE);
        c.drawCircle(ex + 2.5f, ey + 2.5f, 3.2f, paint);
        paint.setColor(Color.rgb(40, 40, 40));
        if (dead) {
            paint.setStrokeWidth(1.4f);
            c.drawLine(ex, ey, ex + 5, ey + 5, paint);
            c.drawLine(ex + 5, ey, ex, ey + 5, paint);
        } else {
            c.drawCircle(ex + 3.2f, ey + 2.5f, 1.6f, paint);
        }
    }

    private void drawLegs(Canvas c, float lx, float ly, int phase, int color, float len) {
        paint.setColor(color);
        float l1 = phase == 0 ? len - 4 : len;
        float l2 = phase == 1 ? len - 4 : len;
        c.drawRect(lx, ly, lx + 5, ly + l1, paint);
        c.drawRect(lx + 13, ly, lx + 18, ly + l2, paint);
        // pés
        c.drawRect(lx, ly + l1 - 2, lx + 8, ly + l1, paint);
        c.drawRect(lx + 13, ly + l2 - 2, lx + 21, ly + l2, paint);
    }

    private void drawCactus(Canvas c, Obstacle o) {
        int green = blend(Color.rgb(46, 125, 50), Color.rgb(102, 187, 106), nightAmount);
        paint.setColor(green);
        paint.setStyle(Paint.Style.FILL);
        float unitW = o.bigCactus ? 24 : 17;
        for (int i = 0; i < o.cactusCount; i++) {
            float cx = o.x + i * (unitW + 2);
            float trunkW = unitW * 0.4f;
            float tx = cx + (unitW - trunkW) / 2;
            r.set(tx, o.y, tx + trunkW, o.y + o.h);
            c.drawRoundRect(r, trunkW / 2, trunkW / 2, paint);
            float armW = unitW * 0.22f;
            float armY = o.y + o.h * 0.35f;
            // braço esquerdo
            r.set(cx, armY, cx + armW, armY + o.h * 0.3f);
            c.drawRoundRect(r, armW / 2, armW / 2, paint);
            c.drawRect(cx + armW / 2, armY + o.h * 0.25f, tx + 1, armY + o.h * 0.25f + armW, paint);
            // braço direito
            float ry = armY - o.h * 0.1f;
            r.set(cx + unitW - armW, ry, cx + unitW, ry + o.h * 0.3f);
            c.drawRoundRect(r, armW / 2, armW / 2, paint);
            c.drawRect(tx + trunkW - 1, ry + o.h * 0.25f, cx + unitW - armW / 2, ry + o.h * 0.25f + armW, paint);
        }
    }

    private void drawBird(Canvas c, Obstacle o, int fg) {
        paint.setColor(blend(Color.rgb(121, 85, 72), Color.rgb(188, 170, 164), nightAmount));
        paint.setStyle(Paint.Style.FILL);
        float x = o.x, y = o.y;
        // corpo
        r.set(x + 8, y + 12, x + 40, y + 22);
        c.drawOval(r, paint);
        // cabeça e bico
        c.drawCircle(x + 10, y + 14, 6, paint);
        paint.setColor(Color.rgb(255, 160, 0));
        path.reset();
        path.moveTo(x + 5, y + 12);
        path.lineTo(x - 4, y + 15);
        path.lineTo(x + 5, y + 17);
        path.close();
        c.drawPath(path, paint);
        // asa batendo
        paint.setColor(blend(Color.rgb(93, 64, 55), Color.rgb(161, 136, 127), nightAmount));
        boolean up = ((int) (o.flap * 6)) % 2 == 0;
        path.reset();
        path.moveTo(x + 18, y + 15);
        path.lineTo(x + 34, y + 15);
        path.lineTo(x + 24, up ? y - 2 : y + 32);
        path.close();
        c.drawPath(path, paint);
        paint.setColor(Color.WHITE);
        c.drawCircle(x + 9, y + 12, 1.8f, paint);
    }

    private void drawHud(Canvas c, int fg) {
        text.setColor(fg);
        text.setTextSize(16);
        text.setTextAlign(Paint.Align.RIGHT);
        int s = score();
        boolean blink = state == State.RUNNING && s >= 100 && (s % 100) < 12 && ((s / 3) % 2 == 0);
        String cur = String.format(Locale.US, "%05d", s);
        String hi = String.format(Locale.US, "REC %05d", highScore);
        c.drawText(blink ? hi : hi + "  " + cur, worldW - 12, 26, text);

        text.setTextAlign(Paint.Align.CENTER);
        if (state == State.READY) {
            text.setTextSize(22);
            c.drawText("JOGO DO DINO", worldW / 2, 110, text);
            text.setTextSize(12);
            text.setFakeBoldText(false);
            c.drawText("Toque para começar e pular", worldW / 2, 135, text);
            c.drawText("Segure embaixo para abaixar", worldW / 2, 152, text);
            text.setFakeBoldText(true);
        } else if (state == State.GAME_OVER) {
            text.setTextSize(22);
            c.drawText("FIM DE JOGO", worldW / 2, 110, text);
            // ícone de reiniciar
            paint.setColor(fg);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(3);
            r.set(worldW / 2 - 12, 125, worldW / 2 + 12, 149);
            c.drawArc(r, -60, 300, false, paint);
            paint.setStyle(Paint.Style.FILL);
            path.reset();
            float ax = worldW / 2 + 6, ay = 124;
            path.moveTo(ax - 2, ay - 6);
            path.lineTo(ax + 9, ay + 2);
            path.lineTo(ax - 2, ay + 8);
            path.close();
            c.drawPath(path, paint);
            text.setTextSize(12);
            text.setFakeBoldText(false);
            c.drawText("Toque para jogar de novo", worldW / 2, 172, text);
            text.setFakeBoldText(true);
        }
    }
}
