import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ShellContent, PageHeader, Card, CardTitle, Button, Badge } from '@styles/processors/_internal'
import { List, ListItem, Modal, useModal, Dropdown, Input, Form, FormField, FormActions } from '@styles/processors/_internal'
import { trpc } from '@api/trpc'
import { toast } from '@styles/processors/_internal'
import { Plus, Trash2, Zap, BookOpen, Coins, Hammer, Users, Calendar } from 'lucide-react'

const ACTION_TYPES = [
  { value: 'training', label: 'Training', icon: <Zap size={16} /> },
  { value: 'research', label: 'Research', icon: <BookOpen size={16} /> },
  { value: 'crafting', label: 'Crafting', icon: <Hammer size={16} /> },
  { value: 'earning', label: 'Earning Gold', icon: <Coins size={16} /> },
  { value: 'socializing', label: 'Socializing', icon: <Users size={16} /> },
]

export function DowntimePlayer() {
  const { id } = useParams({ from: '/campaign/$id' })
  const addModal = useModal()

  const { data: myActions } = trpc.downtime.myActions.useQuery({ campaignId: id })
  const { data: downtimeInfo } = trpc.downtime.info.useQuery({ campaignId: id })

  const addMutation = trpc.downtime.add.useMutation({
    onSuccess: () => {
      toast.success('Action queued!')
      addModal.closeModal()
    },
  })

  const deleteMutation = trpc.downtime.delete.useMutation({
    onSuccess: () => {
      toast.success('Action removed')
    },
  })

  const actionsPerDay = 3
  const totalDays = downtimeInfo?.days || 7
  const maxActions = actionsPerDay * totalDays
  const usedActions = myActions?.length || 0

  return (
    <ShellContent>
      <PageHeader
        title="Your Downtime"
        description={`${totalDays} days until next session`}
        actions={
          <Button
            variant="primary"
            onClick={addModal.openModal}
            disabled={usedActions >= maxActions}
          >
            <Plus size={18} />
            Add Action
          </Button>
        }
      />

      {/* Usage Bar */}
      <Card variant="glass" padding="md" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#94a3b8' }}>Actions Used</span>
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>
            {usedActions} / {maxActions}
          </span>
        </div>
        <div style={{ height: '8px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${(usedActions / maxActions) * 100}%`,
            height: '100%',
            background: usedActions >= maxActions ? '#ef4444' : '#f59e0b',
            transition: 'width 300ms',
          }} />
        </div>
      </Card>

      {/* Calendar View */}
      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: `repeat(${Math.min(totalDays, 7)}, 1fr)` }}>
        {Array.from({ length: totalDays }).map((_, day) => {
          const dayActions = myActions?.filter((a: any) => a.day === day + 1) || []

          return (
            <Card key={day} variant="default" padding="sm">
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <Calendar size={12} />
                Day {day + 1}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dayActions.map((action: any) => (
                  <div
                    key={action.id}
                    style={{
                      padding: '8px',
                      background: '#0f172a',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{action.type}</span>
                    <button
                      onClick={() => deleteMutation.mutate({ actionId: action.id })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                {dayActions.length < actionsPerDay && (
                  <button
                    onClick={addModal.openModal}
                    style={{
                      padding: '8px',
                      background: 'transparent',
                      border: '1px dashed #334155',
                      borderRadius: '6px',
                      color: '#64748b',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    + Add
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Add Action Modal */}
      <Modal open={addModal.open} onClose={addModal.closeModal} title="Queue Downtime Action">
        <AddActionForm
          campaignId={id}
          totalDays={totalDays}
          onSubmit={(data) => addMutation.mutate({ campaignId: id, ...data })}
          isLoading={addMutation.isPending}
        />
      </Modal>
    </ShellContent>
  )
}

function AddActionForm({
  campaignId,
  totalDays,
  onSubmit,
  isLoading
}: {
  campaignId: string
  totalDays: number
  onSubmit: (data: any) => void
  isLoading: boolean
}) {
  const [type, setType] = useState('')
  const [day, setDay] = useState(1)
  const [description, setDescription] = useState('')

  return (
    <Form onSubmit={() => onSubmit({ type, day, description })}>
      <FormField>
        <Dropdown
          label="Action Type"
          options={ACTION_TYPES}
          value={type}
          onChange={setType}
          placeholder="Select action type..."
        />
      </FormField>

      <FormField>
        <Dropdown
          label="Day"
          options={Array.from({ length: totalDays }).map((_, i) => ({
            value: String(i + 1),
            label: `Day ${i + 1}`,
          }))}
          value={String(day)}
          onChange={(v) => setDay(Number(v))}
        />
      </FormField>

      <FormField>
        <Input
          label="Description"
          placeholder="What do you want to do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <FormActions>
        <Button type="submit" variant="primary" loading={isLoading}>
          Queue Action
        </Button>
      </FormActions>
    </Form>
  )
}
