# Por que os textos legais dizem o que dizem

Documento interno. **Não é publicado** — é o que você lê antes de aprovar, alterar
ou levar os textos a um advogado, e o que explica por que uma frase está escrita
daquele jeito e não de outro.

Os textos foram redigidos sem revisão jurídica, por decisão sua. O que dá a eles
alguma solidez não é autoridade, é o fato de cada afirmação factual ter sido
conferida contra o código. O risco que resta é de **interpretação da lei**, não de
descrição errada do produto.

---

## 1. A decisão estruturante: quem é o controlador do cliente final

**Escolha:** o **lojista** é o controlador dos dados do cliente final; a Vale
Desconto é **operadora**. Para os dados do próprio lojista (conta, cobrança,
suporte), a Vale Desconto é controladora.

**Por quê:** controlador é quem decide as finalidades e os meios essenciais
(LGPD art. 5º, VI). Quem decide coletar o telefone é o dono da padaria, ao montar
um programa de fidelidade; nós fornecemos a ferramenta e tratamos por conta e
ordem dele. É o mesmo desenho que Shopify, Mailchimp e Stripe usam para os dados
dos clientes dos seus clientes, e é o padrão do mercado de SaaS B2B.

**O que muda se for revisto:** se um dia a Vale Desconto usar a base de clientes
finais para qualquer coisa própria — recomendar lojas, mandar comunicação,
cruzar dados entre lojas — vira **controladora conjunta** e a política inteira
precisa ser reescrita. Enquanto a base for isolada por loja e usada só para o
programa daquela loja, a divisão acima se sustenta.

**Consequência prática já implementada:** o anexo de operador (seção 11 dos
Termos) é o contrato que sustenta essa divisão. Sem ele, o lojista não teria
como comprovar à ANPD que contratou um operador com obrigações definidas.

---

## 2. A escolha mais discutível: a base legal do carimbo no balcão

**Escolha:** **legítimo interesse do lojista** (art. 7º, IX).

**Por quê não consentimento:** consentimento na LGPD precisa ser livre,
informado, inequívoco e **para finalidade determinada** (art. 5º, XII). No
balcão, o cliente fala o número para o atendente. Não há tela, não há caixa
marcada, não há registro do que ele leu. Chamar isso de consentimento seria
inventar um consentimento que não existe — e um consentimento inválido é pior
que uma base legal honesta, porque desmorona exatamente quando é questionado.

**Por que legítimo interesse se sustenta aqui:** o teste do art. 10 pede
finalidade legítima, necessidade e expectativa do titular. A finalidade é
entregar o benefício que a pessoa pediu; o dado é o mínimo (um telefone, nada de
CPF, endereço ou perfil); e a expectativa é evidente — quem entrega o telefone no
caixa da cafeteria sabe que é para o cartão de fidelidade.

**O que a política faz por causa disso:** declara o direito de oposição de forma
destacada (art. 18, §2º), diz que o tratamento é limitado ao programa daquela
loja, e afirma que não há publicidade nem perfilamento. Sem essas três coisas o
legítimo interesse não fecha.

**Onde isso pode cair:** se a ANPD ou um juiz entender que fidelidade exige
consentimento expresso, a correção é de produto, não de texto — passa a ser
preciso capturar aceite no balcão (uma tela que o cliente toca, ou um SMS de
confirmação). Vale saber que essa é a mudança, para não ser surpresa.

---

## 3. Por que o cupom usa consentimento e o balcão não

Na página de campanha o cliente digita o próprio número, numa tela, e pode ler o
que está aceitando. Ali o consentimento é real, então é o que usamos — e por isso
gravamos **carimbo de tempo e versão do texto**, que é o que o art. 8º, §1º
chama de "demonstrar".

Duas bases legais diferentes para o mesmo dado, na mesma tabela, é correto e não
é contradição: a base acompanha o **ato de coleta**, não o campo.

---

## 4. Retenção: descrevemos o que o sistema faz, não o que gostaríamos

Arquivar um cliente hoje é **lógico**: a linha continua no banco, e
`findOrCreateCustomer` reencontra o arquivado pelo telefone se ele voltar a ser
carimbado. Isso é bom para o produto (o histórico não se perde quando o caixa
arquiva alguém por engano) e é uma limitação do ponto de vista de eliminação
(art. 18, VI).

A política **diz isso em voz alta**, em vez de prometer um apagamento que o
código não faz, e oferece o canal para exclusão de verdade. Prometer o que o
sistema não entrega é o erro que transforma uma política em prova contra você.

**Melhoria futura:** uma exclusão real, que apague a linha e os carimbos, com o
telefone virando hash para não recriar o cadastro. Quando existir, a seção 9 da
política muda junto.

---

## 5. Transferência internacional

O Stripe é o único subprocessador que recebe dado pessoal, e recebe apenas dado
do **lojista** — nome, e-mail, e os dados de cartão que ele digita diretamente lá.
Nenhum dado de cliente final sai da nossa base.

Declaramos a transferência (art. 33, II — necessária para execução de contrato do
qual o titular é parte) e nomeamos o fornecedor, o país e o dado. Uma lista de
subprocessadores nomeada é o padrão de mercado e é o que um lojista maior vai
pedir antes de assinar.

---

## 6. Cookies: por que não há banner

Não existe rastreador, pixel, analytics ou cookie de terceiro no produto. O único
cookie é o de sessão do Better Auth, estritamente necessário, e o cliente final
nunca o recebe. Banner de cookies sem cookie a consentir é ruído que treina o
usuário a clicar em "aceitar" sem ler.

Se um dia entrar analytics, o banner passa a ser obrigatório e a seção 7 da
política muda.

---

## 7. Os dois pontos dos Termos que mais merecem um advogado

1. **Limitação de responsabilidade.** Está em 12 meses de mensalidade paga, que é
   o padrão de SaaS. O que varia é se a relação lojista↔plataforma é considerada
   de consumo; se for, cláusulas limitativas ficam mais frágeis.
2. **Arrependimento em 7 dias.** O art. 49 do CDC vale para contratação fora do
   estabelecimento por consumidor. Assinatura mensal contratada por empresa não é
   caso pacífico. Oferecemos assim mesmo — é barato, e recusar reembolso na
   primeira semana custa mais em reputação do que em caixa.

---

## 8. O que ainda falta e não é texto

- **Preencher `identidade.ts`.** Razão social, CNPJ, endereço, encarregado e
  foro. Enquanto houver TODO, as páginas mostram um aviso visível. Uma política
  que não identifica o controlador não identifica ninguém.
- **Registro do encarregado.** O art. 41 pede que a identidade seja divulgada
  publicamente — é o que a seção 1 da política faz, assim que o nome existir.
- **Exclusão real**, descrita no item 4 acima.
