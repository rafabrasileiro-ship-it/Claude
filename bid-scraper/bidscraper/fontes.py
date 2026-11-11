"""Fontes externas de transferências (com valores) para completar a carreira dos atletas.

Fonte principal: base aberta *transfermarkt-datasets* (github.com/dcaribou/transfermarkt-datasets,
também publicada no Kaggle como davidcariboo/player-scores), tabelas players, clubs e transfers.
Qualquer outra fonte (ogol, API Futebol, Base dos Dados, planilha própria) entra pelo
importador genérico de CSV (`importar_csv`).

Os valores vêm de estimativas/imprensa, não de contratos: servem para priorizar casos,
não para instruir cobrança sem conferência documental.
"""
from __future__ import annotations

import csv
import gzip
import io
import logging
import re
import sqlite3
import zipfile
from datetime import date, timedelta
from pathlib import Path

from .creditos import _d, _n, clube_key
from .db import make_hash

log = logging.getLogger("bid.fontes")

TM_BASE = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
TM_ARQUIVOS = ("players", "clubs", "transfers")

SCHEMA = """
CREATE TABLE IF NOT EXISTS fonte_atletas (
    fonte TEXT NOT NULL,
    id_fonte TEXT NOT NULL,
    nome TEXT,
    nome_key TEXT,
    nascimento TEXT,
    nacionalidade TEXT,
    clube_atual TEXT,
    PRIMARY KEY (fonte, id_fonte)
);
CREATE INDEX IF NOT EXISTS ix_fonte_atletas_nasc ON fonte_atletas(nascimento);
CREATE TABLE IF NOT EXISTS fonte_clubes (
    fonte TEXT NOT NULL,
    id_fonte TEXT NOT NULL,
    nome TEXT,
    liga TEXT,
    pais TEXT,
    PRIMARY KEY (fonte, id_fonte)
);
CREATE TABLE IF NOT EXISTS transferencias (
    hash TEXT PRIMARY KEY,
    fonte TEXT NOT NULL,
    id_fonte TEXT NOT NULL,          -- id do atleta na fonte
    atleta_nome TEXT,
    data TEXT,
    temporada TEXT,
    clube_origem TEXT,
    clube_destino TEXT,
    origem_id TEXT,
    destino_id TEXT,
    pais_origem TEXT,
    pais_destino TEXT,
    valor_eur REAL,                  -- NULL = desconhecido; 0 = sem custo/empréstimo
    valor_mercado_eur REAL
);
CREATE INDEX IF NOT EXISTS ix_transf_atleta ON transferencias(fonte, id_fonte);
CREATE INDEX IF NOT EXISTS ix_transf_data ON transferencias(data);
CREATE TABLE IF NOT EXISTS atleta_fontes (
    id_cbf TEXT NOT NULL,
    fonte TEXT NOT NULL,
    id_fonte TEXT NOT NULL,
    metodo TEXT,                     -- nome+nascimento | manual
    PRIMARY KEY (id_cbf, fonte)
);
"""

SEM_CLUBE = {"without club", "sem clube", "retired", "fim de carreira", "career break",
             "pausa na carreira", "unknown", "desconhecido", "ban", "suspenso", ""}
_BASE_RE = re.compile(
    r"\b(u ?\d{2}|sub ?\d{2}|under ?\d{2}|youth|yth|juvenil|juniores|junior team|jgd|"
    r"academy|base|b|ii|reserves|reservas|aspirantes)\b")


def garantir_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)


def sem_clube(nome: str | None) -> bool:
    return _n(nome).strip() in SEM_CLUBE


def clube_matriz(nome: str | None) -> str:
    """Chave do clube sem o sufixo de categoria de base/time B (Flamengo U20 -> flamengo)."""
    k = _BASE_RE.sub(" ", clube_key(nome))
    return re.sub(r"\s+", " ", k).strip() or clube_key(nome)


def nome_key(nome: str | None) -> str:
    return re.sub(r"\s+", " ", _n(nome)).strip()


