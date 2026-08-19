#!/usr/bin/env node
/**
 * 安全硬化驗證腳本（純 REST + anon key，不依賴 Realtime WebSocket）
 *
 * 用法：node scripts/security-audit-proof.mjs
 */

import { loadProjectEnv } from "./lib/load-dotenv.mjs";

loadProjectEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const TEST_EMAIL = "eric.chang.1015+tester@gmail.com";
const TEST_PASSWORD = "a1234567";

function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  return false;
}

function pass(msg) {
  console.log(`[PASS] ${msg}`);
  return true;
}

function info(msg) {
  console.log(`[INFO] ${msg}`);
}

function apiHeaders(token = ANON_KEY, extra = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function signInWithPassword() {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error_description || body.msg || `HTTP ${res.status}`);
  }
  return body;
}

async function testRpcPromoteToAdmin() {
  info("測試 1：anon 呼叫 promote_to_admin RPC");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/promote_to_admin`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ target_email: TEST_EMAIL }),
  });
  const body = await res.text();
  // void function 成功時 PostgREST 回 204
  if (res.status === 204 || res.ok) {
    return fail(`RPC 仍可執行（HTTP ${res.status}）body=${body.slice(0, 120)}`);
  }
  return pass(`RPC 已被拒絕（HTTP ${res.status}）：${body.slice(0, 120)}`);
}

async function testSelfRoleEscalation(accessToken, userId) {
  info("測試 2：authenticated 自改 profiles.role = admin");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: apiHeaders(accessToken, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ role: "admin" }),
    },
  );
  const rows = await res.json().catch(() => []);
  const role = Array.isArray(rows) ? rows[0]?.role : undefined;

  const check = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`,
    { headers: apiHeaders(accessToken) },
  );
  const current = await check.json().catch(() => []);
  const currentRole = Array.isArray(current) ? current[0]?.role : role;

  if (currentRole === "admin") {
    return fail("profiles.role 已被改成 admin");
  }
  if (!res.ok) {
    return pass(`自改 role 失敗（HTTP ${res.status}），目前 role=${currentRole ?? "?"}`);
  }
  return pass(`role 維持 ${currentRole ?? "?"}（HTTP ${res.status}）`);
}

async function ensureConversation(accessToken, userId) {
  const convRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?guest_id=eq.${userId}&select=id,unread_for_admin&limit=1`,
    { headers: apiHeaders(accessToken) },
  );
  const convRows = await convRes.json().catch(() => []);
  if (convRows[0]?.id) return convRows[0];

  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: "POST",
    headers: apiHeaders(accessToken, { Prefer: "return=representation" }),
    body: JSON.stringify({
      guest_id: userId,
      subject: "security-audit-proof",
    }),
  });
  const created = await createRes.json().catch(() => []);
  const row = Array.isArray(created) ? created[0] : created;
  if (!row?.id) throw new Error(`無法建立測試對話：HTTP ${createRes.status}`);
  return row;
}

async function deleteMessage(accessToken, id) {
  if (!id) return;
  await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${id}`, {
    method: "DELETE",
    headers: apiHeaders(accessToken),
  });
}

async function testLegitimateGuestMessage(accessToken, userId) {
  info("測試 3：訪客正常送出私訊（sender_role=guest）");
  let conversationId;
  try {
    conversationId = (await ensureConversation(accessToken, userId)).id;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const marker = `security-proof-legit-${Date.now()}`;
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: "POST",
    headers: apiHeaders(accessToken, { Prefer: "return=representation" }),
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: "guest",
      content: marker,
    }),
  });
  const inserted = await insertRes.json().catch(() => null);
  const row = Array.isArray(inserted) ? inserted[0] : inserted;
  await deleteMessage(accessToken, row?.id);

  if (!insertRes.ok || row?.sender_role !== "guest") {
    return fail(`正常私訊失敗（HTTP ${insertRes.status}）role=${row?.sender_role ?? "?"}`);
  }
  return pass("訪客正常私訊成功，sender_role=guest");
}

async function testForgedSenderRole(accessToken, userId) {
  info("測試 4：INSERT messages 偽造 sender_role=admin");
  let conversationId;
  try {
    conversationId = (await ensureConversation(accessToken, userId)).id;
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const marker = `security-proof-forge-${Date.now()}`;
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
    method: "POST",
    headers: apiHeaders(accessToken, { Prefer: "return=representation" }),
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: userId,
      sender_role: "admin",
      content: marker,
    }),
  });

  const inserted = await insertRes.json().catch(() => null);
  const row = Array.isArray(inserted) ? inserted[0] : inserted;
  await deleteMessage(accessToken, row?.id);

  if (!insertRes.ok) {
    return pass(`偽造 sender_role 被拒（HTTP ${insertRes.status}）`);
  }
  if (row?.sender_role === "admin") {
    return fail("sender_role 仍為 admin，trigger 未覆寫");
  }
  if (row?.sender_role === "guest") {
    return pass("sender_role 已由 DB 覆寫為 guest");
  }
  return pass(`sender_role=${row?.sender_role ?? "?"}（非 admin）`);
}

async function testUnreadTamper(accessToken, userId) {
  info("測試 5：訪客不可將 unread_for_admin 歸零");
  let conv;
  try {
    conv = await ensureConversation(accessToken, userId);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }

  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conv.id}`,
    {
      method: "PATCH",
      headers: apiHeaders(accessToken, { Prefer: "return=representation" }),
      body: JSON.stringify({ unread_for_admin: 0 }),
    },
  );
  const patched = await patchRes.json().catch(() => []);
  const after = Array.isArray(patched) ? patched[0] : patched;

  if (patchRes.ok && after?.unread_for_admin === 0 && (conv.unread_for_admin ?? 0) > 0) {
    return fail("訪客可將 unread_for_admin 歸零");
  }
  if (!patchRes.ok) {
    return pass(`篡改未讀數被拒（HTTP ${patchRes.status}）`);
  }
  return pass(`unread_for_admin 未被訪客歸零（${after?.unread_for_admin ?? conv.unread_for_admin}）`);
}

async function main() {
  console.log("=== 藏珍閣安全硬化驗證 ===\n");

  if (!SUPABASE_URL || !ANON_KEY) {
    console.error("缺少 NEXT_PUBLIC_SUPABASE_URL 或 anon/publishable key（.env.local）");
    process.exit(1);
  }

  const results = [];
  results.push(await testRpcPromoteToAdmin());

  let accessToken;
  let userId;
  try {
    const auth = await signInWithPassword();
    accessToken = auth.access_token;
    userId = auth.user?.id;
  } catch (e) {
    console.error(`測試帳號登入失敗：${e instanceof Error ? e.message : e}`);
    console.error("請先在網站 /login 註冊測試帳號後再跑此腳本。");
    process.exit(1);
  }

  info(`已登入測試帳號 ${TEST_EMAIL} (${userId})`);

  results.push(await testSelfRoleEscalation(accessToken, userId));
  results.push(await testLegitimateGuestMessage(accessToken, userId));
  results.push(await testForgedSenderRole(accessToken, userId));
  results.push(await testUnreadTamper(accessToken, userId));

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== 完成：${results.length - failed}/${results.length} 通過 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
