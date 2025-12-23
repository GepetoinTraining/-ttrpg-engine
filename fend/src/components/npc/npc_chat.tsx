import { useState, useRef, useEffect } from 'react'
import { Card, Button, Avatar, Badge, Input } from '@styles/processors/_internal'
import { Send, Mic, MicOff, Volume2, RotateCcw, Eye, EyeOff } from 'lucide-react'
import { trpc } from '@api/trpc'

export interface NpcChatProps {
  npc: {
    id: string
    name: string
    imageUrl?: string
    role?: string
    personality?: string
    voiceStyle?: string
  }
  campaignId: string
  sessionId?: string
  isGM: boolean
  onClose?: () => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'npc' | 'system'
  content: string
  timestamp: Date
  isSecret?: boolean
  speakerName?: string
}

export function NpcChat({ npc, campaignId, sessionId, isGM, onClose }: NpcChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [speakAs, setSpeakAs] = useState<'gm' | 'character'>('gm')
  const [characterName, setCharacterName] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const chatMutation = trpc.ai.npcChat.useMutation({
    onSuccess: (response) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'npc',
        content: response.message,
        timestamp: new Date(),
        speakerName: npc.name,
      }])
      setIsLoading(false)
    },
    onError: () => {
      setIsLoading(false)
    },
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      speakerName: isGM && speakAs === 'gm' ? 'GM' : characterName || 'Player',
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    chatMutation.mutate({
      npcId: npc.id,
      campaignId,
      sessionId,
      message: input,
      speakerContext: {
        isGM,
        speakAs,
        characterName: characterName || undefined,
      },
      conversationHistory: messages.slice(-10).map(m => ({
        role: m.role === 'npc' ? 'assistant' : 'user',
        content: m.content,
      })),
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearHistory = () => {
    setMessages([])
  }

  return (
    <Card variant="default" padding="none" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        borderBottom: '1px solid #1e293b',
      }}>
        <Avatar src={npc.imageUrl} name={npc.name} size="md" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{npc.name}</div>
          {npc.role && (
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>{npc.role}</div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={clearHistory} title="Clear history">
          <RotateCcw size={16} />
        </Button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: '#64748b',
            padding: '32px',
            fontSize: '0.875rem',
          }}>
            Start a conversation with {npc.name}
          </div>
        )}

        {messages.map(message => (
          <ChatBubble key={message.id} message={message} npcImage={npc.imageUrl} />
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar src={npc.imageUrl} name={npc.name} size="sm" />
            <div style={{
              padding: '12px 16px',
              background: '#1e293b',
              borderRadius: '12px',
              color: '#64748b',
            }}>
              <span className="typing-dots">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Speaker Toggle (GM only) */}
      {isGM && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.8125rem',
        }}>
          <span style={{ color: '#64748b' }}>Speaking as:</span>
          <button
            onClick={() => setSpeakAs('gm')}
            style={{
              padding: '4px 12px',
              background: speakAs === 'gm' ? '#f59e0b' : 'transparent',
              border: speakAs === 'gm' ? 'none' : '1px solid #334155',
              borderRadius: '4px',
              color: speakAs === 'gm' ? '#0f172a' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: speakAs === 'gm' ? 600 : 400,
            }}
          >
            GM
          </button>
          <button
            onClick={() => setSpeakAs('character')}
            style={{
              padding: '4px 12px',
              background: speakAs === 'character' ? '#0ea5e9' : 'transparent',
              border: speakAs === 'character' ? 'none' : '1px solid #334155',
              borderRadius: '4px',
              color: speakAs === 'character' ? '#0f172a' : '#94a3b8',
              cursor: 'pointer',
              fontWeight: speakAs === 'character' ? 600 : 400,
            }}
          >
            Character
          </button>
          {speakAs === 'character' && (
            <input
              type="text"
              placeholder="Character name..."
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              style={{
                padding: '4px 8px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontSize: '0.8125rem',
                width: '120px',
              }}
            />
          )}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        gap: '8px',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`Say something to ${npc.name}...`}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '0.9375rem',
            outline: 'none',
          }}
        />
        <Button
          variant="primary"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send size={18} />
        </Button>
      </div>
    </Card>
  )
}

function ChatBubble({
  message,
  npcImage
}: {
  message: ChatMessage
  npcImage?: string
}) {
  const isNpc = message.role === 'npc'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      flexDirection: isNpc ? 'row' : 'row-reverse',
    }}>
      {isNpc && <Avatar src={npcImage} name={message.speakerName} size="sm" />}

      <div style={{
        maxWidth: '70%',
        padding: '12px 16px',
        background: isNpc ? '#1e293b' : '#0ea5e9',
        borderRadius: isNpc ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
        color: isNpc ? '#e2e8f0' : '#0f172a',
      }}>
        {!isNpc && message.speakerName && (
          <div style={{
            fontSize: '0.6875rem',
            marginBottom: '4px',
            opacity: 0.8,
            fontWeight: 600,
          }}>
            {message.speakerName}
          </div>
        )}
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {message.content}
        </div>
      </div>
    </div>
  )
}
