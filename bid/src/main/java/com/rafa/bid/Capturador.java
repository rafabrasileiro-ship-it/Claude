package com.rafa.bid;

import com.rafa.bid.core.Campos;
import com.rafa.bid.core.Dia;
import com.rafa.bid.core.Hash;
import com.rafa.bid.core.Linha;
import com.rafa.bid.core.Tabelas;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Converte o que o extrator leu na página em registros do banco. */
public class Capturador {
    private final BidDb db;

    public Capturador(BidDb db) { this.db = db; }

    private static List<Tabelas.Tabela> lerTabelas(JSONObject o) throws JSONException {
        List<Tabelas.Tabela> tabs = new ArrayList<>();
        JSONArray ts = o.getJSONArray("tables");
        for (int i = 0; i < ts.length(); i++) {
            JSONArray rows = ts.getJSONObject(i).getJSONArray("rows");
            Tabelas.Tabela tb = new Tabelas.Tabela();
            for (int j = 0; j < rows.length(); j++) {
                JSONObject r = rows.getJSONObject(j);
                Tabelas.Bruta b = new Tabelas.Bruta(r.optBoolean("th"));
                JSONArray c = r.getJSONArray("c"), h = r.getJSONArray("h");
                for (int k = 0; k < c.length(); k++) {
                    b.cel.add(c.optString(k));
                    b.href.add(h.optString(k));
                }
                tb.linhas.add(b);
            }
            tabs.add(tb);
        }
        return tabs;
    }

    private static String idSintetico(String nome, String nasc) {
        return "n:" + Hash.make(nome, nasc).substring(0, 12);
    }

    /** @return mensagem de status para o usuário */
    public String processar(String json, boolean historico) {
        try {
            JSONObject o = new JSONObject(json);
            List<Tabelas.Tabela> tabs = lerTabelas(o);
            List<Linha> linhas = Tabelas.parse(tabs, Campos.ID_REGEX);
            if (linhas.isEmpty()) {
                return "Nenhuma tabela reconhecida nesta página (" + tabs.size() + " tabelas). "
                    + "Use Dados → Salvar página (diagnóstico).";
            }
            return historico ? salvarHistorico(o, tabs, linhas) : salvarEventos(linhas);
        } catch (JSONException e) {
            return "Falha ao ler a página: " + e.getMessage();
        }
    }

    private String salvarEventos(List<Linha> linhas) {
        int lidas = 0, novas = 0;
        String hoje = Dia.hoje().toString();
        for (Linha l : linhas) {
            String nome = l.get("atleta_nome");
            if (nome == null && l.atletaId == null) continue;
            lidas++;
            String id = l.atletaId != null ? l.atletaId : idSintetico(nome, l.get("nascimento"));
            String data = l.get("data_evento") != null ? l.get("data_evento") : hoje;
            if (db.addEvento(l, data, id)) novas++;
        }
        return "Eventos: " + lidas + " linhas lidas, " + novas + " novas. Total: " + db.count("eventos");
    }

    private String salvarHistorico(JSONObject o, List<Tabelas.Tabela> tabs, List<Linha> linhas) {
        Map<String, String> perfil = Tabelas.perfil(o.optString("text"), tabs);
        String nome = perfil.get("nome"), nasc = perfil.get("nascimento");
        String id = null;
        Matcher m = Pattern.compile(Campos.ID_REGEX).matcher(o.optString("url"));
        if (m.find()) id = m.group(1);
        if (id == null) for (Linha l : linhas) if (l.atletaId != null) { id = l.atletaId; break; }
        if (id == null && nome != null) id = idSintetico(nome, nasc);
        if (id == null) {
            return "Não consegui identificar o atleta (nome/ID). Abra a página do atleta e tente de novo.";
        }
        int novos = 0;
        for (Linha l : linhas) if (db.addVinculo(id, l)) novos++;
        db.upsertAtleta(id, nome, nasc, true);
        return "Histórico de " + (nome != null ? nome : id) + ": " + novos + " vínculos novos"
            + (nasc == null ? " (sem data de nascimento: a triagem de créditos precisa dela)" : "") + ".";
    }
}
