import com.rafa.bid.core.*;
import com.rafa.bid.core.Modelos.*;
import java.util.*;

/** Teste em Java puro (rode: ver bid/README.md). HTML/dados SINTÉTICOS. */
public class CoreSelfTest {
    static int falhas = 0;
    static void eq(Object a, Object b, String msg) {
        if (!Objects.equals(a, b)) { falhas++; System.out.println("FALHOU " + msg + ": " + a + " != " + b); }
        else System.out.println("ok " + msg);
    }
    static Tabelas.Bruta br(boolean th, String[] c, String[] h) {
        Tabelas.Bruta b = new Tabelas.Bruta(th);
        b.cel.addAll(Arrays.asList(c)); b.href.addAll(Arrays.asList(h)); return b;
    }
    public static void main(String[] args) {
        Tabelas.Tabela dia = new Tabelas.Tabela();
        dia.linhas.add(br(true, new String[]{"Atleta", "Data de Nascimento", "Tipo de Operação", "Clube de Origem", "Clube de Destino", "Data"}, new String[6]));
        dia.linhas.add(br(false, new String[]{"João da Silva", "05/03/2003", "Transferência", "Clube B", "Clube C", "10/11/2024"},
            new String[]{"https://x/atleta/101", "", "", "", "", ""}));
        List<Linha> rows = Tabelas.parse(Collections.singletonList(dia), Campos.ID_REGEX);
        eq(rows.size(), 1, "uma linha");
        Linha r = rows.get(0);
        eq(r.atletaId, "101", "id do link");
        eq(r.get("nascimento"), "2003-03-05", "nascimento ISO");
        eq(r.get("clube"), "Clube C", "clube destino");
        eq(r.get("clube_origem"), "Clube B", "clube origem");
        eq(r.get("data_evento"), "2024-11-10", "data evento");
        eq(Tabelas.perfil("Data de Nascimento: 05/03/2003", null).get("nascimento"), "2003-03-05", "perfil");
        eq(Texto.parseDate("31/02/2020"), null, "data inválida");
        eq(new Dia(2024, 3, 4).epoch() - new Dia(2024, 3, 3).epoch(), 1L, "epoch");
        eq(new Dia(1970, 1, 1).epoch(), 0L, "epoch 1970");
        eq(new Dia(2003, 3, 5).idadeEm(new Dia(2024, 3, 4)), 20, "idade");
        eq(Creditos.classificar("Contrato Profissional"), "contrato_profissional", "classificar");
        eq(Creditos.pctSolidariedade(12) + Creditos.pctSolidariedade(16), 0.75, "pct");

        Atleta a = new Atleta(); a.id = "101"; a.nome = "João da Silva"; a.nascimento = "2003-03-05";
        Vinculo v1 = new Vinculo(); v1.clube = "Clube A"; v1.tipo = "Formação"; v1.inicio = "2015-01-01"; v1.fim = "2018-12-31";
        Vinculo v2 = new Vinculo(); v2.clube = "Clube B"; v2.tipo = "Contrato"; v2.inicio = "2019-01-01"; v2.fim = "2024-12-31";
        a.vinculos.add(v1); a.vinculos.add(v2);
        Evento ev = new Evento(); ev.dataBid = "2024-11-10"; ev.atletaId = "101"; ev.atletaNome = "João da Silva";
        ev.tipo = "Transferência"; ev.clube = "Clube C"; ev.clubeOrigem = "Clube B";
        Map<String, Atleta> m = new HashMap<>(); m.put("101", a);
        Creditos.Opcoes op = new Creditos.Opcoes();
        List<Creditos.Indicio> res = Creditos.analisar(Collections.singletonList(ev), m, op, new Dia(2024, 11, 10));
        eq(res.size(), 1, "só o formador (vendedor excluído)");
        eq(res.get(0).clubeFormador, "Clube A", "formador A");
        eq(res.get(0).anos1215, 4, "anos 12-15");
        op.incluirVendedor = true;
        eq(Creditos.analisar(Collections.singletonList(ev), m, op, new Dia(2024, 11, 10)).size(), 2, "inclui vendedor");
        String csv = Csv.build(Arrays.asList("a", "b"), Collections.singletonList(Arrays.asList("x;y", "ç\"")));
        eq(csv, "﻿a;b\r\n\"x;y\";\"ç\"\"\"\r\n", "csv");
        eq(Hash.make("A ", "b").length(), 40, "hash");
        System.out.println(falhas == 0 ? "TUDO OK" : falhas + " FALHAS");
        if (falhas > 0) System.exit(1);
    }
}
