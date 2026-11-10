package com.rafa.bid.core;

import java.util.ArrayList;
import java.util.List;

/** Registros usados pela triagem de créditos. */
public final class Modelos {
    private Modelos() {}

    public static final class Evento {
        public String dataBid, atletaId, atletaNome, nascimento, tipo, clube, clubeOrigem, inicio, fim;
    }

    public static final class Vinculo {
        public String clube, tipo, inicio, fim;
    }

    public static final class Atleta {
        public String id, nome, nascimento;
        public final List<Vinculo> vinculos = new ArrayList<>();
    }
}
