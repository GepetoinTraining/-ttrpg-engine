import { CSSProperties, ReactNode } from 'react'
import { φ } from '../phi'

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'label' | 'code'

export interface TextProps {
  variant?: TextVariant
  children: ReactNode
  color?: string
  weight?: 400 | 500 | 600 | 700
  align?: 'left' | 'center' | 'right'
  truncate?: boolean
  style?: CSSProperties
  className?: string
}

const VARIANT_STYLES: Record<TextVariant, CSSProperties> = {
  h1: {
    fontSize: `${φ(5)}rem`,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: `${φ(4)}rem`,
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: `${φ(3)}rem`,
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h4: {
    fontSize: `${φ(2)}rem`,
    fontWeight: 600,
    lineHeight: 1.4,
  },
  body: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.6,
  },
  caption: {
    fontSize: `${φ(-1)}rem`,
    fontWeight: 400,
    lineHeight: 1.5,
    color: '#94a3b8',
  },
  label: {
    fontSize: `${φ(-1)}rem`,
    fontWeight: 500,
    lineHeight: 1.4,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  code: {
    fontSize: '0.875rem',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: '0.125em 0.375em',
    borderRadius: '4px',
  },
}

export function Text({
  variant = 'body',
  children,
  color,
  weight,
  align,
  truncate = false,
  style,
  className,
}: TextProps) {
  const variantStyle = VARIANT_STYLES[variant]

  const combinedStyle: CSSProperties = {
    ...variantStyle,
    ...(color && { color }),
    ...(weight && { fontWeight: weight }),
    ...(align && { textAlign: align }),
    ...(truncate && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    margin: 0,
    ...style,
  }

  const Tag = variant.startsWith('h') ? variant as 'h1' | 'h2' | 'h3' | 'h4' : 'p'

  return (
    <Tag style={combinedStyle} className={className}>
      {children}
    </Tag>
  )
}
