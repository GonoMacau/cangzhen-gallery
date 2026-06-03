-- Contact settings keys for about page (address, LINE QR URL).
-- LINE QR 圖片存於既有 items bucket（site/line-qr.*），無需另建 site-assets。

insert into public.settings (key, value) values
  ('contact_address', to_jsonb(''::text)),
  ('contact_line_qr_url', to_jsonb(''::text))
on conflict (key) do nothing;
