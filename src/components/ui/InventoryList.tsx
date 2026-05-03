'use client'

/**
 * InventoryList — generic inventory display.
 *
 * Accepts any item shape that has at least { id, name, qty }. Optional
 * fields (weight, valueGP, container, category) drive richer rendering.
 *
 * Used by:
 *   - Character sheet (carried inventory)
 *   - Holdings view (party stash + claim containers)
 *   - Inventory modal (full pickable list)
 */

import * as React from 'react'

export interface InventoryItem {
  id: string
  name: string
  qty: number
  weight?: number          // lbs per item
  valueGP?: number         // gold pieces each
  category?: string        // 'weapon' | 'armor' | 'consumable' | etc.
  container?: string       // id of container holding this (for holdings nesting)
  description?: string
}

interface InventoryListProps {
  items: InventoryItem[]
  /** Called on row click — for "use" / "transfer" / "inspect" actions. */
  onItemClick?: (item: InventoryItem) => void
  /** Optional right-side actions per row, e.g. transfer / drop buttons. */
  renderActions?: (item: InventoryItem) => React.ReactNode
  /** Group items by category. Default false (flat list). */
  groupByCategory?: boolean
  /** Show total weight + value summary at the bottom. */
  showTotals?: boolean
  /** Empty state message. */
  emptyLabel?: string
}

export function InventoryList({
  items,
  onItemClick,
  renderActions,
  groupByCategory = false,
  showTotals = false,
  emptyLabel = 'no items',
}: InventoryListProps) {
  const totalWeight = items.reduce((s, i) => s + (i.weight ?? 0) * i.qty, 0)
  const totalValue = items.reduce((s, i) => s + (i.valueGP ?? 0) * i.qty, 0)

  if (items.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '8px 0' }}>{emptyLabel}</div>
    )
  }

  const groups = groupByCategory ? groupBy(items, (i) => i.category ?? 'other') : { all: items }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {Object.entries(groups).map(([cat, list]) => (
        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {groupByCategory && (
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                marginTop: 4,
              }}
            >
              {cat} <span style={{ opacity: 0.6 }}>· {list.length}</span>
            </div>
          )}
          {list.map((item) => (
            <Row
              key={item.id}
              item={item}
              onClick={onItemClick}
              renderActions={renderActions}
            />
          ))}
        </div>
      ))}
      {showTotals && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            paddingTop: 6,
            borderTop: '1px dashed var(--rule-soft)',
          }}
        >
          <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
          <span>{totalWeight.toFixed(1)} lbs · {totalValue.toFixed(0)} gp</span>
        </div>
      )}
    </div>
  )
}

function Row({
  item,
  onClick,
  renderActions,
}: {
  item: InventoryItem
  onClick?: (i: InventoryItem) => void
  renderActions?: (i: InventoryItem) => React.ReactNode
}) {
  const interactive = !!onClick
  return (
    <div
      onClick={interactive ? () => onClick!(item) : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        cursor: interactive ? 'pointer' : 'default',
        borderRadius: 4,
        minWidth: 0,
      }}
      onMouseEnter={interactive ? (e) => (e.currentTarget.style.background = 'var(--paper-2)') : undefined}
      onMouseLeave={interactive ? (e) => (e.currentTarget.style.background = 'transparent') : undefined}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.name}
        {item.qty > 1 && <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>× {item.qty}</span>}
      </span>
      {item.weight !== undefined && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>
          {item.weight.toFixed(1)}
        </span>
      )}
      {item.valueGP !== undefined && (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-gold)', flexShrink: 0 }}>
          {item.valueGP.toFixed(0)}gp
        </span>
      )}
      {renderActions && <span style={{ flexShrink: 0 }}>{renderActions(item)}</span>}
    </div>
  )
}

function groupBy<T, K extends string>(arr: T[], key: (item: T) => K): Record<K, T[]> {
  const out: Record<string, T[]> = {}
  for (const item of arr) {
    const k = key(item)
    if (!out[k]) out[k] = []
    out[k].push(item)
  }
  return out as Record<K, T[]>
}
