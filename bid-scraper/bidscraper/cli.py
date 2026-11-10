from __future__ import annotations

import argparse
import logging
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from . import __version__, creditos, export
from .config import load_config
from .db import connect
from .http import Fetcher
from .scraper import Scraper


def _date(s: str) -> date:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(f"data inválida: {s} (use AAAA-MM-DD ou DD/MM/AAAA)")


def _iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def setup_logging(path: Path, verbose: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.FileHandler(path, encoding="utf-8"), logging.StreamHandler()])


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="bidscraper", description="Coleta e consulta do BID da CBF.")
    p.add_argument("--config", help="caminho do config.toml")
    p.add_argument("-v", "--verbose", action="store_true")
    p.add_argument("--versao", action="version", version=__version__)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("sondar", help="Diagnóstico: baixa uma página e mostra tabelas/links/campos")
    s.add_argument("--url", help="URL a analisar (padrão: base_url)")
    s.add_argument("--salvar", help="salva o HTML bruto neste arquivo")

    s = sub.add_parser("backfill", help="Coleta o histórico (padrão: 730 dias)")
    s.add_argument("--dias", type=int)
    s.add_argument("--de", type=_date)
    s.add_argument("--ate", type=_date)
    s.add_argument("--forcar", action="store_true", help="refaz dias já coletados")

    sub.add_parser("diario", help="Atualização diária (últimos dias + históricos pendentes)")

    s = sub.add_parser("historico", help="Coleta o histórico de atletas")
    s.add_argument("--atleta-id")
    s.add_argument("--limite", type=int)
    s.add_argument("--todos", action="store_true", help="inclui históricos desatualizados")

    s = sub.add_parser("consulta", help="Consulta parametrizada dos eventos coletados")
    s.add_argument("--de", type=_date)
    s.add_argument("--ate", type=_date)
    s.add_argument("--atleta")
    s.add_argument("--atleta-id")
    s.add_argument("--clube", help="clube de origem ou destino (parte do nome)")
    s.add_argument("--tipo")
    s.add_argument("--nascidos-de", type=_date)
    s.add_argument("--nascidos-ate", type=_date)
    s.add_argument("--limite", type=int)
    s.add_argument("--historico", action="store_true",
                   help="com --atleta-id: lista os vínculos do atleta")
    s.add_argument("--saida", help="arquivo .csv/.xlsx/.json (senão imprime tabela)")

    s = sub.add_parser("creditos", help="Triagem de indícios: compensação por treinamento e solidariedade")
    s.add_argument("--de", type=_date, help="data mínima do evento gatilho")
    s.add_argument("--ate", type=_date)
    s.add_argument("--clube-formador")
    s.add_argument("--clube-destino")
    s.add_argument("--atleta")
    s.add_argument("--pct-min", type=float, default=0.0, help="solidariedade mínima (%% do valor)")
    s.add_argument("--incluir-vendedor", action="store_true")
    s.add_argument("--saida")

    s = sub.add_parser("status", help="Resumo da base")
    return p


def cmd_sondar(cfg, args) -> int:
    from bs4 import BeautifulSoup
    from . import parsers
    url = args.url or cfg.site["url_dia"].format(
        data=date.today().strftime(cfg.site["formato_data_url"]), pagina=1, id="")
    fetcher = Fetcher(cfg)
    body = fetcher.get(url)
    if args.salvar:
        Path(args.salvar).write_text(body, encoding="utf-8")
    print(f"URL: {url}\nTamanho: {len(body)} bytes")
    if parsers.parse_json_rows(body) is not None:
        rows = parsers.parse_json_rows(body)
        print(f"Resposta JSON com {len(rows)} registros. Exemplo: {rows[:1]}")
        return 0
    soup = BeautifulSoup(body, "lxml")
    print(f"Título: {soup.title.get_text(strip=True) if soup.title else '-'}")
    tabs = soup.find_all("table")
    print(f"Tabelas: {len(tabs)}")
    for i, t in enumerate(tabs[:5]):
        heads = [h.get_text(" ", strip=True) for h in t.find_all("th")]
        print(f"  tabela {i}: cabeçalhos={heads}")
    rows = parsers.parse_tables(body, cfg.site["regex_id_atleta"])
    print(f"Linhas reconhecidas pelo parser: {len(rows)}")
    for r in rows[:3]:
        print("  ", r)
    print("Formulários:")
    for f in soup.find_all("form"):
        names = [i.get("name") for i in f.find_all(["input", "select"]) if i.get("name")]
        print(f"  action={f.get('action')} method={f.get('method')} campos={names}")
    print("Scripts/APIs referenciados:")
    for m in sorted(set(re.findall(r"""["'](/?(?:api|bid|rest)[^"' ]{3,80})["']""", body)))[:25]:
        print("  ", m)
    links = [a["href"] for a in soup.find_all("a", href=True)][:25]
    print("Links (25 primeiros):", links)
    if not rows:
        print("\nNenhuma linha reconhecida. Se a página depende de JavaScript, use [http] modo=\"browser\";"
              "\nse os dados vêm de uma API, ajuste [site] url_dia para o endpoint JSON encontrado acima.")
    return 0


