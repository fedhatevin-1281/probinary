create table if not exists public.nowpayments_orders (
  order_id text primary key,
  user_id text not null,
  amount_usd numeric(12, 2) not null check (amount_usd >= 3),
  invoice_id text unique,
  invoice_url text,
  payment_id text,
  pay_address text,
  pay_amount numeric(36, 18),
  pay_currency text,
  payin_extra_id text,
  payin_extra_id_name text,
  payment_status text not null default 'creating',
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nowpayments_orders
  add column if not exists pay_address text,
  add column if not exists pay_amount numeric(36, 18),
  add column if not exists pay_currency text,
  add column if not exists payin_extra_id text,
  add column if not exists payin_extra_id_name text;

create index if not exists nowpayments_orders_user_created_idx
  on public.nowpayments_orders (user_id, created_at desc);

alter table public.nowpayments_orders enable row level security;

create or replace function public.apply_wallet_delta(p_user_id text, p_delta numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_balance numeric;
begin
  if p_delta = 0 then
    raise exception 'Wallet delta must be non-zero';
  end if;

  update public.wallets
  set current_balance = current_balance + p_delta,
      last_updated = now(),
      updated_at = now()
  where user_id::text = p_user_id
    and current_balance + p_delta >= 0
  returning current_balance into updated_balance;

  if not found then
    raise exception 'Wallet not found or balance would become negative';
  end if;

  return updated_balance;
end;
$$;

create or replace function public.complete_nowpayments_order(
  p_order_id text,
  p_payment_id text,
  p_amount_usd numeric,
  p_price_currency text
)
returns table (credited boolean, current_balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_order public.nowpayments_orders%rowtype;
  new_balance numeric;
begin
  select * into payment_order
  from public.nowpayments_orders
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'NOWPayments order not found';
  end if;

  if lower(p_price_currency) <> 'usd'
     or p_amount_usd <> payment_order.amount_usd then
    raise exception 'NOWPayments payment amount or currency mismatch';
  end if;

  if payment_order.payment_id is not null
     and payment_order.payment_id <> p_payment_id then
    raise exception 'NOWPayments payment ID mismatch';
  end if;

  if payment_order.credited_at is not null then
    select wallets.current_balance into new_balance
    from public.wallets
    where wallets.user_id::text = payment_order.user_id;

    return query select false, new_balance;
    return;
  end if;

  update public.wallets
  set current_balance = current_balance + payment_order.amount_usd,
      total_deposits = coalesce(total_deposits, 0) + payment_order.amount_usd,
      last_updated = now(),
      updated_at = now()
  where user_id::text = payment_order.user_id
  returning current_balance into new_balance;

  if not found then
    raise exception 'Wallet not found for NOWPayments order';
  end if;

  update public.nowpayments_orders
  set payment_status = 'finished',
      payment_id = p_payment_id,
      credited_at = now(),
      updated_at = now()
  where order_id = p_order_id;

  return query select true, new_balance;
end;
$$;

revoke all on public.nowpayments_orders from anon, authenticated;
grant select, insert, update on public.nowpayments_orders to service_role;
revoke all on function public.apply_wallet_delta(text, numeric) from public, anon, authenticated;
revoke all on function public.complete_nowpayments_order(text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.apply_wallet_delta(text, numeric) to service_role;
grant execute on function public.complete_nowpayments_order(text, text, numeric, text) to service_role;

create table if not exists public.manual_wallet_deposits (
  id bigint generated always as identity primary key,
  user_id text not null,
  amount numeric(12, 2) not null check (amount > 0),
  reference text not null unique,
  note text,
  credited_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists manual_wallet_deposits_user_created_idx
  on public.manual_wallet_deposits (user_id, created_at desc);

alter table public.manual_wallet_deposits enable row level security;

create or replace function public.apply_manual_wallet_deposit(
  p_user_id text,
  p_amount numeric,
  p_reference text,
  p_note text,
  p_credited_by text
)
returns table (current_balance numeric, total_deposits numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance numeric;
  new_total_deposits numeric;
begin
  if p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Deposit amount must be positive and have at most two decimal places';
  end if;

  if length(trim(p_reference)) = 0 then
    raise exception 'A payment reference is required';
  end if;

  update public.wallets
  set current_balance = coalesce(current_balance, 0) + p_amount,
      total_deposits = coalesce(total_deposits, 0) + p_amount,
      last_updated = now(),
      updated_at = now()
  where user_id::text = p_user_id
  returning current_balance, total_deposits
  into new_balance, new_total_deposits;

  if not found then
    raise exception 'Wallet not found for user';
  end if;

  insert into public.manual_wallet_deposits (
    user_id, amount, reference, note, credited_by
  ) values (
    p_user_id, p_amount, trim(p_reference), nullif(trim(p_note), ''), p_credited_by
  );

  return query select new_balance, new_total_deposits;
end;
$$;

revoke all on public.manual_wallet_deposits from anon, authenticated;
grant select, insert on public.manual_wallet_deposits to service_role;
revoke all on function public.apply_manual_wallet_deposit(text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_manual_wallet_deposit(text, numeric, text, text, text) to service_role;