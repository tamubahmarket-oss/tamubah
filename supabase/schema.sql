-- ============================================================================
-- TamuBah — Supabase schema
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
--
-- Design notes:
-- - The Express server is the ONLY thing that talks to Supabase, using the
--   SERVICE ROLE key (server-side only, never shipped to the browser).
--   The React frontend keeps calling your existing /api/* routes exactly
--   as before — no frontend data-fetching code needs to change.
-- - RLS is enabled on every table with NO policies, so even if the anon/public
--   key ever leaked, it could read or write nothing. Only the service role
--   (which bypasses RLS) can touch these tables.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- sellers
-- ---------------------------------------------------------------------------
create table if not exists sellers (
  id                    text primary key,
  owner_name            text not null,
  email                 text not null unique,
  business_name         text not null unique,
  category              text not null,
  ssm_number            text default '',
  address               text not null,
  phone_number          text not null,
  location              text not null,
  password_hash         text not null, -- bcrypt hash
  logo_url              text,
  established_year      text,
  dream                 text,
  is_verified           boolean not null default false,
  is_approved           boolean not null default false,
  verification_tier     text not null default 'None'
                          check (verification_tier in ('None','Bronze','Silver','Gold')),
  show_phone_publicly   boolean not null default true,
  contact_count         integer not null default 0,
  -- Plan tracking for the community-empowerment rollout: the first 100
  -- approved sellers are lifetime-free "founding" sellers; everyone after
  -- gets a 1-month free trial, then is expected to pay RM20/month.
  -- Payment itself is handled manually (e.g. bank transfer), so 'paid' /
  -- 'expired' are set by an admin — 'founding' / 'trial' are assigned
  -- automatically the first time a seller is approved.
  plan_status           text not null default 'pending'
                          check (plan_status in ('pending','founding','trial','paid','expired')),
  approved_at           timestamptz,
  trial_ends_at         timestamptz,
  next_payment_due      timestamptz,
  -- Lightweight "what's fresh today" status sellers can post any time
  -- (e.g. "Fresh kuih ready today!") — shown on their storefront card
  -- while recent, without needing a full product listing.
  latest_update         text default '',
  latest_update_at      timestamptz,
  created_at            timestamptz not null default now()
);

-- Safe to re-run on an existing database.
alter table sellers add column if not exists plan_status text not null default 'pending';
alter table sellers add column if not exists approved_at timestamptz;
alter table sellers add column if not exists trial_ends_at timestamptz;
alter table sellers add column if not exists next_payment_due timestamptz;
alter table sellers add column if not exists latest_update text default '';
alter table sellers add column if not exists latest_update_at timestamptz;

create index if not exists idx_sellers_location on sellers(location);
create index if not exists idx_sellers_category on sellers(category);
create index if not exists idx_sellers_is_approved on sellers(is_approved);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id            text primary key,
  title         text not null,
  category      text not null,
  description   text not null,
  price         numeric not null,
  image_url     text not null,
  is_available  boolean not null default true,
  is_pinned     boolean not null default false,
  -- Whether this listing is actually shown in the public market. Each seller
  -- may only have ONE published product at a time; every other product they
  -- create just sits in their private shop dashboard until they either
  -- unpublish their current live product, or an admin grants an exception
  -- via the publish_requests table below.
  is_published  boolean not null default true,
  seller_id     text not null references sellers(id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- Safe to re-run on an existing database: adds the column if this schema
-- was applied before is_published existed. Defaults to true so existing
-- live listings stay visible after the upgrade.
alter table products add column if not exists is_published boolean not null default true;

create index if not exists idx_products_seller_id on products(seller_id);
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_created_at on products(created_at desc);
create index if not exists idx_products_is_published on products(is_published);

-- ---------------------------------------------------------------------------
-- publish_requests — a seller who already has 1 published product but wants
-- to publish another must ask an admin for permission. Each row is one
-- seller's request to publish one specific product.
-- ---------------------------------------------------------------------------
create table if not exists publish_requests (
  id            text primary key,
  seller_id     text not null references sellers(id) on delete cascade,
  product_id    text not null references products(id) on delete cascade,
  message       text default '',
  admin_note    text default '',
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index if not exists idx_publish_requests_seller_id on publish_requests(seller_id);
create index if not exists idx_publish_requests_status on publish_requests(status);

-- ---------------------------------------------------------------------------
-- receipts — sellers can generate a receipt/invoice for a customer order and
-- share the link (e.g. via WhatsApp). Each receipt's id doubles as its
-- human-readable receipt number and public share token.
-- ---------------------------------------------------------------------------
create table if not exists receipts (
  id              text primary key, -- also the shareable receipt number, e.g. TB-240729-4F2K
  seller_id       text not null references sellers(id) on delete cascade,
  customer_name   text default '',
  customer_phone  text default '',
  -- items: [{ title, unitPrice, quantity, type: 'product'|'service', productId? }]
  items           jsonb not null default '[]',
  delivery_fee    numeric not null default 0,
  subtotal        numeric not null default 0,
  total           numeric not null default 0,
  notes           text default '',
  created_at      timestamptz not null default now()
);

create index if not exists idx_receipts_seller_id on receipts(seller_id);
create index if not exists idx_receipts_created_at on receipts(created_at desc);

-- ---------------------------------------------------------------------------
-- stories — Instagram/WhatsApp-style ephemeral photo/video posts. Each story
-- auto-expires 24 hours after posting (filtered out in queries, not deleted
-- immediately — a cleanup job prunes old rows periodically).
-- ---------------------------------------------------------------------------
create table if not exists stories (
  id           text primary key,
  seller_id    text not null references sellers(id) on delete cascade,
  media_url    text not null,
  media_type   text not null check (media_type in ('image', 'video')),
  caption      text default '',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists idx_stories_seller_id on stories(seller_id);
create index if not exists idx_stories_expires_at on stories(expires_at);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table if not exists reviews (
  id             text primary key,
  seller_id      text not null references sellers(id) on delete cascade,
  rating         integer not null check (rating between 1 and 5),
  comment        text default '',
  reviewer_name  text not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_reviews_seller_id on reviews(seller_id);

-- ---------------------------------------------------------------------------
-- reports (seller/product reports from users)
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id              text primary key,
  seller_id       text not null references sellers(id) on delete cascade,
  product_id      text,
  reason          text not null,
  description     text not null,
  reporter_email  text not null,
  status          text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at      timestamptz not null default now()
);

create index if not exists idx_reports_seller_id on reports(seller_id);
create index if not exists idx_reports_status on reports(status);

-- ---------------------------------------------------------------------------
-- admin_users — replaces the single shared ADMIN_PASSCODE env var.
-- You can now have multiple named admin accounts, each with their own
-- passcode, added/removed/rotated from inside the Admin Panel.
-- ---------------------------------------------------------------------------
create table if not exists admin_users (
  id             text primary key,
  username       text not null unique,
  passcode_hash  text not null, -- bcrypt hash
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- admin_sessions — moved out of in-memory Map so sessions survive restarts
-- and work correctly even if you ever run more than one server instance.
-- ---------------------------------------------------------------------------
create table if not exists admin_sessions (
  token       text primary key,
  admin_id    text not null references admin_users(id) on delete cascade,
  expires_at  timestamptz not null
);

create index if not exists idx_admin_sessions_expires_at on admin_sessions(expires_at);

-- ---------------------------------------------------------------------------
-- admin_logs — activity feed shown in the Admin Panel "Logs" tab
-- ---------------------------------------------------------------------------
create table if not exists admin_logs (
  id          text primary key,
  action      text not null,
  details     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_logs_created_at on admin_logs(created_at desc);

-- ---------------------------------------------------------------------------
-- app_stats — single-row counters (visitors, logins, registrations, contacts)
-- ---------------------------------------------------------------------------
create table if not exists app_stats (
  id                       integer primary key default 1,
  visitor_count            integer not null default 0,
  login_success_count      integer not null default 0,
  register_success_count   integer not null default 0,
  contact_seller_count     integer not null default 0,
  constraint app_stats_singleton check (id = 1)
);

insert into app_stats (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Lock everything down: enable RLS, add zero policies.
-- The server always connects with the service role key, which bypasses RLS,
-- so these tables stay fully usable by your API while being unreachable by
-- the public anon key.
-- ---------------------------------------------------------------------------
alter table sellers         enable row level security;
alter table products        enable row level security;
alter table reviews         enable row level security;
alter table reports         enable row level security;
alter table admin_users     enable row level security;
alter table admin_sessions  enable row level security;
alter table admin_logs      enable row level security;
alter table app_stats       enable row level security;
alter table publish_requests enable row level security;
alter table receipts        enable row level security;
alter table stories         enable row level security;
