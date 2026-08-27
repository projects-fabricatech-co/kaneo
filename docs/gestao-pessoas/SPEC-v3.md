# Spec v3 — Planilha de Avaliação de Desempenho por Squad

Status: **aprovada para construção**, com as correções dos dois revisores incorporadas.
Substitui a SPEC-v2. Fontes de requisito: RH · Gerência de Projetos · Liderança Técnica · Gestão de Pessoas.
Revisão: Revisor de Qualidade (*aprovada com 7 bloqueantes*) · Revisor Técnico (*aprovada com 12 bloqueantes*).

---

## 0. O que mudou da v2, e por quê

| # | Mudança | Origem |
|---|---|---|
| 1 | **Dois arquivos**: `Squad.xlsx` e `Gestor.xlsx` | Qualidade. A v2 prometia abas "só Gestor" num arquivo que a própria §1 admitia não ter controle de acesso. Uma das duas era mentira |
| 2 | **11 → 6 competências** | Qualidade. 11 × 2 avaliadores em 8 min = 20s por nota. "Não é avaliação, é preenchimento" |
| 3 | **18 → 8 alertas**, com carência e teto de 5 por pessoa | Qualidade. 40 linhas de alerta na primeira abertura = aba nunca mais aberta |
| 4 | **Chave de `Avaliação` inclui `ID_ALOC`** | Técnico. Sem isso, pessoa com 2 alocações colide na mesma célula e o `AVERAGEIFS` promedia duas realidades — violando a Regra 3 por acidente |
| 5 | **Pesos por eixo, sem depender de papel** | Técnico (Regra B). Elimina na origem a ambiguidade de quem é Dev num contrato e Tech Lead em outro |
| 6 | **`Idx_Ciclo` inteiro em toda aba de fato** | Técnico. `"2026-Q1" < "2026-Q2"` funciona por acidente lexicográfico; `+2 ciclos` não funciona de jeito nenhum |
| 7 | **Distintos pela coluna `Novo_*` na aba de fato** | Técnico. Força bruta sobre lista de avaliadores fica errada no dia em que alguém é contratado, sem avisar |
| 8 | **Ocorrências 200 → 600 linhas** | Ambos. 60 pessoas × 2/mês × 3 meses = 360/ciclo. "A planilha morre justamente por funcionar" |
| 9 | **Alerta `Nota sustentada por omissão`** | Qualidade. Ver §2, contradição resolvida |
| 10 | **Colapso de ocorrências antigas vira coluna + filtro** | Técnico. `outlineLevel` do openpyxl é estático: congela o dia da geração e mente a partir do ciclo seguinte |
| 11 | **Obrigatoriedade declarada como detectiva, não preventiva** | Técnico. Validação de dados não torna campo obrigatório — célula em branco nunca dispara DV |
| 12 | **§13 reescrita: o portão de validação mudou de motor** | Medição própria. Ver §13 |

---

## 1. Objetivo e limite

Instrumento para GP e Líder Técnico avaliarem desempenho, registrarem o dia a dia e gerarem insumo
para 1:1, feedback, PDI, mérito e decisão difícil.

**O registro contínuo é o produto; a nota é subproduto.** Se só uma aba sobreviver, é `Ocorrências`.

**Limite honesto, escrito na própria planilha:** Excel não tem controle de acesso por linha nem
trilha de auditoria. A separação em dois arquivos é o único controle de acesso que o formato paga.
Serve para provar o modelo em 2–3 ciclos. Depois, migra.

---

## 2. As nove regras duras

1. `3` = atende plenamente **para a senioridade**. Não é nota ruim.
2. Nota `1`, `2` ou `5` exige ocorrência vinculada no ciclo. Sem lastro, a avaliação não fecha.
3. **Nunca** média entre notas de avaliadores. Divergência é informação, não erro. Vale para GP×LT **e para GP×GP** em pessoa multi-alocada.
4. Ocorrência negativa nunca comunicada **não entra no ciclo**.
5. `Fato observável` sem adjetivo de personalidade.
6. Comparação e ranking sempre por **gap vs. expectativa da senioridade**. Nunca nota bruta, nunca entre squads.
7. Sem curva forçada.
8. Conduta, assédio, denúncia e saúde **não entram nesta planilha**, em nenhuma aba, em nenhum dos dois arquivos.
9. **Nota ≥ 3 com ocorrência negativa não comunicada no ciclo acende `Nota sustentada por omissão`.**

