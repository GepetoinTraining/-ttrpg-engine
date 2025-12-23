import { useState } from 'react'
import { Button, Badge, Input } from '@styles/processors/_internal'
import { List, ListItem } from '@styles/processors/_internal'
import { Package, Coins, Plus, Trash2, Check, X, Weight } from 'lucide-react'

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  weight?: number
  equipped?: boolean
  description?: string
  type?: 'weapon' | 'armor' | 'gear' | 'consumable' | 'treasure' | 'other'
}

export interface Currency {
  cp: number
  sp: number
  ep: number
  gp: number
  pp: number
}

export interface InventoryProps {
  items: InventoryItem[]
  currency: Currency
  editable?: boolean
  onChange?: (items: InventoryItem[], currency: Currency) => void
  carryCapacity?: number
}

const CURRENCY_LABELS = {
  cp: { label: 'CP', color: '#b45309' },
  sp: { label: 'SP', color: '#94a3b8' },
  ep: { label: 'EP', color: '#0ea5e9' },
  gp: { label: 'GP', color: '#f59e0b' },
  pp: { label: 'PP', color: '#e2e8f0' },
}

const TYPE_COLORS: Record<string, string> = {
  weapon: '#ef4444',
  armor: '#64748b',
  gear: '#0ea5e9',
  consumable: '#22c55e',
  treasure: '#f59e0b',
  other: '#8b5cf6',
}

export function Inventory({
  items,
  currency,
  editable = false,
  onChange,
  carryCapacity,
}: InventoryProps) {
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({ name: '', quantity: 1 })

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0)
  const totalGold = currency.cp / 100 + currency.sp / 10 + currency.ep / 2 + currency.gp + currency.pp * 10

  const handleAddItem = () => {
    if (!newItem.name) return
    const item: InventoryItem = {
      id: crypto.randomUUID(),
      name: newItem.name,
      quantity: newItem.quantity || 1,
      weight: newItem.weight,
      type: 'other',
    }
    onChange?.([...items, item], currency)
    setNewItem({ name: '', quantity: 1 })
    setIsAddingItem(false)
  }

  const handleRemoveItem = (itemId: string) => {
    onChange?.(items.filter(i => i.id !== itemId), currency)
  }

  const handleToggleEquipped = (itemId: string) => {
    onChange?.(
      items.map(i => i.id === itemId ? { ...i, equipped: !i.equipped } : i),
      currency
    )
  }

  const handleCurrencyChange = (type: keyof Currency, value: number) => {
    onChange?.(items, { ...currency, [type]: Math.max(0, value) })
  }

  return (
    <div>
      {/* Currency */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={18} style={{ color: '#f59e0b' }} />
            <span style={{ fontWeight: 600 }}>Currency</span>
          </div>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            ≈ {totalGold.toFixed(1)} gp total
          </span>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px',
          background: '#1e293b',
          borderRadius: '8px',
        }}>
          {(Object.keys(CURRENCY_LABELS) as (keyof Currency)[]).map(type => (
            <div key={type} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontSize: '0.6875rem',
                color: CURRENCY_LABELS[type].color,
                fontWeight: 600,
                marginBottom: '4px',
              }}>
                {CURRENCY_LABELS[type].label}
              </div>
              {editable ? (
                <input
                  type="number"
                  value={currency[type]}
                  onChange={(e) => handleCurrencyChange(type, parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '4px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                  }}
                />
              ) : (
                <div style={{ fontWeight: 500, color: '#e2e8f0' }}>
                  {currency[type]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Items */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} style={{ color: '#0ea5e9' }} />
            <span style={{ fontWeight: 600 }}>Items</span>
            <Badge variant="default">{items.length}</Badge>
          </div>

          {carryCapacity && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8125rem',
              color: totalWeight > carryCapacity ? '#ef4444' : '#64748b',
            }}>
              <Weight size={14} />
              {totalWeight.toFixed(1)} / {carryCapacity} lb
            </div>
          )}
        </div>

        {items.length === 0 && !isAddingItem ? (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: '#64748b',
            background: '#1e293b',
            borderRadius: '8px',
          }}>
            <Package size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>No items in inventory</p>
          </div>
        ) : (
          <List gap="xs">
            {items.map(item => (
              <ListItem
                key={item.id}
                leading={
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: TYPE_COLORS[item.type || 'other'],
                  }} />
                }
                trailing={
                  editable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null
                }
                onClick={editable ? () => handleToggleEquipped(item.id) : undefined}
                style={{ cursor: editable ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    color: item.equipped ? '#f59e0b' : '#e2e8f0',
                    fontWeight: item.equipped ? 500 : 400,
                  }}>
                    {item.name}
                  </span>
                  {item.quantity > 1 && (
                    <Badge variant="default">×{item.quantity}</Badge>
                  )}
                  {item.equipped && (
                    <Badge variant="warning">Equipped</Badge>
                  )}
                  {item.weight && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {item.weight * item.quantity} lb
                    </span>
                  )}
                </div>
              </ListItem>
            ))}
          </List>
        )}

        {/* Add Item Form */}
        {isAddingItem ? (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: '#1e293b',
            borderRadius: '8px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-end',
          }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Item Name"
                value={newItem.name || ''}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Rope, 50 ft"
              />
            </div>
            <div style={{ width: '80px' }}>
              <Input
                label="Qty"
                type="number"
                value={newItem.quantity || 1}
                onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <Button variant="primary" size="sm" onClick={handleAddItem}>
              <Check size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsAddingItem(false)}>
              <X size={16} />
            </Button>
          </div>
        ) : editable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddingItem(true)}
            style={{ marginTop: '12px', width: '100%' }}
          >
            <Plus size={16} /> Add Item
          </Button>
        )}
      </div>
    </div>
  )
}
