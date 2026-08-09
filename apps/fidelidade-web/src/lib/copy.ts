/**
 * Every user-facing string in this app, in pt-BR.
 *
 * This app is deliberately single-locale, so there is no i18next and no
 * `@i18n` alias. The repo-wide locale checker (`scripts/i18n/check.mjs`) globs
 * every `*.json` under `/i18n` with no allowlist, so a new namespace there
 * would have to be translated into all 12 existing locales and every key we
 * add would come back as an "extra key" failure. A typed const object gives us
 * autocomplete and compile-time safety with none of that coupling.
 *
 * Interpolation is a plain typed function, e.g.
 *   `cooldown: (min: number) => \`Aguarde ${min} min...\``
 */
export const copy = {
  app: {
    name: "Fidelidade",
    tagline: "Cartão fidelidade digital para o seu negócio",
  },

  common: {
    close: "Fechar",
    cancel: "Cancelar",
    save: "Salvar",
    back: "Voltar",
    continue: "Continuar",
    loading: "Carregando...",
    retry: "Tentar novamente",
    soon: "Em breve",
    genericError: "Algo deu errado. Tente novamente.",
    networkError: "Não conseguimos falar com o servidor. Tente em instantes.",
  },

  landing: {
    eyebrow: "Adeus, cartãozinho de papel",
    title: "O cartão fidelidade do seu negócio, agora no celular",
    subtitle:
      "Carimbe pelo celular no balcão, acompanhe quem volta e recompense seus melhores clientes. Sem app para o cliente instalar.",
    ctaPrimary: "Criar minha conta grátis",
    ctaSecondary: "Já tenho conta",
    note: "Página completa chega na Fase 7.",
  },

  auth: {
    emailLabel: "E-mail",
    emailPlaceholder: "voce@sualoja.com.br",
    passwordLabel: "Senha",
    passwordPlaceholder: "Sua senha",
    nameLabel: "Seu nome",
    namePlaceholder: "Como devemos te chamar",
    showPassword: "Mostrar senha",
    hidePassword: "Ocultar senha",
    or: "ou",
    continueWithGoogle: "Continuar com Google",
    connecting: "Conectando...",
    googleError: "Não foi possível entrar com o Google.",

    signIn: {
      title: "Entrar",
      subtitle: "Acesse o painel da sua loja.",
      submit: "Entrar",
      submitting: "Entrando...",
      success: "Bem-vindo de volta!",
      error: "E-mail ou senha incorretos.",
      toggleMessage: "Ainda não tem conta?",
      toggleLink: "Criar conta",
    },

    signUp: {
      title: "Criar conta",
      subtitle: "Leva menos de um minuto para começar.",
      submit: "Criar minha conta",
      submitting: "Criando conta...",
      success: "Conta criada! Vamos configurar sua loja.",
      error: "Não foi possível criar sua conta.",
      passwordHint: "Mínimo de 8 caracteres.",
      passwordTooShort: "A senha precisa ter pelo menos 8 caracteres.",
      invalidEmail: "Informe um e-mail válido.",
      nameRequired: "Informe seu nome.",
      toggleMessage: "Já tem uma conta?",
      toggleLink: "Entrar",
    },

    signOut: {
      action: "Sair",
      success: "Você saiu da sua conta.",
      error: "Não foi possível sair. Tente novamente.",
    },
  },

  onboarding: {
    title: "Crie sua loja",
    subtitle:
      "É o nome que seus clientes vão ver no cartão de fidelidade. Você pode mudar depois.",
    nameLabel: "Nome da loja",
    namePlaceholder: "Padaria da Esquina",
    nameRequired: "Informe o nome da loja.",
    nameTooShort: "O nome precisa ter pelo menos 2 caracteres.",
    slugLabel: "Endereço do cartão",
    slugHint: (slug: string) => `fidelidade.app/c/${slug || "sua-loja"}`,
    slugInvalid:
      "Use apenas letras, números e hifens (ex.: padaria-da-esquina).",
    submit: "Criar loja",
    submitting: "Criando loja...",
    success: (name: string) => `Loja "${name}" criada. Bora carimbar!`,
    error: "Não foi possível criar a loja.",
  },

  nav: {
    painel: "Painel",
    carimbar: "Carimbar",
    validar: "Validar",
    clientes: "Clientes",
    mais: "Mais",
    programa: "Programa",
    cupons: "Cupons",
    planos: "Planos",
    configuracoes: "Configurações",
  },

  shell: {
    skipToContent: "Ir para o conteúdo",
    primaryNav: "Navegação principal",
    openMenu: "Abrir menu",
    account: "Conta",
    switchStore: "Trocar de loja",
    stores: "Suas lojas",
    noStore: "Nenhuma loja",
    createStore: "Criar nova loja",
  },

  painel: {
    greeting: (firstName: string) => `Olá, ${firstName}!`,
    greetingFallback: "Olá!",
    subtitle: "Aqui está o resumo da sua loja.",
    storeLabel: "Loja ativa",
    tilesTitle: "Resumo do dia",
    tilesPlaceholder:
      "Os cartões de resumo (carimbos de hoje, clientes ativos, resgates pendentes) chegam na Fase 5.",
    activityTitle: "Atividade recente",
    activityPlaceholder: "O feed de atividade chega na Fase 5.",
    quickActionsTitle: "Ações rápidas",
  },

  plan: {
    limitTitle: "Limite do seu plano",
    limitFallback: "Você atingiu o limite do seu plano atual.",
    upgrade: "Ver planos",
    usage: (used: number, max: number) => `${used} de ${max} usados`,
  },

  phone: {
    label: "Celular do cliente",
    placeholder: "(11) 98765-4321",
    incomplete: "Informe o celular completo com DDD.",
  },

  stamp: {
    title: "Carimbar",
    subtitle: "Digite o celular do cliente para dar o selo.",
    lookup: "Buscar cliente",
    lookingUp: "Buscando...",
    newCustomer: "Cliente novo",
    newCustomerHint:
      "Ainda não temos esse celular. Vamos cadastrar na hora do carimbo.",
    nameOptional: "Nome (opcional)",
    namePlaceholder: "Como o cliente se chama",
    action: "Carimbar",
    stamping: "Carimbando...",
    success: (count: number, goal: number) =>
      `Carimbado! ${count} de ${goal} selos.`,
    replayed: "Esse carimbo já havia sido registrado.",
    completed: "Cartão completo! Gere a recompensa do cliente.",
    cardFull: "Cartão completo. Resgate o prêmio antes de carimbar.",
    cooldown: (min: number) => `Aguarde ${min} min para carimbar novamente.`,
    cooldownShort: "Esse cliente foi carimbado agora há pouco.",
    noProgram: "Crie um programa de fidelidade antes de carimbar.",
    createProgram: "Criar programa",
    scanQr: "Ler QR do cliente",
    scanQrHint: "Aponte a câmera para o QR que o cliente mostra.",
    scanUnavailable:
      "Não foi possível abrir a câmera. Digite o celular do cliente.",
    error: "Não foi possível carimbar.",
  },

  program: {
    title: "Programa de fidelidade",
    subtitle: "Quantos selos, qual a recompensa e a cara do cartão.",
    empty: "Você ainda não tem um programa de fidelidade.",
    emptyAction: "Criar programa",
    nameLabel: "Nome do programa",
    namePlaceholder: "Cartão Fidelidade",
    stampsLabel: "Selos para ganhar a recompensa",
    stampsHint: "Entre 1 e 100 selos.",
    rewardLabel: "Qual é a recompensa",
    rewardPlaceholder: "Um café expresso grátis",
    validityLabel: "Validade da recompensa (dias)",
    validityHint: "Depois disso o código de resgate expira.",
    cooldownLabel: "Intervalo mínimo entre selos (minutos)",
    cooldownHint: "Evita carimbo repetido por engano. 0 desliga a trava.",
    colorLabel: "Cor do cartão",
    createSubmit: "Criar programa",
    saveSubmit: "Salvar alterações",
    saving: "Salvando...",
    created: "Programa criado!",
    updated: "Programa atualizado.",
    error: "Não foi possível salvar o programa.",
    preview: "Como o cliente vê",
  },

  coupon: {
    title: "Cupons",
    subtitle: "Campanhas de desconto com link e QR para divulgar.",
    empty: "Nenhuma campanha ainda.",
    emptyHint: "Crie um cupom, divulgue o link e acompanhe quem resgatou aqui.",
    create: "Criar campanha",
    creating: "Criando...",
    created: "Campanha criada!",
    updated: "Campanha atualizada.",
    error: "Não foi possível salvar a campanha.",
    locked: "Cupons fazem parte dos planos pagos.",
    lockedAction: "Ver planos",

    titleLabel: "Nome da campanha",
    titlePlaceholder: "Aniversário da loja",
    descriptionLabel: "Descrição (opcional)",
    descriptionPlaceholder: "Válido em qualquer item da vitrine",
    typeLabel: "Tipo de desconto",
    typePercent: "Porcentagem",
    typeAmount: "Valor fixo",
    typeFreebie: "Brinde",
    valueLabel: "Valor do desconto",
    percentHint: "De 1 a 100.",
    amountHint: "Em reais.",
    endsAtLabel: "Válido até (opcional)",
    maxLabel: "Máximo de resgates (opcional)",
    maxHint: "Deixe vazio para ilimitado.",
    validityLabel: "Prazo para usar o código (dias)",

    shareTitle: "Divulgue esta campanha",
    shareHint: "Mande o link no WhatsApp ou imprima o QR e deixe no balcão.",
    copyLink: "Copiar link",
    copied: "Link copiado!",
    copyFailed: "Não foi possível copiar. Selecione o link e copie na mão.",
    redemptionsTitle: "Resgates",
    redemptionsCount: (used: number, max: number | null) =>
      max === null ? `${used} resgatados` : `${used} de ${max} resgatados`,
    noRedemptions: "Ninguém resgatou ainda.",
    soldOut: "Esgotado",
    expired: "Encerrada",
    active: "Ativa",
  },

  publicCoupon: {
    claimTitle: "Pegue seu cupom",
    claimHint: "Informe seu celular para gerar o seu código.",
    claimAction: "Quero meu cupom",
    claiming: "Gerando...",
    yourCode: "Seu código",
    showAtStore: "Mostre este código na loja para usar.",
    seeMyCard: "Ver meu cartão de fidelidade",
    soldOutTitle: "Cupom esgotado",
    soldOutBody: "Todos os cupons desta campanha já foram resgatados.",
    notFoundTitle: "Campanha não encontrada",
    notFoundBody: "Esse link não é válido ou a campanha já encerrou.",
    error: "Não foi possível gerar seu cupom.",
  },

  validate: {
    title: "Validar código",
    subtitle: "Digite o código que o cliente está mostrando.",
    inputLabel: "Código",
    checking: "Conferindo...",
    check: "Conferir",
    confirm: "Confirmar resgate",
    confirming: "Baixando resgate...",
    cancel: "Cancelar",
    rewardKind: "Prêmio",
    couponKind: "Cupom",
    aboutToGive: "Você vai entregar:",
    validUntil: (date: string) => `Válido até ${date}`,
    noExpiry: "Sem prazo de validade",
    redeemed: "Resgate baixado!",
    cardReset: "O cartão do cliente voltou a zero.",
    notFound: "Código não encontrado.",
    alreadyUsed: "Esse código já foi utilizado.",
    expired: "Esse código expirou.",
    couponSoon: "Cupons chegam na próxima etapa.",
    error: "Não foi possível validar o código.",
    hint: "O código tem 7 caracteres e começa com P (prêmio) ou C (cupom).",
  },

  card: {
    stampsOf: (count: number, goal: number) => `${count} de ${goal} selos`,
    remaining: (missing: number) =>
      missing === 1 ? "Falta 1 selo!" : `Faltam ${missing} selos`,
    complete: "Cartão completo!",
    rewardLabel: "Sua recompensa",
    rewardCodeLabel: "Mostre este código na loja",
    expiresAt: (date: string) => `Válido até ${date}`,
    identifyTitle: "Seu QR de identificação",
    identifyHint: "Mostre para o atendente carimbar mais rápido.",
    couponsTitle: "Cupons ativos",
    noCoupons: "Nenhum cupom ativo agora.",
    notFoundTitle: "Cartão não encontrado",
    notFoundBody:
      "Esse link não é válido ou foi desativado. Peça um novo na loja.",
    loading: "Abrindo seu cartão...",
    savedHint: "Salve este link nos favoritos para voltar rápido.",
  },
} as const;

export type Copy = typeof copy;
