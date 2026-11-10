package com.rafa.bid.core;

import com.rafa.bid.core.Modelos.Atleta;
import com.rafa.bid.core.Modelos.Evento;
import com.rafa.bid.core.Modelos.Vinculo;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Triagem de INDÍCIOS de compensação por treinamento e mecanismo de solidariedade.
 * O BID não traz valor de transferência nem prova de formação: valide cada linha antes de cobrar.
 * Regras (FIFA RSTP Anexos 4 e 5 — confira a versão vigente): solidariedade = 5% do valor pago ao
 * vendedor, 0,25% por ano de idade 12–15 e 0,5% por ano de idade 16–23; compensação por treinamento
 * para formação entre 12 e 21 anos, até a temporada dos 23.
 */
public final class Creditos {
    private Creditos() {}

    public static final int IDADE_SOL_MIN = 12, IDADE_SOL_MAX = 23, IDADE_TREINO_MAX = 21, IDADE_TREINO_LIMITE = 23;

    public static final class Opcoes {
        public String de, ate, clubeFormador;
        public double pctMin = 0;
        public boolean incluirVendedor = false;
    }

    public static final class Indicio {
        public String atletaId, atleta, nascimento, eventoData, eventoTipo, categoriaEvento;
        public int idadeNoEvento;
        public String clubeDestino, clubeOrigem, clubeFormador, idadesNoClube;
        public int anos1215, anos1621;
        public double pctSolidariedade;
        public String compensacao, solidariedade, formadorEVendedor, observacoes;

        public static final List<String> COLS = Arrays.asList(
            "atleta_id", "atleta", "nascimento", "evento_data", "evento_tipo", "categoria_evento",
            "idade_no_evento", "clube_destino", "clube_origem", "clube_formador", "idades_no_clube",
            "anos_formacao_12_15", "anos_formacao_16_21", "pct_solidariedade", "compensacao_treinamento",
            "solidariedade", "formador_e_vendedor", "observacoes");

        public List<String> row() {
            return Arrays.asList(atletaId, atleta, nascimento, eventoData, eventoTipo, categoriaEvento,
                String.valueOf(idadeNoEvento), clubeDestino, clubeOrigem, clubeFormador, idadesNoClube,
                String.valueOf(anos1215), String.valueOf(anos1621),
                String.format(Locale.ROOT, "%.2f", pctSolidariedade).replace('.', ','),
                compensacao, solidariedade, formadorEVendedor, observacoes);
        }
    }

    static String n(String s) {
        String x = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return x.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", " ");
    }

    public static String clubeKey(String nome) {
        String x = n(nome).replaceAll(
            "\\b(fc|ec|sc|ac|futebol clube|esporte clube|sociedade esportiva|se|ltda|saf|s a f)\\b", " ");
        return x.replaceAll("\\s+", " ").trim();
    }

    public static String classificar(String tipo) {
        String t = n(tipo);
        if (t.contains("emprest")) return "emprestimo";
        if (t.contains("rescis") || t.contains("distrat")) return "rescisao";
        if (t.contains("transfer")) return "transferencia";
        if (t.contains("profission") && (t.contains("contrat") || t.contains("registr") || t.contains("inscri")))
            return "contrato_profissional";
        if (t.contains("contrat")) return "contrato";
        if (t.contains("amador") || t.contains("formac") || t.contains("base")) return "formacao";
        return "outro";
    }

    static boolean gatilho(String cat) { return cat.equals("transferencia") || cat.equals("contrato_profissional"); }

    public static double pctSolidariedade(int idade) {
        return (idade >= 12 && idade <= 15) ? 0.25 : (idade >= 16 && idade <= 23) ? 0.5 : 0.0;
    }

    /** Para cada idade (12–23), o clube com mais dias de registro naquele ano de vida. */
    public static Map<Integer, String> clubePorIdade(Dia nasc, List<Vinculo> vincs, Dia hoje) {
        Map<Integer, String> res = new LinkedHashMap<>();
        for (int idade = IDADE_SOL_MIN; idade <= IDADE_SOL_MAX; idade++) {
            Dia a = nasc.plusYears(idade), b = nasc.plusYears(idade + 1);
            Map<String, Long> dias = new LinkedHashMap<>();
            Map<String, String> nomes = new LinkedHashMap<>();
            for (Vinculo v : vincs) {
                if (v.clube == null || v.clube.isEmpty()) continue;
                String cat = classificar(v.tipo);
                if (cat.equals("emprestimo") || cat.equals("rescisao")) continue;
                Dia ini = Dia.parse(v.inicio);
                if (ini == null) continue;
                Dia fim = Dia.parse(v.fim);
                if (fim == null) fim = hoje;
                long ov = Math.min(fim.epoch(), b.epoch()) - Math.max(ini.epoch(), a.epoch());
                if (ov > 0) {
                    String k = clubeKey(v.clube);
                    Long cur = dias.get(k);
                    dias.put(k, (cur == null ? 0 : cur) + ov);
                    if (!nomes.containsKey(k)) nomes.put(k, v.clube);
                }
            }
            String best = null;
            long max = -1;
            for (Map.Entry<String, Long> e : dias.entrySet()) {
                if (e.getValue() > max) { max = e.getValue(); best = e.getKey(); }
            }
            if (best != null) res.put(idade, nomes.get(best));
        }
        return res;
    }

