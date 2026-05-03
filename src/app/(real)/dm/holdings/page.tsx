'use client'

/**
 * /dm/holdings — Holdings + Downtime + Investment resolution.
 *
 * Pedro's vision: "party inventory is whatever the players transfer to the
 * party, party leader has control over where the money gets invested, I
 * need to be able to accept the investment and make the rolls for what
 * happens and deliver the outcome."
 *
 * Sections:
 *   1. Party shared pool — gold + items contributed by PCs
 *   2. Pending investments — player proposals awaiting DM resolution
 *   3. Claims — what the party owns + per-claim stash
 *   4. Downtime queue — player downtime actions awaiting DM rolls
 *
 * v1: structural shell. All sections show placeholders + the path forward.
 * Backend wiring (claim list endpoint, party-pool table, investment intents)
 * lands in the next conversation; this page is the scaffold so we know
 * what the API needs to return.
 */

import * as React from 'react'
import { Card, EmptyState, InventoryList } from '@/components/ui'

export default function DMHoldingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Holdings
        </h2>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          shared pool · investments · claims · downtime
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 12,
        }}
      >
        {/* Party shared pool */}
        <Card title="Party shared pool" meta="0 gp · 0 items">
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
            Gold + items contributed by PCs to the group. The party leader
            (designated PC) signs investment proposals against this pool.
          </p>
          <InventoryList items={[]} showTotals emptyLabel="no items in the pool yet" />
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
            }}
          >
            ↳ needs <code>/api/holdings/pool?campaignId=…</code> (party-pool table or replay)
          </div>
        </Card>

        {/* Pending investments */}
        <Card title="Pending investments" meta="0 awaiting">
          <EmptyState
            label="no proposals"
            hint="when a player proposes an investment via /play/holdings, it appears here for you to roll outcomes against."
          />
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
            }}
          >
            ↳ needs intent endpoint (writeKappa with system='client-intent:propose-investment')
          </div>
        </Card>

        {/* Claims */}
        <Card title="Claims" meta="0 owned">
          <EmptyState
            label="no party claims"
            hint="claims (workshops, deposits, plots, buildings, settlements) appear here once the party stakes them. each claim has its own stash."
          />
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
            }}
          >
            ↳ needs <code>/api/claim/list?campaignId=…</code> (engine/claims.ts ClaimRegistry serialized)
          </div>
        </Card>

        {/* Downtime queue */}
        <Card title="Downtime queue" meta="0 actions">
          <EmptyState
            label="no downtime actions"
            hint="players' downtime declarations (study a tome, brew potions, lobby a faction) land here. you roll the outcome; the result writes back to the TPB."
          />
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
            }}
          >
            ↳ same intent endpoint as investments; filter by verb='downtime'
          </div>
        </Card>
      </div>

      {/* Investment-resolution flow note */}
      <Card title="The flow" variant="soft">
        <ol
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
          }}
        >
          <li>Party leader proposes: "spend 500gp from the pool to fund a caravan to Mulmaster"</li>
          <li>Proposal lands in <b>Pending investments</b> here</li>
          <li>You click <b>Resolve</b>, roll d20 (or auto-roll) against the proposal's DC, see the outcome</li>
          <li>Engine appends the writeKappa: pool debit + outcome lore + any state changes (route opens, faction shift, etc.)</li>
          <li>Players see the result in their Journey log</li>
        </ol>
        <div
          style={{
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 10,
            color: 'var(--ink-3)',
          }}
        >
          ↳ "no do-overs" — once a proposal is accepted (passes engine validation), the math runs and the outcome is recorded.
        </div>
      </Card>
    </div>
  )
}
