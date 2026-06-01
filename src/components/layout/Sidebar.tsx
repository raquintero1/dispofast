'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, FileText,
  ShoppingCart, CreditCard, Zap, Tags, UserCog,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/clients',      label: 'Clientes',          icon: Users },
  { href: '/quotes',       label: 'Cotizaciones',      icon: FileText },
  { href: '/sales',        label: 'Órdenes de Compra', icon: ShoppingCart },
  { href: '/inventory',    label: 'Inventario',        icon: Package },
  { href: '/portfolio',    label: 'Gestión de Cartera', icon: CreditCard },
]

const adminItems = [
  { href: '/price-lists',  label: 'Lista de Precios',  icon: Tags },
  { href: '/users',        label: 'Usuarios',           icon: UserCog },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).single()
      setIsAdmin(profile?.role === 'admin')
    })
  }, [])

  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col h-screen fixed left-0 top-0 z-40">
      <div className="p-5 border-b border-gray-700 flex items-center gap-2">
        <Zap className="w-6 h-6 text-blue-400" />
        <span className="text-lg font-bold tracking-tight">Dispofast</span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {allItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {isAdmin && (
        <div className="p-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 px-3 py-1">Administrador</p>
        </div>
      )}
    </aside>
  )
}
