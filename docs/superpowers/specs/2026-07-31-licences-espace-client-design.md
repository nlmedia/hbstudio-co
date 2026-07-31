# Licences d'activation & espace client — conception

**Date :** 2026-07-31
**Projet :** HB Studio Co (`hbstudio-co`)
**Statut :** validé, prêt pour le plan d'implémentation

---

## 1. Objectif

Vendre des templates avec **licence d'activation**, sur le modèle ThemeForest : chaque
achat génère une clé, la clé autorise un nombre de sites, et les mises à jour sont
comprises pendant 12 mois. Les clients disposent d'un espace personnel où retrouver
leurs licences, leurs téléchargements et leurs sites activés. L'administration permet
de gérer licences et versions.

Deux plateformes sont vendues, avec deux niveaux d'application :

| Plateforme | Verrou technique | Ce que fait la licence |
|---|---|---|
| **WooCommerce** (PHP) | oui — le thème appelle l'API | active un domaine, se désactive si révoquée, reçoit les mises à jour |
| **Shopify** (Liquid) | non — impossible | preuve d'achat, droit aux mises à jour et au support, déclaration de boutique |

**Pourquoi pas de verrou sur Shopify.** Un thème Shopify est du Liquid + JS déposé dans
la boutique du marchand. Le Liquid ne peut pas émettre d'appel réseau sortant, et un
contrôle en JavaScript se supprime en trois clics depuis l'éditeur de code du thème.
Shopify interdit par ailleurs qu'un thème rende la boutique inutilisable si un service
externe ne répond pas. La protection réelle sur Shopify porte donc sur la **distribution
du ZIP**, pas sur l'exécution du thème. Le modèle de données reste identique pour les
deux plateformes ; seule l'application diffère.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Modèle de vente | licence **par template**, deux niveaux : Single (1 site) / Extended (5 sites) |
| Prix Extended | colonne `extended_price` par template, libre — pas de multiplicateur global |
| Mises à jour | **12 mois**, puis expiration sèche ; prolongation manuelle depuis l'admin |
| Renouvellement payant | **hors périmètre v1** (voir §12) |
| Comptes clients | revendication par e-mail, lien magique Supabase — aucun compte créé à l'achat |
| Réattribution d'e-mail | **incluse en v1** (faute de frappe à l'encaissement) |
| Niveau de verrou Woo | **niveau 3** : activation + revalidation + serveur de mises à jour WordPress |
| Domaines de développement | gratuits, ne consomment pas de siège |
| Libération de siège | self-service depuis l'espace client |
| Téléchargement après expiration | versions **sorties pendant la période de droits** uniquement |
| Client PHP | développé dans ce dépôt, sous `clients/wordpress/hb-license-client/` |
| Tests | vitest, sur la logique pure uniquement (§11) |

## 3. Hors périmètre

Explicitement exclus de cette spec, pour éviter toute ambiguïté :

- **Renouvellement payant en self-service.** Aucune licence ne peut expirer avant
  12 mois ; construire ce flux maintenant, c'est écrire du code qui ne s'exécutera pas
  avant un an. Le champ `updates_until` et l'action admin « prolonger de 12 mois » sont
  prévus dès la v1 pour que l'ajout soit purement additif.
- **L'offre All-Access.** Le catalogue en dur de `create-checkout.mjs` la contient
  aujourd'hui ; le modèle par template la remplace. Elle est supprimée.
- **Toute plateforme autre que Shopify et WooCommerce.** `src/data/cms.ts` liste
  WordPress et `other` avec `available: false` ; ils restent hors sujet.

---

## 4. Modèle de données

Toutes les tables sont préfixées `hb_`, comme l'existant, et protégées par RLS.

### 4.1 `hb_licenses`

Une ligne par achat.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `key` | text unique | format `HB-XXXX-XXXX-XXXX-XXXX` |
| `template_id` | uuid → `hb_templates` | |
| `tier` | text | `single` \| `extended` |
| `seats` | int | **1 ou 5, figé à l'achat** |
| `email` | text | e-mail Stripe, sert à la revendication |
| `user_id` | uuid → `auth.users` | nul jusqu'à la première connexion |
| `status` | text | `active` \| `revoked` |
| `sale_id` | text → `hb_sales` | |
| `updates_until` | timestamptz | achat + 12 mois |
| `created_at` / `updated_at` | timestamptz | |

