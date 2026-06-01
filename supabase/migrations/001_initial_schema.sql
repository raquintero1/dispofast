-- ============================================================
-- DISPOFAST - Schema inicial
-- ============================================================

create extension if not exists "uuid-ossp";

-- Sequences for auto-numbering
create sequence if not exists quote_number_seq start 1;
create sequence if not exists order_number_seq start 1;
create sequence if not exists invoice_number_seq start 1;
create sequence if not exists client_code_seq start 1;
create sequence if not exists product_code_seq start 1;

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text not null default 'vendedor' check (role in ('admin', 'vendedor', 'bodega')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- CLIENTS
-- ============================================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null default ('CLI-' || lpad(nextval('client_code_seq')::text, 5, '0')),
  name text not null,
  document_type text check (document_type in ('NIT', 'CC', 'CE', 'PASAPORTE')),
  document_number text,
  email text,
  phone text,
  address text,
  city text,
  country text default 'Colombia',
  credit_limit numeric(15,2) default 0,
  payment_days integer default 30,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table client_contacts (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade not null,
  name text not null,
  position text,
  email text,
  phone text,
  is_primary boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  parent_id uuid references categories(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null default ('PRD-' || lpad(nextval('product_code_seq')::text, 5, '0')),
  name text not null,
  description text,
  category_id uuid references categories(id),
  unit text not null default 'UND',
  cost_price numeric(15,2) not null default 0,
  sale_price numeric(15,2) not null default 0,
  tax_rate numeric(5,2) not null default 19,
  stock_quantity numeric(15,3) not null default 0,
  min_stock numeric(15,3) not null default 0,
  max_stock numeric(15,3),
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- STOCK MOVEMENTS
-- ============================================================
create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) not null,
  type text not null check (type in ('in', 'out', 'adjustment')),
  quantity numeric(15,3) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create or replace function apply_stock_movement()
returns trigger as $$
begin
  if new.type = 'in' then
    update products set stock_quantity = stock_quantity + new.quantity, updated_at = now()
    where id = new.product_id;
  elsif new.type = 'out' then
    update products set stock_quantity = stock_quantity - new.quantity, updated_at = now()
    where id = new.product_id;
  else
    update products set stock_quantity = new.quantity, updated_at = now()
    where id = new.product_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger after_stock_movement
  after insert on stock_movements
  for each row execute function apply_stock_movement();

-- ============================================================
-- QUOTES
-- ============================================================
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  number text unique not null default ('COT-' || lpad(nextval('quote_number_seq')::text, 5, '0')),
  client_id uuid references clients(id) not null,
  date date not null default current_date,
  valid_until date not null default (current_date + interval '30 days'),
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected', 'expired')),
  subtotal numeric(15,2) not null default 0,
  discount numeric(15,2) not null default 0,
  tax_total numeric(15,2) not null default 0,
  total numeric(15,2) not null default 0,
  notes text,
  terms text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quote_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid references quotes(id) on delete cascade not null,
  product_id uuid references products(id),
  description text not null,
  quantity numeric(15,3) not null default 1,
  unit_price numeric(15,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 19,
  total numeric(15,2) not null default 0,
  sort_order integer default 0
);

-- ============================================================
-- SALES ORDERS
-- ============================================================
create table sales_orders (
  id uuid primary key default uuid_generate_v4(),
  number text unique not null default ('PED-' || lpad(nextval('order_number_seq')::text, 5, '0')),
  quote_id uuid references quotes(id),
  client_id uuid references clients(id) not null,
  date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'delivered', 'cancelled')),
  subtotal numeric(15,2) not null default 0,
  discount numeric(15,2) not null default 0,
  tax_total numeric(15,2) not null default 0,
  total numeric(15,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales_order_items (
  id uuid primary key default uuid_generate_v4(),
  sales_order_id uuid references sales_orders(id) on delete cascade not null,
  product_id uuid references products(id),
  description text not null,
  quantity numeric(15,3) not null default 1,
  unit_price numeric(15,2) not null default 0,
  discount_pct numeric(5,2) not null default 0,
  tax_rate numeric(5,2) not null default 19,
  total numeric(15,2) not null default 0,
  sort_order integer default 0
);

-- ============================================================
-- INVOICES
-- ============================================================
create table invoices (
  id uuid primary key default uuid_generate_v4(),
  number text unique not null default ('FAC-' || lpad(nextval('invoice_number_seq')::text, 5, '0')),
  sales_order_id uuid references sales_orders(id),
  client_id uuid references clients(id) not null,
  date date not null default current_date,
  due_date date not null default (current_date + interval '30 days'),
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(15,2) not null default 0,
  tax_total numeric(15,2) not null default 0,
  total numeric(15,2) not null default 0,
  amount_paid numeric(15,2) not null default 0,
  balance numeric(15,2) not null default 0,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) not null,
  client_id uuid references clients(id) not null,
  date date not null default current_date,
  amount numeric(15,2) not null,
  method text not null check (method in ('cash', 'transfer', 'check', 'card')),
  reference text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create or replace function update_invoice_on_payment()
returns trigger as $$
declare
  v_total_paid numeric(15,2);
  v_invoice_total numeric(15,2);
  v_due_date date;
  v_new_status text;
begin
  select coalesce(sum(amount), 0) into v_total_paid
  from payments where invoice_id = new.invoice_id;

  select total, due_date into v_invoice_total, v_due_date
  from invoices where id = new.invoice_id;

  if v_total_paid >= v_invoice_total then
    v_new_status := 'paid';
  elsif v_total_paid > 0 then
    v_new_status := 'partial';
  elsif v_due_date < current_date then
    v_new_status := 'overdue';
  else
    v_new_status := 'pending';
  end if;

  update invoices
  set
    amount_paid = v_total_paid,
    balance = v_invoice_total - v_total_paid,
    status = v_new_status,
    updated_at = now()
  where id = new.invoice_id;

  return new;
end;
$$ language plpgsql;

create trigger after_payment_insert
  after insert on payments
  for each row execute function update_invoice_on_payment();

-- ============================================================
-- RLS POLICIES (all authenticated users have full access)
-- ============================================================
alter table profiles enable row level security;
create policy "profiles_select" on profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update" on profiles for update using (auth.uid() = id);

alter table clients enable row level security;
create policy "clients_all" on clients for all using (auth.role() = 'authenticated');

alter table client_contacts enable row level security;
create policy "client_contacts_all" on client_contacts for all using (auth.role() = 'authenticated');

alter table categories enable row level security;
create policy "categories_all" on categories for all using (auth.role() = 'authenticated');

alter table products enable row level security;
create policy "products_all" on products for all using (auth.role() = 'authenticated');

alter table stock_movements enable row level security;
create policy "stock_movements_all" on stock_movements for all using (auth.role() = 'authenticated');

alter table quotes enable row level security;
create policy "quotes_all" on quotes for all using (auth.role() = 'authenticated');

alter table quote_items enable row level security;
create policy "quote_items_all" on quote_items for all using (auth.role() = 'authenticated');

alter table sales_orders enable row level security;
create policy "sales_orders_all" on sales_orders for all using (auth.role() = 'authenticated');

alter table sales_order_items enable row level security;
create policy "sales_order_items_all" on sales_order_items for all using (auth.role() = 'authenticated');

alter table invoices enable row level security;
create policy "invoices_all" on invoices for all using (auth.role() = 'authenticated');

alter table payments enable row level security;
create policy "payments_all" on payments for all using (auth.role() = 'authenticated');

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_clients_status on clients(status);
create index idx_clients_name on clients(name);
create index idx_products_is_active on products(is_active);
create index idx_products_category on products(category_id);
create index idx_stock_movements_product on stock_movements(product_id);
create index idx_quotes_client on quotes(client_id);
create index idx_quotes_status on quotes(status);
create index idx_sales_orders_client on sales_orders(client_id);
create index idx_sales_orders_status on sales_orders(status);
create index idx_invoices_client on invoices(client_id);
create index idx_invoices_status on invoices(status);
create index idx_invoices_due_date on invoices(due_date);
create index idx_payments_invoice on payments(invoice_id);
