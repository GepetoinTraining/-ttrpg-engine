// (real) — bare passthrough. Each subtree (/dm, /play) provides its own
// AppShell layout because the sidebar nav differs between roles.

export default function RealLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
