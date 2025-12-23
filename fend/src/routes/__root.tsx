import { Outlet } from '@tanstack/react-router'
import { Shell, Navbar, NavbarBrand, NavbarItem, NavbarGroup } from '@styles/processors/_internal'
import { Avatar } from '@styles/processors/_internal'
import { ToastProvider } from '@styles/processors/_internal'
import { AuthProvider, useAuthContext } from '@auth/provider'
import { Swords, Map, Users, Calendar, Menu } from 'lucide-react'

export function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell navbar={<RootNavbar />}>
          <Outlet />
        </Shell>
      </ToastProvider>
    </AuthProvider>
  )
}

function RootNavbar() {
  const { isSignedIn, user } = useAuthContext()

  return (
    <Navbar
      logo={
        <NavbarBrand href="/">
          <Swords size={24} style={{ color: '#f59e0b' }} />
          <span>TTRPG Engine</span>
        </NavbarBrand>
      }
      actions={
        isSignedIn ? (
          <NavbarGroup>
            <Avatar
              src={user?.imageUrl}
              name={user?.name}
              size="sm"
              status="online"
            />
          </NavbarGroup>
        ) : (
          <NavbarItem href="/login">Sign In</NavbarItem>
        )
      }
    />
  )
}
