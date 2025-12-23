import { useState, createContext, useContext, useCallback } from 'react'
import type { ReactNode, HTMLAttributes } from 'react'

// ============================================
// TABS MOLECULE
// ============================================

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Tab components must be used within Tabs')
  }
  return context
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  children: ReactNode
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onChange: controlledOnChange,
  children,
  className = '',
  style,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '')

  const value = controlledValue !== undefined ? controlledValue : internalValue

  const onChange = useCallback((newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    controlledOnChange?.(newValue)
  }, [controlledValue, controlledOnChange])

  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div
        className={className}
        style={{
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function TabList({ children, className = '', style, ...props }: TabListProps) {
  return (
    <div
      role="tablist"
      className={className}
      style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: '#0f172a',
        borderRadius: '8px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export interface TabProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string
  disabled?: boolean
  children: ReactNode
}

export function Tab({ value, disabled = false, children, className = '', style, ...props }: TabProps) {
  const { value: selectedValue, onChange } = useTabsContext()
  const isSelected = value === selectedValue

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isSelected}
      disabled={disabled}
      onClick={() => !disabled && onChange(value)}
      className={className}
      style={{
        flex: 1,
        padding: '8px 16px',
        background: isSelected ? '#1e293b' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        color: isSelected ? '#f8fafc' : disabled ? '#475569' : '#94a3b8',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 150ms, color 150ms',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  children: ReactNode
}

export function TabPanel({ value, children, className = '', style, ...props }: TabPanelProps) {
  const { value: selectedValue } = useTabsContext()

  if (value !== selectedValue) {
    return null
  }

  return (
    <div
      role="tabpanel"
      className={className}
      style={{
        padding: '16px 0',
        animation: 'fadeIn 150ms ease-out',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Vertical tabs variant
export function VerticalTabs({
  value: controlledValue,
  defaultValue,
  onChange: controlledOnChange,
  children,
  className = '',
  style,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '')

  const value = controlledValue !== undefined ? controlledValue : internalValue

  const onChange = useCallback((newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    controlledOnChange?.(newValue)
  }, [controlledValue, controlledOnChange])

  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div
        className={className}
        style={{
          display: 'flex',
          gap: '16px',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export function VerticalTabList({ children, className = '', style, ...props }: TabListProps) {
  return (
    <div
      role="tablist"
      aria-orientation="vertical"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '4px',
        background: '#0f172a',
        borderRadius: '8px',
        minWidth: '180px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
