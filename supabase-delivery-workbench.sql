-- Run this once in the Supabase SQL Editor before enabling the delivery workbench.
create table if not exists public.delivery_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null,
  rider_name text,
  rider_phone text,
  external_order_no text,
  status text not null default 'assigned',
  estimated_pickup_at timestamptz,
  estimated_delivery_at timestamptz,
  assigned_at timestamptz not null default now(),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  actual_delivery_cost numeric(10, 2) not null default 0,
  assigned_by uuid references public.admin_users(id) on delete set null,
  assigned_by_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_tasks drop constraint if exists delivery_tasks_provider_check;
alter table public.delivery_tasks drop constraint if exists delivery_tasks_status_check;
alter table public.delivery_tasks drop constraint if exists delivery_tasks_cost_check;

alter table public.delivery_tasks
  add constraint delivery_tasks_provider_check check (provider in ('in_house', 'grab', 'lalamove', 'other'));

alter table public.delivery_tasks
  add constraint delivery_tasks_status_check check (status in ('assigned', 'picked_up', 'delivered', 'cancelled'));

alter table public.delivery_tasks
  add constraint delivery_tasks_cost_check check (actual_delivery_cost >= 0);

create index if not exists delivery_tasks_status_updated_idx on public.delivery_tasks (status, updated_at desc);
create index if not exists delivery_tasks_assigned_by_idx on public.delivery_tasks (assigned_by, assigned_at desc);

alter table public.delivery_tasks enable row level security;
revoke all on table public.delivery_tasks from anon, authenticated;
grant select, insert, update, delete on table public.delivery_tasks to service_role;
