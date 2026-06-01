'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Users, FileText, AlertTriangle, Package,
} from 'lucide-react'

interface KPIs {
  ventasMes: number
  cotizacionesPendientes: number
  carteraVencida: number
  productosStockBajo: number
}

interface MonthlySale {
  mes: string
  total: number
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs>({ ventasMes: 0, cotizacionesPendientes: 0, carteraVencida: 0, productosStockBajo: 0 })
  const [monthlySales, setMonthlySales] = useState<MonthlySale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const today = now.toISOString().split('T')[0]

      const [ventasRes, cotizRes, carteraRes, stockRes, ventas6Res] = await Promise.all([
        supabase.from('sales_orders').select('total').gte('date', firstDay).in('status', ['confirmed', 'delivered']),
        supabase.from('quotes').select('id', { count: 'exact' }).in('status', ['draft', 'sent']),
        supabase.from('invoices').select('balance').lt('due_date', today).in('status', ['pending', 'partial', 'overdue']),
        supabase.from('products').select('id', { count: 'exact' }).eq('is_active', true).filter('stock_quantity', 'lt', 'min_stock'),
        supabase.from('sales_orders').select('date, total').in('status', ['confirmed', 'delivered']).gte('date', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]),
      ])

      const ventasMes = ventasRes.data?.reduce((s, r) => s + (r.total || 0), 0) ?? 0
      const cotizacionesPendientes = cotizRes.count ?? 0
      const carteraVencida = carteraRes.data?.reduce((s, r) => s + (r.balance || 0), 0) ?? 0
      const productosStockBajo = stockRes.count ?? 0

      // Build monthly chart data (last 6 months)
      const months: Record<string, number> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
        months[key] = 0
      }
      ventas6Res.data?.forEach(r => {
        const d = new Date(r.date + 'T00:00:00')
        const key = d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
        if (key in months) months[key] += r.total || 0
      })
      const chart = Object.entries(months).map(([mes, total]) => ({ mes, total }))

      setKpis({ ventasMes, cotizacionesPendientes, carteraVencida, productosStockBajo })
      setMonthlySales(chart)
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Ventas del mes', value: formatCurrency(kpis.ventasMes), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Cotizaciones pendientes', value: kpis.cotizacionesPendientes.toString(), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Cartera vencida', value: formatCurrency(kpis.carteraVencida), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Stock bajo mínimo', value: kpis.productosStockBajo.toString(), icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Resumen general del negocio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className={`p-3 rounded-lg ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? '...' : value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ventas últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Cargando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlySales} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
