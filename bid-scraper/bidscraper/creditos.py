"""Triagem de possíveis créditos: Compensação por Treinamento e Mecanismo de Solidariedade.

IMPORTANTE: gera *indícios* a partir do que o BID mostra (vínculos, datas, clubes). O BID
não traz valores de transferência, categoria do clube formador nem comprovação de formação,
então cada linha precisa de validação jurídica/documental antes de qualquer cobrança.

Regras aplicadas (FIFA RSTP, Anexos 4 e 5 – confira a versão vigente na data do fato):
  * Solidariedade: 5% da indenização paga ao clube vendedor, repassados aos clubes que
    registraram o atleta entre os 12 e 23 anos: 0,25% por ano de idade 12–15 e 0,5% por
    ano de idade 16–23.
  * Compensação por treinamento: devida aos clubes que formaram o atleta entre 12 e 21
    anos, quando ele assina o 1º contrato profissional ou é transferido antes do fim da
    temporada do seu 23º aniversário.
"""
from __future__ import annotations

import re
import sqlite3
import unicodedata
from dataclasses import dataclass, asdict
from datetime import date, timedelta

IDADE_SOL_MIN, IDADE_SOL_MAX = 12, 23
IDADE_TREINO_MIN, IDADE_TREINO_MAX = 12, 21


def _n(s: str | None) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9 ]", " ", s)


def clube_key(nome: str | None) -> str:
    """Normaliza nome de clube (sem acento/UF/pontuação) para comparar."""
    n = re.sub(r"\b(fc|ec|sc|ac|futebol clube|esporte clube|sociedade esportiva|se|ltda|saf|s a f)\b", " ", _n(nome))
    return re.sub(r"\s+", " ", n).strip()


def classificar(tipo: str | None) -> str:
    t = _n(tipo)
    if "emprest" in t:
        return "emprestimo"
    if "rescis" in t or "distrat" in t:
        return "rescisao"
    if "transfer" in t:
        return "transferencia"
    if "profission" in t and ("contrat" in t or "registr" in t or "inscri" in t):
        return "contrato_profissional"
    if "contrat" in t:
        return "contrato"
    if "amador" in t or "formac" in t or "base" in t:
        return "formacao"
    return "outro"


GATILHOS = {"transferencia", "contrato_profissional"}


def add_years(d: date, n: int) -> date:
    try:
        return d.replace(year=d.year + n)
    except ValueError:  # 29/02
        return d.replace(year=d.year + n, day=28)


def idade_em(nasc: date, d: date) -> int:
    return d.year - nasc.year - ((d.month, d.day) < (nasc.month, nasc.day))


def _d(s: str | None) -> date | None:
    try:
        return date.fromisoformat(s[:10]) if s else None
    except ValueError:
        return None


def clube_por_idade(nasc: date, vinculos: list[dict], hoje: date | None = None) -> dict[int, str]:
    """Para cada idade (12–23), o clube com mais dias de registro naquele ano de vida."""
    hoje = hoje or date.today()
    res: dict[int, str] = {}
    for idade in range(IDADE_SOL_MIN, IDADE_SOL_MAX + 1):
        a, b = add_years(nasc, idade), add_years(nasc, idade + 1)
        dias: dict[str, int] = {}
        nomes: dict[str, str] = {}
        for v in vinculos:
            if not v.get("clube"):
                continue
            if classificar(v.get("tipo")) in ("emprestimo", "rescisao"):
                continue
            ini = _d(v.get("inicio"))
            if not ini:
                continue
            fim = _d(v.get("fim")) or hoje
            ov = (min(fim, b) - max(ini, a)).days
            if ov > 0:
                k = clube_key(v["clube"])
                dias[k] = dias.get(k, 0) + ov
                nomes.setdefault(k, v["clube"])
        if dias:
            res[idade] = nomes[max(dias, key=dias.get)]
    return res


def pct_solidariedade(idade: int) -> float:
    return 0.25 if 12 <= idade <= 15 else 0.5 if 16 <= idade <= 23 else 0.0


@dataclass
class Indicio:
    atleta_id: str
    atleta: str
    nascimento: str
    evento_data: str
    evento_tipo: str
    categoria_evento: str
    idade_no_evento: int
    clube_destino: str
    clube_origem: str
    clube_formador: str
    idades_no_clube: str
    anos_formacao_12_15: int
    anos_formacao_16_21: int
    pct_solidariedade: float
    compensacao_treinamento: str
    solidariedade: str
    formador_e_vendedor: str
    observacoes: str


