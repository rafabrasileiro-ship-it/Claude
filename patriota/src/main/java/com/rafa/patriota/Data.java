package com.rafa.patriota;

import java.util.ArrayList;

/** Dados estáticos: tipos de inimigos, heróis, itens e fases. Sem dependência de Android. */
final class Data {
    private Data() {}

    // ---- tipos de ataque dos inimigos comuns
    static final int AT_MELEE = 0, AT_THROW = 1, AT_GEL = 2, AT_RIBBON = 3, AT_STAB = 4, AT_POSE = 5, AT_BOSS = 9;

    // ---- tipos de inimigo
    static final int K_MANIF = 0, K_PIQUET = 1, K_CHEFAO = 2, K_PANDE = 3, K_FISCAL = 4, K_ATILA = 5,
            K_ESTUD = 6, K_CIRANDA = 7, K_MPB = 8, K_REITOR = 9, K_GREVISTA = 10, K_ABELIO = 11,
            K_GALA = 12, K_ATRIZ = 13, K_DANCA = 14, K_DOMINGAO = 15, K_EXBBB = 16, K_INFLU = 17,
            K_CINE = 18, K_BONE = 19, K_GUARDA = 20, K_XEREX = 21, K_MULA = 22, K_XANXA = 23;

    // acessórios (desenho)
    static final int AC_NONE = 0, AC_FLAG = 1, AC_MASK = 2, AC_VEST = 3, AC_BOOK = 4, AC_GUITAR = 5, AC_KNIFE = 6,
            AC_TROPHY = 7, AC_RING = 8, AC_TRIPOD = 9, AC_SUIT = 10, AC_TOGA = 11, AC_HAWAII = 12, AC_COAT = 13,
            AC_ANCHOR = 14, AC_MULA = 15, AC_DRESS = 16, AC_DANCER = 17, AC_MEGA = 18, AC_REITOR = 19, AC_XANXA = 20;

    static final class Kind {
        String name;
        float hp, spd, dmg, range, windup, cd, scale = 1f;
        int atk, score, skin, shirt, pants, hair, acc;
        boolean boss, guard;
        String[] lines;

        Kind(String name, float hp, float spd, float dmg, float range, float windup, float cd, int atk, int score,
             int skin, int shirt, int pants, int hair, int acc, String... lines) {
            this.name = name; this.hp = hp; this.spd = spd; this.dmg = dmg; this.range = range;
            this.windup = windup; this.cd = cd; this.atk = atk; this.score = score;
            this.skin = skin; this.shirt = shirt; this.pants = pants; this.hair = hair; this.acc = acc;
            this.lines = lines;
        }

        Kind big(float s) { scale = s; boss = true; return this; }
        Kind guard() { guard = true; return this; }
    }

    static final int SK1 = 0xFFF1C27D, SK2 = 0xFFD9A066, SK3 = 0xFF8D5524, SK4 = 0xFFFFDBB0;

    static final Kind[] KINDS = new Kind[24];

