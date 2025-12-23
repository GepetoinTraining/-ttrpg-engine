import { createContext, useContext, useCallback } from 'react'
import type { ReactNode, FormHTMLAttributes, HTMLAttributes } from 'react'

// ============================================
// FORM MOLECULE
// ============================================

interface FormContextValue {
  disabled: boolean
}

const FormContext = createContext<FormContextValue>({ disabled: false })

export function useFormContext() {
  return useContext(FormContext)
}

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  disabled?: boolean
  children: ReactNode
}

export function Form({
  disabled = false,
  children,
  className = '',
  style,
  onSubmit,
  ...props
}: FormProps) {
  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit?.(e)
  }, [onSubmit])

  return (
    <FormContext.Provider value={{ disabled }}>
      <form
        className={className}
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          ...style,
        }}
        {...props}
      >
        {children}
      </form>
    </FormContext.Provider>
  )
}

// Form Field wrapper
export interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  error?: string
  required?: boolean
}

export function FormField({
  children,
  error,
  required,
  className = '',
  style,
  ...props
}: FormFieldProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        ...style,
      }}
      {...props}
    >
      {children}
      {error && (
        <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
          {error}
        </span>
      )}
    </div>
  )
}

// Form Label
export interface FormLabelProps extends HTMLAttributes<HTMLLabelElement> {
  children: ReactNode
  htmlFor?: string
  required?: boolean
}

export function FormLabel({
  children,
  htmlFor,
  required,
  className = '',
  style,
  ...props
}: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={className}
      style={{
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#94a3b8',
        ...style,
      }}
      {...props}
    >
      {children}
      {required && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
    </label>
  )
}

// Form Section
export interface FormSectionProps extends HTMLAttributes<HTMLFieldSetElement> {
  title?: string
  description?: string
  children: ReactNode
}

export function FormSection({
  title,
  description,
  children,
  className = '',
  style,
  ...props
}: FormSectionProps) {
  return (
    <fieldset
      className={className}
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        ...style,
      }}
      {...props}
    >
      {(title || description) && (
        <div style={{ marginBottom: '8px' }}>
          {title && (
            <legend style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#f8fafc',
              marginBottom: '4px',
            }}>
              {title}
            </legend>
          )}
          {description && (
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              margin: 0,
            }}>
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </fieldset>
  )
}

// Form Actions (buttons row)
export interface FormActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  align?: 'left' | 'center' | 'right' | 'space-between'
}

export function FormActions({
  children,
  align = 'right',
  className = '',
  style,
  ...props
}: FormActionsProps) {
  const justifyContent = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    'space-between': 'space-between',
  }[align]

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent,
        gap: '12px',
        paddingTop: '8px',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

// Inline form layout
export interface FormRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function FormRow({
  children,
  className = '',
  style,
  ...props
}: FormRowProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