def pais_da_liga(liga: str | None) -> str | None:
    """'BRA1' -> 'BRA', 'ES1' -> 'ES', 'GB1' -> 'GB' (código de país do Transfermarkt)."""
    m = re.match(r"[A-Za-z]+", liga or "")
    return m.group(0).upper() if m else None


def _num(v) -> float | None:
    if v is None or str(v).strip() in ("", "-", "?", "nan", "NULL", "None"):
        return None
    s = str(v).strip().replace("€", "").replace(" ", "")
    mult = 1.0
    low = s.lower()
    for suf, m in (("mi", 1e6), ("mil", 1e3), ("m", 1e6), ("k", 1e3)):
        if low.endswith(suf):
            mult, s = m, s[: -len(suf)]
            break
    if "," in s and "." in s:      # 1.234.567,89
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s) * mult
    except ValueError:
        return None


# --------------------------------------------------------------------------- leitura
def _abrir_csv(origem: Path | bytes, nome: str | None = None):
    """Devolve um DictReader para .csv, .csv.gz ou um membro de .zip."""
    if isinstance(origem, bytes):
        raw = origem
    else:
        raw = Path(origem).read_bytes()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    texto = raw.decode("utf-8-sig", errors="replace")
    amostra = texto[:4096]
    delim = ";" if amostra.count(";") > amostra.count(",") else ","
    return csv.DictReader(io.StringIO(texto), delimiter=delim)


def _localizar(origem: str | None, tabela: str, baixar) -> bytes | Path | None:
    """Acha a tabela em: pasta local, .zip (Kaggle) ou baixa do repositório público."""
    if origem:
        p = Path(origem)
        if p.is_file() and p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p) as z:
                for n in z.namelist():
                    if Path(n).name in (f"{tabela}.csv", f"{tabela}.csv.gz"):
                        return z.read(n)
            return None
        if p.is_dir():
            for n in (f"{tabela}.csv", f"{tabela}.csv.gz"):
                if (p / n).exists():
                    return p / n
            return None
        raise FileNotFoundError(f"origem não encontrada: {origem}")
    return baixar(f"{TM_BASE}/{tabela}.csv.gz")


def _baixar(url: str) -> bytes:
    import requests
    log.info("Baixando %s", url)
    r = requests.get(url, timeout=300, headers={"User-Agent": "bidscraper"})
    r.raise_for_status()
    return r.content


def importar_transfermarkt(conn: sqlite3.Connection, origem: str | None = None,
                           baixar=_baixar) -> dict:
    """Importa players, clubs e transfers do transfermarkt-datasets.

    origem: pasta com os CSV, o .zip baixado do Kaggle, ou None para baixar da fonte pública.
    """
    garantir_schema(conn)
    stats = {"atletas": 0, "clubes": 0, "transferencias": 0}
    paises: dict[str, str | None] = {}

    src = _localizar(origem, "clubs", baixar)
    if src is not None:
        for r in _abrir_csv(src):
            cid = str(r.get("club_id") or "").strip()
            if not cid:
                continue
            liga = r.get("domestic_competition_id")
            paises[cid] = pais_da_liga(liga)
            conn.execute("INSERT OR REPLACE INTO fonte_clubes VALUES ('tm',?,?,?,?)",
                         (cid, r.get("name"), liga, paises[cid]))
            stats["clubes"] += 1

    src = _localizar(origem, "players", baixar)
    if src is None:
        raise FileNotFoundError("players.csv não encontrado na origem informada")
    for r in _abrir_csv(src):
        pid = str(r.get("player_id") or "").strip()
        if not pid:
            continue
        nome = r.get("name") or " ".join(filter(None, (r.get("first_name"), r.get("last_name"))))
        conn.execute("INSERT OR REPLACE INTO fonte_atletas VALUES ('tm',?,?,?,?,?,?)",
                     (pid, nome, nome_key(nome), (r.get("date_of_birth") or "")[:10] or None,
                      r.get("country_of_citizenship"), r.get("current_club_name")))
        stats["atletas"] += 1

    src = _localizar(origem, "transfers", baixar)
    if src is None:
        raise FileNotFoundError("transfers.csv não encontrado na origem informada")
    for r in _abrir_csv(src):
        if _inserir_transferencia(conn, "tm", {
            "id_fonte": r.get("player_id"), "atleta_nome": r.get("player_name"),
            "data": r.get("transfer_date"), "temporada": r.get("transfer_season"),
            "clube_origem": r.get("from_club_name"), "clube_destino": r.get("to_club_name"),
            "origem_id": r.get("from_club_id"), "destino_id": r.get("to_club_id"),
            "valor_eur": _num(r.get("transfer_fee")),
            "valor_mercado_eur": _num(r.get("market_value_in_eur")),
        }, paises):
            stats["transferencias"] += 1
    conn.commit()
    return stats


