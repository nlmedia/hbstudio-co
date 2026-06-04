import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Server-side upload of a deliverable into the PRIVATE "deliverables" bucket.
 * Uses the elevated admin client from middleware (locals.supabase) so the file
 * never transits an anon/browser key. Returns the stored object path.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = (locals as any).supabase;
  if (!supabase) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  const slug = String(form.get('slug') ?? 'misc').replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'misc';
  if (!(file instanceof File) || file.size === 0) {
    return new Response(JSON.stringify({ error: 'no_file' }), { status: 400 });
  }

  const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
  const path = `${slug}/${Date.now()}-${safeName}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from('deliverables').upload(path, buffer, {
    contentType: file.type || 'application/zip',
    upsert: true,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ path }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
