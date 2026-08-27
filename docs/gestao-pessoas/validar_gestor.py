# -*- coding: utf-8 -*-
import warnings, time, sys, re, datetime as dt
warnings.filterwarnings("ignore")
import formulas
ARQ = "/home/user/kaneo/docs/gestao-pessoas/Avaliacao_Desempenho_Gestor_v3.xlsx"
hoje = dt.date.today()
ESP = {
 "Retenção!K5": 2026*4+3, "Retenção!L5": 2026*4+5, "Retenção!M5": "Sim", "Retenção!N5": "em ação",
 "Caso de Promoção!K5": round((-0.10+0.20+0.375)/3, 6),
 "Caso de Promoção!L5": 2,
 "Caso de Promoção!P5": "Sim",
 "Caso de Promoção!Q5": "Caso em formação",
 "Registro do Gestor!H6": (dt.date(2026,10,15)-hoje).days,
}
t=time.time(); xl=formulas.ExcelModel().loads(ARQ).finish(); sol=xl.calculate(); dur=time.time()-t
def norm(k):
    m=re.match(r"^'\[.*?\]([^']+)'!([A-Z]+[0-9]+)$",k)
    return "{}!{}".format(m.group(1),m.group(2)) if m else None
got={}
alvo={e.upper() for e in ESP}
for k,v in sol.items():
    n=norm(k)
    if n and n.upper() in alvo:
        try: got[n.upper()]=v.value[0,0]
        except Exception: got[n.upper()]=str(v)
print("Motor `formulas`: {} celulas em {:.1f}s\n".format(len(sol),dur))
falhas=0
for chave,esp in ESP.items():
    obt=got.get(chave.upper())
    try: bate=abs(float(obt)-float(esp))<1e-5
    except (TypeError,ValueError): bate=str(obt).strip()==str(esp)
    print("{:28s} {:>18} {:>18}   {}".format(chave,str(esp),str(obt)[:18],"OK" if bate else "FALHOU"))
    if not bate: falhas+=1
print("\n{} de {} conferem.".format(len(ESP)-falhas,len(ESP)))
sys.exit(1 if falhas else 0)
