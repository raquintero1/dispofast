'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Pencil, AlertTriangle, Upload, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'
import { toast } from 'sonner'
import { useProfile } from '@/hooks/useProfile'

const PRODUCT_CATEGORIES = [
  'Aguja hipodérmica',
  'Jeringa desechable',
  'Condones Click Me',
  'Preservativos',
  'Osteosíntesis',
  'Productos representados',
]

const EMPTY_FORM = {
  name: '', description: '', product_category: '',
  sku: '', brand: '', unit: 'UND',
  status: 'available', stock_quantity: '0', min_stock: '0',
  cost_price: '0', tax_rate: '19',
  sale_price: '0', price_distributor: '0', price_drogueria: '0',
  price_entidad: '0', price_veterinaria: '0', price_ecommerce: '0',
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const { isAdmin } = useProfile()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadProducts() {
    const supabase = createClient()
    const { data } = await supabase.from('products').select('*').order('name')
    setProducts(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
    const supabase = createClient()
    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, loadProducts)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      product_category: p.product_category ?? '',
      sku: p.sku ?? '',
      brand: p.brand ?? '',
      unit: p.unit,
      status: p.is_active ? 'available' : 'unavailable',
      stock_quantity: p.stock_quantity.toString(),
      min_stock: p.min_stock.toString(),
      cost_price: p.cost_price.toString(),
      tax_rate: p.tax_rate.toString(),
      sale_price: p.sale_price.toString(),
      price_distributor: (p.price_distributor ?? 0).toString(),
      price_drogueria: (p.price_drogueria ?? 0).toString(),
      price_entidad: (p.price_entidad ?? 0).toString(),
      price_veterinaria: (p.price_veterinaria ?? 0).toString(),
      price_ecommerce: (p.price_ecommerce ?? 0).toString(),
    })
    setImageFile(null)
    setImagePreview(p.image_url ?? null)
    setOpen(true)
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(file: File, productId: string): Promise<string | null> {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const { error } = await supabase.storage
      .from('product-images')
      .upload(`${productId}/image.${ext}`, file, { upsert: true })
    if (error) { console.error(error); return null }
    return supabase.storage.from('product-images').getPublicUrl(`${productId}/image.${ext}`).data.publicUrl
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      product_category: form.product_category || null,
      sku: form.sku || null,
      brand: form.brand || null,
      unit: form.unit,
      is_active: form.status === 'available',
      stock_quantity: form.status === 'available' ? (parseFloat(form.stock_quantity) || 0) : 0,
      min_stock: parseFloat(form.min_stock) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
      tax_rate: parseFloat(form.tax_rate) || 19,
      sale_price: parseFloat(form.sale_price) || 0,
      price_distributor: parseFloat(form.price_distributor) || 0,
      price_drogueria: parseFloat(form.price_drogueria) || 0,
      price_entidad: parseFloat(form.price_entidad) || 0,
      price_veterinaria: parseFloat(form.price_veterinaria) || 0,
      price_ecommerce: parseFloat(form.price_ecommerce) || 0,
    }

    let savedId = editing?.id
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id)
      if (error) { toast.error('Error al actualizar producto'); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select().single()
      if (error || !data) { toast.error('Error al crear producto'); setSaving(false); return }
      savedId = data.id
    }

    if (imageFile && savedId) {
      const url = await uploadImage(imageFile, savedId)
      if (url) await supabase.from('products').update({ image_url: url }).eq('id', savedId)
    }

    toast.success(editing ? 'Producto actualizado' : 'Producto creado')
    setOpen(false)
    loadProducts()
    setSaving(false)
  }

  const inp = (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [key]: e.target.value }))

  const available = products.filter(p => p.is_active)
  const unavailable = products.filter(p => !p.is_active)
  const lowStock = available.filter(p => p.stock_quantity < p.min_stock)

  const filtered = products.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || p.product_category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            {available.length} disponibles · {unavailable.length} no disponibles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isAdmin && (
            <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-md">Solo lectura</span>
          )}
          <Button variant="outline" size="icon" onClick={loadProducts}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          {isAdmin && (
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" /> Añadir producto
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total productos', value: products.length, color: 'text-gray-900' },
          { label: 'Disponibles', value: available.length, color: 'text-green-700' },
          { label: 'Stock bajo mínimo', value: lowStock.length, color: 'text-orange-600' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{lowStock.length} producto(s)</strong> con stock bajo mínimo: {lowStock.map(p => p.name).join(', ')}</span>
        </div>
      )}

      {/* Filters + Table */}
      <Card>
        <div className="p-4 border-b flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, SKU o marca..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Imagen</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Marca / Ref.</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No se encontraron productos</TableCell></TableRow>
            ) : filtered.map(p => {
              const isLow = p.is_active && p.stock_quantity < p.min_stock
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover border bg-gray-50" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg border bg-gray-50 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-muted-foreground truncate max-w-52">{p.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.sku ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.product_category ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.brand ?? '—'}</TableCell>
                  <TableCell className={`text-right font-semibold ${isLow ? 'text-orange-600' : ''}`}>
                    {p.is_active ? (
                      <span className="flex items-center justify-end gap-1">
                        {formatNumber(p.stock_quantity, 0)} {p.unit}
                        {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                        Disponible
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No disponible</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar producto' : 'Añadir producto'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
            {/* ─── LEFT COLUMN ─── */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre del producto *</Label>
                <Input value={form.name} onChange={inp('name')} placeholder="Ej: Jeringa 5ml BD" />
              </div>

              <div className="space-y-1.5">
                <Label>Descripción corta</Label>
                <Textarea value={form.description} onChange={inp('description')}
                  placeholder="Descripción breve del producto..." rows={3} />
              </div>

              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={form.product_category}
                  onValueChange={v => setForm(f => ({ ...f, product_category: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Image upload */}
              <div className="space-y-1.5">
                <Label>Imagen del producto</Label>
                <div
                  className="border-2 border-dashed rounded-xl p-4 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col items-center gap-2 min-h-32 justify-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview"
                      className="max-h-36 max-w-full object-contain rounded-lg" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-300" />
                      <p className="text-sm text-muted-foreground text-center">
                        Haz clic para subir imagen
                      </p>
                      <p className="text-xs text-gray-400">PNG, JPG, WEBP</p>
                    </>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden"
                  accept="image/*" onChange={handleImageChange} />
                {imagePreview && (
                  <button className="text-xs text-red-500 hover:underline"
                    onClick={() => { setImageFile(null); setImagePreview(null) }}>
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>

            {/* ─── RIGHT COLUMN ─── */}
            <div className="space-y-4">
              {/* Status toggle */}
              <div className="space-y-1.5">
                <Label>Estado de inventario</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['available', 'unavailable'] as const).map(s => (
                    <button key={s} type="button"
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                        form.status === s
                          ? s === 'available'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-red-400 bg-red-50 text-red-700'
                          : 'border-border text-muted-foreground hover:bg-gray-50'
                      }`}>
                      {s === 'available' ? '✓ Disponible' : '✕ No disponible'}
                    </button>
                  ))}
                </div>
              </div>

              {form.status === 'available' && (
                <div className="space-y-1.5">
                  <Label>Cantidad disponible</Label>
                  <Input type="number" value={form.stock_quantity}
                    onChange={inp('stock_quantity')} min="0" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Código SKU</Label>
                <Input value={form.sku} onChange={inp('sku')} placeholder="Ej: JER-5ML-001" />
              </div>

              <div className="space-y-1.5">
                <Label>Referencia o marca</Label>
                <Input value={form.brand} onChange={inp('brand')}
                  placeholder="Ej: BD, Terumo, Sanofi" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Unidad</Label>
                  <Select value={form.unit}
                    onValueChange={v => setForm(f => ({ ...f, unit: v ?? 'UND' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['UND', 'CJA', 'PAQ', 'KG', 'LT', 'MT', 'DZN', 'PAR'].map(u =>
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stock mínimo</Label>
                  <Input type="number" value={form.min_stock}
                    onChange={inp('min_stock')} min="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>IVA (%)</Label>
                  <Input type="number" value={form.tax_rate} onChange={inp('tax_rate')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Precio costo</Label>
                  <Input type="number" value={form.cost_price} onChange={inp('cost_price')} />
                </div>
              </div>

              <Separator />

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Listas de precios
              </p>
              <div className="space-y-2">
                {[
                  { key: 'sale_price',         label: 'Precio general' },
                  { key: 'price_distributor',  label: 'Distribuidores' },
                  { key: 'price_drogueria',    label: 'Droguerías' },
                  { key: 'price_entidad',      label: 'Entidades' },
                  { key: 'price_veterinaria',  label: 'Veterinarias' },
                  { key: 'price_ecommerce',    label: 'Ecommerce' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
                    <Input type="number" value={(form as any)[key]}
                      onChange={inp(key)} className="h-7 text-sm" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar producto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
