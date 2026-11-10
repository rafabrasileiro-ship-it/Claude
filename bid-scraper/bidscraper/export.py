from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path

CAMPOS_EVENTOS = ["data_bid", "atleta_id", "atleta_nome", "nascimento", "tipo", "clube",
                  "clube_origem", "federacao", "categoria", "inicio", "fim"]


def consulta_eventos(conn: sqlite3.Connection, de=None, ate=None, atleta=None, clube=None,
                     tipo=None, nasc_de=None, nasc_ate=None, atleta_id=None,
                     limite: int | None = None) -> list[dict]:
    sql, args = "SELECT * FROM eventos WHERE 1=1", []
    for cond, val in (
        ("data_bid >= ?", de), ("data_bid <= ?", ate),
        ("atleta_nome LIKE ?", f"%{atleta}%" if atleta else None),
        ("(clube LIKE ? OR clube_origem LIKE ?)", f"%{clube}%" if clube else None),
        ("tipo LIKE ?", f"%{tipo}%" if tipo else None),
        ("nascimento >= ?", nasc_de), ("nascimento <= ?", nasc_ate),
        ("atleta_id = ?", atleta_id),
    ):
        if val:
            sql += f" AND {cond}"
            args += [val, val] if cond.startswith("(clube") else [val]
    sql += " ORDER BY data_bid DESC, atleta_nome"
    if limite:
        sql += f" LIMIT {int(limite)}"
    return [dict(r) for r in conn.execute(sql, args)]


def historico_atleta(conn: sqlite3.Connection, atleta_id: str) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM vinculos WHERE atleta_id=? ORDER BY inicio", (atleta_id,))]


def write(rows: list[dict], path: Path, formato: str | None = None) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    formato = (formato or path.suffix.lstrip(".") or "csv").lower()
    cols = list(rows[0].keys()) if rows else []
    if formato == "json":
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    elif formato == "csv":
        # utf-8-sig e ';' para abrir direto no Excel em português
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=cols, delimiter=";")
            w.writeheader()
            w.writerows(rows)
    elif formato == "xlsx":
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.append(cols)
        for r in rows:
            ws.append([r.get(c) for c in cols])
        ws.freeze_panes = "A2"
        wb.save(path)
    else:
        raise ValueError(f"formato desconhecido: {formato}")
    return path


def print_table(rows: list[dict], max_rows: int = 50) -> None:
    if not rows:
        print("(sem resultados)")
        return
    cols = list(rows[0].keys())
    shown = rows[:max_rows]
    widths = {c: min(28, max(len(c), *(len(str(r.get(c) or "")) for r in shown))) for c in cols}
    print(" | ".join(c[: widths[c]].ljust(widths[c]) for c in cols))
    print("-+-".join("-" * widths[c] for c in cols))
    for r in shown:
        print(" | ".join(str(r.get(c) or "")[: widths[c]].ljust(widths[c]) for c in cols))
    if len(rows) > max_rows:
        print(f"... mais {len(rows) - max_rows} linhas (use --saida para exportar tudo)")
