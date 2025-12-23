import { useState, useRef, useEffect } from 'react'
import { Card, Button, Badge } from '@styles/processors/_internal'
import { ZoomIn, ZoomOut, Maximize2, MapPin, Eye, EyeOff } from 'lucide-react'

export interface MapMarker {
  id: string
  name: string
  type: 'city' | 'town' | 'village' | 'dungeon' | 'landmark' | 'poi'
  x: number // percentage 0-100
  y: number // percentage 0-100
  isKnown: boolean
  isCurrentLocation?: boolean
}

export interface RegionMapProps {
  imageUrl: string
  markers: MapMarker[]
  isGM: boolean
  currentLocationId?: string
  onMarkerClick?: (markerId: string) => void
  onMarkerDrag?: (markerId: string, x: number, y: number) => void
}

const MARKER_COLORS: Record<string, string> = {
  city: '#f59e0b',
  town: '#0ea5e9',
  village: '#22c55e',
  dungeon: '#ef4444',
  landmark: '#8b5cf6',
  poi: '#64748b',
}

export function RegionMap({
  imageUrl,
  markers,
  isGM,
  currentLocationId,
  onMarkerClick,
  onMarkerDrag,
}: RegionMapProps) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [showHidden, setShowHidden] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const visibleMarkers = markers.filter(m => m.isKnown || (isGM && showHidden))

  return (
    <Card variant="default" padding="none" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 10,
        display: 'flex',
        gap: '8px',
      }}>
        {isGM && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHidden(!showHidden)}
            style={{ background: 'rgba(15, 23, 42, 0.8)' }}
          >
            {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleZoom(0.25)}
          style={{ background: 'rgba(15, 23, 42, 0.8)' }}
        >
          <ZoomIn size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleZoom(-0.25)}
          style={{ background: 'rgba(15, 23, 42, 0.8)' }}
        >
          <ZoomOut size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetView}
          style={{ background: 'rgba(15, 23, 42, 0.8)' }}
        >
          <Maximize2 size={16} />
        </Button>
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        zIndex: 10,
        padding: '4px 8px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '4px',
        fontSize: '0.75rem',
        color: '#94a3b8',
      }}>
        {Math.round(zoom * 100)}%
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '500px',
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            position: 'relative',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 150ms',
          }}
        >
          {/* Map Image */}
          <img
            src={imageUrl}
            alt="Region Map"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            draggable={false}
          />

          {/* Markers */}
          {visibleMarkers.map(marker => (
            <MapMarkerPin
              key={marker.id}
              marker={marker}
              isGM={isGM}
              isCurrent={marker.id === currentLocationId}
              onClick={() => onMarkerClick?.(marker.id)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        fontSize: '0.75rem',
      }}>
        {Object.entries(MARKER_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
            }} />
            <span style={{ color: '#94a3b8', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function MapMarkerPin({
  marker,
  isGM,
  isCurrent,
  onClick,
}: {
  marker: MapMarker
  isGM: boolean
  isCurrent: boolean
  onClick: () => void
}) {
  const color = MARKER_COLORS[marker.type] || MARKER_COLORS.poi

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      style={{
        position: 'absolute',
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        transform: 'translate(-50%, -100%)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        opacity: marker.isKnown ? 1 : 0.5,
      }}
      title={marker.name}
    >
      {/* Pin */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Current location pulse */}
        {isCurrent && (
          <div style={{
            position: 'absolute',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: `${color}40`,
            animation: 'pulse 2s infinite',
          }} />
        )}

        <MapPin
          size={24}
          fill={color}
          style={{
            color: '#0f172a',
            filter: isCurrent ? 'drop-shadow(0 0 8px ' + color + ')' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          }}
        />

        {/* Label */}
        <div style={{
          marginTop: '2px',
          padding: '2px 6px',
          background: 'rgba(15, 23, 42, 0.9)',
          borderRadius: '4px',
          fontSize: '0.6875rem',
          color: '#e2e8f0',
          whiteSpace: 'nowrap',
        }}>
          {marker.name}
          {!marker.isKnown && isGM && (
            <EyeOff size={10} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
          )}
        </div>
      </div>
    </button>
  )
}
