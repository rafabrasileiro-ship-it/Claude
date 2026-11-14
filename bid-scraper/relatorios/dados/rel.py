import json, re, csv, sys, collections
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
A = {x["federacao"]: x for x in json.load(open("all.json"))}
P2 = {x["federacao"]: x for x in json.load(open("p2.json"))}
T3 = json.load(open("t3.json"))
semsite = sorted({r["aLabel"] for r in csv.DictReader(open("wd.csv", encoding="utf-8")) if not r["site"] and r["countryLabel"] and not re.search(r"Seleção|Pernilla", r["aLabel"])})
REG = re.compile(r"transfer|overgang|skipti|estup|regist|habilit|inscri|bolet|tesser|overschr|jogadores/$|joueurs-par-club|joueurs-et-staffs", re.I)
NOT = re.compile(r"sanciones|documentos/%|qualif|news|referee|arbitr|coach|licen|journalist|club-licens|treneru|turniru|recruit|sign-up|youth|register$|registeruser|my-account|sportlink|album|blog|ownership|bid-in|world-cup|ziniasklaid|klubai|vyksta|startuoja|sanciones|team|registerVisit|registreer", re.I)
def classe(x, p):
    st = x["status"]
    if st == 0: return "Sem resposta"
    if st in (403, 429) : return "Bloqueio a acesso automatizado"
    if st >= 400: return "Erro do site (%d)" % st
    caps = set(x["captcha"]) | {c for pg in (p or x)["paginas"] for c in pg["captcha"]}
    caps.discard("captcha de imagem/outro") if len(caps) > 1 else None
    return "Acessível, com marcador de CAPTCHA" if caps else "Acessível, sem CAPTCHA detectado"
rows = []
for nome, x in sorted(A.items(), key=lambda kv: kv[0]):
    p = P2.get(nome)
    caps = set(x["captcha"]) | {c for pg in (p or x)["paginas"] for c in pg["captcha"]}
    if len(caps) > 1: caps.discard("captcha de imagem/outro")
    waf = sorted({w.split(" (")[0] for w in x["waf"]}) or (["Cloudflare"] if x["status"] == 403 and "cloudflare" in x["servidor"].lower() else [])
    sis = []
    for s in (p or {}).get("subdominios", []):
        if "comet." in s["url"] and s["status"] == 200 and "Plesk" not in s["titulo"] and "Brunei" not in nome: sis.append("COMET (portal com login)")
        if "registro." in s["url"] and s["captcha"]: sis.append("portal de registro com login e reCAPTCHA")
    pgs = [pg for pg in (p or x)["paginas"] if pg["status"] == 200 and REG.search(pg["url"] + pg["rotulo"]) and not NOT.search(pg["url"])]
    obs = "; ".join(dict.fromkeys(sis))
    if pgs:
        u = pgs[0]["url"]
        obs = (obs + "; " if obs else "") + "página pública: " + re.sub(r"^https?://(www\.)?", "", u)[:70]
    if x["status"] == 0: obs = "conexão falhou a partir do ambiente de teste"
    rows.append([nome, x["pais"], re.sub(r"^https?://(www\.)?", "", x["site"]).rstrip("/")[:38], classe(x, p), ", ".join(sorted(caps)) or "–", ", ".join(waf) or "–", obs or "–"])
cont = collections.Counter(r[3].split(" (")[0] for r in rows)
print(cont, len(rows), len(semsite))

