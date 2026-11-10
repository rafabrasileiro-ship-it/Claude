package com.rafa.bid.core;

import java.util.List;

/** CSV com ';' e BOM UTF-8, para abrir direto no Excel em português. */
public final class Csv {
    private Csv() {}

    public static String build(List<String> cols, List<List<String>> rows) {
        StringBuilder sb = new StringBuilder("﻿");
        linha(sb, cols);
        for (List<String> r : rows) linha(sb, r);
        return sb.toString();
    }

    private static void linha(StringBuilder sb, List<String> cels) {
        for (int i = 0; i < cels.size(); i++) {
            if (i > 0) sb.append(';');
            String v = cels.get(i) == null ? "" : cels.get(i);
            if (v.indexOf(';') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0) {
                v = "\"" + v.replace("\"", "\"\"") + "\"";
            }
            sb.append(v);
        }
        sb.append("\r\n");
    }
}