def analisar(conn: sqlite3.Connection, de: str | None = None, ate: str | None = None,
             clube_formador: str | None = None, clube_destino: str | None = None,
             atleta: str | None = None, so_com_historico: bool = True,
             pct_min: float = 0.0, incluir_vendedor: bool = False) -> list[Indicio]:
    sql = "SELECT * FROM eventos WHERE atleta_id IS NOT NULL"
    args: list = []
    if de:
        sql += " AND data_bid >= ?"; args.append(de)
    if ate:
        sql += " AND data_bid <= ?"; args.append(ate)
    if atleta:
        sql += " AND atleta_nome LIKE ?"; args.append(f"%{atleta}%")
    sql += " ORDER BY data_bid"
    out: list[Indicio] = []
    cache: dict[str, tuple[dict | None, list[dict]]] = {}
    for ev in conn.execute(sql, args).fetchall():
        cat = classificar(ev["tipo"])
        if cat not in GATILHOS:
            continue
        aid = ev["atleta_id"]
        if aid not in cache:
            a = conn.execute("SELECT * FROM atletas WHERE id_cbf=?", (aid,)).fetchone()
            v = [dict(r) for r in conn.execute("SELECT * FROM vinculos WHERE atleta_id=?", (aid,))]
            cache[aid] = (dict(a) if a else None, v)
        a, vincs = cache[aid]
        nasc = _d((a or {}).get("nascimento") or ev["nascimento"])
        if not nasc or (so_com_historico and not vincs):
            continue
        quando = _d(ev["inicio"]) or _d(ev["data_bid"])
        if not quando:
            continue
        idade_ev = idade_em(nasc, quando)
        por_idade = clube_por_idade(nasc, vincs)
        destino_k = clube_key(ev["clube"])
        origem_k = clube_key(ev["clube_origem"])
        grupos: dict[str, list[int]] = {}
        nomes: dict[str, str] = {}
        for idade, c in por_idade.items():
            k = clube_key(c)
            if k == destino_k:  # o clube que contrata não cobra de si mesmo
                continue
            grupos.setdefault(k, []).append(idade)
            nomes[k] = c
        for k, idades in grupos.items():
            nome = nomes[k]
            if clube_formador and clube_key(clube_formador) not in k:
                continue
            if clube_destino and clube_key(clube_destino) not in destino_k:
                continue
            vendedor = bool(origem_k) and k == origem_k
            if vendedor and not incluir_vendedor:
                continue
            a1215 = sum(1 for i in idades if 12 <= i <= 15)
            a1621 = sum(1 for i in idades if 16 <= i <= 21)
            pct = sum(pct_solidariedade(i) for i in idades)
            if pct < pct_min:
                continue
            treino = (a1215 + a1621 > 0) and idade_ev <= IDADE_TREINO_MAX + 2 and (
                cat == "contrato_profissional" or cat == "transferencia")
            obs = ["Valor da transferência não consta no BID: solidariedade = pct × valor pago ao vendedor."]
            if cat == "contrato_profissional":
                obs.append("Verificar se é o 1º contrato profissional (gatilho da compensação).")
            if vendedor:
                obs.append("Formador é o próprio clube vendedor (retém sua parte da indenização).")
            out.append(Indicio(
                atleta_id=aid, atleta=ev["atleta_nome"] or (a or {}).get("nome") or "",
                nascimento=nasc.isoformat(), evento_data=quando.isoformat(),
                evento_tipo=ev["tipo"] or "", categoria_evento=cat, idade_no_evento=idade_ev,
                clube_destino=ev["clube"] or "", clube_origem=ev["clube_origem"] or "",
                clube_formador=nome, idades_no_clube=",".join(map(str, sorted(idades))),
                anos_formacao_12_15=a1215, anos_formacao_16_21=a1621,
                pct_solidariedade=round(pct, 2),
                compensacao_treinamento="POSSÍVEL" if treino else "improvável (fora da faixa de idade)",
                solidariedade="POSSÍVEL" if pct > 0 else "não",
                formador_e_vendedor="sim" if vendedor else "não",
                observacoes=" ".join(obs)))
    return out


def to_rows(items: list[Indicio]) -> list[dict]:
    return [asdict(i) for i in items]
