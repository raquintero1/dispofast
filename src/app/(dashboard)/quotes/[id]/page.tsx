'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Quote, QuoteItem } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, CheckCircle, XCircle, Send, ShoppingCart } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { useProfile } from '@/hooks/useProfile'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Vencida',
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { profile } = useProfile()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [quoteRes, itemsRes] = await Promise.all([
      supabase.from('quotes').select('*, clients(name, email, phone, city)').eq('id', id).single(),
      supabase.from('quote_items').select('*, products(name, unit)').eq('quote_id', id).order('sort_order'),
    ])
    setQuote(quoteRes.data)
    setItems(itemsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function changeStatus(status: string) {
    const supabase = createClient()
    const { error } = await supabase.from('quotes').update({ status }).eq('id', id)
    if (error) toast.error('Error al actualizar estado')
    else { toast.success('Estado actualizado'); load() }
  }

  async function convertToOrder() {
    if (!quote) return
    const supabase = createClient()
    const { data: order, error } = await supabase
      .from('sales_orders')
      .insert({
        quote_id: id,
        client_id: quote.client_id,
        date: new Date().toISOString().split('T')[0],
        subtotal: quote.subtotal,
        discount: quote.discount,
        tax_total: quote.tax_total,
        total: quote.total,
        status: 'pending',
        advisor_name: profile?.full_name ?? null,
      })
      .select().single()

    if (error || !order) { toast.error('Error al crear el pedido'); return }

    const orderItems = items.map(it => ({
      sales_order_id: order.id,
      product_id: it.product_id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_pct: it.discount_pct,
      tax_rate: it.tax_rate,
      total: it.total,
      sort_order: it.sort_order,
    }))
    await supabase.from('sales_order_items').insert(orderItems)

    // Descontar stock inmediatamente al crear la orden
    const movements = items
      .filter(it => it.product_id)
      .map(it => ({
        product_id: it.product_id!,
        type: 'out',
        quantity: it.quantity,
        reference_type: 'sales_order',
        reference_id: order.id,
        notes: `Orden ${order.number}`,
      }))
    if (movements.length > 0) await supabase.from('stock_movements').insert(movements)

    await supabase.from('quotes').update({ status: 'approved' }).eq('id', id)
    toast.success('Pedido creado — inventario actualizado')
    router.push(`/sales/${order.id}`)
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!quote) return <div className="p-8 text-muted-foreground">Cotización no encontrada</div>

  const client = (quote as any).clients

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/quotes" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{quote.number}</h1>
          <p className="text-sm text-muted-foreground">{client?.name}</p>
        </div>
        <Badge className="ml-auto">{STATUS_LABELS[quote.status]}</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        {quote.status === 'draft' && (
          <Button size="sm" variant="outline" onClick={() => changeStatus('sent')} className="gap-1.5">
            <Send className="w-4 h-4" /> Marcar como enviada
          </Button>
        )}
        {(quote.status === 'draft' || quote.status === 'sent') && (
          <>
            <Button size="sm" onClick={() => changeStatus('approved')} className="gap-1.5">
              <CheckCircle className="w-4 h-4" /> Aprobar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => changeStatus('rejected')} className="gap-1.5">
              <XCircle className="w-4 h-4" /> Rechazar
            </Button>
          </>
        )}
        {quote.status === 'approved' && (
          <Button size="sm" onClick={convertToOrder} className="gap-1.5">
            <ShoppingCart className="w-4 h-4" /> Convertir en pedido
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Fecha', value: formatDate(quote.date) },
          { label: 'Válida hasta', value: formatDate(quote.valid_until) },
          { label: 'Cliente', value: client?.name },
          { label: 'Ciudad', value: client?.city ?? '—' },
        ].map(({ label, value }) => (
          <Card key={label}><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium text-sm mt-0.5">{value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm font-semibold">Detalle de items</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-20 text-right">Cant.</TableHead>
              <TableHead className="w-32 text-right">P. Unitario</TableHead>
              <TableHead className="w-20 text-right">Dcto</TableHead>
              <TableHead className="w-20 text-right">IVA</TableHead>
              <TableHead className="w-32 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(it => (
              <TableRow key={it.id}>
                <TableCell>
                  <p className="font-medium">{it.description}</p>
                  {(it as any).products?.unit && <p className="text-xs text-muted-foreground">{(it as any).products.unit}</p>}
                </TableCell>
                <TableCell className="text-right">{it.quantity}</TableCell>
                <TableCell className="text-right">{formatCurrency(it.unit_price)}</TableCell>
                <TableCell className="text-right">{it.discount_pct > 0 ? `${it.discount_pct}%` : '—'}</TableCell>
                <TableCell className="text-right">{it.tax_rate}%</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(it.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-4 border-t flex justify-end">
          <div className="space-y-1.5 text-sm min-w-52">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{formatCurrency(quote.subtotal)}</span></div>
            {quote.discount > 0 && <div className="flex justify-between text-red-600"><span>Descuento:</span><span>-{formatCurrency(quote.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">IVA:</span><span>{formatCurrency(quote.tax_total)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Total:</span><span>{formatCurrency(quote.total)}</span></div>
          </div>
        </div>
      </Card>

      {(quote.notes || quote.terms) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quote.notes && <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground mb-1">Notas</p><p className="text-sm">{quote.notes}</p></CardContent></Card>}
          {quote.terms && <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground mb-1">Términos y condiciones</p><p className="text-sm">{quote.terms}</p></CardContent></Card>}
        </div>
      )}
    </div>
  )
}
