# Vale Desconto — o que falta

O produto está funcional de ponta a ponta: cadastro, loja, programa, carimbo,
cartão público, prêmio, validação, cupons, painel, planos com Stripe em BRL,
landing e os textos jurídicos. Este documento é o que **não** está feito.

Cada item diz o que é, por que não foi feito ainda, e como saber que acabou.
Nada aqui é especulação: os itens de segurança vieram de uma auditoria com
ataques executados contra a aplicação rodando, e os de gestão vieram do plano
de administração da plataforma.

> As Issues do GitHub estão desabilitadas neste repositório. Enquanto estiverem,
> este arquivo é o backlog. Se elas forem habilitadas em
> *Settings → General → Features*, cada seção abaixo vira uma issue direto.

---

## Segurança — aberto

Cinco achados que sobraram da auditoria. Os outros seis já foram corrigidos
(segredo de auth falhando fechado, CORS com allowlist, limite de corpo, URL de
logo validada, link do cartão só para quem acabou de ser cadastrado, e o
limitador do resgate reescrito).

### S1 · Cadastro sem teto na escrita pública — **alto**

`POST /api/public/coupon/:token/claim` é a única escrita não autenticada do
produto. O cadastro do cliente acontece **fora** do teto da campanha — decisão
documentada em `claim-public-coupon.ts`: o id do cliente é o que torna os passos
seguintes idempotentes.

Demonstrado na auditoria: **238 clientes sintéticos criados girando
`X-Forwarded-For`, a 157 requisições por segundo.** Em plano pago não há teto de
clientes, então a lista da loja, os contadores e o banco crescem sem limite.

O limitador atual conta o telefone como eixo primário e o IP como orçamento
secundário — blinda o script que gira telefones de um endereço, mas **um IP
forjado por requisição continua passando**, porque nada no processo sabe qual
proxy é confiável.

*Depende de você:* qual proxy vai na frente em produção e quantos saltos. Confiar
no último salto quando há dois proxies é confiar em quem forja.

**Feito quando:** a profundidade de proxy confiável está configurada; existe um
teto absoluto de cadastros por campanha por janela, independente de telefone e
IP; e um teste de integração prova que N requisições com IP rotativo não criam
N clientes.

`public/controllers/claim-public-coupon.ts` · `public/claim-rate-limit.ts`

### S2 · `stripeCustomerId` obsoleto inutiliza checkout e portal — **médio**

Se o cliente não existe mais no Stripe — apagado no painel, ou troca de chave
teste/produção — todo checkout responde 500 e não há saída self-service. **O
lojista nunca mais consegue te pagar**, que é a pior forma de falha silenciosa
num SaaS.

**Feito quando:** em `resource_missing`, o código cria outro cliente e sobrescreve
o id guardado, com teste cobrindo o id órfão.

`billing/controllers/create-checkout-session.ts`

### S3 · Colunas de texto sem teto amplificam banda — **médio**

Nome de loja com dois milhões de caracteres foi aceito e servido numa página
pública com `no-store`, então nenhum CDN absorve.

**Feito quando:** teto no schema Valibot e no banco, nas colunas que aparecem em
página pública.

### S4 · O caixa recebe o `publicToken` do cliente — **médio**

A lista de clientes devolve a linha inteira ao caixa, incluindo o `publicToken`,
que é a credencial do cartão. Defensável num app de balcão; projetar a lista para
exatamente o que a tela desenha tira a credencial do fio.

**Feito quando:** o controller da lista projeta campos explícitos e um teste
afirma que o token não aparece na resposta.

### S5 · Rate limit de sessão é memória por processo — **médio**

Quarenta senhas erradas seguidas contra conta real devolveram quarenta 401 e
nenhum 429: o limitador do Better Auth só liga em produção e, quando liga, é por
processo. Com duas instâncias, é inútil.

**Feito quando:** configurado explicitamente, com armazenamento compartilhado.

### S6 · Sem CSP — **médio**

Não há Content-Security-Policy nas páginas públicas.

**Feito quando:** CSP definida e verificada nas rotas públicas.

---

## Jurídico — aberto

### J1 · Preencher a identidade da empresa — **bloqueia a publicação**

`content/legal/identidade.ts` tem `TODO` em razão social, CNPJ, endereço,
encarregado e foro. Enquanto houver, as duas páginas exibem um aviso visível de
que o texto não deve ser considerado publicado — de propósito: **uma política que
não identifica o controlador não identifica ninguém.**

É uma edição, num arquivo, e nada mais depende dela.

### J2 · Exclusão real de titular

