import { useState, useCallback, useRef, useEffect } from 'react'
import { GridCell } from './grid_cell'
import { Token, TokenData } from './token'
import { useCombat } from '@hooks/use_combat'
import { gridToPixel, pixelToGrid, snapToGrid } from '@utils/grid'

export interface BattleGridProps {
  combatId: string
  mapUrl?: string
  gridSize?: number // pixels per cell
  width?: number // cells
  height?: number // cells
  tokens: TokenData[]
  isGM: boolean
  selectedTokenId?: string | null
  onTokenSelect?: (id: string | null) => void
  onTokenMove?: (id: string, x: number, y: number) => void
  onCellClick?: (x: number, y: number) => void
}

export function BattleGrid({
  combatId,
  mapUrl,
  gridSize = 40,
  width = 20,
  height = 15,
  tokens,
  isGM,
  selectedTokenId,
  onTokenSelect,
  onTokenMove,
  onCellClick,
}: BattleGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggingToken, setDraggingToken] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const pixelWidth = width * gridSize
  const pixelHeight = height * gridSize

  // Handle token drag start
  const handleTokenDragStart = useCallback((e: React.MouseEvent, tokenId: string) => {
    if (!isGM && !tokens.find(t => t.id === tokenId)?.isPlayerControlled) return

    e.stopPropagation()
    const token = tokens.find(t => t.id === tokenId)
    if (!token) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const tokenPixelX = token.x * gridSize
    const tokenPixelY = token.y * gridSize
    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom

    setDragOffset({
      x: mouseX - tokenPixelX,
      y: mouseY - tokenPixelY,
    })
    setDraggingToken(tokenId)
    onTokenSelect?.(tokenId)
  }, [tokens, gridSize, isGM, zoom, pan, onTokenSelect])

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
      return
    }

    if (draggingToken) {
      const newX = mouseX - dragOffset.x
      const newY = mouseY - dragOffset.y
      const snapped = snapToGrid(newX, newY, gridSize)
      setGhostPos({ x: snapped.x / gridSize, y: snapped.y / gridSize })
    }
  }, [draggingToken, dragOffset, gridSize, isPanning, panStart, pan, zoom])

  // Handle mouse up - complete drag
  const handleMouseUp = useCallback(() => {
    if (draggingToken && ghostPos) {
      onTokenMove?.(draggingToken, ghostPos.x, ghostPos.y)
    }
    setDraggingToken(null)
    setGhostPos(null)
    setIsPanning(false)
  }, [draggingToken, ghostPos, onTokenMove])

  // Handle grid click
  const handleGridClick = useCallback((e: React.MouseEvent) => {
    if (draggingToken) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom
    const gridPos = pixelToGrid(mouseX, mouseY, gridSize)

    onCellClick?.(gridPos.x, gridPos.y)
    onTokenSelect?.(null)
  }, [gridSize, pan, zoom, onCellClick, onTokenSelect, draggingToken])

  // Handle right-click pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2 || e.button === 1) { // Right or middle click
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(2, Math.max(0.5, z * delta)))
  }, [])

  // Generate grid cells
  const cells = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push(
        <GridCell
          key={`${x}-${y}`}
          x={x}
          y={y}
          size={gridSize}
          isHighlighted={ghostPos?.x === x && ghostPos?.y === y}
        />
      )
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#0a0a0a',
        cursor: isPanning ? 'grabbing' : draggingToken ? 'grabbing' : 'default',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleMouseDown}
      onClick={handleGridClick}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          position: 'absolute',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: pixelWidth,
          height: pixelHeight,
        }}
      >
        {/* Background Map */}
        {mapUrl && (
          <img
            src={mapUrl}
            alt="Battle map"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: pixelWidth,
              height: pixelHeight,
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Grid Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: pixelWidth,
            height: pixelHeight,
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, ${gridSize}px)`,
            gridTemplateRows: `repeat(${height}, ${gridSize}px)`,
            pointerEvents: 'none',
          }}
        >
          {cells}
        </div>

        {/* Tokens */}
        {tokens.map(token => (
          <Token
            key={token.id}
            data={token}
            gridSize={gridSize}
            isSelected={selectedTokenId === token.id}
            isDragging={draggingToken === token.id}
            ghostPosition={draggingToken === token.id ? ghostPos : null}
            onMouseDown={(e) => handleTokenDragStart(e, token.id)}
            isGM={isGM}
          />
        ))}
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        fontSize: '0.75rem',
        color: '#64748b',
      }}>
        {Math.round(zoom * 100)}%
      </div>
    </div>
  )
}