    static {
        KINDS[K_MANIF] = new Kind("Manifestante", 24, 55, 6, 52, 0.45f, 1.6f, AT_MELEE, 100, SK2, 0xFFD62828, 0xFF3A3A3A, 0xFF222222, AC_FLAG, "Fascista!", "Ei, ei, ei!");
        KINDS[K_PIQUET] = new Kind("Piqueteiro", 40, 68, 9, 56, 0.5f, 1.4f, AT_MELEE, 160, SK3, 0xFFB5121B, 0xFF1F2A44, 0xFF111111, AC_MEGA, "Greve geral!");
        KINDS[K_CHEFAO] = new Kind("Chefão da Marcha", 230, 70, 11, 80, 0.5f, 1.3f, AT_BOSS, 1500, SK1, 0xFFE63946, 0xFF222222, 0xFF553311, AC_MEGA, "Não vai passar!").big(1.35f);
        KINDS[K_PANDE] = new Kind("Pandeminion", 26, 60, 3, 118, 0.55f, 2.2f, AT_GEL, 120, SK4, 0xFFF4F4F4, 0xFF4BA3C3, 0xFF444444, AC_MASK, "Fica em casa!", "Cadê a vacina?", "Negacionista!", "Use máscara!");
        KINDS[K_FISCAL] = new Kind("Fiscal de Praça", 32, 78, 3, 140, 0.6f, 2.6f, AT_RIBBON, 150, SK3, 0xFFE8D400, 0xFF2B2B2B, 0xFF222222, AC_VEST, "Apita! Apita!", "Circulando!");
        KINDS[K_ATILA] = new Kind("Doutor Atila-mento", 280, 62, 9, 80, 0.5f, 1.5f, AT_BOSS, 2000, SK4, 0xFFFFFFFF, 0xFF2F6F9F, 0xFFDDDDDD, AC_COAT, "Estatística!", "Fique em casa!").big(1.35f);
        KINDS[K_ESTUD] = new Kind("Estudante de Humanas", 24, 58, 6, 0, 0.6f, 2.4f, AT_THROW, 110, SK1, 0xFF7B2D8E, 0xFF2D3E50, 0xFFAA5500, AC_BOOK, "Problematizando!", "Isso é uma construção!");
        KINDS[K_CIRANDA] = new Kind("Cirandeiro", 30, 62, 7, 54, 0.5f, 1.5f, AT_MELEE, 120, SK3, 0xFFE67E22, 0xFF6B4F2A, 0xFF222222, AC_NONE, "Ciranda, cirandinha!");
        KINDS[K_MPB] = new Kind("Músico de MPB", 34, 52, 8, 60, 0.6f, 1.8f, AT_MELEE, 140, SK2, 0xFF2E8B57, 0xFF8B7355, 0xFF442200, AC_GUITAR, "Acústico, meu bem!");
        KINDS[K_REITOR] = new Kind("Reitor Desconstruído", 240, 50, 11, 0, 0.8f, 1.8f, AT_BOSS, 1800, SK4, 0xFF6A1B9A, 0xFF4A148C, 0xFF999999, AC_REITOR, "Desconstruam-se!").big(1.3f);
        KINDS[K_GREVISTA] = new Kind("Grevista", 16, 80, 5, 48, 0.4f, 1.3f, AT_MELEE, 60, SK2, 0xFFC0392B, 0xFF333333, 0xFF222222, AC_FLAG, "Greve!");
        KINDS[K_ABELIO] = new Kind("Abélio Dispo", 22, 100, 12, 0, 0.55f, 2.0f, AT_STAB, 180, SK1, 0xFF303030, 0xFF1B1B1B, 0xFF111111, AC_KNIFE, "Foi mando de Deus!", "Não foi ninguém que mandou!");
        KINDS[K_GALA] = new Kind("Galã Engajado", 34, 60, 8, 0, 0.6f, 2.2f, AT_POSE, 170, SK4, 0xFF1D3557, 0xFF0B132B, 0xFF222222, AC_TROPHY, "Eu sou ator!", "Cancelado!");
        KINDS[K_ATRIZ] = new Kind("Atriz Engajada", 30, 66, 8, 0, 0.55f, 2.0f, AT_POSE, 170, SK2, 0xFFD81B60, 0xFF880E4F, 0xFFE6B800, AC_DRESS, "Meu momento!", "Que drama!");
        KINDS[K_DANCA] = new Kind("Dançarino", 20, 95, 5, 50, 0.35f, 1.1f, AT_MELEE, 80, SK3, 0xFFFFEB3B, 0xFFFF4081, 0xFF222222, AC_DANCER, "Ê, ê, ê!");
        KINDS[K_DOMINGAO] = new Kind("Apresentador Domingão", 300, 55, 9, 90, 0.6f, 1.4f, AT_BOSS, 2400, SK1, 0xFFFF8F00, 0xFF1565C0, 0xFF666666, AC_HAWAII, "Oloko, bicho!").big(1.4f);
        KINDS[K_EXBBB] = new Kind("Ex-BBB", 38, 62, 8, 56, 0.5f, 1.5f, AT_MELEE, 160, SK2, 0xFF00BCD4, 0xFF3F51B5, 0xFF111111, AC_RING, "Tá ligado?!").guard();
        KINDS[K_INFLU] = new Kind("Influenciador", 32, 56, 6, 56, 0.6f, 1.6f, AT_MELEE, 160, SK1, 0xFFFF5722, 0xFF212121, 0xFFFFC107, AC_RING, "Palestrinha rápida:", "Bora engajar!");
        KINDS[K_CINE] = new Kind("Cinegrafista", 36, 60, 10, 84, 0.65f, 1.7f, AT_MELEE, 170, SK3, 0xFF455A64, 0xFF263238, 0xFF111111, AC_TRIPOD, "Corta!", "Gravando!");
        KINDS[K_BONE] = new Kind("William Boné", 320, 58, 10, 95, 0.55f, 1.4f, AT_BOSS, 2600, SK4, 0xFF1A237E, 0xFF0D1330, 0xFFBBBBBB, AC_ANCHOR, "Boa noite.").big(1.35f);
        KINDS[K_GUARDA] = new Kind("Guarda de Elite", 42, 66, 10, 58, 0.5f, 1.5f, AT_MELEE, 200, SK2, 0xFF101820, 0xFF101820, 0xFF111111, AC_SUIT, "Multado!", "Protocolo!");
        KINDS[K_XEREX] = new Kind("Xerxes de Moraes", 330, 60, 12, 95, 0.7f, 1.4f, AT_BOSS, 3000, SK4, 0xFF111111, 0xFF000000, 0xFF111111, AC_TOGA, "Canetada!", "Multa diária!").big(1.4f);
        KINDS[K_MULA] = new Kind("Mula", 430, 58, 12, 85, 0.6f, 1.3f, AT_BOSS, 4000, SK2, 0xFFD50000, 0xFF263238, 0xFFEEEEEE, AC_MULA, "Nunca antes na história!", "Uma pinga, companheiro!").big(1.4f);
        KINDS[K_XANXA] = new Kind("Xanxa", 300, 62, 11, 85, 0.55f, 1.4f, AT_BOSS, 3500, SK4, 0xFF6D4C33, 0xFF111111, 0xFF2B2B2B, AC_XANXA, "Respeito!").big(1.35f);
    }