**`seats` est figé à l'achat.** Si l'offre Extended passe un jour de 5 à 10 sites, les
licences déjà vendues conservent les droits vendus. Lire le nombre de sièges depuis le
niveau au moment de la validation ferait varier rétroactivement ce que le client a payé.

**Il n'existe pas de statut `expired`.** Une licence n'expire jamais pour l'*usage* : le
template acheté reste utilisable à vie. Seul le droit aux mises à jour expire, et c'est
`updates_until > now()` qui en décide. Confondre les deux conduit à désactiver le site
d'un client qui a simplement laissé filer son renouvellement — c'est le défaut le plus
courant de ce type de système, et le plus coûteux en réputation.

### 4.2 `hb_activations`

Une ligne par site, active ou passée.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `license_id` | uuid → `hb_licenses` on delete cascade | |
| `domain` | text | **normalisé** (§4.6) |
| `platform` | text | `woocommerce` \| `shopify` |
| `site_name` | text | titre du site, pour l'affichage |
| `is_dev` | boolean | un domaine de dev ne consomme pas de siège |
| `activated_at` | timestamptz | |
| `deactivated_at` | timestamptz | nul = actif |
| `last_seen_at` | timestamptz | mis à jour à chaque revalidation |

**Sièges consommés** = activations où `deactivated_at is null` **et** `is_dev = false`.

Pas de contrainte unique partielle sur `(license_id, domain)`. La réactivation d'un
domaine précédemment libéré est gérée explicitement par la fonction d'activation
(§5.2), par `select` puis `insert` ou `update`. Un index unique partiel combiné à un
`upsert` est un piège connu : `ON CONFLICT` doit alors répliquer exactement la clause
`WHERE` de l'index, et la moindre divergence produit une erreur à l'exécution seulement.
Un index **non unique** sur `(license_id, domain)` est créé pour la performance.

### 4.3 `hb_template_versions`

Alimente le serveur de mises à jour et l'historique de téléchargement.

`id` · `template_id` → `hb_templates` on delete cascade · `version` (semver) ·
`package` (chemin dans le bucket privé `deliverables`) · `changelog` ·
`released_at` · unique `(template_id, version)`.

### 4.4 `hb_license_events`

Journal d'audit technique : `license_id` · `event` (`activate` \| `deactivate` \|
`validate` \| `revoke` \| `reassign` \| `extend`) · `domain` · `ip` · `user_agent` ·
`detail` jsonb · `created_at`.

Sert à trois choses : diagnostiquer un client qui dit « ça ne marche plus », détecter un
partage de clé (une clé, quinze domaines, six pays), et alimenter la limitation de débit
(§10.2). Distinct de `hb_audit_log`, qui trace les actions **humaines** de l'admin.

### 4.5 Colonnes ajoutées à `hb_templates`

- `extended_price` numeric — prix du niveau Extended, libre par template
- `theme_slug` text — nom du dossier du thème WordPress. **Indispensable** : WordPress
  identifie un thème par le nom de son répertoire, et sans correspondance exacte la
  mise à jour ne s'affiche jamais dans l'admin du client.
- `requires_wp` text, `requires_php` text — affichés par WordPress dans l'écran de mise
  à jour.

La colonne `deliverable` existante est **conservée comme repli** : la livraison sert la
version la plus récente de `hb_template_versions` et, s'il n'en existe aucune pour ce
template, retombe sur `deliverable`. Cela permet de déployer le nouveau schéma sans
interrompre les ventes des templates dont aucune version n'a encore été publiée.

### 4.6 Normalisation des domaines

Appliquée **avant** toute écriture et toute comparaison :

1. minuscules
2. suppression du schéma (`https://`, `http://`)
3. suppression du `www.` de tête
4. suppression du port et de tout chemin
5. suppression du point final éventuel

`HTTPS://WWW.Example.com:443/wp-admin/` et `example.com` doivent produire la même clé.
Sans cette étape, un client consomme deux sièges pour un seul site — c'est la première
source de tickets sur ce type de système.

**Détection des domaines de développement.** Une liste de motifs stockée dans
`hb_settings` sous la clé `dev_domain_patterns`, modifiable sans redéploiement. Valeurs
par défaut : `localhost`, `127.0.0.1`, `::1`, `*.test`, `*.local`, `*.localhost`,
`*.ddev.site`, `*.lndo.site`, `staging.*`, `dev.*`, `preview.*`.

⚠️ `*.myshopify.com` n'est **pas** un domaine de développement : c'est le domaine
canonique d'une boutique Shopify en production.

### 4.7 RLS

