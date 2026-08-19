#!/usr/bin/env node
/** 將測試帳號 role 重設為 guest（proof 腳本前使用） */
import pg from "pg";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv, buildSupabaseDbUrlAsync } from "./lib/load-dotenv.mjs";

loadProjectEnv(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const dbUrl = await buildSupabaseDbUrlAsync(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PASSWORD,
);

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const res = await client.query(
  `UPDATE public.profiles SET role = 'guest'
   WHERE id IN (SELECT id FROM auth.users WHERE email = $1)
   RETURNING id, role`,
  ["eric.chang.1015+tester@gmail.com"],
);
await client.end();
console.log("[reset-test-user]", res.rows);
