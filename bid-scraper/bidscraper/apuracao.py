"""Apuração de clubes credores e devedores a partir das transferências com valor.

Cruza as transferências importadas (fontes.py) com a carreira consolidada do atleta
(BID + fonte externa) e aplica o FIFA RSTP:

  * Solidariedade (art. 21 e Anexo 5): 5% do valor pago, retidos pelo clube de DESTINO
    (devedor) e distribuídos aos clubes que registraram o atleta dos 12 aos 23 anos:
    0,25% do valor por ano de idade 12–15 e 0,5% por ano 16–23.
  * Compensação por treinamento (art. 20 e Anexo 4): devida pelo clube de destino quando o
    atleta é registrado como profissional pela 1ª vez (a todos os formadores) ou em
    transferência posterior até a temporada dos 23 anos (apenas ao clube anterior), por
    anos de formação entre 12 e 21 anos.

O resultado é uma estimativa para priorizar casos. Valores de imprensa/Transfermarkt não
são os do contrato; categoria do clube, renúncias, prazo de 2 anos para reclamar e o
regulamento vigente na data do fato precisam ser conferidos caso a caso.
"""
from __future__ import annotations

import sqlite3
from dataclasses import asdict, dataclass
from datetime import date

from . import fontes
from .creditos import _d, add_years, idade_em, pct_solidariedade

PRAZO_ANOS = 2  # prazo para reclamar perante a FIFA, contado do fato gerador


@dataclass
class Credito:
    tipo: str                    # solidariedade | compensacao_treinamento
    atleta: str
    nascimento: str
    id_cbf: str
    fonte: str
    id_fonte: str
    data_transferencia: str
    idade_na_transferencia: int
    clube_devedor: str
    clube_vendedor: str
    clube_credor: str
    idades_no_credor: str
    anos_no_credor: float
    pct_do_valor: float
    valor_transferencia_eur: float | None
    valor_credito_eur: float | None
    ambito: str                  # internacional | nacional | indefinido
    base_da_carreira: str        # bid | fonte | bid+fonte
    limite_para_reclamar: str
    situacao_prazo: str
    credor_e_vendedor: str
    observacoes: str


def clubes_por_idade(nasc: date, periodos: list[dict], ate: date) -> tuple[dict[str, dict[int, float]], dict[str, dict]]:
    """Fração de cada ano de idade (12–23, até `ate`) que o atleta passou em cada clube.

    Devolve ({chave_clube: {idade: fração do ano}}, {chave_clube: info}). Base e time B
    contam para o clube principal; o rateio é proporcional aos dias (pro rata).
    """
    fr: dict[str, dict[int, float]] = {}
    info: dict[str, dict] = {}
    for idade in range(12, 24):
        a, fim_ano = add_years(nasc, idade), add_years(nasc, idade + 1)
        b = min(fim_ano, ate)
        if b <= a:
            break
        dias: dict[str, int] = {}
        for p in periodos:
            ini, fim = _d(p.get("inicio")), _d(p.get("fim"))
            if not ini or not fim or fontes.sem_clube(p.get("clube")):
                continue
            ov = (min(fim, b) - max(ini, a)).days
            if ov > 0:
                k = fontes.clube_matriz(p["clube"])
                dias[k] = dias.get(k, 0) + ov
                d = info.setdefault(k, {"clube": p["clube"], "fontes": set(), "presumido": False})
                if len(p["clube"]) < len(d["clube"]):
                    d["clube"] = p["clube"]  # nome mais curto = clube principal
                d["fontes"].add("bid" if p.get("fonte") == "bid" else "fonte")
                d["presumido"] |= p.get("tipo") == "presumido"
        base = max((fim_ano - a).days, sum(dias.values()))  # sobreposições não passam de 100%
        for k, n in dias.items():
            fr.setdefault(k, {})[idade] = n / base
    return fr, info


def _ambito(t: dict) -> str:
    o, d = t.get("pais_origem"), t.get("pais_destino")
    if o and d:
        return "internacional" if o != d else "nacional"
    return "indefinido"


