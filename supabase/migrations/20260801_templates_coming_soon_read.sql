-- Rendre les themes « bientot disponible » visibles du site public.
--
-- LE PROBLEME
-- Tout le site gere deja ce statut : la carte affiche un badge, le bouton
-- devient « Prevenez-moi », la page categorie compte les themes a venir, et la
-- fiche produit masque l'achat. Mais la politique de lecture existante
-- n'exposait que status = 'published' : aucune ligne 'coming-soon' n'atteignait
-- jamais le site, donc tout ce code etait mort. Le defaut est reste invisible
-- tant qu'il n'y avait qu'un seul theme, publie.
--
-- POURQUOI UNE POLITIQUE EN PLUS, ET NON UN REMPLACEMENT
-- La politique d'origine est anterieure a ce dossier de migrations : son nom
-- exact n'est pas connu ici. Les politiques PostgreSQL de meme commande se
-- combinent par OU, donc en ajouter une suffit a elargir la lecture sans
-- toucher a l'existante ni risquer de la supprimer par erreur.
--
-- CE QUI RESTE PROTEGE
-- Les brouillons (status = 'draft') restent invisibles, et l'ecriture reste
-- interdite : cette politique ne porte que sur SELECT.

alter table public.hb_templates enable row level security;

drop policy if exists hb_templates_public_read_coming_soon on public.hb_templates;

create policy hb_templates_public_read_coming_soon
  on public.hb_templates
  for select
  to anon, authenticated
  using (status = 'coming-soon');