def _inserir_transferencia(conn, fonte: str, t: dict, paises: dict | None = None) -> bool:
    pid = str(t.get("id_fonte") or "").strip()
    data = (t.get("data") or "")[:10]
    if not pid or not _d(data):
        return False
    oid = str(t.get("origem_id") or "").strip() or None
    did = str(t.get("destino_id") or "").strip() or None
    paises = paises or {}
    h = make_hash(fonte, pid, data, t.get("clube_origem"), t.get("clube_destino"))
    conn.execute(
        "INSERT OR REPLACE INTO transferencias VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (h, fonte, pid, t.get("atleta_nome"), data, t.get("temporada"),
         t.get("clube_origem"), t.get("clube_destino"), oid, did,
         t.get("pais_origem") or paises.get(oid), t.get("pais_destino") or paises.get(did),
         t.get("valor_eur"), t.get("valor_mercado_eur")))
    return True


CSV_SINONIMOS = {
    "atleta": ("atleta", "jogador", "nome", "player", "player_name"),
    "nascimento": ("nascimento", "data de nascimento", "data_nascimento", "date_of_birth", "dob"),
    "data": ("data", "data da transferencia", "data_transferencia", "transfer_date", "date"),
    "clube_origem": ("clube_origem", "origem", "clube de origem", "de", "from", "from_club_name"),
    "clube_destino": ("clube_destino", "destino", "clube de destino", "para", "to", "to_club_name"),
    "valor_eur": ("valor_eur", "valor", "taxa", "fee", "transfer_fee"),
    "pais_origem": ("pais_origem", "pais de origem"),
    "pais_destino": ("pais_destino", "pais de destino"),
    "id": ("id", "id_atleta", "player_id", "id_fonte"),
}


def importar_csv(conn: sqlite3.Connection, arquivo: str, fonte: str) -> dict:
    """Importa transferências de um CSV qualquer (colunas reconhecidas por nome).

    Mínimo: atleta, data, clube_destino. Recomendado: nascimento, clube_origem, valor (EUR).
    Datas em AAAA-MM-DD ou DD/MM/AAAA.
    """
    garantir_schema(conn)
    rd = _abrir_csv(Path(arquivo))
    mapa = {}
    for col in rd.fieldnames or []:
        k = nome_key(col.replace("_", " "))
        for campo, sins in CSV_SINONIMOS.items():
            if k in {nome_key(s.replace("_", " ")) for s in sins}:
                mapa.setdefault(campo, col)
    falta = [c for c in ("atleta", "data", "clube_destino") if c not in mapa]
    if falta:
        raise ValueError(f"colunas obrigatórias ausentes: {falta}; encontradas: {rd.fieldnames}")
    n = 0
    for r in rd:
        g = lambda c: (r.get(mapa[c]) or "").strip() if c in mapa else ""
        nasc = _data_iso(g("nascimento"))
        pid = g("id") or "n:" + make_hash(nome_key(g("atleta")), nasc)[:12]
        conn.execute(
            """INSERT INTO fonte_atletas(fonte,id_fonte,nome,nome_key,nascimento) VALUES (?,?,?,?,?)
               ON CONFLICT(fonte,id_fonte) DO UPDATE SET
                 nascimento=COALESCE(excluded.nascimento,nascimento)""",
            (fonte, pid, g("atleta"), nome_key(g("atleta")), nasc))
        if _inserir_transferencia(conn, fonte, {
            "id_fonte": pid, "atleta_nome": g("atleta"), "data": _data_iso(g("data")),
            "clube_origem": g("clube_origem") or None, "clube_destino": g("clube_destino"),
            "valor_eur": _num(g("valor_eur")),
            "pais_origem": g("pais_origem") or None, "pais_destino": g("pais_destino") or None,
        }):
            n += 1
    conn.commit()
    return {"transferencias": n}


