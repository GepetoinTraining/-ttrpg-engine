/**
 * 404 boundary. Logs unmatched paths for visibility (Vercel captures
 * `console.error`).
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        padding: '4rem 2rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: '#eee',
        background: '#111',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        no node at that .tp address.
      </h1>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        404 — the world graph has no entry for this path.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.5rem 1rem',
          background: '#333',
          color: '#fff',
          border: '1px solid #555',
          borderRadius: 4,
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        back to the workspace
      </Link>
    </div>
  )
}
