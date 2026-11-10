package com.rafa.bid.core;

import java.util.LinkedHashMap;
import java.util.Map;

/** Uma linha de tabela já mapeada para campos canônicos. */
public final class Linha {
    public final Map<String, String> campos = new LinkedHashMap<>();
    public final Map<String, String> extra = new LinkedHashMap<>();
    public String atletaId;

    public String get(String k) { return campos.get(k); }
}
