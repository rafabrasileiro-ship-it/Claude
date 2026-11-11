"""Testes com HTML SINTÉTICO (não é o layout real do BID): validam a lógica, não o site."""
import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path

from bidscraper import apuracao, creditos, export, fontes, parsers
from bidscraper.config import load_config
from bidscraper.db import connect
from bidscraper.scraper import Scraper

DIA = """<table><tr><th>Atleta</th><th>Data de Nascimento</th><th>Tipo de Operação</th>
<th>Clube de Origem</th><th>Clube de Destino</th><th>Data</th></tr>
<tr><td><a href="/atleta/101">João da Silva</a></td><td>05/03/2003</td><td>Transferência</td>
<td>Clube B</td><td>Clube C</td><td>10/11/2024</td></tr></table>
<a href="?pagina=2">Próxima</a>"""

ATLETA = """<dl><dt>Data de Nascimento:</dt><dd>05/03/2003</dd></dl>
<table><tr><th>Clube</th><th>Tipo</th><th>Início</th><th>Fim</th></tr>
<tr><td>Clube A</td><td>Formação</td><td>01/01/2015</td><td>31/12/2018</td></tr>
<tr><td>Clube B</td><td>Contrato</td><td>01/01/2019</td><td>31/12/2024</td></tr></table>"""


class FakeFetcher:
    def __init__(self, pages):
        self.pages = pages
    def get(self, url):
        for k, v in self.pages.items():
            if k in url:
                return v
        return ""
    def close(self):
        pass


