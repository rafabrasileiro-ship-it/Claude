"""Gera o docx das três estimativas a partir de res.pkl (saída de estimativa_calc.py)."""
import pickle, sys, csv, collections
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
res = pickle.load(open(sys.argv[1], "rb")); saida = sys.argv[2]; csv_out = sys.argv[3]
def soma(tag, cls, dst):
    return sum(c["valor_credito_eur"] for c in res[tag] if c["cls"] in cls and c["dst"] in dst)
BR = ("BRA", "provBRA")
def tc(custo):
    return sum(c["valor_credito_eur"] for c in res[f"tc_{custo}"] if "Santos Laguna" not in c["clube_devedor"])
b_int, b_ind, b_nac = soma("sol_base", BR, ("ext",)), soma("sol_base", BR, ("indef",)), soma("sol_base", BR, ("BRA",))
p_int, p_ind, p_nac = soma("sol_pres", BR, ("ext",)), soma("sol_pres", BR, ("indef",)), soma("sol_pres", BR, ("BRA",))
cen = [
 ("Pessimista", b_int, 0.0, 0.0, 0.70, tc(30000), 0.5, 0.20),
 ("Realista",   b_int, b_ind, b_nac, 0.85, tc(60000), 0.5, 0.36),
 ("Otimista",   p_int, p_ind, p_nac, 1.00, tc(90000), 1.0, 0.55),
]
def e(v): return "€ " + f"{v:,.0f}".replace(",", ".")
linhas = []
for n, i, d, na, f, t, ft, pend in cen:
    sol = (i + d + na) * f; ct = t * ft; bruto = sol + ct
    linhas.append((n, i, d, na, f, sol, t, ft, ct, bruto, pend, bruto * pend))
    print(n, e(sol), e(ct), e(bruto), e(bruto * pend))
casos = [c for c in res["sol_base"] if c["cls"] in BR] + [c for c in res["tc_60000"] if "Santos Laguna" not in c["clube_devedor"]]
casos.sort(key=lambda c: -(c["valor_credito_eur"] or 0))
with open(csv_out, "w", newline="", encoding="utf-8-sig") as fh:
    w = csv.DictWriter(fh, fieldnames=list(casos[0].keys()), delimiter=";"); w.writeheader(); w.writerows(casos)
