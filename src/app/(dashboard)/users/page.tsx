'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ShieldAlert, Pencil, KeyRound, UserCheck, UserX, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/hooks/useProfile'

type ModalMode = 'edit' | 'password' | null

export default function UsersPage() {
  const { profile: currentProfile, isAdmin } = useProfile()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', email: '' })
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').order('role').order('full_name')
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  function openEdit(u: Profile) {
    setSelectedUser(u)
    setEditForm({ full_name: u.full_name ?? '', email: u.email ?? '' })
    setModalMode('edit')
  }

  function openPassword(u: Profile) {
    setSelectedUser(u)
    setPasswordForm({ password: '', confirm: '' })
    setModalMode('password')
  }

  async function handleSaveEdit() {
    if (!selectedUser || !editForm.full_name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editForm.full_name.trim(), email: editForm.email.trim() || null })
      .eq('id', selectedUser.id)
    if (error) toast.error('Error al guardar')
    else { toast.success('Usuario actualizado'); setModalMode(null); load() }
    setSaving(false)
  }

  async function handleChangePassword() {
    if (!selectedUser) return
    if (!passwordForm.password || passwordForm.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres'); return
    }
    if (passwordForm.password !== passwordForm.confirm) {
      toast.error('Las contraseñas no coinciden'); return
    }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('admin_change_password', {
      target_user_id: selectedUser.id,
      new_password: passwordForm.password,
    })
    if (error) toast.error(`Error: ${error.message}`)
    else { toast.success('Contraseña actualizada'); setModalMode(null) }
    setSaving(false)
  }

  async function handleToggleActive(u: Profile) {
    const newStatus = !u.is_active
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', u.id)
    if (error) toast.error('Error al actualizar estado')
    else {
      toast.success(newStatus ? 'Usuario activado' : 'Usuario desactivado')
      load()
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-full bg-red-50">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">Acceso restringido</h2>
        <p className="text-muted-foreground">Este módulo es solo para administradores.</p>
      </div>
    )
  }

  const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', vendedor: 'Vendedor' }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
        </div>
        <Button variant="outline" size="icon" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">
                  {u.full_name ?? '—'}
                  {u.id === currentProfile?.id && (
                    <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge className={u.is_active
                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }>
                    {u.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 transition-colors outline-none">
                      <MoreHorizontal className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(u)} className="gap-2">
                        <Pencil className="w-4 h-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openPassword(u)} className="gap-2">
                        <KeyRound className="w-4 h-4" /> Cambiar contraseña
                      </DropdownMenuItem>
                      {u.id !== currentProfile?.id && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(u)}
                            className={`gap-2 ${u.is_active ? 'text-red-600 focus:text-red-600' : 'text-green-600 focus:text-green-600'}`}
                          >
                            {u.is_active
                              ? <><UserX className="w-4 h-4" /> Desactivar</>
                              : <><UserCheck className="w-4 h-4" /> Activar</>
                            }
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit modal */}
      <Dialog open={modalMode === 'edit'} onOpenChange={o => !o && setModalMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Nombre completo *</Label>
              <Input value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Correo electrónico</Label>
              <Input type="email" value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalMode(null)}>Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password modal */}
      <Dialog open={modalMode === 'password'} onOpenChange={o => !o && setModalMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña — {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Nueva contraseña *</Label>
              <Input type="password" value={passwordForm.password}
                onChange={e => setPasswordForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar contraseña *</Label>
              <Input type="password" value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
            {passwordForm.confirm && passwordForm.password !== passwordForm.confirm && (
              <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalMode(null)}>Cancelar</Button>
              <Button onClick={handleChangePassword} disabled={saving || passwordForm.password !== passwordForm.confirm}>
                {saving ? 'Guardando...' : 'Cambiar contraseña'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
