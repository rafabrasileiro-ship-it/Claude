package com.rafa.patriota;

import java.util.ArrayList;

/** Entidade genérica do jogo: jogador, inimigo, caixa, item, projétil ou bancada. */
final class Ent {
    static final int PLAYER = 0, ENEMY = 1, CRATE = 2, ITEM = 3, PROJ = 4, DESK = 5;

    int type, kind;
    float x, y, h, vx, vy, vh;
    int face = 1;
    float hp, maxHp;
    int st;
    float t;
    float cd, flash, stunT, confT, inv, poise, shield, shieldT, walk;
    int atk;
    boolean did, thrown, dying, guardUp, invul;
    float aux, aux2, life, wind, rec;
    float dmg, w;
    boolean friendly, tall, arc, alive = true;
    int slot = 1;
    ArrayList<Ent> hit = new ArrayList<>();
    Ent holder;
    /** id de rede (modo dupla) e posição-alvo para suavizar no celular convidado. */
    int nid;
    float tx, ty, th;
}
