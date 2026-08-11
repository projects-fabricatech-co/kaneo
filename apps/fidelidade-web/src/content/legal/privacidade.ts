/**
 * POLÍTICA DE PRIVACIDADE.
 *
 * ─── AVISO DE ORIGEM ───────────────────────────────────────────────────────
 * Redigida sem revisão jurídica, a pedido expresso do titular do produto. Se um
 * advogado for consultado algum dia, as cláusulas que mais merecem os olhos dele
 * são, nesta ordem:
 *   1. A base legal do carimbo no balcão (seção "bases-legais"). É a decisão
 *      estruturante e a que muda o código se for revista.
 *   2. A divisão controlador/operador (seção "papeis"), porque define quem
 *      responde perante o titular e perante a ANPD.
 *   3. A retenção (seção "retencao"), que hoje descreve um comportamento do
 *      sistema — arquivamento lógico — e não uma política de descarte.
 *   4. A transferência internacional para o Stripe (seção "compartilhamento").
 *
 * ─── O QUE CADA AFIRMAÇÃO DEPENDE NO CÓDIGO ────────────────────────────────
 * Toda frase factual aqui foi conferida contra o código. Se algum destes mudar,
 * o texto correspondente muda junto:
 *   - `customers.phone` é notNull e único por (loja, telefone) — schema.ts
 *   - a projeção pública mascara o telefone e mostra só o primeiro nome —
 *     public/controllers/get-public-card.ts
 *   - arquivar cliente é lógico, e `findOrCreateCustomer` reencontra arquivado
 *     pelo telefone — customer/controllers/find-or-create-customer.ts
 *   - não há rastreador nem cookie não essencial; só o cookie de sessão do
 *     Better Auth, que o cliente final nunca recebe
 *   - o Stripe é o único subprocessador que recebe dado pessoal
 */

import { IDENTIDADE } from "./identidade";
import type { LegalDocument } from "./types";