    // ---- heróis
    static final String[] HERO_NAME = {"Jair Bonossauro", "Patriota do Caminhão", "Tiozão do Zap", "Véio da Havan-a", "Michele Bonossauro"};
    static final String[] HERO_DESC = {
            "Herói de ação dos anos 80.\nEquilibrado. Especial: Motociata.",
            "Tanque lento, dano alto.\nEspecial: investida imparável.",
            "Ataca à distância com\nnotificações que confundem.",
            "Ágil, terno verde-limão.\nBate com a Estátua da Liberdade.",
            "Elegante, de branco.\nEspecial: Poder da Oração\n(cura a dupla)."};
    static final float[] HERO_HP = {100, 140, 90, 95, 105};
    static final float[] HERO_SPD = {1f, 0.8f, 0.95f, 1.3f, 1.1f};
    static final float[] HERO_DMG = {1f, 1.5f, 1f, 1.15f, 1.05f};
    /** 0 moto, 1 caminhão, 2 rajada de notificações, 3 giro da estátua */
    static final int[] HERO_SPEC = {0, 1, 2, 3, 6};
    static final int[][] HERO_COL = { // pele, camisa, calça, cabelo
            {SK1, 0xFFFFD500, 0xFF2A4C8B, 0xFF4A2F1B},
            {SK3, 0xFF2E7D32, 0xFF5D4037, 0xFF222222},
            {SK4, 0xFFFFFFFF, 0xFF37474F, 0xFFCCCCCC},
            {SK4, 0xFF9AE600, 0xFF9AE600, 0xFFEEEEEE},
            {SK4, 0xFFFFFFFF, 0xFFF3D2A8, 0xFF3E2723}};

