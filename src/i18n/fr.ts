import type { Dictionary } from './en';

// French dictionary.
//
// Written as French, not translated from the English. Both versions say the
// same thing and sell the same way, but they are not sentence-for-sentence
// equivalents — a literal rendering of English marketing copy reads like a
// machine wrote it, and French buyers notice immediately.
//
// The typed `Dictionary` shape means a key added to `en.ts` and forgotten
// here fails the build. See `en.ts` for the copy rules that apply to both.
//
// Typography: French spacing is respected (space before ? and !) and
// typographic apostrophes are used throughout. Keep it that way — it is the
// first thing a French reader registers as "written by someone who speaks
// the language".
export const fr: Dictionary = {
  common: {
    comingSoon: 'Bientôt disponible',
    notifyMe: 'Prévenez-moi',
    browseTemplates: 'Voir les thèmes',
    startProject: 'Parler de mon projet',
    liveDemo: 'Voir la démo',
    all: 'Tous',
  },

  nav: {
    homeAriaLabel: 'HB Studio Co — accueil',
    templates: 'Thèmes',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    agency: 'Le studio',
    getTemplate: 'Voir les thèmes',
    menuAriaLabel: 'Menu',
    getInTouch: 'Nous écrire',
    statusAvailable: 'Projets sur mesure ouverts',
    switchTo: 'Passer en ',
  },

  footer: {
    tagline:
      'Thèmes Shopify premium conçus pour vendre — rapides, accessibles, sans abonnement à des applis. WordPress et WooCommerce arrivent.',
    catalogueHeading: 'Thèmes',
    allTemplates: 'Tous les thèmes',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    studioHeading: 'Le studio',
    about: 'À propos',
    contact: 'Contact',
    rights: 'Tous droits réservés.',
    builtBy: 'Conçu et développé par HB Studio Co.',
  },

  base: {
    defaultTitle: 'Thèmes Shopify premium, conçus pour vendre | HB Studio Co',
    defaultDescription:
      'Des thèmes Shopify rapides et accessibles, avec les outils de vente déjà intégrés : panier latéral, filtres, méga-menu. Sans applis payantes. 12 mois de mises à jour et documentation bilingue.',
    skipToContent: 'Aller au contenu',
    redirecting: 'Redirection vers le paiement…',
    checkoutSoon: '🛒 La boutique ouvre très bientôt — écrivez-nous pour précommander.',
    checkoutUnavailable: 'Le paiement ne répond pas pour le moment. Réessayez dans un instant.',
    networkError: 'Connexion perdue — réessayez.',
  },

  home: {
    hero: {
      badge: 'Studio indépendant · Thèmes premium',
      titleLine1: 'Des thèmes Shopify premium',
      titleLine2Prefix: 'conçus pour ',
      titleLine2Emphasis: 'vendre',
      titleLine2Suffix: '.',
      subtitle:
        'Tout ce qui fait vendre est déjà dans le thème : panier latéral, barre de livraison offerte, filtres, aperçu rapide. Aucune appli à payer tous les mois, aucun poids inutile. Shopify aujourd’hui, WordPress et WooCommerce ensuite.',
      statTemplates: 'Thèmes',
      statPlatforms: 'Plateformes',
      statAppFree: 'Frais d’applis',
    },
    categories: {
      eyebrow: 'Par plateforme',
      heading: 'Choisissez votre plateforme',
      viewAll: 'Tous les thèmes →',
      available: (count: number) => `${count} disponible${count > 1 ? 's' : ''} →`,
    },
    featured: {
      eyebrow: 'À la une',
      heading: 'Le dernier né du studio',
      viewAll: 'Tout voir →',
    },
    howItWorks: {
      eyebrow: 'Comment ça marche',
      heading: 'En ligne dans l’après-midi, pas dans quinze jours.',
      steps: [
        { title: 'Choisissez', body: 'Parcourez la démo complète avant de dépenser un centime. Ce que vous voyez est exactement ce que vous installez.' },
        { title: 'Achetez', body: 'Un paiement unique, sans abonnement. Le fichier et la documentation arrivent immédiatement par e-mail.' },
        { title: 'Installez', body: 'Vous téléversez le thème depuis votre back-office et suivez le guide illustré, étape par étape, en français.' },
        { title: 'Personnalisez', body: 'Vous remplacez le contenu de démo par le vôtre, choisissez un style, et vous publiez. Sans développeur.' },
      ],
    },
    why: {
      eyebrow: 'Pourquoi acheter ici',
      heading: 'Des thèmes pensés comme des produits, pas comme des vitrines.',
      items: [
        { icon: '⚡', title: 'Rapides là où ça compte', body: 'CSS critique intégré, images différées et redimensionnées, Core Web Vitals surveillés à chaque version.' },
        { icon: '🧩', title: 'Zéro abonnement d’applis', body: 'Panier latéral, barre de livraison offerte, filtres, aperçu rapide, compte à rebours : tout est dans le thème. Rien à louer.' },
        { icon: '🌍', title: 'Prêts pour l’international', body: 'Textes de boutique traduits dans une cinquantaine de langues, sélecteurs de pays et de devise inclus.' },
        { icon: '♿', title: 'Accessibles dès le départ', body: 'Navigation au clavier, focus visible, respect des préférences d’animation réduite. Conformes WCAG 2.0 AA.' },
        { icon: '🎨', title: 'Modifiables sans coder', body: 'Sections, blocs et styles prédéfinis. Vous changez toute l’identité visuelle sans ouvrir un fichier.' },
        { icon: '📖', title: 'Une vraie documentation', body: 'Guides illustrés en français et en anglais, avec la marche à suivre pour reproduire la démo à l’identique.' },
      ],
    },
    responsive: {
      eyebrow: 'Mobile d’abord',
      heading: 'La plupart de vos clients sont sur un téléphone',
      body: 'C’est donc par là que nous commençons. Mises en page fluides, images calibrées pour l’écran qui les demande, navigation pensée pour le pouce — et non une version bureau rétrécie.',
    },
    // See the warning on the English side: these are illustrative placeholders,
    // not real customers. Translated on request while they remain in place.
    testimonials: {
      eyebrow: 'Ils nous font confiance',
      heading: 'Ce qu’en disent nos clients',
      ratingAriaLabel: (n: number) => `${n} sur 5`,
      items: [
        { name: 'Camille Renaud', role: 'Fondatrice, Maison Lou', quote: 'Atelier donne à notre boutique l’allure d’une marque trois fois plus grande. Nous avons lancé en un week-end, et les conversions ont grimpé dès le premier mois.', rating: 5 },
        { name: 'Jonas Meyer', role: 'Responsable e-commerce, Nord Supply', quote: 'La qualité du code est vraiment au rendez-vous : rapide, propre, sans surcharge. Et aucun abonnement à souscrire pour retrouver ce que le thème fait déjà.', rating: 5 },
        { name: 'Aïcha Benali', role: 'Gérante, Studio Aïcha', quote: 'La meilleure documentation que j’aie utilisée. Le guide pour reproduire la démo m’a rendue opérationnelle en moins d’une heure.', rating: 5 },
        { name: 'Tom Schreiber', role: 'Développeur indépendant', quote: 'Je livre des boutiques pour mes clients, et les thèmes HB Studio sont devenus mon choix par défaut. Modifiables, bien structurés, ils fonctionnent, tout simplement.', rating: 5 },
        { name: 'Lena Fischer', role: 'Marketing, Brûme Skincare', quote: 'Superbe dès l’installation, et toujours fidèle à notre identité après nos réglages. Le panier latéral à lui seul a fait monter notre panier moyen.', rating: 5 },
        { name: 'Marco Conti', role: 'Fondateur, Conti Leather', quote: 'Une finition premium, un prix juste, et un vrai support qui répond vite. Exactement ce qu’il faut à une boutique indépendante.', rating: 5 },
      ],
    },
    faq: {
      eyebrow: 'Questions fréquentes',
      heading: 'Avant d’acheter',
      items: [
        { q: 'Sur quelles plateformes puis-je les utiliser ?', a: 'Shopify aujourd’hui, en Online Store 2.0. WordPress et WooCommerce sont en préparation, Webflow et Framer sont prévus ensuite. Inscrivez-vous à la liste et nous vous prévenons le jour où chacun sort.' },
        { q: 'Devrai-je payer des applis en plus ?', a: 'Non. Ce que la plupart des boutiques louent au mois — panier latéral, barre de livraison offerte, filtres, aperçu rapide, alerte de stock faible — est intégré au thème. La licence vous en rend propriétaire.' },
        { q: 'Comment se passe l’installation ?', a: 'Vous téléchargez un fichier ZIP et vous le téléversez depuis l’espace « Thèmes » de votre boutique. Quelques minutes suffisent, et chaque thème est livré avec un guide illustré en français qui vous accompagne pas à pas.' },
        { q: 'Faut-il être développeur ?', a: 'Non. Tout se règle depuis l’éditeur de votre plateforme, par sections, blocs et styles prédéfinis. Si vous savez rédiger une fiche produit, vous saurez configurer le thème.' },
        { q: 'Que couvrent les mises à jour ?', a: 'Douze mois de mises à jour gratuites à partir de votre achat. Les nouvelles versions s’installent à côté de votre thème en ligne : rien de ce que vous avez personnalisé n’est écrasé. Passé ces douze mois, votre boutique continue de fonctionner et vous conservez toutes les versions parues pendant la période.' },
        { q: 'Que permet la licence ?', a: 'La licence Single couvre une boutique. La licence Extended en couvre jusqu’à cinq — c’est celle qu’il vous faut si vous travaillez pour des clients. Les deux sont des paiements uniques.' },
        { q: 'Faites-vous du sur-mesure ?', a: 'Oui. Nous concevons des thèmes et des boutiques complètes sur mesure. Décrivez-nous votre projet sur la page contact : nous vous dirons franchement si nous sommes le bon studio pour le faire.' },
        { q: 'Puis-je être remboursé ?', a: 'Un thème est un fichier téléchargeable immédiatement, les ventes sont donc définitives — et c’est précisément pour cela que la démo est entièrement ouverte avant l’achat. Si quelque chose ne fonctionne pas, écrivez-nous : nous le corrigeons.' },
      ],
    },
    newsletter: {
      heading: 'Soyez au courant avant les autres.',
      body: 'Nouveaux thèmes, nouvelles plateformes et remises de lancement occasionnelles. Quelques e-mails par an, pas davantage, et un clic pour se désinscrire.',
      honeypotLabel: 'Ne pas remplir : ',
      placeholder: 'vous@votremarque.com',
      submit: 'Tenez-moi au courant',
    },
    customCta: {
      eyebrow: 'Sur mesure',
      headingPrefix: 'Besoin de quelque chose ',
      headingEmphasis: 'sur mesure',
      headingSuffix: ' ?',
      body: 'Nous concevons et développons des thèmes et des boutiques complètes sur mesure. Parlez-nous du projet — nous vous dirons si nous sommes les bonnes personnes.',
    },
  },

  about: {
    meta: {
      title: 'Le studio — créateurs de thèmes Shopify | HB Studio Co',
      description:
        'HB Studio Co est un studio indépendant qui conçoit des thèmes Shopify premium : rapides, accessibles, documentés, et sans abonnement à des applis.',
    },
    hero: {
      eyebrow: 'Le studio',
      titlePrefix: 'Nous concevons nos thèmes ',
      titleEmphasis: 'comme des produits',
      titleSuffix: '.',
      body:
        'HB Studio Co est un petit studio indépendant. Nous construisons des thèmes premium, orientés conversion, pour les plateformes sur lesquelles les marchands vendent vraiment — puis nous les documentons sérieusement, parce qu’un thème que personne n’arrive à configurer n’est pas un thème fini.',
    },
    story: {
      eyebrow: 'Derrière le studio',
      heading: 'Une créatrice, une exigence.',
      lead:
        'HB Studio Co, c’est le studio de Célia Garnier : indépendant, volontairement petit, et comptable devant les gens qui installent ce qu’il livre.',
      paras: [
        'La plupart des thèmes sont dessinés une fois, puis livrés. Les nôtres sont dessinés, construits, puis démontés et refaits autour de ce qu’un marchand manipule vraiment — la fiche produit, le panier, les trente secondes où quelqu’un décide. Le seul design qui mérite d’être vendu est celui qui a survécu au contact d’un vrai catalogue.',
        'C’est aussi pour cela que le catalogue est court. Un studio qui sort quatre thèmes par mois ne conçoit plus, il assemble. Nous préférons livrer un thème que nous recommanderons encore dans trois ans.',
        'Le reste tient à la discipline. Un thème est mis en vente quand la documentation est écrite, quand la démo peut être reconstruite à partir de cette seule documentation, et quand les scores de performance disent la même chose que les captures d’écran. Pas avant.',
      ],
      portraitCaption: 'Célia Garnier',
      portraitRole: 'Fondatrice & créatrice',
      portraitAlt: 'Célia Garnier, fondatrice de HB Studio Co',
    },
    whatWeDo: {
      heading: 'Ce que nous faisons',
      body:
        'Un seul studio, toutes les plateformes. Nous concevons en interne, nous vendons en direct, et nous assurons le suivi de ce que nous livrons. Shopify d’abord, WordPress et WooCommerce ensuite. Chaque thème est livré avec une documentation bilingue et douze mois de mises à jour — et nous préférons sortir un thème dont nous sommes fiers que quatre dont nous ne le serions pas.',
      availableNow: 'Disponible maintenant',
    },
    weBelieve: {
      heading: 'Ce en quoi nous croyons',
      items: [
        { title: 'La vitesse est une fonctionnalité', body: 'Une belle boutique qui charge lentement perd quand même la vente. Nous travaillons les Core Web Vitals dès la première ligne, pas en rattrapage.' },
        { title: 'On ne loue pas l’essentiel', body: 'Un panier latéral et un compte à rebours ne sont pas des options de luxe. Leur place est dans le thème que vous avez acheté, pas dans un abonnement mensuel.' },
        { title: 'Fait pour être modifié', body: 'Sections, blocs et styles prédéfinis : vous pouvez changer complètement d’avis sur l’apparence sans toucher une ligne de code.' },
        { title: 'Documenté, pas seulement livré', body: 'Des guides illustrés en français et en anglais — y compris la marche à suivre pour reproduire exactement la démo que vous avez parcourue avant d’acheter.' },
      ],
    },
    workWithUs: {
      heading: 'Travailler avec nous',
      body: 'Besoin d’un thème sur mesure, ou d’une adaptation de l’un des nôtres ? Parlez-nous du projet, nous vous répondrons franchement.',
    },
  },

  contact: {
    meta: {
      title: 'Contact — thèmes, sur-mesure et assistance | HB Studio Co',
      description:
        'Une question sur un thème, un projet sur mesure ou besoin d’aide ? Écrivez à HB Studio Co — nous répondons sous un à deux jours ouvrés.',
    },
    eyebrow: 'Contact',
    heading: 'Parlons-en',
    intro: 'Une question avant d’acheter, un projet sur mesure, ou quelque chose qui ne fonctionne pas ? Écrivez-nous — c’est un humain qui répond, sous un à deux jours ouvrés.',
    honeypotLabel: 'Ne pas remplir : ',
    nameLabel: 'Nom',
    emailLabel: 'E-mail',
    subjectLabel: 'Sujet',
    subjectOptions: ['Question sur un thème', 'Projet sur mesure', 'Assistance', 'Autre'],
    messageLabel: 'Message',
    submit: 'Envoyer le message',
  },

  templatesIndex: {
    meta: {
      title: 'Tous nos thèmes Shopify premium, sans applis payantes | HB Studio Co',
      description:
        'Découvrez tous les thèmes HB Studio Co pour Shopify, WordPress et WooCommerce. Démos complètes, paiement unique, 12 mois de mises à jour.',
    },
    eyebrow: 'Le catalogue',
    heading: 'Tous les thèmes',
    subtitle: 'Chaque thème est conçu et développé en interne, avec sa démo complète ouverte avant l’achat. Filtrez par plateforme.',
  },

  templateDetail: {
    meta: {
      title: (templateTitle: string, cmsLabel: string) => `${templateTitle} — thème ${cmsLabel} premium | HB Studio Co`,
    },
    notifyLaunch: 'Prévenez-moi au lancement',
    buyPrefix: 'Acheter — ',
    oneTimeSingleSite: 'Paiement unique · 1 boutique · 12 mois de mises à jour',
    whatsInside: 'Ce que contient le thème',
    priceLabel: 'Prix',
    singleLicensePrefix: 'Licence Single — 1 boutique · ',
    extendedLicensePrefix: 'Extended — 5 boutiques · ',
    oneTimeIncluded: 'Paiement unique · 12 mois de mises à jour inclus',
    readDocs: 'Lire la documentation →',
    interactiveDemo: 'Démo interactive',
    exploreLivePrefix: 'Parcourez ',
    exploreLiveSuffix: ' vous-même',
    openNewTab: 'Ouvrir dans un nouvel onglet',
    openArrow: 'Ouvrir ↗',
    demoNote: 'La vraie boutique, pas des captures — parcourez-la entièrement. (Le panier et le paiement sont désactivés dans la démo.)',
    closerLook: 'Regardez de plus près',
    backToAll: '← Tous les thèmes',
    screenshotAlt: (templateTitle: string, n: number) => `Thème Shopify ${templateTitle} — capture ${n}`,
  },

  category: {
    meta: {
      title: (cmsLabel: string) => `Thèmes ${cmsLabel} premium, sans applis payantes | HB Studio Co`,
    },
    comingHeading: (cmsLabel: string) => `Les thèmes ${cmsLabel} arrivent`,
    comingBody: (cmsLabel: string) => `Nous construisons nos thèmes ${cmsLabel} avec le même soin que notre travail sur Shopify — et nous préférons prendre le temps. Vous voulez être prévenu à la sortie du premier ?`,
  },

  notFound: {
    meta: { title: 'Page introuvable — HB Studio Co' },
    heading: 'Cette page a pris sa journée',
    body: 'La page que vous cherchiez n’existe pas, ou elle a déménagé ailleurs.',
    home: 'Retour à l’accueil',
  },

  success: {
    meta: {
      title: 'Merci pour votre achat — HB Studio Co',
      description: 'Votre paiement est validé et votre thème est en route.',
    },
    heading: 'Paiement reçu 🎉',
    body: 'Votre clé de licence et votre lien de téléchargement arrivent dans votre boîte mail. Si rien n’arrive d’ici quelques minutes, regardez dans vos indésirables — et si ce n’est pas là non plus, écrivez-nous : nous réglons cela tout de suite.',
    browseMore: 'Voir les autres thèmes',
    needHelp: 'Un souci ?',
    orderReference: 'Référence de commande : ',
  },

  cancel: {
    meta: {
      title: 'Paiement annulé — HB Studio Co',
      description: 'Votre paiement a été annulé, rien n’a été débité.',
    },
    heading: 'Paiement annulé',
    body: 'Rien n’a été débité. Prenez votre temps — la démo reste ouverte, et votre thème est à un clic quand vous serez prêt.',
    backToPricing: 'Revenir aux thèmes',
  },

  thanks: {
    meta: {
      title: 'Message envoyé — HB Studio Co',
      description: 'Votre message nous est bien parvenu.',
    },
    heading: 'Message envoyé',
    body: 'Merci de nous avoir écrit — un humain vous répond sous un à deux jours ouvrés.',
    backHome: 'Retour à l’accueil',
  },

  templateCard: {
    viewTemplate: 'Voir ce thème',
    endsIn: 'Se termine dans',
  },

  countdown: {
    defaultLabel: 'Offre de lancement — se termine dans',
    days: 'Jours',
    hrs: 'Heures',
    min: 'Min',
    sec: 'Sec',
  },

  cmsLogo: {
    logoAltSuffix: 'logo',
  },
};
