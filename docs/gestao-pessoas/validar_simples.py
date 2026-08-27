# -*- coding: utf-8 -*-
import json, warnings, time, sys, re
warnings.filterwarnings("ignore")
import formulas
ESP = json.load(open("/home/user/kaneo/docs/gestao-pessoas/.sombra_simples.json"))
t = time.time()
xl = formulas.ExcelModel().loads("/home/user/kaneo/docs/gestao-pessoas/Avaliacao_Semanal.xlsx").finish()
sol = xl.calculate(); dur = time.time() - t
def norm(k):
    m = re.match(r"^'\[.*?\]([^']+)'!([A-Z]+[0-9]+)$", k)
    return "{}!{}".format(m.group(1), m.group(2)) if m else None
alvo = {e.upper() for e in ESP}
got = {}
for k, v in sol.items():
    n = norm(k)
    if n and n.upper() in alvo:
        try: got[n.upper()] = v.value[0, 0]
        except Exception: got[n.upper()] = str(v)
falhas = 0
print("Motor: {} celulas em {:.1f}s\n".format(len(sol), dur))
for chave, esp in sorted(ESP.items()):
    obt = got.get(chave.upper())
    try: bate = abs(float(obt) - float(esp)) < 1e-6
    except (TypeError, ValueError): bate = str(obt).strip() == str(esp)
    if not bate:
        falhas += 1
        print("{:16s} esperado {:>10}  obtido {:>10}   FALHOU".format(chave, str(esp), str(obt)[:10]))
print("{} de {} celulas conferem.".format(len(ESP) - falhas, len(ESP)))
sys.exit(1 if falhas else 0)
