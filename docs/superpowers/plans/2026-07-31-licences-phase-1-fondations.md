# Licences — Phase 1 « Fondations » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque achat génère une licence d'activation, l'e-mail de livraison la transmet, et l'administration permet de la gérer.

**Architecture :** Le schéma Supabase reçoit quatre tables (`hb_licenses`, `hb_activations`, `hb_template_versions`, `hb_license_events`) et quatre colonnes sur `hb_templates`. La logique métier pure (génération de clé, calcul des droits, tarification) vit dans des modules JS testables importés à la fois par les pages Astro et par les fonctions Netlify. Le tunnel d'achat passe d'un catalogue en dur à une tarification `{ slug, tier }` lue en base, et le webhook Stripe crée la licence puis l'envoie par e-mail.

**Tech Stack :** Astro 5, Tailwind 4, Supabase (Postgres + RLS), Netlify Functions (Node/esbuild), Stripe, Brevo, vitest.

**Spec :** `docs/superpowers/specs/2026-07-31-licences-espace-client-design.md`

**Périmètre :** phase 1 seulement. Les phases 2 (espace client), 3 (API d'activation + client PHP) et 4 (serveur de mises à jour) font l'objet de plans distincts, chacune produisant un livrable testable seul.

---

## Préalables

Toutes les commandes se lancent depuis la racine du projet :

```bash
cd "/Users/houss/Library/Mobile Documents/com~apple~CloudDocs/Documents/Claude projet/hbstudio-co"
```

⚠️ Le `node` du PATH est en v16 et casse Vite/vitest. **Chaque shell** doit commencer par :

```bash
export PATH="/opt/homebrew/bin:$PATH"
node -v   # doit afficher v25.x, pas v16.x
```

⚠️ **Pour tester les routes `/api/*` en local, exporter `.env` dans l'environnement du serveur** :

```bash
set -a; . ./.env; set +a
npm run dev
```

`astro dev` charge `.env` dans `import.meta.env`, **pas dans `process.env`** — or les fonctions Netlify (`netlify/functions/*.mjs`) lisent `process.env`. Sans cet export, `getSupabase()` renvoie `null` et toutes les routes `/api/*` répondent `503 not_configured` **quelle que soit la requête**, ce qui fait diagnostiquer à tort un problème de clés Stripe. En production, Netlify fournit de vraies variables d'environnement : le piège est purement local.

Le SQL s'applique dans **Supabase → SQL Editor** (copier/coller le fichier, Run). Si vous passez par le MCP Supabase, utilisez `execute_sql` et non `apply_migration` : ce dernier découpe mal les blocs `$$`.

### Convention de langue

⚠️ **Tous les commentaires de code, blocs JSDoc et libellés de test s'écrivent en anglais.** C'est la convention du projet, sans exception avant la phase 1 (`netlify/functions/*.mjs`, `src/lib/settings.ts`, `catalog.ts`, `alerts.ts`). Les chaînes destinées à l'utilisateur final restent en français dans l'interface (`/admin`, e-mails) et en anglais sur le site public, comme aujourd'hui.

Les blocs de code de ce plan comportent des commentaires en français pour la lisibilité de la relecture : **les transcrire en anglais** au moment de les écrire. Les commentaires SQL suivent la même règle.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/license.mjs` **(créer)** | logique pure : génération de clé, sièges par niveau, calcul des droits |
| `src/lib/license.test.ts` **(créer)** | tests de ce qui précède |
| `netlify/functions/_pricing.mjs` **(créer)** | résolution du montant à facturer pour `{ template, tier }` |
| `netlify/functions/_pricing.test.ts` **(créer)** | tests de ce qui précède |
| `netlify/functions/_licensing.mjs` **(créer)** | création et révocation de licence côté serveur (accès base) |
| `supabase/migrations/20260731_licenses.sql` **(créer)** | migration |
| `supabase/schema.sql` **(modifier)** | sauvegarde portable, tenue à jour |
| `netlify/functions/create-checkout.mjs` **(modifier)** | tarification par niveau |
| `netlify/functions/stripe-webhook.mjs` **(modifier)** | génération de licence, e-mail enrichi, révocation |
| `netlify/functions/download.mjs` **(modifier)** | résolution du fichier par version |
| `src/lib/templateForm.ts` **(modifier)** | nouveaux champs du formulaire template |
| `src/components/admin/TemplateForm.astro` **(modifier)** | idem, côté UI |
| `src/pages/templates/[id].astro` **(modifier)** | sélecteur de niveau |
| `src/layouts/Base.astro` **(modifier)** | envoi de `{ slug, tier }` au checkout |
| `src/layouts/Admin.astro` **(modifier)** | entrée « Licences » dans la navigation |
| `src/pages/admin/licenses/index.astro` **(créer)** | liste des licences |
| `src/pages/admin/licenses/[id].astro` **(créer)** | fiche licence + 4 actions |

**Pourquoi `.mjs` et non `.ts` pour la logique partagée.** `src/lib/license.mjs` est importé à la fois par des pages Astro (TypeScript) et par des fonctions Netlify (`.mjs`, bundlées par esbuild). Le JS annoté en JSDoc est consommable par les deux sans dépendre du transpileur de Netlify pour un fichier `.ts` situé hors du dossier des fonctions. Les tests, eux, restent en `.ts` — vitest les transpile.

---

## Task 1 : Mettre en place vitest et générer les clés de licence

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/license.mjs`
- Test: `src/lib/license.test.ts`

- [ ] **Step 1 : Installer vitest**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm install -D vitest@^3.0.0
```

- [ ] **Step 2 : Ajouter le script de test**

Dans `package.json`, ajouter dans `"scripts"` (après `"astro": "astro"`) :

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3 : Créer la configuration vitest**

Créer `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Les fichiers de netlify/functions/ sont en .mjs : sans les deux extensions,
    // un test .mjs ne serait jamais exécuté ET la suite resterait verte.
    include: ['src/**/*.test.{ts,mjs}', 'netlify/**/*.test.{ts,mjs}'],
  },
});
```

- [ ] **Step 4 : Écrire le test qui échoue**

Créer `src/lib/license.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { generateLicenseKey } from './license.mjs';