> **A contradição que a regra 9 resolve.** A regra 2 exige lastro para nota 2; a regra 4 tira do
> ciclo a ocorrência não comunicada. Logo, o GP que não deu o feedback era *obrigado* a dar 3 — a
> planilha convertia a omissão do gestor em nota melhor para a pessoa, em silêncio. O alerta é
> endereçado **ao gestor do GP**, nunca à pessoa avaliada.

---

## 3. Modelo de dados

```
Pessoas    (ID_PESSOA, texto "P001")  ──┬── Alocações (ID_ALOC → ID_PESSOA)
                                        ├── Avaliação  (ID_PESSOA + Idx_Ciclo + Competência + ID_ALOC)
                                        ├── Ocorrências(ID_PESSOA)  [ID_ALOC como contexto do fato]
                                        ├── PDI        (ID_PESSOA + Idx_Ciclo)
                                        └── [Gestor.xlsx] Retenção · Caso de Promoção · Registro do Gestor
```

**Regras de chave, todas obrigatórias:**

- `ID_PESSOA` é **sempre texto** (`P001`), nunca gerado por concatenação numérica. Inteiro em uma aba e texto em outra faz `COUNTIFS` devolver **0 sem erro**.
- `Idx_Ciclo` é **sempre inteiro**: `ano*4 + trimestre`. Nenhuma comparação temporal usa o texto `AAAA-Qn`.
- Toda aba de fato nasce com **chave concatenada** (`ID|Ciclo`, `ID|Ciclo|Eixo`, `ID|Data`), para que `COUNTIFS`/`AVERAGEIFS` usem 1 critério em vez de 3.
- **`Papel` não entra no cálculo.** Pesos por eixo são únicos e editáveis; papel é contexto exibido. Isso elimina a ambiguidade de quem é Dev/QA num contrato e Tech Lead em outro.
- `Painel` tem **uma linha por pessoa**. Coluna `Multi-alocação` visível quando houver mais de uma.
- Visão por contrato **não é uma segunda aba**: é uma coluna de gap em `Alocações` mais o filtro. Segunda aba = segunda fonte de verdade.

---

## 4. Abas — 10 no arquivo de squad, 4 no do gestor

**`Squad.xlsx`** — GP, LT e Gestor enxergam:
`Instruções` · `Painel` · `Ocorrências` · `Avaliação` · `1a1` · `PDI` · `Alertas` · `Pessoas` · `Alocações` · `Config`

**`Gestor.xlsx`** — só o Gestor de Pessoas:
`Instruções` · `Retenção` · `Caso de Promoção` · `Registro do Gestor`

Cortadas da v2: `Âncoras` (vira comentário na célula de nota — âncora que exige trocar de aba não é
lida), `Competências` (vira bloco em `Config`), `Reuniões 1a1` (vira coluna `Última 1:1` em `Pessoas`
+ o bloco de compromissos da aba `1a1`), `Pauta 1a1` (vira a aba `1a1`, agora **imprimível**).

O gestor de squad convive com **4 abas de trabalho**: Painel, Ocorrências, Avaliação, 1a1.

---

## 5. As 6 competências

| Eixo | Competência | Avaliador dono | Peso do eixo |
|---|---|---|---|
| A — Entrega | Previsibilidade | GP | 35% |
| A — Entrega | Qualidade da entrega | Líder Técnico | |
| B — Técnico | Domínio técnico | Líder Técnico | 30% |
| B — Técnico | Design de solução | Líder Técnico | |
| C — Colaboração | Comunicação e colaboração | Compartilhado | 20% |
| D — Autonomia | Autonomia e ownership | Compartilhado | 15% |

Âncoras de comportamento para as notas 1 a 5 entram como **comentário na célula de nota**, não em aba
separada. A nota é sempre relativa à senioridade.

---

## 6. `Ocorrências` — dois blocos, obrigatoriedade condicional

