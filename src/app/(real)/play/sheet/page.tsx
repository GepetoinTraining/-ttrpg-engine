'use client'

/**
 * /play/sheet — the player's full character sheet. Reuses the same view
 * shape as /dm/party/[characterId] but bound to the active character cert.
 */

import * as React from 'react'
import { Card, CharacterCard, EmptyState, InventoryList, type InventoryItem } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'

export default function PlayerSheetPage() {
  const { loading, cert, sheet, error } = useActiveCharacter({ withSheet: true })

  if (loading) {
    return <Card><div style={{ color: 'var(--ink-3)' }}>loading…</div></Card>
  }

  if (!cert || !sheet) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Sheet
        </h2>
        <Card variant="danger">
          <EmptyState
            label="character not loaded"
            hint={error ?? (cert ? 'your cert is in IDB but the sheet hasn’t been minted yet — finish chargen first.' : 'no cert in this browser. open the invite link your DM sent.')}
          />
        </Card>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
        {sheet.name}
      </h2>

      <CharacterCard
        id={sheet.id ?? cert.id}
        name={sheet.name}
        race={sheet.race}
        subrace={sheet.subrace}
        classes={sheet.classes}
        hpCurrent={sheet.hpCurrent ?? sheet.hp}
        hpMax={sheet.hpMax}
        ac={sheet.ac}
        personaType={cert.personaType}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: 12,
        }}
      >
        {sheet.abilityScores && (
          <Card title="Abilities">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Object.entries(sheet.abilityScores as Record<string, number>).map(([k, v]) => {
                const mod = sheet.abilityModifiers?.[k] ?? Math.floor((v - 10) / 2)
                return (
                  <div key={k} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--paper-2)', border: '1px solid var(--rule-soft)' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>
                      {k.slice(0, 3)}
                    </div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{v}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>
                      {mod >= 0 ? '+' : ''}{mod}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <Card title="Carried" meta={sheet.goldGP !== undefined ? `${sheet.goldGP} gp` : undefined}>
          <InventoryList items={(sheet.inventory ?? []) as InventoryItem[]} showTotals emptyLabel="nothing carried" />
        </Card>

        {(sheet.hook || sheet.alignment || sheet.background) && (
          <Card title="Background">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              {sheet.alignment && (
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>ALIGNMENT</span>
                  <div>{sheet.alignment}</div>
                </div>
              )}
              {sheet.background && (
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>BACKGROUND</span>
                  <div>{sheet.background}</div>
                </div>
              )}
              {sheet.hook && (
                <div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>HOOK</span>
                  <div style={{ fontStyle: 'italic' }}>{sheet.hook}</div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
