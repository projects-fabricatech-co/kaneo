/**
 * TERMOS DE USO, com o adendo de tratamento de dados (operador) como anexo.
 *
 * ─── AVISO DE ORIGEM ───────────────────────────────────────────────────────
 * Redigido sem revisão jurídica, a pedido expresso do titular do produto. As
 * cláusulas que mais merecem revisão profissional, em ordem:
 *   1. Limitação de responsabilidade (seção "responsabilidade") — é a cláusula
 *      que decide quanto você perde quando algo dá errado, e a que mais varia
 *      conforme o entendimento sobre relação de consumo entre empresas.
 *   2. Arrependimento em 7 dias (seção "pagamento") — a aplicação do art. 49 do
 *      CDC a assinatura mensal contratada por empresa não é pacífica.
 *   3. O anexo de operador (seção "anexo-dados"), que é o contrato que sustenta
 *      a divisão de papéis descrita na Política de Privacidade.
 *
 * ─── O QUE CADA AFIRMAÇÃO DEPENDE NO CÓDIGO ────────────────────────────────
 *   - cancelar rebaixa para Grátis e mantém os dados; só criar coisa nova é
 *     bloqueado com 402 — plans/resolve-plan.ts e plans/require-feature-*.ts
 *   - papéis dono e caixa, e o que cada um pode — utils/require-store-role.ts
 *   - os limites de cada plano — plans/limits.ts
 *   - preços e ciclos — o Stripe é a fonte do que se cobra; a tela de Planos
 *     exibe uma cópia dos valores
 */

import { IDENTIDADE } from "./identidade";
import type { LegalDocument } from "./types";