Hoje arquivar um cliente é **lógico**: a linha continua no banco e
`findOrCreateCustomer` reencontra o arquivado pelo telefone. A política diz isso
em voz alta em vez de prometer o que o código não faz — mas o art. 18, VI da LGPD
pede eliminação de verdade quando pedida.

**Feito quando:** existe exclusão que apaga a linha e os carimbos, com o telefone
virando hash para não recriar o cadastro, e a seção 9 da política é atualizada
junto.

---

## Gestão da plataforma — não construída

Hoje não existe nenhuma superfície de dono: para saber quanto o negócio fatura ou
por que um lojista reclamou, o caminho é `psql`. O plano abaixo é para **uma
pessoa só** — você — e nasce auditado por padrão, porque a conta de administração
é a mais perigosa do produto: ela enxerga a base de clientes de todas as lojas.

**Ordem: A → B → D → C → E**, com uma exceção — se algo do jurídico bloquear o
lançamento, C sobe para antes de D.

### G-A · Ver

Responder "como está o negócio" e "o sistema está de pé" sem abrir o banco.

| Entrega | Detalhe |
|---|---|
| `platform_admins` + middleware + router | A fundação. Sem ela nada abaixo existe. |
| `admin_audit_log` | Quem, qual ação, qual inquilino, quando, **motivo**. Motivo obrigatório em qualquer acesso a dado de cliente final. Append-only. |
| Console `/admin` | Rota gateada, shell própria. Não reaproveita a navegação do lojista. |
| Métricas de negócio | Contas, lojas, clientes, carimbos por dia, MRR, assinaturas por plano e status, conversão Grátis→pago, churn. SQL agregado, como o painel do lojista já faz. |
| Saúde | Últimos eventos Stripe processados, erros de webhook, migração aplicada, latência do banco. |

O MRR sai de `subscriptions` cruzado com o preço do `stripePriceId`,
reaproveitando `billing/config.ts`, que já é a única leitora do mapa de preços.

### G-B · Agir (suporte)

| Entrega | Detalhe |
|---|---|
| Ficha do lojista | Conta, lojas, plano, uso contra cada limite, histórico de cobrança. |
| "Ver como" somente leitura | Primeiro passo do suporte. Reproduz a tela do lojista sem poder escrever. |
| Impersonação com prazo | Só depois, e com consentimento do lojista dentro do app. Sessão curta, faixa visível na tela inteira, tudo no log. Entrar na conta de um lojista é evento de LGPD, não atalho de suporte. |
| Ações administrativas | Conceder plano (cortesia), forçar rebaixamento, suspender conta, encerrar sessões, reenviar link do cartão de um cliente. |
| Reprocessar webhook | Por id de evento, usando a idempotência que já existe em `stripe_event`. |

### G-C · Conformidade operável

A contraparte de engenharia dos textos jurídicos. **Direito de titular sem
ferramenta é promessa que você não cumpre.**

- Exportar todos os dados de um titular — lojista ou cliente final, buscado por telefone normalizado.
- Apagar/anonimizar titular, com registro do pedido e do que foi feito. Decidir o destino dos carimbos já dados (provavelmente anonimizar o cliente e manter o agregado).
- Encerrar conta de lojista: definir o destino dos cartões dos clientes dele.
- Relatório de retenção: o que existe, há quanto tempo, e o que deveria ter sido descartado.

### G-D · Confiabilidade

- **Backup com restauração testada.** Backup que ninguém restaurou não é backup. Ensaio trimestral, com o tempo medido.
- **Alertas** que importam: webhook do Stripe falhando, salto em 401/402, força bruta em código de resgate, qualquer 500.
- **Rate limit** nas rotas de validar e resgatar código. Hoje só o resgate público de cupom tem limite.
- **Runbook**: Stripe fora do ar, banco cheio, lojista reportando carimbo perdido, cliente reportando código recusado.

### G-E · Crescimento

- **E-mail transacional** — `packages/email` já existe no monorepo e está sem uso pelo produto novo.
- **Marcos de ativação**: loja criada → programa criado → 1º carimbo → 10º carimbo → 1º resgate. É a régua que diz se o produto pegou.
- **Cobrança em atraso (dunning)**: hoje o `past_due` só aparece na tela de Planos. Falta a régua de e-mails e o prazo até rebaixar.

---

## O que eu não recomendo construir

- **Painel de BI com ferramenta externa.** Três consultas SQL e uma página
  resolvem o que você precisa saber nos primeiros mil lojistas, e mandar a base
  de clientes para um terceiro cria um subprocessador e uma obrigação de contrato.
- **Impersonação irrestrita como primeira entrega de suporte.** Comece pelo
  somente-leitura.
- **Multi-admin com hierarquia de permissões.** Você é um. Uma tabela e um
  middleware.
