package com.rafa.bid.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Mapeia cabeçalhos de tabela (com sinônimos) para campos canônicos. */
public final class Campos {
    private Campos() {}

    /** Regex (1º grupo) que extrai o ID do atleta de um link. */
    public static final String ID_REGEX = "(?:atleta|atletas|id)[=/](\\d+)";

    private static final String[][] SIN = {
        {"atleta_nome", "atleta", "nome", "nome do atleta", "jogador", "nome completo", "apelido"},
        {"nascimento", "nascimento", "data de nascimento", "data nascimento", "nasc", "dt nascimento"},
        {"clube", "clube", "clube destino", "destino", "clube atual", "entidade", "clube de destino", "entidade desportiva"},
        {"clube_origem", "clube origem", "origem", "clube de origem", "clube anterior"},
        {"tipo", "tipo", "tipo de operacao", "operacao", "movimentacao", "evento", "tipo de registro",
            "tipo de contrato", "situacao", "tipo de movimentacao", "vinculo", "tipo de vinculo"},
        {"data_evento", "data", "data publicacao", "data de publicacao", "data de registro", "data registro",
            "publicacao", "data da operacao", "data bid", "data de inscricao"},
        {"inicio", "inicio", "data inicio", "data de inicio", "inicio do contrato", "vigencia inicio",
            "inicio vigencia", "data inicial"},
        {"fim", "fim", "termino", "data fim", "data de termino", "fim do contrato", "vencimento",
            "data final", "vigencia fim", "termino do contrato", "data de vencimento"},
        {"federacao", "federacao", "uf", "federacao de origem", "federacao estadual"},
        {"categoria", "categoria", "divisao", "serie"},
    };

    private static final Map<String, String> REV = new HashMap<>();
    private static final List<String> POR_TAMANHO = new ArrayList<>();

    static {
        for (String[] g : SIN) {
            for (int i = 1; i < g.length; i++) {
                REV.put(g[i], g[0]);
                POR_TAMANHO.add(g[i]);
            }
        }
        Collections.sort(POR_TAMANHO, new Comparator<String>() {
            @Override public int compare(String a, String b) { return b.length() - a.length(); }
        });
    }

    public static String mapHeader(String h) {
        String n = Texto.norm(h);
        String f = REV.get(n);
        if (f != null) return f;
        for (String syn : POR_TAMANHO) {
            if (syn.length() > 3 && n.contains(syn)) return REV.get(syn);
        }
        return null;
    }
}
