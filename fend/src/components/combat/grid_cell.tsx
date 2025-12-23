export interface GridCellProps {
  x: number
  y: number
  size: number
  terrain?: 'normal' | 'difficult' | 'hazard' | 'impassable'
  isHighlighted?: boolean
  isInRange?: boolean
  isPath?: boolean
  onClick?: () => void
}

const TERRAIN_COLORS = {
  normal: 'transparent',
  difficult: 'rgba(245, 158, 11, 0.15)',
  hazard: 'rgba(239, 68, 68, 0.2)',
  impassable: 'rgba(30, 41, 59, 0.8)',
}

export function GridCell({
  x,
  y,
  size,
  terrain = 'normal',
  isHighlighted = false,
  isInRange = false,
  isPath = false,
  onClick,
}: GridCellProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        boxSizing: 'border-box',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: isHighlighted
          ? 'rgba(34, 197, 94, 0.3)'
          : isPath
            ? 'rgba(59, 130, 246, 0.2)'
            : isInRange
              ? 'rgba(139, 92, 246, 0.15)'
              : TERRAIN_COLORS[terrain],
        pointerEvents: onClick ? 'auto' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 100ms',
      }}
    />
  )
}
