"""Relação de todos os casos de clubes pequenos, do maior para o menor crédito gerado."""
import csv, sys
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
rows = list(csv.DictReader(open(sys.argv[1], encoding="utf-8-sig"), delimiter=";"))
rows.sort(key=lambda c: -float(c["valor_credito_eur"] or 0))
def e(v):
    return "–" if v in ("", None) else "€ " + f"{float(v):,.0f}".replace(",", ".")
def dt(s): return f"{s[8:10]}/{s[5:7]}/{s[:4]}" if s else ""
TIPO = {"solidariedade": "Solidariedade", "compensacao_treinamento": "Compensação"}
doc = Document()
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10)
s = doc.sections[0]; s.orientation = WD_ORIENT.LANDSCAPE
s.page_width, s.page_height = s.page_height, s.page_width
for m in ("left_margin", "right_margin", "top_margin", "bottom_margin"): setattr(s, m, Cm(1.5))
doc.add_heading("Relação de casos – clubes pequenos", 0)
tot = sum(float(c["valor_credito_eur"] or 0) for c in rows)
doc.add_paragraph(f"{len(rows)} casos, ordenados do maior para o menor crédito gerado. Soma: {e(tot)}. "
    "Clube pequeno: clube brasileiro que não disputou a Série A nem a Série B de 2025.")
for t in ["Crédito gerado não é crédito em aberto: nenhum caso foi verificado quanto a pagamento. Cada um precisa ser "
          "conferido com o clube credor (extrato da FIFA Clearing House) antes de qualquer cobrança.",
          "Valores calculados sobre a carreira como consta no Transfermarkt e o valor de transferência divulgado; "
          "o valor contratual e a carreira completa (BID) podem alterar o crédito.",
          "Compensação por treinamento estimada a € 60 mil por ano de formação (16–21) e € 10 mil (12–15); o valor real "
          "depende da categoria do clube de destino.",
          "Transferências entre clubes brasileiros seguem o regulamento da CBF, não o da FIFA.",
          "Prazo: 2 anos contados da transferência; casos com prazo vencendo em breve estão na coluna Limite."]:
    doc.add_paragraph(t, style="List Bullet")
cab = ["#", "Tipo", "Atleta", "Data", "Transferência (vendedor → devedor)", "Valor da transf.",
       "Clube credor", "Idades no credor", "Crédito gerado", "Âmbito", "Limite"]
larg = [1.0, 2.0, 2.7, 1.8, 4.6, 2.0, 2.8, 1.9, 2.0, 2.2, 1.8]
t = doc.add_table(rows=1, cols=len(cab)); t.style = "Light Grid Accent 1"; t.autofit = False
for i, col in enumerate(t.columns): col.width = Cm(larg[i])
for i, c in enumerate(cab): t.rows[0].cells[i].text = c
for n, c in enumerate(rows, 1):
    v = [str(n), TIPO.get(c["tipo"], c["tipo"]), c["atleta"], dt(c["data_transferencia"]),
         f'{c["clube_vendedor"]} → {c["clube_devedor"]}', (e(c["valor_transferencia_eur"]) if float(c["valor_transferencia_eur"] or 0) else "sem valor"),
         c["clube_credor"], c["idades_no_credor"].replace(",", ", "), e(c["valor_credito_eur"]),
         c["ambito"], dt(c["limite_para_reclamar"])]
    cs = t.add_row().cells
    for i, x in enumerate(v):
        cs[i].text = x
        if i in (0, 5, 8): cs[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
tr = t.rows[0]._tr.get_or_add_trPr(); h = OxmlElement("w:tblHeader"); h.set(qn("w:val"), "true"); tr.append(h)
for row in t.rows:
    for i, cell in enumerate(row.cells):
        cell.width = Cm(larg[i])
        for p in cell.paragraphs:
            for r in p.runs: r.font.size = Pt(8)
doc.save(sys.argv[2])
print(len(rows), e(tot))