| Table | anon | client authentifié | admin |
|---|---|---|---|
| `hb_licenses` | — | `select` où `user_id = auth.uid()` | tout |
| `hb_activations` | — | `select` + `update` (libération) via la licence possédée | tout |
| `hb_template_versions` | — | `select` des métadonnées des templates publiés | tout |
| `hb_license_events` | — | — | `select` |

L'API de licences utilise la clé service-role et contourne RLS ; elle n'est jamais
exposée au navigateur. Le chemin `package` n'est renvoyé à aucun client, sous aucune
forme (§10.1).

---

## 5. API de licences

Quatre fonctions Netlify, dans `netlify/functions/`, à côté des fonctions existantes.
Ce choix — plutôt que des Edge Functions Supabase ou des RPC PostgREST — tient à ce que
tout le domaine paiement/livraison y vit déjà (`create-checkout`, `stripe-webhook`,
`download`), avec un seul jeu de secrets et un seul déploiement. L'endpoint de mise à
jour doit par ailleurs renvoyer une forme HTTP précise puis rediriger vers un ZIP signé,
ce qui se prête mal à une RPC.

### 5.1 Endpoints

| Endpoint | Appelant | Entrée | Sortie |
|---|---|---|---|
| `POST /api/license/activate` | thème Woo, 1er chargement admin | `key`, `domain`, `platform`, `site_name` | `status`, `seats_used`, `seats_total`, `updates_until`, `is_dev` |
| `POST /api/license/validate` | cron WP, toutes les 48 h | `key`, `domain` | `valid`, `status`, `updates_until` |
| `POST /api/license/deactivate` | thème, ou espace client | `key`, `domain` | `ok` |
| `GET /api/theme-update` | système de MAJ natif WordPress | `slug`, `version`, `key`, `domain` | métadonnées + URL signée, ou `204` si à jour |

### 5.2 Allocation atomique des sièges

`activate` délègue à une fonction Postgres `hb_activate_license(key, domain, platform,
site_name)`, qui prend un `SELECT … FOR UPDATE` sur la ligne de licence avant de compter
les sièges et d'écrire.

Sans ce verrou, deux activations simultanées lisent toutes deux « 4 sièges sur 5
utilisés » et écrivent toutes deux : une licence Extended se retrouve avec 6 sites
actifs. Ce défaut n'apparaît jamais en test manuel et se découvre chez un client.

Logique de la fonction :
1. verrouiller la licence ; si absente ou `revoked` → sortie en échec
2. normaliser le domaine, déterminer `is_dev`
3. si une activation existe pour ce `(license_id, domain)` :
   - active → succès idempotent, `last_seen_at` mis à jour
   - libérée → réactivation, sous réserve de siège disponible
4. sinon, si `is_dev` → insertion sans consommer de siège
5. sinon, compter les sièges consommés ; si `< seats` → insertion ; sinon → échec
   `seat_limit_reached`
6. journaliser dans `hb_license_events`

### 5.3 Règle du hors-ligne

**Le thème ne se désactive que sur une réponse explicite `revoked`.**

Timeout, 500, erreur DNS, quota Netlify dépassé, panne Supabase → le thème conserve son
dernier état connu, avec une **fenêtre de grâce de 14 jours** enregistrée côté WordPress.
Passé ce délai sans aucune réponse, il repasse en « non vérifié » : bandeau d'avertissement
dans l'admin et blocage des mises à jour, mais **jamais** d'altération du site public.

Une panne de l'API ne doit en aucun cas casser les sites des clients. C'est la règle la
plus importante de cette spec.

### 5.4 Droits calculés

| Droit | Condition |
|---|---|
| Utiliser le template | `status = 'active'` |
| Recevoir les mises à jour | `status = 'active'` **et** `updates_until > now()` |
| Télécharger la version V | `status = 'active'` **et** `V.released_at <= updates_until` |

La troisième règle est ce qui donne son sens à la limite de 12 mois : un client dont les
droits sont écoulés conserve l'accès à tout ce à quoi il avait droit, et rien de plus.

---

## 6. Tunnel d'achat

**`create-checkout.mjs`** — le catalogue en dur (`single` 6900, `extended` 14900,
`all-access` 29900) disparaît. L'entrée devient `{ slug, tier }`. Le montant est lu dans
`hb_templates.price` ou `.extended_price`, la promo étant appliquée comme aujourd'hui
(`sale_price` + `sale_ends_at`). Les métadonnées Stripe portent `slug` et `tier`.

