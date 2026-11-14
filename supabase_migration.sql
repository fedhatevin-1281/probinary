-- ============================================================================
-- PROBINARY.APP — COMPREHENSIVE DATABASE AUDIT & CONSOLIDATED MIGRATION
-- ============================================================================
-- This script establishes strict data integrity, atomic wallet functions,
-- role-based security, unified transaction history, KYC verification,
-- withdrawal approval workflows, and trading ledger synchronization.
--
-- Safe for execution on new or existing Supabase PostgreSQL instances.
-- ============================================================================

-- 1. BASE EXTENSIONS
create extension if not exists "pgcrypto";

-- 2. ROLES TABLE & SEEDING
create table if not exists public.roles (
  id bigint generated always as identity primary key,
  name text not null unique check (name in ('client', 'admin', 'super_admin')),
  created_at timestamptz not null default now()
);

insert into public.roles (name)
values ('client'), ('admin'), ('super_admin')
on conflict (name) do nothing;

-- 3. USERS TABLE (SCHEMA COMPLIANCE)
create table if not exists public.users (
  id bigint generated always as identity primary key,
  email text not null unique,
  username text,
  password_hash text not null,
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deactivated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure account_status has constraint
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_account_status_check'
  ) then
    alter table public.users add constraint users_account_status_check
      check (account_status in ('active', 'suspended', 'deactivated'));
  end if;
exception when others then null;
end $$;

create index if not exists users_email_idx on public.users (lower(email));

-- 4. USER ROLES JUNCTION
create table if not exists public.user_roles (
  user_id bigint not null references public.users(id) on delete cascade,
  role_id bigint not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);

-- 5. AUTHORITATIVE WALLETS TABLE
create table if not exists public.wallets (
  user_id bigint primary key references public.users(id) on delete cascade,
  current_balance numeric(12, 2) not null default 0.00 check (current_balance >= 0),
  currency text not null default 'USD',
  total_deposits numeric(12, 2) not null default 0.00 check (total_deposits >= 0),
  total_withdrawals numeric(12, 2) not null default 0.00 check (total_withdrawals >= 0),
  last_updated timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets (user_id);

-- 6. CENTRAL FINANCIAL LEDGER: TRANSACTION HISTORY
create table if not exists public.transaction_history (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('deposit', 'withdrawal', 'trade', 'adjustment', 'mpesa_deposit')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'approved', 'processing', 'completed', 'failed', 'cancelled', 'rejected')),
  payment_reference text,
  description text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade existing constraint if it was narrower
do $$
begin
  alter table public.transaction_history drop constraint if exists transaction_history_status_check;
  alter table public.transaction_history add constraint transaction_history_status_check
    check (status in ('pending', 'approved', 'processing', 'completed', 'failed', 'cancelled', 'rejected'));
exception when others then null;
end $$;

create index if not exists tx_history_user_created_idx
  on public.transaction_history (user_id, created_at desc);
create index if not exists tx_history_reference_idx
  on public.transaction_history (payment_reference);
create index if not exists tx_history_type_status_idx
  on public.transaction_history (transaction_type, status);

-- 7. WITHDRAWAL REQUESTS WORKFLOW TABLE
create table if not exists public.withdrawal_requests (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  payment_method text not null,
  destination_details text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'processing', 'completed', 'failed')),
  admin_note text,
  reviewed_by bigint references public.users(id) on delete set null,
  reviewed_at timestamptz,
  transaction_history_id bigint references public.transaction_history(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_user_created_idx
  on public.withdrawal_requests (user_id, created_at desc);
create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests (status);

-- 8. KYC SUBMISSIONS WORKFLOW TABLE
create table if not exists public.kyc_submissions (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.users(id) on delete cascade,
  full_name text,
  dob date,
  doc_number text,
  document_type text not null default 'national_id',
  document_front_url text not null,
  document_back_url text,
  selfie_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by bigint references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kyc_submissions_user_idx
  on public.kyc_submissions (user_id, created_at desc);
create index if not exists kyc_submissions_status_idx
  on public.kyc_submissions (status);

-- 9. BINARY TRADE RECORDS (COMPOSITE PRIMARY KEY)
create table if not exists public.binary_trade_records (
  user_id text not null,
  trade_id text not null,
  is_demo boolean not null default false,
  symbol text not null,
  market_name text,
  contract_type text,
  direction text not null,
  stake numeric(12, 2) not null check (stake > 0),
  entry_price numeric not null,
  entry_digit integer,
  exit_price numeric,
  exit_digit integer,
  payout numeric(12, 2) default 0.00,
  profit numeric(12, 2) default 0.00,
  payout_multiplier numeric default 1.87,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'break_even', 'cancelled')),
  result text check (result in ('won', 'lost', 'break_even', 'cancelled')),
  created_at timestamptz not null default now(),
  expiry_at timestamptz,
  expiry_seconds integer default 5,
  settled_at timestamptz,
  closure_reason text,
  primary key (user_id, trade_id)
);