def cmd_status(conn) -> int:
    q = lambda s: conn.execute(s).fetchone()[0]
    print("Eventos:", q("SELECT COUNT(*) FROM eventos"))
    print("Atletas:", q("SELECT COUNT(*) FROM atletas"),
          "| com histórico:", q("SELECT COUNT(*) FROM atletas WHERE historico_em IS NOT NULL"))
    print("Vínculos:", q("SELECT COUNT(*) FROM vinculos"))
    print("Período coletado:", q("SELECT MIN(data) FROM dias WHERE status!='erro'"), "a",
          q("SELECT MAX(data) FROM dias WHERE status!='erro'"))
    print("Dias com erro:", q("SELECT COUNT(*) FROM dias WHERE status='erro'"))
    return 0


def main(argv: list[str] | None = None) -> int:
    for stream in (sys.stdout, sys.stderr):  # console do Windows
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass
    args = build_parser().parse_args(argv)
    cfg = load_config(args.config)
    setup_logging(cfg.path("log_path"), args.verbose)
    conn = connect(cfg.path("db_path"))

    if args.cmd == "status":
        return cmd_status(conn)
    if args.cmd == "sondar":
        return cmd_sondar(cfg, args)

    if args.cmd in ("backfill", "diario", "historico"):
        sc = Scraper(cfg, conn)
        try:
            if args.cmd == "backfill":
                if args.de:
                    stats = sc.run_range(args.de, args.ate or date.today(), args.forcar)
                else:
                    stats = sc.backfill(args.dias, args.forcar)
            elif args.cmd == "diario":
                stats = sc.diario()
                _auto_export(cfg, conn)
            else:
                if args.atleta_id:
                    stats = {"vinculos": sc.fetch_history(args.atleta_id)}
                else:
                    stats = {"atletas": sc.update_histories(args.limite, args.todos)}
        finally:
            sc.fetcher.close()
        print(stats)
        return 1 if stats.get("erros") else 0

    if args.cmd == "consulta":
        if args.historico:
            if not args.atleta_id:
                print("--historico exige --atleta-id", file=sys.stderr)
                return 2
            rows = export.historico_atleta(conn, args.atleta_id)
        else:
            rows = [{k: r[k] for k in export.CAMPOS_EVENTOS} for r in export.consulta_eventos(
                conn, _iso(args.de), _iso(args.ate), args.atleta, args.clube, args.tipo,
                _iso(args.nascidos_de), _iso(args.nascidos_ate), args.atleta_id, args.limite)]
    elif args.cmd == "creditos":
        rows = creditos.to_rows(creditos.analisar(
            conn, _iso(args.de), _iso(args.ate), args.clube_formador, args.clube_destino,
            args.atleta, pct_min=args.pct_min, incluir_vendedor=args.incluir_vendedor))
    else:  # pragma: no cover
        return 2
    if args.saida:
        print("Gerado:", export.write(rows, Path(args.saida)), f"({len(rows)} linhas)")
    else:
        export.print_table(rows)
    return 0


def _auto_export(cfg, conn) -> None:
    """Após a coleta diária, deixa arquivos prontos em exports/."""
    d = cfg.path("exports_dir")
    hoje = date.today().isoformat()
    ev = export.consulta_eventos(conn, de=(date.today() - timedelta(days=int(cfg.geral["janela_diaria"]))).isoformat())
    export.write([{k: r[k] for k in export.CAMPOS_EVENTOS} for r in ev], d / f"eventos_{hoje}.csv")
    export.write(creditos.to_rows(creditos.analisar(conn)), d / "creditos_atual.csv")
