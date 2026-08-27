# -*- coding: utf-8 -*-
"""Portao de validacao: calcula a planilha com o motor `formulas` e compara
celula a celula contra o modelo-sombra calculado em Python pelo gerador."""
import json, warnings, time, sys, re
warnings.filterwarnings("ignore")
import formulas

ARQ = "Avaliacao_Desempenho_Squad_v3.xlsx"
ESP = json.load(open("/home/user/kaneo/docs/gestao-pessoas/.modelo_sombra.json"))

t = time.time()
xl = formulas.ExcelModel().loads("/home/user/kaneo/docs/gestao-pessoas/" + ARQ).finish()
sol = xl.calculate()
dur = time.time() - t

def norm(k):
    m = re.match(r"^'\[.*?\]([^']+)'!([A-Z]+[0-9]+)$", k)
    return "{}!{}".format(m.group(1), m.group(2)) if m else None

achado = {}
for k, v in sol.items():
    n = norm(k)
    if n and n.upper() in [e.upper() for e in ESP]:
        try:
            achado[n] = v.value[0, 0]
        except Exception:
            achado[n] = str(v)

falhas, ok = [], 0
print("Motor `formulas`: {} celulas calculadas em {:.1f}s\n".format(len(sol), dur))
print("{:14s} {:>12s} {:>12s}   {}".format("celula", "esperado", "obtido", ""))
for chave, esperado in ESP.items():
    obtido = None
    for n, v in achado.items():
        if n.upper() == chave.upper():
            obtido = v; break
    try:
        bate = abs(float(obtido) - float(esperado)) < 1e-6
    except (TypeError, ValueError):
        bate = str(obtido) == str(esperado)
    if bate:
        ok += 1
        print("{:14s} {:>12} {:>12}   OK".format(chave, esperado, obtido))
    else:
        falhas.append((chave, esperado, obtido))
        print("{:14s} {:>12} {:>12}   FALHOU".format(chave, esperado, str(obtido)[:12]))

print("\n{} de {} celulas-chave conferem.".format(ok, len(ESP)))
if falhas:
    print("PORTAO REPROVADO")
    sys.exit(1)
print("PORTAO APROVADO — os valores batem com o calculo independente.")
