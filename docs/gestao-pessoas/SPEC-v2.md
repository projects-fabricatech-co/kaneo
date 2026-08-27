# Spec v2 — Planilha de Avaliação de Desempenho por Squad

Status: **em revisão**. Nada é construído antes do aceite do revisor de qualidade e do revisor técnico.
Fontes de requisito: RH · Gerência de Projetos · Liderança Técnica · Gestão de Pessoas.

---

## 1. Objetivo e limite

Instrumento para GP e Líder Técnico avaliarem desempenho, registrarem o dia a dia e gerarem
insumo para 1:1, feedback, PDI, mérito e decisão difícil.

**O registro contínuo é o produto; a nota é subproduto.** Se só uma aba sobreviver, é `Ocorrências`.

**Limite honesto, escrito na própria planilha:** Excel não tem controle de acesso por linha nem
trilha de auditoria confiável. Serve para provar o modelo em 2–3 ciclos. Depois, migra.

---

## 2. As oito regras duras

Cada uma existe porque a ausência dela produz um defeito, não uma dúvida.

1. `3` = atende plenamente **para a senioridade**. Não é nota ruim.
2. Nota `1`, `2` ou `5` exige ocorrência vinculada no ciclo. Sem lastro, a avaliação não fecha.
3. **Nunca** média entre nota do GP e do LT. Divergência é informação, não erro.
4. Ocorrência negativa nunca comunicada **não entra no ciclo**.
5. `Fato observável` sem adjetivo de personalidade. O juízo vai em `Consequência`.
6. Comparação e ranking sempre por **gap vs. expectativa da senioridade**, nunca por nota bruta, nunca entre squads.
7. Sem curva forçada.
8. Conduta, assédio, denúncia e saúde **não entram nesta planilha**, em nenhuma aba.

---

## 3. Modelo de dados — a decisão que a v1 errou

A v1 chaveava tudo por **alocação**. Consequência: o histórico se fragmenta a cada realocação e
"consistência entre ciclos" fica impossível de calcular. A v2 separa:

```
Pessoas       (ID_PESSOA)  ──┬── Alocações   (ID_ALOC → ID_PESSOA)   1 pessoa : N alocações
                             ├── Avaliação   (ID_PESSOA + Ciclo + Competência)
                             ├── Ocorrências (ID_PESSOA)   [carrega ID_ALOC como contexto]
                             ├── PDI         (ID_PESSOA + Ciclo)
                             ├── Retenção    (ID_PESSOA + Data)
                             └── Registro do Gestor (ID_PESSOA)
```

**Regra de chave:** avaliação, desenvolvimento e histórico pertencem à **pessoa**.
Squad, contrato, GP e LT são **contexto do fato**, gravados na ocorrência no momento em que ela
ocorre — assim o histórico viaja com a pessoa sem perder onde aconteceu.

`Painel` passa a ter **uma linha por pessoa** (não por alocação). Isso corrige o duplo cômputo
da v1, em que quem estava 50% em dois contratos aparecia duas vezes com a mesma nota.

---

## 4. Abas

Ordem de abertura, não de construção.

