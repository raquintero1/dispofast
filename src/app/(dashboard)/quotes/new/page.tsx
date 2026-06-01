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
import { ArrowLeft, Plus, Trash2, Download, Save, User, Building2, Search } from 'lucide-react'
import { formatCurrency, today, addDays } from '@/lib/utils/format'
import { CLASIFICACIONES } from '@/lib/utils/colombia'
import { getPriceByClassification, getPriceListLabel } from '@/lib/utils/pricing'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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

export default function NewQuotePage() {
  const router = useRouter()

  // Client
  const [clientMode, setClientMode] = useState<'existing' | 'prospect'>('existing')
  const [allClients, setAllClients] = useState<Client[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [prospect, setProspect] = useState({
    name: '', type_of_person: 'empresa', classification: '',
    phone: '', email: '', city: '', retefuente: 'no',
  })

  // Terms
  const [paymentConditions, setPaymentConditions] = useState('Contado')
  const [offerValidity, setOfferValidity] = useState('30')
  const [commercialDiscount, setCommercialDiscount] = useState('no_aplica')
  const [otherDiscount, setOtherDiscount] = useState('')
  const [notes, setNotes] = useState('')

  // Products
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [addProductId, setAddProductId] = useState('')
  const [addQty, setAddQty] = useState('1')
  const [items, setItems] = useState<LineItem[]>([])

  // Payment extras
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

  const activeClassification = useMemo(() => {
    if (clientMode === 'existing') return selectedClient?.classification ?? null
    return prospect.classification || null
  }, [clientMode, selectedClient, prospect.classification])

  const shouldApplyRetefuente = useMemo(() => {
    if (clientMode === 'existing') return selectedClient?.retefuente ?? false
    return prospect.retefuente === 'si'
  }, [clientMode, selectedClient, prospect.retefuente])

  const priceListLabel = useMemo(() => getPriceListLabel(activeClassification), [activeClassification])

  const filteredClients = allClients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.document_number ?? '').includes(clientSearch)
  )

  function handleAddProduct() {
    if (!addProductId || !addQty || Number(addQty) <= 0) {
      toast.error('Selecciona un producto y una cantidad válida')
      return
    }
    const product = allProducts.find(p => p.id === addProductId)
    if (!product) return
    const price = getPriceByClassification(product, activeClassification)
    const existing = items.findIndex(it => it.product_id === addProductId)
    if (existing >= 0) {
      setItems(prev => prev.map((it, i) =>
        i === existing ? { ...it, quantity: it.quantity + Number(addQty) } : it
      ))
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

  function updateItemPrice(i: number, price: string) {
    setItems(prev => prev.map((it, idx) =>
      idx === i ? { ...it, unit_price: parseFloat(price) || 0 } : it
    ))
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  // Calculations
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
    if (clientMode === 'existing' && !selectedClient) { toast.error('Selecciona un cliente'); return }
    if (clientMode === 'prospect' && !prospect.name.trim()) { toast.error('El nombre del prospecto es requerido'); return }
    if (items.length === 0) { toast.error('Agrega al menos un producto'); return }
    setSaving(true)
    const supabase = createClient()

    const prospectData = clientMode === 'prospect'
      ? { name: prospect.name, type_of_person: prospect.type_of_person, classification: prospect.classification, phone: prospect.phone, email: prospect.email, city: prospect.city }
      : null

    const validUntil = addDays(today(), parseInt(offerValidity) || 30)

    const { data: { user } } = await supabase.auth.getUser()

    const { data: quote, error } = await supabase.from('quotes').insert({
      client_id: clientMode === 'existing' ? selectedClient!.id : null,
      date: today(),
      valid_until: validUntil,
      status: 'draft',
      subtotal: calc.subtotal,
      discount: calc.discountAmount,
      tax_total: calc.ivaTotal,
      total: calc.total,
      notes: notes || null,
      prospect_data: prospectData,
      client_classification: activeClassification,
      payment_conditions: paymentConditions,
      offer_validity: parseInt(offerValidity) || 30,
      other_discount: Number(otherDiscount) || 0,
      retefuente_amount: calc.retefuenteAmt,
      rete_ica: calc.reteICAVal,
      flete: calc.fleteAmt,
      created_by: user?.id ?? null,
    }).select().single()

    if (error || !quote) { toast.error('Error al guardar la cotización'); setSaving(false); return }

    const itemsPayload = items.map((it, idx) => ({
      quote_id: quote.id,
      product_id: it.product_id,
      description: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_pct: 0,
      tax_rate: it.tax_rate,
      total: it.quantity * it.unit_price * (1 + it.tax_rate / 100),
      sort_order: idx,
    }))
    await supabase.from('quote_items').insert(itemsPayload)
    toast.success('Cotización guardada')
    router.push(`/quotes/${quote.id}`)
  }

  async function handleDownloadPDF() {
    if (items.length === 0) { toast.error('Agrega productos antes de descargar el PDF'); return }
    try {
      const { createElement } = await import('react')
      const { QuotePDF } = await import('@/components/modules/quotes/QuotePDF')
      const { pdf } = await import('@react-pdf/renderer')

      const clientName = clientMode === 'existing'
        ? (selectedClient?.name ?? 'Sin cliente')
        : (prospect.name || 'Prospecto')
      const clientDoc = clientMode === 'existing'
        ? (selectedClient?.document_number ?? '')
        : ''
      const clientDocType = clientMode === 'existing'
        ? (selectedClient?.document_type ?? 'Doc')
        : (prospect.type_of_person === 'empresa' ? 'NIT' : 'CC')

      const discLabel = [
        commercialDiscount !== 'no_aplica' ? `Comercial ${commercialDiscount}%` : '',
        Number(otherDiscount) > 0 ? `Otros ${otherDiscount}%` : '',
      ].filter(Boolean).join(' + ')

      const pdfData = {
        number: 'BORRADOR',
        date: today(),
        validUntil: addDays(today(), parseInt(offerValidity) || 30),
        clientName, clientDoc, clientDocType,
        clientPhone: clientMode === 'existing' ? (selectedClient?.phone ?? '') : prospect.phone,
        clientEmail: clientMode === 'existing' ? (selectedClient?.email ?? '') : prospect.email,
        clientCity: clientMode === 'existing' ? (selectedClient?.city ?? '') : prospect.city,
        clientClassification: activeClassification ?? '',
        priceListLabel,
        paymentConditions,
        offerValidity: parseInt(offerValidity) || 30,
        items: items.map(it => ({
          name: it.product_name, unit: it.unit, quantity: it.quantity,
          unitPrice: it.unit_price,
          subtotal: it.quantity * it.unit_price,
          iva: it.quantity * it.unit_price * (it.tax_rate / 100),
          total: it.quantity * it.unit_price * (1 + it.tax_rate / 100),
        })),
        subtotal: calc.subtotal, ivaTotal: calc.ivaTotal,
        discountLabel: discLabel || 'Sin descuento', discountAmount: calc.discountAmount,
        retefuenteAmount: calc.retefuenteAmt,
        reteICA: calc.reteICAVal, reteICAAmount: calc.reteICAAmount,
        flete: calc.fleteAmt, total: calc.total, notes,
      }

      const blob = await pdf(createElement(QuotePDF, { data: pdfData })).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'cotizacion.pdf'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Error al generar el PDF. Guarda la cotización primero.')
    }
  }

  const clientInfo = clientMode === 'existing' ? selectedClient : null

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center gap-3">
        <Link href="/quotes" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nueva cotización</h1>
        {activeClassification && (
          <Badge variant="outline" className="ml-2 text-blue-700 border-blue-300 bg-blue-50">
            {priceListLabel}
          </Badge>
        )}
      </div>

      <div className="flex gap-5 items-start">
        {/* Main content */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* 1. CLIENTE */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">1. Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => { setClientMode('existing'); setSelectedClient(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${clientMode === 'existing' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground hover:bg-gray-50'}`}
                >
                  <Search className="w-4 h-4" /> Cliente existente
                </button>
                <button
                  onClick={() => { setClientMode('prospect'); setSelectedClient(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${clientMode === 'prospect' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground hover:bg-gray-50'}`}
                >
                  <User className="w-4 h-4" /> Prospecto
                </button>
              </div>

              {clientMode === 'existing' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Buscar cliente por nombre o NIT..." value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)} className="pl-9" />
                  </div>
                  {clientSearch && !selectedClient && (
                    <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      {filteredClients.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No se encontraron clientes</p>
                      ) : filteredClients.slice(0, 8).map(c => (
                        <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch('') }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{c.document_number} · {c.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedClient && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{selectedClient.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedClient.document_number} · {selectedClient.city} · {selectedClient.classification ? CLASIFICACIONES.find(c => c.value === selectedClient.classification)?.label : 'Sin clasificación'}</p>
                      </div>
                      <button onClick={() => setSelectedClient(null)} className="text-xs text-blue-600 hover:underline shrink-0">Cambiar</button>
                    </div>
                  )}
                </div>
              )}

              {clientMode === 'prospect' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Nombre *</Label>
                    <Input value={prospect.name} onChange={e => setProspect(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del prospecto" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de persona</Label>
                    <Select value={prospect.type_of_person} onValueChange={v => setProspect(p => ({ ...p, type_of_person: v ?? 'empresa' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empresa">Empresa</SelectItem>
                        <SelectItem value="natural">Persona Natural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de cliente</Label>
                    <Select value={prospect.classification} onValueChange={v => setProspect(p => ({ ...p, classification: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {CLASIFICACIONES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Teléfono</Label>
                    <Input value={prospect.phone} onChange={e => setProspect(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Correo</Label>
                    <Input type="email" value={prospect.email} onChange={e => setProspect(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ciudad</Label>
                    <Input value={prospect.city} onChange={e => setProspect(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>¿Aplica retefuente?</Label>
                    <Select value={prospect.retefuente} onValueChange={v => setProspect(p => ({ ...p, retefuente: v ?? 'no' }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="si">Sí</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. TÉRMINOS */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">2. Términos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Condiciones de pago</Label>
                  <Select value={paymentConditions} onValueChange={v => setPaymentConditions(v ?? 'Contado')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Validez de la oferta</Label>
                  <Select value={offerValidity} onValueChange={v => setOfferValidity(v ?? '30')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['15','30','45','60'].map(d => <SelectItem key={d} value={d}>{d} días</SelectItem>)}
                    </SelectContent>
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
                  <Input type="number" value={otherDiscount} onChange={e => setOtherDiscount(e.target.value)} placeholder="0" min="0" max="100" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. PRODUCTOS */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">3. Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add product row */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                  <Label>Producto</Label>
                  <Select value={addProductId} onValueChange={v => setAddProductId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto..." />
                    </SelectTrigger>
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

              {/* Products table */}
              {items.length > 0 && (
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
                              <Input
                                type="number"
                                value={it.unit_price}
                                onChange={e => updateItemPrice(i, e.target.value)}
                                className="h-7 w-32 text-right text-sm ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(sub)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatCurrency(iva)}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(sub + iva)}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => removeItem(i)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {items.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
                  Agrega productos usando el selector de arriba
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1.5">
                <Label>Notas / Observaciones</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condiciones adicionales, instrucciones de entrega..." />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT PANEL: Payment summary */}
        <div className="w-72 shrink-0 sticky top-6 space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Resumen de pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(calc.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span className="font-medium">{formatCurrency(calc.ivaTotal)}</span>
                </div>

                {calc.discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Descuentos ({calc.totalDiscPct}%)</span>
                    <span>-{formatCurrency(calc.discountAmount)}</span>
                  </div>
                )}

                {shouldApplyRetefuente && calc.retefuenteAmt > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Retefuente (3.5%)</span>
                    <span>-{formatCurrency(calc.retefuenteAmt)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs">ReteICA (%)</Label>
                  <Input type="number" value={reteICA} onChange={e => setReteICA(e.target.value)}
                    placeholder="0" min="0" className="h-7 text-sm" />
                  {calc.reteICAAmount > 0 && (
                    <p className="text-xs text-red-600">-{formatCurrency(calc.reteICAAmount)}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Flete (COP)</Label>
                  <Input type="number" value={flete} onChange={e => setFlete(e.target.value)}
                    placeholder="0" min="0" className="h-7 text-sm" />
                  {calc.fleteAmt > 0 && (
                    <p className="text-xs text-green-600">+{formatCurrency(calc.fleteAmt)}</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-bold text-base">Total</span>
                <span className="font-bold text-xl text-blue-700">{formatCurrency(calc.total)}</span>
              </div>

              {activeClassification && (
                <div className="mt-1 text-center">
                  <Badge variant="outline" className="text-xs text-blue-700 border-blue-200 bg-blue-50 w-full justify-center py-1">
                    {priceListLabel}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar cotización'}
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4" /> Descargar PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
