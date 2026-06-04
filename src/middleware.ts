import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer, createSupabaseAdmin } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, locals } = context;

  // Only guard the admin area.
  if (!url.pathname.startsWith('/admin')) return next();
  // Login + auth callback/signout are public within /admin.
  if (url.pathname === '/admin/login' || url.pathname.startsWith('/admin/auth')) return next();

  const supabase = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await supabase.auth.getUser();

  // DEV-ONLY preview bypass (never active in production builds).
  // Use the service-role client when available so writes work locally (RLS
  // requires an authenticated admin, which the preview session is not).
  if (!user && import.meta.env.DEV) {
    locals.user = { email: 'preview@local (dev)' } as any;
    locals.supabase = createSupabaseAdmin() ?? supabase;
    return next();
  }

  if (!user) return context.redirect('/admin/login');

  const { data: isAdmin } = await supabase.rpc('hb_is_admin');
  if (!isAdmin) {
    await supabase.auth.signOut();
    return context.redirect('/admin/login?denied=1');
  }

  locals.user = user;
  locals.supabase = supabase;
  return next();
});
