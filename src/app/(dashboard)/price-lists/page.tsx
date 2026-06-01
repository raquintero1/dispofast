'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  FileSpreadsheet, FileText, Upload, RefreshCw,
  CheckCircle2, Clock, ExternalLink, ShieldAlert,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { toast } from 'sonner'

interface PriceListRecord {
  id: string
  list_type: string
  file_name: string | null
  file_url: string | null
  updated_at: string | null
}

const LISTS = [
  { type: 'distributor', label: 'Lista de precios Distribuidores', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { type: 'entities',    label: 'Lista de precios Entidades',      color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { type: 'drogueria',   label: 'Lista de precios Droguerías',     color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  { type: 'veterinaria', label: 'Lista de precios Veterinarias',   color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { type: 'ecommerce',   label: 'Lista de precios Ecommerce',      color: 'text-pink-700',   bg: 'bg-pink-50',   border: 'border-pink-200' },
]

export default function PriceListsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [records, setRecords] = useState<Record<string, PriceListRecord>>({})
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentTypeRef = useRef<string>('')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      const admin = profile?.role === 'admin'
      setIsAdmin(admin)
      if (admin) loadRecords()
    }
    init()
  }, [])

  async function loadRecords() {
    const supabase = createClient()
    const { data } = await supabase.from('price_lists').select('*')
    const map: Record<string, PriceListRecord> = {}
    ;(data ?? []).forEach(r => { map[r.list_type] = r })
    setRecords(map)
  }

  function triggerUpload(listType: string) {
    currentTypeRef.current = listType
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const listType = currentTypeRef.current
    if (!listType) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'pdf'].includes(ext ?? '')) {
      toast.error('Solo se aceptan archivos .xlsx, .xls o .pdf')
      return
    }

    setUploading(listType)
    const supabase = createClient()
    // Fixed path per list type — delete first to avoid upsert conflicts
    const path = `${listType}/lista.${ext}`
    await supabase.storage.from('price-lists').remove([path])

    const { error: upErr } = await supabase.storage
      .from('price-lists')
      .upload(path, file)

    if (upErr) { toast.error(`Error al subir: ${upErr.message}`); setUploading(null); return }

    const fileUrl = supabase.storage.from('price-lists').getPublicUrl(path).data.publicUrl

    const { error: dbErr } = await supabase
      .from('price_lists')
      .update({ file_name: file.name, file_url: fileUrl, updated_at: new Date().toISOString() })
      .eq('list_type', listType)

    if (dbErr) { toast.error('Error al guardar el registro'); setUploading(null); return }

    toast.success(`Lista actualizada: ${file.name}`)
    e.target.value = ''
    setUploading(null)
    loadRecords()
  }

  // Loading state
  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Verificando acceso...
      </div>
    )
  }

  // No access
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-full bg-red-50">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Acceso restringido</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Este módulo está disponible únicamente para administradores.
          Contacta con el administrador del sistema si necesitas acceso.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lista de Precios</h1>
          <p className="text-sm text-muted-foreground">Solo visible para administradores</p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50 gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" /> Solo Admin
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Estas listas definen los precios sugeridos según tipo de cliente en Cotizaciones y Órdenes de Compra.
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {LISTS.map(({ type, label, color, bg, border }, idx) => {
            const record = records[type]
            const hasFile = !!record?.file_url
            const isUploading = uploading === type

            return (
              <div key={type}>
                {idx > 0 && <Separator />}
                <div className={`flex items-center gap-4 p-4 rounded-xl border ${border} ${bg} mt-${idx > 0 ? '3' : '0'}`}>
                  {/* Icon */}
                  <div className={`p-3 rounded-lg bg-white border ${border} shrink-0`}>
                    <FileSpreadsheet className={`w-6 h-6 ${color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${color}`}>{label}</p>
                    {hasFile ? (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-48">{record.file_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {record.updated_at ? formatDate(record.updated_at) : '—'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2 className="w-3 h-3" /> Actualizada
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">Sin archivo adjunto</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {hasFile && (
                      <a
                        href={record.file_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${buttonVariants({ variant: 'outline', size: 'sm' })} gap-1.5 text-xs`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Ver
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant={hasFile ? 'outline' : 'default'}
                      onClick={() => triggerUpload(type)}
                      disabled={isUploading}
                      className="gap-1.5 text-xs"
                    >
                      {isUploading ? (
                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Subiendo...</>
                      ) : (
                        <><Upload className="w-3.5 h-3.5" /> {hasFile ? 'Actualizar' : 'Subir'}</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 pb-4">
          <p className="text-sm text-amber-800">
            <strong>Nota:</strong> Los archivos subidos aquí son de referencia para el equipo.
            Para que los precios se apliquen automáticamente en cotizaciones y órdenes,
            actualiza los campos de lista de precios en cada producto desde el módulo de <strong>Inventario</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,.pdf"
        onChange={handleFileChange}
      />
    </div>
  )
}
