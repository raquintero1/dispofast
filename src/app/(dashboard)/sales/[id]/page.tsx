'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SalesOrder, SalesOrderItem } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, CheckCircle, Truck, XCircle, FileText } from 'lucide-react'
import { formatCurrency, formatDate, addDays, today } from '@/lib/utils/format'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { use } from 'react'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', delivered: 'Entregado', cancelled: 'Cancelado',
}

export default function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [order, setOrder] = useState<SalesOrder | null>(null)
  const [items, setItems] = useState<SalesOrderItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const supabase = createClient()
    const [orderRes, itemsRes] = await Promise.all([
      supabase.from('sales_orders').select('*, clients(name, email, phone, city, payment_days)').eq('id', id).single(),
      supabase.from('sales_order_items').select('*, products(name, unit)').eq('sales_order_id', id).order('sort_order'),
    ])
    setOrder(orderRes.data)
    setItems(itemsRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function changeStatus(status: string) {
    const supabase = createClient()
    const { error } = await supabase.from('sales_orders').update({ status }).eq('id', id)
    if (error) { toast.error('Error al actualizar estado'); return }

    // Si se cancela, restaurar el stock que fue descontado al crear la orden
    if (status === 'cancelled') {
      const restorations = items
        .filter(it => it.product_id)
        .map(it => ({
          product_id: it.product_id!,
          type: 'in',
          quantity: it.quantity,
          reference_type: 'sales_order_cancel',
          reference_id: id,
          notes: `Cancelación ${order?.number}`,
        }))
      if (restorations.length > 0) await supabase.from('stock_movements').insert(restorations)
    }
    toast.success('Estado actualizado')
    load()
  }

  async function generateInvoice() {
    if (!order) return
    const client = (order as any).clients
    const paymentDays = client?.payment_days ?? 30
    const supabase = createClient()
    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        sales_order_id: id,
        client_id: order.client_id,
        date: today(),
        due_date: addDays(today(), paymentDays),
        subtotal: order.subtotal,
        tax_total: order.tax_total,
        total: order.total,
        balance: order.total,
        status: 'pending',
      })
      .select().single()

    if (error || !invoice) { toast.error('Error al generar la factura'); return }
    toast.success('Factura generada')
    router.push(`/portfolio/${invoice.id}`)
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!order) return <div className="p-8 text-muted-foreground">Pedido no encontrado</div>

  const client = (order as any).clients

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/sales" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.number}</h1>
          <p className="text-sm text-muted-foreground">{client?.name}</p>
        </div>
        <Badge className="ml-auto">{STATUS_LABELS[order.status]}</Badge>
      </div>

      <div className="flex gap-2 flex-wrap">
        {order.status === 'pending' && (
          <Button size="sm" onClick={() => changeStatus('confirmed')} className="gap-1.5">
            <CheckCircle className="w-4 h-4" /> Confirmar
          </Button>
        )}
        {order.status === 'confirmed' && (
          <Button size="sm" onClick={() => changeStatus('delivered')} className="gap-1.5">
            <Truck className="w-4 h-4" /> Marcar entregado
          </Button>
        )}
        {order.status === 'delivered' && (
          <Button size="sm" onClick={generateInvoice} className="gap-1.5">
            <FileText className="w-4 h-4" /> Generar factura
          </Button>
        )}
        {(order.status === 'pending' || order.status === 'confirmed') && (
          <Button size="sm" variant="destructive" onClick={() => changeStatus('cancelled')} className="gap-1.5">
            <XCircle className="w-4 h-4" /> Cancelar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Fecha', value: formatDate(order.date) },
          { label: 'Cliente', value: client?.name },
          { label: 'Ciudad', value: client?.city ?? '—' },
          { label: 'Total', value: formatCurrency(order.total) },
        ].map(({ label, value }) => (
          <Card key={label}><CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-medium text-sm mt-0.5">{value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-sm font-semibold">Items del pedido</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-20 text-right">Cant.</TableHead>
              <TableHead className="w-32 text-right">P. Unitario</TableHead>
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
                <TableCell className="text-right">{it.tax_rate}%</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(it.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-4 border-t flex justify-end">
          <div className="space-y-1.5 text-sm min-w-52">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IVA:</span><span>{formatCurrency(order.tax_total)}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-1.5"><span>Total:</span><span>{formatCurrency(order.total)}</span></div>
          </div>
        </div>
      </Card>
    </div>
  )
}