def apurar(conn: sqlite3.Connection, de: str | None = None, ate: str | None = None,
           credor: str | None = None, devedor: str | None = None, atleta: str | None = None,
           valor_min: float = 0.0, ambito: str | None = None, incluir_vendedor: bool = False,
           presumir_inicio: bool = False, custo_anual: float | None = None,
           custo_anual_12_15: float | None = None, tipos: tuple[str, ...] = ("solidariedade", "compensacao_treinamento"),
           hoje: date | None = None) -> list[Credito]:
    fontes.garantir_schema(conn)
    hoje = hoje or date.today()
    sql, args = "SELECT * FROM transferencias WHERE 1=1", []
    for cond, val in (("data >= ?", de), ("data <= ?", ate),
                      ("atleta_nome LIKE ?", f"%{atleta}%" if atleta else None)):
        if val:
            sql += f" AND {cond}"; args.append(val)
    sql += " ORDER BY data"
    cache: dict[tuple, tuple] = {}
    out: list[Credito] = []
    for t in map(dict, conn.execute(sql, args).fetchall()):
        if fontes.sem_clube(t["clube_destino"]):
            continue
        amb = _ambito(t)
        if ambito and amb != ambito:
            continue
        dest_k = fontes.clube_matriz(t["clube_destino"])
        orig_k = fontes.clube_matriz(t["clube_origem"]) if not fontes.sem_clube(t["clube_origem"]) else ""
        if dest_k == orig_k:  # promoção interna (base -> profissional): não há devedor
            continue
        if devedor and fontes.clube_matriz(devedor) not in dest_k:
            continue
        chave = (t["fonte"], t["id_fonte"])
        if chave not in cache:
            f = conn.execute("SELECT * FROM fonte_atletas WHERE fonte=? AND id_fonte=?", chave).fetchone()
            l = conn.execute("SELECT id_cbf FROM atleta_fontes WHERE fonte=? AND id_fonte=?", chave).fetchone()
            id_cbf = l["id_cbf"] if l else ""
            nasc = _d(f["nascimento"]) if f else None
            if id_cbf and not nasc:
                a = conn.execute("SELECT nascimento FROM atletas WHERE id_cbf=?", (id_cbf,)).fetchone()
                nasc = _d(a["nascimento"]) if a else None
            car = fontes.carreira(conn, id_cbf or None, t["fonte"], t["id_fonte"], presumir_inicio)
            cache[chave] = (id_cbf, nasc, car, (f["nome"] if f else None))
        id_cbf, nasc, car, nome = cache[chave]
        quando = _d(t["data"])
        if not nasc or not quando:
            continue
        idade = idade_em(nasc, quando)
        grupos, info = clubes_por_idade(nasc, car, quando)
        limite = add_years(quando, PRAZO_ANOS)
        prazo = "dentro do prazo" if limite >= hoje else "prazo de 2 anos possivelmente esgotado"
        valor = t["valor_eur"]

        def linha(tipo, k, fr, pct, credito, obs):
            d = info[k]
            if d["presumido"]:
                obs = obs + ["Período no 1º clube é PRESUMIDO desde os 12 anos: confirmar registros."]
            if amb == "nacional":
                obs = obs + ["Transferência nacional: RSTP só se o credor for de outra associação; "
                             "entre clubes brasileiros vale o regulamento da CBF (RNRTAF)."]
            elif amb == "indefinido":
                obs = obs + ["País de um dos clubes não identificado: confirmar se é internacional."]
            out.append(Credito(
                tipo=tipo, atleta=t["atleta_nome"] or nome or "", nascimento=nasc.isoformat(),
                id_cbf=id_cbf, fonte=t["fonte"], id_fonte=t["id_fonte"],
                data_transferencia=quando.isoformat(), idade_na_transferencia=idade,
                clube_devedor=t["clube_destino"], clube_vendedor=t["clube_origem"] or "",
                clube_credor=d["clube"], idades_no_credor=",".join(map(str, sorted(fr))),
                anos_no_credor=round(sum(fr.values()), 2),
                pct_do_valor=round(pct, 3), valor_transferencia_eur=valor,
                valor_credito_eur=None if credito is None else round(credito, 2),
                ambito=amb, base_da_carreira="+".join(sorted(d["fontes"])),
                limite_para_reclamar=limite.isoformat(),
                situacao_prazo=prazo, credor_e_vendedor="sim" if k == orig_k else "não",
                observacoes=" ".join(obs)))

        for k, fr in grupos.items():
            if k == dest_k:
                continue
            if credor and fontes.clube_matriz(credor) not in k:
                continue
            vendedor = bool(orig_k) and k == orig_k
            # --- solidariedade: exige valor pago
            if "solidariedade" in tipos and valor and valor > 0 and valor >= valor_min \
                    and (incluir_vendedor or not vendedor):
                pct = sum(pct_solidariedade(i) * f for i, f in fr.items())
                obs = ["Valor da transferência é estimativa pública: conferir o valor contratual."]
                if vendedor:
                    obs.append("Credor é o próprio vendedor: sua parte já fica retida no preço.")
                linha("solidariedade", k, fr, pct, valor * pct / 100, obs)
            # --- compensação por treinamento: até a temporada dos 23 anos, formação 12–21
            anos = {i: f for i, f in fr.items() if 12 <= i <= 21}
            if "compensacao_treinamento" in tipos and anos and idade <= 23 and valor_min <= 0:
                a1215 = sum(f for i, f in anos.items() if i <= 15)
                a1621 = sum(anos.values()) - a1215
                est = None
                if custo_anual is not None:
                    est = a1621 * custo_anual + a1215 * (
                        custo_anual_12_15 if custo_anual_12_15 is not None else custo_anual)
                obs = [f"Anos de formação: {a1215:.2f} (12–15) e {a1621:.2f} (16–21)."]
                if vendedor:
                    obs.append("Clube anterior: credor em transferência subsequente e no 1º registro profissional.")
                else:
                    obs.append("Formador anterior ao vendedor: devido apenas se este for o 1º registro "
                               "como profissional do atleta.")
                obs.append("Valor depende da categoria do clube de destino (circular FIFA de custos de "
                           "treinamento); não é devida a clube categoria 4 nem em empréstimo.")
                linha("compensacao_treinamento", k, anos, 0.0, est, obs)
    return out


def to_rows(items: list[Credito]) -> list[dict]:
    return [asdict(i) for i in items]


def resumo(items: list[Credito]) -> list[dict]:
    """Total por par credor × devedor (para montar a carteira de cobrança)."""
    ag: dict[tuple, dict] = {}
    for c in items:
        k = (c.clube_credor, c.clube_devedor, c.tipo)
        r = ag.setdefault(k, {"clube_credor": c.clube_credor, "clube_devedor": c.clube_devedor,
                              "tipo": c.tipo, "casos": 0, "atletas": set(),
                              "total_estimado_eur": 0.0, "casos_dentro_do_prazo": 0})
        r["casos"] += 1
        r["atletas"].add(c.atleta)
        r["total_estimado_eur"] += c.valor_credito_eur or 0.0
        r["casos_dentro_do_prazo"] += c.situacao_prazo == "dentro do prazo"
    rows = []
    for r in ag.values():
        r["atletas"] = ", ".join(sorted(r["atletas"]))
        r["total_estimado_eur"] = round(r["total_estimado_eur"], 2)
        rows.append(r)
    return sorted(rows, key=lambda r: -r["total_estimado_eur"])
