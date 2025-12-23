import { useParams, useNavigate } from '@tanstack/react-router'
import { ShellContent, Card, CardTitle, Button, Spinner, Badge } from '@styles/processors/_internal'
import { RequireAuth } from '@auth/guards'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'
import { Users, CheckCircle, XCircle } from 'lucide-react'

export function InvitePage() {
  return (
    <RequireAuth>
      <InviteContent />
    </RequireAuth>
  )
}

function InviteContent() {
  const { code } = useParams({ from: '/invite/$code' })
  const navigate = useNavigate()

  const { data: invite, isLoading, error } = trpc.campaign.getInvite.useQuery({ code })
  const acceptMutation = trpc.campaign.acceptInvite.useMutation({
    onSuccess: (data) => {
      toast.success('Welcome!', `You've joined ${data.campaign.name}`)
      navigate({ to: '/campaign/$id', params: { id: data.campaign.id } })
    },
    onError: (err) => {
      toast.error('Failed to join', err.message)
    },
  })

  if (isLoading) {
    return (
      <ShellContent maxWidth="sm">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <Spinner size="lg" label="Loading invite..." />
        </div>
      </ShellContent>
    )
  }

  if (error || !invite) {
    return (
      <ShellContent maxWidth="sm">
        <Card variant="default" padding="lg" style={{ textAlign: 'center' }}>
          <XCircle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
          <CardTitle>Invalid Invite</CardTitle>
          <p style={{ color: '#94a3b8', margin: '12px 0 24px' }}>
            This invite link is invalid or has expired.
          </p>
          <Button variant="secondary" onClick={() => navigate({ to: '/' })}>
            Go Home
          </Button>
        </Card>
      </ShellContent>
    )
  }

  return (
    <ShellContent maxWidth="sm">
      <Card variant="elevated" padding="lg" style={{ textAlign: 'center' }}>
        <Users size={48} style={{ color: '#f59e0b', marginBottom: '16px' }} />

        <CardTitle style={{ marginBottom: '8px' }}>
          You've Been Invited!
        </CardTitle>

        <p style={{ color: '#94a3b8', margin: '0 0 24px' }}>
          <strong style={{ color: '#f8fafc' }}>{invite.invitedBy}</strong> has invited you to join
        </p>

        <div style={{
          padding: '20px',
          background: '#0f172a',
          borderRadius: '8px',
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#f8fafc',
            fontFamily: '"Crimson Pro", Georgia, serif',
            margin: '0 0 8px',
          }}>
            {invite.campaign.name}
          </h2>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.875rem', color: '#64748b' }}>
            <span>{invite.campaign.memberCount} players</span>
            <Badge variant="info">{invite.role}</Badge>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Button
            variant="ghost"
            onClick={() => navigate({ to: '/' })}
          >
            Decline
          </Button>
          <Button
            variant="primary"
            loading={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate({ code })}
          >
            <CheckCircle size={18} />
            Join Campaign
          </Button>
        </div>
      </Card>
    </ShellContent>
  )
}
