# Supabase setup — HB Studio Co admin

The admin's database lives in Supabase. This folder is the **portable backup**
so it can be recreated on any Supabase account/project.

## Re-create on a new Supabase project
1. Create (or pick) a Supabase project.
2. **SQL Editor** → paste `schema.sql` → **Run** (tables, RLS, functions).
3. **SQL Editor** → paste `seed.sql` → **Run** (admin allowlist + Atelier template).
4. **Authentication → URL Configuration**
   - Site URL: `https://hbstudio-co.netlify.app`
   - Redirect URLs: add `https://hbstudio-co.netlify.app/**`
5. **Project Settings → API** → copy the **Project URL** and the **publishable/anon key**.
6. Update Netlify env vars on the `hbstudio-co` site:
   - `PUBLIC_SUPABASE_URL` = your new project URL
   - `PUBLIC_SUPABASE_ANON_KEY` = your new publishable/anon key
   - also update the local `.env`, then redeploy.

## Admin access
Login is passwordless (magic link). Only emails listed in `hb_admins` can reach
the admin. Default: `multinlmedia@gmail.com` — change it in `seed.sql` / the table.

## Files
- `schema.sql` — all `hb_*` tables, RLS policies, `hb_is_admin()` helper.
- `seed.sql` — admin allowlist + the Atelier template row.