**Bloco rápido — sempre, alvo de 45s. Um único campo de texto:**
`Data do fato` · `Pessoa` · `Registrado por` · `Papel do autor` · `Tipo` · `Competência` ·
**`Fato observável`** (único texto livre) · `Impacto` (menu: Cliente / Equipe / Entrega / Nenhum) ·
`Confidencialidade`

**Bloco de sinalização — só quando `Tipo` = Ponto de atenção ou Incidente. Fica fisicamente à direita, fora do congelamento:**
`Consequência observada` · `Comunicado?` · `Data da comunicação` · `Quem comunicou` ·
`Expectativa declarada` · `Prazo dado` (menu de offset: 7 dias / 14 dias / 1 ciclo) ·
`Reavaliação em` (**calculada** a partir do offset) · `Reação da pessoa` (Reconheceu / Discordou /
Trouxe contexto) · `Desfecho`

> Duas datas digitadas é o que estoura o cronômetro — por isso `Prazo dado` é menu e `Reavaliação em` é calculada.
> Discordância registrada **não enfraquece** o caso: prova que houve conversa.

**Calculadas:** `Idx_Ciclo` · `Registro válido?` · `Viaja no handover?` · `Novo_avaliador` · `Novo_squad` · `Exibição`

**A obrigatoriedade é detectiva, não preventiva — e isso está escrito nas `Instruções`.** Ninguém é
impedido de salvar uma ocorrência incompleta. O que o modelo garante é que a linha incompleta **não
conta**: não entra no lastro, não viaja no handover, e acende alerta. Chamar de "obrigatório" sem
essa nota é vender o que não existe.

**`Viaja no handover?` = "Não"** para negativa não comunicada, ou aberta sem desfecho. Fato que o GP
anterior nunca falou **morre com a alocação**.

**Ocorrência antiga não colapsa sozinha** — impossível sem macro. Coluna `Exibição`
(Ativa / Histórico / Arquivada) + cinza-claro + `auto_filter`. Erro tratado não se cobra três vezes,
mas quem esconde é o filtro, não a fórmula.

---

## 7. `Avaliação`

Chave: `ID_PESSOA + Idx_Ciclo + Competência + ID_ALOC`.

`Nota GP` · `Nota LT` · `Divergência` · `Sugestão` · `Nota final` · `Decisor da nota final` ·
`Origem da nota final` (= GP · = LT · = ambos · **nenhuma das duas**) · `Motivo do desempate` ·
`Base de observação GP` / `LT` (Diária · Cerimônias · Esporádica · **Insuficiente**) ·
`Papel acumulado` · `Ocorr. vinculadas` · `Lastro` · `Justificativa` · `Data da calibração`

- `Base de observação` = "Insuficiente" força a nota a `N/O`. Nota de um LT que entrou há três semanas não pesa igual à de quem está há um ano.
- **`Papel acumulado` = Sim quando o Líder Técnico É o Gestor de Pessoas** (comum em squad pequena). Nesse caso o desempate **sobe um nível** (gestor do gestor, ou RH) sempre que a divergência for 2+, e o `Motivo do desempate` é obrigatório em **toda** divergência. Sem isso, a pessoa dá a nota, decide a final, e a divergência vira "eu contra o GP" com o placar na mão dela.
- **Dois GPs discordando** (pessoa multi-alocada): resolvido pela chave. Cada alocação tem sua linha, com autor identificado. Se a `Base de observação` for pior que "Cerimônias" **e** a alocação < 30%, a nota entra como contexto, não como voto.

---

## 8. `Painel`

**Primeira linha, antes de tudo:** *"Sem nenhum registro neste ciclo: Ana, Bruno, Rafael (3 de 12)."*
É a única métrica que mede **o gestor**, não a equipe.

**Célula de saúde:** `Ocorrências: 412 / 600`, destacada a partir de 80%. Sem ela, a aba enche e as
fórmulas param de enxergar as linhas novas — número errado sem erro, o pior modo de falha possível.

Por pessoa: médias por eixo · nota ponderada · expectativa · gap · faixa · ocorrências no ciclo ·
positivas · negativas · dias desde 1:1 · divergências 2+ · notas sem lastro · negativas não
comunicadas · `Multi-alocação` · `Quadrante` (risco × desempenho) · `Sinal`.