| # | Aba | Dono | Quem enxerga | Papel |
|---|---|---|---|---|
| 1 | `Instruções` | RH | todos | Regras duras, LGPD, legenda |
| 2 | `Painel` | GP / Gestor | GP, LT, Gestor | Segunda de manhã. 1 linha por pessoa |
| 3 | `Ocorrências` | GP / LT | GP, LT, Gestor | Registro contínuo |
| 4 | `Avaliação` | GP + LT + Gestor | GP, LT, Gestor | 1 linha por pessoa × competência × ciclo |
| 5 | `Pauta 1a1` | GP / Gestor | GP, LT, Gestor | Monta sozinha |
| 6 | `PDI` | Gestor | todos + colaborador | Máx. 2 focos por ciclo |
| 7 | `Caso de Promoção` | Gestor | Gestor | Trajetória, não ciclo |
| 8 | `Retenção` | Gestor | **só Gestor** | Risco datado, com validade |
| 9 | `Registro do Gestor` | Gestor | **só Gestor** | Carreira, promessas, terceiros |
| 10 | `Alertas` | RH | todos | Integridade do ciclo |
| 11 | `Reuniões 1a1` | GP / Gestor | GP, LT, Gestor | Alimenta o alerta de 1:1 atrasada |
| 12 | `Pessoas` | Gestor | cadastro | ID estável, senioridade, tempo no nível |
| 13 | `Alocações` | GP | cadastro | 1 linha por alocação |
| 14 | `Competências` | RH | cadastro | 11 competências, 4 eixos |
| 15 | `Âncoras` | RH | cadastro | Comportamento por nota 1–5 |
| 16 | `Config` | RH | cadastro | Escala, pesos, expectativas, listas |

**Risco reconhecido:** 16 abas é muito. Mitigação: 5 são cadastro (mexe uma vez), 2 são privadas
do gestor, 1 é instrução. O gestor de squad convive com 6. *Ponto explícito para o revisor.*

---

## 5. Aba `Ocorrências` — o conflito central, resolvido

Tensão real entre as fontes: o GP precisa lançar em **60 segundos** ou abandona na terceira
semana; o Gestor de Pessoas precisa de campos de **sinalização formal** ou nenhum PIP se sustenta.

**Resolução: dois blocos, com obrigatoriedade condicional.**

**Bloco rápido — sempre obrigatório, alvo de 45s** (6 dos 10 são menu suspenso):
`Data do fato` · `Pessoa` · `Registrado por` · `Papel do autor` · `Tipo` · `Competência` ·
`Fato observável` · `Impacto` · `Consequência observada` · `Confidencialidade`

**Bloco de sinalização — obrigatório APENAS quando `Tipo` = Ponto de atenção ou Incidente:**
`Comunicado?` · `Data da comunicação` · `Quem comunicou` · `Expectativa declarada` ·
`Prazo dado` · `Reavaliação em` · `Reação da pessoa` (Reconheceu / Discordou / Trouxe contexto) · `Desfecho`

> Discordância registrada **não enfraquece** o caso — fortalece, porque prova que houve conversa.

**Calculadas:** `Ciclo` (derivado da data) · `Registro válido?` · `Viaja no handover?` · `Seq. p/ pauta`

**Regras:**
- `Viaja no handover?` = "Não" se negativa não comunicada, ou aberta sem desfecho. Fato que o GP anterior nunca falou **morre com a alocação**.
- Ocorrência tratada, com desfecho positivo, há mais de 2 ciclos: aparece colapsada no histórico. Erro tratado não se cobra três vezes.
- Nenhum PIP sem **2 ocorrências comunicadas, em datas distintas, com prazo dado e reavaliação registrada**.

---

## 6. Aba `Avaliação` — dono da decisão

Colunas novas em relação à v1:

| Coluna | Regra |
|---|---|
| `Decisor da nota final` | Sempre o Gestor de Pessoas. A nota final é decisão, não cálculo |
| `Origem da nota final` | = GP · = LT · = ambos · **nenhuma das duas** (calculada) |
| `Motivo do desempate` | **Obrigatório** quando a origem é "nenhuma das duas" |
| `Base de observação GP` / `LT` | Diária · Cerimônias · Esporádica · **Insuficiente** |

`Base de observação` = "Insuficiente" força a nota a entrar como `N/O`. Nota de um LT que entrou
há três semanas não pode pesar igual à de quem está há um ano — a v1 tratava as duas como iguais.

Mantido da v1: `Nota GP`, `Nota LT`, `Divergência`, `Sugestão`, `Nota final`, `Ocorr. vinculadas`,
`Lastro`, `Justificativa`, `Data da calibração`.