Cette refonte corrige une incohérence de l'existant : les deux chemins de vente
coexistaient sans se croiser, et un achat de « Single license » ne permettait pas de
savoir de quel template il s'agissait.

**`stripe-webhook.mjs`** — après l'enregistrement de la vente (inchangé) :
1. génération de la licence (clé, `seats` selon le niveau, `updates_until` = maintenant + 12 mois)
2. e-mail de livraison enrichi : **clé de licence + lien de téléchargement + lien vers l'espace client**
3. nouveaux événements traités : `charge.refunded` et `charge.dispute.created` → `status = 'revoked'`

L'idempotence reste assurée par l'upsert sur l'identifiant de session Stripe ; la
génération de licence vérifie l'absence de licence existante pour ce `sale_id` avant
d'écrire, afin qu'un rejeu de webhook ne produise pas deux clés.

**`download.mjs`** — le mapping en dur `BUNDLES` (`bundles/atelier.zip`) disparaît. Le
fichier servi est la version courante du template, sous réserve de la règle §5.4. Le
lien HMAC signé à durée limitée reste en place pour l'e-mail immédiat ; l'espace client
offre l'accès permanent.

---

## 7. Espace client `/account`

Même mécanique que `/admin` : lien magique Supabase (`signInWithOtp`), garde dans
`src/middleware.ts` étendue à `/account`. Aucun mot de passe.

**Revendication.** À la première connexion, une RPC `hb_claim_licenses()` rattache au
`user_id` toutes les licences dont `lower(email)` correspond à l'e-mail du jeton. Cette
opération est rejouée à chaque connexion, ce qui couvre le cas d'un client qui rachète
plus tard avec le même e-mail.

**Écrans.**

- `/account` — liste des licences : template, niveau, clé copiable, badge « mises à jour
  jusqu'au … » (ou « expirées »), compteur de sièges `2/5`
- `/account/licenses/[id]` — sites activés avec bouton **libérer ce siège**, historique
  des versions téléchargeables selon §5.4, lien vers la documentation
- Pour un template Shopify : formulaire de **déclaration** de boutique
  (`xxx.myshopify.com`), purement informatif

---

## 8. Administration

**`/admin/licenses`** — liste, recherche par clé ou e-mail, filtre par statut et par
template.

**Fiche licence** — activations avec dates et `last_seen_at`, événements récents, et
quatre actions :

| Action | Effet |
|---|---|
| Révoquer | `status = 'revoked'` ; le thème Woo se désactive à la prochaine revalidation |
| Prolonger de 12 mois | `updates_until += 12 mois` |
| Réattribuer à un autre e-mail | corrige une faute de frappe à l'encaissement ; détache le `user_id` pour permettre une nouvelle revendication |
| Renvoyer l'e-mail de livraison | régénère un lien signé |

Toutes ces actions sont tracées dans `hb_audit_log` avec l'e-mail de l'admin.

**`/admin/templates/[slug]/versions`** — téléverser un ZIP dans le bucket privé, saisir
version (semver) et changelog. La publication d'une version rend la mise à jour
disponible pour tous les clients encore couverts.

---

## 9. Client PHP WordPress

Développé dans ce dépôt, sous `clients/wordpress/hb-license-client/`, comme une
bibliothèque autonome copiée dans chaque thème vendu. La versionner et la tester au même
endroit que l'API qu'elle appelle évite la dérive entre les deux.

Responsabilités :
- écran de saisie de clé dans l'admin WordPress, appel à `activate`
- stockage de l'état en option WordPress, avec horodatage de dernière vérification
- tâche planifiée (`wp_schedule_event`, 48 h) appelant `validate`
- application de la fenêtre de grâce de 14 jours (§5.3)
- branchement sur `pre_set_site_transient_update_themes` pour exposer la mise à jour
  dans l'écran natif de WordPress, alimenté par `/api/theme-update`
- appel à `deactivate` à la désactivation du thème

---

## 10. Sécurité et erreurs

### 10.1 Exposition des fichiers

Le chemin `package` dans le bucket privé n'est **jamais** renvoyé au client. Toute
livraison passe par une redirection vers une URL Supabase signée à 120 secondes, comme
le fait déjà `download.mjs`.

### 10.2 Limitation de débit

Comptage sur `hb_license_events` : maximum **10 tentatives d'activation par clé et par
heure**, et **30 par IP et par heure**. Au-delà, réponse `429`. Objectif : couper le
balayage de clés par force brute.

### 10.3 Réponses d'erreur