Guarda obrigatória: `MAXIFS` sem match retorna **0**, e 0 lido como data é 30/12/1899. Todo `MAXIFS`
de data vem precedido de `COUNTIFS(...)=0`.

---

## 9. `1a1` — uma folha A4 imprimível

Uma célula de seleção de pessoa e, abaixo, a página pronta: últimas 5 ocorrências (reconhecimentos
primeiro), gap do ciclo por competência, PDI aberto, **o que o gestor prometeu e ainda deve**, as
quatro perguntas de escuta, e linhas em branco para anotar à mão. Área de impressão definida.

> O gestor leva a folha na conversa e olha para a pessoa, não para a tela.

---

## 10. `Gestor.xlsx`

**`Retenção`** — uma linha por avaliação de risco, **com data**, nunca atributo permanente.
`Nível` · `Fator` · `Base do sinal` (Declarado pela pessoa / Observado por mim / Terceiro reportou) ·
`Ação` · `Prazo` · `Status` · `Idx_Validade` (= idx do ciclo + 2) · `Vigente?`
A validade é o mecanismo central: risco não reafirmado esvazia sozinho. É a única defesa contra
"risco alto" de 2024 virar cicatriz que o próximo gestor lê como fato.

**Matriz risco × desempenho** (no Painel, por gap): **alto desempenho × alto risco é o único
quadrante com prazo — ação em 15 dias**, com fator identificado e contrapartida concreta. Conversa
vaga não conta como ação. Registrar o desfecho: retida / continua em risco / saiu.

**`Caso de Promoção`** — trajetória, não ciclo. Tempo no nível · gap médio dos últimos 3 ciclos ·
ciclos consecutivos com gap ≥ 0 · gap vs. o **próximo** nível · densidade de evidência ·
**diversidade de evidência** (via `SUMIFS` da coluna `Novo_avaliador`) · `Evidência de escopo
ampliado` (texto) · `Veredito`.
**No ciclo 1 o veredito é `Sem base`, nunca `Caso frágil`.** "Frágil" é juízo sobre a pessoa; emiti-lo
por ausência de dados que ainda não podiam existir é injusto e queima a ferramenta na primeira semana.

**`Registro do Gestor`** — aspirações de carreira, compromissos assumidos, feedback de terceiros,
padrões entre ciclos. Com destaque de **compromissos que vencem nos próximos 7 dias**: compromisso
registrado sem prazo visível só documenta a dívida, não paga.

---

## 11. Alertas — 8, com carência

`Config!Ciclo_inicial` suprime todo alerta que depende de série histórica enquanto não houver ciclos
suficientes, exibindo `—`. **Teto de 5 alertas visíveis por pessoa**, por gravidade.

1. Sem avaliação no ciclo
2. Nota sem lastro
3. **Nota sustentada por omissão** (regra 9)
4. Negativa não comunicada há mais de 30 dias
5. Divergência 2+ sem justificativa
6. Gap negativo há 2 ciclos e nenhuma ocorrência comunicada
7. Risco alto sem ação há mais de 15 dias · handover pendente
8. **Carga de gestão acima de 15 liderados** — acima disso a nota final vira média disfarçada e ninguém percebe

Fora: nota chapada, concentração no último mês, sem ocorrência há 45d, aniversário de tempo no nível,
PDI sem movimento, 3+ negativas sem positiva, 3 ciclos com gap ≥ 0 sem caso montado. Todos legítimos,
nenhum urgente, e juntos afogam os 8 que importam.

---

## 12. Restrições de construção — verificadas por código

