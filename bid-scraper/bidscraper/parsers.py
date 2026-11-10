"""Extração tolerante de dados: tabelas HTML, listas de definição e JSON.

O layout do site pode mudar, então tudo é guiado por *nomes de colunas* (com sinônimos),
não por posição. Colunas desconhecidas vão para `extra`.
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date, datetime

from bs4 import BeautifulSoup

# campo canônico -> sinônimos de cabeçalho (já normalizados: sem acento, minúsculo)
SYNONYMS: dict[str, tuple[str, ...]] = {
    "atleta_nome": ("atleta", "nome", "nome do atleta", "jogador", "nome completo", "apelido"),
    "nascimento": ("nascimento", "data de nascimento", "data nascimento", "nasc", "dt nascimento"),
    "clube": ("clube", "clube destino", "destino", "clube atual", "entidade", "clube de destino",
              "entidade desportiva"),
    "clube_origem": ("clube origem", "origem", "clube de origem", "clube anterior"),
    "tipo": ("tipo", "tipo de operacao", "operacao", "movimentacao", "evento", "tipo de registro",
             "tipo de contrato", "situacao", "tipo de movimentacao", "vinculo", "tipo de vinculo"),
    "data_evento": ("data", "data publicacao", "data de publicacao", "data de registro",
                    "data registro", "publicacao", "data da operacao", "data bid", "data de inscricao"),
    "inicio": ("inicio", "data inicio", "data de inicio", "inicio do contrato", "vigencia inicio",
               "inicio vigencia", "data inicial"),
    "fim": ("fim", "termino", "data fim", "data de termino", "fim do contrato", "vencimento",
            "data final", "vigencia fim", "termino do contrato", "data de vencimento"),
    "federacao": ("federacao", "uf", "federacao de origem", "federacao estadual"),
    "categoria": ("categoria", "divisao", "serie"),
}
_REV = {syn: field for field, syns in SYNONYMS.items() for syn in syns}


def norm(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().lower().rstrip(":")


def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


_DATE_RES = (
    (re.compile(r"(\d{2})/(\d{2})/(\d{4})"), "dmy"),
    (re.compile(r"(\d{4})-(\d{2})-(\d{2})"), "ymd"),
    (re.compile(r"(\d{2})-(\d{2})-(\d{4})"), "dmy"),
)


def parse_date(s: str | None) -> str | None:
    """Devolve data ISO (AAAA-MM-DD) ou None."""
    s = clean(s)
    for rx, order in _DATE_RES:
        m = rx.search(s)
        if m:
            a, b, c = map(int, m.groups())
            try:
                d = date(c, b, a) if order == "dmy" else date(a, b, c)
            except ValueError:
                return None
            return d.isoformat()
    return None


def _map_header(h: str) -> str | None:
    n = norm(h)
    if n in _REV:
        return _REV[n]
    # correspondência parcial (ex.: "Clube de Destino (UF)")
    for syn, field in sorted(_REV.items(), key=lambda kv: -len(kv[0])):
        if syn in n and len(syn) > 3:
            return field
    return None


def parse_tables(html: str, id_regex: str | None = None) -> list[dict]:
    """Lê todas as tabelas com cabeçalho e devolve linhas com campos canônicos.

    Cada linha: {campo_canonico: valor, ..., 'atleta_id': str|None, 'extra': {...}}
    """
    soup = BeautifulSoup(html, "lxml")
    idrx = re.compile(id_regex) if id_regex else None
    rows_out: list[dict] = []
    for table in soup.find_all("table"):
        trs = table.find_all("tr")
        if not trs:
            continue
        header_cells = None
        start = 0
        for i, tr in enumerate(trs[:5]):
            ths = tr.find_all("th")
            if ths:
                header_cells, start = ths, i + 1
                break
        if header_cells is None:  # sem <th>: usa a 1ª linha se parecer cabeçalho
            first = [clean(c.get_text()) for c in trs[0].find_all("td")]
            if first and sum(1 for h in first if _map_header(h)) >= 2:
                header_cells, start = trs[0].find_all("td"), 1
            else:
                continue
        headers = [clean(c.get_text()) for c in header_cells]
        fields = [_map_header(h) for h in headers]
        if sum(1 for f in fields if f) < 2:
            continue
        for tr in trs[start:]:
            tds = tr.find_all("td")
            if len(tds) < 2:
                continue
            row: dict = {"extra": {}, "atleta_id": None}
            for idx, td in enumerate(tds[: len(headers)]):
                val = clean(td.get_text(" "))
                if not val:
                    continue
                field = fields[idx]
                if field and field not in row:
                    row[field] = val
                elif not field:
                    row["extra"][headers[idx]] = val
                if idrx and not row["atleta_id"]:
                    for a in td.find_all("a", href=True):
                        m = idrx.search(a["href"])
                        if m:
                            row["atleta_id"] = m.group(1)
                            break
            if len(row) > 2 or row["extra"]:
                for k in ("nascimento", "data_evento", "inicio", "fim"):
                    if k in row:
                        row[k] = parse_date(row[k]) or row[k]
                rows_out.append(row)
    return rows_out


_LABEL_FIELDS = {
    "nome": "nome", "nome completo": "nome", "atleta": "nome",
    "data de nascimento": "nascimento", "nascimento": "nascimento",
    "naturalidade": "naturalidade", "nacionalidade": "nacionalidade",
    "apelido": "apelido", "posicao": "posicao",
}


def parse_profile(html: str) -> dict:
    """Dados cadastrais do atleta (pares rótulo:valor em <dl>, tabelas de 2 colunas ou texto)."""
    soup = BeautifulSoup(html, "lxml")
    out: dict = {}

    def put(label: str, value: str) -> None:
        f = _LABEL_FIELDS.get(norm(label))
        if f and value and f not in out:
            out[f] = parse_date(value) or value if f == "nascimento" else value

    for dt in soup.find_all("dt"):
        dd = dt.find_next_sibling("dd")
        if dd:
            put(clean(dt.get_text()), clean(dd.get_text()))
    for tr in soup.find_all("tr"):
        cells = tr.find_all(["th", "td"])
        if len(cells) == 2:
            put(clean(cells[0].get_text()), clean(cells[1].get_text()))
    text = soup.get_text("\n")
    for m in re.finditer(r"^\s*([A-Za-zÀ-ú ]{3,30}):\s*(.+?)\s*$", text, re.M):
        put(m.group(1), m.group(2))
    return out


def parse_json_rows(body: str) -> list[dict] | None:
    """Se a resposta for JSON, devolve linhas canônicas; senão None."""
    body = body.strip()
    if not body or body[0] not in "[{":
        return None
    try:
        data = json.loads(body)
    except ValueError:
        return None
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                data = v
                break
        else:
            data = []
    rows = []
    for item in data:
        if not isinstance(item, dict):
            continue
        row: dict = {"extra": {}, "atleta_id": None}
        for k, v in item.items():
            f = _map_header(k)
            if k.lower() in ("id", "idatleta", "atleta_id", "id_atleta") and v is not None:
                row["atleta_id"] = str(v)
            elif f and f not in row and v not in (None, ""):
                row[f] = parse_date(str(v)) or str(v) if f in ("nascimento", "data_evento", "inicio", "fim") else str(v)
            elif v not in (None, ""):
                row["extra"][k] = v
        rows.append(row)
    return rows


def has_next_page(html: str) -> bool:
    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a"):
        t = norm(a.get_text())
        if t in ("proxima", "proximo", ">", ">>", "next") or "proxima" in t:
            cls = " ".join(a.get("class", [])) + " ".join(a.parent.get("class", []) if a.parent else [])
            if "disabled" not in cls and a.get("href", "#") not in ("", "#"):
                return True
    return False
