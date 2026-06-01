'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, Payment, SalesOrderItem, Client } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProfile } from '@/hooks/useProfile'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  MoreHorizontal, Receipt, DollarSign, Clock, AlertTriangle,
  Search, Upload, FileText, CheckCircle2, Phone, Mail, MapPin,
} from 'lucide-react'
import { formatCurrency, formatDate, today, isOverdue } from '@/lib/utils/format'
import { toast } from 'sonner'

interface InvoiceRow extends Invoice {
  clients: Client
  sales_orders: { number: string; date: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',    className: 'bg-amber-100 text-amber-800 border-amber-200' },
  partial:   { label: 'Pago parcial', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  paid:      { label: 'Pagada',       className: 'bg-green-100 text-green-800 border-green-200' },
  overdue:   { label: 'Vencida',      className: 'bg-red-100 text-red-800 border-red-200' },
  cancelled: { label: 'Cancelada',    className: 'bg-gray-100 text-gray-600 border-gray-200' },
}

const EMPTY_RECEIPT = {
  document_number: '', payment_date: today(),
  amount: '', method: 'transfer', observations: '',
}

export default function PortfolioPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { isAdmin, userId, loading: profileLoading } = useProfile()

  // Receipt dialog
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null)
  const [orderItems, setOrderItems] = useState<SalesOrderItem[]>([])
  const [prevPayments, setPrevPayments] = useState<Payment[]>([])
  const [receiptForm, setReceiptForm] = useState(EMPTY_RECEIPT)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const supabase = createClient()
    let q = supabase.from('invoices').select('*, clients(*), sales_orders(number, date)').order('created_at', { ascending: false })
    if (!isAdmin && userId) q = q.eq('created_by', userId)
    const { data } = await q
    setInvoices((data ?? []) as InvoiceRow[])
    setLoading(false)
  }

  useEffect(() => { if (!profileLoading) load() }, [profileLoading, isAdmin, userId])

  async function openReceipt(invoice: InvoiceRow) {
    setSelectedInvoice(invoice)
    setReceiptForm({ ...EMPTY_RECEIPT, amount: invoice.balance.toString() })
    setProofFile(null)
    const supabase = createClient()
    const [itemsRes, paymentsRes] = await Promise.all([
      invoice.sales_order_id
        ? supabase.from('sales_order_items').select('*, products(name, unit, code)').eq('sales_order_id', invoice.sales_order_id).order('sort_order')
        : Promise.resolve({ data: [] }),
      supabase.from('payments').select('*').eq('invoice_id', invoice.id).order('date', { ascending: false }),
    ])
    setOrderItems((itemsRes.data ?? []) as SalesOrderItem[])
    setPrevPayments((paymentsRes.data ?? []) as Payment[])
    setReceiptOpen(true)
  }

  async function handleConfirmPayment() {
    if (!selectedInvoice) return
    const amount = parseFloat(receiptForm.amount)
    if (!amount || amount <= 0) { toast.error('Ingresa un valor válido'); return }
    if (amount > selectedInvoice.balance) {
      toast.error(`El valor no puede superar el saldo (${formatCurrency(selectedInvoice.balance)})`)
      return
    }
    setConfirming(true)
    const supabase = createClient()

    // Upload proof if provided
    let proofUrl: string | null = null
    if (proofFile) {
      const ext = proofFile.name.split('.').pop()
      const path = `${selectedInvoice.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, proofFile)
      if (!upErr) {
        proofUrl = supabase.storage.from('payment-proofs').getPublicUrl(path).data.publicUrl
      }
    }

    const { error } = await supabase.from('payments').insert({
      invoice_id: selectedInvoice.id,
      client_id: selectedInvoice.client_id,
      date: receiptForm.payment_date,
      amount,
      method: receiptForm.method as 'cash' | 'transfer',
      reference: receiptForm.document_number || null,
      notes: receiptForm.observations || null,
      payment_proof_url: proofUrl,
    })

    if (error) { toast.error('Error al registrar el pago'); setConfirming(false); return }

    toast.success('Pago confirmado exitosamente')
    setReceiptOpen(false)
    load()
    setConfirming(false)
  }

  // Summary stats
  const active = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  const totalPendiente = active.reduce((s, i) => s + i.balance, 0)
  const vencidas = active.filter(i => isOverdue(i.due_date))
  const totalVencido = vencidas.reduce((s, i) => s + i.balance, 0)

  const filtered = invoices.filter(inv => {
    const matchSearch =
      inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (inv.sales_orders?.number ?? '').toLowerCase().includes(search.toLowerCase())
    if (statusFilter === 'active') return matchSearch && inv.status !== 'paid' && inv.status !== 'cancelled'
    if (statusFilter === 'paid') return matchSearch && inv.status === 'paid'
    if (statusFilter === 'overdue') return matchSearch && isOverdue(inv.due_date) && inv.status !== 'paid'
    return matchSearch
  })

  const ri = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setReceiptForm(p => ({ ...p, [key]: e.target.value }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Cartera</h1>
        <p className="text-sm text-muted-foreground">Cuentas por cobrar</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="flex items-center gap-4 pt-5">
          <div className="p-3 rounded-lg bg-blue-50"><DollarSign className="w-5 h-5 text-blue-600" /></div>
          <div><p className="text-sm text-muted-foreground">Total pendiente</p><p className="text-xl font-bold">{formatCurrency(totalPendiente)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 pt-5">
          <div className="p-3 rounded-lg bg-red-50"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
          <div><p className="text-sm text-muted-foreground">Total vencido</p><p className="text-xl font-bold text-red-600">{formatCurrency(totalVencido)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 pt-5">
          <div className="p-3 rounded-lg bg-amber-50"><Clock className="w-5 h-5 text-amber-600" /></div>
          <div><p className="text-sm text-muted-foreground">Facturas vencidas</p><p className="text-xl font-bold text-amber-600">{vencidas.length}</p></div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <div className="p-4 border-b flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por cliente u orden..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'active')}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Solo pendientes</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="paid">Solo pagadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>N° Orden</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No se encontraron registros</TableCell></TableRow>
            ) : filtered.map(inv => {
              const overdue = isOverdue(inv.due_date) && inv.status !== 'paid'
              const cfg = STATUS_CONFIG[overdue && inv.status !== 'paid' ? 'overdue' : inv.status] ?? STATUS_CONFIG.pending
              return (
                <TableRow key={inv.id} className={overdue ? 'bg-red-50/40' : ''}>
                  <TableCell>
                    <p className="font-medium">{inv.clients?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{inv.clients?.city ?? ''}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs font-medium">{inv.sales_orders?.number ?? '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{inv.number}</p>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                  <TableCell className={`text-sm ${overdue ? 'text-red-600 font-medium' : ''}`}>
                    {formatDate(inv.due_date)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(inv.total)}</TableCell>
                  <TableCell className="text-right font-bold">
                    {inv.status === 'paid' ? (
                      <span className="text-green-600">{formatCurrency(0)}</span>
                    ) : formatCurrency(inv.balance)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${cfg.className} hover:${cfg.className}`}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors outline-none">
                        <MoreHorizontal className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <DropdownMenuItem onClick={() => openReceipt(inv)} className="gap-2">
                            <Receipt className="w-4 h-4" /> Generar recibo de caja
                          </DropdownMenuItem>
                        )}
                        {inv.status === 'paid' && (
                          <DropdownMenuItem disabled className="text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Pagada
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Generar recibo de caja — {selectedInvoice?.sales_orders?.number ?? selectedInvoice?.number}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="grid grid-cols-2 gap-6 pt-1">
              {/* LEFT: Client info + order detail */}
              <div className="space-y-4">
                {/* Client card */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</p>
                  <p className="font-bold text-base">{selectedInvoice.clients?.name}</p>
                  <div className="space-y-1 text-sm">
                    {selectedInvoice.clients?.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />{selectedInvoice.clients.phone}
                      </div>
                    )}
                    {selectedInvoice.clients?.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />{selectedInvoice.clients.email}
                      </div>
                    )}
                    {selectedInvoice.clients?.city && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5" />{selectedInvoice.clients.city}, {selectedInvoice.clients.department}
                      </div>
                    )}
                  </div>
                </div>

                {/* Order detail */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Detalle de la orden
                  </p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Producto</TableHead>
                          <TableHead className="text-xs w-16 text-right">Cant.</TableHead>
                          <TableHead className="text-xs w-28 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground">Sin detalle</TableCell></TableRow>
                        ) : orderItems.map(it => (
                          <TableRow key={it.id}>
                            <TableCell className="text-sm py-2">{it.description}</TableCell>
                            <TableCell className="text-right text-sm py-2">{it.quantity}</TableCell>
                            <TableCell className="text-right text-sm py-2 font-medium">{formatCurrency(it.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Previous payments */}
                {prevPayments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Pagos anteriores
                    </p>
                    <div className="space-y-1.5">
                      {prevPayments.map(p => (
                        <div key={p.id} className="flex justify-between text-sm px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                          <div>
                            <span className="font-medium text-green-700">{formatCurrency(p.amount)}</span>
                            <span className="text-muted-foreground ml-2">{p.method === 'cash' ? 'Caja' : 'Transferencia'}</span>
                          </div>
                          <span className="text-muted-foreground">{formatDate(p.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Summary + Form */}
              <div className="space-y-4">
                {/* Payment summary */}
                <div className="bg-blue-50 rounded-xl p-4 space-y-2 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Resumen</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total factura</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pagado</span>
                      <span className="font-medium text-green-600">{formatCurrency(selectedInvoice.amount_paid)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Saldo pendiente</span>
                      <span className="font-bold text-lg text-blue-700">{formatCurrency(selectedInvoice.balance)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment form */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Datos del pago</p>

                  <div className="space-y-1.5">
                    <Label>Número de documento / factura</Label>
                    <Input value={receiptForm.document_number} onChange={ri('document_number')}
                      placeholder="Ej: FAC-001, TRF-20240601" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Fecha de pago</Label>
                      <Input type="date" value={receiptForm.payment_date}
                        onChange={ri('payment_date')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor *</Label>
                      <Input type="number" value={receiptForm.amount}
                        onChange={ri('amount')}
                        placeholder={selectedInvoice.balance.toString()} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Método de pago</Label>
                    <Select value={receiptForm.method}
                      onValueChange={v => setReceiptForm(p => ({ ...p, method: v ?? 'transfer' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Caja</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Proof upload */}
                  <div className="space-y-1.5">
                    <Label>Comprobante de pago</Label>
                    <div
                      className="border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {proofFile ? (
                        <>
                          <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{proofFile.name}</p>
                            <p className="text-xs text-muted-foreground">{(proofFile.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <button className="text-xs text-red-500 shrink-0"
                            onClick={e => { e.stopPropagation(); setProofFile(null) }}>
                            Quitar
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-300 shrink-0" />
                          <p className="text-sm text-muted-foreground">Adjuntar comprobante (PDF, imagen)</p>
                        </>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setProofFile(f) }} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Observaciones</Label>
                    <Textarea value={receiptForm.observations}
                      onChange={ri('observations')}
                      placeholder="Notas adicionales sobre el pago..."
                      rows={2} />
                  </div>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleConfirmPayment}
                  disabled={confirming || !receiptForm.amount}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {confirming ? 'Confirmando...' : 'Confirmar pago'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
