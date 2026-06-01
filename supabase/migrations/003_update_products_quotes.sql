-- Migration 003: Price lists for products + extended quote fields

-- Add 5 price lists to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_distributor numeric(15,2) default 0,
  ADD COLUMN IF NOT EXISTS price_drogueria   numeric(15,2) default 0,
  ADD COLUMN IF NOT EXISTS price_entidad     numeric(15,2) default 0,
  ADD COLUMN IF NOT EXISTS price_veterinaria numeric(15,2) default 0,
  ADD COLUMN IF NOT EXISTS price_ecommerce   numeric(15,2) default 0;

-- Add new fields to quotes
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS prospect_data       jsonb,
  ADD COLUMN IF NOT EXISTS client_classification text,
  ADD COLUMN IF NOT EXISTS payment_conditions  text default 'contado',
  ADD COLUMN IF NOT EXISTS offer_validity      integer default 30,
  ADD COLUMN IF NOT EXISTS other_discount      numeric(5,2) default 0,
  ADD COLUMN IF NOT EXISTS retefuente_amount   numeric(15,2) default 0,
  ADD COLUMN IF NOT EXISTS rete_ica            numeric(5,2) default 0,
  ADD COLUMN IF NOT EXISTS flete               numeric(15,2) default 0;
