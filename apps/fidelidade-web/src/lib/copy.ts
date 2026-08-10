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
    name: "Vale Desconto",
    tagline: "Sua fidelidade vale.",
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
    title: "Fidelidade simples para negócios de verdade",
    subtitle:
      "Cada compra deixa seu cliente mais perto de uma recompensa. Você carimba pelo celular, ele acompanha por um link. Sem conta, sem senha e sem aplicativo para instalar.",
    ctaPrimary: "Criar minha conta grátis",
    ctaSecondary: "Já tenho conta",
    ctaNote: "Comece no plano Grátis. Sem cartão de crédito.",

    howTitle: "Três passos, e o primeiro leva um minuto",
    steps: [
      {
        title: "Monte sua campanha",
        body: "Escolha quantos carimbos valem a recompensa e o que o cliente ganha. Um café, um corte, um desconto — você decide.",
      },
      {
        title: "Carimbe no balcão",
        body: "Digite o celular do cliente e toque em carimbar. Leva o tempo de passar o cartão na maquininha.",
      },
      {
        title: "Ele volta para resgatar",
        body: "O cliente acompanha o progresso por link ou QR. Ao completar, recebe um código curto que você confere no balcão.",
      },
    ],

    audienceTitle: "Feito para quem vive de cliente que volta",
    segments: [
      "Cafeterias",
      "Restaurantes",
      "Barbearias",
      "Salões",
      "Pet shops",
      "Varejo",
      "Serviços",
    ],

    proofTitle: "Por que não é só mais um app de desconto",
    proofs: [
      {
        title: "Seu cliente não cria conta",
        body: "Nem senha, nem cadastro, nem download. Ele abre um link e vê quantos carimbos tem.",
      },
      {
        title: "A marca em evidência é a sua",
        body: "O cartão que o cliente abre leva o nome, a cor e o logo do seu negócio. A gente organiza, você aparece.",
      },
      {
        title: "Resgate conferido no balcão",
        body: "A recompensa vira um código curto de uso único. Depois de usado, não vale de novo.",
      },
      {
        title: "Você enxerga quem volta",
        body: "Carimbos do dia, clientes ativos e quem está a um carimbo do prêmio — para saber quem merece uma lembrança.",
      },
    ],

    notTitle: "O que a Vale Desconto não é",
    notBody:
      "Não somos marketplace de cupons, clube de ofertas nem comparador de preços. Seu cliente é seu, e sua base não vira vitrine de concorrente.",

    pricingTitle: "Comece grátis, cresça quando fizer sentido",
    pricingNote:
      "Preços em reais. Cancele quando quiser pelo portal de cobrança.",

    faqTitle: "Perguntas que todo lojista faz",
    faq: [
      {
        q: "Meu cliente precisa instalar alguma coisa?",
        a: "Não. Ele abre um link no navegador do celular e vê o cartão. Se quiser, salva na tela de início — mas nada é obrigatório.",
      },
      {
        q: "E se o cliente perder o link?",
        a: "É só você buscar pelo celular dele no balcão. O cartão está sempre lá, ligado ao número de telefone.",
      },
      {
        q: "Dá para alguém carimbar duas vezes na mesma compra?",
        a: "O sistema bloqueia carimbos repetidos dentro de uma janela que você configura, e um toque duplo no botão nunca vira dois carimbos.",
      },
      {
        q: "Meu time no caixa pode carimbar?",
        a: "Pode. Cada pessoa entra com o próprio acesso e só faz o que é do balcão: carimbar, validar código e buscar cliente. Mexer no programa e nos planos é só seu.",
      },
      {
        q: "Preciso de maquininha ou leitor especial?",
        a: "Não. Basta o celular que você já usa.",
      },
      {
        q: "Posso cancelar quando quiser?",
        a: "Pode. Se cancelar, sua conta volta para o plano Grátis e seus dados continuam lá — só a criação de coisas novas fica limitada.",
      },
    ],

    finalTitle: "Toda compra pode ser o começo da próxima visita",
    finalBody:
      "Reconheça quem escolhe voltar. Sem papel, sem aplicativo e sem complicação.",

    footerTagline: "Sua fidelidade vale.",
    footerRights: (year: number) => `© ${year} Vale Desconto`,
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
    slugHint: (slug: string) => `valedesconto.com.br/c/${slug || "sua-loja"}`,
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
    quickActionsTitle: "Ações rápidas",
    stampsToday: "Carimbos hoje",
    stampsWeek: "Carimbos na semana",
    activeCustomers: "Clientes ativos",
    activeCustomersHint: "Carimbaram nos últimos 30 dias",
    newCustomersWeek: "Novos na semana",
    cardsNearGoal: "Perto de completar",
    cardsNearGoalHint: "A 1 ou 2 carimbos do prêmio",
    pendingRewards: "Prêmios a retirar",
    couponsActive: "Campanhas no ar",
    chartTitle: "Carimbos por dia",
    chartEmpty: "Nenhum carimbo nos últimos 14 dias.",
    error: "Não foi possível carregar o resumo.",
  },

  customers: {
    title: "Clientes",
    subtitle: "Quem já passou pela sua loja.",
    searchLabel: "Buscar",
    searchPlaceholder: "Nome ou celular",
    empty: "Nenhum cliente ainda",
    emptyHint: "Assim que você carimbar alguém, ele aparece aqui.",
    noResults: (term: string) => `Nada encontrado para "${term}".`,
    loadMore: "Carregar mais",
    loadingMore: "Carregando...",
    error: "Não foi possível carregar os clientes.",
    since: (date: string) => `Cliente desde ${date}`,
    noName: "Sem nome",
    detailTitle: "Histórico do cliente",
    totalStamps: "Carimbos",
    totalRewards: "Prêmios",
    totalRedeemed: "Resgatados",
    cardsTitle: "Cartões",
    cardProgress: (count: number, required: number) =>
      `${count} de ${required} carimbos`,
    cardCycle: (cycle: number) => `${cycle}º cartão`,
    rewardsTitle: "Prêmios",
    couponsTitle: "Cupons",
    historyEmpty: "Ainda sem histórico.",
    openCard: "Ver cartão do cliente",
  },

  status: {
    active: "Em andamento",
    completed: "Completo",
    pending: "Disponível",
    redeemed: "Resgatado",
    expired: "Expirado",
    archived: "Encerrado",
    draft: "Rascunho",
  },

  plan: {
    limitTitle: "Limite do seu plano",
    limitFallback: "Você atingiu o limite do seu plano atual.",
    upgrade: "Ver planos",
    usage: (used: number, max: number) => `${used} de ${max} usados`,
  },

  plans: {
    title: "Planos",
    subtitle: "Escolha o tamanho que a sua loja precisa hoje.",
    currentPlan: "Seu plano atual",
    monthly: "Mensal",
    annual: "Anual",
    annualHint: "Dois meses grátis no anual",
    perMonth: "/mês",
    perYear: "/ano",
    free: "Grátis",
    choose: "Assinar",
    current: "Plano atual",
    downgradeHint: "Para trocar ou cancelar, use o portal de cobrança.",
    manage: "Gerenciar cobrança",
    opening: "Abrindo...",
    renewsAt: (date: string) => `Renova em ${date}`,
    endsAt: (date: string) => `Ativo até ${date}`,
    canceling: "Cancelamento agendado",
    pastDue:
      "Pagamento pendente. Atualize o cartão para não perder os recursos.",
    usageTitle: "Uso atual",
    usageStores: "Lojas",
    usageCustomers: "Clientes",
    usageMembers: "Equipe",
    unlimited: "ilimitado",
    notConfigured:
      "A cobrança ainda não está configurada nesta instalação. Os limites do plano Grátis continuam valendo.",
    checkoutError: "Não foi possível abrir o pagamento.",
    portalError: "Não foi possível abrir o portal de cobrança.",
    features: {
      stores: (max: number) => (max === 1 ? "1 loja" : `Até ${max} lojas`),
      programs: (max: number) =>
        max === 1 ? "1 programa de fidelidade" : `Até ${max} programas`,
      customers: (max: number | null) =>
        max === null ? "Clientes ilimitados" : `Até ${max} clientes`,
      members: (max: number) =>
        max === 1 ? "Só você no caixa" : `Até ${max} pessoas na equipe`,
      coupons: "Cupons e campanhas",
      branding: "Sua marca no cartão",
      reports: "Relatórios avançados",
    },
  },

  phone: {
    label: "Celular do cliente",
    placeholder: "(11) 98765-4321",
    incomplete: "Informe o celular completo com DDD.",
  },

  stamp: {
    title: "Carimbar",
    subtitle: "Digite o celular do cliente para dar o carimbo.",
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
      `Carimbado! ${count} de ${goal} carimbos.`,
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
    subtitle: "Quantos carimbos, qual a recompensa e a cara do cartão.",
    empty: "Você ainda não tem um programa de fidelidade.",
    emptyAction: "Criar programa",
    nameLabel: "Nome do programa",
    namePlaceholder: "Cartão Fidelidade",
    stampsLabel: "Carimbos para ganhar a recompensa",
    stampsHint: "Entre 1 e 100 carimbos.",
    rewardLabel: "Qual é a recompensa",
    rewardPlaceholder: "Um café expresso grátis",
    validityLabel: "Validade da recompensa (dias)",
    validityHint: "Depois disso o código de resgate expira.",
    cooldownLabel: "Intervalo mínimo entre carimbos (minutos)",
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
    // Says out loud that claiming enrols them. The person typing their number is
    // joining this shop's loyalty base, and a screen that only promises a code is
    // collecting a phone number under a smaller pretext than the real one.
    claimHint:
      "Informe seu celular para gerar o seu código e começar seu cartão de fidelidade nesta loja.",
    claimAction: "Quero meu cupom",
    claiming: "Gerando...",
    yourCode: "Seu código",
    showAtStore: "Mostre este código na loja para usar.",
    seeMyCard: "Ver meu cartão de fidelidade",
    // Shown INSTEAD of the link when the person was already a customer here. The
    // card link is a credential and typing a number does not prove owning it.
    alreadyHasCard:
      "Você já tem um cartão nesta loja. Use o link que recebeu ou peça no balcão.",
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
    // "Carimbo", never "selo": the carimbo is the product's proprietary element
    // and every other screen already calls it that. One word for one thing.
    stampsOf: (count: number, goal: number) => `${count} de ${goal} carimbos`,
    remaining: (missing: number) =>
      missing === 1 ? "Falta 1 carimbo!" : `Faltam ${missing} carimbos`,
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
    // The design system's brand architecture: on a public page the merchant
    // leads and Vale Desconto signs discreetly underneath.
    poweredBy: "Fidelidade digital por Vale Desconto",
  },
} as const;

export type Copy = typeof copy;