    static final String[] HERO_START = {"E daí? Lamento, quer que eu faça o quê?", "Bora pra cima, companheiro!", "Já mandei no grupo da família!", "Aqui é Brasil, meu amigo!", "Deus abençoe esta missão!"};
    static final String[] HERO_FINISH = {"Tem que se fuder, porra!", "Toma essa!", "Vai ficar no vácuo!", "Pra cima deles!", "Em nome de Deus!"};
    static final String[] HERO_SPECIAL = {"Imbroxável!", "Acabou, porra!", "Corrente do bem!", "Acabou, porra!", "Poder da oração!"};

    // ---- itens
    static final int IT_PAO = 0, IT_PASTEL = 1, IT_CAFE = 2, IT_PEN = 3, IT_CLORO = 4, IT_JBL = 5, IT_VUVU = 6, IT_GUARDA = 7, IT_FACA = 8;
    static final String[] ITEM_NAME = {"Pão c/ leite condensado", "Pastel c/ caldo de cana", "Café coado", "Pen Drive Secreto",
            "Caixa de Cloroquina", "Caixa de som JBL", "Vuvuzela", "Guarda-chuva", "Faca"};
    static final int[] WEAPON_USES = {0, 0, 0, 0, 0, 4, 5, 12, 7};

    // ---- fases
    static final int TH_PAULISTA = 0, TH_QUARENT = 1, TH_CAMPUS = 2, TH_PORTAO = 3, TH_NOVELA = 4, TH_PALCO = 5,
            TH_BBB = 6, TH_JORNAL = 7, TH_TRIBUNAL = 8;

    static final class Sp {
        final int kind, side;
        final float delay;
        Sp(int kind, int side, float delay) { this.kind = kind; this.side = side; this.delay = delay; }
    }

    static final class Seg {
        final int theme;
        final ArrayList<Sp> sps = new ArrayList<>();
        final ArrayList<float[]> crates = new ArrayList<>();
        String radio;
        boolean mount;

        Seg(int theme) { this.theme = theme; }
        Seg r(String s) { radio = s; return this; }
        Seg mount() { mount = true; return this; }
        /** side: -1 esquerda, 1 direita, 0 alterna */
        Seg add(int kind, int n, int side, float delay, float gap) {
            for (int i = 0; i < n; i++) {
                int sd = side != 0 ? side : (i % 2 == 0 ? 1 : -1);
                sps.add(new Sp(kind, sd, delay + i * gap));
            }
            return this;
        }
        /** x relativo à tela travada, item (-1 = aleatório) */
        Seg crate(float x, int item) { crates.add(new float[]{x, item}); return this; }
    }

    static final class Stage {
        final String id, title, briefing;
        final ArrayList<Seg> segs = new ArrayList<>();
        boolean jet;
        Stage(String id, String title, String briefing) { this.id = id; this.title = title; this.briefing = briefing; }
        Stage seg(Seg s) { segs.add(s); return this; }
        Stage jet() { jet = true; return this; }
    }

    static final ArrayList<Stage> STAGES = new ArrayList<>();

