import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Card, CardTitle, Button, Badge, Modal, useModal, Dropdown, Input } from '@styles/processors/_internal'
import { List, ListItem, Form, FormField, FormActions } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'
import { Plus, Calendar, Trash2, Zap, BookOpen, Coins, Hammer, Users, Check, Clock } from 'lucide-react'

const ACTION_TYPES = [
  { value: 'training', label: 'Training', icon: <Zap size={16} /> },
  { value: 'research', label: 'Research', icon: <BookOpen size={16} /> },
  { value: 'crafting', label: 'Crafting', icon: <Hammer size={16} /> },
  { value: 'earning', label: 'Earning Gold', icon: <Coins size={16} /> },
  { value: 'socializing', label: 'Socializing', icon: <Users size={16} /> },
]

export function PlayerDowntime() {
  const { campaignId } = useParams({ from: '/player/$campaignId' })
  const addModal = useModal()

  const { data: myActions } = trpc.downtime.myActions.useQuery({ campaignId })
  const { data: info } = trpc.downtime.info.useQuery({ campaignId })

  const addMutation = trpc.downtime.add.useMutation({
    onSuccess: () => {
      toast.success('Action queued!')
      addModal.closeModal()
    },
  })

  const deleteMutation = trpc.downtime.delete.useMutation()

  const totalSlots = (info?.days || 7) * 3
  const usedSlots = myActions?.length || 0

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ color: '#f8fafc', fontSize: '1.125rem', margin: 0 }}>Downtime</h2>
          <span style={{ color: '#64748b', fontSize: '0.8125rem' }}>
            {info?.days || 7} days until next session
          </span>
        </div>
        <Button variant="primary" size="sm" onClick={addModal.openModal}>
          <Plus size={16} />
        </Button>
      </div>

      {/* Usage */}
      <Card variant="glass" padding="sm">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8125rem' }}>
          <span style={{ color: '#94a3b8' }}>Actions</span>
          <span style={{ color: '#f8fafc' }}>{usedSlots} / {totalSlots}</span>
        </div>
        <div style={{ height: '6px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            width: `${(usedSlots / totalSlots) * 100}%`,
            height: '100%',
            background: '#f59e0b',
          }} />
        </div>
      </Card>

      {/* Actions List */}
      <Card variant="default" padding="sm">
        <List gap="none">
          {myActions?.map((action: any) => (
            <ListItem
              key={action.id}
              leading={<ActionIcon type={action.type} />}
              trailing={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusBadge status={action.status} />
                  {action.status === 'pending' && (
                    <button
                      onClick={() => deleteMutation.mutate({ actionId: action.id })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        padding: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              }
              divider
            >
              <div>
                <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{action.type}</span>
                <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '0.75rem' }}>
                  Day {action.day}
                </span>
              </div>
              {action.description && (
                <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                  {action.description}
                </div>
              )}
            </ListItem>
          ))}
        </List>

        {!myActions?.length && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
            <Calendar size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No actions queued</p>
          </div>
        )}
      </Card>

      {/* Add Modal */}
      <Modal open={addModal.open} onClose={addModal.closeModal} title="Add Action" size="sm">
        <AddActionForm
          days={info?.days || 7}
          onSubmit={(data) => addMutation.mutate({ campaignId, ...data })}
          isLoading={addMutation.isPending}
        />
      </Modal>
    </div>
  )
}

function ActionIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    training: <Zap size={18} style={{ color: '#f59e0b' }} />,
    research: <BookOpen size={18} style={{ color: '#0ea5e9' }} />,
    crafting: <Hammer size={18} style={{ color: '#22c55e' }} />,
    earning: <Coins size={18} style={{ color: '#f59e0b' }} />,
    socializing: <Users size={18} style={{ color: '#8b5cf6' }} />,
  }
  return <>{icons[type] || <Calendar size={18} />}</>
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'resolved') {
    return <Badge variant="success"><Check size={10} /></Badge>
  }
  if (status === 'pending') {
    return <Badge variant="warning"><Clock size={10} /></Badge>
  }
  return <Badge variant="default">{status}</Badge>
}

function AddActionForm({ days, onSubmit, isLoading }: { days: number; onSubmit: (data: any) => void; isLoading: boolean }) {
  const [type, setType] = useState('')
  const [day, setDay] = useState('1')
  const [description, setDescription] = useState('')

  return (
    <Form onSubmit={() => onSubmit({ type, day: Number(day), description })}>
      <FormField>
        <Dropdown
          label="Action"
          options={ACTION_TYPES}
          value={type}
          onChange={setType}
        />
      </FormField>

      <FormField>
        <Dropdown
          label="Day"
          options={Array.from({ length: days }).map((_, i) => ({
            value: String(i + 1),
            label: `Day ${i + 1}`,
          }))}
          value={day}
          onChange={setDay}
        />
      </FormField>

      <FormField>
        <Input
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What specifically?"
        />
      </FormField>

      <FormActions>
        <Button type="submit" variant="primary" loading={isLoading} style={{ width: '100%' }}>
          Add Action
        </Button>
      </FormActions>
    </Form>
  )
}
