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
                          check (verification_tier in ('None','Licensed','Bronze','Silver','Gold')),
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
  is_official           boolean not null default false,
  created_at            timestamptz not null default now(),
  -- "Near Me" live map: seller's most recent GPS position, only populated
  -- once they opt in via location_sharing_enabled (prompted on login).
  latitude               double precision,
  longitude              double precision,
  location_sharing_enabled boolean not null default false,
  location_updated_at    timestamptz
);

-- Safe to re-run on an existing database.
alter table sellers add column if not exists plan_status text not null default 'pending';
alter table sellers add column if not exists approved_at timestamptz;
alter table sellers add column if not exists trial_ends_at timestamptz;
alter table sellers add column if not exists next_payment_due timestamptz;
alter table sellers add column if not exists latest_update text default '';
alter table sellers add column if not exists latest_update_at timestamptz;
alter table sellers add column if not exists is_official boolean not null default false;
-- "Near Me" live map (see column comments above for what each does).
alter table sellers add column if not exists latitude double precision;
alter table sellers add column if not exists longitude double precision;
alter table sellers add column if not exists location_sharing_enabled boolean not null default false;
alter table sellers add column if not exists location_updated_at timestamptz;

-- Safe to re-run: widens the verification_tier check constraint to allow the
-- new 'Licensed' value (a plain "verified business" badge, distinct from the
-- Bronze/Silver/Gold medal tiers). Existing databases created before this
-- had a narrower constraint that would reject 'Licensed' without this.
alter table sellers drop constraint if exists sellers_verification_tier_check;
alter table sellers add constraint sellers_verification_tier_check
  check (verification_tier in ('None','Licensed','Bronze','Silver','Gold'));

create index if not exists idx_sellers_location on sellers(location);
create index if not exists idx_sellers_category on sellers(category);
create index if not exists idx_sellers_is_approved on sellers(is_approved);
-- Speeds up GET /api/sellers/nearby, which filters to approved +
-- location-sharing-enabled sellers with real coordinates.
create index if not exists idx_sellers_location_lookup
  on sellers (is_approved, location_sharing_enabled)
  where latitude is not null and longitude is not null;

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
  -- Manual admin-controlled display order within the (pinned / regular)
  -- group, set by dragging rows in the admin "Revisions & Products" tab.
  -- Lower numbers show first; ties fall back to created_at desc.
  sort_order    integer not null default 0,
  seller_id     text not null references sellers(id) on delete cascade,
  created_at    timestamptz not null default now()
);

-- Safe to re-run on an existing database: adds the column if this schema
-- was applied before is_published existed. Defaults to true so existing
-- live listings stay visible after the upgrade.
alter table products add column if not exists is_published boolean not null default true;

-- Safe to re-run: adds the drag-reorder column to an existing database.
alter table products add column if not exists sort_order integer not null default 0;

