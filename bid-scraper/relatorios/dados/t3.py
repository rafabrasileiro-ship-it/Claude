import re, json, sys, requests, concurrent.futures as cf
UA = "levantamento-federacoes/1.0 (pesquisa academica; leitura de paginas publicas)"
U = """Brasil|https://bid.cbf.com.br/
Brasil|https://www.cbf.com.br/
Portugal|https://www.fpf.pt/pt/Jogadores
Argentina|https://www.afa.com.ar/es/boletins
Argentina|https://www.afa.com.ar/
Uruguai|https://www.auf.org.uy/
Uruguai|https://comet.auf.org.uy/
Chile|https://www.anfp.cl/
Chile|https://www.anfp.cl/registro-de-jugadores
Paraguai|https://www.apf.org.py/jugadores
Paraguai|https://comet.apf.org.py/
Peru|https://www.fpf.org.pe/
Peru|https://fpf.pe/
Equador|https://www.fef.ec/
Equador|https://comet.fef.ec/
Colômbia|https://comet.fcf.com.co/
Colômbia|https://fcf.com.co/
Bolívia|https://www.fbf.com.bo/
Venezuela|https://comet.fvf.com.ve/
México|https://www.ligamx.net/cancha/jugadores
México|https://fmf.mx/
Alemanha|https://www.dfb.de/verbandsservice/pinnwand/transferlisten/
Inglaterra|https://www.thefa.com/football-rules-governance/policies/player-registration
Escócia|https://www.scottishfa.co.uk/scottish-fa/organisation/registrations/
Itália|https://www.figc.it/it/federazione/tesseramento/
Espanha|https://rfef.es/es/federacion/licencias
França|https://www.fff.fr/
Suécia|https://www.svenskfotboll.se/
Suécia|https://www.svenskfotboll.se/serier-cuper/spelarovergangar/
Noruega|https://www.fotball.no/lov-og-reglement/overganger/sok-overganger/
Islândia|https://www.ksi.is/mot/felagaskipti/
Estónia|https://jalgpall.ee/voistlused/players
Finlândia|https://www.palloliitto.fi/pelaajasiirrot
Dinamarca|https://www.dbu.dk/
Chéquia|https://is.fotbal.cz/prestupy/prehled-prestupu.aspx
Chéquia|https://is.fotbal.cz/
Eslováquia|https://issf.futbalnet.sk/
Eslováquia|https://sportnet.sme.sk/futbalnet/
Hungria|https://adatbank.mlsz.hu/
Turquia|https://www.tff.org/Default.aspx?pageID=130
Áustria|https://www.oefb.at/
Suíça|https://www.football.ch/
Países Baixos|https://www.knvb.nl/assist-wedstrijdsecretarissen/veldvoetbal/overschrijvingen
Bélgica|https://www.rbfa.be/
Croácia|https://hns.family/dokumenti/registracije/
Croácia|https://comet.hns-cff.hr/
Sérvia|https://comet.fss.rs/
Malta|https://comet.mfa.com.mt/
Irlanda|https://www.fai.ie/about/governance/registrations/
Gales|https://faw.cymru/player-registrations/
Irlanda do Norte|https://www.irishfa.com/ifa-domestic/leagues/player-registration-forms
Gibraltar|https://www.gibraltarfa.com/governance/rules-regulations-and-registrations
Coreia do Sul|https://www.kfa.or.kr/kfa/data_room.php?act=registration
Japão|https://www.jfa.jp/registration/
Japão|https://www.jleague.jp/release/
Fiji|https://www.fijifootball.com.fj/pre-season-transfer-january/
Sudão do Sul|https://ssfaonline.com/transfers/
Camarões|https://fecafoot-officiel.com/
Nova Zelândia|https://www.nzfootball.co.nz/about/registrations-and-transfers
Índia|https://www.the-aiff.com/players-status-and-registration
Panamá|https://www.fepafut.com/boletin-informativo/
Eslovénia|https://www.nzs.si/podrocja/registracija-igralcev
Cabo Verde|https://fcf.cv/jogadores/
Roménia|https://www.frf.ro/
Grécia|https://www.epo.gr/
Polónia|https://www.pzpn.pl/
Rússia|https://rfs.ru/
Ucrânia|https://uaf.ua/
Austrália|https://www.footballaustralia.com.au/
EUA|https://www.ussoccer.com/
Canadá|https://www.canadasoccer.com/clubs/national-soccer-registry/
África do Sul|https://www.safa.net/
Nigéria|https://thenff.com/
Gana|https://www.ghanafa.org/
Marrocos|https://frmf.ma/
Egito|https://www.efa.com.eg/
Arábia Saudita|https://www.saff.com.sa/en/
Catar|https://comet.qfa.qa/
China|https://www.thecfa.cn/
FIFA|https://www.fifa.com/en/legal/football-regulatory/player-transfers
"""
CAP = {"reCAPTCHA": r"recaptcha", "hCaptcha": r"hcaptcha", "Turnstile": r"cf-turnstile|challenges\.cloudflare\.com/turnstile", "captcha(outro)": r"captcha"}
def one(line):
    pais, url = line.split("|", 1)
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": UA, "Accept-Language": "en,pt;q=0.8"})
        t = r.text[:800000]; low = t.lower()
        txt = re.sub(r"\s+", " ", re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", t, flags=re.S | re.I))
        return dict(pais=pais, url=url, status=r.status_code, final=r.url, bytes=len(t),
            titulo=(re.search(r"<title[^>]*>(.*?)</title>", t, re.I | re.S) or [0, ""])[1].strip()[:90],
            captcha=[k for k, rx in CAP.items() if re.search(rx, low)],
            cf="cf-mitigated" in {k.lower() for k in r.headers}, server=r.headers.get("Server", ""),
            login=bool(re.search(r"type=[\"']password", low)), tabelas=low.count("<table"), forms=low.count("<form"),
            pdfs=len(re.findall(r"\.pdf", low)), trecho=txt[:260])
    except Exception as e:
        return dict(pais=pais, url=url, status=0, erro=type(e).__name__ + ": " + str(e)[:140])
with cf.ThreadPoolExecutor(10) as ex: res = list(ex.map(one, [l for l in U.strip().splitlines()]))
json.dump(res, open("t3.json", "w"), ensure_ascii=False, indent=1)
for x in res:
    if x["status"]: print(x["pais"], "|", x["url"][:70], "|", x["status"], "|", x["titulo"][:45], "|", x["captcha"], "CF" if x["cf"] else "", "LOGIN" if x["login"] else "", "t%d f%d pdf%d" % (x["tabelas"], x["forms"], x["pdfs"]), x["bytes"])
    else: print(x["pais"], "|", x["url"][:70], "| ERRO", x["erro"][:80])
