// French dictionary. Typed against `Dictionary` (derived from `en.ts`), so
// removing or misspelling a key here fails `astro check` / `npm run build`
// with a TypeScript error instead of silently rendering an empty string.
//
// TEMPORARY: values are the exact English strings, copied verbatim. This is
// intentional — the typed dictionary wiring is what this task delivers; the
// actual French copy is a follow-up written by a human translator. Do not
// translate anything here.
import type { Dictionary } from './en';

export const fr: Dictionary = {
  // Reused verbatim, word-for-word, in 2+ places — kept here once so every
  // call site stays in sync instead of drifting.
  common: {
    comingSoon: 'Coming soon',
    notifyMe: 'Notify me',
    browseTemplates: 'Browse templates',
    startProject: 'Start a project',
    liveDemo: 'Live demo',
    all: 'All',
  },

  nav: {
    homeAriaLabel: 'HB Studio Co — home',
    templates: 'Templates',
    shopify: 'Shopify',
    wordpress: 'WordPress',
    woocommerce: 'WooCommerce',
    agency: 'Agency',
    getTemplate: 'Get a template',
    menuAriaLabel: 'Menu',
    getInTouch: 'Get in touch',
    // Prefix for the language switcher's aria-label: "Switch to " + "English"/"Français".
    switchTo: 'Switch to ',
  },

  footer: {
    tagline:
      'Premium, conversion-ready website templates for Shopify, WordPress, WooCommerce — and more platforms on the way.',
    catalogueHeading: 'Catalogue',
    allTemplates: 'All templates',
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
    defaultTitle: 'HB Studio Co — Premium website templates',
    defaultDescription:
      'HB Studio Co designs premium, conversion-ready templates for Shopify, WordPress, WooCommerce and more.',
    skipToContent: 'Skip to content',
    redirecting: 'Redirecting…',
    checkoutSoon: '🛒 Checkout opens soon — contact us to pre-order.',
    checkoutUnavailable: 'Checkout is unavailable right now — please try again shortly.',
    networkError: 'Network error — please try again.',
  },

  // src/pages/index.astro
  home: {
    hero: {
      badge: 'Creative studio · Premium templates',
      titleLine1: 'Templates that make',
      titleLine2Prefix: 'your store look ',
      titleLine2Emphasis: 'expensive',
      titleLine2Suffix: '.',
      subtitle:
        'HB Studio Co designs fast, conversion-ready website templates for Shopify, WordPress, WooCommerce — and more platforms on the way. One studio, every stack.',
      statTemplates: 'Templates',
      statPlatforms: 'Platforms',
      statAppFree: 'App-free',
    },
    categories: {
      eyebrow: 'By platform',
      heading: 'Pick your stack',
      viewAll: 'All templates →',
      available: (count: number) => `${count} available →`,
    },
    featured: {
      eyebrow: 'Featured',
      heading: 'Fresh from the studio',
      viewAll: 'View all →',
    },
    howItWorks: {
      eyebrow: 'How it works',
      heading: 'From cart to live store in four steps.',
      steps: [
        { title: 'Choose', body: 'Browse the catalogue and pick the template that fits your brand and platform.' },
        { title: 'Buy & download', body: 'Secure one-time checkout. Your theme ZIP and docs are delivered instantly.' },
        { title: 'Install', body: 'Upload to your platform and follow the illustrated, bilingual documentation.' },
        { title: 'Launch', body: 'Add your products and content, then go live with a fast, polished store.' },
      ],
    },
    why: {
      eyebrow: 'Why HB Studio Co',
      heading: 'Built like products, not just pretty themes.',
      items: [
        { icon: '⚡', title: 'Fast by design', body: 'Inlined critical CSS, lazy responsive images and Core-Web-Vitals-minded builds.' },
        { icon: '🧩', title: 'No paid apps', body: 'The features you need are built in — no monthly app subscriptions.' },
        { icon: '🌍', title: 'Multilingual', body: 'Storefront copy translated and ready for international stores.' },
        { icon: '♿', title: 'Accessible', body: 'Keyboard navigation, visible focus and reduced-motion support throughout.' },
        { icon: '🎨', title: 'Truly editable', body: 'Sections, blocks and presets — restyle everything without code.' },
        { icon: '📖', title: 'Real documentation', body: 'Illustrated, bilingual guides and a demo-rebuild appendix.' },
      ],
    },
    responsive: {
      eyebrow: 'Responsive by default',
      heading: 'Looks great on every screen',
      body: 'Every template is crafted mobile-first — fluid layouts, fast images and touch-friendly navigation, from desktop to phone.',
    },
    // NOTE: the testimonials section's eyebrow/heading and its `const
    // testimonials` data + rendering intentionally stay OUT of this
    // dictionary — that whole section is left untouched (see task notes).
    faq: {
      eyebrow: 'FAQ',
      heading: 'Good questions',
      items: [
        { q: 'Which platforms do you support?', a: 'Today: Shopify (live), with WordPress and WooCommerce coming soon. More platforms (Webflow, Framer) are on the roadmap.' },
        { q: 'Do I need any paid apps?', a: 'No. Our themes build in the features most stores pay apps for — slide-out cart, free-shipping bar, filters, urgency and more.' },
        { q: 'How do I install a template?', a: 'After purchase you download a ZIP and upload it in your platform’s theme area. Each template ships with step-by-step bilingual documentation.' },
        { q: 'Do I get updates?', a: 'Yes — every template includes 12 months of free updates. New versions install alongside your live theme, so nothing is overwritten, and once the window ends your site keeps running with every version released while it was active.' },
        { q: 'What does the license cover?', a: 'The Single license covers one store. Extended covers up to 5 stores and client work. All-Access unlocks every template for a year.' },
        { q: 'Can you build something custom?', a: 'Absolutely. We take on custom template and design work — tell us about your project on the contact page.' },
        { q: 'What’s your refund policy?', a: 'Because templates are instant digital downloads, sales are final — but we’ll happily help by email if anything isn’t working.' },
      ],
    },
    newsletter: {
      heading: 'New templates, first.',
      body: 'Join the list for launch announcements, new platforms and the occasional discount. No spam.',
      honeypotLabel: "Don't fill: ",
      placeholder: 'you@brand.com',
      submit: 'Notify me',
    },
    customCta: {
      eyebrow: 'Custom work',
      headingPrefix: 'Need something ',
      headingEmphasis: 'made to measure',
      headingSuffix: '?',
      body: 'We design and build custom templates and full storefronts. Tell us about your project.',
    },
  },

  // src/pages/about.astro
  about: {
    meta: {
      title: 'About — HB Studio Co',
      description: 'HB Studio Co is a creative studio designing premium website templates for modern brands.',
    },
    hero: {
      eyebrow: 'The studio',
      titlePrefix: 'We design templates ',
      titleEmphasis: 'like products',
      titleSuffix: '.',
      body:
        'HB Studio Co is a creative studio building premium, conversion-ready website templates. We obsess over speed, accessibility and the small details that make a store feel expensive — then we document everything so you can make it yours.',
    },
    whatWeDo: {
      heading: 'What we do',
      body:
        'One studio, every stack. We ship templates for the platforms brands actually use — starting with Shopify, expanding to WordPress, WooCommerce and beyond. Every template is built in-house, sold with bilingual documentation and 12 months of free updates.',
      availableNow: 'Available now',
    },
    weBelieve: {
      heading: 'What we believe',
      items: [
        { title: 'Speed is a feature', body: 'A beautiful store that loads slowly still loses sales. We build for Core Web Vitals from the first line.' },
        { title: 'No app tax', body: 'The essentials are built in. You should not pay monthly for a countdown timer or a slide-out cart.' },
        { title: 'Made to edit', body: 'Sections, blocks and presets mean you can restyle everything without touching code.' },
        { title: 'Documented properly', body: 'Illustrated, bilingual guides — including how to rebuild the demo exactly.' },
      ],
    },
    workWithUs: {
      heading: 'Work with us',
      body: 'Need a custom template or a tweak to an existing one? Tell us about your project.',
    },
  },

  // src/pages/contact.astro
  contact: {
    meta: {
      title: 'Contact — HB Studio Co',
      description: 'Get in touch with HB Studio Co about templates, custom work or support.',
    },
    eyebrow: 'Contact',
    heading: "Let's talk",
    intro: 'A question about a template, a custom project, or support? Send a message — we usually reply within 1–2 business days.',
    honeypotLabel: "Don't fill this out: ",
    nameLabel: 'Name',
    emailLabel: 'Email',
    subjectLabel: 'Subject',
    subjectOptions: ['Template question', 'Custom project', 'Support', 'Other'],
    messageLabel: 'Message',
    submit: 'Send message',
  },

  // src/pages/templates/index.astro
  templatesIndex: {
    meta: {
      title: 'All templates — HB Studio Co',
      description: 'Browse premium templates for Shopify, WordPress, WooCommerce and more.',
    },
    eyebrow: 'Catalogue',
    heading: 'All templates',
    subtitle: 'Conversion-ready templates, designed and built in-house. Filter by platform.',
  },

  // src/pages/templates/[id].astro
  templateDetail: {
    meta: {
      title: (templateTitle: string, cmsLabel: string) => `${templateTitle} — ${cmsLabel} template | HB Studio Co`,
    },
    notifyLaunch: 'Notify me at launch',
    buyPrefix: 'Buy — ',
    oneTimeSingleSite: 'One-time payment · 1 site · 12 months of updates',
    whatsInside: "What's inside",
    priceLabel: 'Price',
    singleLicensePrefix: 'Single license — 1 site · ',
    extendedLicensePrefix: 'Extended — 5 sites · ',
    oneTimeIncluded: 'One-time payment · 12 months of updates included',
    readDocs: 'Read the documentation →',
    interactiveDemo: 'Interactive demo',
    exploreLivePrefix: 'Explore ',
    exploreLiveSuffix: ' live',
    openNewTab: 'Open in new tab',
    openArrow: 'Open ↗',
    demoNote: 'Fully interactive — click through the storefront. (Cart & checkout are disabled in the demo.)',
    closerLook: 'A closer look',
    backToAll: '← Back to all templates',
    screenshotAlt: (templateTitle: string, n: number) => `${templateTitle} screenshot ${n}`,
  },

  // src/pages/category/[cms].astro
  category: {
    meta: {
      title: (cmsLabel: string) => `${cmsLabel} templates — HB Studio Co`,
    },
    comingHeading: (cmsLabel: string) => `${cmsLabel} templates are coming`,
    comingBody: (cmsLabel: string) => `We're crafting ${cmsLabel} templates with the same care as our Shopify work. Want to be first to know?`,
  },

  // src/pages/404.astro
  notFound: {
    meta: { title: 'Page not found — HB Studio Co' },
    heading: 'This page took a day off',
    body: "The page you're looking for doesn't exist or has moved.",
    home: 'Home',
  },

  // src/pages/success.astro
  success: {
    meta: {
      title: 'Thank you for your purchase — HB Studio Co',
      description: 'Your payment was successful.',
    },
    heading: 'Payment received 🎉',
    body: "Thank you for your purchase. A receipt and your download link are on their way to your email. If it doesn’t arrive within a few minutes, check your spam folder or contact us.",
    browseMore: 'Browse more templates',
    needHelp: 'Need help?',
    orderReference: 'Order reference: ',
  },

  // src/pages/cancel.astro
  cancel: {
    meta: {
      title: 'Checkout cancelled — HB Studio Co',
      description: 'Your checkout was cancelled.',
    },
    heading: 'Checkout cancelled',
    body: 'No charge was made. Whenever you’re ready, your template is one click away.',
    backToPricing: 'Back to pricing',
  },

  // src/pages/thanks.astro
  thanks: {
    meta: {
      title: 'Thank you — HB Studio Co',
      description: 'Your message has been sent.',
    },
    heading: 'Message sent',
    body: "Thanks for reaching out — we'll get back to you within 1–2 business days.",
    backHome: 'Back to home',
  },

  // src/components/TemplateCard.astro
  templateCard: {
    viewTemplate: 'View template',
    endsIn: 'Ends in',
  },

  // src/components/Countdown.astro
  countdown: {
    defaultLabel: 'Limited offer — ends in',
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

