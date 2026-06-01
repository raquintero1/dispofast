'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SalesOrder } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, Eye, Plus, MoreHorizontal, Paperclip, FileText, ExternalLink } from 'lucide-react'
import { formatCurrency, formatDate, today } from '@/lib/utils/format'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import { toast } from 'sonner'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', delivered: 'Entregado', cancelled: 'Cancelado',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'secondary', confirmed: 'outline', delivered: 'default', cancelled: 'destructive',
}

export default function SalesPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [advisorFilter, setAdvisorFilter] = useState('all')
  const { isAdmin, userId, loading: profileLoading } = useProfile()

  // Invoice dialog
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)
  const [invForm, setInvForm] = useState({ number: '', date: today() })
  const [invFile, setInvFile] = useState<File | null>(null)
  const [savingInv, setSavingInv] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profileLoading) return
    async function load() {
      const supabase = createClient()
      let q = supabase.from('sales_orders').select('*, clients(name)').order('created_at', { ascending: false })
      if (!isAdmin && userId) q = q.eq('created_by', userId)
      const { data } = await q
      setOrders(data ?? [])
      setLoading(false)
    }
    load()
  }, [profileLoading, isAdmin, userId])

  async function handleSaveInvoice() {
    if (!selectedOrder) return
    if (!invForm.number.trim()) { toast.error('El número de factura es requerido'); return }
    if (!invForm.date) { toast.error('La fecha es requerida'); return }
    if (!invFile) { toast.error('Debes adjuntar el archivo de factura'); return }
    setSavingInv(true)
    const supabase = createClient()
    const ext = invFile.name.split('.').pop()
    const path = `${selectedOrder.id}/factura.${ext}`
    await supabase.storage.from('sales-invoices').remove([path])
    const { error: upErr } = await supabase.storage.from('sales-invoices').upload(path, invFile)
    if (upErr) { toast.error('Error al subir el archivo'); setSavingInv(false); return }
    const url = supabase.storage.from('sales-invoices').getPublicUrl(path).data.publicUrl
    const { error } = await supabase.from('sales_orders')
      .update({ invoice_number: invForm.number.trim(), invoice_date: invForm.date, invoice_url: url })
      .eq('id', selectedOrder.id)
    if (error) toast.error('Error al guardar')
    else { toast.success('Factura adjuntada'); setInvoiceOpen(false); }
    setSavingInv(false)
    // Refresh orders
    const supabase2 = createClient()
    let q = supabase2.from('sales_orders').select('*, clients(name)').order('created_at', { ascending: false })
    if (!isAdmin && userId) q = q.eq('created_by', userId)
    const { data } = await q
    setOrders(data ?? [])
  }

  function openInvoiceDialog(o: SalesOrder) {
    setSelectedOrder(o)
    setInvForm({ number: o.invoice_number ?? '', date: o.invoice_date ?? today() })
    setInvFile(null)
    setInvoiceOpen(true)
  }

  const advisors = [...new Set(orders.map(o => o.advisor_name).filter(Boolean))] as string[]

  const filtered = orders.filter(o => {
    const matchSearch = o.number.toLowerCase().includes(search.toLowerCase()) ||
      (o as any).clients?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (o.advisor_name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchAdvisor = advisorFilter === 'all' || o.advisor_name === advisorFilter
    return matchSearch && matchStatus && matchAdvisor
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-sm text-muted-foreground">{orders.length} órdenes</p>
        </div>
        <Link href="/sales/create" className={`${buttonVariants()} gap-2`}>
          <Plus className="w-4 h-4" /> Nueva orden
        </Link>
      </div>

      <Card>
        <div className="p-4 border-b flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && advisors.length > 0 && (
            <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos los asesores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los asesores</SelectItem>
                {advisors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              {isAdmin && <TableHead>Asesor</TableHead>}
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-muted-foreground">No se encontraron pedidos</TableCell></TableRow>
            ) : filtered.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs font-medium">{o.number}</TableCell>
                <TableCell className="font-medium">{(o as any).clients?.name ?? '—'}</TableCell>
                {isAdmin && <TableCell className="text-sm text-muted-foreground">{o.advisor_name ?? '—'}</TableCell>}
                <TableCell>{formatDate(o.date)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(o.total)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[o.status] as any}>{STATUS_LABELS[o.status]}</Badge>
                </TableCell>
                <TableCell>
                  {o.invoice_url ? (
                    <a href={o.invoice_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                      <Paperclip className="w-3.5 h-3.5" /> {o.invoice_number ?? 'Ver'}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Link href={`/sales/${o.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                    {isAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors outline-none">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openInvoiceDialog(o)} className="gap-2">
                            <FileText className="w-4 h-4" />
                            {o.invoice_url ? 'Ver / reemplazar factura' : 'Adjuntar factura'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Invoice dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-blue-600" />
              {selectedOrder?.invoice_url ? 'Ver / reemplazar factura' : 'Adjuntar factura'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {selectedOrder?.invoice_url && (
              <a href={selectedOrder.invoice_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <ExternalLink className="w-4 h-4" />
                Ver factura actual: {selectedOrder.invoice_number}
              </a>
            )}
            <div className="space-y-1.5">
              <Label>Número de factura *</Label>
              <Input value={invForm.number} onChange={e => setInvForm(f => ({ ...f, number: e.target.value }))}
                placeholder="Ej: FE-0001" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de factura *</Label>
              <Input type="date" value={invForm.date} onChange={e => setInvForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Archivo de factura * (PDF o XML)</Label>
              <div className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                onClick={() => fileRef.current?.click()}>
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                {invFile ? (
                  <span className="text-sm truncate text-green-700">{invFile.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Haz clic para seleccionar PDF o XML</span>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.xml"
                onChange={e => setInvFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveInvoice} disabled={savingInv}>
                {savingInv ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" className="hidden" accept=".pdf,.xml"
        onChange={e => setInvFile(e.target.files?.[0] ?? null)} />
    </div>
  )
}
