from __future__ import annotations

import logging
import sqlite3
from datetime import date, datetime, timedelta

from . import parsers
from .config import Config
from .db import upsert_evento, upsert_vinculo
from .http import Fetcher

log = logging.getLogger("bid.scraper")


def daterange(start: date, end: date):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def _rows_from(body: str, cfg: Config) -> list[dict]:
    rows = parsers.parse_json_rows(body)
    if rows is None:
        rows = parsers.parse_tables(body, cfg.site["regex_id_atleta"])
    return rows


class Scraper:
    def __init__(self, cfg: Config, conn: sqlite3.Connection, fetcher: Fetcher | None = None):
        self.cfg, self.conn = cfg, conn
        self.fetcher = fetcher or Fetcher(cfg)

    # ---- BID diário --------------------------------------------------------
    def fetch_day(self, d: date) -> int:
        site = self.cfg.site
        total = 0
        seen_first = None
        for page in range(1, int(site["max_paginas"]) + 1):
            url = site["url_dia"].format(
                data=d.strftime(site["formato_data_url"]), pagina=page, id="")
            body = self.fetcher.get(url)
            rows = _rows_from(body, self.cfg)
            marker = site.get("marcador_sem_resultados", "")
            if not rows or (marker and marker.lower() in body.lower() and not rows):
                break
            sig = repr(rows[0])
            if sig == seen_first:  # site ignora {pagina}: evita laço infinito
                break
            seen_first = seen_first or sig
            for r in rows:
                ev = {k: r.get(k) for k in (
                    "atleta_id", "atleta_nome", "nascimento", "tipo", "clube", "clube_origem",
                    "federacao", "categoria", "inicio", "fim", "extra")}
                ev["data_bid"] = r.get("data_evento") or d.isoformat()
                if upsert_evento(self.conn, ev):
                    total += 1
            if "{pagina}" not in site["url_dia"] or not parsers.has_next_page(body):
                break
        return total

    def _mark_day(self, d: date, status: str, n: int, msg: str = "") -> None:
        self.conn.execute(
            """INSERT INTO dias(data,status,linhas,mensagem,atualizado_em)
               VALUES(?,?,?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(data) DO UPDATE SET status=excluded.status,linhas=excluded.linhas,
               mensagem=excluded.mensagem,atualizado_em=CURRENT_TIMESTAMP""",
            (d.isoformat(), status, n, msg))
        self.conn.commit()

    def run_range(self, start: date, end: date, force: bool = False) -> dict:
        """Coleta um intervalo, retomável: dias já 'ok' são pulados (exceto com force)."""
        done = {r["data"] for r in self.conn.execute(
            "SELECT data FROM dias WHERE status IN ('ok','vazio')")}
        stats = {"dias": 0, "novos": 0, "erros": 0, "pulados": 0}
        for d in daterange(start, end):
            if d.isoformat() in done and not force:
                stats["pulados"] += 1
                continue
            try:
                n = self.fetch_day(d)
                self._mark_day(d, "ok" if n else "vazio", n)
                stats["dias"] += 1
                stats["novos"] += n
                log.info("%s: %d novos eventos", d, n)
            except PermissionError:
                raise
            except Exception as e:  # noqa: BLE001 - um dia ruim não derruba a coleta
                self._mark_day(d, "erro", 0, str(e)[:300])
                stats["erros"] += 1
                log.warning("%s: erro %s", d, e)
        return stats

    def backfill(self, dias: int | None = None, force: bool = False) -> dict:
        dias = dias or int(self.cfg.geral["dias_historico"])
        end = date.today()
        return self.run_range(end - timedelta(days=dias), end, force)

    def diario(self) -> dict:
        end = date.today()
        start = end - timedelta(days=int(self.cfg.geral["janela_diaria"]))
        stats = self.run_range(start, end, force=True)
        stats["historicos"] = self.update_histories(limit=500)
        return stats

    # ---- Histórico do atleta ----------------------------------------------
    def fetch_history(self, atleta_id: str) -> int:
        url = self.cfg.site["url_atleta"].format(id=atleta_id, data="", pagina=1)
        body = self.fetcher.get(url)
        profile = parsers.parse_profile(body)
        rows = _rows_from(body, self.cfg)
        n = 0
        for r in rows:
            if not (r.get("clube") or r.get("clube_origem")):
                continue
            upsert_vinculo(self.conn, atleta_id, {
                "clube": r.get("clube") or r.get("clube_origem"),
                "tipo": r.get("tipo"), "federacao": r.get("federacao"),
                "categoria": r.get("categoria"),
                "inicio": r.get("inicio") or r.get("data_evento"), "fim": r.get("fim"),
                "extra": r.get("extra"),
            })
            n += 1
        import json
        self.conn.execute(
            """UPDATE atletas SET nome=COALESCE(?,nome), nascimento=COALESCE(?,nascimento),
               perfil_json=?, historico_em=? WHERE id_cbf=?""",
            (profile.get("nome"), profile.get("nascimento"),
             json.dumps(profile, ensure_ascii=False), datetime.now().isoformat(timespec="seconds"),
             atleta_id))
        self.conn.commit()
        return n

    def pending_athletes(self, limit: int | None = None, todos: bool = False) -> list[str]:
        max_age = int(self.cfg.geral["historico_max_idade_dias"])
        cutoff = (datetime.now() - timedelta(days=max_age)).isoformat(timespec="seconds")
        sql = "SELECT id_cbf FROM atletas WHERE historico_em IS NULL"
        args: list = []
        if todos:
            sql = "SELECT id_cbf FROM atletas WHERE historico_em IS NULL OR historico_em < ?"
            args = [cutoff]
        sql += " ORDER BY id_cbf"
        if limit:
            sql += f" LIMIT {int(limit)}"
        return [r["id_cbf"] for r in self.conn.execute(sql, args)]

    def update_histories(self, limit: int | None = None, todos: bool = False) -> int:
        ok = 0
        for aid in self.pending_athletes(limit, todos):
            try:
                self.fetch_history(aid)
                ok += 1
            except PermissionError:
                raise
            except Exception as e:  # noqa: BLE001
                log.warning("histórico %s: %s", aid, e)
        return ok
