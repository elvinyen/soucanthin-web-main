-- Run this once in the Supabase SQL Editor before deploying the OTP challenge code.
create table if not exists public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  phone text not null,
  display_phone text not null,
  provider_reqid text not null,
  purpose text not null check (purpose in ('login', 'update_phone')),
  request_fingerprint text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 5),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists otp_challenges_phone_created_idx
  on public.otp_challenges (phone, created_at desc);
create index if not exists otp_challenges_fingerprint_created_idx
  on public.otp_challenges (request_fingerprint, created_at desc);
create index if not exists otp_challenges_expires_idx
  on public.otp_challenges (expires_at);
create index if not exists otp_challenges_user_created_idx
  on public.otp_challenges (user_id, created_at desc);
create index if not exists user_sessions_user_created_idx
  on public.user_sessions (user_id, created_at desc);

alter table public.users enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.user_sessions enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.user_addresses enable row level security;
alter table public.user_coupons enable row level security;

revoke all on table
  public.users,
  public.otp_challenges,
  public.user_sessions,
  public.wallets,
  public.wallet_transactions,
  public.user_addresses,
  public.user_coupons
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.users,
  public.otp_challenges,
  public.user_sessions,
  public.wallets,
  public.wallet_transactions,
  public.user_addresses,
  public.user_coupons
to service_role;

alter function public.process_wallet_payment(uuid, uuid, numeric) set search_path = '';
alter function public.approve_wallet_recharge(uuid, text, text, text) set search_path = '';

revoke all on function public.process_wallet_payment(uuid, uuid, numeric) from public, anon, authenticated;
revoke all on function public.approve_wallet_recharge(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.process_wallet_payment(uuid, uuid, numeric) to service_role;
grant execute on function public.approve_wallet_recharge(uuid, text, text, text) to service_role;