def _data_iso(s: str) -> str | None:
    s = (s or "").strip()
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        s = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return s[:10] if _d(s) else None


# --------------------------------------------------------------------- vínculo BID x fonte
def vincular(conn: sqlite3.Connection, fonte: str = "tm") -> dict:
    """Liga atletas do BID aos da fonte: mesma data de nascimento e nomes compatíveis.

    O BID traz o nome civil completo e o Transfermarkt o nome esportivo; aceita-se quando
    todas as palavras de um nome estão contidas no outro e há um único candidato.
    """
    garantir_schema(conn)
    stats = {"vinculados": 0, "ambiguos": 0, "sem_correspondencia": 0}
    for a in conn.execute(
            """SELECT id_cbf, nome, nascimento FROM atletas WHERE nascimento IS NOT NULL
               AND id_cbf NOT IN (SELECT id_cbf FROM atleta_fontes WHERE fonte=?)""", (fonte,)).fetchall():
        toks = set(nome_key(a["nome"]).split())
        if not toks:
            continue
        cands = []
        for f in conn.execute("SELECT id_fonte, nome_key FROM fonte_atletas WHERE fonte=? AND nascimento=?",
                              (fonte, a["nascimento"][:10])):
            ft = set((f["nome_key"] or "").split())
            if ft and (ft <= toks or toks <= ft):
                cands.append(f["id_fonte"])
        if len(cands) == 1:
            conn.execute("INSERT OR REPLACE INTO atleta_fontes VALUES (?,?,?,?)",
                         (a["id_cbf"], fonte, cands[0], "nome+nascimento"))
            stats["vinculados"] += 1
        elif cands:
            stats["ambiguos"] += 1
        else:
            stats["sem_correspondencia"] += 1
    conn.commit()
    return stats


def vincular_manual(conn: sqlite3.Connection, id_cbf: str, id_fonte: str, fonte: str = "tm") -> None:
    garantir_schema(conn)
    conn.execute("INSERT OR REPLACE INTO atleta_fontes VALUES (?,?,?,?)", (id_cbf, fonte, id_fonte, "manual"))
    conn.commit()


# ------------------------------------------------------------------------------ carreira
def periodos_da_fonte(transfs: list[dict], hoje: date | None = None,
                      nasc: date | None = None, presumir_inicio: bool = False) -> list[dict]:
    """Converte a lista de transferências em períodos por clube.

    Cada transferência abre um período no clube de destino até a transferência seguinte.
    Empréstimos contam para o clube onde o atleta esteve de fato registrado (como no RSTP).
    Com presumir_inicio, o clube de origem da 1ª transferência é contado desde os 12 anos
    (hipótese a confirmar: a fonte não informa quando o atleta chegou a esse clube).
    """
    hoje = hoje or date.today()
    ts = sorted((t for t in transfs if _d(t.get("data"))), key=lambda t: t["data"])
    out: list[dict] = []
    if ts and presumir_inicio and nasc and not sem_clube(ts[0].get("clube_origem")):
        ini = nasc.replace(year=nasc.year + 12) if (nasc.month, nasc.day) != (2, 29) \
            else date(nasc.year + 12, 2, 28)
        if ini < _d(ts[0]["data"]):
            out.append({"clube": ts[0]["clube_origem"], "inicio": ini.isoformat(),
                        "fim": ts[0]["data"][:10], "tipo": "presumido", "fonte": ts[0].get("fonte", "")})
    for i, t in enumerate(ts):
        if sem_clube(t.get("clube_destino")):
            continue
        fim = ts[i + 1]["data"][:10] if i + 1 < len(ts) else hoje.isoformat()
        if fim > t["data"][:10]:
            out.append({"clube": t["clube_destino"], "inicio": t["data"][:10], "fim": fim,
                        "tipo": "registro", "fonte": t.get("fonte", "")})
    return out


