'use client'

/**
 * Root-level error boundary. Caught by Next when any segment throws during
 * rendering or a Server Action fails. Vercel automatically captures the
 * `console.error` for log aggregation.
 */

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[error.tsx]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

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
        something fell over.
      </h1>
      <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
        the .tpb is intact — only this view broke. try resetting.
      </p>
      <pre
        style={{
          background: '#1a1a1a',
          padding: '1rem',
          borderRadius: 4,
          overflow: 'auto',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
        }}
      >
        {error.message}
        {error.digest ? `\n\ndigest: ${error.digest}` : ''}
      </pre>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1rem',
          background: '#333',
          color: '#fff',
          border: '1px solid #555',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        retry
      </button>
    </div>
  )
}