| Situation | Code | Réponse |
|---|---|---|
| Clé inconnue | 404 | message générique, **sans révéler si la clé existe** |
| Licence révoquée | 200 | `status: 'revoked'` explicite — c'est le seul cas qui désactive le thème |
| Sièges épuisés | 409 | `seats_used`, `seats_total`, renvoi vers `/account` pour libérer un siège |
| Trop de tentatives | 429 | délai avant nouvelle tentative |
| Configuration absente | 503 | comme les fonctions existantes |

### 10.4 Format de clé

`HB-XXXX-XXXX-XXXX-XXXX`, 16 caractères tirés d'un alphabet sans caractères ambigus
(ni `0`/`O`, ni `1`/`I`/`L`), générés par `crypto.randomBytes`. Environ 82 bits
d'entropie.

Clé opaque vérifiée en base, et non clé signée auto-porteuse : une clé signée se vérifie
hors-ligne mais **ne se révoque pas**, ce qui est incompatible avec la gestion des
remboursements.

---

## 11. Tests

Le projet n'a aujourd'hui aucun test : pas de script `test` dans `package.json`, pas de
runner. On ajoute **vitest**, et on teste la logique pure — celle dont un défaut se
manifeste des mois plus tard, chez un client, sur une facture :

1. **Normalisation de domaine** — schéma, `www.`, port, chemin, casse, point final
2. **Détection de domaine de développement** — motifs par défaut, et non-régression sur
   `*.myshopify.com` qui ne doit **pas** être considéré comme du développement
3. **Calcul des droits** (§5.4) — les trois règles, aux bornes de `updates_until`
4. **Allocation de sièges** — dernier siège, siège épuisé, réactivation d'un domaine
   libéré, idempotence d'une double activation du même domaine

L'allocation de sièges est testée contre une branche Supabase, les trois autres briques
en unitaire pur.

Le client PHP est couvert par une **matrice de test manuelle documentée** dans
`clients/wordpress/hb-license-client/TESTING.md` : activation, sièges épuisés, révocation,
API injoignable dans la fenêtre de grâce, API injoignable au-delà, mise à jour disponible,
mise à jour refusée car droits expirés.

⚠️ Outillage : le `node` du PATH est en v16 et casse Vite/vitest. Préfixer par
`export PATH="/opt/homebrew/bin:$PATH"`.

---

## 12. Découpage en phases

| Phase | Contenu | Livrable testable seul |
|---|---|---|
| **1 — Fondations** | **schéma complet** (les cinq tables, `hb_template_versions` comprise) + génération de licence à l'achat + e-mail enrichi + admin licences | une vente produit une licence visible et gérable |
| **2 — Espace client** | `/account`, revendication, téléchargements versionnés, libération de siège | le client se connecte et se sert |
| **3 — Activation** | API `activate`/`validate`/`deactivate` + client PHP | un thème Woo s'active, se révoque, survit à une panne |
| **4 — Mises à jour** | `/api/theme-update` + écran admin de publication des versions | « Mise à jour disponible » apparaît dans l'admin WP |

`hb_template_versions` est créée dès la phase 1, et non en phase 4 : la phase 2 propose
déjà l'historique des versions téléchargeables (§7) et applique la règle de droits §5.4,
qui en dépend. La phase 4 n'ajoute que l'endpoint de mise à jour et l'écran de
publication ; l'alimentation initiale de la table peut se faire en SQL.

Les phases 1 à 3 se tiennent seules : la vente avec licences est opérationnelle sans la
phase 4. La phase 4 est la plus lourde et la plus indépendante — c'est celle à décaler
si le calendrier se tend.

---

## 13. Risques connus

**Le dépôt local est en avance sur `origin/main`** (12 commits au 2026-07-30). Ce travail
s'ajoute par-dessus ; il faudra pousser avant que quoi que ce soit soit visible en
production.

**Le quota Netlify Functions** (125 000 invocations/mois en gratuit) devient un plafond
si le nombre de licences actives croît fortement : chaque site revalide toutes les 48 h,
soit ~15 appels par site et par mois. L'ordre de grandeur laisse une marge très large à
l'échelle actuelle, mais l'intervalle de revalidation est à rendre configurable dans
`hb_settings` pour pouvoir l'ajuster sans redéploiement.

**Le partage de clé sur Shopify est impossible à empêcher.** C'est une propriété de la
plateforme, pas une lacune de cette conception. `hb_license_events` permet de le
constater, l'admin permet de révoquer — c'est le maximum atteignable.