create index if not exists binary_trades_user_created_idx
  on public.binary_trade_records (user_id, created_at desc);
create index if not exists binary_trades_status_idx
  on public.binary_trade_records (status);

-- 10. PAYMENT PROVIDER TABLES (COMPATIBILITY & IDEMPOTENCY)
create table if not exists public.nowpayments_orders (
  order_id text primary key,
  user_id text not null,
  amount_usd numeric(12, 2) not null check (amount_usd >= 1),
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

create index if not exists nowpayments_orders_user_created_idx
  on public.nowpayments_orders (user_id, created_at desc);

create table if not exists public.makamescopay_orders (
  order_reference text primary key,
  user_id text not null,
  amount_usd numeric(12, 2) not null check (amount_usd >= 1),
  amount_kes integer not null check (amount_kes >= 1),
  phone_number text not null,
  checkout_request_id text unique,
  merchant_request_id text,
  mpesa_receipt_number text,
  status text not null default 'initiating'
    check (status in ('initiating', 'pending', 'completed', 'failed', 'cancelled', 'review')),
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists makamescopay_orders_user_created_idx
  on public.makamescopay_orders (user_id, created_at desc);

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

-- ============================================================================
-- ATOMIC STORED PROCEDURES & RPC FUNCTIONS (SECURITY DEFINER)
-- ============================================================================

-- Function 1: Atomic Admin Balance Adjustment with Full Audit Trail
create or replace function public.apply_wallet_adjustment_atomic(
  p_user_id bigint,
  p_amount numeric,
  p_type text,
  p_reference text,
  p_description text,
  p_admin_id bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  current_balance numeric,
  total_deposits numeric,
  total_withdrawals numeric,
  transaction_id bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.wallets%rowtype;
  v_new_balance numeric;
  v_new_deposits numeric;
  v_new_withdrawals numeric;
  v_tx_id bigint;
  v_clean_ref text;
begin
  if p_amount = 0 then
    raise exception 'Adjustment amount cannot be zero';
  end if;

  v_clean_ref := coalesce(nullif(trim(p_reference), ''), 'ADJ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10)));

  -- Prevent duplicate reference crediting
  if exists (select 1 from public.transaction_history where payment_reference = v_clean_ref and status = 'completed') then
    raise exception 'A transaction with reference % has already been processed', v_clean_ref;
  end if;

  -- Lock wallet row
  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    -- Create wallet if missing
    insert into public.wallets (user_id, current_balance, total_deposits, total_withdrawals)
    values (p_user_id, 0.00, 0.00, 0.00)
    returning * into v_wallet;
  end if;

  v_new_balance := round(v_wallet.current_balance + p_amount, 2);
  v_new_deposits := v_wallet.total_deposits;
  v_new_withdrawals := v_wallet.total_withdrawals;

  if v_new_balance < 0 then
    raise exception 'Wallet balance cannot become negative (current: %, delta: %)', v_wallet.current_balance, p_amount;
  end if;

  -- Update deposit/withdrawal tracking if classified as such
  if p_type = 'deposit' or (p_type = 'adjustment' and p_amount > 0 and coalesce((p_metadata->>'classify_as_deposit')::boolean, true)) then
    v_new_deposits := round(v_wallet.total_deposits + p_amount, 2);
  elsif p_type = 'withdrawal' and p_amount < 0 then
    v_new_withdrawals := round(v_wallet.total_withdrawals + abs(p_amount), 2);
  end if;

  update public.wallets
  set current_balance = v_new_balance,
      total_deposits = v_new_deposits,
      total_withdrawals = v_new_withdrawals,
      last_updated = now(),
      updated_at = now()
  where user_id = p_user_id;

  -- Insert audit record into transaction_history
  insert into public.transaction_history (
    user_id,
    transaction_type,
    amount,
    currency,
    status,
    payment_reference,
    description,
    metadata_json
  ) values (
    p_user_id,
    case when p_type in ('deposit', 'withdrawal', 'trade', 'adjustment', 'mpesa_deposit') then p_type else 'adjustment' end,
    abs(p_amount),
    v_wallet.currency,
    'completed',
    v_clean_ref,
    coalesce(nullif(trim(p_description), ''), 'Admin manual balance adjustment'),
    jsonb_build_object(
      'admin_id', p_admin_id,
      'previous_balance', v_wallet.current_balance,
      'new_balance', v_new_balance,
      'delta', p_amount,
      'custom', p_metadata
    )
  ) returning id into v_tx_id;

  -- Insert into manual_wallet_deposits for compatibility
  if p_amount > 0 then
    insert into public.manual_wallet_deposits (
      user_id, amount, reference, note, credited_by
    ) values (
      p_user_id::text,
      p_amount,
      v_clean_ref,
      p_description,
      coalesce(p_admin_id::text, 'admin')
    ) on conflict (reference) do nothing;
  end if;

  return query select v_new_balance, v_new_deposits, v_new_withdrawals, v_tx_id;
end;
$$;


-- Function 2: Atomic Withdrawal Request & Balance Reservation
create or replace function public.request_withdrawal_atomic(
  p_user_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_destination_details text,
  p_reference text default null
)
returns table (
  withdrawal_id bigint,
  transaction_id bigint,
  payment_reference text,
  new_balance numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.wallets%rowtype;
  v_clean_ref text;
  v_new_balance numeric;
  v_tx_id bigint;
  v_wd_id bigint;
begin
  if p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Withdrawal amount must be greater than zero with at most two decimal places';
  end if;

  v_clean_ref := coalesce(nullif(trim(p_reference), ''), 'WD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)));

  -- Lock wallet
  select * into v_wallet
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  if v_wallet.current_balance < p_amount then
    raise exception 'Insufficient balance: available $%, requested $%', v_wallet.current_balance, p_amount;
  end if;

  -- Reserve the requested amount immediately
  v_new_balance := round(v_wallet.current_balance - p_amount, 2);

  update public.wallets
  set current_balance = v_new_balance,
      last_updated = now(),
      updated_at = now()
  where user_id = p_user_id;

  -- Create pending entry in transaction_history
  insert into public.transaction_history (
    user_id,
    transaction_type,
    amount,
    currency,
    status,
    payment_reference,
    description,
    metadata_json
  ) values (
    p_user_id,
    'withdrawal',
    p_amount,
    v_wallet.currency,
    'pending',
    v_clean_ref,
    'Withdrawal via ' || p_payment_method || ' to ' || p_destination_details,
    jsonb_build_object(
      'payment_method', p_payment_method,
      'destination', p_destination_details,
      'reserved_balance', p_amount,
      'previous_balance', v_wallet.current_balance
    )
  ) returning id into v_tx_id;

  -- Create withdrawal request
  insert into public.withdrawal_requests (
    user_id,
    amount,
    currency,
    payment_method,
    destination_details,
    status,
    transaction_history_id
  ) values (
    p_user_id,
    p_amount,
    v_wallet.currency,
    p_payment_method,
    p_destination_details,
    'pending',
    v_tx_id
  ) returning id into v_wd_id;

  return query select v_wd_id, v_tx_id, v_clean_ref, v_new_balance;
end;
$$;


-- Function 3: Atomic Admin Withdrawal Review (Approve, Reject/Refund, Complete, Fail)
create or replace function public.review_withdrawal_atomic(
  p_request_id bigint,
  p_action text, -- 'approve', 'reject', 'process', 'complete', 'fail'
  p_admin_id bigint,
  p_admin_note text default null
)
returns table (
  withdrawal_id bigint,
  user_id bigint,
  status text,
  refunded boolean,
  current_balance numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wd public.withdrawal_requests%rowtype;
  v_wallet public.wallets%rowtype;
  v_new_status text;
  v_refunded boolean := false;
  v_new_bal numeric;
begin
  -- Lock request
  select * into v_wd
  from public.withdrawal_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Withdrawal request % not found', p_request_id;
  end if;

  if v_wd.status in ('completed', 'rejected', 'failed') then
    raise exception 'Withdrawal request % is already finalized as %', p_request_id, v_wd.status;
  end if;

  -- Lock user wallet
  select * into v_wallet
  from public.wallets
  where user_id = v_wd.user_id
  for update;

  v_new_bal := v_wallet.current_balance;

  if p_action = 'approve' then
    v_new_status := 'approved';
    -- Funds remain reserved; approval confirms admin cleared it for dispatch
    update public.transaction_history
    set status = 'approved',
        updated_at = now(),
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object('approved_by', p_admin_id, 'approved_at', now(), 'admin_note', p_admin_note)
    where id = v_wd.transaction_history_id;

  elsif p_action = 'process' then
    v_new_status := 'processing';
    update public.transaction_history
    set status = 'processing',
        updated_at = now()
    where id = v_wd.transaction_history_id;

  elsif p_action = 'complete' then
    v_new_status := 'completed';
    -- Mark total withdrawals in wallet
    update public.wallets
    set total_withdrawals = total_withdrawals + v_wd.amount,
        last_updated = now(),
        updated_at = now()
    where user_id = v_wd.user_id;

    update public.transaction_history
    set status = 'completed',
        updated_at = now(),
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object('completed_by', p_admin_id, 'completed_at', now())
    where id = v_wd.transaction_history_id;

  elsif p_action in ('reject', 'fail') then
    v_new_status := case when p_action = 'reject' then 'rejected' else 'failed' end;
    -- Release held funds back to user wallet exactly once
    v_new_bal := round(v_wallet.current_balance + v_wd.amount, 2);
    v_refunded := true;

    update public.wallets
    set current_balance = v_new_bal,
        last_updated = now(),
        updated_at = now()
    where user_id = v_wd.user_id;

    update public.transaction_history
    set status = case when p_action = 'reject' then 'rejected' else 'failed' end,
        updated_at = now(),
        description = description || ' (' || upper(p_action) || 'ED: ' || coalesce(p_admin_note, 'Declined by compliance') || ' - Funds Refunded)',
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
          'action', p_action,
          'reviewed_by', p_admin_id,
          'reviewed_at', now(),
          'rejection_reason', p_admin_note,
          'refunded', true,
          'refunded_amount', v_wd.amount,
          'restored_balance', v_new_bal
        )
    where id = v_wd.transaction_history_id;

  else
    raise exception 'Invalid withdrawal action: %', p_action;
  end if;

  update public.withdrawal_requests
  set status = v_new_status,
      admin_note = coalesce(p_admin_note, admin_note),
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_request_id;

  return query select v_wd.id, v_wd.user_id, v_new_status, v_refunded, v_new_bal;
end;
$$;


-- Function 4: Atomic Binary Trade Order Placement
create or replace function public.execute_trade_atomic(
  p_user_id text,
  p_trade_id text,
  p_symbol text,
  p_contract_type text,
  p_direction text,
  p_stake numeric,
  p_entry_price numeric,
  p_entry_digit integer,
  p_duration integer default 5,
  p_payout_multiplier numeric default 1.87,
  p_is_demo boolean default false
)
returns table (
  trade_id text,
  status text,
  new_balance numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_bigint bigint;
  v_wallet public.wallets%rowtype;
  v_new_bal numeric := 0;
begin
  if p_stake <= 0 then
    raise exception 'Trade stake must be greater than zero';
  end if;

  if not p_is_demo then
    v_user_bigint := p_user_id::bigint;

    select * into v_wallet
    from public.wallets
    where user_id = v_user_bigint
    for update;

    if not found then
      raise exception 'Wallet not found for user %', p_user_id;
    end if;

    if v_wallet.current_balance < p_stake then
      raise exception 'Insufficient balance ($%) for trade stake ($%)', v_wallet.current_balance, p_stake;
    end if;

    v_new_bal := round(v_wallet.current_balance - p_stake, 2);

    update public.wallets
    set current_balance = v_new_bal,
        last_updated = now(),
        updated_at = now()
    where user_id = v_user_bigint;

    insert into public.transaction_history (
      user_id,
      transaction_type,
      amount,
      currency,
      status,
      payment_reference,
      description,
      metadata_json
    ) values (
      v_user_bigint,
      'trade',
      p_stake,
      v_wallet.currency,
      'pending',
      p_trade_id,
      'Trade Stake Deducted: ' || p_symbol || ' ' || upper(p_direction),
      jsonb_build_object(
        'trade_id', p_trade_id,
        'symbol', p_symbol,
        'direction', p_direction,
        'stake', p_stake,
        'entry_price', p_entry_price
      )
    );
  end if;

  insert into public.binary_trade_records (
    user_id,
    trade_id,
    is_demo,
    symbol,
    market_name,
    contract_type,
    direction,
    stake,
    entry_price,
    entry_digit,
    created_at,
    expiry_at,
    expiry_seconds,
    payout_multiplier,
    status,
    result
  ) values (
    p_user_id,
    p_trade_id,
    p_is_demo,
    p_symbol,
    p_symbol,
    p_contract_type,
    p_direction,
    p_stake,
    p_entry_price,
    p_entry_digit,
    now(),
    now() + (p_duration || ' seconds')::interval,
    p_duration,
    p_payout_multiplier,
    'open',
    null
  );

  return query select p_trade_id, 'open', v_new_bal;
end;
$$;


-- Function 5: Atomic Binary Trade Settlement (Win/Loss/Break-even)
create or replace function public.settle_trade_atomic(
  p_user_id text,
  p_trade_id text,
  p_exit_price numeric,
  p_exit_digit integer,
  p_outcome text, -- 'win', 'loss', 'break_even'
  p_payout numeric,
  p_profit numeric,
  p_is_demo boolean default false
)
returns table (
  trade_id text,
  status text,
  payout numeric,
  profit numeric,
  new_balance numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trade public.binary_trade_records%rowtype;
  v_user_bigint bigint;
  v_wallet public.wallets%rowtype;
  v_new_bal numeric := 0;
begin
  select * into v_trade
  from public.binary_trade_records
  where user_id = p_user_id and trade_id = p_trade_id
  for update;

  if not found then
    raise exception 'Trade % not found for user %', p_trade_id, p_user_id;
  end if;

  if v_trade.status <> 'open' then
    raise exception 'Trade % is already settled with status %', p_trade_id, v_trade.status;
  end if;

  if not p_is_demo then
    v_user_bigint := p_user_id::bigint;

    select * into v_wallet
    from public.wallets
    where user_id = v_user_bigint
    for update;

    if p_outcome = 'win' then
      v_new_bal := round(v_wallet.current_balance + p_payout, 2);
      update public.wallets
      set current_balance = v_new_bal,
          last_updated = now(),
          updated_at = now()
      where user_id = v_user_bigint;
    elsif p_outcome = 'break_even' then
      -- Stake refund on break-even
      v_new_bal := round(v_wallet.current_balance + p_payout, 2);
      update public.wallets
      set current_balance = v_new_bal,
          last_updated = now(),
          updated_at = now()
      where user_id = v_user_bigint;
    else
      -- Loss: stake was already deducted at order placement
      v_new_bal := v_wallet.current_balance;
    end if;

    -- Update or insert transaction_history settlement
    update public.transaction_history
    set status = 'completed',
        amount = case when p_outcome = 'win' then p_payout else v_trade.stake end,
        description = case
          when p_outcome = 'win' then 'Trade WON: ' || p_trade_id || ' (+$' || round(p_profit, 2)::text || ')'
          when p_outcome = 'break_even' then 'Trade CASHED OUT: ' || p_trade_id
          else 'Trade LOST: ' || p_trade_id || ' (-$' || round(abs(p_profit), 2)::text || ')'
        end,
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || jsonb_build_object(
          'outcome', p_outcome,
          'exit_price', p_exit_price,
          'profit', p_profit,
          'payout', p_payout,
          'settled_at', now()
        ),
        updated_at = now()
    where payment_reference = p_trade_id;
  end if;

  update public.binary_trade_records
  set status = case when p_outcome = 'win' then 'won' when p_outcome = 'loss' then 'lost' else 'break_even' end,
      result = case when p_outcome = 'win' then 'won' when p_outcome = 'loss' then 'lost' else 'break_even' end,
      exit_price = p_exit_price,
      exit_digit = p_exit_digit,
      payout = p_payout,
      profit = p_profit,
      settled_at = now()
  where user_id = p_user_id and trade_id = p_trade_id;

  return query select p_trade_id, p_outcome, p_payout, p_profit, v_new_bal;
end;
$$;


-- Function 6: Complete NOWPayments Order with Synchronized Transaction Ledger
create or replace function public.complete_nowpayments_order(
  p_order_id text,
  p_payment_id text,
  p_amount_usd numeric,
  p_price_currency text,
  p_pay_currency text
)
returns table (credited boolean, current_balance numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_order public.nowpayments_orders%rowtype;
  new_balance numeric;
  v_user_bigint bigint;
begin
  select * into payment_order
  from public.nowpayments_orders
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'NOWPayments order not found: %', p_order_id;
  end if;

  if lower(p_price_currency) <> 'usd' or p_amount_usd <> payment_order.amount_usd then
    raise exception 'NOWPayments payment amount or currency mismatch';
  end if;

  if lower(payment_order.pay_currency) <> lower(p_pay_currency) then
    raise exception 'NOWPayments payment cryptocurrency mismatch';
  end if;

  if payment_order.payment_id is not null and payment_order.payment_id <> p_payment_id then
    raise exception 'NOWPayments payment ID mismatch';
  end if;

  v_user_bigint := payment_order.user_id::bigint;

  -- Idempotency check: already credited
  if payment_order.credited_at is not null then
    select wallets.current_balance into new_balance
    from public.wallets
    where wallets.user_id = v_user_bigint;

    return query select false, new_balance;
    return;
  end if;

  -- Credit wallet atomically
  update public.wallets
  set current_balance = current_balance + payment_order.amount_usd,
      total_deposits = coalesce(total_deposits, 0) + payment_order.amount_usd,
      last_updated = now(),
      updated_at = now()
  where user_id = v_user_bigint
  returning current_balance into new_balance;

  if not found then
    raise exception 'Wallet not found for NOWPayments order';
  end if;

  -- Insert into central transaction history
  insert into public.transaction_history (
    user_id,
    transaction_type,
    amount,
    currency,
    status,
    payment_reference,
    description,
    metadata_json
  ) values (
    v_user_bigint,
    'deposit',
    payment_order.amount_usd,
    'USD',
    'completed',
    payment_order.order_id,
    'Crypto deposit (' || payment_order.pay_currency || ') via NOWPayments',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'pay_currency', payment_order.pay_currency,
      'pay_amount', payment_order.pay_amount,
      'pay_address', payment_order.pay_address
    )
  );

  update public.nowpayments_orders
  set payment_status = 'finished',
      payment_id = p_payment_id,
      credited_at = now(),
      updated_at = now()
  where order_id = p_order_id;

  return query select true, new_balance;
end;
$$;


-- Function 7: Complete MakamescoPay M-Pesa Order with Synchronized Transaction Ledger
create or replace function public.complete_makamescopay_order(
  p_order_reference text,
  p_checkout_request_id text,
  p_amount_kes integer,
  p_phone_number text,
  p_mpesa_receipt_number text
)
returns table (credited boolean, current_balance numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payment_order public.makamescopay_orders%rowtype;
  new_balance numeric;
  v_user_bigint bigint;
begin
  select * into payment_order
  from public.makamescopay_orders
  where order_reference = p_order_reference
  for update;

  if not found then
    raise exception 'MakamescoPay order not found';
  end if;

  if payment_order.checkout_request_id is distinct from p_checkout_request_id
     or payment_order.amount_kes <> p_amount_kes
     or payment_order.phone_number <> p_phone_number then
    raise exception 'MakamescoPay payment details mismatch';
  end if;

  v_user_bigint := payment_order.user_id::bigint;

  -- Idempotency check: already credited
  if payment_order.credited_at is not null then
    select wallets.current_balance into new_balance
    from public.wallets
    where wallets.user_id = v_user_bigint;

    return query select false, new_balance;
    return;
  end if;

  if payment_order.status <> 'pending' then
    raise exception 'MakamescoPay order is not pending';
  end if;

  -- Credit wallet atomically
  update public.wallets
  set current_balance = coalesce(current_balance, 0) + payment_order.amount_usd,
      total_deposits = coalesce(total_deposits, 0) + payment_order.amount_usd,
      last_updated = now(),
      updated_at = now()
  where user_id = v_user_bigint
  returning current_balance into new_balance;

  if not found then
    raise exception 'Wallet not found for MakamescoPay order';
  end if;

  -- Insert into manual_wallet_deposits for compatibility
  insert into public.manual_wallet_deposits (
    user_id, amount, reference, note, credited_by
  ) values (
    payment_order.user_id,
    payment_order.amount_usd,
    payment_order.order_reference,
    'MakamescoPay M-Pesa deposit (' || payment_order.amount_kes || ' KES)',
    'MakamescoPay'
  ) on conflict (reference) do nothing;

  -- Insert into central transaction history
  insert into public.transaction_history (
    user_id,
    transaction_type,
    amount,
    currency,
    status,
    payment_reference,
    description,
    metadata_json
  ) values (
    v_user_bigint,
    'mpesa_deposit',
    payment_order.amount_usd,
    'USD',
    'completed',
    payment_order.order_reference,
    'M-Pesa deposit via Safaricom (' || payment_order.phone_number || ') Receipt: ' || coalesce(p_mpesa_receipt_number, 'N/A'),
    jsonb_build_object(
      'amount_kes', payment_order.amount_kes,
      'phone_number', payment_order.phone_number,
      'mpesa_receipt', p_mpesa_receipt_number,
      'checkout_request_id', p_checkout_request_id
    )
  );

  update public.makamescopay_orders
  set status = 'completed',
      mpesa_receipt_number = p_mpesa_receipt_number,
      credited_at = now(),
      updated_at = now()
  where order_reference = p_order_reference;

  return query select true, new_balance;
end;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ============================================================================

alter table public.users enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.wallets enable row level security;
alter table public.transaction_history enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.kyc_submissions enable row level security;
alter table public.binary_trade_records enable row level security;
alter table public.nowpayments_orders enable row level security;
alter table public.makamescopay_orders enable row level security;
alter table public.manual_wallet_deposits enable row level security;

-- Drop prior loose policies
drop policy if exists "service_role_all_users" on public.users;
drop policy if exists "service_role_all_wallets" on public.wallets;
drop policy if exists "service_role_all_tx" on public.transaction_history;
drop policy if exists "service_role_all_wd" on public.withdrawal_requests;
drop policy if exists "service_role_all_kyc" on public.kyc_submissions;
drop policy if exists "service_role_all_trades" on public.binary_trade_records;

-- Grant Service Role Full Access
create policy "service_role_all_users" on public.users for all to service_role using (true) with check (true);
create policy "service_role_all_roles" on public.roles for all to service_role using (true) with check (true);
create policy "service_role_all_user_roles" on public.user_roles for all to service_role using (true) with check (true);
create policy "service_role_all_wallets" on public.wallets for all to service_role using (true) with check (true);
create policy "service_role_all_tx" on public.transaction_history for all to service_role using (true) with check (true);
create policy "service_role_all_wd" on public.withdrawal_requests for all to service_role using (true) with check (true);
create policy "service_role_all_kyc" on public.kyc_submissions for all to service_role using (true) with check (true);
create policy "service_role_all_trades" on public.binary_trade_records for all to service_role using (true) with check (true);
create policy "service_role_all_np" on public.nowpayments_orders for all to service_role using (true) with check (true);
create policy "service_role_all_mk" on public.makamescopay_orders for all to service_role using (true) with check (true);
create policy "service_role_all_manual" on public.manual_wallet_deposits for all to service_role using (true) with check (true);

-- Revoke direct balance mutating operations from anon and authenticated
revoke all on public.nowpayments_orders from anon, authenticated;
revoke all on public.makamescopay_orders from anon, authenticated;
revoke all on public.manual_wallet_deposits from anon, authenticated;

-- Grant execute on security definer functions to service_role
grant execute on function public.apply_wallet_adjustment_atomic(bigint, numeric, text, text, text, bigint, jsonb) to service_role;
grant execute on function public.request_withdrawal_atomic(bigint, numeric, text, text, text) to service_role;
grant execute on function public.review_withdrawal_atomic(bigint, text, bigint, text) to service_role;
grant execute on function public.execute_trade_atomic(text, text, text, text, text, numeric, numeric, integer, integer, numeric, boolean) to service_role;
grant execute on function public.settle_trade_atomic(text, text, numeric, integer, text, numeric, numeric, boolean) to service_role;
grant execute on function public.complete_nowpayments_order(text, text, numeric, text, text) to service_role;
grant execute on function public.complete_makamescopay_order(text, text, integer, text, text) to service_role;

