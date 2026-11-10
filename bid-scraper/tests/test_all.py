"""Testes com HTML SINTÉTICO (não é o layout real do BID): validam a lógica, não o site."""
import sqlite3
import tempfile
import unittest
from datetime import date
from pathlib import Path

from bidscraper import creditos, export, parsers
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


if __name__ == "__main__":
    unittest.main()