export const TERMOS_DE_USO: LegalDocument = {
  title: "Termos de Uso",
  audience: "Lojistas",
  effectiveDate: "2026-08-11",
  summary:
    "As regras de uso da plataforma: o que você pode fazer, o que nós garantimos, como funciona a assinatura e o que acontece quando alguém encerra.",
  sections: [
    {
      id: "aceite",
      title: "1. Aceite",
      blocks: [
        {
          kind: "p",
          text: `Ao criar uma conta na Vale Desconto (${IDENTIDADE.razaoSocial}, CNPJ ${IDENTIDADE.cnpj}) você concorda com estes Termos e com a Política de Privacidade. Se você aceita em nome de uma empresa, declara ter poderes para isso.`,
        },
      ],
    },
    {
      id: "servico",
      title: "2. O que a plataforma faz",
      blocks: [
        {
          kind: "p",
          text: "A Vale Desconto é um cartão de fidelidade digital. Você cria um programa de carimbos, registra as visitas dos seus clientes pelo celular, e eles acompanham o progresso por um link. Ao completar o cartão, o sistema gera um código curto de uso único que você confere no balcão.",
        },
        {
          kind: "p",
          text: "Não somos marketplace de cupons, clube de ofertas nem comparador de preços. Sua base de clientes é sua e não é oferecida, vendida ou exibida a nenhum outro lojista.",
        },
      ],
    },
    {
      id: "conta",
      title: "3. Sua conta e sua equipe",
      blocks: [
        {
          kind: "list",
          items: [
            "Você é responsável por manter sua senha em segredo e por tudo que acontecer na sua conta.",
            "Cada pessoa da equipe deve ter o próprio acesso. Compartilhar login impede saber quem carimbou o quê.",
            "Há dois papéis. O proprietário faz tudo: programa, cupons, planos, equipe e relatórios. O caixa faz só o que é do balcão: carimbar, validar código e buscar cliente.",
            "Avise imediatamente se suspeitar de acesso indevido.",
          ],
        },
      ],
    },
    {
      id: "seus-clientes",
      title: "4. Suas obrigações com os seus clientes",
      blocks: [
        {
          kind: "p",
          text: "Esta é a parte mais importante destes Termos, porque é onde você assume um compromisso com terceiros.",
        },
        {
          kind: "list",
          items: [
            "Você decide coletar o telefone dos seus clientes e para quê. Perante eles e perante a lei, você é o controlador desses dados; nós os tratamos por sua conta e ordem.",
            "Só registre o telefone de quem quis participar do seu programa. Digitar o número de alguém que não pediu é uso indevido da plataforma.",
            "Informe seus clientes, de forma clara, que a loja mantém um programa de fidelidade e que o número é usado para isso.",
            "Cumpra a recompensa que você prometeu. O código de resgate é uma promessa sua ao cliente, não nossa.",
            "Encaminhe para nós, ou responda diretamente, qualquer pedido de acesso ou exclusão que um cliente fizer a você.",
          ],
        },
      ],
    },
    {
      id: "uso-aceitavel",
      title: "5. Uso aceitável",
      blocks: [
        {
          kind: "p",
          text: "Você não pode usar a plataforma para: importar listas de contatos que não sejam clientes seus; enviar spam; simular carimbos ou resgates para fraudar concurso, promoção ou terceiro; tentar acessar dados de outra loja; sondar, sobrecarregar ou contornar limites técnicos; ou revender o serviço sem acordo por escrito.",
        },
        {
          kind: "p",
          text: "Podemos suspender uma conta que viole esta seção, e o faremos imediatamente quando houver risco a terceiros. Sempre que possível, avisamos antes.",
        },
      ],
    },
    {
      id: "pagamento",
      title: "6. Planos e pagamento",
      blocks: [
        {
          kind: "list",
          items: [
            "Há um plano Grátis, que não pede cartão de crédito, e planos pagos em reais, cobrados por assinatura mensal ou anual.",
            "O preço vigente é o exibido na tela de Planos no momento da contratação. Preço anunciado é preço cobrado.",
            "A cobrança é recorrente e renova automaticamente até você cancelar.",
            "Reajustes são comunicados com pelo menos 30 dias de antecedência, e você pode cancelar antes que passem a valer.",
            "O pagamento é processado pelo Stripe. Não recebemos nem guardamos os dados do seu cartão.",
          ],
        },
        {
          kind: "p",
          text: "Arrependimento: se você contratou um plano pago à distância e se arrepender em até 7 dias, devolvemos o valor integral. Escreva para o nosso suporte dentro do prazo.",
        },
      ],
    },
    {
      id: "cancelamento",
      title: "7. Cancelamento e o que acontece com seus dados",
      blocks: [
        {
          kind: "p",
          text: "Você cancela quando quiser, pelo portal de cobrança, sem multa e sem precisar falar com ninguém.",
        },
        {
          kind: "p",
          text: "Ao cancelar, sua conta volta ao plano Grátis ao fim do período já pago. Seus dados continuam lá: os clientes, os cartões e o histórico permanecem, e o que fica limitado é apenas a criação de coisas novas acima do que o plano Grátis permite. Não apagamos sua base porque você deixou de pagar.",
        },
        {
          kind: "p",
          text: "Se você quiser encerrar a conta de vez e apagar os dados, peça pelo canal de privacidade. Avise seus clientes antes: os cartões deles deixam de funcionar.",
        },
      ],
    },
    {
      id: "disponibilidade",
      title: "8. Disponibilidade e suporte",
      blocks: [
        {
          kind: "p",
          text: `Trabalhamos para manter o serviço no ar, mas não prometemos disponibilidade ininterrupta. Pode haver manutenção programada, e avisamos com antecedência quando ela afetar o uso. Suporte por ${IDENTIDADE.emailSuporte}, em dias úteis.`,
        },
      ],
    },
    {
      id: "propriedade",
      title: "9. Propriedade",
      blocks: [
        {
          kind: "p",
          text: "O software, a marca e o design da Vale Desconto são nossos. O nome, o logo e a identidade da sua loja são seus, e você nos autoriza a exibi-los nas páginas do seu programa apenas para essa finalidade.",
        },
        {
          kind: "p",
          text: "Os dados dos seus clientes são seus. Não os usamos para outra finalidade que não seja operar o serviço para você.",
        },
      ],
    },
    {
      id: "responsabilidade",
      title: "10. Limitação de responsabilidade",
      blocks: [
        {
          kind: "p",
          text: "Respondemos por danos diretos que causarmos por falha nossa, limitados ao valor pago por você nos 12 meses anteriores ao fato.",
        },
        {
          kind: "p",
          text: "Não respondemos pela recompensa que você prometeu ao seu cliente, pelo uso que sua equipe faz da plataforma, nem por dados que você inseriu indevidamente.",
        },
      ],
    },
    {
      id: "anexo-dados",
      title: "11. Anexo — tratamento de dados (operador)",
      blocks: [
        {
          kind: "p",
          text: "Este anexo integra os Termos e rege o tratamento, pela Vale Desconto, dos dados dos SEUS clientes.",
        },
        {
          kind: "list",
          items: [
            "Objeto e finalidade: tratamos os dados dos seus clientes exclusivamente para operar o programa de fidelidade da sua loja, seguindo suas instruções.",
            "Papéis: você é o controlador; nós somos o operador.",
            "Confidencialidade: nossa equipe está obrigada a sigilo e só acessa dados quando necessário ao suporte ou a obrigação legal.",
            "Segurança: adotamos as medidas descritas na Política de Privacidade, seção 8.",
            "Suboperadores: hoje apenas o Stripe, e ele não recebe dado de cliente final. Avisamos antes de incluir outro.",
            "Transferência internacional: informada na Política de Privacidade, seção 6.",
            "Direitos do titular: prestamos o apoio necessário para você responder pedidos dos seus clientes, e atendemos os que chegarem direto a nós.",
            "Incidentes: comunicamos você sem demora injustificada ao tomar conhecimento de incidente que envolva os dados dos seus clientes.",
            "Devolução e eliminação: encerrada a relação, eliminamos os dados dos seus clientes salvo obrigação legal de retenção.",
          ],
        },
      ],
    },
    {
      id: "geral",
      title: "12. Disposições gerais",
      blocks: [
        {
          kind: "p",
          text: "Podemos alterar estes Termos; mudanças relevantes são avisadas por e-mail com pelo menos 30 dias de antecedência. Se uma cláusula for inválida, as demais continuam valendo.",
        },
        {
          kind: "p",
          text: `Aplica-se a lei brasileira, e fica eleito o foro da comarca de ${IDENTIDADE.foro}.`,
        },
      ],
    },
  ],
};
