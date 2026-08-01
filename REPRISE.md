# Reprise du travail — système de licences

**Dernière session : 2026-07-31.** Branche `feat/licenses-phase-1`, poussée sur
`github.com/nlmedia/hbstudio-co`. `main` est resté à `8c19cff`, rien n'a été fusionné.

Ce fichier existe pour reprendre sur une autre machine sans rien redécouvrir.
Lire d'abord les deux premières sections : elles contiennent ce qui bloque.

---

## 1. À FAIRE EN PREMIER sur une nouvelle machine

### a) Sortir `node_modules` d'iCloud — sinon rien ne compile

C'est ce qui a fait perdre le plus de temps. Symptôme : `astro dev` et `npm run build`
se figent **sans aucun message**, parfois plus de sept minutes, avant même que Vite
ne démarre.

Cause : avec « Optimiser le stockage du Mac », iCloud vide le contenu des fichiers
**en place**. Ils existent, mais leur lecture déclenche un téléchargement — mesuré à
**1,2 seconde par fichier**. esbuild en lit des milliers en parallèle avec un délai
maximal, et abandonne (`operation timed out`).

⚠️ **Piège de diagnostic** : chercher des fichiers `*.icloud` renvoie **0** et fait
conclure à tort que tout est disponible. C'est l'ancien format de marqueur, macOS ne
l'utilise plus. Le bon test :

```bash
find node_modules -flags +dataless | wc -l     # 26159 au moment d'écrire ces lignes
```

Correctif (node_modules est jetable et déjà dans `.gitignore`) :

```bash
mkdir -p ~/.local/share/hbstudio-co/node_modules
rm -rf node_modules
ln -s ~/.local/share/hbstudio-co/node_modules node_modules
export PATH="/opt/homebrew/bin:$PATH"
npm install
find -L node_modules -flags +dataless | wc -l   # doit afficher 0
```

Build passé de « bloqué > 7 min » à **4 secondes**.

⚠️ Un `npm install` lancé sans précaution peut **remplacer le lien par un vrai dossier**
et ramener le problème. C'est arrivé en fin de session. Revérifier avec
`test -L node_modules && echo lien || echo dossier`.

⚠️ Le lien pointe vers un chemin **local à chaque machine**. Sur l'autre Mac, il faudra
le recréer, pas le récupérer d'iCloud.

### b) Le `node` du PATH est en v16 et casse Vite/vitest

```bash
export PATH="/opt/homebrew/bin:$PATH"
node -v    # doit afficher v25.x, jamais v16.x
```

À faire dans **chaque** shell.

### c) Pour tester les routes `/api/*` en local

```bash
set -a; . ./.env; set +a
npm run dev
```

`astro dev` charge `.env` dans `import.meta.env`, **pas dans `process.env`** — or les
fonctions Netlify lisent `process.env`. Sans cet export, **toutes** les routes `/api/*`
répondent `503 not_configured` quelle que soit la requête, ce qui fait diagnostiquer à
tort un problème de clés Stripe. En production, Netlify fournit de vraies variables
d'environnement : le piège est purement local.

---

## 2. CE QUI RESTE À FAIRE

### ✅ Migrations appliquées le 2026-08-01

Les trois migrations en attente ont été appliquées sur le projet `hbstudio` et vérifiées :

| Migration | Vérification |
|---|---|
| `20260731_admin_journal_policies.sql` | `pg_policies` renvoie bien `INSERT` **et** `SELECT` sur `hb_audit_log` et `hb_license_events` |
| `20260731_license_event_reinstate.sql` | un insert avec `event = 'reinstate'` est désormais **accepté** (il était refusé, code `23514`) |
| `20260801_template_translations.sql` | les six colonnes `_fr` existent sur `hb_templates` |

Le détail de ce que corrigeait chacune est conservé ci-dessous, parce qu'il explique
*pourquoi* elles existent — utile le jour où il faudra rejouer la base à neuf.

<details>
<summary>Détail historique des trois migrations</summary>