    static {
        STAGES.add(new Stage("1", "O Chamado — Avenida Paulista",
                "Jair, eles fecharam a Paulista. Não há negociação possível. Limpe a avenida e abra caminho para Brasília.")
                .seg(new Seg(TH_PAULISTA).add(K_MANIF, 3, 0, 0, 1.5f).crate(380, IT_PASTEL))
                .seg(new Seg(TH_PAULISTA).add(K_MANIF, 2, 0, 0, 1.2f).add(K_PIQUET, 2, 0, 2.5f, 1.5f).crate(500, -1))
                .seg(new Seg(TH_PAULISTA).add(K_MANIF, 4, 0, 0, 1.2f).add(K_PIQUET, 2, 0, 3f, 2f).crate(200, -1).crate(620, IT_PAO))
                .seg(new Seg(TH_PAULISTA).r("Cuidado, Jair! O chefão da marcha está logo à frente.").add(K_CHEFAO, 1, 1, 0.5f, 0).add(K_MANIF, 2, 0, 4f, 3f)));

        STAGES.add(new Stage("2", "Zona de Quarentena",
                "Atenção, Jair. Você está entrando em uma zona de histeria sanitária. Eles vão tentar te cercar e forçar protocolos. Não pare de avançar.")
                .seg(new Seg(TH_QUARENT).add(K_PANDE, 3, 0, 0, 1.4f).crate(400, -1))
                .seg(new Seg(TH_QUARENT).add(K_FISCAL, 2, 0, 0, 1.5f).add(K_PANDE, 2, 0, 2.5f, 1.5f).crate(300, IT_CLORO))
                .seg(new Seg(TH_QUARENT).add(K_PANDE, 3, 0, 0, 1.2f).add(K_FISCAL, 2, 0, 3f, 1.5f).crate(600, -1))
                .seg(new Seg(TH_QUARENT).r("Aquele é o Doutor Atila-mento. Cuidado com as seringas!").add(K_ATILA, 1, 1, 0.5f, 0).add(K_PANDE, 2, 0, 5f, 3f)));

        STAGES.add(new Stage("3", "A Infiltração Acadêmica — Campus da UFB",
                "O próximo bloqueio fica dentro da universidade. Ignore a fumaça e a barulheira, atravesse o campus.")
                .seg(new Seg(TH_CAMPUS).add(K_ESTUD, 3, 0, 0, 1.3f).add(K_CIRANDA, 2, 0, 3f, 1.5f).crate(400, -1))
                .seg(new Seg(TH_CAMPUS).add(K_MPB, 2, 0, 0, 1.5f).add(K_ESTUD, 2, 0, 2f, 1.5f).crate(300, -1).crate(650, IT_PASTEL))
                .seg(new Seg(TH_CAMPUS).r("O Reitor Desconstruído flutua por aí. Ele vai chamar os grevistas!").add(K_REITOR, 1, 1, 0.5f, 0).crate(150, IT_PAO))
                .seg(new Seg(TH_PORTAO).r("Cuidado na saída do campus, Jair! Detectamos movimentação suspeita na multidão. Eles estão armados!").add(K_ABELIO, 3, 0, 1.5f, 1.2f))
                .seg(new Seg(TH_PORTAO).add(K_ABELIO, 3, -1, 0.5f, 1.0f).add(K_ABELIO, 3, 1, 1f, 1.0f).crate(400, IT_PASTEL)));

        STAGES.add(new Stage("4.1", "Estúdio de Novela das Nove",
                "Estão interferindo no nosso rádio a partir daquela torre de transmissão. Atravesse os estúdios e derrube o sinal deles. Primeiro set: a novela das nove.")
                .seg(new Seg(TH_NOVELA).add(K_GALA, 2, 0, 0, 1.5f).add(K_ATRIZ, 1, 1, 2f, 0).crate(400, -1))
                .seg(new Seg(TH_NOVELA).add(K_GALA, 2, 0, 0, 1.4f).add(K_ATRIZ, 2, 0, 1.5f, 1.4f).crate(300, -1))
                .seg(new Seg(TH_NOVELA).add(K_ATRIZ, 2, 0, 0, 1.4f).add(K_GALA, 3, 0, 1.5f, 1.4f).crate(600, IT_PAO)));

        STAGES.add(new Stage("4.2", "Palco do Programa de Auditório",
                "Segundo set: o palco do auditório. Dançarinos no fundo e um apresentador de microfone na mão. Não se distraia com as vinhetas.")
                .seg(new Seg(TH_PALCO).add(K_DANCA, 4, 0, 0, 1.0f).crate(400, -1))
                .seg(new Seg(TH_PALCO).add(K_DANCA, 3, 0, 0, 1.0f).crate(300, IT_PASTEL))
                .seg(new Seg(TH_PALCO).r("Lá está ele: o Apresentador Domingão!").add(K_DOMINGAO, 1, 1, 0.5f, 0).add(K_DANCA, 3, 0, 5f, 2.5f)));

        STAGES.add(new Stage("4.3", "Casa do Big Bosta Brasil",
                "Terceiro set: a casa do confinamento. Piscina, parede acolchoada e muito ring light. Não fique parado perto deles.")
                .seg(new Seg(TH_BBB).add(K_EXBBB, 2, 0, 0, 1.5f).add(K_INFLU, 1, 0, 2f, 0).crate(400, -1))
                .seg(new Seg(TH_BBB).add(K_EXBBB, 2, 0, 0, 1.4f).add(K_INFLU, 2, 0, 1.5f, 1.4f).crate(300, -1))
                .seg(new Seg(TH_BBB).add(K_INFLU, 3, 0, 0, 1.3f).add(K_EXBBB, 2, 0, 3f, 1.5f).crate(600, IT_PAO)));

        STAGES.add(new Stage("4.4", "Bancada do Telejornal Nacional",
                "Último set: a bancada do telejornal. A torre de transmissão fica logo atrás. Derrube o âncora e o sinal cai.")
                .seg(new Seg(TH_JORNAL).add(K_CINE, 3, 0, 0, 1.5f).crate(400, -1))
                .seg(new Seg(TH_JORNAL).add(K_CINE, 3, 0, 0, 1.3f).crate(300, IT_PASTEL))
                .seg(new Seg(TH_JORNAL).r("Destrua a bancada para expor o âncora, Jair!").add(K_BONE, 1, 1, 0.5f, 0).add(K_CINE, 2, 0, 6f, 3f)));

        STAGES.add(new Stage("B", "Travessia do Lago — Jet-Ski",
                "A ponte está bloqueada, Jair. Pegue o jet-ski e atravesse o lago até o Tribunal. Cuidado: tem baleia demais nessas águas, e elas são muito mal-humoradas. Bata de frente, pule ou desvie.")
                .jet());

        STAGES.add(new Stage("5", "O Resgate e o Velociraptor — Sublime Tribunal Nacional",
                "Eles cercaram o Sublime Tribunal com canetadas e burocracia, Jair. Ninguém mais conseguiria passar por aquela segurança... exceto você.")
                .seg(new Seg(TH_TRIBUNAL).add(K_GUARDA, 3, 0, 0, 1.5f).crate(400, -1))
                .seg(new Seg(TH_TRIBUNAL).add(K_GUARDA, 4, 0, 0, 1.3f).crate(300, IT_PASTEL))
                .seg(new Seg(TH_TRIBUNAL).r("Soltei o reforço pesado, Jair. Termine o serviço.").mount().add(K_GUARDA, 5, 0, 3f, 1.0f))
                .seg(new Seg(TH_TRIBUNAL).r("Xerxes de Moraes. Cuidado com as canetadas e as multas!").add(K_XEREX, 1, 1, 0.5f, 0).add(K_GUARDA, 2, 0, 6f, 3f).crate(200, IT_PAO))
                .seg(new Seg(TH_TRIBUNAL).r("O chefe supremo: Mula. Interrompa a pinga dele!").add(K_MULA, 1, 1, 0.5f, 0).add(K_GUARDA, 2, 0, 8f, 3f).crate(200, IT_PAO).crate(600, IT_PASTEL)));
    }

    static final String[] STAGE_NAMES;

    static {
        STAGE_NAMES = new String[STAGES.size()];
        for (int i = 0; i < STAGE_NAMES.length; i++) STAGE_NAMES[i] = STAGES.get(i).id + " · " + STAGES.get(i).title;
    }
}
