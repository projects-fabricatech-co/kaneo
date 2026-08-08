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
  },

  stamp: {
    cooldown: (min: number) => `Aguarde ${min} min para carimbar novamente.`,
  },
} as const;

export type Copy = typeof copy;