**Desempate:** divergência 1 → decide o avaliador dono da competência. Divergência 2+ → cada lado
traz uma ocorrência; se só um tem evidência, a nota dele prevalece. Nunca a média.

---

## 7. Aba `Retenção` — risco que expira

Uma linha **por avaliação de risco, com data**. Nunca um atributo permanente da pessoa.

`Data` · `Pessoa` · `Nível` (Baixo/Médio/Alto) · `Fator` (Remuneração · Alocação · Carreira travada ·
Relação com liderança · Carga · Fora do trabalho · Não identificado) · `Base do sinal`
(**Declarado pela pessoa** / Observado por mim / Terceiro reportou) · `Ação` · `Prazo` · `Status` ·
`Validade` (calculada: +2 ciclos) · `Vigente?` (calculada)

**A validade é o mecanismo central.** Risco não reafirmado esvazia sozinho — é a única defesa
contra "risco alto" de 2024 virar cicatriz que o próximo gestor lê como fato.

**Visível só ao Gestor.** Se o GP vê, muda como aloca a pessoa, e vira profecia autorrealizável.

**Matriz risco × desempenho** (no Painel, usando gap, não nota bruta):
- **Alto desempenho × alto risco** — único quadrante com **prazo: ação em 15 dias**, com fator identificado e contrapartida concreta. Conversa vaga não conta como ação. Registrar o desfecho: retida / continua em risco / saiu. Quem não fecha o loop nunca aprende por que perde gente.
- **Alto × baixo risco** — desafiar antes que vire alto risco.
- **Baixo × alto risco** — não reter por reflexo; tratar o desempenho.
- **Baixo × baixo risco** — acomodação. O quadrante mais ignorado.

---

## 8. Aba `Caso de Promoção` — trajetória, não ciclo

Uma linha por pessoa. Tudo calculado; nada redigitado.

`Tempo no nível (meses)` · `Gap médio vs. expectativa nos últimos 3 ciclos` ·
`Ciclos consecutivos com gap ≥ 0` · `Gap vs. expectativa do PRÓXIMO nível` ·
`Densidade de evidência` (nº de ocorrências vinculadas) · `Diversidade de evidência`
(nº de avaliadores distintos) · `Contribuição além da entrega` (mentoria, incidente fora do escopo,
disseminação) · `Variação de contexto` (mudou de squad/cliente?) · `Veredito` (calculado)

**`Veredito` = "Caso frágil" quando:** um único ciclo bom depois de dois medianos · todas as notas
altas do mesmo avaliador · nota 5 sem lastro · zero contribuição além da entrega · gap positivo no
técnico e negativo em colaboração · um único ciclo desde a última promoção.

> Promover um bom executor para um nível que exige influência quebra a pessoa e perde duas de uma vez.

---

## 9. Aba `Registro do Gestor` — privada

O que nem GP nem LT registram jamais, e onde mora metade do trabalho do gestor:

`Data` · `Pessoa` · `Tipo` (Aspiração de carreira · Compromisso que assumi · Feedback de terceiro ·
Contexto pessoal relevante · Leitura de padrão entre ciclos) · `Registro` · `Prazo` · `Status`

**Compromisso assumido e não registrado é dívida invisível** — e é a principal causa de pedido de
demissão surpresa. `Instruções` reitera aqui: nada de saúde, vida pessoal ou conduta.

---

## 10. Continuidade — o que viaja com a pessoa

| Viaja | Não viaja |
|---|---|
| Notas e gaps por ciclo, **com o contexto anexo** (squad, GP, LT, cliente) | Ocorrência negativa nunca comunicada |
| PDI aberto e compromissos do gestor | Ocorrência aberta sem desfecho |
| Tempo no nível e histórico de promoções | Avaliação de risco fora da validade |
| Ocorrências comunicadas e reavaliadas, com desfecho | Texto com adjetivo de personalidade |
| PIP encerrado, com resultado | Divergência GP×LT não resolvida |

