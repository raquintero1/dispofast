'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Quote } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada', rejected: 'Rechazada', expired: 'Vencida',
}
const STATUS_COLORS: Record<string, string> = {
  draft: 'secondary', sent: 'outline', approved: 'default', rejected: 'destructive', expired: 'secondary',
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const { isAdmin, userId, loading: profileLoading } = useProfile()

  useEffect(() => {
    if (profileLoading) return
    async function load() {
      const supabase = createClient()
      let q = supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false })
      if (!isAdmin && userId) q = q.eq('created_by', userId)
      const { data } = await q
      setQuotes(data ?? [])
      setLoading(false)
    }
    load()
  }, [profileLoading, isAdmin, userId])

  const filtered = quotes.filter(q => {
    const matchSearch = q.number.toLowerCase().includes(search.toLowerCase()) ||
      (q as any).clients?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">{quotes.length} cotizaciones</p>
        </div>
        <Link href="/quotes/new" className={`${buttonVariants()} gap-2`}>
          <Plus className="w-4 h-4" /> Nueva cotización
        </Link>
      </div>

      <Card>
        <div className="p-4 border-b flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Válida hasta</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No se encontraron cotizaciones</TableCell></TableRow>
            ) : filtered.map(q => (
              <TableRow key={q.id}>
                <TableCell className="font-mono text-xs font-medium">{q.number}</TableCell>
                <TableCell className="font-medium">{(q as any).clients?.name ?? '—'}</TableCell>
                <TableCell>{formatDate(q.date)}</TableCell>
                <TableCell>{formatDate(q.valid_until)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(q.total)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[q.status] as any}>{STATUS_LABELS[q.status]}</Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/quotes/${q.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
