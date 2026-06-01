'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Invoice, Payment } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, DollarSign } from 'lucide-react'
import { formatCurrency, formatDate, isOverdue, today } from '@/lib/utils/format'
import { toast } from 'sonner'
import Link from 'next/link'
import { use } from 'react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', partial: 'Pago parcial', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada',
}
const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque', card: 'Tarjeta',
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState({ date: today(), amount: '', method: 'transfer', reference: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const [invRes, payRes] = await Promise.all([
      supabase.from('invoices').select('*, clients(name, email, phone)').eq('id', invoiceId).single(),
      supabase.from('payments').select('*').eq('invoice_id', invoiceId).order('date', { ascending: false }),
    ])
    setInvoice(invRes.data)
    setPayments(payRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [invoiceId])

  async function handlePayment() {
    if (!invoice || !payForm.amount) { toast.error('Ingresa el monto del pago'); return }
    const amount = parseFloat(payForm.amount)
    if (amount <= 0) { toast.error('El monto debe ser mayor a cero'); return }
    if (amount > invoice.balance) { toast.error(`El monto no puede superar el saldo (${formatCurrency(invoice.balance)})`); return }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('payments').insert({
      invoice_id: invoiceId,
      client_id: invoice.client_id,
      date: payForm.date,
      amount,
      method: payForm.method,
      reference: payForm.reference || null,
      notes: payForm.notes || null,
    })

    if (error) toast.error('Error al registrar el pago')
    else {
      toast.success('Pago registrado')
      setPayOpen(false)
      setPayForm({ date: today(), amount: '', method: 'transfer', reference: '', notes: '' })
      load()
    }
    setSaving(false)
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!invoice) return <div className="p-8 text-muted-foreground">Factura no encontrada</div>

  const client = (invoice as any).clients
  const overdue = isOverdue(invoice.due_date) && invoice.status !== 'paid'
  const paidPct = invoice.total > 0 ? (invoice.amount_paid / invoice.total) * 100 : 0

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/portfolio" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{invoice.number}</h1>
          <p className="text-sm text-muted-foreground">{client?.name}</p>
        </div>
        <Badge variant={invoice.status === 'overdue' || overdue ? 'destructive' : invoice.status === 'paid' ? 'default' : 'outline'} className="ml-auto">
          {overdue && invoice.status !== 'paid' ? 'Vencida' : STATUS_LABELS[invoice.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Fecha emisión', value: formatDate(invoice.date) },
          { label: 'Fecha vencimiento', value: formatDate(invoice.due_date), className: overdue ? 'text-red-600' : '' },
          { label: 'Total factura', value: formatCurrency(invoice.total) },
          { label: 'Saldo', value: formatCurrency(invoice.balance), className: 'font-bold text-lg' },
        ].map(({ label, value, className }) => (
          <Card key={label}><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`font-medium text-sm mt-0.5 ${className ?? ''}`}>{value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Progress bar */}
      <Card><CardContent className="pt-4 pb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progreso de pago</span>
          <span className="font-medium">{paidPct.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Pagado: {formatCurrency(invoice.amount_paid)}</span>
          <span>Pendiente: {formatCurrency(invoice.balance)}</span>
        </div>
      </CardContent></Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-semibold">Historial de pagos</CardTitle>
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <Button size="sm" onClick={() => setPayOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Registrar pago
            </Button>
          )}
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin pagos registrados</TableCell></TableRow>
            ) : payments.map(p => (
              <TableRow key={p.id}>
                <TableCell>{formatDate(p.date)}</TableCell>
                <TableCell className="font-semibold text-green-600">{formatCurrency(p.amount)}</TableCell>
                <TableCell><Badge variant="outline">{METHOD_LABELS[p.method]}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.reference ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{p.notes ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Registrar pago</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm">
              <p className="text-muted-foreground">Saldo pendiente:</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(invoice.balance)}</p>
            </div>
            <div className="space-y-1.5"><Label>Monto *</Label>
              <Input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder={invoice.balance.toString()} />
            </div>
            <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Método de pago</Label>
              <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="check">Cheque</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Referencia</Label><Input value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="Nro. transacción, cheque, etc." /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
              <Button onClick={handlePayment} disabled={saving}>{saving ? 'Guardando...' : 'Registrar pago'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
