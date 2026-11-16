import sqlite3, sys, pickle, collections, json, re
from datetime import date
from bidscraper import fontes, apuracao
from bidscraper.creditos import _d, idade_em
S=sys.argv[1]
conn=sqlite3.connect(S+"/est.sqlite"); conn.row_factory=sqlite3.Row
EXC=re.compile(r"^(Vitória SC|Shabab|Famalic|PSV|Fanna|Leiria|GD Ribeir|La Serena|Defensor|Cova Pied|APOEL|SC Inter Youth|Fort Laud|Valladolid|Norwich|Estoril|Houston|Leix|Ajax|STK|Vegalta|1\.FC|HJK|Paços|Golden State|Röthis|G\. Bordeaux|Seoul|Panathin|Portimon|FC Baniyas|NS Mura|Zorya|Vélez|Hegelmann|FC Dornbirn|Trofense|SC Covilh|Nacional|Celta|Venados|Udinese|Benfica|ARC Ol|Sertanense|Alvarenga|Alcanen|Cafetal|Atlante|Huracán|Maria da Fonte|Central Esp|Rentistas|Marítimo|Wanderers|Feirense|Pohronie|Boluspor|Gondomar|FC ViOn|Vilafranq|Oleksand|Pavia|Cittadella|AO Episk|Inter$)")
pc={fontes.clube_matriz(r["nome"]):r["pais"] for r in conn.execute("select * from fonte_clubes") if not (r["nome"] or "").startswith("Vitória SC")}
nac={r["id_fonte"]:r["nacionalidade"] for r in conn.execute("select * from fonte_atletas")}
ext={}; hist=collections.defaultdict(list)
for r in conn.execute("select * from transferencias order by data"):
    if r["pais_destino"] and r["pais_destino"]!="BRA": ext.setdefault(r["id_fonte"], r["data"])
    hist[r["id_fonte"]].append((r["data"],fontes.clube_matriz(r["clube_origem"]),fontes.clube_matriz(r["clube_destino"]),r["pais_destino"]))
def classe(c):
    if EXC.match(c["clube_credor"]): return "outro"
    pk=pc.get(fontes.clube_matriz(c["clube_credor"]))
    if pk=="BRA": return "BRA"
    if pk is None and nac.get(c["id_fonte"])=="Brazil":
        e=ext.get(c["id_fonte"]); mx=max(map(int,c["idades_no_credor"].split(",")))
        if e is None or mx<=idade_em(_d(c["nascimento"]),_d(e)): return "provBRA"
    return "outro"
def dst(c):
    for d,o,de,p in hist[c["id_fonte"]]:
        if d==c["data_transferencia"] and de==fontes.clube_matriz(c["clube_devedor"]):
            return "BRA" if p=="BRA" else ("ext" if p else "indef")
    return "indef"
def emprestimo(c):
    o,de=fontes.clube_matriz(c["clube_vendedor"]),fontes.clube_matriz(c["clube_devedor"])
    for d,o2,d2,p in hist[c["id_fonte"]]:
        if o2==de and d2==o: return True   # ida e volta entre os mesmos clubes
    return False
H=date(2026,11,16); res={}
for tag,pres in (("base",False),("pres",True)):
    cr=apuracao.to_rows(apuracao.apurar(conn,de="2024-11-16",ate="2026-11-16",tipos=("solidariedade",),presumir_inicio=pres,hoje=H))
    for c in cr: c["cls"]=classe(c); c["dst"]=dst(c)
    res["sol_"+tag]=cr
    t=collections.defaultdict(lambda:[0,0.0])
    for c in cr: x=t[(c["cls"],c["dst"])]; x[0]+=1; x[1]+=c["valor_credito_eur"]
    print(tag,{k:(v[0],round(v[1])) for k,v in sorted(t.items())})
for custo in (30000,60000,90000):
    cr=apuracao.to_rows(apuracao.apurar(conn,de="2024-11-16",ate="2026-11-16",tipos=("compensacao_treinamento",),custo_anual=custo,custo_anual_12_15=10000,hoje=H))
    sel=[]
    for c in cr:
        if c["credor_e_vendedor"]!="sim" or (c["valor_transferencia_eur"] or 0)>0: continue
        c["cls"]=classe(c); c["dst"]=dst(c)
        if c["cls"]=="outro" or c["dst"]!="ext" or emprestimo(c): continue
        sel.append(c)
    res[f"tc_{custo}"]=sel
    t=collections.defaultdict(lambda:[0,0.0])
    for c in sel: x=t[c["cls"]]; x[0]+=1; x[1]+=c["valor_credito_eur"]
    print("TC",custo,{k:(v[0],round(v[1])) for k,v in t.items()})
pickle.dump(res,open(S+"/res.pkl","wb"))
for c in sorted(res["tc_60000"],key=lambda c:-c["valor_credito_eur"])[:12]: print(c["atleta"],c["data_transferencia"],c["idade_na_transferencia"],c["clube_vendedor"],"->",c["clube_devedor"],c["anos_no_credor"],c["valor_credito_eur"])
