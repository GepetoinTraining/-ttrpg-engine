'use client'

/**
 * /play/holdings — read-only view of party stash + investment proposal form.
 *
 * Player-side companion to /dm/holdings. Shows:
 *   1. Party shared pool (read-only)
 *   2. Propose investment (emits an intent to the DM)
 *   3. My contributions (read-only history)
 *
 * v1: shell + intent-based proposal. The pool data and contribution
 * history wait for the holdings API; the proposal form already works
 * via the intent loop (stored in localStorage for now).
 */

import * as React from 'react'
import { Card, EmptyState, InventoryList } from '@/components/ui'
import { useActiveCharacter } from '../../_lib/use-active-character'
import { authFetch } from '@/lib/auth-fetch'

interface InvestmentProposal {
  id: string
  ts: number
  description: string
  amount: number
  status: 'queued' | 'sent' | 'resolved' | 'failed'
  outcome?: string
  error?: string
}

const LS_KEY = (cid: string) => `claudedm:investments:${cid}`

function loadProposals(cid: string): InvestmentProposal[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY(cid))
    return raw ? (JSON.parse(raw) as InvestmentProposal[]) : []
  } catch {
    return []
  }
}

function saveProposals(cid: string, list: InvestmentProposal[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_KEY(cid), JSON.stringify(list))
}

export default function PlayerHoldingsPage() {
  const { cert, sheet, loading } = useActiveCharacter({ withSheet: true })
  const [proposals, setProposals] = React.useState<InvestmentProposal[]>([])
  const [description, setDescription] = React.useState('')
  const [amount, setAmount] = React.useState(0)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (cert) setProposals(loadProposals(cert.id))
  }, [cert])

  const submit = async () => {
    if (!cert || !description.trim() || amount <= 0 || submitting) return
    setSubmitting(true)
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const ts = Date.now()
    const proposal: InvestmentProposal = {
      id,
      ts,
      description: description.trim(),
      amount,
      status: 'queued',
    }
    const next = [proposal, ...proposals].slice(0, 50)
    setProposals(next)
    saveProposals(cert.id, next)
    const desc = description.trim()
    const amt = amount
    setDescription('')
    setAmount(0)

    // Push as a writeKappa via the slot-push flywheel — the DM polls
    // /api/world/log filtered by system='propose-investment:<cert>' and
    // resolves the outcome (rolls dice) through their EngineClient.
    try {
      const action = {
        type: 'writeKappa' as const,
        nodeId: 'party',
        domain: 'intent',
        paths: ['intent.propose-investment', `intent.propose-investment.id:${id}`],
        system: `propose-investment:${cert.id}`,
        value: {
          proposalId: id,
          characterId: cert.characterDataId ?? cert.id,
          description: desc,
          amount: amt,
          ts,
        },
      }
      const res = await authFetch('/api/world/slot/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'solo',
          sourceCertId: cert.id,
          atDay: 0,
          actions: [action],
          receipts: [],
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `${res.status}`)
      }
      const updated: InvestmentProposal = { ...proposal, status: 'sent' }
      const list = next.map((p) => (p.id === id ? updated : p))
      setProposals(list)
      saveProposals(cert.id, list)
    } catch (e: unknown) {
      const failed: InvestmentProposal = {
        ...proposal,
        status: 'failed',
        error: e instanceof Error ? e.message : 'push failed',
      }
      const list = next.map((p) => (p.id === id ? failed : p))
      setProposals(list)
      saveProposals(cert.id, list)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <Card><div style={{ color: 'var(--ink-3)' }}>loading…</div></Card>
  }

  if (!cert) {
    return (
      <Card variant="danger">
        <EmptyState label="no character bound" hint="finish chargen first." />
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
      <div>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 600, margin: 0 }}>
          Holdings
        </h2>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
          party stash · investments
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 12,
        }}
      >
        {/* Party shared pool — read-only */}
        <Card title="Party pool" meta="0 gp" variant="dashed">
          <p style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 0 }}>
            Shared gold + items the party has pooled. Transfer in via your Inventory.
          </p>
          <InventoryList items={[]} showTotals emptyLabel="pool empty" />
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
            }}
          >
            ↳ pool API not wired yet
          </div>
        </Card>

        {/* My contributions */}
        <Card title="My contributions" meta="0 entries" variant="dashed">
          <EmptyState
            label="nothing transferred yet"
            hint="from /play/inventory, choose 'transfer to pool' on any item to add it here."
          />
        </Card>
      </div>

      {/* Propose investment */}
      <Card title="Propose an investment" meta={`from ${sheet?.name ?? 'me'}`}>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 0 }}>
          Speak for the party (or just propose for yourself). The DM rolls
          for the outcome and the result lands in your Journey.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="describe what you want to do — 'fund a caravan to Mulmaster', 'fortify the workshop', 'commission a sage for research'"
            rows={3}
            style={{
              padding: '8px 10px',
              fontFamily: 'var(--serif)',
              fontSize: 14,
              background: 'var(--paper)',
              border: '1px solid var(--rule-soft)',
              resize: 'vertical',
              minHeight: 60,
            }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="tiny">amount (gp)</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, +e.target.value || 0))}
                style={{
                  width: 100,
                  padding: '6px 8px',
                  fontFamily: 'var(--mono)',
                  background: 'var(--paper)',
                  border: '1px solid var(--rule-soft)',
                }}
              />
            </label>
            <span style={{ flex: 1 }} />
            <button
              className="btn primary"
              onClick={submit}
              disabled={!description.trim() || amount <= 0 || submitting}
            >
              {submitting ? 'sending…' : '↑ propose to DM'}
            </button>
          </div>
        </div>
      </Card>

      {/* Recent proposals */}
      <Card title="My proposals" meta={`${proposals.length}`}>
        {proposals.length === 0 ? (
          <EmptyState label="no proposals yet" hint="your investment proposals appear here." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proposals.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--rule-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: 'var(--ink-3)',
                  }}
                >
                  <span>{new Date(p.ts).toLocaleTimeString()}</span>
                  <span style={{ color: 'var(--accent-gold)' }}>{p.amount} gp</span>
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      color:
                        p.status === 'resolved' ? 'var(--accent-green)' :
                        p.status === 'sent' ? 'var(--accent-blue)' :
                        p.status === 'failed' ? 'var(--accent-red)' :
                        'var(--ink-3)',
                    }}
                  >
                    {p.status}
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>{p.description}</div>
                {p.outcome && (
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', fontStyle: 'italic', marginTop: 4 }}>
                    {p.outcome}
                  </div>
                )}
                {p.status === 'failed' && p.error && (
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-red)' }}>
                    {p.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
