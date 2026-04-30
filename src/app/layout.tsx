import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claude DM Helper — Wireframes',
  description: 'Centaur DM build · v0.1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