    public static List<Indicio> analisar(List<Evento> eventos, Map<String, Atleta> atletas, Opcoes op, Dia hoje) {
        List<Indicio> out = new ArrayList<>();
        for (Evento ev : eventos) {
            if (ev.atletaId == null) continue;
            if (op.de != null && ev.dataBid != null && ev.dataBid.compareTo(op.de) < 0) continue;
            if (op.ate != null && ev.dataBid != null && ev.dataBid.compareTo(op.ate) > 0) continue;
            String cat = classificar(ev.tipo);
            if (!gatilho(cat)) continue;
            Atleta a = atletas.get(ev.atletaId);
            if (a == null || a.vinculos.isEmpty()) continue;
            Dia nasc = Dia.parse(a.nascimento != null ? a.nascimento : ev.nascimento);
            if (nasc == null) continue;
            Dia quando = Dia.parse(ev.inicio);
            if (quando == null) quando = Dia.parse(ev.dataBid);
            if (quando == null) continue;
            int idadeEv = nasc.idadeEm(quando);
            Map<Integer, String> porIdade = clubePorIdade(nasc, a.vinculos, hoje);
            String destinoK = clubeKey(ev.clube), origemK = clubeKey(ev.clubeOrigem);
            Map<String, List<Integer>> grupos = new LinkedHashMap<>();
            Map<String, String> nomes = new LinkedHashMap<>();
            for (Map.Entry<Integer, String> e : porIdade.entrySet()) {
                String k = clubeKey(e.getValue());
                if (k.equals(destinoK)) continue; // quem contrata não cobra de si mesmo
                List<Integer> l = grupos.get(k);
                if (l == null) { l = new ArrayList<>(); grupos.put(k, l); }
                l.add(e.getKey());
                nomes.put(k, e.getValue());
            }
            for (Map.Entry<String, List<Integer>> g : grupos.entrySet()) {
                String k = g.getKey();
                List<Integer> idades = g.getValue();
                if (op.clubeFormador != null && !op.clubeFormador.isEmpty()
                        && !k.contains(clubeKey(op.clubeFormador))) continue;
                boolean vendedor = !origemK.isEmpty() && k.equals(origemK);
                if (vendedor && !op.incluirVendedor) continue;
                int a1215 = 0, a1621 = 0;
                double pct = 0;
                StringBuilder ids = new StringBuilder();
                for (int i : idades) {
                    if (i <= 15) a1215++; else if (i <= IDADE_TREINO_MAX) a1621++;
                    pct += pctSolidariedade(i);
                    if (ids.length() > 0) ids.append(',');
                    ids.append(i);
                }
                if (pct < op.pctMin) continue;
                boolean treino = (a1215 + a1621 > 0) && idadeEv <= IDADE_TREINO_LIMITE;
                StringBuilder obs = new StringBuilder(
                    "Valor da transferência não consta no BID: solidariedade = pct × valor pago ao vendedor.");
                if (cat.equals("contrato_profissional"))
                    obs.append(" Verificar se é o 1º contrato profissional (gatilho da compensação).");
                if (vendedor)
                    obs.append(" Formador é o próprio clube vendedor (retém sua parte da indenização).");
                Indicio i = new Indicio();
                i.atletaId = ev.atletaId;
                i.atleta = ev.atletaNome != null ? ev.atletaNome : (a.nome != null ? a.nome : "");
                i.nascimento = nasc.toString();
                i.eventoData = quando.toString();
                i.eventoTipo = ev.tipo == null ? "" : ev.tipo;
                i.categoriaEvento = cat;
                i.idadeNoEvento = idadeEv;
                i.clubeDestino = ev.clube == null ? "" : ev.clube;
                i.clubeOrigem = ev.clubeOrigem == null ? "" : ev.clubeOrigem;
                i.clubeFormador = nomes.get(k);
                i.idadesNoClube = ids.toString();
                i.anos1215 = a1215;
                i.anos1621 = a1621;
                i.pctSolidariedade = Math.round(pct * 100.0) / 100.0;
                i.compensacao = treino ? "POSSÍVEL" : "improvável (fora da faixa de idade)";
                i.solidariedade = pct > 0 ? "POSSÍVEL" : "não";
                i.formadorEVendedor = vendedor ? "sim" : "não";
                i.observacoes = obs.toString();
                out.add(i);
            }
        }
        return out;
    }
}
