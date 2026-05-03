'use client'

/**
 * useActiveCharacter — shared hook for /dm and /play.
 *
 * Reads the active character cert from IDB on mount, then optionally
 * fetches the character data sheet from /api/character/:id when
 * `withSheet: true`.
 */

import * as React from 'react'
import { getActiveCharacterCert, type CharacterCert } from '@/lib/character-cert'
import { authFetch } from '@/lib/auth-fetch'

export interface ActiveCharacterState {
  loading: boolean
  cert: CharacterCert | null
  sheet: any | null
  error: string | null
}

interface Options {
  withSheet?: boolean
}

export function useActiveCharacter(opts: Options = {}): ActiveCharacterState {
  const { withSheet = false } = opts
  const [state, setState] = React.useState<ActiveCharacterState>({
    loading: true,
    cert: null,
    sheet: null,
    error: null,
  })

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cert = await getActiveCharacterCert()
        if (cancelled) return
        if (!cert) {
          setState({ loading: false, cert: null, sheet: null, error: 'no_active_character' })
          return
        }
        if (!withSheet || !cert.characterDataId) {
          setState({ loading: false, cert, sheet: null, error: null })
          return
        }
        const res = await authFetch(`/api/character/${encodeURIComponent(cert.characterDataId)}`)
        if (!res.ok) {
          setState({ loading: false, cert, sheet: null, error: `sheet_fetch_${res.status}` })
          return
        }
        const sheet = await res.json()
        if (cancelled) return
        setState({ loading: false, cert, sheet, error: null })
      } catch (e: unknown) {
        if (cancelled) return
        setState({
          loading: false,
          cert: null,
          sheet: null,
          error: e instanceof Error ? e.message : 'load_failed',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [withSheet])

  return state
}