**Politiques d'écriture sur les journaux.**
`supabase/migrations/20260731_admin_journal_policies.sql`

Le problème qu'elle corrigeait : `hb_audit_log` et `hb_license_events` n'avaient qu'une
politique de **lecture**. En développement, le contournement de `src/middleware.ts` utilise
la clé service-role qui ignore RLS — donc **tous les tests passaient**. En production, un
admin authentifié aurait vu ses licences modifiées mais **les deux journaux seraient
restés vides**, sans erreur visible. C'est le meilleur exemple de ce que le contournement
de développement masque.

Pour la rejouer sur une base neuve : Supabase → SQL Editor → coller le fichier → Run.
Vérification :

```sql
select tablename, policyname, cmd from pg_policies
where schemaname='public' and tablename in ('hb_audit_log','hb_license_events');
```

Attendu : une politique `SELECT` **et** une politique `INSERT` sur chacune.

**Valeur `reinstate` du journal.**

`supabase/migrations/20260731_license_event_reinstate.sql` élargit la contrainte `check` de `hb_license_events.event` à une septième valeur,
`reinstate`, écrite quand un litige gagné (`charge.dispute.closed` / `status = 'won'`)
rend au client la licence que l'ouverture du litige avait révoquée — et aussi quand un
admin réactive une licence à la main depuis `/admin/licenses/[id]`.

Vérifié contre la base réelle le 31/07 : un insert avec `event = 'reinstate'` est
aujourd'hui **refusé**, code `23514`, contrainte `hb_license_events_event_check`.

Ce que ça coûte tant que ce n'est pas appliqué : la réactivation elle-même fonctionne
(la licence repasse bien à `active`, le client récupère son accès), seul l'insert de
l'événement échoue — il est journalisé par `logError`, pas fatal. Autrement dit le
journal reste muet précisément sur l'opération la plus délicate à expliquer après coup.

Appliquer : Supabase → SQL Editor → coller le fichier → Run. Puis vérifier :

```sql
select pg_get_constraintdef(oid) from pg_constraint
where conname = 'hb_license_events_event_check';
```

Attendu : la liste des valeurs contient `reinstate`.

</details>

### 🔴 Vérifier la phase 1 en conditions réelles

**Aucun test de la session ne couvre le chemin d'un vrai admin authentifié.** Tout a été
vérifié avec la clé service-role, qui contourne RLS. Le défaut ci-dessus en est la preuve
directe : il est passé au vert partout.

À faire : se connecter à `/admin` par lien magique (pas le contournement de développement),
exécuter les quatre actions d'une fiche licence, et vérifier que `hb_audit_log` et
`hb_license_events` reçoivent bien leurs lignes.

À vérifier aussi : les autres écrans d'administration écrivaient-ils réellement dans
`hb_audit_log` avant cette correction ? Probablement pas.

### 🟠 Relecture globale de la branche

Les treize tâches ont été relues **une par une**. Une relecture d'ensemble reste à faire :
c'est ce qui révèle les défauts d'échelle, comme celui des politiques RLS.

### 🟠 Sauvegarder `Claude projet/Shopify`

Ce dépôt **n'a aucun remote** et contient **Harmony Sound**, thème complet prêt à vendre.
Il existe en un seul exemplaire, sur iCloud. Après avoir perdu un projet Supabase entier
cette semaine, c'est le risque le plus concret du moment.

Bloqué sur : `gh` n'est pas authentifié (`gh auth login`), ou fournir l'URL d'un dépôt vide.

### 🟠 Les images de démo de Harmony Sound

Les 27 images embarquées dans `harmony-sound-v1.0.0.zip` sont préfixées `ct-` et **23 de
leurs 25 tailles distinctes correspondent à des images aspirées de la boutique de démo du
thème commercial *Concept*** (miroir dans `Shopify/themes/03-concept/site/images`, 8302
fichiers). La comparaison porte sur les tailles seulement — les fichiers sont dataless,
leur contenu n'a pas pu être comparé.

Le **code** du thème est bien original : 132 fichiers Liquid, aucun fichier compilé de
Concept, et `concept-premium.js` porte un en-tête « No third-party theme code ».