**Handover mediado pelo Gestor, nunca GP→GP direto.** Campos `Handover feito em` e
`Pontos transferidos` na aba `Alocações`. No primeiro ciclo com novo GP, a `Base de observação`
sinaliza que a janela é curta e a nota entra como ponto novo, sem substituir a série.

---

## 11. Alertas (aba `Alertas`)

Herdados da v1: sem avaliação no ciclo · nota sem lastro · negativa não comunicada · divergência 2+ ·
sem ocorrência há 45d · sem 1:1 há 30d · nota chapada · registro inválido · 3+ negativas e nenhuma
positiva · concentração no último mês.

**Novos, da Gestão de Pessoas:**
- Gap negativo há 2 ciclos e **nenhuma ocorrência comunicada** → falha do gestor, não da pessoa.
- 3 ciclos com gap ≥ 0 e **sem caso de promoção montado** → *"estou perdendo essa pessoa e ainda não sei"*.
- Risco alto sem ação registrada há mais de 15 dias.
- PDI sem movimento há 60 dias.
- Aniversário de tempo no nível (12 / 18 / 24 meses).
- Ocorrência marcada como não comunicada há mais de 30 dias.
- Handover pendente após troca de squad.
- **Carga de gestão acima de 15 liderados** — acima disso a nota final vira média disfarçada e ninguém percebe.

---

## 12. Orçamento de performance — restrição, não recomendação

A v1 estourou o recálculo: referência de coluna inteira × milhares de linhas em branco.

| Restrição | Valor |
|---|---|
| Referência de coluna inteira (`$B:$B`) | **proibida**. Todo intervalo é limitado ao bloco útil |
| Linhas por aba de fato | Ocorrências 200 · Avaliação 200 · PDI 100 · Retenção 100 · Reuniões 100 |
| Funções permitidas | Excel 2007: `SUMIFS` `COUNTIFS` `AVERAGEIFS` `INDEX` `MATCH` `IFERROR` `TEXT` |
| Com prefixo `_xlfn.` | `MAXIFS` `MINIFS` |
| **Proibidas** | `XLOOKUP` `FILTER` `UNIQUE` `SORT` `SEQUENCE` `SUMPRODUCT` em matriz, fórmula matricial |
| Voláteis | `TODAY()` no máximo 1 por linha |
| Meta | Recálculo completo em < 90s |

---

## 13. Plano de validação — como sabemos que ficou bom

1. **Recálculo limpo**: `errors_found = 0`. Erro de fórmula não é entregável.
2. **Verificação de valor, não só de execução**: conferir 5 células calculadas contra o cálculo feito à mão. Fórmula que roda limpo com intervalo errado dá número errado sem avisar.
3. **Teste das regras duras**: forçar nota 5 sem ocorrência → tem que acusar. Marcar negativa como não comunicada → tem que sumir do cálculo e acender alerta.
4. **Teste de 60 segundos**: cronometrar o lançamento de uma ocorrência positiva usando só os menus.
5. **Auditoria independente** do arquivo pronto, por agente que não participou da construção.

---

## 14. Fora de escopo, declarado

Conduta e denúncia · remuneração e faixa salarial · controle de acesso por linha · integração com
Jira/GitHub · avaliação 360 e autoavaliação · trilha de auditoria de edição.

---

## 15. Perguntas abertas para os revisores

1. 16 abas é sustentável, ou o modelo precisa quebrar em dois arquivos (squad / gestor)?
2. O bloco de sinalização formal em `Ocorrências` mata o alvo de 60s do GP, mesmo sendo condicional?
3. `Painel` por pessoa resolve o duplo cômputo — mas o GP perde a visão por contrato. Precisa das duas?
4. 11 competências × 4 eixos: honesto ou já é excesso para um ciclo trimestral de 8 min/pessoa?
5. Expectativas (Jr 2,7 · Pleno 3,0 · Sr 3,2 · Esp 3,4) são premissa sem lastro. Melhor entregar em branco, forçando o gestor a definir?
