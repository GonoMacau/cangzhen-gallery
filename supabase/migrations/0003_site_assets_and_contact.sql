-- Site assets bucket (LINE QR, etc.) + contact settings keys

insert into public.settings (key, value) values
  ('contact_address', to_jsonb(''::text)),
  ('contact_line_qr_url', to_jsonb(''::text))
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

drop policy if exists "site-assets storage public read" on storage.objects;
create policy "site-assets storage public read" on storage.objects
for select using (bucket_id = 'site-assets');

drop policy if exists "site-assets storage admin write" on storage.objects;
create policy "site-assets storage admin write" on storage.objects
for all using (bucket_id = 'site-assets' and public.is_admin(auth.uid()))
with check (bucket_id = 'site-assets' and public.is_admin(auth.uid()));
