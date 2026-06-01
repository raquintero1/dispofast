'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client, Product } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Plus, Trash2, Download, Save } from 'lucide-react'
import { formatCurrency, today, addDays } from '@/lib/utils/format'
import { CLASIFICACIONES } from '@/lib/utils/colombia'
import { getPriceByClassification, getPriceListLabel } from '@/lib/utils/pricing'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/hooks/useProfile'

interface LineItem {
  product_id: string
  product_name: string
  unit: string
  quantity: number
  unit_price: number
  tax_rate: number
}

const PAYMENT_CONDITIONS = [
  'Contado', 'Contraentrega', 'Contado 15 días',
  'Contado 30 días', 'Contado 60 días', 'Contado 90 días',
]

export default function CreateSalesOrderPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [allClients, setAllClients] = useState<Client[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deliveryCity, setDeliveryCity] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [paymentConditions, setPaymentConditions] = useState('Contado')
  const [commercialDiscount, setCommercialDiscount] = useState('no_aplica')
  const [otherDiscount, setOtherDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [addProductId, setAddProductId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [items, setItems] = useState<LineItem[]>([])
  const [reteICA, setReteICA] = useState('')
  const [flete, setFlete] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [clientsRes, productsRes] = await Promise.all([
        supabase.from('clients').select('*').eq('status', 'active').order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ])
      setAllClients(clientsRes.data ?? [])
      setAllProducts(productsRes.data ?? [])
    }
    load()
  }, [])

  function handleClientSelect(clientId: string) {
    setSelectedClientId(clientId)
    const client = allClients.find(c => c.id === clientId) ?? null
    setSelectedClient(client)
    setDeliveryCity(client?.city ?? '')
    setDeliveryAddress(client?.address ?? '')
  }

  const activeClassification = selectedClient?.classification ?? null
  const shouldApplyRetefuente = selectedClient?.retefuente ?? false
  const priceListLabel = useMemo(() => getPriceListLabel(activeClassification), [activeClassification])

  function handleAddProduct() {
    if (!addProductId || !addQty || Number(addQty) <= 0) {
      toast.error('Selecciona un producto y cantidad válida'); return
    }
    const product = allProducts.find(p => p.id === addProductId)
    if (!product) return
    if (product.stock_quantity < Number(addQty)) {
      toast.warning(`Stock insuficiente. Disponible: ${product.stock_quantity} ${product.unit}`)
    }
    const price = getPriceByClassification(product, activeClassification)
    const existing = items.findIndex(it => it.product_id === addProductId)
    if (existing >= 0) {
      setItems(prev => prev.map((it, i) => i === existing ? { ...it, quantity: it.quantity + Number(addQty) } : it))
    } else {
      setItems(prev => [...prev, {
        product_id: product.id, product_name: product.name,
        unit: product.unit, quantity: Number(addQty),
        unit_price: price, tax_rate: product.tax_rate,
      }])
    }
    setAddProductId('')
    setAddQty('1')
  }

  const calc = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
    const ivaTotal = items.reduce((s, it) => s + it.quantity * it.unit_price * (it.tax_rate / 100), 0)
    const commDiscPct = commercialDiscount === 'no_aplica' ? 0 : Number(commercialDiscount)
    const otherDiscPct = Number(otherDiscount) || 0
    const totalDiscPct = commDiscPct + otherDiscPct
    const discountAmount = subtotal * (totalDiscPct / 100)
    const retefuenteAmt = shouldApplyRetefuente ? subtotal * 0.035 : 0
    const reteICAVal = Number(reteICA) || 0
    const reteICAAmount = reteICAVal > 0 ? subtotal * (reteICAVal / 100) : 0
    const fleteAmt = Number(flete) || 0
    const total = subtotal + ivaTotal - discountAmount - retefuenteAmt - reteICAAmount + fleteAmt
    return { subtotal, ivaTotal, discountAmount, totalDiscPct, retefuenteAmt, reteICAAmount, reteICAVal, fleteAmt, total }
  }, [items, commercialDiscount, otherDiscount, shouldApplyRetefuente, reteICA, flete])

  async function handleSave() {
    if (!selectedClient) { toast.error('Selecciona un cliente'); return }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: order, error: orderErr } = await supabase.from('sales_orders').insert({
      client_id: selectedClient.id,
      date: today(),
      status: 'confirmed',
      subtotal: calc.subtotal,
      discount: calc.discountAmount,
      tax_total: calc.ivaTotal,
      total: calc.total,
      notes: notes || null,
      delivery_city: deliveryCity || null,
      delivery_address: deliveryAddress || null,
      payment_conditions: paymentConditions,
      other_discount: Number(otherDiscount) || 0,
      retefuente_amount: calc.retefuenteAmt,
      rete_ica: calc.reteICAVal,
      flete: calc.fleteAmt,
      created_by: user?.id ?? null,
      advisor_name: profile?.full_name ?? null,
    }).select().single()

    if (orderErr || !order) { toast.error('Error al crear la orden'); setSaving(false); return }

    await supabase.from('sales_order_items').insert(
      items.map((it, idx) => ({
        sales_order_id: order.id,
        product_id: it.product_id,
        description: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_pct: 0,
        tax_rate: it.tax_rate,
        total: it.quantity * it.unit_price * (1 + it.tax_rate / 100),
        sort_order: idx,
      }))
    )

    await supabase.from('stock_movements').insert(
      items.map(it => ({
        product_id: it.product_id,
        type: 'out',
        quantity: it.quantity,
        reference_type: 'sales_order',
        reference_id: order.id,
        notes: `Orden ${order.number}`,
      }))
    )

    await supabase.from('invoices').insert({
      sales_order_id: order.id,
      client_id: selectedClient.id,
      date: today(),
      due_date: addDays(today(), selectedClient.payment_days ?? 30),
      subtotal: calc.subtotal,
      tax_total: calc.ivaTotal,
      total: calc.total,
      balance: calc.total,
      amount_paid: 0,
      status: 'pending',
      created_by: user?.id ?? null,
    })

    toast.success('Orden creada — inventario actualizado — cartera registrada')

    // Send email in background
    const pdfData = {
      number: order.number, date: today(),
      clientName: selectedClient.name,
      clientDocType: selectedClient.document_type ?? 'Doc',
      clientDoc: selectedClient.document_number ?? '',
      clientPhone: selectedClient.phone ?? '',
      clientEmail: selectedClient.email ?? '',
      clientCity: selectedClient.city ?? '',
      clientDepartment: selectedClient.department ?? '',
      deliveryCity, deliveryAddress,
      classification: CLASIFICACIONES.find(c => c.value === activeClassification)?.label ?? '',
      paymentConditions,
      items: items.map(it => ({
        name: it.product_name, unit: it.unit, quantity: it.quantity,
        unitPrice: it.unit_price,
        subtotal: it.quantity * it.unit_price,
        iva: it.quantity * it.unit_price * (it.tax_rate / 100),
        total: it.quantity * it.unit_price * (1 + it.tax_rate / 100),
      })),
      subtotal: calc.subtotal, ivaTotal: calc.ivaTotal,
      discountLabel: calc.discountAmount > 0 ? `${calc.totalDiscPct}%` : 'Sin descuento',
      discountAmount: calc.discountAmount,
      retefuenteAmount: calc.retefuenteAmt,
      reteICA: calc.reteICAVal, reteICAAmount: calc.reteICAAmount,
      flete: calc.fleteAmt, total: calc.total, notes,
    }
    fetch('/api/send-order-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderData: {
          orderNumber: order.number,
          clientName: selectedClient.name,
          advisorName: profile?.full_name ?? '—',
          date: today(),
          totalFormatted: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(calc.total),
        },
        pdfData,
      }),
    }).catch(() => toast.warning('Orden guardada. No se pudo enviar el correo.', { duration: 5000 }))

    router.push(`/sales/${order.id}`)
  }

  async function handleDownloadPDF() {
    if (!selectedClient || items.length === 0) { toast.error('Completa el formulario primero'); return }
    try {
      const { createElement } = await import('react')
      const { SalesOrderPDF } = await import('@/components/modules/sales/SalesOrderPDF')
      const { pdf } = await import('@react-pdf/renderer')
      const pdfData = {
        number: 'BORRADOR', date: today(),
        clientName: selectedClient.name,
        clientDocType: selectedClient.document_type ?? 'Doc',
        clientDoc: selectedClient.document_number ?? '',
        clientPhone: selectedClient.phone ?? '',
        clientEmail: selectedClient.email ?? '',
        clientCity: selectedClient.city ?? '',
        clientDepartment: selectedClient.department ?? '',
        deliveryCity, deliveryAddress,
        classification: CLASIFICACIONES.find(c => c.value === activeClassification)?.label ?? '',
        paymentConditions,
        items: items.map(it => ({
          name: it.product_name, unit: it.unit, quantity: it.quantity,
          unitPrice: it.unit_price, subtotal: it.quantity * it.unit_price,
          iva: it.quantity * it.unit_price * (it.tax_rate / 100),
          total: it.quantity * it.unit_price * (1 + it.tax_rate / 100),
        })),
        subtotal: calc.subtotal, ivaTotal: calc.ivaTotal,
        discountLabel: 'Sin descuento', discountAmount: calc.discountAmount,
        retefuenteAmount: calc.retefuenteAmt,
        reteICA: calc.reteICAVal, reteICAAmount: calc.reteICAAmount,
        flete: calc.fleteAmt, total: calc.total, notes,
      }
      const blob = await pdf(createElement(SalesOrderPDF, { data: pdfData })).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = 'orden-compra.pdf'; link.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Error al generar el PDF') }
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link href="/sales" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Orden de Compra</h1>
        {activeClassification && (
          <Badge variant="outline" className="ml-2 text-blue-700 border-blue-300 bg-blue-50">{priceListLabel}</Badge>
        )}
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-1 space-y-4 min-w-0">
          {/* Cliente */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">1. Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Seleccionar cliente *</Label>
                <Select value={selectedClientId} onValueChange={handleClientSelect}>
                  <SelectTrigger><SelectValue placeholder="Buscar cliente..." /></SelectTrigger>
                  <SelectContent>
                    {allClients.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.document_number ?? ''} · {c.city ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClient && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                    {[
                      { label: 'Tipo', value: selectedClient.client_type === 'empresa' ? 'Empresa' : 'Persona Natural' },
                      { label: 'Clasificación', value: CLASIFICACIONES.find(c => c.value === selectedClient.classification)?.label ?? '—' },
                      { label: 'Departamento', value: selectedClient.department ?? '—' },
                      { label: 'Ciudad', value: selectedClient.city ?? '—' },
                      { label: 'Teléfono', value: selectedClient.phone ?? '—' },
                      { label: 'Correo', value: selectedClient.email ?? '—' },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Ciudad de entrega</Label>
                      <Input value={deliveryCity} onChange={e => setDeliveryCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dirección de entrega</Label>
                      <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Términos */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">2. Términos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Condiciones de pago</Label>
                  <Select value={paymentConditions} onValueChange={v => setPaymentConditions(v ?? 'Contado')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Descuento comercial</Label>
                  <Select value={commercialDiscount} onValueChange={v => setCommercialDiscount(v ?? 'no_aplica')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_aplica">No aplica</SelectItem>
                      <SelectItem value="1">1%</SelectItem>
                      <SelectItem value="2">2%</SelectItem>
                      <SelectItem value="3">3%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Otros descuentos (%)</Label>
                  <Input type="number" value={otherDiscount} onChange={e => setOtherDiscount(e.target.value)} placeholder="0" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Productos */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">3. Productos</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Producto</Label>
                  <Select value={addProductId} onValueChange={v => setAddProductId(v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
                    <SelectContent>
                      {allProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · Stock: {p.stock_quantity} {p.unit} · {formatCurrency(getPriceByClassification(p, activeClassification))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24 space-y-1.5">
                  <Label>Cantidad</Label>
                  <Input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} min="1" />
                </div>
                <Button onClick={handleAddProduct} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Agregar
                </Button>
              </div>
              {items.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Producto</TableHead>
                        <TableHead className="w-16 text-right">Und.</TableHead>
                        <TableHead className="w-20 text-right">Cant.</TableHead>
                        <TableHead className="w-36 text-right">V. Unitario</TableHead>
                        <TableHead className="w-32 text-right">Subtotal</TableHead>
                        <TableHead className="w-28 text-right">IVA 19%</TableHead>
                        <TableHead className="w-32 text-right font-bold">Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, i) => {
                        const sub = it.quantity * it.unit_price
                        const iva = sub * (it.tax_rate / 100)
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{it.product_name}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{it.unit}</TableCell>
                            <TableCell className="text-right">{it.quantity}</TableCell>
                            <TableCell className="text-right">
                              <Input type="number" value={it.unit_price}
                                onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, unit_price: parseFloat(e.target.value) || 0 } : x))}
                                className="h-7 w-32 text-right text-sm ml-auto" />
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(sub)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatCurrency(iva)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(sub + iva)}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive"
                                onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                  Agrega productos usando el selector de arriba
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1.5">
                <Label>Notas / Observaciones</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho */}
        <div className="w-72 shrink-0 sticky top-6 space-y-3">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Resumen de pago</CardTitle></CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatCurrency(calc.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IVA (19%)</span><span className="font-medium">{formatCurrency(calc.ivaTotal)}</span></div>
                {calc.discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Descuentos ({calc.totalDiscPct}%)</span><span>-{formatCurrency(calc.discountAmount)}</span></div>}
                {shouldApplyRetefuente && calc.retefuenteAmt > 0 && <div className="flex justify-between text-red-600"><span>Retefuente (3.5%)</span><span>-{formatCurrency(calc.retefuenteAmt)}</span></div>}
              </div>
              <Separator />
              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs">ReteICA (%)</Label>
                  <Input type="number" value={reteICA} onChange={e => setReteICA(e.target.value)} placeholder="0" className="h-7 text-sm" />
                  {calc.reteICAAmount > 0 && <p className="text-xs text-red-600">-{formatCurrency(calc.reteICAAmount)}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Flete (COP)</Label>
                  <Input type="number" value={flete} onChange={e => setFlete(e.target.value)} placeholder="0" className="h-7 text-sm" />
                  {calc.fleteAmt > 0 && <p className="text-xs text-green-600">+{formatCurrency(calc.fleteAmt)}</p>}
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-bold text-base">Total</span>
                <span className="font-bold text-xl text-blue-700">{formatCurrency(calc.total)}</span>
              </div>
              {activeClassification && (
                <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50 w-full justify-center py-1">{priceListLabel}</Badge>
              )}
              {selectedClient && (
                <div className="text-xs text-muted-foreground bg-gray-50 rounded-md p-2 space-y-0.5">
                  <p>Vencimiento: {selectedClient.payment_days ?? 30} días</p>
                  {shouldApplyRetefuente && <p className="text-orange-600">⚠ Aplica retefuente</p>}
                </div>
              )}
            </CardContent>
          </Card>
          <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar orden'}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" /> Descargar PDF
          </Button>
          <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md p-2 space-y-1">
            <p className="font-medium text-amber-800">Al guardar esta orden:</p>
            <p>✓ Se descuenta el inventario</p>
            <p>✓ Se crea registro en Cartera</p>
          </div>
        </div>
      </div>
    </div>
  )
}
