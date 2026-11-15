-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.roles (
  id bigint NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
  name text NOT NULL UNIQUE CHECK (name = ANY (ARRAY['client'::text, 'admin'::text, 'super_admin'::text])),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  account_status text NOT NULL DEFAULT 'active'::text CHECK (account_status = ANY (ARRAY['active'::text, 'suspended'::text, 'pending'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_roles (
  user_id bigint NOT NULL,
  role_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);
CREATE TABLE public.wallets (
  user_id bigint NOT NULL,
  current_balance numeric NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'KES'::text,
  total_deposits numeric NOT NULL DEFAULT 0,
  total_withdrawals numeric NOT NULL DEFAULT 0,
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wallets_pkey PRIMARY KEY (user_id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.transaction_history (
  id bigint NOT NULL DEFAULT nextval('transaction_history_id_seq'::regclass),
  user_id bigint NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type = ANY (ARRAY['deposit'::text, 'withdrawal'::text, 'trade'::text, 'adjustment'::text, 'mpesa_deposit'::text])),
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KES'::text,
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'rejected'::text])),
  payment_reference text UNIQUE,
  description text,
  metadata_json jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transaction_history_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.password_reset_tokens (
  id bigint NOT NULL DEFAULT nextval('password_reset_tokens_id_seq'::regclass),
  user_id bigint NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.mpesa_deposits (
  id bigint NOT NULL DEFAULT nextval('mpesa_deposits_id_seq'::regclass),
  user_id bigint NOT NULL,
  payment_reference text NOT NULL UNIQUE,
  phone_number text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])),
  transaction_history_id bigint,
  provider_receipt text,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT mpesa_deposits_pkey PRIMARY KEY (id),
  CONSTRAINT mpesa_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT mpesa_deposits_transaction_history_id_fkey FOREIGN KEY (transaction_history_id) REFERENCES public.transaction_history(id)
);
CREATE TABLE public.nowpayments_orders (
  order_id text NOT NULL,
  user_id text NOT NULL,
  amount_usd numeric NOT NULL CHECK (amount_usd >= 3::numeric),
  invoice_id text UNIQUE,
  invoice_url text,
  payment_id text,
  payment_status text NOT NULL DEFAULT 'creating'::text,
  credited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pay_address text,
  pay_amount numeric,
  pay_currency text,
  payin_extra_id text,
  payin_extra_id_name text,
  CONSTRAINT nowpayments_orders_pkey PRIMARY KEY (order_id)
);
CREATE TABLE public.manual_wallet_deposits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  reference text NOT NULL UNIQUE,
  note text,
  credited_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT manual_wallet_deposits_pkey PRIMARY KEY (id)
);
CREATE TABLE public.binary_trade_records (
  user_id text NOT NULL,
  trade_id text NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  symbol text NOT NULL,
  market_name text NOT NULL,
  contract_type text NOT NULL,
  direction text NOT NULL,
  stake numeric NOT NULL CHECK (stake > 0::numeric),
  entry_price numeric NOT NULL,
  entry_digit integer NOT NULL,
  expiry_at timestamp with time zone NOT NULL,
  expiry_seconds integer NOT NULL,
  payout_multiplier numeric NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['open'::text, 'won'::text, 'lost'::text, 'break_even'::text, 'closed'::text])),
  result text CHECK (result IS NULL OR (result = ANY (ARRAY['won'::text, 'lost'::text, 'break_even'::text, 'draw'::text]))),
  exit_price numeric,
  exit_digit integer,
  payout numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL,
  settled_at timestamp with time zone,
  stop_loss numeric,
  take_profit numeric,
  closure_reason text,
  closed_by text,
  CONSTRAINT binary_trade_records_pkey PRIMARY KEY (user_id, trade_id)
);
CREATE TABLE public.makamescopay_orders (
  order_reference text NOT NULL,
  user_id text NOT NULL,
  amount_usd numeric NOT NULL CHECK (amount_usd >= 1::numeric),
  amount_kes integer NOT NULL CHECK (amount_kes >= 1),
  phone_number text NOT NULL,
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  mpesa_receipt_number text,
  status text NOT NULL DEFAULT 'initiating'::text CHECK (status = ANY (ARRAY['initiating'::text, 'pending'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'review'::text])),
  credited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT makamescopay_orders_pkey PRIMARY KEY (order_reference)
);
CREATE TABLE public.demo_wallets (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL UNIQUE,
  current_balance numeric NOT NULL DEFAULT 10000.00 CHECK (current_balance >= 0::numeric),
  currency text NOT NULL DEFAULT 'USD'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT demo_wallets_pkey PRIMARY KEY (id),
  CONSTRAINT demo_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.withdrawal_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  currency text NOT NULL DEFAULT 'USD'::text,
  payment_method text NOT NULL,
  destination_details text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  admin_note text,
  reviewed_by bigint,
  reviewed_at timestamp with time zone,
  transaction_history_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id),
  CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT withdrawal_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id),
  CONSTRAINT withdrawal_requests_transaction_history_id_fkey FOREIGN KEY (transaction_history_id) REFERENCES public.transaction_history(id)
);
CREATE TABLE public.kyc_submissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id bigint NOT NULL,
  full_name text,
  dob date,
  doc_number text,
  document_type text NOT NULL DEFAULT 'national_id'::text,
  document_front_url text NOT NULL,
  document_back_url text,
  selfie_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  rejection_reason text,
  reviewed_by bigint,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kyc_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT kyc_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT kyc_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id)
);