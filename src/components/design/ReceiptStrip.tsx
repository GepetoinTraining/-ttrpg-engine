'use client'

/**
 * Receipt strip — first-class display of recent .mf receipts (W5.3).
 *
 * Per `MM-MF-TP-TPB.md` Theorem 1: every computation produces a receipt R
 * as a side effect of the .mf forward pass. Surfaces that compute (Combat,
 * Sheet, Markets, Crafts) show this strip so the player sees the math
 * proof — not hidden audit data.
 */

import * as React from 'react'
import type { Receipt } from '../../../engine/types'

interface ReceiptStripProps {
  receipts: Receipt[]
  /** Cap. Most surfaces want 5-10. */
  limit?: number
  /** Vertical (default) or horizontal layout. */
  layout?: 'horizontal' | 'vertical'
}

const MF_LABEL: Record<string, string> = {
  mf_dice: 'dice',
  mf_check: 'check',
  mf_damage: 'damage',
  mf_smelt: 'smelt',
  mf_forge: 'forge',
  mf_identify: 'identify',
  mf_craft: 'craft',
  mf_pool_dice: 'pool',
}

function summarize(r: Receipt): string {
  const out = r.output as { total?: number; success?: boolean; ingot?: { quantity?: number }; item?: { baseName?: string } }
  if (r.mfId === 'mf_dice' && typeof out?.total === 'number') return `→ ${out.total}`
  if (r.mfId === 'mf_check' && typeof out?.success === 'boolean') return out.success ? '→ pass' : '→ fail'
  if (r.mfId === 'mf_damage' && typeof out === 'object' && out !== null) {
    // damage has hpAfter, damageDealt
    const o = out as { damageDealt?: number; hpAfter?: number }
    if (typeof o.damageDealt === 'number') return `→ ${o.damageDealt} dmg`
  }
  if (r.mfId === 'mf_smelt') {
    const ingot = (r.output as { ingot?: { quantity?: number } } | null)?.ingot
    if (ingot?.quantity) return `→ ${ingot.quantity} ingot`
    return '→ failed'
  }
  if (r.mfId === 'mf_forge') {
    const item = (r.output as { item?: { baseName?: string } } | null)?.item
    if (item?.baseName) return `→ ${item.baseName}`
    return '→ failed'
  }
  if (r.mfId === 'mf_identify') {
    const out = r.output as { revealedAffixes?: unknown[]; hiddenCount?: number }
    return `→ ${out.revealedAffixes?.length ?? 0} revealed, ${out.hiddenCount ?? 0} hidden`
  }
  return '→ ok'
}

export function ReceiptStrip({ receipts, limit = 10, layout = 'vertical' }: ReceiptStripProps) {
  if (!receipts || receipts.length === 0) {
    return (
      <div
        style={{
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: 'var(--ink-3)',
          padding: '6px 0',
        }}
      >
        no receipts yet — math fires here as it runs
      </div>
    )
  }

  const items = receipts.slice(-limit).reverse()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout === 'horizontal' ? 'row' : 'column',
        gap: 4,
        flexWrap: layout === 'horizontal' ? 'wrap' : 'nowrap',
        fontFamily: 'var(--mono)',
        fontSize: 11,
      }}
    >
      {items.map((r, i) => (
        <div
          key={`${r.mfId}-${r.tick}-${i}`}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            padding: '2px 6px',
            border: '1px solid var(--rule)',
            background: 'var(--paper-2)',
            color: 'var(--ink-2)',
          }}
        >
          <span style={{ color: 'var(--ink-3)', minWidth: 60 }}>{MF_LABEL[r.mfId] ?? r.mfId}</span>
          <span>{summarize(r)}</span>
          <span style={{ color: 'var(--ink-3)', marginLeft: 'auto' }}>#{r.tick}</span>
        </div>
      ))}
    </div>
  )
}