export const POLITICA_PRIVACIDADE: LegalDocument = {
  title: "Política de Privacidade",
  audience: "Lojistas e clientes finais",
  effectiveDate: "2026-08-11",
  summary:
    "Como a Vale Desconto trata dados pessoais: o que coletamos, por quê, com quem compartilhamos, por quanto tempo guardamos e como você pede para ver, corrigir ou apagar.",
  sections: [
    {
      id: "quem-somos",
      title: "1. Quem somos",
      blocks: [
        {
          kind: "p",
          text: `A Vale Desconto (${IDENTIDADE.razaoSocial}, CNPJ ${IDENTIDADE.cnpj}, ${IDENTIDADE.endereco}) fornece uma plataforma de fidelidade digital para negócios locais. O lojista cria um programa de carimbos e registra as visitas dos seus clientes; o cliente acompanha o progresso por um link.`,
        },
        {
          kind: "p",
          text: `Para qualquer assunto de privacidade, incluindo os pedidos previstos no art. 18 da LGPD, escreva para ${IDENTIDADE.emailPrivacidade}. Nosso encarregado pelo tratamento de dados é ${IDENTIDADE.encarregado}.`,
        },
      ],
    },
    {
      id: "papeis",
      title: "2. Quem responde pelos seus dados",
      blocks: [
        {
          kind: "p",
          text: "Esta plataforma tem dois tipos de pessoa, e o papel da Vale Desconto é diferente em cada caso. A distinção importa porque define a quem você recorre.",
        },
        {
          kind: "list",
          items: [
            "Lojista — quem cria a conta e usa o sistema. Aqui a Vale Desconto é a CONTROLADORA: nós decidimos quais dados são necessários para manter a conta, cobrar a assinatura e prestar suporte.",
            "Cliente final — quem tem um cartão de fidelidade numa loja. Aqui quem decide coletar o telefone e para quê é o LOJISTA, que é a controladora desses dados; a Vale Desconto atua como OPERADORA, tratando os dados por conta e ordem dele.",
          ],
        },
        {
          kind: "p",
          text: "Na prática: se você é cliente de uma loja e quer que seus dados sejam apagados, pode falar com a loja ou conosco. Se você falar conosco, encaminhamos ao lojista e executamos a exclusão na plataforma.",
        },
      ],
    },
    {
      id: "dados",
      title: "3. Que dados tratamos",
      blocks: [
        {
          kind: "p",
          text: "Coletamos o mínimo necessário para o produto funcionar. Não pedimos CPF, endereço residencial, data de nascimento nem qualquer dado sensível.",
        },
        {
          kind: "table",
          head: ["Quem", "Dado", "De onde vem"],
          rows: [
            ["Lojista", "Nome e e-mail", "Cadastro"],
            ["Lojista", "Senha (armazenada apenas como hash)", "Cadastro"],
            [
              "Lojista",
              "Endereço IP e navegador de cada sessão",
              "Registro automático de acesso",
            ],
            [
              "Lojista",
              "Dados da assinatura (plano, situação, período)",
              "Stripe",
            ],
            [
              "Cliente final",
              "Telefone celular",
              "Digitado pelo lojista no balcão, ou pelo próprio cliente na página de uma campanha",
            ],
            ["Cliente final", "Nome (opcional)", "Mesma origem do telefone"],
            [
              "Cliente final",
              "Histórico de carimbos, prêmios e cupons",
              "Gerado pelo uso",
            ],
          ],
        },
        {
          kind: "p",
          text: "Nunca recebemos nem armazenamos o número do seu cartão de crédito. O pagamento acontece inteiramente dentro do Stripe.",
        },
      ],
    },
    {
      id: "bases-legais",
      title: "4. Com que fundamento tratamos",
      blocks: [
        {
          kind: "p",
          text: "A LGPD exige uma base legal para cada tratamento. Adotamos as seguintes.",
        },
        {
          kind: "table",
          head: ["Tratamento", "Base legal", "Por quê"],
          rows: [
            [
              "Conta, cobrança e suporte ao lojista",
              "Execução de contrato (art. 7º, V)",
              "Sem esses dados não há como prestar o serviço contratado",
            ],
            [
              "Registro de acesso do lojista",
              "Cumprimento de obrigação legal (art. 7º, II)",
              "Marco Civil da Internet, art. 15",
            ],
            [
              "Carimbo registrado pelo lojista no balcão",
              "Legítimo interesse do lojista (art. 7º, IX)",
              "O cliente pediu para participar do programa ao entregar o número; o tratamento é o mínimo para entregar o benefício que ele espera",
            ],
            [
              "Resgate de cupom pela página pública",
              "Consentimento (art. 7º, I)",
              "Aqui o próprio cliente digita o número e aceita, de forma destacada, entrar na base da loja",
            ],
          ],
        },
        {
          kind: "p",
          text: "Sobre o carimbo no balcão, seja franco conosco se discordar: o cliente entrega o telefone ao atendente esperando participar do programa, mas não clica em nada. Tratamos isso como legítimo interesse do lojista, limitado ao programa de fidelidade daquela loja. Você pode se opor a esse tratamento a qualquer momento, e nesse caso apagamos seu cadastro naquela loja.",
        },
        {
          kind: "p",
          text: "Não usamos nenhum desses dados para publicidade, não fazemos perfilamento e não vendemos base para ninguém.",
        },
      ],
    },
    {
      id: "quem-ve",
      title: "5. Quem consegue ver o quê",
      blocks: [
        {
          kind: "list",
          items: [
            "A loja onde você tem cartão vê seu telefone completo, seu nome se você informou, e seu histórico naquela loja.",
            "Outras lojas não veem nada seu. Cada loja tem sua própria base, separada no banco de dados; ter cartão numa padaria não te coloca na lista da barbearia ao lado.",
            "Quem abre o link do seu cartão vê apenas seu primeiro nome e o telefone mascarado, no formato (11) *****-4321 — nunca o número completo, nunca identificadores internos.",
            "A equipe da Vale Desconto só acessa dados de clientes quando é necessário para suporte ou obrigação legal.",
          ],
        },
      ],
    },
    {
      id: "compartilhamento",
      title: "6. Com quem compartilhamos",
      blocks: [
        {
          kind: "p",
          text: "Usamos um número deliberadamente pequeno de fornecedores. Esta é a lista completa dos que recebem dado pessoal:",
        },
        {
          kind: "table",
          head: ["Fornecedor", "Para quê", "Onde", "Que dado recebe"],
          rows: [
            [
              "Stripe",
              "Processamento de pagamentos e assinaturas",
              "Estados Unidos",
              "Nome e e-mail do lojista, dados do cartão informados diretamente a eles",
            ],
          ],
        },
        {
          kind: "p",
          text: "O Stripe está fora do Brasil, o que caracteriza transferência internacional (art. 33 da LGPD). Ela ocorre porque é necessária para executar o contrato de assinatura que você celebrou conosco. Nenhum dado de cliente final é enviado ao Stripe.",
        },
        {
          kind: "p",
          text: "Podemos ainda compartilhar dados quando formos obrigados por lei, ordem judicial ou requisição de autoridade competente.",
        },
      ],
    },
    {
      id: "cookies",
      title: "7. Cookies e rastreamento",
      blocks: [
        {
          kind: "p",
          text: "Não usamos nenhuma ferramenta de análise, publicidade ou rastreamento. Não há pixel, não há cookie de terceiro e não há nada a consentir — por isso você não vê um banner de cookies aqui.",
        },
        {
          kind: "p",
          text: "O único cookie que gravamos é o que mantém o lojista conectado depois do login, estritamente necessário para o funcionamento. A página pública do cartão e a página de campanha não gravam cookie nenhum.",
        },
      ],
    },
    {
      id: "seguranca",
      title: "8. Como protegemos",
      blocks: [
        {
          kind: "list",
          items: [
            "Senhas nunca são guardadas em texto, apenas como hash.",
            "O endereço do seu cartão usa um identificador aleatório de 128 bits, não um número sequencial que alguém possa adivinhar.",
            "A página pública do cartão devolve apenas uma lista fechada de campos, escrita à mão — nada é despejado direto do banco.",
            "Códigos de resgate são de uso único: depois de usados, não valem de novo.",
            "Os dados de cada loja são isolados dos de qualquer outra, e isso é verificado por testes automatizados a cada mudança.",
          ],
        },
        {
          kind: "p",
          text: "Nenhuma medida elimina risco. Se ocorrer incidente de segurança que possa acarretar risco relevante aos titulares, comunicaremos a ANPD e as pessoas afetadas, conforme o art. 48 da LGPD.",
        },
      ],
    },
    {
      id: "retencao",
      title: "9. Por quanto tempo guardamos",
      blocks: [
        {
          kind: "list",
          items: [
            "Dados do lojista: enquanto a conta existir e, depois do encerramento, pelo prazo necessário para cumprir obrigações legais e fiscais.",
            "Registros de acesso: seis meses, conforme o art. 15 do Marco Civil da Internet.",
            "Dados de cliente final: enquanto o programa de fidelidade daquela loja existir, ou até que a exclusão seja pedida.",
          ],
        },
        {
          kind: "p",
          text: "Transparência sobre uma limitação atual: quando um cliente é arquivado, o registro continua no banco e é reencontrado pelo telefone se ele voltar a ser carimbado naquela loja. Se você quer que seus dados sejam efetivamente apagados, e não apenas ocultados, peça exclusão pelo canal abaixo.",
        },
      ],
    },
    {
      id: "direitos",
      title: "10. Seus direitos e como exercer",
      blocks: [
        {
          kind: "p",
          text: "O art. 18 da LGPD te dá direito a confirmar se tratamos seus dados, acessá-los, corrigir o que estiver errado, pedir anonimização ou eliminação, saber com quem compartilhamos, revogar consentimento e se opor a um tratamento.",
        },
        {
          kind: "p",
          text: `Para exercer qualquer um deles, escreva para ${IDENTIDADE.emailPrivacidade} informando o telefone usado na loja. Respondemos em até 15 dias. Podemos pedir uma confirmação de que o número é seu — é a única forma de não entregar seus dados a quem apenas conhece seu telefone.`,
        },
        {
          kind: "p",
          text: "Se você acha que não tratamos bem seu pedido, pode reclamar à Autoridade Nacional de Proteção de Dados.",
        },
      ],
    },
    {
      id: "aviso-cliente",
      title: "11. Resumo para quem tem um cartão de fidelidade",
      blocks: [
        {
          kind: "p",
          text: "Se você chegou aqui pelo link do seu cartão, esta seção responde o essencial em um minuto.",
        },
        {
          kind: "list",
          items: [
            "Você não criou conta e não tem senha. Seu cartão é identificado pelo seu telefone e o link é o seu acesso — trate-o como pessoal.",
            "A loja tem seu número porque você entregou no balcão ou digitou na página de uma campanha dela.",
            "A loja vê seu histórico nela. Nenhuma outra loja vê.",
            "Quem abrir seu link vê seu primeiro nome, o telefone mascarado e seus carimbos. Se seu cartão tiver um prêmio disponível, o código aparece ali — por isso não compartilhe o link.",
            `Para sair: peça na loja, ou escreva para ${IDENTIDADE.emailPrivacidade} com o telefone que você usa lá.`,
          ],
        },
      ],
    },
    {
      id: "mudancas",
      title: "12. Mudanças nesta política",
      blocks: [
        {
          kind: "p",
          text: "Se mudarmos algo relevante, atualizamos a data no topo desta página e avisamos os lojistas por e-mail. Vale a versão publicada no momento do tratamento.",
        },
      ],
    },
  ],
};
