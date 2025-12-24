import { Outlet, useNavigate } from '@tanstack/react-router'
import { useUser, UserButton } from '@clerk/clerk-react'
import { Shell } from '../styles/processors/_internal/organism/shell'
import { Sidebar, SidebarItem, SidebarSection } from '../styles/processors/_internal/organism/sidebar'
import { Navbar, NavbarBrand } from '../styles/processors/_internal/organism/navbar'
import { OnboardingWorld } from '../styles/processors/_internal/worlds/OnboardingWorld'
import { Avatar } from '../styles/processors/_internal/atomic/avatar'
import { trpc } from '../utils/trpc'

export function RootLayout() {
  const { isSignedIn, isLoaded, user } = useUser()
  const navigate = useNavigate()

  // Check if user needs onboarding
  const { data: profile, isLoading, refetch } = trpc.user.me.useQuery(undefined, {
    enabled: isSignedIn,
    retry: false,  // Don't retry on 500 errors
  })

  // Mutation for completing onboarding
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: async () => {
      await refetch()  // Wait for refetch to complete
      navigate({ to: '/' })  // Wormhole to campaigns
    },
  })

  // Loading state
  if (!isLoaded || (isSignedIn && isLoading)) {
    return <LoadingScreen />
  }

  // Not signed in - just render outlet (login page, etc)
  if (!isSignedIn) {
    return <Outlet />
  }

  // Needs onboarding (check inside preferences!)
  if (!profile?.preferences?.onboardingComplete) {
    return (
      <OnboardingWorld
        onComplete={(data) => {
          completeOnboarding.mutate(data)
        }}
        isLoading={completeOnboarding.isPending}
      />
    )
  }

  // Normal app with Shell - pass user down through the tree
  return (
    <Shell
      navbar={<AppNavbar user={user} profile={profile} />}
      sidebar={<AppSidebar />}
    >
      <Outlet />
    </Shell>
  )
}

function AppSidebar() {
  return (
    <Sidebar>
      <SidebarSection title="Play">
        <SidebarItem icon="🎭" href="/">Campaigns</SidebarItem>
        <SidebarItem icon="⚔️" href="/characters">Characters</SidebarItem>
      </SidebarSection>
    </Sidebar>
  )
}

interface AppNavbarProps {
  user: any
  profile: any
}

function AppNavbar({ user, profile }: AppNavbarProps) {
  return (
    <Navbar
      logo={<NavbarBrand>TTRPG Engine</NavbarBrand>}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            {profile?.displayName || user?.firstName || 'Adventurer'}
          </span>
          <UserButton afterSignOutUrl="/login" />
        </div>
      }
    />
  )
}

function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      color: '#94a3b8',
    }}>
      Loading...
    </div>
  )
}