def _subtrair(ini: date, fim: date, ocupados: list[tuple[date, date]]) -> list[tuple[date, date]]:
    livres = [(ini, fim)]
    for a, b in ocupados:
        novo = []
        for x, y in livres:
            if b <= x or a >= y:
                novo.append((x, y))
                continue
            if x < a:
                novo.append((x, a))
            if b < y:
                novo.append((b, y))
        livres = novo
    return livres


def carreira_unificada(vinculos_bid: list[dict], periodos_fonte: list[dict],
                       hoje: date | None = None) -> list[dict]:
    """BID tem prioridade; a fonte externa preenche apenas as lacunas sem registro no BID."""
    from .creditos import classificar
    hoje = hoje or date.today()
    out, ocupados = [], []
    for v in vinculos_bid:
        ini = _d(v.get("inicio"))
        if not ini or not v.get("clube") or classificar(v.get("tipo")) == "rescisao":
            continue
        fim = _d(v.get("fim")) or hoje
        if fim > ini:
            ocupados.append((ini, fim + timedelta(days=1)))  # fim do vínculo é inclusivo
            out.append({"clube": v["clube"], "inicio": ini.isoformat(), "fim": fim.isoformat(),
                        "tipo": v.get("tipo") or "", "fonte": "bid"})
    for p in periodos_fonte:
        ini, fim = _d(p["inicio"]), _d(p["fim"])
        for x, y in _subtrair(ini, fim, ocupados):
            if (y - x).days > 7:  # ignora folgas de poucos dias entre registros
                out.append({**p, "inicio": x.isoformat(), "fim": y.isoformat()})
    return sorted(out, key=lambda r: r["inicio"])


def transferencias_do_atleta(conn: sqlite3.Connection, fonte: str, id_fonte: str) -> list[dict]:
    return [dict(r) for r in conn.execute(
        "SELECT * FROM transferencias WHERE fonte=? AND id_fonte=? ORDER BY data", (fonte, id_fonte))]


def carreira(conn: sqlite3.Connection, id_cbf: str | None = None, fonte: str = "tm",
             id_fonte: str | None = None, presumir_inicio: bool = False) -> list[dict]:
    """Carreira consolidada de um atleta (por ID do BID e/ou ID na fonte externa)."""
    garantir_schema(conn)
    nasc = None
    vincs: list[dict] = []
    if id_cbf:
        a = conn.execute("SELECT nascimento FROM atletas WHERE id_cbf=?", (id_cbf,)).fetchone()
        nasc = _d(a["nascimento"]) if a else None
        vincs = [dict(r) for r in conn.execute("SELECT * FROM vinculos WHERE atleta_id=?", (id_cbf,))]
        if not id_fonte:
            l = conn.execute("SELECT id_fonte FROM atleta_fontes WHERE id_cbf=? AND fonte=?",
                             (id_cbf, fonte)).fetchone()
            id_fonte = l["id_fonte"] if l else None
    per: list[dict] = []
    if id_fonte:
        f = conn.execute("SELECT nascimento FROM fonte_atletas WHERE fonte=? AND id_fonte=?",
                         (fonte, id_fonte)).fetchone()
        nasc = nasc or (_d(f["nascimento"]) if f else None)
        per = periodos_da_fonte(transferencias_do_atleta(conn, fonte, id_fonte), nasc=nasc,
                                presumir_inicio=presumir_inicio)
    return carreira_unificada(vincs, per)
