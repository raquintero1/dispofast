'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Client } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Pencil, Eye, Building2, User, Upload, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { DEPARTAMENTOS, CLASIFICACIONES } from '@/lib/utils/colombia'
import { useProfile } from '@/hooks/useProfile'

type ClientTypeOption = 'empresa' | 'persona_natural'

const EMPTY_EMPRESA = {
  name: '', document_number: '', retefuente: 'no',
  legal_rep_name: '', legal_rep_cedula: '',
  phone: '', email: '', country: 'Colombia', department: '', city: '', address: '',
  advisor_name: '', commercial_discount: 'no_aplica', classification: '',
  payment_days: '30', credit_limit: '0', notes: '',
}

const EMPTY_NATURAL = {
  name: '', document_number: '', retefuente: 'no',
  phone: '', email: '', country: 'Colombia', department: '', city: '', address: '',
  advisor_name: '', commercial_discount: 'no_aplica', classification: '',
  payment_days: '30', credit_limit: '0', notes: '',
}

const CLASIFICACION_LABEL: Record<string, string> = Object.fromEntries(
  CLASIFICACIONES.map(c => [c.value, c.label])
)

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [clientType, setClientType] = useState<ClientTypeOption>('empresa')
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_EMPRESA)
  const [files, setFiles] = useState<{ rut?: File; camara?: File; cedula?: File }>({})
  const [saving, setSaving] = useState(false)

  const { profile, isAdmin, userId, loading: profileLoading } = useProfile()

  async function loadClients() {
    const supabase = createClient()
    let q = supabase.from('clients').select('*').order('name')
    if (!isAdmin && userId) q = q.eq('created_by', userId)
    const { data } = await q
    setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (!profileLoading) loadClients() }, [profileLoading, isAdmin, userId])

  // Nombre del asesor desde el perfil autenticado
  const advisorName = profile?.full_name ?? ''

  function openNew() {
    setEditing(null)
    setStep(1)
    setClientType('empresa')
    setForm({ ...EMPTY_EMPRESA, advisor_name: advisorName })
    setFiles({})
    setOpen(true)
  }

  function selectType(type: ClientTypeOption) {
    setClientType(type)
    const base = type === 'empresa' ? EMPTY_EMPRESA : EMPTY_NATURAL
    setForm({ ...base, advisor_name: advisorName })
    setStep(2)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setClientType(c.client_type)
    setForm({
      name: c.name,
      document_number: c.document_number ?? '',
      retefuente: c.retefuente ? 'si' : 'no',
      legal_rep_name: c.legal_rep_name ?? '',
      legal_rep_cedula: c.legal_rep_cedula ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      country: c.country ?? 'Colombia',
      department: c.department ?? '',
      city: c.city ?? '',
      address: c.address ?? '',
      advisor_name: c.advisor_name ?? '',
      commercial_discount: c.commercial_discount ?? 'no_aplica',
      classification: c.classification ?? '',
      payment_days: c.payment_days?.toString() ?? '30',
      credit_limit: c.credit_limit?.toString() ?? '0',
      notes: c.notes ?? '',
    })
    setFiles({})
    setStep(2)
    setOpen(true)
  }

  async function uploadFile(file: File, clientId: string, docType: string): Promise<string | null> {
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${clientId}/${docType}.${ext}`
    const { error } = await supabase.storage.from('client-documents').upload(path, file, { upsert: true })
    if (error) return null
    const { data } = supabase.storage.from('client-documents').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (clientType === 'empresa' && !form.document_number.trim()) { toast.error('El NIT es requerido'); return }
    if (clientType === 'persona_natural' && !form.document_number.trim()) { toast.error('La cédula es requerida'); return }

    const supabase = createClient()

    // CORRECCIÓN 1: Verificar cliente duplicado globalmente
    if (!editing) {
      const docNum = form.document_number.trim()
      const email = form.email.trim()

      const [docCheck, emailCheck] = await Promise.all([
        docNum
          ? supabase.from('clients').select('id').eq('document_number', docNum).maybeSingle()
          : Promise.resolve({ data: null }),
        email
          ? supabase.from('clients').select('id').eq('email', email).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (docCheck.data || emailCheck.data) {
        toast.error('Este cliente ya está registrado en la plataforma. Comunícate con el administrador si necesitas acceso.')
        return
      }
    }

    setSaving(true)

    const payload: Record<string, unknown> = {
      client_type: clientType,
      name: form.name.trim(),
      document_type: clientType === 'empresa' ? 'NIT' : 'CC',
      document_number: form.document_number.trim() || null,
      retefuente: form.retefuente === 'si',
      legal_rep_name: clientType === 'empresa' ? (form.legal_rep_name || null) : null,
      legal_rep_cedula: clientType === 'empresa' ? (form.legal_rep_cedula || null) : null,
      phone: form.phone || null,
      email: form.email || null,
      country: form.country || 'Colombia',
      department: form.department || null,
      city: form.city || null,
      address: form.address || null,
      advisor_name: form.advisor_name || null,
      commercial_discount: form.commercial_discount || 'no_aplica',
      classification: form.classification || null,
      payment_days: parseInt(form.payment_days) || 30,
      credit_limit: parseFloat(form.credit_limit) || 0,
      notes: form.notes || null,
    }

    // Set created_by for new clients
    if (!editing) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) payload.created_by = user.id
    }

    let savedId = editing?.id
    if (editing) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editing.id)
      if (error) { toast.error('Error al actualizar cliente'); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('clients').insert(payload).select().single()
      if (error || !data) { toast.error('Error al crear cliente'); setSaving(false); return }
      savedId = data.id
    }

    // Upload documents (empresa only)
    if (clientType === 'empresa' && savedId) {
      const updates: Record<string, string | null> = {}
      if (files.rut) updates.rut_url = await uploadFile(files.rut, savedId, 'rut')
      if (files.camara) updates.camara_comercio_url = await uploadFile(files.camara, savedId, 'camara_comercio')
      if (files.cedula) updates.cedula_rep_legal_url = await uploadFile(files.cedula, savedId, 'cedula_rep_legal')
      if (Object.keys(updates).length > 0) {
        await supabase.from('clients').update(updates).eq('id', savedId)
      }
    }

    toast.success(editing ? 'Cliente actualizado' : 'Cliente creado')
    setOpen(false)
    loadClients()
    setSaving(false)
  }

  const f = (key: string) => form[key] ?? ''
  const set = (key: string) => (v: string) => setForm(prev => ({ ...prev, [key]: v }))
  const inp = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clientes registrados</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nuevo cliente
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, código o ciudad..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Asesor</TableHead>
              <TableHead>Dcto.</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No se encontraron clientes</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.code}</TableCell>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {c.client_type === 'empresa' ? 'Empresa' : 'Persona Natural'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.classification ? CLASIFICACION_LABEL[c.classification] ?? c.classification : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.city ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.advisor_name ?? '—'}</TableCell>
                <TableCell className="text-sm">
                  {c.commercial_discount === 'no_aplica' ? '—' : `${c.commercial_discount}%`}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Link href={`/clients/${c.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar cliente' : step === 1 ? 'Nuevo cliente' : clientType === 'empresa' ? 'Nueva empresa' : 'Nueva persona natural'}
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Type selection */}
          {step === 1 && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-6 text-center">¿Qué tipo de cliente es?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => selectType('empresa')}
                  className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <Building2 className="w-10 h-10 text-muted-foreground group-hover:text-blue-600" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Empresa</p>
                    <p className="text-xs text-muted-foreground mt-1">Persona jurídica con NIT</p>
                  </div>
                </button>
                <button
                  onClick={() => selectType('persona_natural')}
                  className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-border hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <User className="w-10 h-10 text-muted-foreground group-hover:text-blue-600" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">Persona Natural</p>
                    <p className="text-xs text-muted-foreground mt-1">Persona con cédula</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Form */}
          {step === 2 && (
            <div className="space-y-5 pt-1">
              {/* Back button for new clients */}
              {!editing && (
                <button onClick={() => setStep(1)} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  ← Cambiar tipo
                </button>
              )}

              {/* Datos principales */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {clientType === 'empresa' ? 'Datos de la empresa' : 'Datos del cliente'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label>{clientType === 'empresa' ? 'Nombre / Razón social *' : 'Nombre completo *'}</Label>
                    <Input value={f('name')} onChange={inp('name')} placeholder={clientType === 'empresa' ? 'Ej: Farmacéutica S.A.S.' : 'Ej: Juan Pérez'} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{clientType === 'empresa' ? 'NIT *' : 'Cédula *'}</Label>
                    <Input value={f('document_number')} onChange={inp('document_number')} placeholder={clientType === 'empresa' ? '900.123.456-7' : '1.234.567.890'} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>¿Aplica retefuente?</Label>
                    <Select value={f('retefuente')} onValueChange={set('retefuente')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="si">Sí</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Representante legal (solo empresa) */}
              {clientType === 'empresa' && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Representante legal</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Nombre</Label>
                        <Input value={f('legal_rep_name')} onChange={inp('legal_rep_name')} placeholder="Nombre completo" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cédula</Label>
                        <Input value={f('legal_rep_cedula')} onChange={inp('legal_rep_cedula')} placeholder="No. de cédula" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Contacto */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contacto</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Teléfono</Label>
                    <Input value={f('phone')} onChange={inp('phone')} placeholder="300 123 4567" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Correo electrónico</Label>
                    <Input type="email" value={f('email')} onChange={inp('email')} placeholder="correo@empresa.com" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Ubicación */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ubicación</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>País</Label>
                    <Input value={f('country')} onChange={inp('country')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Departamento</Label>
                    <Select value={f('department')} onValueChange={set('department')}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTAMENTOS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ciudad</Label>
                    <Input value={f('city')} onChange={inp('city')} placeholder="Bogotá" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Dirección</Label>
                    <Input value={f('address')} onChange={inp('address')} placeholder="Calle 123 # 45-67" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Comercial */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Condiciones comerciales</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Asesor / Vendedor</Label>
                    {isAdmin ? (
                      <Input value={f('advisor_name')} onChange={inp('advisor_name')} placeholder="Nombre del asesor" />
                    ) : (
                      <div className="flex items-center h-9 px-3 rounded-lg border bg-gray-50 text-sm text-gray-700 gap-2">
                        <span className="flex-1">{f('advisor_name') || advisorName}</span>
                        <span className="text-xs text-muted-foreground">Automático</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Descuento comercial</Label>
                    <Select value={f('commercial_discount')} onValueChange={set('commercial_discount')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_aplica">No aplica</SelectItem>
                        <SelectItem value="1">1%</SelectItem>
                        <SelectItem value="2">2%</SelectItem>
                        <SelectItem value="3">3%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Clasificación</Label>
                    <Select value={f('classification')} onValueChange={set('classification')}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar clasificación" /></SelectTrigger>
                      <SelectContent>
                        {CLASIFICACIONES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Días de crédito</Label>
                    <Input type="number" value={f('payment_days')} onChange={inp('payment_days')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cupo de crédito (COP)</Label>
                    <Input type="number" value={f('credit_limit')} onChange={inp('credit_limit')} />
                  </div>
                </div>
              </div>

              {/* Documentos (solo empresa) */}
              {clientType === 'empresa' && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documentos</p>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { key: 'rut', label: 'RUT', existing: editing?.rut_url },
                        { key: 'camara', label: 'Cámara de Comercio', existing: editing?.camara_comercio_url },
                        { key: 'cedula', label: 'Cédula del Representante Legal', existing: editing?.cedula_rep_legal_url },
                      ].map(({ key, label, existing }) => (
                        <div key={key} className="flex items-center gap-3 p-3 border rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{label}</p>
                            {existing && !files[key as keyof typeof files] && (
                              <a href={existing} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline truncate block">
                                Ver documento actual
                              </a>
                            )}
                            {files[key as keyof typeof files] && (
                              <p className="text-xs text-green-600">{(files[key as keyof typeof files] as File).name}</p>
                            )}
                          </div>
                          <label className="cursor-pointer">
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) setFiles(prev => ({ ...prev, [key]: file }))
                              }}
                            />
                            <span className="text-xs px-3 py-1.5 border rounded-md hover:bg-gray-50 flex items-center gap-1.5">
                              <Upload className="w-3 h-3" />
                              {files[key as keyof typeof files] ? 'Cambiar' : existing ? 'Actualizar' : 'Subir'}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Formatos aceptados: PDF, JPG, PNG</p>
                  </div>
                </>
              )}

              {/* Notas */}
              <div className="space-y-1.5">
                <Label>Notas</Label>
                <Input value={f('notes')} onChange={inp('notes')} placeholder="Observaciones adicionales" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cliente'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
