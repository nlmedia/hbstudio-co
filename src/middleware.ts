import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, request, locals } = context;

  // Only guard the admin area.
  if (!url.pathname.startsWith('/admin')) return next();
  // Login + auth callback/signout are public within /admin.
  if (url.pathname === '/admin/login' || url.pathname.startsWith('/admin/auth')) return next();

  const supabase = createSupabaseServer(cookies, request.headers);
  const { data: { user } } = await supabase.auth.getUser();

  // DEV-ONLY preview bypass (never active in production builds)
  if (!user && import.meta.env.DEV) {
    locals.user = { email: 'preview@local (dev)' } as any;
    locals.supabase = supabase;
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
