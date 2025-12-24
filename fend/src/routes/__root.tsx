import { Outlet, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { Shell } from '../styles/processors/_internal/organism/shell'
import { Sidebar, SidebarItem, SidebarSection } from '../styles/processors/_internal/organism/sidebar'
import { Navbar, NavbarBrand } from '../styles/processors/_internal/organism/navbar'
import { OnboardingWorld } from '../styles/processors/_internal/worlds/OnboardingWorld'
import { trpc } from '../utils/trpc'

export function RootLayout() {
  const { isSignedIn, isLoaded } = useUser()
  const navigate = useNavigate()

  // Check if user needs onboarding
  const { data: profile, isLoading, refetch } = trpc.user.me.useQuery(undefined, {
    enabled: isSignedIn,
    retry: false,  // Don't retry on 500 errors
  })

  // Mutation for completing onboarding
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => {
      refetch()  // Refetch profile after completing
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

  // Normal app with Shell
  return (
    <Shell
      navbar={<AppNavbar />}
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

function AppNavbar() {
  return (
    <Navbar logo={<NavbarBrand>TTRPG Engine</NavbarBrand>} />
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
