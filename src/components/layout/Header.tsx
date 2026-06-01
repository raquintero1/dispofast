'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User } from 'lucide-react'
import { useEffect, useState } from 'react'

export function Header() {
  const router = useRouter()
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = email ? email[0].toUpperCase() : 'U'

  return (
    <header className="h-14 border-b bg-white flex items-center justify-end px-6 shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-gray-100 transition-colors outline-none">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-600 hidden sm:block max-w-40 truncate">{email}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled>
            <User className="w-4 h-4 mr-2" />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
