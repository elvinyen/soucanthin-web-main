import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyOtpChallenge } from '../api/_auth-utils';

function readProjectFile(path: string) {
  return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
}

test('login verifies an opaque OTP challenge instead of trusting a submitted phone', () => {
  const verifyHandler = readProjectFile('api/auth-verify-otp.ts');
  assert.match(verifyHandler, /parseJsonBody<\{ challengeId\?: string; code\?: string \}>/);
  assert.match(verifyHandler, /verifyOtpChallenge\(\{ challengeId, code, purpose: 'login' \}\)/);
  assert.doesNotMatch(verifyHandler, /body\.phone/);
  assert.doesNotMatch(verifyHandler, /normalizeMalaysiaPhone/);
});

test('OTP challenges bind phone, purpose, account and one-time consumption', () => {
  const authUtils = readProjectFile('api/_auth-utils.ts');
  assert.match(authUtils, /challenge\.user_id !== params\.userId/);
  assert.match(authUtils, /challenge\.phone !== params\.expectedPhone/);
  assert.match(authUtils, /purpose=eq\.\$\{encodeURIComponent\(params\.purpose\)\}/);
  assert.match(authUtils, /consumed_at=is\.null/);
  assert.match(authUtils, /OTP_MAX_VERIFY_ATTEMPTS = 5/);
});

test('successful verification returns the phone stored in the server challenge', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    MOCEAN_API_TOKEN: process.env.MOCEAN_API_TOKEN,
  };
  const challenge = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: null,
    phone: '60123456789',
    display_phone: '+60123456789',
    provider_reqid: 'provider-request-id',
    purpose: 'login',
    request_fingerprint: 'fingerprint',
    attempt_count: 0,
    expires_at: '2099-01-01T00:00:00.000Z',
    consumed_at: null,
    created_at: '2026-08-04T00:00:00.000Z',
  };

  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.MOCEAN_API_TOKEN = 'test-mocean-token';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/rest/v1/otp_challenges') && init?.method === 'GET') {
      return Response.json([challenge]);
    }
    if (url.includes('/rest/2/verify/check')) {
      return Response.json({ status: 0 });
    }
    if (url.includes('/rest/v1/otp_challenges') && init?.method === 'PATCH') {
      return Response.json([{ ...challenge, consumed_at: '2026-08-04T00:01:00.000Z' }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await verifyOtpChallenge({
      challengeId: challenge.id,
      code: '123456',
      purpose: 'login',
    });
    assert.deepEqual(result, { phone: challenge.phone, displayPhone: challenge.display_phone });
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('SUPABASE_URL', originalEnv.SUPABASE_URL);
    restoreEnv('SUPABASE_SERVICE_ROLE_KEY', originalEnv.SUPABASE_SERVICE_ROLE_KEY);
    restoreEnv('MOCEAN_API_TOKEN', originalEnv.MOCEAN_API_TOKEN);
  }
});

test('OTP requests have server-side phone and client limits', () => {
  const authUtils = readProjectFile('api/_auth-utils.ts');
  assert.match(authUtils, /OTP_PHONE_HOURLY_LIMIT = 5/);
  assert.match(authUtils, /OTP_PHONE_DAILY_LIMIT = 15/);
  assert.match(authUtils, /OTP_CLIENT_HOURLY_LIMIT = 20/);
  assert.match(authUtils, /OTP_CLIENT_DAILY_LIMIT = 100/);
  assert.match(authUtils, /created_at=gte\.\$\{encodeURIComponent\(oneMinuteAgo\)\}/);
});

test('customer auth tables are RLS-enabled and restricted to service role', () => {
  const schema = readProjectFile('supabase-schema.sql');
  const protectedTables = [
    'users',
    'otp_challenges',
    'user_sessions',
    'wallets',
    'wallet_transactions',
    'user_addresses',
    'user_coupons',
  ];

  for (const table of protectedTables) {
    assert.match(schema, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(schema, /revoke all on table[\s\S]*public\.otp_challenges[\s\S]*public\.user_sessions[\s\S]*from public, anon, authenticated/);
  assert.match(schema, /grant select, insert, update, delete on table[\s\S]*public\.otp_challenges[\s\S]*public\.user_sessions[\s\S]*to service_role/);
});

test('wallet security definer functions are service-role only with fixed search paths', () => {
  const schema = readProjectFile('supabase-schema.sql');
  assert.match(schema, /process_wallet_payment[\s\S]*security definer\s+set search_path = ''/);
  assert.match(schema, /approve_wallet_recharge[\s\S]*security definer\s+set search_path = ''/);
  assert.match(schema, /revoke all on function public\.process_wallet_payment\(uuid, uuid, numeric\) from public, anon, authenticated/);
  assert.match(schema, /revoke all on function public\.approve_wallet_recharge\(uuid, text, text, text\) from public, anon, authenticated/);
  assert.match(schema, /grant execute on function public\.process_wallet_payment\(uuid, uuid, numeric\) to service_role/);
  assert.match(schema, /grant execute on function public\.approve_wallet_recharge\(uuid, text, text, text\) to service_role/);
});

test('session lifecycle is bounded and authenticated responses are not cached', () => {
  const authUtils = readProjectFile('api/_auth-utils.ts');
  const authMe = readProjectFile('api/auth-me.ts');
  assert.match(authUtils, /MAX_ACTIVE_SESSIONS_PER_USER = 5/);
  assert.match(authUtils, /user_sessions\?expires_at=lte\./);
  assert.match(authMe, /Cache-Control', 'no-store'/);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
