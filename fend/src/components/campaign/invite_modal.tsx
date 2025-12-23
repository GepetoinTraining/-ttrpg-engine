import { useState } from 'react'
import { Modal, Button, Input, Badge, Tabs, TabList, Tab, TabPanel } from '@styles/processors/_internal'
import { Copy, Check, Mail, Link, RefreshCw } from 'lucide-react'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'

export interface InviteModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  campaignName: string
}

export function InviteModal({ open, onClose, campaignId, campaignName }: InviteModalProps) {
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')

  const { data: inviteLink, refetch } = trpc.campaign.getInviteLink.useQuery(
    { campaignId },
    { enabled: open }
  )

  const sendEmailMutation = trpc.campaign.sendInviteEmail.useMutation({
    onSuccess: () => {
      toast.success('Invite sent!', `Email sent to ${email}`)
      setEmail('')
    },
    onError: (err) => {
      toast.error('Failed to send', err.message)
    },
  })

  const regenerateMutation = trpc.campaign.regenerateInviteLink.useMutation({
    onSuccess: () => {
      refetch()
      toast.success('Link regenerated')
    },
  })

  const copyLink = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite Players" size="md">
      <p style={{ color: '#94a3b8', margin: '0 0 20px' }}>
        Invite players to join <strong style={{ color: '#f8fafc' }}>{campaignName}</strong>
      </p>

      <Tabs defaultValue="link">
        <TabList>
          <Tab value="link"><Link size={14} style={{ marginRight: 6 }} /> Share Link</Tab>
          <Tab value="email"><Mail size={14} style={{ marginRight: 6 }} /> Email</Tab>
        </TabList>

        <TabPanel value="link">
          <div style={{ marginTop: '16px' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '12px',
              background: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #1e293b',
            }}>
              <input
                type="text"
                value={inviteLink?.url || 'Loading...'}
                readOnly
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: '#e2e8f0',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
              <Button variant="ghost" size="sm" onClick={copyLink}>
                {copied ? <Check size={16} style={{ color: '#22c55e' }} /> : <Copy size={16} />}
              </Button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '12px',
              fontSize: '0.8125rem',
              color: '#64748b',
            }}>
              <span>
                Expires: {inviteLink?.expiresAt
                  ? new Date(inviteLink.expiresAt).toLocaleDateString()
                  : '—'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regenerateMutation.mutate({ campaignId })}
                loading={regenerateMutation.isPending}
              >
                <RefreshCw size={14} /> Regenerate
              </Button>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#fcd34d' }}>
                Anyone with this link can join your campaign. Regenerate it if you want to revoke access.
              </p>
            </div>
          </div>
        </TabPanel>

        <TabPanel value="email">
          <div style={{ marginTop: '16px' }}>
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
            />

            <Button
              variant="primary"
              onClick={() => sendEmailMutation.mutate({ campaignId, email })}
              loading={sendEmailMutation.isPending}
              disabled={!email || !email.includes('@')}
              style={{ marginTop: '16px', width: '100%' }}
            >
              <Mail size={16} /> Send Invite
            </Button>

            <p style={{
              marginTop: '12px',
              fontSize: '0.8125rem',
              color: '#64748b',
              textAlign: 'center',
            }}>
              They'll receive an email with a link to join.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </Modal>
  )
}
