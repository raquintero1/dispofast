-- Migration 002: Update clients table with new fields

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS client_type text not null default 'empresa' check (client_type in ('empresa', 'persona_natural')),
  ADD COLUMN IF NOT EXISTS retefuente boolean not null default false,
  ADD COLUMN IF NOT EXISTS legal_rep_name text,
  ADD COLUMN IF NOT EXISTS legal_rep_cedula text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS advisor_name text,
  ADD COLUMN IF NOT EXISTS commercial_discount text not null default 'no_aplica' check (commercial_discount in ('no_aplica', '1', '2', '3')),
  ADD COLUMN IF NOT EXISTS classification text,
  ADD COLUMN IF NOT EXISTS rut_url text,
  ADD COLUMN IF NOT EXISTS camara_comercio_url text,
  ADD COLUMN IF NOT EXISTS cedula_rep_legal_url text;

-- Storage bucket for client documents (run this in Supabase dashboard > Storage)
-- bucket name: client-documents, public: true
