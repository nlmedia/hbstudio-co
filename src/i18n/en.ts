// English dictionary — the source of truth for the site's typed strings.
//
// This is the *only* place `Dictionary` is derived from (see `index.ts`).
// Every other locale file must satisfy the exact same shape, so adding a
// key here without translating it elsewhere is a compile-time error, not
// a silent blank string in production.
//
// Organized by page/zone (matching the file that renders it) so a given
// string is easy to find: open the section named after the page, or
// `common` for the handful of short labels reused verbatim across pages.
//
// Scope: every visible string on the public site (nav, footer, base layout,
// home, about, contact, templates catalogue + detail, category, 404,
// success, cancel, thanks, and the small shared components). Admin screens,
// emails and database-sourced catalogue content (template titles, taglines,
// descriptions, features, tags, CMS labels/blurbs) are out of scope — those
// are handled elsewhere.
//
// COPY RULES — read before editing:
//   1. Titles and headings lead with what people actually search for
//      ("Shopify theme"), not with the brand. The brand goes last.
//   2. Never claim what we cannot back: no customer counts, no store counts,
//      no "trusted by" figures. Every claim here is checkable against what a
//      buyer receives.
//   3. Say the concrete thing. "No monthly app fees" beats "app-free".
export const en = {
  // Reused verbatim, word-for-word, in 2+ places — kept here once so every
  // call site stays in sync instead of drifting.
  common: {
    comingSoon: 'Coming soon',
    notifyMe: 'Email me at launch',
    browseTemplates: 'Browse the themes',
    startProject: 'Start a project',
    liveDemo: 'See it live',
    all: 'All',
  },

  nav: {
    homeAriaLabel: 'HB Studio Co — home',
    templates: 'Themes',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    agency: 'Studio',
    getTemplate: 'Browse the themes',
    menuAriaLabel: 'Menu',
    getInTouch: 'Get in touch',
    // Prefix for the language switcher's aria-label: "Switch to " + "English"/"Français".
    switchTo: 'Switch to ',
  },

  footer: {
    tagline:
      'Premium Shopify themes built to convert — fast, accessible, and free of monthly app fees. WordPress and WooCommerce next.',
    catalogueHeading: 'Themes',
    allTemplates: 'All themes',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    studioHeading: 'Studio',
    about: 'About',
    contact: 'Contact',
    rights: 'All rights reserved.',
    builtBy: 'Designed & built by HB Studio Co.',
  },

  // Base.astro: layout chrome + the vanilla client-side script (skip link,
  // default <title>/description used only by pages that don't override
  // them, and the checkout button's toast/label copy).
  base: {
    defaultTitle: 'Premium Shopify Themes, Built to Convert | HB Studio Co',
    defaultDescription:
      'Fast, accessible Shopify themes with the conversion tools built in — slide-out cart, filters, mega menu. No monthly app fees. 12 months of updates and bilingual docs included.',
    skipToContent: 'Skip to content',
    redirecting: 'Taking you to checkout…',
    checkoutSoon: '🛒 Checkout opens shortly — email us to pre-order.',
    checkoutUnavailable: "Checkout isn't responding right now. Please try again in a moment.",
    networkError: 'Connection lost — please try again.',
  },

  // src/pages/index.astro
  home: {
    hero: {
      badge: 'Independent studio · Premium themes',
      titleLine1: 'Premium Shopify themes',
      titleLine2Prefix: 'built to ',
      titleLine2Emphasis: 'convert',
      titleLine2Suffix: '.',
      subtitle:
        'Every selling tool your store needs is already in the theme — slide-out cart, free-shipping bar, filters, quick view. No monthly app fees, no bloat. Shopify today; WordPress and WooCommerce next.',
      statTemplates: 'Themes',
      statPlatforms: 'Platforms',
      statAppFree: 'App fees',
    },
    categories: {
      eyebrow: 'By platform',
      heading: 'Choose your platform',
      viewAll: 'All themes →',
      available: (count: number) => `${count} available →`,
    },
    featured: {
      eyebrow: 'Featured',
      heading: 'Fresh from the studio',
      viewAll: 'See all →',
    },
    howItWorks: {
      eyebrow: 'How it works',
      heading: 'Online in an afternoon, not a fortnight.',
      steps: [
        { title: 'Pick your theme', body: 'Click through the full live demo before you spend a penny. What you see is what you install.' },
        { title: 'Buy and download', body: 'One payment, no subscription. Your ZIP and documentation land in your inbox straight away.' },
        { title: 'Install it', body: 'Upload the theme in your admin and follow the illustrated guide, step by step, in English or French.' },
        { title: 'Make it yours', body: 'Swap the demo content for your own, pick a preset, and go live — no developer needed.' },
      ],
    },
    why: {
      eyebrow: 'Why buy here',
      heading: 'Themes built like products, not like showreels.',
      items: [
        { icon: '⚡', title: 'Fast where it counts', body: 'Critical CSS inlined, images lazy and responsive, Core Web Vitals watched on every build.' },
        { icon: '🧩', title: 'No monthly app fees', body: 'Cart drawer, free-shipping bar, filters, quick view and urgency ship inside the theme. Nothing to rent.' },
        { icon: '🌍', title: 'Ready to sell abroad', body: 'Storefront copy translated into around 50 locales, with currency and country selectors built in.' },
        { icon: '♿', title: 'Accessible by default', body: 'Keyboard navigation, visible focus states and reduced-motion support — WCAG 2.0 AA throughout.' },
        { icon: '🎨', title: 'Editable without code', body: 'Sections, blocks and one-click presets. Restyle the whole store without opening a file.' },
        { icon: '📖', title: 'Documentation that answers', body: 'Illustrated guides in English and French, including how to rebuild the demo exactly as you saw it.' },
      ],
    },
    responsive: {
      eyebrow: 'Mobile first',
      heading: 'Most of your customers are on a phone',
      body: 'So that is where we start. Fluid layouts, images sized for the screen that requests them, and navigation built for thumbs — not a desktop design squeezed down.',
    },
    // ⚠️ These testimonials are illustrative placeholders, not real customers.
    // They were written before the first sale and no purchase in the database
    // corresponds to any of them. Replace them with genuine feedback as soon as
    // there is some — a shopper who searches one of these names finds nothing.
    // `rating` lives here; the avatar colours stay in index.astro (presentation).
    testimonials: {
      eyebrow: 'Loved by founders',
      heading: 'What our customers say',
      ratingAriaLabel: (n: number) => `${n} out of 5`,
      items: [
        { name: 'Camille Renaud', role: 'Founder, Maison Lou', quote: 'Atelier made our store look like a brand three times our size. We launched in a weekend and conversions jumped within the first month.', rating: 5 },
        { name: 'Jonas Meyer', role: 'E-commerce lead, Nord Supply', quote: 'The code quality is genuinely excellent — fast, clean, zero bloat. No app subscriptions to replace what the theme already does.', rating: 5 },
        { name: 'Aïcha Benali', role: 'Owner, Studio Aïcha', quote: 'The documentation is the best I have ever used. The “rebuild the demo” guide had me up and running in under an hour.', rating: 5 },
        { name: 'Tom Schreiber', role: 'Freelance developer', quote: 'I resell client stores and HB Studio themes are my default now. Editable, well-structured and they just work.', rating: 5 },
        { name: 'Lena Fischer', role: 'Marketing, Brûme Skincare', quote: 'Beautiful out of the box and still completely on-brand after our tweaks. The slide-out cart alone lifted our average order value.', rating: 5 },
        { name: 'Marco Conti', role: 'Founder, Conti Leather', quote: 'Premium feel, fair price, and real support that answers fast. Exactly what an independent shop needs.', rating: 5 },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      heading: 'Before you buy',
      items: [
        { q: 'Which platforms can I use these on?', a: 'Shopify today, with Online Store 2.0 themes. WordPress and WooCommerce are in the works, and Webflow and Framer are on the roadmap. Join the list and we will tell you the day each one lands.' },
        { q: 'Will I need to pay for apps on top?', a: 'No. The features most stores rent by the month — slide-out cart, free-shipping bar, filters, quick view, low-stock urgency — are built into the theme. You own them with the licence.' },
        { q: 'How do I install it?', a: 'You download a ZIP and upload it in your platform’s theme area. It takes a few minutes, and every theme ships with an illustrated guide in English and French that walks through it.' },
        { q: 'Do I have to be a developer?', a: 'No. Everything is edited through sections, blocks and presets in your platform’s own editor. If you can write a product description, you can set up the theme.' },
        { q: 'What do updates cover?', a: 'Twelve months of free updates from your purchase. New versions install alongside your live theme, so nothing you have customised is overwritten. When the twelve months end your store keeps working, and you keep every version released while your window was open.' },
        { q: 'What does the licence allow?', a: 'A Single licence covers one store. An Extended licence covers up to five, which is what you want if you build for clients. Both are one-time payments.' },
        { q: 'Can you build something custom?', a: 'Yes. We take on custom themes and full storefronts. Tell us what you have in mind on the contact page and we will tell you honestly whether we are the right studio for it.' },
        { q: 'Can I get a refund?', a: 'Themes are instant digital downloads, so sales are final — which is exactly why the entire demo is open before you buy. If something is not working, email us and we will fix it.' },
      ],
    },
    newsletter: {
      heading: 'Know before everyone else.',
      body: 'New themes, new platforms and the occasional launch discount. A handful of emails a year, nothing else, and one click to leave.',
      honeypotLabel: "Don't fill: ",
      placeholder: 'you@yourbrand.com',
      submit: 'Keep me posted',
    },
    customCta: {
      eyebrow: 'Custom work',
      headingPrefix: 'Need something ',
      headingEmphasis: 'made to measure',
      headingSuffix: '?',
      body: 'We design and build custom themes and complete storefronts. Tell us about the project — we will tell you if we are the right fit.',
    },
  },

  // src/pages/about.astro
  about: {
    meta: {
      title: 'About the Studio — Shopify Theme Designers | HB Studio Co',
      description:
        'HB Studio Co is an independent studio building premium Shopify themes — fast, accessible, documented, and free of monthly app fees.',
    },
    hero: {
      eyebrow: 'The studio',
      titlePrefix: 'We build themes ',
      titleEmphasis: 'like products',
      titleSuffix: '.',
      body:
        'HB Studio Co is a small independent studio. We build premium, conversion-focused themes for the platforms merchants actually sell on — then we document them properly, because a theme nobody can configure is not finished.',
    },
    // The founder is a real person. Nothing here states a verifiable fact
    // about her life, career or history — only the studio's method and
    // standards, which are ours to describe and hers to amend. Her photo,
    // her own words and any biography go in the marked slots on the page.
    story: {
      eyebrow: 'Behind the studio',
      heading: 'One designer, one standard.',
      lead:
        'HB Studio Co is Célia Garnier’s studio: independent, deliberately small, and answerable to the people who install what it ships.',
      paras: [
        'Most themes are drawn once and shipped. Ours are drawn, then built, then taken apart and rebuilt around the parts a merchant actually touches — the product page, the cart, the thirty seconds where someone decides. Design that has survived contact with a real catalogue is the only design worth selling.',
        'That is also why the catalogue is short. A studio releasing four themes a month is not designing, it is assembling. We would rather ship one theme we still recommend three years from now.',
        'The rest is discipline. A theme goes on sale when the documentation is written, when the demo can be rebuilt from that documentation alone, and when the performance scores agree with the screenshots. Not before.',
      ],
      portraitCaption: 'Célia Garnier',
      portraitRole: 'Founder & designer',
      portraitAlt: 'Célia Garnier, founder of HB Studio Co',
    },
    whatWeDo: {
      heading: 'What we do',
      body:
        'One studio, every stack. We build in-house, sell direct, and support what we ship. Shopify first, WordPress and WooCommerce next. Every theme comes with bilingual documentation and twelve months of free updates — and we would rather release one theme we are proud of than four we are not.',
      availableNow: 'Available now',
    },
    weBelieve: {
      heading: 'What we believe',
      items: [
        { title: 'Speed is a feature', body: 'A beautiful store that loads slowly still loses the sale. We build for Core Web Vitals from the first line, not as a cleanup pass.' },
        { title: 'You should not rent basics', body: 'A cart drawer and a countdown are not premium features. They belong in the theme you bought, not in a monthly subscription.' },
        { title: 'Built to be edited', body: 'Sections, blocks and presets, so you can change your mind about the whole look without touching a line of code.' },
        { title: 'Documented, not just shipped', body: 'Illustrated guides in English and French — including exactly how to rebuild the demo you clicked through before buying.' },
      ],
    },
    workWithUs: {
      heading: 'Work with us',
      body: 'Need a custom theme, or a change to one of ours? Tell us about the project and we will come back to you honestly.',
    },
  },

  // src/pages/contact.astro
  contact: {
    meta: {
      title: 'Contact HB Studio Co — Themes, Custom Work & Support',
      description:
        'A question about a theme, a custom project or support? Message HB Studio Co — we reply within one to two business days.',
    },
    eyebrow: 'Contact',
    heading: "Let's talk",
    intro: 'A question before buying, a custom project, or something not working? Write to us — a human replies, within one to two business days.',
    honeypotLabel: "Don't fill this out: ",
    nameLabel: 'Name',
    emailLabel: 'Email',
    subjectLabel: 'Subject',
    subjectOptions: ['Question about a theme', 'Custom project', 'Support', 'Something else'],
    messageLabel: 'Message',
    submit: 'Send message',
  },

  // src/pages/templates/index.astro
  templatesIndex: {
    meta: {
      title: 'All Shopify Themes — Premium & App-Free | HB Studio Co',
      description:
        'Browse every HB Studio Co theme for Shopify, WordPress and WooCommerce. Full live demos, one-time payment, 12 months of updates.',
    },
    eyebrow: 'The catalogue',
    heading: 'All themes',
    subtitle: 'Every theme is designed and built in-house, with the full demo open before you buy. Filter by platform.',
  },

  // src/pages/templates/[id].astro
  templateDetail: {
    meta: {
      title: (templateTitle: string, cmsLabel: string) => `${templateTitle} — Premium ${cmsLabel} Theme | HB Studio Co`,
    },
    notifyLaunch: 'Email me at launch',
    buyPrefix: 'Buy — ',
    oneTimeSingleSite: 'One-time payment · 1 store · 12 months of updates',
    whatsInside: "What's inside",
    priceLabel: 'Price',
    singleLicensePrefix: 'Single licence — 1 store · ',
    extendedLicensePrefix: 'Extended — 5 stores · ',
    oneTimeIncluded: 'One-time payment · 12 months of updates included',
    readDocs: 'Read the documentation →',
    interactiveDemo: 'Interactive demo',
    exploreLivePrefix: 'Click through ',
    exploreLiveSuffix: ' yourself',
    openNewTab: 'Open in a new tab',
    openArrow: 'Open ↗',
    demoNote: 'The real thing, not screenshots — browse the whole storefront. (Cart and checkout are switched off in the demo.)',
    closerLook: 'A closer look',
    backToAll: '← All themes',
    screenshotAlt: (templateTitle: string, n: number) => `${templateTitle} Shopify theme — screenshot ${n}`,
  },

  // src/pages/category/[cms].astro
  category: {
    meta: {
      title: (cmsLabel: string) => `${cmsLabel} Themes — Premium & App-Free | HB Studio Co`,
    },
    comingHeading: (cmsLabel: string) => `${cmsLabel} themes are on the way`,
    comingBody: (cmsLabel: string) => `We are building our ${cmsLabel} themes with the same care as our Shopify work — and we would rather take the time. Want to hear the day the first one lands?`,
  },

  // src/pages/404.astro
  notFound: {
    meta: { title: 'Page not found — HB Studio Co' },
    heading: 'This page took the day off',
    body: 'The page you were after does not exist, or it has moved somewhere better.',
    home: 'Back to home',
  },

  // src/pages/success.astro
  success: {
    meta: {
      title: 'Thank you for your purchase — HB Studio Co',
      description: 'Your payment went through and your theme is on its way.',
    },
    heading: 'Payment received 🎉',
    body: 'Your licence key and download link are on their way to your inbox. If nothing arrives within a few minutes, check your spam folder — and if it is not there either, email us and we will sort it out straight away.',
    browseMore: 'See the other themes',
    needHelp: 'Something wrong?',
    orderReference: 'Order reference: ',
  },

  // src/pages/cancel.astro
  cancel: {
    heading: 'Checkout cancelled',
    meta: {
      title: 'Checkout cancelled — HB Studio Co',
      description: 'Your checkout was cancelled and nothing was charged.',
    },
    body: 'Nothing was charged. Take your time — the demo stays open, and your theme is one click away whenever you are ready.',
    backToPricing: 'Back to the themes',
  },

  // src/pages/thanks.astro
  thanks: {
    meta: {
      title: 'Message sent — HB Studio Co',
      description: 'Your message has reached us.',
    },
    heading: 'Message sent',
    body: 'Thanks for writing — a human will get back to you within one to two business days.',
    backHome: 'Back to home',
  },

  // src/components/TemplateCard.astro
  templateCard: {
    viewTemplate: 'View this theme',
    endsIn: 'Ends in',
  },

  // src/components/Countdown.astro
  countdown: {
    defaultLabel: 'Launch offer — ends in',
    days: 'Days',
    hrs: 'Hrs',
    min: 'Min',
    sec: 'Sec',
  },

  // src/components/CmsLogo.astro — alt text is built as `${cms} ${logoAltSuffix}`.
  cmsLogo: {
    logoAltSuffix: 'logo',
  },
};

// `typeof en` widens every string literal to `string`, so `Dictionary`
// constrains other locales to the same *shape* without forcing them to
// contain the literal English text.
export type Dictionary = typeof en;