d = Document()
st = d.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10.5)
def shade(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr(); s = OxmlElement("w:shd")
    s.set(qn("w:val"), "clear"); s.set(qn("w:color"), "auto"); s.set(qn("w:fill"), hexcolor); tcPr.append(s)
def tabela(cab, linhas, larg=None, fonte=8.5):
    t = d.add_table(rows=1, cols=len(cab)); t.style = "Table Grid"
    for i, c in enumerate(cab):
        cell = t.rows[0].cells[i]; cell.text = ""; r = cell.paragraphs[0].add_run(c); r.bold = True; r.font.size = Pt(fonte); r.font.color.rgb = RGBColor(255, 255, 255); shade(cell, "1F3864")
    trp = t.rows[0]._tr.get_or_add_trPr(); h = OxmlElement("w:tblHeader"); h.set(qn("w:val"), "true"); trp.append(h)
    for n, l in enumerate(linhas):
        cells = t.add_row().cells
        for i, v in enumerate(l):
            cells[i].text = ""; r = cells[i].paragraphs[0].add_run(str(v)); r.font.size = Pt(fonte)
            if n % 2: shade(cells[i], "EEF2F8")
    if larg:
        for row in t.rows:
            for i, w in enumerate(larg): row.cells[i].width = Cm(w)
    return t
def bl(txt):
    p = d.add_paragraph(style="List Bullet"); 
    m = re.match(r"\*\*(.+?)\*\*(.*)", txt)
    if m: p.add_run(m.group(1)).bold = True; p.add_run(m.group(2))
    else: p.add_run(txt)
sec = d.sections[0]; sec.left_margin = sec.right_margin = Cm(2); sec.top_margin = sec.bottom_margin = Cm(2)
t = d.add_heading("Registros públicos de atletas nas federações filiadas à FIFA", 0)
p = d.add_paragraph(); r = p.add_run("Levantamento de barreiras de acesso (CAPTCHA, login e bloqueio a robôs)"); r.italic = True; r.font.size = Pt(13)
d.add_paragraph("Data da verificação: 14 de novembro de 2026. Elaborado com apoio de ferramenta automatizada (Claude Code).")

d.add_heading("1. Resumo", 1)
d.add_paragraph(
 "Foram testados os sites oficiais de %d federações. Nenhuma das páginas alcançadas é um equivalente do BID da CBF, isto é, "
 "um boletim diário, público e consultável por data com todos os registros de atletas. O padrão internacional é outro: o registro fica em sistema fechado "
 "com login (principalmente o COMET e o FIFA Connect), e o que se publica são listas em PDF, páginas de busca ou comunicados." % len(rows))
bl("**Sem barreira detectada: **há fontes públicas de registro ou transferência sem CAPTCHA nem login em 12 federações (seção 4), com destaque para Noruega, Croácia, Turquia, Hungria, País de Gales, Irlanda, Irlanda do Norte, Gibraltar e Coreia do Sul.")
bl("**CAPTCHA ou login no registro: **Brasil (BID, CAPTCHA de imagem, conforme informado por você; o site não respondeu a este teste), Panamá (boletim e portal de registro com login e reCAPTCHA), Eslovênia (sistema Regista com login) e os portais COMET de %d federações (login)." % sum(1 for r in rows if "COMET (portal" in r[6]))
bl("**Bloqueio a robôs no site inteiro: **%d federações devolveram erro 403, quase todas por Cloudflare ou Akamai, entre elas Portugal, França, Bélgica, Suíça, Chéquia, Israel, Marrocos, Egito e Indonésia." % cont["Bloqueio a acesso automatizado"])
bl("**Sem resposta: **%d sites não responderam a partir do ambiente de teste, entre eles Argentina, Peru, China, Hungria (site principal) e Costa Rica. Isso não permite concluir nada sobre eles." % cont["Sem resposta"])
d.add_paragraph("O resultado é uma triagem, não uma auditoria completa: cada site recebeu poucas leituras de páginas públicas, sem envio de formulários. As limitações estão na seção 6 e condicionam todas as conclusões.")

d.add_heading("2. Escopo e método", 1)
bl("**Lista de federações: **entidades registradas no Wikidata como membros da FIFA, com site oficial informado. Resultaram %d entidades testadas; a FIFA tem 211 filiadas. A lista do Wikidata inclui algumas ligas regionais e deixa de fora as %d entidades sem site cadastrado (seção 5.2)." % (len(rows), len(semsite)))
bl("**Passo 1: **uma leitura da página inicial de cada federação, com identificação honesta do robô (sem imitar navegador).")
bl("**Passo 2: **leitura de até oito páginas ligadas a registro ou transferência, encontradas por palavras-chave em vários idiomas, e teste dos subdomínios comet, registro e registration.")
bl("**Passo 3: **leitura dirigida de 80 endereços de registros conhecidos ou prováveis nas principais federações.")
bl("**O que foi observado: **código de resposta, presença de scripts de CAPTCHA (reCAPTCHA, hCaptcha, Cloudflare Turnstile ou a palavra captcha), campo de senha, página de desafio de firewall, tabelas e arquivos PDF.")
bl("**O que não foi feito: **nenhum formulário foi enviado, nenhum CAPTCHA foi respondido e nenhum bloqueio foi contornado.")

d.add_heading("3. Como ler as categorias", 1)
tabela(["Categoria", "Significado", "Qtde."], [
 ["Acessível, sem CAPTCHA detectado", "O site respondeu e nenhuma das páginas lidas contém script de CAPTCHA.", cont["Acessível, sem CAPTCHA detectado"]],
 ["Acessível, com marcador de CAPTCHA", "Alguma página lida contém script de CAPTCHA. Em muitos casos ele protege só formulário de contato, boletim de notícias ou login, não a consulta de dados.", cont["Acessível, com marcador de CAPTCHA"]],
 ["Bloqueio a acesso automatizado", "O site devolveu 403 ao robô identificado, em geral com página de desafio de firewall.", cont["Bloqueio a acesso automatizado"]],
 ["Erro do site", "O site respondeu com erro 404 ou 5xx na página inicial.", cont["Erro do site"]],
 ["Sem resposta", "A conexão falhou a partir do ambiente de teste (bloqueio geográfico, site fora do ar ou endereço desatualizado).", cont["Sem resposta"]],
], [5, 10, 2], 9.5)

d.add_heading("4. Achados principais", 1)
d.add_heading("4.1 Fontes públicas sem CAPTCHA nem login detectados", 2)
tabela(["Federação", "O que é publicado", "Endereço", "Observação"], [
 ["Noruega (NFF)", "Busca de transferências e empréstimos", "fotball.no/lov-og-reglement/overganger/sok-overganger", "Formulário de busca e tabela na página; formulário não foi enviado."],
 ["Croácia (HNS)", "Registros de atletas e transferências internacionais em PDF", "hns.family/dokumenti/registracije e /medjunarodni-transferi", "Cerca de 1.580 e 78 links para PDF nas duas páginas."],
 ["Turquia (TFF)", "Busca de jogadores", "tff.org/Default.aspx?pageID=130", "Formulário público; não foi enviado."],
 ["Hungria (MLSZ)", "Banco de dados de competições e atletas", "adatbank.mlsz.hu", "O site principal mlsz.hu não respondeu; o banco de dados sim."],
 ["País de Gales (FAW)", "Listas de registros de jogadores em PDF", "faw.cymru/player-registrations", "15 links para PDF."],
 ["Irlanda (FAI)", "Página de registros com documentos", "fai.ie/about/governance/registrations", "8 links para PDF."],
 ["Irlanda do Norte (IFA)", "Formulários e documentos de registro", "irishfa.com/ifa-domestic/leagues/player-registration-forms", "45 links para PDF; a maior parte são formulários, não listas."],
 ["Gibraltar (GFA)", "Regras e registros", "gibraltarfa.com/governance/rules-regulations-and-registrations", "36 links para PDF."],
 ["Coreia do Sul (KFA)", "Situação de registros", "kfa.or.kr/kfa/data_room.php?act=registration", "Tabelas e 58 links para PDF."],
 ["Fiji (Fiji FA)", "Listas de transferências por janela", "fijifootball.com.fj/pre-season-transfer-january", "Publicação por notícia."],
 ["Índia (AIFF)", "Status e registro de jogadores", "the-aiff.com/players-status-and-registration", "Página informativa com documentos. Há reCAPTCHA em outra página do site (cadastro de usuário)."],
 ["Nova Zelândia (NZF)", "Registros e transferências", "nzfootball.co.nz/about/registrations-and-transfers", "Página informativa; registro em si é no COMET."],
 ["Inglaterra (FA)", "Política e documentos de registro", "thefa.com/football-rules-governance/policies/player-registration", "Página pública; listas não localizadas nesta leitura."],
 ["Camarões (Fecafoot)", "Listas de jogadores qualificados por clube", "fecafoot-officiel.com (seção de notícias)", "Há marcador de CAPTCHA no site, aparentemente em formulários de conta."],
], [3, 4.2, 5.3, 4.5], 8.5)
d.add_paragraph()
d.add_paragraph("Nenhuma dessas fontes tem a granularidade do BID. São listas periódicas ou buscas por nome, e várias cobrem só parte das competições.")

d.add_heading("4.2 Registros protegidos por CAPTCHA ou login", 2)
comet = sorted(r[0] for r in rows if "COMET (portal" in r[6])
tabela(["Federação", "Barreira", "Evidência"], [
 ["Brasil (CBF)", "CAPTCHA de imagem no BID", "Informado por você. bid.cbf.com.br recusou a conexão neste teste (e devolveu 503 em teste anterior); não foi verificado diretamente."],
 ["Panamá (Fepafut)", "Login e reCAPTCHA", "fepafut.com/boletin-informativo e registro.fepafut.com/login contêm campo de senha e script do reCAPTCHA."],
 ["Eslovênia (NZS)", "Login", "regista.nzs.si abre em tela de login; a página de registro de atletas contém reCAPTCHA."],
 ["Cabo Verde (FCF)", "reCAPTCHA presente", "fcf.cv/jogadores (Histórico de Jogadores) contém script do reCAPTCHA; não foi possível confirmar se ele protege a consulta."],
 ["Itália (FIGC)", "Login único", "A área de registro leva a sso.figc.it."],
 ["Países Baixos (KNVB)", "Login (Sportlink)", "Página de transferências estava em manutenção; o registro é feito em sistema com login."],
 ["Portais COMET", "Login", "Subdomínio comet ativo em %d federações: Canadá, Catar, Chipre, Colômbia, Estados Unidos, Gibraltar, Ilhas Faroe, Irlanda, Irlanda do Norte, Islândia, Letônia, Lituânia, Malta, Moldávia, Montenegro, País de Gales, San Marino, Sérvia e Venezuela. O COMET é um sistema de uso interno com login; a tela de login foi vista diretamente nas Ilhas Faroe. Também é citado nos sites de Croácia, Bósnia, Escócia, Macedônia do Norte, Fiji e Nova Zelândia." % len(comet)],
], [3.2, 3.3, 10.5], 8.5)

d.add_heading("4.3 Sites que bloqueiam acesso automatizado", 2)
blq = [r for r in rows if r[3] == "Bloqueio a acesso automatizado"]
tabela(["Federação", "País/território", "Site", "Proteção identificada"], [[r[0], r[1], r[2], r[5] if r[5] != "–" else "não identificada"] for r in blq], [6, 3.5, 4, 3.5], 8.5)
d.add_paragraph()
d.add_paragraph("O bloqueio vale para o site inteiro e para o robô identificado usado no teste. Um navegador comum normalmente passa por essas proteções; o teste não tentou fazê-lo.")

d.add_heading("4.4 América do Sul", 2)
tabela(["Federação", "Resultado"], [
 ["Brasil (CBF)", "cbf.com.br acessível, sem CAPTCHA na página inicial. BID inacessível neste teste; CAPTCHA conforme seu relato."],
 ["Argentina (AFA)", "Sem resposta do site a partir do ambiente de teste."],
 ["Uruguai (AUF)", "Site acessível, sem CAPTCHA detectado. Publica boletins de sanções; portal COMET não respondeu."],
 ["Paraguai (APF)", "Site acessível, com páginas públicas de perfil de jogador; reCAPTCHA presente no site."],
 ["Chile (ANFP/FFCh)", "anfp.cl acessível, com reCAPTCHA no site; página de registro de jogadores não localizada."],
 ["Colômbia (FCF)", "Site acessível, com reCAPTCHA; portal comet.fcf.com.co ativo (login)."],
 ["Venezuela (FVF)", "Site acessível, com reCAPTCHA; portal comet.fvf.com.ve ativo (login)."],
 ["Equador (FEF)", "Site respondeu com página mínima (provável carregamento por JavaScript); portal COMET não respondeu."],
 ["Bolívia (FBF)", "Site acessível, sem CAPTCHA detectado; nenhum registro público localizado."],
 ["Peru (FPF)", "Sem resposta do site a partir do ambiente de teste."],
], [3.5, 13.5], 9)

d.add_page_break()
s2 = d.add_section(); s2.orientation = WD_ORIENT.LANDSCAPE; s2.page_width, s2.page_height = s2.page_height, s2.page_width
s2.left_margin = s2.right_margin = Cm(1.5)
d.add_heading("5. Quadro completo por federação", 1)
d.add_heading("5.1 Federações testadas", 2)
d.add_paragraph("A coluna País/território segue o Wikidata, que atribui territórios ao Estado soberano (por exemplo, Reino Unido para Inglaterra, Escócia, Gales e territórios ultramarinos).")
tabela(["Federação", "País/território", "Site", "Situação", "CAPTCHA detectado", "Firewall", "Sistema ou página de registro"], rows, [5.6, 2.8, 4, 3.6, 2.8, 2, 5.9], 7.5)
d.add_heading("5.2 Entidades sem site cadastrado (não testadas)", 2)
d.add_paragraph(", ".join(semsite) + ".")

d.add_heading("6. Limitações", 1)
bl("**CAPTCHA no envio: **muitos sites só exibem o CAPTCHA ao enviar a busca. Como nenhum formulário foi enviado, 'sem CAPTCHA detectado' significa apenas que a página lida não carrega script de CAPTCHA.")
bl("**Falsos positivos: **o marcador de CAPTCHA pode pertencer a formulário de contato ou de notícias, sem relação com dados de atletas.")
bl("**Cobertura do registro: **a busca por palavras-chave não garante que a página de registro de cada federação tenha sido encontrada. Ausência de achado não prova que o registro não é público.")
bl("**Origem do teste: **as leituras partiram de um servidor em nuvem. Sites com bloqueio geográfico ou por tipo de rede podem responder de outro modo a um computador no Brasil.")
bl("**Ligas profissionais: **em vários países o registro é publicado pela liga, e não pela federação (por exemplo LaLiga, Liga MX, J.League). Esses sites ficaram fora do escopo.")
bl("**Lista de filiadas: **a base usada não coincide exatamente com as 211 filiadas da FIFA.")

d.add_heading("7. Implicações para o projeto", 1)
bl("**Não há um 'BID sem CAPTCHA' no exterior: **as fontes abertas encontradas são listas e buscas parciais. Servem para confirmar registros e transferências caso a caso, não para montar uma base diária completa.")
bl("**Ausência de CAPTCHA não equivale a permissão de coleta: **os termos de uso de cada site e a legislação de dados pessoais (na Europa, o RGPD) continuam valendo, sobretudo para dados de menores.")
bl("**Fontes mais promissoras para verificação manual: **Noruega, Croácia, Turquia, Hungria, País de Gales e Coreia do Sul.")
bl("**Próximo passo sugerido: **escolher de cinco a dez países de interesse comercial e fazer a verificação aprofundada de cada um, incluindo os sites das ligas profissionais.")
d.save(sys.argv[1])
