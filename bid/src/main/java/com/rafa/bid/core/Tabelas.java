package com.rafa.bid.core;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Interpreta tabelas capturadas da página (cabeçalho por nome, não por posição). */
public final class Tabelas {
    private Tabelas() {}

    public static final class Bruta {
        public final boolean th;
        public final List<String> cel = new ArrayList<>();
        public final List<String> href = new ArrayList<>();
        public Bruta(boolean th) { this.th = th; }
    }

    public static final class Tabela {
        public final List<Bruta> linhas = new ArrayList<>();
    }

    private static final String[] DATAS = {"nascimento", "data_evento", "inicio", "fim"};

    public static List<Linha> parse(List<Tabela> tabelas, String idRegex) {
        Pattern idrx = idRegex == null ? null : Pattern.compile(idRegex);
        List<Linha> out = new ArrayList<>();
        for (Tabela t : tabelas) {
            List<Bruta> trs = t.linhas;
            if (trs.isEmpty()) continue;
            Bruta head = null;
            int start = 0;
            for (int i = 0; i < Math.min(5, trs.size()); i++) {
                if (trs.get(i).th) { head = trs.get(i); start = i + 1; break; }
            }
            if (head == null) {
                Bruta f = trs.get(0);
                int n = 0;
                for (String c : f.cel) if (Campos.mapHeader(Texto.clean(c)) != null) n++;
                if (n >= 2) { head = f; start = 1; } else continue;
            }
            int cols = head.cel.size();
            String[] headers = new String[cols];
            String[] fields = new String[cols];
            int mapped = 0;
            for (int i = 0; i < cols; i++) {
                headers[i] = Texto.clean(head.cel.get(i));
                fields[i] = Campos.mapHeader(headers[i]);
                if (fields[i] != null) mapped++;
            }
            if (mapped < 2) continue;
            for (int r = start; r < trs.size(); r++) {
                Bruta tr = trs.get(r);
                if (tr.cel.size() < 2) continue;
                Linha row = new Linha();
                for (int idx = 0; idx < Math.min(cols, tr.cel.size()); idx++) {
                    String val = Texto.clean(tr.cel.get(idx));
                    if (val.isEmpty()) continue;
                    String field = fields[idx];
                    if (field != null) {
                        if (!row.campos.containsKey(field)) row.campos.put(field, val);
                    } else {
                        row.extra.put(headers[idx], val);
                    }
                    if (idrx != null && row.atletaId == null && idx < tr.href.size()) {
                        String h = tr.href.get(idx);
                        if (h != null && !h.isEmpty()) {
                            Matcher m = idrx.matcher(h);
                            if (m.find()) row.atletaId = m.group(1);
                        }
                    }
                }
                if (row.campos.isEmpty() && row.extra.isEmpty()) continue;
                for (String k : DATAS) {
                    String v = row.campos.get(k);
                    if (v != null) {
                        String d = Texto.parseDate(v);
                        if (d != null) row.campos.put(k, d);
                    }
                }
                out.add(row);
            }
        }
        return out;
    }

    private static final Map<String, String> ROTULOS = new LinkedHashMap<>();
    static {
        ROTULOS.put("nome", "nome"); ROTULOS.put("nome completo", "nome"); ROTULOS.put("atleta", "nome");
        ROTULOS.put("data de nascimento", "nascimento"); ROTULOS.put("nascimento", "nascimento");
        ROTULOS.put("apelido", "apelido");
    }

    private static final Pattern PAR = Pattern.compile("^\\s*([A-Za-z\\u00C0-\\u00FF ]{3,30}):\\s*(.+?)\\s*$", Pattern.MULTILINE);

    /** Dados cadastrais do atleta: pares "Rótulo: valor" do texto e tabelas de 2 colunas. */
    public static Map<String, String> perfil(String texto, List<Tabela> tabelas) {
        Map<String, String> out = new LinkedHashMap<>();
        if (tabelas != null) {
            for (Tabela t : tabelas) {
                for (Bruta b : t.linhas) {
                    if (b.cel.size() == 2) put(out, b.cel.get(0), b.cel.get(1));
                }
            }
        }
        if (texto != null) {
            Matcher m = PAR.matcher(texto);
            while (m.find()) put(out, m.group(1), m.group(2));
        }
        return out;
    }

    private static void put(Map<String, String> out, String rotulo, String valor) {
        String f = ROTULOS.get(Texto.norm(rotulo));
        valor = Texto.clean(valor);
        if (f == null || valor.isEmpty() || out.containsKey(f)) return;
        if (f.equals("nascimento")) {
            String d = Texto.parseDate(valor);
            out.put(f, d != null ? d : valor);
        } else {
            out.put(f, valor);
        }
    }
}