Mais `03-concept/LISTING.md` précise lui-même : *« Demo imagery is for preview only and is
not licensed for resale »* — or ces images sont dans le paquet vendu. **À trancher avant
la première vente.**

### 🟢 Points mineurs mis de côté

- **Réactiver la licence quand un litige est gagné** : `charge.dispute.created` révoque,
  mais `charge.dispute.closed` n'est pas traité. Si le litige est gagné, le paiement est
  acquis et la licence reste révoquée à vie.
- **Remboursement partiel** : traité (`isFullRefund`), mais seulement journalisé — vérifier
  que c'est le comportement voulu.
- `tools/upload-deliverable.mjs` contient un commentaire obsolète décrivant un stockage
  Netlify Blobs abandonné.
- Le contrôle de licence au téléchargement **laisse passer** si Supabase est injoignable
  (choix assumé et commenté : une panne ne doit pas priver un client qui a payé). Inverser
  si ce n'est pas le compromis souhaité.

---

## 3. LA BASE SUPABASE A ÉTÉ RECRÉÉE

L'ancien projet (`gxriwguqeypzcwppqcmr`) **n'existe plus** — DNS `NXDOMAIN`. Toutes les
données sont perdues : réglages Stripe et Brevo, abonnés, ventes, second template.

**Nouveau projet** : `hbstudio`, organisation **HB**, région `eu-west-1`,
référence `ujrugwxfvavjlcgsokxn`.

⚠️ Le compte possède **trois organisations** — Attirance Auto Prepa, Garantie, HB. Le
connecteur Supabase de Claude n'est autorisé que sur la première, il **ne voit donc pas ce
projet**. C'est normal, ce n'est pas une panne.

Rétabli : les 11 tables, RLS armée sur toutes, 15 politiques, l'admin
`multinlmedia@gmail.com`, le bucket privé `deliverables`, et le template **Atelier**
restauré depuis `supabase/seed.sql`.

**Reste à ressaisir** : clés Stripe et Brevo dans `/admin/réglages`, le second template
(**Harmony Sound**, voir `Shopify/themes/03-concept/LISTING.md` pour sa fiche de vente),
et les fichiers livrables à téléverser dans le bucket.

⚠️ **Les variables d'environnement Netlify pointent encore vers l'ancien projet mort.**
Tant qu'elles ne sont pas mises à jour (Netlify → Site configuration → Environment
variables), le site en ligne restera cassé même une fois le local réparé.

⚠️ Les fichiers SQL ont été rendus **100 % ASCII** volontairement. Le collage dans
l'éditeur Supabase corrompt l'UTF-8 : le symbole `€` du défaut de `hb_templates.currency`
avait failli être écrit corrompu dans chaque template. Il passe désormais par un
échappement Unicode Postgres (`U&'\20AC'`). **Ne pas réintroduire de caractères accentués
ou typographiques dans ces fichiers.**

---

## 4. CE QUI A ÉTÉ CONSTRUIT

Spécification : `docs/superpowers/specs/2026-07-31-licences-espace-client-design.md`
Plan : `docs/superpowers/plans/2026-07-31-licences-phase-1-fondations.md`

**Modèle vendu** : licence **par template**, deux niveaux — Single (1 site) et Extended
(5 sites), avec **12 mois de mises à jour** incluses.

⚠️ **Une licence n'expire jamais pour l'usage.** Le client garde à vie le droit d'utiliser
le template acheté ; seul le droit aux mises à jour expire. C'est pourquoi le statut ne
connaît que `active` et `revoked`, **jamais `expired`**. Ne jamais présenter une licence
aux mises à jour échues comme invalide.

