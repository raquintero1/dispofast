export type UserRole = 'admin' | 'vendedor' | 'bodega'
export type DocumentType = 'NIT' | 'CC' | 'CE' | 'PASAPORTE'
export type ClientStatus = 'active' | 'inactive'
export type ClientType = 'empresa' | 'persona_natural'
export type CommercialDiscount = 'no_aplica' | '1' | '2' | '3'
export type ClientClassification =
  | 'distribuidor_drogueria' | 'distribuidor_clinica_hospital' | 'distribuidor_veterinaria'
  | 'drogueria' | 'veterinaria' | 'casa_citas' | 'clinica' | 'eps' | 'ips'
  | 'estanco' | 'industria' | 'motel' | 'tienda_medica' | 'whatsapp'
export type StockMovementType = 'in' | 'out' | 'adjustment'
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'
export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled'
export type InvoiceStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'card'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  email: string | null
  created_at: string
}

export interface Client {
  id: string
  code: string
  name: string
  client_type: ClientType
  document_type: DocumentType | null
  document_number: string | null
  retefuente: boolean
  legal_rep_name: string | null
  legal_rep_cedula: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  country: string | null
  advisor_name: string | null
  commercial_discount: CommercialDiscount
  classification: ClientClassification | null
  credit_limit: number
  payment_days: number
  status: ClientStatus
  notes: string | null
  rut_url: string | null
  camara_comercio_url: string | null
  cedula_rep_legal_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ClientContact {
  id: string
  client_id: string
  name: string
  position: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  created_at: string
}

export interface Product {
  id: string
  code: string
  name: string
  description: string | null
  product_category: string | null
  category_id: string | null
  sku: string | null
  brand: string | null
  image_url: string | null
  unit: string
  cost_price: number
  sale_price: number
  price_distributor: number
  price_drogueria: number
  price_entidad: number
  price_veterinaria: number
  price_ecommerce: number
  tax_rate: number
  stock_quantity: number
  min_stock: number
  max_stock: number | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  categories?: Category
}

export interface StockMovement {
  id: string
  product_id: string
  type: StockMovementType
  quantity: number
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  products?: Product
}

export interface Quote {
  id: string
  number: string
  client_id: string
  date: string
  valid_until: string
  status: QuoteStatus
  subtotal: number
  discount: number
  tax_total: number
  total: number
  notes: string | null
  terms: string | null
  prospect_data: Record<string, string> | null
  client_classification: string | null
  payment_conditions: string | null
  offer_validity: number | null
  other_discount: number
  retefuente_amount: number
  rete_ica: number
  flete: number
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: Client
  quote_items?: QuoteItem[]
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount_pct: number
  tax_rate: number
  total: number
  sort_order: number
  products?: Product
}

export interface SalesOrder {
  id: string
  number: string
  quote_id: string | null
  client_id: string
  date: string
  status: OrderStatus
  subtotal: number
  discount: number
  tax_total: number
  total: number
  notes: string | null
  delivery_city: string | null
  delivery_address: string | null
  payment_conditions: string | null
  other_discount: number
  retefuente_amount: number
  rete_ica: number
  flete: number
  invoice_number: string | null
  invoice_date: string | null
  invoice_url: string | null
  advisor_name: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: Client
  sales_order_items?: SalesOrderItem[]
}

export interface SalesOrderItem {
  id: string
  sales_order_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount_pct: number
  tax_rate: number
  total: number
  sort_order: number
  products?: Product
}

export interface Invoice {
  id: string
  number: string
  sales_order_id: string | null
  client_id: string
  date: string
  due_date: string
  status: InvoiceStatus
  subtotal: number
  tax_total: number
  total: number
  amount_paid: number
  balance: number
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  clients?: Client
  payments?: Payment[]
}

export interface Payment {
  id: string
  invoice_id: string
  client_id: string
  date: string
  amount: number
  method: PaymentMethod
  reference: string | null
  notes: string | null
  payment_proof_url: string | null
  created_by: string | null
  created_at: string
  invoices?: Invoice
  clients?: Client
}