create index if not exists idx_products_seller_id on products(seller_id);
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_created_at on products(created_at desc);
create index if not exists idx_products_is_published on products(is_published);
create index if not exists idx_products_sort_order on products(sort_order);

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
-- ---------------------------------------------------------------------------
-- delivery_requests — a seller posts a delivery job (usually to get an
-- order to a customer); any approved Services&Runners seller can browse
-- open jobs and accept one, then move it through pickup -> delivery.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- categories — admin-editable, orderable list of marketplace categories.
-- Sellers/products still store `category` as free text (matching one of
-- these names) rather than a foreign key, to avoid a bigger migration —
-- this table is purely the admin-managed source of truth for the list
-- itself (name, display color, sort order).
-- ---------------------------------------------------------------------------
create table if not exists categories (
  id          text primary key,
  name        text not null unique,
  color       text not null default '#6366f1',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_categories_sort_order on categories(sort_order);

insert into categories (id, name, color, sort_order) values
  ('cat_food_tamu',      'Food & Tamu',                      '#f59e0b', 0),
  ('cat_art_crafts',     'Art & Crafts',                     '#ec4899', 1),
  ('cat_bundle_fashion', 'Bundle & Fashion',                 '#a855f7', 2),
  ('cat_gadgets',        'Gadgets & Electronic',              '#3b82f6', 3),
  ('cat_home_living',    'Home & Living',                    '#22c55e', 4),
  ('cat_transport',      'Transport & Runners',              '#14b8a6', 5),
  ('cat_prof_services',  'Professional Services & Freelance', '#6366f1', 6),
  ('cat_others',         'Others',                           '#64748b', 7)
on conflict (name) do nothing;

-- Migrate existing free-text category values on sellers/products to the
-- renamed/merged category names above (old "Cars&Bikes" and
-- "Services&Runners" both fold into the new "Transport & Runners").
update sellers set category = 'Food & Tamu' where category = 'Food&Tamu';
update sellers set category = 'Bundle & Fashion' where category = 'Bundle&Fashion';
update sellers set category = 'Gadgets & Electronic' where category = 'Gadgets&Electronics';
update sellers set category = 'Home & Living' where category = 'Homes&Living';
update sellers set category = 'Transport & Runners' where category in ('Cars&Bikes', 'Services&Runners');

update products set category = 'Food & Tamu' where category = 'Food&Tamu';
update products set category = 'Bundle & Fashion' where category = 'Bundle&Fashion';
update products set category = 'Gadgets & Electronic' where category = 'Gadgets&Electronics';
update products set category = 'Home & Living' where category = 'Homes&Living';
update products set category = 'Transport & Runners' where category in ('Cars&Bikes', 'Services&Runners');

create table if not exists delivery_requests (
  id                text primary key,
  seller_id         text not null references sellers(id) on delete cascade,
  runner_id         text references sellers(id) on delete set null,
  product_id        text references products(id) on delete set null,
  product_title     text not null,
  pickup_location   text not null,
  pickup_address    text not null,
  dropoff_location  text not null,
  dropoff_address   text not null,
  customer_name     text,
  customer_phone    text not null,
  delivery_fee      numeric(10,2) not null default 0,
  notes             text default '',
  status            text not null default 'open' check (status in ('open','accepted','picked_up','in_transit','delivered','cancelled')),
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  picked_up_at      timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz
);

create index if not exists idx_delivery_requests_status on delivery_requests(status);
create index if not exists idx_delivery_requests_runner on delivery_requests(runner_id);
create index if not exists idx_delivery_requests_seller on delivery_requests(seller_id);
create index if not exists idx_delivery_requests_pickup on delivery_requests(pickup_location);
create index if not exists idx_delivery_requests_created_at on delivery_requests(created_at desc);

create table if not exists stories (
  id           text primary key,
  seller_id    text not null references sellers(id) on delete cascade,
  media_url    text not null,
  media_type   text not null check (media_type in ('image', 'video')),
  caption      text default '',
  like_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);

create index if not exists idx_stories_seller_id on stories(seller_id);
create index if not exists idx_stories_expires_at on stories(expires_at);

-- story_views — one row per (story, viewer) so the seller sees a genuine
-- unique-viewer count rather than a raw play-count.
create table if not exists story_views (
  story_id    text not null references stories(id) on delete cascade,
  viewer_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists idx_story_views_story_id on story_views(story_id);

-- ---------------------------------------------------------------------------
-- community forum — Reddit-style discussion space for registered/approved
-- sellers to discuss business, exchange ideas, and share stories.
-- ---------------------------------------------------------------------------
create table if not exists community_topics (
  id           text primary key,
  seller_id    text not null references sellers(id) on delete cascade,
  title        text not null,
  body         text not null,
  category     text not null default 'General Discussion',
  created_at   timestamptz not null default now()
);

create table if not exists community_replies (
  id           text primary key,
  topic_id     text not null references community_topics(id) on delete cascade,
  seller_id    text not null references sellers(id) on delete cascade,
  body         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists community_votes (
  topic_id     text not null references community_topics(id) on delete cascade,
  seller_id    text not null references sellers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (topic_id, seller_id)
);

create index if not exists idx_community_topics_seller_id on community_topics(seller_id);
create index if not exists idx_community_topics_created_at on community_topics(created_at desc);
create index if not exists idx_community_replies_topic_id on community_replies(topic_id);
create index if not exists idx_community_votes_topic_id on community_votes(topic_id);

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
-- analytics_events — raw event log (site visits + WhatsApp contact clicks)
-- powering the Admin "Live Marketing Analytics" chart.
-- ---------------------------------------------------------------------------
create table if not exists analytics_events (
  id          text primary key,
  event_type  text not null check (event_type in ('visit', 'contact_click')),
  seller_id   text references sellers(id) on delete set null,
  location    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_analytics_events_created_at on analytics_events(created_at desc);
create index if not exists idx_analytics_events_seller_id on analytics_events(seller_id);

-- ---------------------------------------------------------------------------
-- bossku_queries — every message sent to the "Bossku" AI assistant widget on
-- the Home page, plus what it understood/matched, powering the Admin
-- "Bossku AI" analytics tab (what visitors are actually searching for).
-- ---------------------------------------------------------------------------
create table if not exists bossku_queries (
  id                text primary key,
  session_id        text not null,
  message            text not null,
  language           text not null default 'EN' check (language in ('EN', 'BM')),
  detected_category  text,
  detected_location  text,
  keywords           text[] not null default '{}',
  result_count       integer not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_bossku_queries_created_at on bossku_queries(created_at desc);
create index if not exists idx_bossku_queries_session_id on bossku_queries(session_id);

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
alter table story_views     enable row level security;
alter table categories       enable row level security;
alter table delivery_requests enable row level security;
alter table community_topics  enable row level security;
alter table community_replies enable row level security;
alter table community_votes   enable row level security;
alter table analytics_events  enable row level security;
alter table bossku_queries    enable row level security;