class Tests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = load_config()
        self.cfg.geral["db_path"] = str(Path(self.tmp.name) / "t.sqlite")
        self.conn = connect(self.cfg.path("db_path"))

    def tearDown(self):
        self.conn.close(); self.tmp.cleanup()

    def test_parse_table(self):
        rows = parsers.parse_tables(DIA, r"atleta/(\d+)")
        self.assertEqual(len(rows), 1)
        r = rows[0]
        self.assertEqual((r["atleta_id"], r["nascimento"], r["clube"], r["clube_origem"], r["data_evento"]),
                         ("101", "2003-03-05", "Clube C", "Clube B", "2024-11-10"))

    def test_profile(self):
        self.assertEqual(parsers.parse_profile(ATLETA)["nascimento"], "2003-03-05")

    def test_json(self):
        rows = parsers.parse_json_rows('{"dados":[{"id":7,"Atleta":"Zé","Clube":"X","Data":"2024-01-02"}]}')
        self.assertEqual(rows[0]["atleta_id"], "7")
        self.assertEqual(rows[0]["clube"], "X")

    def test_scrape_idempotent_and_resume(self):
        self.cfg.site["url_dia"] = "http://x/dia?d={data}&p={pagina}"
        fake = FakeFetcher({"dia?d=": DIA, "atleta/101": ATLETA})
        sc = Scraper(self.cfg, self.conn, fake)
        d = date(2024, 11, 10)
        s1 = sc.run_range(d, d)
        s2 = sc.run_range(d, d)
        self.assertEqual((s1["novos"], s2["pulados"]), (1, 1))
        sc.run_range(d, d, force=True)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM eventos").fetchone()[0], 1)
        self.assertEqual(sc.update_histories(), 1)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM vinculos").fetchone()[0], 2)

    def test_creditos(self):
        self.cfg.site["url_dia"] = "http://x/dia?d={data}&p={pagina}"
        sc = Scraper(self.cfg, self.conn, FakeFetcher({"dia?d=": DIA, "atleta/101": ATLETA}))
        sc.run_range(date(2024, 11, 10), date(2024, 11, 10)); sc.update_histories()
        # Clube A formou aos 12-15 (2015-2018 => idades 12..15), Clube B é o vendedor.
        res = creditos.analisar(self.conn)
        self.assertEqual([r.clube_formador for r in res], ["Clube A"])
        self.assertEqual(res[0].anos_formacao_12_15, 4)  # idades 12-15: Clube A tem a maioria dos dias em cada ano de vida
        self.assertGreater(res[0].pct_solidariedade, 0)
        inc = creditos.analisar(self.conn, incluir_vendedor=True)
        self.assertEqual({r.clube_formador for r in inc}, {"Clube A", "Clube B"})

    def test_pct_and_age(self):
        self.assertEqual(creditos.pct_solidariedade(12), 0.25)
        self.assertEqual(creditos.pct_solidariedade(16), 0.5)
        self.assertEqual(creditos.idade_em(date(2003, 3, 5), date(2024, 3, 4)), 20)
        self.assertEqual(creditos.classificar("Contrato Profissional"), "contrato_profissional")

    def test_export(self):
        rows = [{"a": 1, "b": "ç"}]
        for ext in ("csv", "json", "xlsx"):
            p = export.write(rows, Path(self.tmp.name) / f"o.{ext}")
            self.assertTrue(p.exists())

    # ---- fontes externas (CSV no formato do transfermarkt-datasets, dados fictícios)
    def _tm(self):
        d = Path(self.tmp.name) / "tm"; d.mkdir(exist_ok=True)
        (d / "clubs.csv").write_text(
            "club_id,name,domestic_competition_id\n1,Clube A,BRA1\n2,Clube B,BRA1\n3,Clube C,ES1\n",
            encoding="utf-8")
        (d / "players.csv").write_text(
            "player_id,name,date_of_birth,country_of_citizenship,current_club_name\n"
            "900,Joao Silva,2003-03-05 00:00:00,Brazil,Clube C\n", encoding="utf-8")
        (d / "transfers.csv").write_text(
            "player_id,transfer_date,transfer_season,from_club_id,to_club_id,from_club_name,"
            "to_club_name,transfer_fee,market_value_in_eur,player_name\n"
            "900,2016-03-05,15/16,10,1,Escolinha X,Clube A U17,0,,Joao Silva\n"
            "900,2019-03-05,18/19,1,1,Clube A U17,Clube A,0,,Joao Silva\n"
            "900,2021-03-05,20/21,1,2,Clube A,Clube B,500000,1000000,Joao Silva\n"
            "900,2024-11-10,24/25,2,3,Clube B,Clube C,10000000,12000000,Joao Silva\n",
            encoding="utf-8")
        return fontes.importar_transfermarkt(self.conn, str(d))

    def test_importar_e_carreira(self):
        self.assertEqual(self._tm(), {"atletas": 1, "clubes": 3, "transferencias": 4})
        self.assertEqual(self._tm()["transferencias"], 4)  # idempotente
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM transferencias").fetchone()[0], 4)
        car = fontes.carreira(self.conn, id_fonte="900")
        self.assertEqual([c["clube"] for c in car], ["Clube A U17", "Clube A", "Clube B", "Clube C"])
        self.assertEqual(fontes.clube_matriz("Clube A U17"), fontes.clube_matriz("Clube A"))
        self.assertEqual(fontes._num("€45.00mi"), 45e6)
        self.assertEqual(fontes._num("1.500.000,00"), 1.5e6)

    def test_apurar_credores_devedores(self):
        self._tm()
        hoje = date(2025, 6, 1)
        res = apuracao.apurar(self.conn, de="2024-01-01", tipos=("solidariedade",), hoje=hoje)
        # venda B -> C por 10 mi: A formou dos 13 aos 17 (2016-03-05 a 2021-03-05)
        self.assertEqual([(r.clube_credor, r.clube_devedor) for r in res], [("Clube A", "Clube C")])
        r = res[0]
        self.assertEqual(r.idades_no_credor, "13,14,15,16,17")
        self.assertEqual(r.pct_do_valor, 1.75)           # 3×0,25 + 2×0,5
        self.assertEqual(r.valor_credito_eur, 175000.0)
        self.assertEqual((r.ambito, r.situacao_prazo), ("internacional", "dentro do prazo"))
        inc = apuracao.apurar(self.conn, de="2024-01-01", tipos=("solidariedade",),
                              incluir_vendedor=True, hoje=hoje)
        b = [x for x in inc if x.clube_credor == "Clube B"][0]
        self.assertEqual((b.idades_no_credor, b.valor_credito_eur), ("18,19,20,21", 184246.58))
        tot = apuracao.resumo(inc)
        self.assertEqual(tot[0]["total_estimado_eur"], 184246.58)
        # venda A -> B (2021, nacional): sem outro formador além do vendedor; promoção interna ignorada
        self.assertEqual(apuracao.apurar(self.conn, ate="2021-12-31", tipos=("solidariedade",), hoje=hoje), [])
        tc = apuracao.apurar(self.conn, ate="2021-12-31", tipos=("compensacao_treinamento",),
                             custo_anual=30000, custo_anual_12_15=2000, hoje=hoje)
        self.assertEqual([(x.clube_credor, x.clube_devedor, x.valor_credito_eur) for x in tc],
                         [("Clube A", "Clube B", 66000.0)])
        self.assertIn("esgotado", tc[0].situacao_prazo)

    def test_bid_preenche_e_vincula(self):
        self._tm()
        self.cfg.site["url_dia"] = "http://x/dia?d={data}&p={pagina}"
        nome = DIA.replace("João da Silva", "João Pedro da Silva")
        sc = Scraper(self.cfg, self.conn, FakeFetcher({"dia?d=": nome, "atleta/101": ATLETA}))
        sc.run_range(date(2024, 11, 10), date(2024, 11, 10)); sc.update_histories()
        self.assertEqual(fontes.vincular(self.conn)["vinculados"], 1)
        car = fontes.carreira(self.conn, "101")
        # BID cobre 2015–2024 (prioridade); a fonte só entra depois de 31/12/2024
        self.assertEqual(len(car), 3)
        self.assertEqual([(c["clube"], c["fonte"]) for c in car][:2], [("Clube A", "bid"), ("Clube B", "bid")])
        self.assertEqual(car[-1]["inicio"], "2025-01-01")
        res = apuracao.apurar(self.conn, de="2024-01-01", tipos=("solidariedade",), hoje=date(2025, 6, 1))
        self.assertEqual((res[0].id_cbf, res[0].base_da_carreira, res[0].idades_no_credor),
                         ("101", "bid", "12,13,14,15"))

    def test_importar_csv_generico(self):
        p = Path(self.tmp.name) / "o.csv"
        p.write_text("Jogador;Data de Nascimento;Data;Origem;Destino;Valor\n"
                     "Zé Teste;01/01/2004;10/01/2020;Clube X;Clube Y;0\n"
                     "Zé Teste;01/01/2004;10/01/2025;Clube Y;Clube Z;2.000.000,00\n", encoding="utf-8")
        self.assertEqual(fontes.importar_csv(self.conn, str(p), "ogol"), {"transferencias": 2})
        res = apuracao.apurar(self.conn, tipos=("solidariedade",), incluir_vendedor=True, hoje=date(2025, 6, 1))
        self.assertEqual([(r.clube_credor, r.idades_no_credor, r.valor_credito_eur) for r in res],
                         [("Clube Y", "16,17,18,19,20,21", 50000.67)])  # pro rata por dias


if __name__ == "__main__":
    unittest.main()
