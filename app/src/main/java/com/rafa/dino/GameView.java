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
 * Corredor infinito: o personagem corre sozinho, toque para pular,
 * segure a parte de baixo da tela para abaixar e desviar das bolas de fogo.
 */
public class GameView extends View {

    private enum State { READY, RUNNING, GAME_OVER }

    private static final float GROUND_Y = Sprites.GROUND_Y;
    private static final float GRAVITY = 2600f;
    private static final float JUMP_V = -700f;
    private static final float START_SPEED = 330f;
    private static final float MAX_SPEED = 900f;
    private static final float ACCEL = 9f;
    private static final float DINO_X = 50f;
    private static final float HIT_W = 44f;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF r = new RectF();
    private final Random rnd = new Random();
    private final SharedPreferences prefs;
    private final SoundFx sfx = new SoundFx();
    private final Sprites sprites = new Sprites();

    private State state = State.READY;
    private float scale = 1f;
    private float worldW = 600f;

    private int character;
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
    private float time;
    private float groundScroll;
    private float skyScroll;

    private final List<Obstacle> obstacles = new ArrayList<>();
    private final List<float[]> clouds = new ArrayList<>();   // {x, y, escala}

    private long lastFrame;
    private boolean paused;

    private static class Obstacle {
        boolean fire;
        float x, y, w, h;
        int seed;
    }

    public GameView(Context context) {
        super(context);
        prefs = context.getSharedPreferences("dino", Context.MODE_PRIVATE);
        highScore = prefs.getInt("high", 0);
        character = Math.max(0, Math.min(Sprites.COUNT - 1, prefs.getInt("char", 0)));
        text.setTypeface(android.graphics.Typeface.MONOSPACE);
        text.setFakeBoldText(true);
        for (int i = 0; i < 5; i++) {
            clouds.add(new float[]{80 + i * 150f, 25 + rnd.nextInt(90), 0.7f + rnd.nextFloat() * 0.6f});
        }
        resetGame();
        state = State.READY;
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        scale = h / Sprites.WORLD_H;
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

    private float charH() {
        return Sprites.HEIGHT[character];
    }

    private float currentH() {
        return (ducking && onGround) ? Sprites.DUCK_H[character] : charH();
    }

    private void resetGame() {
        obstacles.clear();
        speed = START_SPEED;
        distance = 0;
        dinoY = GROUND_Y - charH();
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

    private void changeCharacter(int dir) {
        character = (character + dir + Sprites.COUNT) % Sprites.COUNT;
        dinoY = GROUND_Y - charH();
        prefs.edit().putInt("char", character).apply();
    }

    // ---------------- Entrada ----------------

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        int action = e.getActionMasked();
        boolean lowerPart = e.getY() > getHeight() * 0.6f;
        switch (action) {
            case MotionEvent.ACTION_DOWN:
            case MotionEvent.ACTION_POINTER_DOWN:
                if (state != State.RUNNING) {
                    float wx = e.getX() / scale, wy = e.getY() / scale;
                    float cx = worldW / 2;
                    if (wy > 175 && wy < 232) {
                        if (wx > cx - 140 && wx < cx - 30) {
                            changeCharacter(-1);
                            return true;
                        }
                        if (wx > cx + 30 && wx < cx + 140) {
                            changeCharacter(1);
                            return true;
                        }
                    }
                }
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
        time += dt;
        for (float[] c : clouds) {
            c[0] -= ((state == State.RUNNING ? speed : 0) * 0.08f + 7f) * dt;
            if (c[0] < -60) {
                c[0] = worldW + rnd.nextInt(150);
                c[1] = 25 + rnd.nextInt(90);
                c[2] = 0.7f + rnd.nextFloat() * 0.6f;
            }
        }
        if (state == State.GAME_OVER) {
            flashTimer -= dt;
            return;
        }
        if (state != State.RUNNING) return;

        speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
        distance += speed * dt;
        groundScroll += speed * dt;
        skyScroll += speed * dt;
        runAnim += dt * speed / 40f;

        // Física do pulo (segurar = pulo mais alto)
        float g = (holdingJump && dinoVy < 0) ? GRAVITY * 0.6f : GRAVITY;
        dinoVy += g * dt;
        dinoY += dinoVy * dt;
        float h = currentH();
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
            o.x -= (o.fire ? speed * 1.08f : speed) * dt;
            if (o.x + o.w < -20) it.remove();
        }

        // Colisão (caixas um pouco menores para ser justo)
        float dx = DINO_X + 8, dy = dinoY + 6, dw = HIT_W - 16, dh = h - 10;
        for (Obstacle o : obstacles) {
            float ox = o.x + 4, oy = o.y + 4, ow = o.w - 8, oh = o.h - 6;
            if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
                gameOver();
                return;
            }
        }

        // Alterna dia/noite a cada 700 pontos
        int s = score();
        if (s / 100 > lastMilestone) {
            lastMilestone = s / 100;
            if (lastMilestone % 7 == 0) nightTarget = !nightTarget;
        }
        float target = nightTarget ? 1f : 0f;
        nightAmount += (target - nightAmount) * Math.min(1f, dt * 1.5f);
    }