**WooCommerce** permet un vrai verrou (le thème PHP appelle l'API). **Shopify ne le permet
pas** : le Liquid n'émet aucun appel réseau et un contrôle JavaScript se supprime en trois
clics. Sur Shopify, la licence vaut preuve d'achat et droit aux mises à jour, rien de plus.

### Les treize tâches, toutes livrées et relues

| | Contenu | Fichiers |
|---|---|---|
| T1-T2 | génération de clé, sièges par niveau, règles de droits | `src/lib/license.mjs` (+27 tests) |
| T3 | schéma : 4 tables, RLS, index | `supabase/migrations/20260731_licenses.sql` |
| T4 | champs template dans l'admin | `templateForm.ts`, `TemplateForm.astro` |
| T5-T6 | tarification par niveau, refonte du checkout | `_pricing.mjs` (+16 tests), `create-checkout.mjs` |
| T7 | sélecteur Single/Extended | `templates/[id].astro`, `Base.astro`, `catalog.ts` |
| T8-T9 | licence à l'encaissement, e-mail enrichi | `_licensing.mjs`, `stripe-webhook.mjs` |
| T10-T11 | téléchargement versionné, révocation effective | `download.mjs` |
| T12-T13 | liste et fiche des licences | `src/pages/admin/licenses/` |

43 tests verts. `npm test` et `npm run build` doivent rester à `EXIT=0`.

⚠️ **Ne jamais piper `npm run build` dans `tail`** : le code de sortie est masqué et un
échec passe pour un succès. Cette erreur a caché la vraie cause du blocage pendant une
heure.

### Défauts réels trouvés par les revues, tous prouvés à l'exécution

Ils sont corrigés, mais ils décrivent les pièges de ce code — utile avant d'y toucher.

1. Boucle infinie dans la génération de clé si la source d'aléa est cassée : elle est
   **synchrone**, donc elle fige vitest lui-même, dont le timeout ne peut pas l'interrompre.
2. `vitest.config.ts` ignorait les tests `.mjs` alors que tout `netlify/functions/` est en
   `.mjs` — des fichiers entiers auraient pu ne jamais s'exécuter, **suite au vert**.
3. `canDownloadVersion` accordait l'accès sur une date nulle : `new Date(null)` vaut **1970**,
   pas `Invalid Date`.
4. `seatsForTier('constructor')` ne levait pas d'erreur — chaîne de prototypes, atteignable
   depuis un corps de requête POST non authentifié. Corrigé par `Object.hasOwn`.
5. Une politique RLS exposait au navigateur le chemin des fichiers du bucket privé. RLS ne
   restreint pas au niveau colonne : **aucune** lecture client n'est tenable sur
   `hb_template_versions`.
6. `hb_license_events` allait stocker les clés de licence **en clair** dans un journal fait
   pour être exporté. Remplacé par une empreinte SHA-256 calculée par l'appelant.
7. Les échecs de création de licence étaient **totalement muets** : le `try/catch` ne capture
   que les exceptions levées, or le code faisait `return null`.
8. La licence était datée du **traitement du webhook**, pas du paiement. Stripe réessaie
   pendant trois jours : le client gagnait des droits gratuits.
9. Injection HTML dans l'e-mail post-achat — un titre de template contenant `&` ou `<`
   suffisait à casser le message.
10. Un **remboursement partiel** révoquait la licence entière.
11. Les deux journaux d'audit n'avaient aucune politique d'écriture (voir §2).

---

## 5. ÉTAT DE LA BRANCHE

Dernier commit : `b04e3af`. Tout est poussé sur
`github.com/nlmedia/hbstudio-co`, branche `feat/licenses-phase-1`.

`.env` est **gitignoré** : il ne suit pas par Git, mais il suit par **iCloud** puisqu'il est
dans le dossier du projet. Il contient déjà les clés du nouveau projet Supabase.

**Suite prévue** — chaque phase a besoin de sa propre spec et de son propre plan :

- **Phase 2** — espace client `/account` : revendication par e-mail via lien magique,
  téléchargements versionnés, libération de siège. La RPC `security definer` qui expose les
  métadonnées de version **sans** la colonne `package` appartient à cette phase.
- **Phase 3** — API d'activation, allocation atomique des sièges en Postgres, client PHP
  WordPress.
- **Phase 4** — serveur de mises à jour WordPress et publication des versions.