doc = Document()
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(11)
for s in doc.sections: s.left_margin = s.right_margin = Cm(2.2)
def tabela(cab, rows, larg=None):
    t = doc.add_table(rows=1, cols=len(cab)); t.style = "Light Grid Accent 1"
    for i, c in enumerate(cab):
        t.rows[0].cells[i].text = c
    for r in rows:
        cs = t.add_row().cells
        for i, v in enumerate(r):
            cs[i].text = str(v)
            if i and str(v).startswith(("€", "×")) or str(v).endswith("%"):
                cs[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for row in t.rows:
        for c in row.cells:
            for p in c.paragraphs:
                for r in p.runs: r.font.size = Pt(9.5)
    doc.add_paragraph()
doc.add_heading("Estimativa de créditos a recuperar", 0)
doc.add_paragraph("Mecanismo de solidariedade e compensação por treinamento (FIFA RSTP) – clubes formadores brasileiros. "
                  "Elaborado em 16/11/2026. Valores em euros.")
doc.add_heading("1. Resultado", 1)
tabela(["Cenário", "Crédito gerado em 2 anos", "Parcela ainda não recebida", "Crédito a recuperar"],
       [(l[0], e(l[9]), f"{l[10]*100:.0f}%", e(l[11])) for l in linhas])
doc.add_paragraph("A estimativa é uma ordem de grandeza, não uma apuração. Ela se apoia em uma única fonte de dados "
    "(transferências do Transfermarkt) e em três premissas de julgamento, explicadas na seção 3. O BID da CBF ainda "
    "não foi coletado e, portanto, não entrou no cálculo.")
doc.add_heading("2. O que foi medido", 1)
for t in [
 "Fonte: conjunto transfermarkt-datasets (50.149 atletas, 175.165 transferências, atualizado até 6/7/2026), processado pelo módulo de apuração do programa.",
 "Janela: transferências de 16/11/2024 a 16/11/2026, por causa do prazo de 2 anos para reclamar. Como a fonte parou em julho de 2026, a janela tem na prática cerca de 20 meses.",
 "Solidariedade: transferências com valor pago em que um clube brasileiro registrou o atleta entre os 12 e os 23 anos, excluída a parte do próprio clube vendedor.",
 "Compensação por treinamento: saídas para o exterior sem valor registrado, de atletas com até 23 anos, excluídos os empréstimos identificáveis. Só o último clube foi considerado credor.",
 "Clube brasileiro: os clubes da Série A constam da fonte com país. Os demais foram identificados por inferência (atleta brasileiro, clube sem país na fonte, período anterior à primeira ida ao exterior), com exclusão manual de clubes estrangeiros.",
]: doc.add_paragraph(t, style="List Bullet")
tabela(["Base medida (antes das premissas)", "Carreira como consta", "1º clube presumido desde os 12 anos"],
       [("Solidariedade – devedor no exterior", e(b_int), e(p_int)),
        ("Solidariedade – país do devedor não identificado", e(b_ind), e(p_ind)),
        ("Solidariedade – devedor brasileiro (regra da CBF, não da FIFA)", e(b_nac), e(p_nac)),
        ("Compensação por treinamento a € 30 mil / 60 mil / 90 mil por ano", f"{e(tc(30000))} / {e(tc(60000))} / {e(tc(90000))}", "–")])
doc.add_heading("3. Premissas de cada cenário", 1)
tabela(["Premissa", "Pessimista", "Realista", "Otimista"], [
 ("Transferências consideradas", "Só devedor no exterior", "Exterior, país indefinido e nacionais", "As mesmas do realista"),
 ("Carreira dos 12 aos 15 anos", "Como consta na fonte", "Como consta na fonte", "1º clube presumido desde os 12"),
 ("Valor contratual em relação ao divulgado", "70%", "85%", "100%"),
 ("Custo anual de formação (16–21 anos)", "€ 30 mil", "€ 60 mil", "€ 90 mil"),
 ("Casos de compensação que se confirmam", "50%", "50%", "100%"),
 ("Parcela ainda não recebida pelo credor", "20%", "36%", "55%"),
])
doc.add_paragraph("A parcela não recebida é a premissa que mais pesa. Desde novembro de 2022 a FIFA Clearing House "
    "calcula e repassa esses valores automaticamente nas transferências internacionais. Segundo a FIFA, de quase "
    "US$ 1 bilhão gerado, US$ 639 milhões foram distribuídos, o que deixa cerca de 36% pendentes (cenário realista). "
    "Aos 24 meses de operação, 55% do alocado ainda não havia sido pago (cenário otimista). Os 20% do cenário "
    "pessimista são suposição minha: clubes grandes tendem a estar habilitados e a receber sem ajuda. "
    "Os percentuais de valor contratual e de confirmação dos casos também são suposições, sem dado que as sustente.")
doc.add_heading("4. Detalhe do cálculo", 1)
tabela(["Cenário", "Solidariedade", "Compensação", "Crédito gerado", "Não recebido", "A recuperar"],
       [(l[0], e(l[5]), e(l[8]), e(l[9]), f"{l[10]*100:.0f}%", e(l[11])) for l in linhas])
doc.add_heading("5. Maiores casos de solidariedade na base medida", 1)
top = [c for c in res["sol_base"] if c["cls"] in BR and c["dst"] != "BRA"]
top.sort(key=lambda c: -c["valor_credito_eur"])
tabela(["Atleta", "Data", "Transferência", "Valor", "Credor", "Crédito"],
       [(c["atleta"], c["data_transferencia"], f'{c["clube_vendedor"]} → {c["clube_devedor"]}',
         e(c["valor_transferencia_eur"]), c["clube_credor"], e(c["valor_credito_eur"])) for c in top[:20]])
ag = collections.Counter()
for c in res["sol_base"]:
    if c["cls"] in BR: ag[c["clube_credor"]] += c["valor_credito_eur"]
doc.add_heading("6. Clubes credores com maior valor na base medida", 1)
tabela(["Clube credor (como consta na fonte)", "Solidariedade gerada em 2 anos"], [(k, e(v)) for k, v in ag.most_common(20)])
doc.add_paragraph("Categorias de base aparecem separadas do clube principal nesta tabela (por exemplo, Athletico U20 e Athletico-PR).")
doc.add_heading("7. Limites", 1)
for t in [
 "Subcontagem: a fonte só cobre atletas que passaram pelas ligas acompanhadas por ela. Transferências de divisões inferiores e clubes formadores pequenos, que são o público natural do serviço, aparecem pouco.",
 "Carreiras incompletas: os registros de base anteriores aos 16 anos quase não constam. É a lacuna que o BID da CBF deveria preencher.",
 "Valores: são estimativas de imprensa, não os valores de contrato. Parcelas, bônus e percentuais de revenda não aparecem.",
 "Fora da janela: transferências anteriores a novembro de 2024 foram excluídas, mas parcelas pagas depois podem ainda estar dentro do prazo.",
 "Compensação por treinamento: é a parte mais frágil. A fonte não distingue empréstimo de transferência definitiva, não informa a categoria do clube de destino nem se houve renúncia.",
 "Crédito pendente não é crédito perdido: boa parte do saldo pendente na Clearing House é paga quando o clube conclui a habilitação. O serviço recupera o que está travado, não o saldo inteiro.",
 "Identificação de clubes: a classificação de clube brasileiro fora da Série A é inferida e contém erros residuais.",
]: doc.add_paragraph(t, style="List Bullet")
doc.add_heading("Fontes", 1)
for t in ["transfermarkt-datasets: https://github.com/dcaribou/transfermarkt-datasets",
          "FIFA, Clearing House – marco de US$ 1 bilhão: https://inside.fifa.com/media-releases/world-cup-2026-shines-spotlight-clearing-house-training-rewards-1-billion-usd-milestone",
          "FIFA, relatório de 24 meses da Clearing House: https://inside.fifa.com/legal/media-releases/report-highlights-groundbreaking-impact-of-fifa-clearing-house",
          "FIFA, julho de 2025: https://inside.fifa.com/en/news/economic-impact-clearing-house-surpasses-usd-500-million-milestone"]:
    doc.add_paragraph(t, style="List Bullet")
doc.save(saida)