describe('generateLicenseKey', () => {
  it('produit le format HB-XXXX-XXXX-XXXX-XXXX', () => {
    expect(generateLicenseKey()).toMatch(/^HB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("n'utilise jamais les caractères ambigus 0 O 1 I L", () => {
    const keys = Array.from({ length: 200 }, () => generateLicenseKey()).join('');
    expect(keys).not.toMatch(/[01OIL]/);
  });

  it('rejette les octets qui biaiseraient le modulo', () => {
    // 248..255 doivent être ignorés : sinon les 5 premiers caractères de
    // l'alphabet sortiraient plus souvent que les autres.
    const feed = [248, 249, 250, 251, 252, 253, 254, 255, ...Array(32).fill(0)];
    let i = 0;
    const fakeRandomBytes = (n: number) =>
      Uint8Array.from({ length: n }, () => feed[i++] ?? 0);
    expect(generateLicenseKey(fakeRandomBytes)).toBe('HB-AAAA-AAAA-AAAA-AAAA');
  });

  it('produit des clés distinctes', () => {
    const set = new Set(Array.from({ length: 500 }, () => generateLicenseKey()));
    expect(set.size).toBe(500);
  });
});
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il échoue**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test
```

Attendu : ÉCHEC, `Failed to resolve import "./license.mjs"`.

- [ ] **Step 6 : Écrire l'implémentation minimale**

Créer `src/lib/license.mjs` :

```js
import { randomBytes } from 'node:crypto';

/** Alphabet sans caractères ambigus : ni 0/O, ni 1/I/L. 31 symboles. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LIMIT = 248; // 31 × 8 — au-delà, l'octet est rejeté pour éviter le biais du modulo

/**
 * Génère une clé de licence au format HB-XXXX-XXXX-XXXX-XXXX (~78 bits).
 * @param {(n: number) => Uint8Array} randomBytesFn source d'aléa, injectable pour les tests
 * @returns {string}
 */
export function generateLicenseKey(randomBytesFn = randomBytes) {
  const chars = [];
  while (chars.length < 16) {
    for (const b of randomBytesFn(24)) {
      if (b >= LIMIT) continue;
      chars.push(ALPHABET[b % ALPHABET.length]);
      if (chars.length === 16) break;
    }
  }
  return 'HB-' + chars.join('').match(/.{4}/g).join('-');
}
```

- [ ] **Step 7 : Lancer le test pour vérifier qu'il passe**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test
```

Attendu : SUCCÈS, 4 tests passés.

- [ ] **Step 8 : Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/license.mjs src/lib/license.test.ts
git commit -m "feat(license): key generation with unbiased alphabet + vitest harness"
```

---

## Task 2 : Sièges par niveau et calcul des droits

**Files:**
- Modify: `src/lib/license.mjs`
- Test: `src/lib/license.test.ts`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `src/lib/license.test.ts` :

```ts
import { seatsForTier, updatesUntilFrom, hasActiveUpdates, canDownloadVersion } from './license.mjs';

describe('seatsForTier', () => {
  it('donne 1 siège en single et 5 en extended', () => {
    expect(seatsForTier('single')).toBe(1);
    expect(seatsForTier('extended')).toBe(5);
  });

  it('rejette un niveau inconnu', () => {
    expect(() => seatsForTier('all-access')).toThrow('Unknown tier: all-access');
  });
});

describe('updatesUntilFrom', () => {
  it('ajoute 12 mois à la date d\'achat', () => {
    expect(updatesUntilFrom('2026-07-31T10:00:00.000Z')).toBe('2027-07-31T10:00:00.000Z');
  });

  it('gère le 29 février sans produire de date invalide', () => {
    expect(updatesUntilFrom('2028-02-29T10:00:00.000Z')).toBe('2029-03-01T10:00:00.000Z');
  });
});

describe('hasActiveUpdates', () => {
  const now = new Date('2026-07-31T00:00:00.000Z');

  it('est vrai pour une licence active non expirée', () => {
    expect(hasActiveUpdates({ status: 'active', updates_until: '2027-01-01T00:00:00.000Z' }, now)).toBe(true);
  });

  it('est faux une fois la date de mises à jour passée', () => {
    expect(hasActiveUpdates({ status: 'active', updates_until: '2026-01-01T00:00:00.000Z' }, now)).toBe(false);
  });

  it('est faux pour une licence révoquée même dans les délais', () => {
    expect(hasActiveUpdates({ status: 'revoked', updates_until: '2027-01-01T00:00:00.000Z' }, now)).toBe(false);
  });
});

describe('canDownloadVersion', () => {
  const expired = { status: 'active', updates_until: '2026-01-01T00:00:00.000Z' };

  it('autorise une version sortie pendant la période de droits', () => {
    expect(canDownloadVersion(expired, { released_at: '2025-12-25T00:00:00.000Z' })).toBe(true);
  });

  it('refuse une version sortie après la fin des droits', () => {
    expect(canDownloadVersion(expired, { released_at: '2026-03-01T00:00:00.000Z' })).toBe(false);
  });

  it('autorise une version sortie exactement à la date limite', () => {
    expect(canDownloadVersion(expired, { released_at: '2026-01-01T00:00:00.000Z' })).toBe(true);
  });

  it('refuse tout à une licence révoquée', () => {
    expect(canDownloadVersion({ status: 'revoked', updates_until: '2027-01-01T00:00:00.000Z' },
      { released_at: '2026-01-01T00:00:00.000Z' })).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test
```

Attendu : ÉCHEC, `seatsForTier is not a function` (et les suivantes).

- [ ] **Step 3 : Écrire l'implémentation**

Ajouter à la fin de `src/lib/license.mjs` :

```js
/** @typedef {{ status: string, updates_until: string }} License */
/** @typedef {{ released_at: string }} TemplateVersion */

/** Nombre de sites autorisés par niveau. Figé dans la licence au moment de l'achat. */
export const SEATS_BY_TIER = { single: 1, extended: 5 };

/**
 * @param {string} tier
 * @returns {number}
 */
export function seatsForTier(tier) {
  const seats = SEATS_BY_TIER[tier];
  if (!seats) throw new Error(`Unknown tier: ${tier}`);
  return seats;
}

/**
 * Fin des droits aux mises à jour : 12 mois après l'achat.
 * @param {string | Date} purchasedAt
 * @returns {string} ISO 8601
 */
export function updatesUntilFrom(purchasedAt) {
  const d = new Date(purchasedAt);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/**
 * La licence donne-t-elle droit aux mises à jour aujourd'hui ?
 * @param {License} license
 * @param {Date} [now]
 * @returns {boolean}
 */
export function hasActiveUpdates(license, now = new Date()) {
  return license.status === 'active' && new Date(license.updates_until) > now;
}

/**
 * Cette version est-elle téléchargeable ? Une licence expirée conserve l'accès
 * aux versions parues PENDANT sa période de droits, et à rien de plus.
 * @param {License} license
 * @param {TemplateVersion} version
 * @returns {boolean}
 */
export function canDownloadVersion(license, version) {
  if (license.status !== 'active') return false;
  return new Date(version.released_at) <= new Date(license.updates_until);
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test
```

Attendu : SUCCÈS, 15 tests passés.

Note : le test du 29 février est vert parce que `setUTCFullYear` fait déborder le 29/02/2028 sur le 01/03/2029. C'est le comportement voulu et il est verrouillé par le test — pas un accident.

Note de périmètre : `hasActiveUpdates` et `canDownloadVersion` ne sont appelés par aucun code de la phase 1 — le lien de téléchargement de la phase 1 est signé par HMAC et n'a pas de contexte de licence. Ils sont écrits et testés ici parce qu'ils constituent la règle de droits de la spec (§5.4) et qu'ils sont consommés dès la phase 2 (`/account`) puis la phase 4 (serveur de mises à jour). Ne pas les supprimer en croyant à du code mort.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/license.mjs src/lib/license.test.ts
git commit -m "feat(license): seats per tier and entitlement rules"
```

---

## Task 3 : Migration SQL — les quatre tables

**Files:**
- Create: `supabase/migrations/20260731_licenses.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1 : Écrire la migration**

Créer `supabase/migrations/20260731_licenses.sql` :

```sql
-- ============================================================================
-- Phase 1 — Licences d'activation
-- Spec : docs/superpowers/specs/2026-07-31-licences-espace-client-design.md
-- ============================================================================

-- ── hb_templates : colonnes ajoutées ────────────────────────────────────────
alter table public.hb_templates add column if not exists extended_price numeric;
alter table public.hb_templates add column if not exists theme_slug   text;
alter table public.hb_templates add column if not exists requires_wp  text;
alter table public.hb_templates add column if not exists requires_php text;

comment on column public.hb_templates.theme_slug is
  'Nom du dossier du thème WordPress. WordPress identifie un thème par ce nom : sans correspondance exacte, la mise à jour ne s''affiche jamais chez le client.';

-- ── hb_licenses ─────────────────────────────────────────────────────────────
-- Pas de statut « expired » : une licence n'expire jamais pour l'USAGE, seul le
-- droit aux mises à jour expire, et c'est updates_until qui en décide.
create table if not exists public.hb_licenses (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,
  template_id   uuid references public.hb_templates(id) on delete restrict,
  tier          text not null check (tier in ('single','extended')),
  seats         int  not null check (seats > 0),
  email         text not null,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'active' check (status in ('active','revoked')),
  sale_id       text references public.hb_sales(id) on delete set null,
  updates_until timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.hb_licenses.seats is
  'Figé à l''achat. Si l''offre Extended passe un jour de 5 à 10 sites, les licences déjà vendues conservent les droits payés.';

create index if not exists hb_licenses_email_idx on public.hb_licenses (lower(email));
create index if not exists hb_licenses_user_idx  on public.hb_licenses (user_id);
-- Une vente ne peut produire qu'une licence : garantit l'idempotence si Stripe
-- rejoue le webhook. Jamais utilisé comme cible d'un ON CONFLICT (index partiel).
create unique index if not exists hb_licenses_sale_uidx
  on public.hb_licenses (sale_id) where sale_id is not null;

drop trigger if exists hb_licenses_touch on public.hb_licenses;
create trigger hb_licenses_touch before update on public.hb_licenses
  for each row execute function public.hb_touch_updated_at();

-- ── hb_activations ──────────────────────────────────────────────────────────
-- Sièges consommés = deactivated_at is null AND is_dev = false.
-- Volontairement PAS d'index unique partiel sur (license_id, domain) : la
-- réactivation d'un domaine libéré est gérée explicitement en phase 3, et un
-- index partiel combiné à un upsert impose de répliquer la clause WHERE dans le
-- ON CONFLICT — divergence silencieuse à l'écriture.
create table if not exists public.hb_activations (
  id             uuid primary key default gen_random_uuid(),
  license_id     uuid not null references public.hb_licenses(id) on delete cascade,
  domain         text not null,
  platform       text check (platform in ('woocommerce','shopify')),
  site_name      text,
  is_dev         boolean not null default false,
  activated_at   timestamptz not null default now(),
  deactivated_at timestamptz,
  last_seen_at   timestamptz
);
create index if not exists hb_activations_license_domain_idx
  on public.hb_activations (license_id, domain);

-- ── hb_template_versions ────────────────────────────────────────────────────
create table if not exists public.hb_template_versions (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.hb_templates(id) on delete cascade,
  version     text not null,
  package     text not null,
  changelog   text,
  released_at timestamptz not null default now(),
  unique (template_id, version)
);
create index if not exists hb_template_versions_released_idx
  on public.hb_template_versions (template_id, released_at desc);

-- ── hb_license_events ───────────────────────────────────────────────────────
-- Journal TECHNIQUE (appels de l'API). Les actions humaines de l'admin vont
-- dans hb_audit_log.
create table if not exists public.hb_license_events (
  id         bigint generated always as identity primary key,
  license_id uuid references public.hb_licenses(id) on delete cascade,
  key_hash   text,
  event      text not null check (event in ('activate','deactivate','validate','revoke','reassign','extend')),
  domain     text,
  ip         text,
  user_agent text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- key_hash : empreinte SHA-256 hexadécimale de la clé présentée, calculée par la
-- fonction appelante, JAMAIS la clé elle-même. Renseignée même quand aucune licence
-- ne correspond — license_id est alors nul, et c'est le seul moyen de compter les
-- tentatives sur une clé inconnue (§10.2). Ne jamais « simplifier » en stockant la
-- clé en clair : ce journal est fait pour être lu, exporté et collé dans des tickets.
comment on column public.hb_license_events.key_hash is
  'SHA-256 hex digest of the presented key, computed by the caller. Never the key itself.';

create index if not exists hb_license_events_license_idx
  on public.hb_license_events (license_id, created_at desc);
-- Sans ces deux index, la limitation de débit du §10.2 dégénère en balayage complet.
create index if not exists hb_license_events_ip_idx
  on public.hb_license_events (ip, created_at desc);
create index if not exists hb_license_events_key_hash_idx
  on public.hb_license_events (key_hash, created_at desc);

-- ============ Row Level Security ============
alter table public.hb_licenses          enable row level security;
alter table public.hb_activations       enable row level security;
alter table public.hb_template_versions enable row level security;
alter table public.hb_license_events    enable row level security;

drop policy if exists hb_licenses_owner_read on public.hb_licenses;
create policy hb_licenses_owner_read on public.hb_licenses
  for select to authenticated using (user_id = auth.uid() or public.hb_is_admin());
drop policy if exists hb_licenses_admin_all on public.hb_licenses;
create policy hb_licenses_admin_all on public.hb_licenses
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_activations_owner_read on public.hb_activations;
create policy hb_activations_owner_read on public.hb_activations
  for select to authenticated using (
    exists (
      select 1 from public.hb_licenses l
      where l.id = hb_activations.license_id
        and (l.user_id = auth.uid() or public.hb_is_admin())
    )
  );
drop policy if exists hb_activations_admin_all on public.hb_activations;
create policy hb_activations_admin_all on public.hb_activations
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

-- Aucune politique de lecture client sur hb_template_versions, délibérément : la
-- colonne `package` est un chemin de stockage privé qui ne doit jamais atteindre le
-- client (§10.1), et RLS ne sait pas restreindre au niveau d'une colonne. La phase 2
-- exposera les métadonnées de version via une RPC `security definer` qui omet
-- `package` et filtre selon les droits (§5.4).
drop policy if exists hb_template_versions_admin_all on public.hb_template_versions;
create policy hb_template_versions_admin_all on public.hb_template_versions
  for all to authenticated using (public.hb_is_admin()) with check (public.hb_is_admin());

drop policy if exists hb_license_events_admin_read on public.hb_license_events;
create policy hb_license_events_admin_read on public.hb_license_events
  for select to authenticated using (public.hb_is_admin());
```

- [ ] **Step 2 : Appliquer la migration**

Ouvrir **Supabase → SQL Editor**, coller l'intégralité du fichier, cliquer **Run**.

Attendu : `Success. No rows returned`.

- [ ] **Step 3 : Vérifier que les tables existent**

Dans le SQL Editor, exécuter :

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('hb_licenses','hb_activations','hb_template_versions','hb_license_events')
order by table_name;
```

Attendu : exactement 4 lignes — `hb_activations`, `hb_license_events`, `hb_licenses`, `hb_template_versions`.

- [ ] **Step 4 : Vérifier que RLS est bien armé**

```sql
select relname, relrowsecurity
from pg_class
where relname in ('hb_licenses','hb_activations','hb_template_versions','hb_license_events');
```

Attendu : 4 lignes, `relrowsecurity` à `true` partout. Si l'une est à `false`, la table est lisible par n'importe quel porteur de la clé anon — corriger avant de continuer.

- [ ] **Step 5 : Reporter dans la sauvegarde portable**

Dans `supabase/schema.sql`, coller le contenu de la migration **avant** la section `-- ============ Row Level Security ============` existante pour les parties `create table`, et à la fin du fichier pour les parties `policy`. Ce fichier est la sauvegarde rejouable sur un projet Supabase neuf : s'il diverge, une restauration produit une base incomplète.

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/20260731_licenses.sql supabase/schema.sql
git commit -m "feat(db): licenses, activations, versions and license events tables"
```

---

## Task 4 : Exposer les nouvelles colonnes dans l'admin des templates

**Files:**
- Modify: `src/lib/templateForm.ts`
- Modify: `src/components/admin/TemplateForm.astro:24`

- [ ] **Step 1 : Ajouter les champs au parseur**

Dans `src/lib/templateForm.ts`, ajouter après la ligne `const salePrice = str('sale_price');` :

```ts
  const extendedPrice = str('extended_price');
```

Puis, dans l'objet retourné, ajouter après la ligne `sale_ends_at: ...` :

```ts
    extended_price: extendedPrice === '' ? null : Number(extendedPrice),
    theme_slug: str('theme_slug') || null,
    requires_wp: str('requires_wp') || null,
    requires_php: str('requires_php') || null,
```

- [ ] **Step 2 : Ajouter les champs au formulaire**

Dans `src/components/admin/TemplateForm.astro`, juste après la ligne 24 (le champ `price`), insérer :

```astro
    <label><span class={label}>Prix Extended — 5 sites (€, vide = niveau indisponible)</span><input class={field} name="extended_price" type="number" step="1" value={t.extended_price ?? ''} /></label>
    <label><span class={label}>Slug du thème WordPress (dossier)</span><input class={field} name="theme_slug" value={t.theme_slug ?? ''} placeholder="ex. hb-atelier" /></label>
    <label><span class={label}>WordPress minimum</span><input class={field} name="requires_wp" value={t.requires_wp ?? ''} placeholder="ex. 6.4" /></label>
    <label><span class={label}>PHP minimum</span><input class={field} name="requires_php" value={t.requires_php ?? ''} placeholder="ex. 8.1" /></label>
```

- [ ] **Step 3 : Vérifier dans le navigateur**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run dev
```

Ouvrir `http://localhost:4321/admin/templates`, éditer un template, saisir un prix Extended, enregistrer, recharger la page.

Attendu : la valeur est toujours là après rechargement.

⚠️ Si elle disparaît, le défaut est presque toujours en **lecture** et non en écriture : vérifier d'abord en base (`select extended_price from hb_templates where slug = '…'`) avant de toucher au code d'enregistrement.

- [ ] **Step 4 : Commit**

```bash
git add src/lib/templateForm.ts src/components/admin/TemplateForm.astro
git commit -m "feat(admin): extended price, theme slug and platform requirements fields"
```

---

## Task 5 : Résolution du montant à facturer

**Files:**
- Create: `netlify/functions/_pricing.mjs`
- Test: `netlify/functions/_pricing.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `netlify/functions/_pricing.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { resolveAmount } from './_pricing.mjs';

const now = new Date('2026-07-31T00:00:00.000Z');
const base = {
  status: 'published',
  title: 'Atelier',
  cms: 'shopify',
  price: 69,
  sale_price: null,
  sale_ends_at: null,
  extended_price: 149,
};

describe('resolveAmount', () => {
  it('facture le prix single en centimes', () => {
    expect(resolveAmount(base, 'single', now)).toBe(6900);
  });

  it('facture le prix extended en centimes', () => {
    expect(resolveAmount(base, 'extended', now)).toBe(14900);
  });

  it('applique une promo en cours au niveau single', () => {
    const t = { ...base, sale_price: 49, sale_ends_at: '2026-08-31T00:00:00.000Z' };
    expect(resolveAmount(t, 'single', now)).toBe(4900);
  });

  it('ignore une promo expirée', () => {
    const t = { ...base, sale_price: 49, sale_ends_at: '2026-06-01T00:00:00.000Z' };
    expect(resolveAmount(t, 'single', now)).toBe(6900);
  });

  it("n'applique pas la promo au niveau extended", () => {
    const t = { ...base, sale_price: 49, sale_ends_at: '2026-08-31T00:00:00.000Z' };
    expect(resolveAmount(t, 'extended', now)).toBe(14900);
  });

  it('refuse un template non publié', () => {
    expect(resolveAmount({ ...base, status: 'draft' }, 'single', now)).toBeNull();
  });

  it('refuse le niveau extended quand aucun prix extended n\'est fixé', () => {
    expect(resolveAmount({ ...base, extended_price: null }, 'extended', now)).toBeNull();
  });

  it('refuse un niveau inconnu', () => {
    expect(resolveAmount(base, 'all-access', now)).toBeNull();
  });

  it('refuse un template absent', () => {
    expect(resolveAmount(null, 'single', now)).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test
```

Attendu : ÉCHEC, `Failed to resolve import "./_pricing.mjs"`.

- [ ] **Step 3 : Écrire l'implémentation**

Créer `netlify/functions/_pricing.mjs` :

```js
/**
 * Montant à facturer, en centimes, pour un template et un niveau de licence.
 * La promo (sale_price / sale_ends_at) ne porte que sur le niveau single :
 * extended_price est un prix fixé à la main, jamais dérivé du prix single.
 *
 * @param {object|null} template ligne hb_templates
 * @param {string} tier 'single' | 'extended'
 * @param {Date} [now]
 * @returns {number|null} centimes, ou null si l'achat n'est pas possible
 */
export function resolveAmount(template, tier, now = new Date()) {
  if (!template || template.status !== 'published') return null;

  if (tier === 'single') {
    if (template.price == null) return null;
    const notExpired = !template.sale_ends_at || new Date(template.sale_ends_at) > now;
    const onSale =
      template.sale_price != null &&
      Number(template.sale_price) < Number(template.price) &&
      notExpired;
    return Math.round(Number(onSale ? template.sale_price : template.price) * 100);
  }

  if (tier === 'extended') {
    if (template.extended_price == null) return null;
    return Math.round(Number(template.extended_price) * 100);
  }

  return null;
}

/** Libellé du produit affiché sur la page Stripe. */
export function productLabel(template, tier) {
  const suffix = tier === 'extended' ? 'Extended license — 5 sites' : 'Single license — 1 site';
  return `${template.title} (${template.cms}) — ${suffix}`;
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test
```

Attendu : SUCCÈS, 24 tests passés.

- [ ] **Step 5 : Commit**

```bash
git add netlify/functions/_pricing.mjs netlify/functions/_pricing.test.ts
git commit -m "feat(checkout): tier-aware price resolution"
```

---

## Task 6 : Brancher le checkout sur `{ slug, tier }`

**Files:**
- Modify: `netlify/functions/create-checkout.mjs`

- [ ] **Step 1 : Remplacer le contenu du fichier**

Remplacer intégralement `netlify/functions/create-checkout.mjs` par :

```js
import Stripe from 'stripe';
import { getSupabase, loadSettings, pick } from './_lib.mjs';
import { resolveAmount, productLabel } from './_pricing.mjs';

export const config = { path: '/api/checkout' };

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const sb = getSupabase();
  const settings = await loadSettings(sb, ['stripe_secret_key', 'currency']);
  const key = pick(settings, 'stripe_secret_key', 'STRIPE_SECRET_KEY');
  const currency = (settings.currency || 'eur').toLowerCase();
  // Pas encore activé — le front affiche un message « ouverture prochaine ».
  if (!key) {
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }
  if (!sb) {
    return Response.json({ error: 'not_configured' }, { status: 503 });
  }

  let slug, tier;
  try { ({ slug, tier } = await req.json()); } catch { /* ignore */ }
  if (!slug || (tier !== 'single' && tier !== 'extended')) {
    return Response.json({ error: 'unknown_item' }, { status: 400 });
  }

  const { data: template } = await sb
    .from('hb_templates')
    .select('title, cms, price, sale_price, sale_ends_at, extended_price, status')
    .eq('slug', slug)
    .maybeSingle();

  const amount = resolveAmount(template, tier);
  if (amount == null) {
    return Response.json({ error: 'unknown_item' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || 'https://hbstudio-co.netlify.app';

  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: { name: productLabel(template, tier) },
        },
      }],
      customer_creation: 'always',
      billing_address_collection: 'auto',
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      metadata: { slug, tier },
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: 'stripe_error', message: String(err?.message || err) }, { status: 500 });
  }
};
```

Le catalogue en dur (`single` 6900, `extended` 14900, `all-access` 29900) disparaît : l'offre All-Access est hors périmètre (spec §3) et les deux niveaux sont désormais tarifés par template.

- [ ] **Step 2 : Vérifier que le build passe**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run build
```

Attendu : build terminé sans erreur.

- [ ] **Step 3 : Commit**

```bash
git add netlify/functions/create-checkout.mjs
git commit -m "feat(checkout): price per template and tier, drop hardcoded bundles"
```

---

## Task 7 : Sélecteur de niveau sur la fiche template

**Files:**
- Modify: `src/pages/templates/[id].astro`
- Modify: `src/layouts/Base.astro:105-130`

- [ ] **Step 1 : Envoyer `{ slug, tier }` depuis le script de checkout**

Dans `src/layouts/Base.astro`, remplacer les lignes 110 et 118. Ligne 110 devient :

```js
          const slug = el.getAttribute('data-checkout');
          const tier = el.getAttribute('data-tier') || 'single';
```

Ligne 118 devient :

```js
              body: JSON.stringify({ slug, tier }),
```

- [ ] **Step 2 : Ajouter le sélecteur dans l'encart latéral**

Dans `src/pages/templates/[id].astro`, dans l'`<aside>`, remplacer le bloc :

```astro
        {soon ? (
          <a href="/contact" class="mt-5 block rounded-full bg-ink px-6 py-3 text-center font-medium text-paper transition hover:bg-accent">Notify me</a>
        ) : (
          <a href="#" data-checkout={entry.id} class="mt-5 block rounded-full bg-ink px-6 py-3 text-center font-medium text-paper transition hover:bg-accent">Buy {d.title}</a>
        )}
```

par :

```astro
        {soon ? (
          <a href="/contact" class="mt-5 block rounded-full bg-ink px-6 py-3 text-center font-medium text-paper transition hover:bg-accent">Notify me</a>
        ) : (
          <>
            <div class="mt-5 space-y-2">
              <a href="#" data-checkout={entry.id} data-tier="single" class="block rounded-full bg-ink px-6 py-3 text-center font-medium text-paper transition hover:bg-accent">
                Single license — 1 site · {d.currency}{d.effectivePrice}
              </a>
              {d.extendedPrice != null && (
                <a href="#" data-checkout={entry.id} data-tier="extended" class="block rounded-full border border-line-strong px-6 py-3 text-center font-medium transition hover:bg-surface-2">
                  Extended — 5 sites · {d.currency}{d.extendedPrice}
                </a>
              )}
            </div>
            <p class="mt-3 text-center text-xs text-muted">Paiement unique · 12 mois de mises à jour incluses</p>
          </>
        )}
```

- [ ] **Step 3 : Corriger le bouton du hero**

Toujours dans `src/pages/templates/[id].astro`, sur le lien `data-checkout={entry.id}` du hero, ajouter l'attribut `data-tier="single"`. Puis remplacer la mention obsolète :

```astro
            <p class="mt-3 text-sm text-paper/50">One-time payment · single store · lifetime updates</p>
```

par :

```astro
            <p class="mt-3 text-sm text-paper/50">One-time payment · 1 site · 12 months of updates</p>
```

La mention « lifetime updates » contredit désormais le modèle vendu : la laisser exposerait à une réclamation parfaitement fondée.

- [ ] **Step 4 : Exposer `extendedPrice` dans le catalogue**

Dans `src/lib/catalog.ts`, ajouter à l'interface `TemplateData`, après `effectivePrice` :

```ts
  /** Prix du niveau Extended (5 sites), null si le niveau n'est pas proposé */
  extendedPrice: number | null;
```

Et dans `normalize()`, ajouter dans l'objet `data` retourné, après `effectivePrice` :

```ts
      extendedPrice: r.extended_price != null ? Number(r.extended_price) : null,
```

Aucune modification de requête n'est nécessaire : `getTemplates()` et `getTemplate()` utilisent déjà `select('*')` (`src/lib/catalog.ts:82` et `:90`), la nouvelle colonne remonte donc automatiquement.

⚠️ Un champ template se déclare ici à **deux** endroits — l'interface `TemplateData` et le mapper `normalize()`. En oublier un donne exactement le symptôme « la valeur est en base mais ne s'affiche pas ». Si un jour ces requêtes passent à une liste de colonnes explicite, cela fera un troisième endroit à tenir.

- [ ] **Step 5 : Vérifier dans le navigateur**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run dev
```

Ouvrir la fiche d'un template ayant un `extended_price`, puis :
- vérifier que les deux boutons apparaissent avec les bons prix ;
- ouvrir l'onglet Réseau, cliquer « Extended », et vérifier que la requête `POST /api/checkout` porte bien `{"slug":"…","tier":"extended"}` ;
- vérifier qu'un template **sans** `extended_price` n'affiche que le bouton Single.

- [ ] **Step 6 : Commit**

```bash
git add src/pages/templates/\[id\].astro src/layouts/Base.astro src/lib/catalog.ts
git commit -m "feat(store): single/extended tier selector on template page"
```

---

## Task 8 : Créer la licence à l'encaissement

**Files:**
- Create: `netlify/functions/_licensing.mjs`
- Modify: `netlify/functions/stripe-webhook.mjs`

- [ ] **Step 1 : Écrire le module de licence côté serveur**

Créer `netlify/functions/_licensing.mjs` :

```js
import { generateLicenseKey, seatsForTier, updatesUntilFrom } from '../../src/lib/license.mjs';

/**
 * Crée la licence correspondant à une vente. Idempotent : si une licence existe
 * déjà pour ce sale_id (rejeu de webhook Stripe), elle est renvoyée telle quelle.
 *
 * @returns {Promise<object|null>} la licence, ou null si la création est impossible
 */
export async function createLicenseForSale(sb, { saleId, slug, tier, email, purchasedAt }) {
  if (!sb || !slug || !email) return null;

  const { data: existing } = await sb
    .from('hb_licenses')
    .select('*')
    .eq('sale_id', saleId)
    .maybeSingle();
  if (existing) return existing;

  const { data: template } = await sb
    .from('hb_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!template) return null;

  const { data, error } = await sb
    .from('hb_licenses')
    .insert({
      key: generateLicenseKey(),
      template_id: template.id,
      tier,
      seats: seatsForTier(tier),
      email,
      sale_id: saleId,
      updates_until: updatesUntilFrom(purchasedAt),
    })
    .select()
    .single();

  if (error) return null;
  return data;
}

/**
 * Révoque toutes les licences rattachées à une vente (remboursement, litige).
 * @returns {Promise<number>} nombre de licences révoquées
 */
export async function revokeLicensesForSale(sb, saleId, reason) {
  if (!sb || !saleId) return 0;

  const { data } = await sb
    .from('hb_licenses')
    .update({ status: 'revoked' })
    .eq('sale_id', saleId)
    .eq('status', 'active')
    .select('id');

  for (const row of data ?? []) {
    await sb.from('hb_license_events').insert({
      license_id: row.id,
      event: 'revoke',
      detail: { reason, sale_id: saleId },
    });
  }
  return (data ?? []).length;
}
```

- [ ] **Step 2 : Appeler la création depuis le webhook**

Dans `netlify/functions/stripe-webhook.mjs`, ajouter en haut, après les imports existants :

```js
import { createLicenseForSale, revokeLicensesForSale } from './_licensing.mjs';
```

Puis, dans le bloc `if (event.type === 'checkout.session.completed')`, remplacer :

```js
    const item = s.metadata?.item;
```

par :

```js
    const slug = s.metadata?.slug;
    const tier = s.metadata?.tier === 'extended' ? 'extended' : 'single';
    const item = slug;
```

Et, juste après l'appel `recordSale`, insérer :

```js
    let license = null;
    if (slug && email) {
      try {
        license = await createLicenseForSale(sb, {
          saleId: s.id,
          slug,
          tier,
          email,
          purchasedAt: new Date().toISOString(),
        });
      } catch { /* journalisé par Netlify */ }
    }
```

- [ ] **Step 3 : Supprimer les restes du catalogue de bundles**

Toujours dans `netlify/functions/stripe-webhook.mjs`, supprimer la constante `BUNDLE_NAMES` devenue morte (l'offre All-Access est hors périmètre, spec §3) et remplacer `productName` par :

```js
/** Nom lisible du produit : le titre du template, résolu depuis son slug. */
async function productName(sb, slug) {
  if (!sb) return slug;
  const { data } = await sb.from('hb_templates').select('title').eq('slug', slug).maybeSingle();
  return data?.title ?? slug;
}
```

- [ ] **Step 4 : Vérifier que le build passe**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run build
```

Attendu : build terminé sans erreur. Une erreur `Could not resolve "../../src/lib/license.mjs"` signifierait que le bundler des fonctions ne remonte pas hors de `netlify/` — dans ce cas, déplacer `license.mjs` dans `netlify/functions/` et l'importer depuis `src/` par un chemin relatif inverse.

- [ ] **Step 5 : Tester de bout en bout avec Stripe en mode test**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npx stripe listen --forward-to localhost:4321/api/stripe-webhook
```

Dans un second terminal, lancer `npm run dev`, effectuer un achat test avec la carte `4242 4242 4242 4242`, puis vérifier en base :

```sql
select l.key, l.tier, l.seats, l.email, l.updates_until, t.slug
from hb_licenses l join hb_templates t on t.id = l.template_id
order by l.created_at desc limit 1;
```

Attendu : une ligne, `seats` = 1 pour single (5 pour extended), `updates_until` à 12 mois de la date du jour.

- [ ] **Step 6 : Vérifier l'idempotence**

Rejouer le même événement :

```bash
export PATH="/opt/homebrew/bin:$PATH"
npx stripe events resend <EVENT_ID>
```

Puis :

```sql
select count(*) from hb_licenses where sale_id = '<SESSION_ID>';
```

Attendu : `1`. Si `2`, l'index unique partiel `hb_licenses_sale_uidx` n'a pas été créé — revenir à la Task 3.

- [ ] **Step 7 : Commit**

```bash
git add netlify/functions/_licensing.mjs netlify/functions/stripe-webhook.mjs
git commit -m "feat(license): issue a license on checkout completion, idempotent on sale id"
```

---

## Task 9 : E-mail de livraison enrichi

**Files:**
- Modify: `netlify/functions/stripe-webhook.mjs`

- [ ] **Step 1 : Faire porter la clé à l'e-mail**

Dans `netlify/functions/stripe-webhook.mjs`, remplacer la fonction `sendDeliveryEmail` par :

```js
/** Envoie l'e-mail de livraison via Brevo (fournisseur unique de l'application). */
async function sendDeliveryEmail(settings, to, name, link, ttlDays, license, origin) {
  const apiKey = settings.brevo_api_key;
  const senderEmail = settings.sender_email;
  if (!apiKey || !senderEmail) return; // e-mail non configuré

  const licenseBlock = license ? `
      <div style="margin:24px 0;padding:18px;border:1px solid #e5e5ea;border-radius:14px;background:#fafafa">
        <p style="margin:0 0 6px;font-size:13px;color:#6b6b73">Votre clé de licence</p>
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:19px;font-weight:600;letter-spacing:.5px">${license.key}</p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b6b73">
          ${license.seats} site${license.seats > 1 ? 's' : ''} autorisé${license.seats > 1 ? 's' : ''} ·
          mises à jour incluses jusqu'au ${new Date(license.updates_until).toLocaleDateString('fr-FR')}
        </p>
      </div>
      <p style="font-size:14px">Retrouvez à tout moment vos licences et vos téléchargements dans
        <a href="${origin}/account" style="color:#6d4aff">votre espace client</a>.</p>` : '';

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0e0e12">
      <h1 style="font-family:Georgia,serif">Merci pour votre achat 🎉</h1>
      <p>Votre <strong>${name}</strong> est prêt à être téléchargé.</p>
      <p><a href="${link}" style="display:inline-block;background:#0e0e12;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Télécharger vos fichiers</a></p>
      ${licenseBlock}
      <p style="font-size:13px;color:#6b6b73">Ce lien de téléchargement est valable ${ttlDays} jours — votre espace client, lui, reste accessible en permanence.<br>Une question ? Répondez simplement à cet e-mail.</p>
      <p style="font-size:12px;color:#9a9aa6">— HB Studio Co</p>
    </div>`;

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: settings.sender_name || 'HB Studio Co', email: senderEmail },
      ...(settings.reply_to ? { replyTo: { email: settings.reply_to } } : {}),
      to: [{ email: to }],
      subject: `Votre ${name} — clé de licence et téléchargement`,
      htmlContent: html,
    }),
  });
}
```

- [ ] **Step 2 : Adapter l'appel**

Toujours dans le même fichier, remplacer :

```js
      try { await sendDeliveryEmail(settings, email, name, link, ttlDays); } catch { /* logged by Netlify */ }
```

par :

```js
      try { await sendDeliveryEmail(settings, email, name, link, ttlDays, license, origin); } catch { /* logged by Netlify */ }
```

- [ ] **Step 3 : Vérifier**

Refaire un achat test comme en Task 8, étape 4, et ouvrir l'e-mail reçu.

Attendu : la clé au format `HB-XXXX-XXXX-XXXX-XXXX` apparaît dans son encadré, avec le nombre de sites et la date de fin des mises à jour, plus le lien vers l'espace client.

Note : `/account` n'existe pas encore (phase 2) et renverra une 404. C'est attendu — le lien est présent dès maintenant pour que les e-mails déjà envoyés restent valables quand la page sera livrée.

- [ ] **Step 4 : Commit**

```bash
git add netlify/functions/stripe-webhook.mjs
git commit -m "feat(email): deliver the license key with the download link"
```

---

## Task 10 : Servir la bonne version au téléchargement

**Files:**
- Modify: `netlify/functions/download.mjs`

- [ ] **Step 1 : Remplacer la résolution du fichier**

Dans `netlify/functions/download.mjs`, supprimer la constante `BUNDLES` et remplacer `resolvePath` par :

```js
/**
 * Chemin de stockage du fichier à servir pour un template.
 * Sert la version la plus récente ; à défaut de version publiée, retombe sur la
 * colonne historique `deliverable` pour ne pas interrompre les ventes en cours.
 */
async function resolvePath(sb, slug) {
  const { data: template } = await sb
    .from('hb_templates')
    .select('id, deliverable')
    .eq('slug', slug)
    .maybeSingle();
  if (!template) return null;

  const { data: version } = await sb
    .from('hb_template_versions')
    .select('package')
    .eq('template_id', template.id)
    .order('released_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return version?.package || template.deliverable || null;
}
```

- [ ] **Step 2 : Vérifier le repli**

Le lien de téléchargement reçu en Task 9 doit continuer de fonctionner alors qu'aucune ligne n'existe encore dans `hb_template_versions`.

Ouvrir le lien de l'e-mail.

Attendu : le fichier se télécharge, servi depuis `hb_templates.deliverable`.

- [ ] **Step 3 : Vérifier la priorité à la version**

En base :

```sql
insert into hb_template_versions (template_id, version, package, changelog)
select id, '1.0.0', deliverable, 'Version initiale' from hb_templates where slug = '<VOTRE_SLUG>';
```

Rouvrir le lien de téléchargement.

Attendu : le téléchargement fonctionne toujours, désormais résolu via `hb_template_versions`.

- [ ] **Step 4 : Commit**

```bash
git add netlify/functions/download.mjs
git commit -m "feat(delivery): resolve downloads from template versions with legacy fallback"
```

---

## Task 11 : Révoquer sur remboursement et litige

**Files:**
- Modify: `netlify/functions/stripe-webhook.mjs`

- [ ] **Step 1 : Traiter les deux événements**

Dans `netlify/functions/stripe-webhook.mjs`, juste avant le `return Response.json({ received: true });` final, insérer :

```js
  // Remboursement ou litige : la licence est révoquée. Le thème WooCommerce le
  // constatera à sa prochaine revalidation (phase 3).
  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    const charge = event.data.object;
    const paymentIntent = charge.payment_intent || charge.charge;
    if (sb && paymentIntent) {
      const { data: sales } = await sb
        .from('hb_sales')
        .select('id')
        .eq('raw->>payment_intent', paymentIntent);
      for (const sale of sales ?? []) {
        try { await revokeLicensesForSale(sb, sale.id, event.type); } catch { /* journalisé par Netlify */ }
      }
    }
  }
```

- [ ] **Step 2 : Déclarer les événements dans Stripe**

Dans le tableau de bord Stripe → Developers → Webhooks → votre endpoint → **Update details**, cocher `charge.refunded` et `charge.dispute.created` en plus de `checkout.session.completed`.

- [ ] **Step 3 : Vérifier**

Rembourser le paiement test depuis le tableau de bord Stripe, puis :

```sql
select key, status from hb_licenses order by created_at desc limit 1;
select event, detail from hb_license_events order by created_at desc limit 1;
```

Attendu : `status` = `revoked`, et un événement `revoke` portant `{"reason": "charge.refunded", ...}`.

- [ ] **Step 4 : Commit**

```bash
git add netlify/functions/stripe-webhook.mjs
git commit -m "feat(license): revoke on refund and dispute"
```

---

## Task 12 : Liste des licences dans l'admin

**Files:**
- Create: `src/pages/admin/licenses/index.astro`
- Modify: `src/layouts/Admin.astro`

- [ ] **Step 1 : Ajouter l'entrée de navigation**

Dans `src/layouts/Admin.astro`, dans le groupe `Gestion`, insérer après l'entrée `sales` :

```js
      { key: 'licenses', label: 'Licences', href: '/admin/licenses', icon: 'M15 7a4 4 0 11-8 0 4 4 0 018 0zM11 11v10l3-2 3 2V11' },
```

- [ ] **Step 2 : Créer la page**

Créer `src/pages/admin/licenses/index.astro` :

```astro
---
export const prerender = false;
import Admin from '../../../layouts/Admin.astro';

const supabase = Astro.locals.supabase!;
const email = Astro.locals.user?.email ?? '';

const q = (Astro.url.searchParams.get('q') ?? '').trim();
const status = Astro.url.searchParams.get('status') ?? 'all';

let query = supabase
  .from('hb_licenses')
  .select('id, key, tier, seats, email, status, updates_until, created_at, hb_templates(title, slug)')
  .order('created_at', { ascending: false })
  .limit(500);

if (status !== 'all') query = query.eq('status', status);
if (q) query = query.or(`key.ilike.%${q}%,email.ilike.%${q}%`);

const { data: licenses } = await query;

const now = Date.now();
const rows = (licenses ?? []).map((l: any) => ({
  ...l,
  templateTitle: l.hb_templates?.title ?? '—',
  updatesActive: new Date(l.updates_until).getTime() > now,
}));

const total = rows.length;
const revoked = rows.filter((r) => r.status === 'revoked').length;
const lapsed = rows.filter((r) => r.status === 'active' && !r.updatesActive).length;

const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const statuses = [['all', 'Toutes'], ['active', 'Actives'], ['revoked', 'Révoquées']] as const;
---
<Admin title="Licences" active="licenses" email={email}>
  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1">
      {statuses.map(([s, lbl]) => (
        <a href={`/admin/licenses?status=${s}`} class:list={['rounded-full px-3.5 py-1.5 text-sm font-medium transition', s === status ? 'bg-ink text-paper' : 'text-muted hover:text-ink']}>{lbl}</a>
      ))}
    </div>
    <form method="GET" class="flex items-center gap-2">
      <input type="hidden" name="status" value={status} />
      <input name="q" value={q} placeholder="Clé ou e-mail…" class="rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-accent" />
      <button class="rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:bg-surface-2">Rechercher</button>
    </form>
  </div>

  <div class="mb-6 grid gap-4 sm:grid-cols-3">
    <div class="rounded-2xl border border-line bg-surface p-5"><p class="text-sm text-muted">Licences</p><p class="mt-1 font-display text-3xl font-bold">{total}</p></div>
    <div class="rounded-2xl border border-line bg-surface p-5"><p class="text-sm text-muted">Mises à jour échues</p><p class="mt-1 font-display text-3xl font-bold">{lapsed}</p></div>
    <div class="rounded-2xl border border-line bg-surface p-5"><p class="text-sm text-muted">Révoquées</p><p class="mt-1 font-display text-3xl font-bold">{revoked}</p></div>
  </div>

  <div class="overflow-hidden rounded-2xl border border-line bg-surface">
    <table class="w-full text-sm">
      <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
        <tr>
          <th class="px-5 py-3 font-medium">Clé</th>
          <th class="px-5 py-3 font-medium">Template</th>
          <th class="px-5 py-3 font-medium">Niveau</th>
          <th class="px-5 py-3 font-medium">Client</th>
          <th class="px-5 py-3 font-medium">Mises à jour</th>
          <th class="px-5 py-3 font-medium">Statut</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        {rows.map((l) => (
          <tr class="cursor-pointer hover:bg-surface-2/50" onclick={`location.href='/admin/licenses/${l.id}'`}>
            <td class="px-5 py-3 font-mono text-xs font-medium">{l.key}</td>
            <td class="px-5 py-3">{l.templateTitle}</td>
            <td class="px-5 py-3 text-muted">{l.tier === 'extended' ? `Extended · ${l.seats} sites` : 'Single · 1 site'}</td>
            <td class="px-5 py-3 text-muted">{l.email}</td>
            <td class="px-5 py-3">
              <span class:list={['rounded-full px-2.5 py-1 text-xs font-medium', l.updatesActive ? 'bg-[#e6f4ea] text-[#1e7d34]' : 'bg-surface-2 text-muted']}>
                {l.updatesActive ? `jusqu'au ${fmtDate(l.updates_until)}` : `échues le ${fmtDate(l.updates_until)}`}
              </span>
            </td>
            <td class="px-5 py-3">
              <span class:list={['rounded-full px-2.5 py-1 text-xs font-medium', l.status === 'active' ? 'bg-accent-soft text-accent' : 'bg-[#fbeaea] text-[#b3261e]']}>{l.status}</span>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colspan="6" class="px-5 py-12 text-center text-muted">
            Aucune licence.<br />
            <span class="text-xs">Elles apparaîtront ici automatiquement à chaque vente encaissée.</span>
          </td></tr>
        )}
      </tbody>
    </table>
  </div>
</Admin>
```

- [ ] **Step 3 : Vérifier**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run dev
```

Ouvrir `http://localhost:4321/admin/licenses`.

Attendu : la licence créée en Task 8 apparaît, avec sa clé, son template, son niveau et un badge vert « jusqu'au … ». Les filtres et la recherche par clé ou e-mail fonctionnent.

- [ ] **Step 4 : Commit**

```bash
git add src/pages/admin/licenses/index.astro src/layouts/Admin.astro
git commit -m "feat(admin): licenses list with status filters and search"
```

---

## Task 13 : Fiche licence et actions d'administration

**Files:**
- Create: `src/pages/admin/licenses/[id].astro`

- [ ] **Step 1 : Créer la page avec ses quatre actions**

Créer `src/pages/admin/licenses/[id].astro` :

```astro
---
export const prerender = false;
import Admin from '../../../layouts/Admin.astro';

const supabase = Astro.locals.supabase!;
const adminEmail = Astro.locals.user?.email ?? '';
const { id } = Astro.params;

let notice = '';

if (Astro.request.method === 'POST') {
  const form = await Astro.request.formData();
  const action = String(form.get('action') ?? '');

  const audit = async (detail: Record<string, unknown>) => {
    await supabase.from('hb_audit_log').insert({ actor: adminEmail, action: `license.${action}`, detail: { license_id: id, ...detail } });
  };

  if (action === 'revoke') {
    await supabase.from('hb_licenses').update({ status: 'revoked' }).eq('id', id);
    await supabase.from('hb_license_events').insert({ license_id: id, event: 'revoke', detail: { by: adminEmail } });
    await audit({});
    notice = 'Licence révoquée.';
  }

  if (action === 'reactivate') {
    await supabase.from('hb_licenses').update({ status: 'active' }).eq('id', id);
    await audit({});
    notice = 'Licence réactivée.';
  }

  if (action === 'extend') {
    const { data: current } = await supabase.from('hb_licenses').select('updates_until').eq('id', id).single();
    // On repart de la date la plus tardive entre aujourd'hui et l'échéance :
    // prolonger une licence échue depuis 3 mois doit donner 12 mois pleins, pas 9.
    const from = new Date(Math.max(Date.now(), new Date(current!.updates_until).getTime()));
    from.setUTCFullYear(from.getUTCFullYear() + 1);
    await supabase.from('hb_licenses').update({ updates_until: from.toISOString() }).eq('id', id);
    await supabase.from('hb_license_events').insert({ license_id: id, event: 'extend', detail: { until: from.toISOString(), by: adminEmail } });
    await audit({ until: from.toISOString() });
    notice = `Mises à jour prolongées jusqu'au ${from.toLocaleDateString('fr-FR')}.`;
  }

  if (action === 'reassign') {
    const newEmail = String(form.get('email') ?? '').trim().toLowerCase();
    if (newEmail) {
      // user_id est remis à null : le nouveau titulaire revendiquera la licence
      // à sa première connexion à l'espace client.
      await supabase.from('hb_licenses').update({ email: newEmail, user_id: null }).eq('id', id);
      await supabase.from('hb_license_events').insert({ license_id: id, event: 'reassign', detail: { to: newEmail, by: adminEmail } });
      await audit({ to: newEmail });
      notice = `Licence réattribuée à ${newEmail}.`;
    }
  }
}

const { data: license } = await supabase
  .from('hb_licenses')
  .select('*, hb_templates(title, slug, cms)')
  .eq('id', id)
  .maybeSingle();

if (!license) return Astro.redirect('/admin/licenses');

const { data: activations } = await supabase
  .from('hb_activations')
  .select('*')
  .eq('license_id', id)
  .order('activated_at', { ascending: false });

const { data: events } = await supabase
  .from('hb_license_events')
  .select('event, domain, detail, created_at')
  .eq('license_id', id)
  .order('created_at', { ascending: false })
  .limit(20);

const seatsUsed = (activations ?? []).filter((a: any) => !a.deactivated_at && !a.is_dev).length;
const updatesActive = new Date(license.updates_until).getTime() > Date.now();
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const btn = 'rounded-full px-4 py-2 text-sm font-medium transition';
---
<Admin title="Licence" active="licenses" email={adminEmail}>
  <a href="/admin/licenses" class="mb-4 inline-block text-sm text-accent hover:underline">← Toutes les licences</a>

  {notice && <p class="mb-5 rounded-xl bg-[#e6f4ea] px-4 py-3 text-sm text-[#1e7d34]">{notice}</p>}

  <div class="grid gap-6 lg:grid-cols-3">
    <div class="lg:col-span-2 space-y-6">
      <div class="rounded-2xl border border-line bg-surface p-6">
        <p class="text-sm text-muted">Clé de licence</p>
        <p class="mt-1 font-mono text-xl font-semibold tracking-wide">{license.key}</p>
        <dl class="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
          <div><dt class="text-muted">Template</dt><dd class="mt-0.5 font-medium">{license.hb_templates?.title ?? '—'} <span class="text-muted">({license.hb_templates?.cms})</span></dd></div>
          <div><dt class="text-muted">Niveau</dt><dd class="mt-0.5 font-medium">{license.tier === 'extended' ? 'Extended' : 'Single'} — {seatsUsed}/{license.seats} site{license.seats > 1 ? 's' : ''}</dd></div>
          <div><dt class="text-muted">Client</dt><dd class="mt-0.5 font-medium">{license.email}</dd></div>
          <div><dt class="text-muted">Achetée le</dt><dd class="mt-0.5 font-medium">{fmtDate(license.created_at)}</dd></div>
          <div>
            <dt class="text-muted">Mises à jour</dt>
            <dd class:list={['mt-0.5 font-medium', updatesActive ? 'text-[#1e7d34]' : 'text-[#b3261e]']}>
              {updatesActive ? `jusqu'au ${fmtDate(license.updates_until)}` : `échues le ${fmtDate(license.updates_until)}`}
            </dd>
          </div>
          <div><dt class="text-muted">Statut</dt><dd class:list={['mt-0.5 font-medium', license.status === 'active' ? 'text-[#1e7d34]' : 'text-[#b3261e]']}>{license.status}</dd></div>
        </dl>
      </div>

      <div class="overflow-hidden rounded-2xl border border-line bg-surface">
        <p class="border-b border-line px-5 py-3 text-sm font-semibold">Sites activés</p>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-line">
            {(activations ?? []).map((a: any) => (
              <tr>
                <td class="px-5 py-3 font-medium">{a.domain} {a.is_dev && <span class="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-muted">dev</span>}</td>
                <td class="px-5 py-3 text-muted">{a.platform ?? '—'}</td>
                <td class="px-5 py-3 text-muted">{a.last_seen_at ? `vu le ${fmtDate(a.last_seen_at)}` : 'jamais vu'}</td>
                <td class="px-5 py-3 text-right">
                  <span class:list={['rounded-full px-2.5 py-1 text-xs font-medium', a.deactivated_at ? 'bg-surface-2 text-muted' : 'bg-[#e6f4ea] text-[#1e7d34]']}>{a.deactivated_at ? 'libéré' : 'actif'}</span>
                </td>
              </tr>
            ))}
            {(!activations || activations.length === 0) && (
              <tr><td colspan="4" class="px-5 py-10 text-center text-muted">
                Aucun site activé.<br />
                <span class="text-xs">L'activation arrive en phase 3 ; les templates Shopify ne s'activent jamais automatiquement.</span>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div class="overflow-hidden rounded-2xl border border-line bg-surface">
        <p class="border-b border-line px-5 py-3 text-sm font-semibold">Journal technique</p>
        <ul class="divide-y divide-line">
          {(events ?? []).map((e: any) => (
            <li class="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span class="rounded bg-surface-2 px-2 py-0.5 text-xs font-medium">{e.event}</span>
              <span class="text-muted">{e.domain ?? ''}</span>
              <span class="ml-auto text-xs text-muted">{fmtDate(e.created_at)}</span>
            </li>
          ))}
          {(!events || events.length === 0) && <li class="px-5 py-8 text-center text-sm text-muted">Aucun événement.</li>}
        </ul>
      </div>
    </div>

    <aside class="space-y-3">
      <div class="rounded-2xl border border-line bg-surface p-5">
        <p class="mb-4 text-sm font-semibold">Actions</p>

        <form method="POST" class="mb-3">
          <input type="hidden" name="action" value="extend" />
          <button class:list={[btn, 'w-full bg-ink text-paper hover:bg-accent']}>Prolonger de 12 mois</button>
        </form>

        {license.status === 'active' ? (
          <form method="POST" class="mb-3" onsubmit="return confirm('Révoquer cette licence ? Le site du client sera désactivé à sa prochaine revalidation.')">
            <input type="hidden" name="action" value="revoke" />
            <button class:list={[btn, 'w-full border border-[#b3261e] text-[#b3261e] hover:bg-[#fbeaea]']}>Révoquer</button>
          </form>
        ) : (
          <form method="POST" class="mb-3">
            <input type="hidden" name="action" value="reactivate" />
            <button class:list={[btn, 'w-full border border-line hover:bg-surface-2']}>Réactiver</button>
          </form>
        )}

        <form method="POST" class="border-t border-line pt-4">
          <input type="hidden" name="action" value="reassign" />
          <label class="block text-xs font-medium text-muted">Réattribuer à un autre e-mail</label>
          <input name="email" type="email" required placeholder="client@exemple.com" class="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent" />
          <button class:list={[btn, 'mt-2 w-full border border-line hover:bg-surface-2']}>Réattribuer</button>
        </form>
      </div>
    </aside>
  </div>
</Admin>
```

- [ ] **Step 2 : Vérifier chaque action**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm run dev
```

Ouvrir la fiche de la licence créée en Task 8, puis vérifier une à une :

| Action | Attendu |
|---|---|
| Prolonger de 12 mois | la date de fin recule d'un an, un événement `extend` apparaît au journal |
| Révoquer | statut `revoked`, bouton remplacé par « Réactiver », événement `revoke` |
| Réactiver | statut `active` |
| Réattribuer | l'e-mail change, événement `reassign` |

Puis vérifier la traçabilité :

```sql
select actor, action, detail, created_at from hb_audit_log order by created_at desc limit 5;
```

Attendu : une ligne par action, avec votre e-mail d'admin dans `actor`.

- [ ] **Step 3 : Vérifier la prolongation d'une licence échue**

```sql
update hb_licenses set updates_until = now() - interval '3 months' where id = '<ID>';
```

Recharger la fiche, cliquer « Prolonger de 12 mois ».

Attendu : la nouvelle échéance est à **12 mois de la date du jour**, et non à 9 mois. Une prolongation calculée depuis une échéance passée volerait au client les mois écoulés.

- [ ] **Step 4 : Lancer la suite de tests complète**

```bash
export PATH="/opt/homebrew/bin:$PATH"
npm test && npm run build
```

Attendu : 24 tests passés, build sans erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/pages/admin/licenses/\[id\].astro
git commit -m "feat(admin): license detail with revoke, extend and reassign actions"
```

---

## Vérification de fin de phase

- [ ] `npm test` — 24 tests verts
- [ ] `npm run build` — aucune erreur
- [ ] Un achat test Stripe crée exactement une licence, même après rejeu du webhook
- [ ] L'e-mail reçu contient la clé, le nombre de sites et la date de fin des mises à jour
- [ ] Un remboursement Stripe passe la licence en `revoked`
- [ ] Les quatre actions d'administration fonctionnent et sont tracées dans `hb_audit_log`
- [ ] Un template sans `extended_price` n'affiche que le bouton Single

**Ce que la phase 1 ne fait pas encore**, et c'est normal : `/account` renvoie une 404 (phase 2), aucun thème ne s'active (phase 3), et `hb_template_versions` n'est alimentée qu'à la main en SQL (phase 4).

---

## Suites

- **Phase 2 — Espace client :** `/account`, revendication par e-mail, téléchargements versionnés, libération de siège
- **Phase 3 — Activation :** `activate` / `validate` / `deactivate`, fonction Postgres d'allocation atomique, client PHP WordPress
- **Phase 4 — Mises à jour :** `/api/theme-update` et l'écran admin de publication des versions
