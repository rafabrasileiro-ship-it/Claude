"""Levantamento passivo: 1 GET na página inicial de cada federação + até 4 páginas
ligadas a registro/transferência. Só leitura de páginas públicas; não envia formulários."""
import csv, json, re, sys, concurrent.futures as cf
from urllib.parse import urljoin, urlparse
import requests
UA = "levantamento-federacoes/1.0 (pesquisa academica; leitura de paginas publicas)"
NOISE = re.compile(r"Seleção|CONMEBOL|Confederação A|Confederação Brasileira de Futebol$^|União das Federações|Barcelona|^Essuatíni$|Saarland|Antilhas|Pernilla|Kenya Football Federation|^Bangladesh Football", re.I)
KW = re.compile(r"regist|transfer|fichaj|inscrip|inscri[çc]|licen[cs]|tesser|boletim|bolet[ií]n|\bbid\b|comet|habilit|player.?status|spielerpass|passwesen|qualifi|mutation|joueurs|jugadores|jogadores|players|contrat|estatuto|status", re.I)
CAPTCHA = {
 "reCAPTCHA": r"recaptcha|g-recaptcha|google\.com/recaptcha",
 "hCaptcha": r"hcaptcha",
 "Cloudflare Turnstile": r"challenges\.cloudflare\.com/turnstile|cf-turnstile",
 "captcha de imagem/outro": r"captcha",
}
WAF = {
 "Cloudflare (desafio)": r"just a moment|cf-chl|challenge-platform|attention required",
 "Akamai": r"akamai|errors\.edgesuite|reference&#32;&#35;",
 "Imperva/Incapsula": r"incapsula|imperva|_incap_",
 "DataDome": r"datadome",
 "PerimeterX": r"perimeterx|px-captcha",
 "Sucuri": r"sucuri",
 "AWS WAF": r"awswaf|aws-waf",
}
SYS = {"COMET": r"comet", "FIFA Connect": r"fifa connect", "login": r"type=[\"']password"}
def fetch(s, url):
    url = re.sub(r"^http://", "https://", url)
    st = _fetch(s, url)
    if st[0] == 0:
        import time; time.sleep(3)
        alt = url.replace("://www.", "://") if "://www." in url else url.replace("://", "://www.", 1)
        st2 = _fetch(s, alt)
        if st2[0]: return st2
    return st
def _fetch(s, url):
    try:
        r = s.get(url, timeout=20, allow_redirects=True)
        return r.status_code, r.url, r.text[:600000], dict(r.headers)
    except requests.RequestException as e:
        return 0, url, "", {"erro": type(e).__name__ + ": " + str(e)[:120]}
def marks(text, hdr, table):
    blob = text.lower()
    return [k for k, rx in table.items() if re.search(rx, blob)]
def one(row):
    s = requests.Session(); s.headers["User-Agent"] = UA; s.headers["Accept-Language"] = "en,pt;q=0.8,es;q=0.7,fr;q=0.6"
    st, final, text, hdr = fetch(s, row["site"])
    out = {"pais": row["countryLabel"], "federacao": row["aLabel"], "site": row["site"], "status": st,
           "url_final": final, "erro": hdr.get("erro", ""), "servidor": hdr.get("Server", hdr.get("server", "")),
           "bytes": len(text), "captcha": marks(text, hdr, CAPTCHA), "waf": marks(text, hdr, WAF) if st in (0, 403, 429, 503, 406, 202) or len(text) < 5000 else [],
           "sistemas": marks(text, hdr, SYS), "paginas": []}
    if "cf-mitigated" in {k.lower() for k in hdr}: out["waf"].append("Cloudflare (cf-mitigated)")
    links, seen = [], set()
    host = urlparse(final).netloc.split(":")[0].removeprefix("www.")
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', text, re.I | re.S):
        href, label = m.group(1), re.sub(r"<[^>]+>|\s+", " ", m.group(2)).strip()[:80]
        if not KW.search(href + " " + label): continue
        u = urljoin(final, href)
        h = urlparse(u).netloc.split(":")[0].removeprefix("www.")
        if not u.startswith("http") or not (h == host or h.endswith("." + host) or "comet" in h or "fifa" in h): continue
        if u in seen or re.search(r"\.(pdf|jpe?g|png|docx?|xlsx?|zip)(\?|$)", u, re.I): continue
        seen.add(u); links.append((u, label))
    out["n_links_relevantes"] = len(links)
    for u, label in links[:4]:
        st2, f2, t2, h2 = fetch(s, u)
        out["paginas"].append({"url": u, "rotulo": label, "status": st2, "url_final": f2, "bytes": len(t2),
            "captcha": marks(t2, h2, CAPTCHA), "waf": marks(t2, h2, WAF) if st2 in (0, 403, 429, 503) else [],
            "sistemas": marks(t2, h2, SYS), "tabelas": len(re.findall(r"<table", t2, re.I)),
            "formularios": len(re.findall(r"<form", t2, re.I)), "erro": h2.get("erro", "")})
    return out
rows = {}
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8")):
    if r["site"] and r["countryLabel"] and not NOISE.search(r["aLabel"]): rows.setdefault(r["aLabel"], r)
rows = list(rows.values())
if len(sys.argv) > 3:
    ok = {x["federacao"] for x in json.load(open(sys.argv[3])) if x["status"]}
    rows = [r for r in rows if r["aLabel"] not in ok]
print(len(rows), "federações", file=sys.stderr)
with cf.ThreadPoolExecutor(6) as ex: res = list(ex.map(one, rows))
json.dump(res, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
