from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS atletas (
    id_cbf TEXT PRIMARY KEY,
    nome TEXT,
    nascimento TEXT,
    perfil_json TEXT,
    historico_em TEXT
);
CREATE TABLE IF NOT EXISTS eventos (
    hash TEXT PRIMARY KEY,
    data_bid TEXT NOT NULL,
    atleta_id TEXT,
    atleta_nome TEXT,
    nascimento TEXT,
    tipo TEXT,
    clube TEXT,
    clube_origem TEXT,
    federacao TEXT,
    categoria TEXT,
    inicio TEXT,
    fim TEXT,
    extra_json TEXT,
    coletado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_eventos_data ON eventos(data_bid);
CREATE INDEX IF NOT EXISTS ix_eventos_atleta ON eventos(atleta_id);
CREATE INDEX IF NOT EXISTS ix_eventos_clube ON eventos(clube);
CREATE TABLE IF NOT EXISTS vinculos (
    hash TEXT PRIMARY KEY,
    atleta_id TEXT NOT NULL,
    clube TEXT,
    tipo TEXT,
    federacao TEXT,
    categoria TEXT,
    inicio TEXT,
    fim TEXT,
    extra_json TEXT
);
CREATE INDEX IF NOT EXISTS ix_vinculos_atleta ON vinculos(atleta_id);
CREATE TABLE IF NOT EXISTS dias (
    data TEXT PRIMARY KEY,
    status TEXT NOT NULL,        -- ok | vazio | erro
    linhas INTEGER DEFAULT 0,
    mensagem TEXT,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


def make_hash(*parts) -> str:
    raw = "|".join("" if p is None else str(p).strip().lower() for p in parts)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn


def upsert_evento(conn: sqlite3.Connection, ev: dict) -> bool:
    """Insere evento; retorna True se era novo."""
    h = make_hash(
        ev["data_bid"], ev.get("atleta_id") or ev.get("atleta_nome"), ev.get("tipo"),
        ev.get("clube"), ev.get("clube_origem"), ev.get("inicio"), ev.get("fim"),
    )
    cur = conn.execute(
        """INSERT OR IGNORE INTO eventos
           (hash,data_bid,atleta_id,atleta_nome,nascimento,tipo,clube,clube_origem,
            federacao,categoria,inicio,fim,extra_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (h, ev["data_bid"], ev.get("atleta_id"), ev.get("atleta_nome"), ev.get("nascimento"),
         ev.get("tipo"), ev.get("clube"), ev.get("clube_origem"), ev.get("federacao"),
         ev.get("categoria"), ev.get("inicio"), ev.get("fim"),
         json.dumps(ev.get("extra") or {}, ensure_ascii=False)),
    )
    if ev.get("atleta_id"):
        conn.execute(
            """INSERT INTO atletas(id_cbf,nome,nascimento) VALUES (?,?,?)
               ON CONFLICT(id_cbf) DO UPDATE SET
                 nome=COALESCE(excluded.nome,nome),
                 nascimento=COALESCE(excluded.nascimento,nascimento)""",
            (ev["atleta_id"], ev.get("atleta_nome"), ev.get("nascimento")),
        )
    return cur.rowcount > 0


def upsert_vinculo(conn: sqlite3.Connection, atleta_id: str, v: dict) -> None:
    h = make_hash(atleta_id, v.get("clube"), v.get("tipo"), v.get("inicio"), v.get("fim"))
    conn.execute(
        """INSERT OR REPLACE INTO vinculos
           (hash,atleta_id,clube,tipo,federacao,categoria,inicio,fim,extra_json)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (h, atleta_id, v.get("clube"), v.get("tipo"), v.get("federacao"), v.get("categoria"),
         v.get("inicio"), v.get("fim"), json.dumps(v.get("extra") or {}, ensure_ascii=False)),
    )
