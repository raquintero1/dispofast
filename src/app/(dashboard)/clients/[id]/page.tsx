'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client, ClientContact, Quote, Invoice } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Plus, Phone, Mail, MapPin, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'
import Link from 'next/link'
import { use } from 'react'

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [client, setClient] = useState<Client | null>(null)
  const [contacts, setContacts] = useState<ClientContact[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', position: '', email: '', phone: '', is_primary: false })
  const [savingContact, setSavingContact] = useState(false)

  async function load() {
    const supabase = createClient()
    const [clientRes, contactsRes, quotesRes, invoicesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('client_contacts').select('*').eq('client_id', id).order('is_primary', { ascending: false }),
      supabase.from('quotes').select('*').eq('client_id', id).order('date', { ascending: false }).limit(10),
      supabase.from('invoices').select('*').eq('client_id', id).order('date', { ascending: false }).limit(10),
    ])
    setClient(clientRes.data)
    setContacts(contactsRes.data ?? [])
    setQuotes(quotesRes.data ?? [])
    setInvoices(invoicesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSaveContact() {
    if (!contactForm.name.trim()) { toast.error('El nombre es requerido'); return }
    setSavingContact(true)
    const supabase = createClient()
    const { error } = await supabase.from('client_contacts').insert({ ...contactForm, client_id: id })
    if (error) toast.error('Error al guardar contacto')
    else { toast.success('Contacto agregado'); setContactOpen(false); load() }
    setSavingContact(false)
  }

  async function deleteContact(cid: string) {
    const supabase = createClient()
    await supabase.from('client_contacts').delete().eq('id', cid)
    load()
  }

  const quoteStatusLabel: Record<string, string> = {
    draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Vencida',
  }
  const invoiceStatusLabel: Record<string, string> = {
    pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada', overdue: 'Vencida', cancelled: 'Cancelada',
  }

  if (loading) return <div className="p-8 text-muted-foreground">Cargando...</div>
  if (!client) return <div className="p-8 text-muted-foreground">Cliente no encontrado</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/clients" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.code}</p>
        </div>
        <Badge variant={client.status === 'active' ? 'default' : 'secondary'} className="ml-auto">
          {client.status === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 space-y-2 text-sm">
          <p className="font-semibold text-gray-700 mb-3">Información general</p>
          {client.document_type && <p><span className="text-muted-foreground">{client.document_type}:</span> {client.document_number}</p>}
          {client.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{client.email}</p>}
          {client.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{client.phone}</p>}
          {client.city && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{client.city}, {client.country}</p>}
        </CardContent></Card>
        <Card><CardContent className="pt-5 space-y-2 text-sm">
          <p className="font-semibold text-gray-700 mb-3">Condiciones comerciales</p>
          <p><span className="text-muted-foreground">Cupo crédito:</span> {formatCurrency(client.credit_limit)}</p>
          <p><span className="text-muted-foreground">Días de pago:</span> {client.payment_days} días</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5 space-y-2 text-sm">
          <p className="font-semibold text-gray-700 mb-3">Resumen cartera</p>
          <p><span className="text-muted-foreground">Facturas pendientes:</span> {invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length}</p>
          <p><span className="text-muted-foreground">Saldo total:</span> {formatCurrency(invoices.reduce((s, i) => s + (i.balance || 0), 0))}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contactos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="quotes">Cotizaciones ({quotes.length})</TabsTrigger>
          <TabsTrigger value="invoices">Facturas ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-semibold">Contactos</CardTitle>
              <Button size="sm" onClick={() => { setContactForm({ name: '', position: '', email: '', phone: '', is_primary: false }); setContactOpen(true) }}>
                <Plus className="w-4 h-4 mr-1" /> Agregar
              </Button>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead><TableHead>Cargo</TableHead><TableHead>Email</TableHead><TableHead>Teléfono</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin contactos</TableCell></TableRow>
                ) : contacts.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name} {c.is_primary && <Badge variant="outline" className="ml-1 text-xs">Principal</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{c.position ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? '—'}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="w-8 h-8 text-destructive" onClick={() => deleteContact(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="quotes" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Número</TableHead><TableHead>Fecha</TableHead><TableHead>Válida hasta</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {quotes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin cotizaciones</TableCell></TableRow>
                ) : quotes.map(q => (
                  <TableRow key={q.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs font-medium">{q.number}</TableCell>
                    <TableCell>{formatDate(q.date)}</TableCell>
                    <TableCell>{formatDate(q.valid_until)}</TableCell>
                    <TableCell>{formatCurrency(q.total)}</TableCell>
                    <TableCell><Badge variant="outline">{quoteStatusLabel[q.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Número</TableHead><TableHead>Fecha</TableHead><TableHead>Vencimiento</TableHead><TableHead>Total</TableHead><TableHead>Saldo</TableHead><TableHead>Estado</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sin facturas</TableCell></TableRow>
                ) : invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-medium">{inv.number}</TableCell>
                    <TableCell>{formatDate(inv.date)}</TableCell>
                    <TableCell>{formatDate(inv.due_date)}</TableCell>
                    <TableCell>{formatCurrency(inv.total)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(inv.balance)}</TableCell>
                    <TableCell><Badge variant="outline">{invoiceStatusLabel[inv.status]}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agregar contacto</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5"><Label>Nombre *</Label><Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Cargo</Label><Input value={contactForm.position} onChange={e => setContactForm(f => ({ ...f, position: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Teléfono</Label><Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setContactOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveContact} disabled={savingContact}>{savingContact ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