    private void spawnObstacle() {
        boolean canFire = score() > 300;
        float startX = worldW + 20;
        if (canFire && rnd.nextFloat() < 0.25f) {
            Obstacle o = new Obstacle();
            o.fire = true;
            o.w = 40;
            o.h = 26;
            float[] heights = {GROUND_Y - 30, GROUND_Y - 58, GROUND_Y - 90};
            o.y = heights[rnd.nextInt(3)];
            o.x = startX;
            obstacles.add(o);
        } else {
            int maxCount = score() > 150 ? 3 : 2;
            int count = 1 + rnd.nextInt(maxCount);
            float x = startX;
            for (int i = 0; i < count; i++) {
                Obstacle o = new Obstacle();
                o.w = 24 + rnd.nextInt(14);
                o.h = 38 + rnd.nextInt(29);
                o.y = GROUND_Y - o.h;
                o.x = x;
                o.seed = rnd.nextInt(100000);
                x += o.w + 3;
                obstacles.add(o);
            }
        }
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

    @Override
    protected void onDraw(Canvas canvas) {
        long now = System.nanoTime();
        float dt = lastFrame == 0 ? 0 : (now - lastFrame) / 1e9f;
        lastFrame = now;
        if (!paused) update(Math.min(dt, 1f / 30f));

        canvas.save();
        canvas.scale(scale, scale);

        sprites.drawSky(canvas, worldW, nightAmount, time);
        for (float[] cl : clouds) sprites.drawCloud(canvas, cl[0], cl[1], cl[2], nightAmount);
        sprites.drawSkyline(canvas, worldW, skyScroll * 0.12f, nightAmount, 0);
        sprites.drawSkyline(canvas, worldW, skyScroll * 0.3f, nightAmount, 1);
        sprites.drawGround(canvas, worldW, groundScroll, nightAmount);
        for (Obstacle o : obstacles) {
            if (o.fire) sprites.drawFireball(canvas, o.x, o.y, o.w, o.h, time);
            else sprites.drawBuilding(canvas, o.x, GROUND_Y, o.w, o.h, o.seed, nightAmount);
        }
        int leg = (state == State.RUNNING && onGround) ? ((int) runAnim) % 2 : -1;
        boolean duck = ducking && onGround;
        sprites.drawCharacter(canvas, character, DINO_X, dinoY + currentH(), duck, leg, state == State.GAME_OVER);
        drawHud(canvas);

        canvas.restore();
        if (!paused) postInvalidateOnAnimation();
    }

    private int hudColor() {
        return Sprites.mix(Color.rgb(60, 60, 60), Color.rgb(235, 235, 235), nightAmount);
    }

    private void drawHud(Canvas c) {
        int fg = hudColor();
        text.setColor(fg);
        text.setTextSize(16);
        text.setTextAlign(Paint.Align.RIGHT);
        int s = score();
        boolean blink = state == State.RUNNING && s >= 100 && (s % 100) < 12 && ((s / 3) % 2 == 0);
        String cur = String.format(Locale.US, "%05d", s);
        String hi = String.format(Locale.US, "REC %05d", highScore);
        c.drawText(blink ? hi : hi + "  " + cur, worldW - 12, 26, text);

        if (state == State.RUNNING) return;

        text.setTextAlign(Paint.Align.CENTER);
        float cx = worldW / 2;
        if (state == State.READY) {
            text.setTextSize(22);
            c.drawText("JOGO DO DINO", cx, 100, text);
            text.setTextSize(12);
            text.setFakeBoldText(false);
            c.drawText("Toque para começar e pular", cx, 124, text);
            c.drawText("Segure embaixo para abaixar", cx, 140, text);
            text.setFakeBoldText(true);
        } else {
            text.setTextSize(22);
            c.drawText("FIM DE JOGO", cx, 90, text);
            paint.setColor(fg);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(3);
            r.set(cx - 12, 102, cx + 12, 126);
            c.drawArc(r, -60, 300, false, paint);
            paint.setStyle(Paint.Style.FILL);
            path.reset();
            float ax = cx + 6, ay = 101;
            path.moveTo(ax - 2, ay - 6);
            path.lineTo(ax + 9, ay + 2);
            path.lineTo(ax - 2, ay + 8);
            path.close();
            c.drawPath(path, paint);
            text.setTextSize(12);
            text.setFakeBoldText(false);
            c.drawText("Toque para jogar de novo", cx, 150, text);
            text.setFakeBoldText(true);
        }

        // Seletor de personagem
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(fg);
        float ay = 201;
        drawArrow(c, cx - 88, ay, -1);
        drawArrow(c, cx + 88, ay, 1);
        text.setTextSize(16);
        c.drawText(Sprites.NAMES[character], cx, ay + 6, text);
        text.setTextSize(10);
        text.setFakeBoldText(false);
        c.drawText((character + 1) + "/" + Sprites.COUNT + "  trocar personagem", cx, ay + 24, text);
        text.setFakeBoldText(true);
    }

    private void drawArrow(Canvas c, float x, float y, int dir) {
        path.reset();
        path.moveTo(x + dir * 9, y);
        path.lineTo(x - dir * 7, y - 11);
        path.lineTo(x - dir * 7, y + 11);
        path.close();
        c.drawPath(path, paint);
    }
}