| Restrição | Valor |
|---|---|
| Referência de coluna inteira (`$B:$B`) | **proibida** — o gerador falha o build se encontrar |
| `INDEX(expr,0)`, `MATCH` sobre expressão, produto de intervalos, `SUMPRODUCT` matricial | **proibidos nominalmente** |
| `XLOOKUP` `FILTER` `UNIQUE` `SORT` `SEQUENCE` | proibidos |
| Permitidas | `SUMIFS` `COUNTIFS` `AVERAGEIFS` `INDEX` `MATCH` `IFERROR` `TEXT` `IF` |
| Com prefixo `_xlfn.` | `MAXIFS` `MINIFS` — máx. 4 por linha do Painel |
| `TODAY()` | **uma vez no arquivo**, em `Config`. Não uma por linha |
| Linhas | Ocorrências 600 · Avaliação 660 · PDI 100 · Retenção 100 |
| `IFERROR` | só onde o vazio é estado legítimo. **Nunca** em volta de `INDEX/MATCH` contra cadastro — ali `#N/A` é a informação (ID órfão) |
| Contagem de preenchimento | por critério explícito (`">0"`, `"OK"`, `"?*"`). **Nunca `COUNTA`** sobre área calculada: `""` de fórmula conta como preenchido |
| Nomes de aba | uma constante Python por aba, com aspas simples, usada em toda interpolação |
| Letras de coluna | derivadas de `COLS_*.index(...)`, nunca literais na string da fórmula |
| Datas | sempre `datetime.date`; `number_format` é só exibição |
| Geração | sempre do zero. **Nunca round-trip** — `_xlfn.MAXIFS` relido e regravado vira `_xlfn._xlfn.MAXIFS` e a função morre |
| `wb.calculation.fullCalcOnLoad` | `True` |

---

## 13. Validação — o portão mudou de motor

**Achado que invalidou a §13 da v2:** o LibreOffice deste ambiente **não carrega nenhum `.xlsx`** —
verificado com um arquivo de três células, que estoura igual. As cinco variantes da bissecção de
performance estouraram no mesmo tempo por isso: nenhuma chegou a ser calculada. O recálculo por
LibreOffice não é um portão disponível aqui, e a v2 prometia um portão que o ambiente não paga.

**Portão novo, e mais forte:** o motor `formulas` (Python puro) carrega e **calcula** o arquivo —
medido: 33,7s, com nomes de aba acentuados. Ele devolve **valores**, não só "executou sem erro".

Plano de validação, em ordem, tudo automatizado no gerador:

1. **Validador estático**, antes de `wb.save()`: varre toda célula de fórmula e falha o build se achar
   coluna inteira, função proibida, `INDEX(expr,0)`, `_xlfn.` duplicado, aba inexistente, ou letra de
   coluna que não bate com o cabeçalho declarado. *Regra que não é verificada por código não existe.*
2. **Modelo-sombra em Python**: calcula, a partir dos dados-semente, o que cada célula-chave deve
   retornar (média por eixo, nota ponderada, gap, contagens, lastro, cada alerta).
3. **Execução com `formulas`** e comparação célula a célula contra o modelo-sombra. Divergência
   reprova o build. É o que pega o erro que o revisor técnico descreveu: *"fórmula que roda limpo com
   intervalo errado dá número errado sem avisar"*.
4. **Teste das regras duras**: forçar nota 5 sem ocorrência → tem que acusar. Marcar negativa como não
   comunicada → tem que sair do cálculo, acender o alerta 3 e o `Viaja no handover? = Não`.
5. **Teste de 60 segundos**: cronometrar o lançamento de uma ocorrência positiva usando só os menus.
6. **Auditoria independente** do arquivo pronto, por agente que não participou da construção.

**Baseline já medido na v1**, com os 6 valores conferidos à mão: nota ponderada 3,225 ·
gap 0,225 · ocorrências no ciclo 2 · lastro OK · sem avaliação 2 · notas sem lastro 0. Todos corretos.

---

## 14. Fora de escopo, declarado

Conduta e denúncia · remuneração e faixa salarial · controle de acesso por linha · integração com
Jira/GitHub · avaliação 360 e autoavaliação · trilha de auditoria de edição · colapso automático de
linhas antigas (impossível sem macro).

---

## 15. Premissas sem lastro, marcadas como tal

As expectativas por senioridade (Júnior 2,7 · Pleno 3,0 · Sênior 3,2 · Especialista 3,4) e os pesos
por eixo **são premissa desta versão, não benchmark**. Entregues preenchidas — em branco, `Gap` vira
`""` e derruba em cascata o Painel, a matriz, o caso de promoção e dois alertas — mas rotuladas
`premissa v0 — não calibrada`, com coluna `Confirmado por / em` em `Config` e um alerta se seguir
vazia ao fim do ciclo 1. Premissa visível e datada é honesta; campo vazio é só omissão.
