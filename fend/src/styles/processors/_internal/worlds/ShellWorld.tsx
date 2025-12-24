import { Shell, ShellContent, PageHeader, useShell } from '../organism/shell'
import { Sidebar, SidebarItem, SidebarSection } from '../organism/sidebar'
import { Navbar, NavbarBrand } from '../organism/navbar'

export function AppLayout() {
  return (
    <Shell
      navbar={
        <Navbar logo={<NavbarBrand>TTRPG Engine</NavbarBrand>} />
      }
      sidebar={
        <Sidebar>
          <SidebarSection title="Play">
            <SidebarItem icon="🎭" href="/">Campaigns</SidebarItem>
            <SidebarItem icon="⚔️" href="/characters">Characters</SidebarItem>
          </SidebarSection>
        </Sidebar>
      }
    >
      <ShellContent>
        <PageHeader title="Your Campaigns" description="Manage your adventures" />
        {/* Content */}
      </ShellContent>
    </Shell>
  )
}
