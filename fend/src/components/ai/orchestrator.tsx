import { useState, useRef, useEffect } from 'react'
import { Card, Button, Badge, Spinner } from '@styles/processors/_internal'
import { Send, Bot, User, Sparkles, FileText, Users, Swords, MapPin, Wand2 } from 'lucide-react'
import { trpc } from '@api/trpc'

export interface OrchestratorProps {
  campaignId: string
  sessionId?: string
  context?: {
    currentScene?: string
    currentLocation?: string
    activeNpcs?: string[]
    combatActive?: boolean
  }
}

type AgentType = 'narrator' | 'npc' | 'rules' | 'combat' | 'world' | 'general'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  agent?: AgentType
  timestamp: Date
}

const AGENT_INFO: Record<AgentType, { icon: React.ReactNode; color: string; label: string }> = {
  narrator: { icon: <FileText size={14} />, color: '#8b5cf6', label: 'Narrator' },
  npc: { icon: <Users size={14} />, color: '#0ea5e9', label: 'NPC Agent' },
  rules: { icon: <FileText size={14} />, color: '#f59e0b', label: 'Rules Expert' },
  combat: { icon: <Swords size={14} />, color: '#ef4444', label: 'Combat Master' },
  world: { icon: <MapPin size={14} />, color: '#22c55e', label: 'World Builder' },
  general: { icon: <Bot size={14} />, color: '#64748b', label: 'Assistant' },
}

export function Orchestrator({ campaignId, sessionId, context }: OrchestratorProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const orchestrateMutation = trpc.ai.orchestrate.useMutation({
    onSuccess: (response) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        agent: response.agent as AgentType,
        timestamp: new Date(),
      }])
      setIsProcessing(false)
      setCurrentAgent(null)
    },
    onError: () => {
      setIsProcessing(false)
      setCurrentAgent(null)
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isProcessing) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsProcessing(true)

    orchestrateMutation.mutate({
      campaignId,
      sessionId,
      message: input,
      context,
      conversationHistory: messages.slice(-10).map(m => ({
        role: m.role,
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
        <Wand2 size={20} style={{ color: '#f59e0b' }} />
        <span style={{ fontWeight: 600, color: '#f8fafc' }}>AI Orchestrator</span>
        <Badge variant="default" style={{ marginLeft: 'auto' }}>
          {Object.keys(AGENT_INFO).length} agents
        </Badge>
      </div>

      {/* Agent Quick Access */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderBottom: '1px solid #1e293b',
        overflowX: 'auto',
      }}>
        {Object.entries(AGENT_INFO).map(([type, info]) => (
          <button
            key={type}
            onClick={() => setInput(prev => `@${type} ${prev}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              color: info.color,
              fontSize: '0.75rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {info.icon}
            {info.label}
          </button>
        ))}
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
          }}>
            <Wand2 size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ margin: '0 0 8px' }}>Ask me anything about your campaign</p>
            <p style={{ margin: 0, fontSize: '0.8125rem' }}>
              I'll route your request to the right AI agent
            </p>
          </div>
        )}

        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: currentAgent
                ? AGENT_INFO[currentAgent]?.color + '20'
                : 'rgba(139,92,246,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={16} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{
              padding: '12px 16px',
              background: '#1e293b',
              borderRadius: '12px',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <Spinner size="sm" />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context Bar */}
      {context && (context.currentScene || context.currentLocation || context.combatActive) && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: '12px',
          fontSize: '0.75rem',
          color: '#64748b',
        }}>
          {context.currentScene && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} /> {context.currentScene}
            </span>
          )}
          {context.currentLocation && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} /> {context.currentLocation}
            </span>
          )}
          {context.combatActive && (
            <Badge variant="danger" style={{ fontSize: '0.625rem' }}>
              <Swords size={10} /> Combat
            </Badge>
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
          placeholder="Ask the AI... (use @agent to route directly)"
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
          disabled={!input.trim() || isProcessing}
        >
          <Send size={18} />
        </Button>
      </div>
    </Card>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const agentInfo = message.agent ? AGENT_INFO[message.agent] : null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {/* Avatar */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: isUser ? '#0ea5e9' : (agentInfo?.color || '#8b5cf6') + '20',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isUser ? (
          <User size={16} style={{ color: '#fff' }} />
        ) : (
          agentInfo?.icon || <Bot size={16} style={{ color: '#8b5cf6' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: '70%' }}>
        {!isUser && agentInfo && (
          <div style={{
            fontSize: '0.6875rem',
            color: agentInfo.color,
            marginBottom: '4px',
            fontWeight: 600,
          }}>
            {agentInfo.label}
          </div>
        )}
        <div style={{
          padding: '12px 16px',
          background: isUser ? '#0ea5e9' : '#1e293b',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          color: isUser ? '#0f172a' : '#e2e8f0',
        }}>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {message.content}
          </div>
        </div>
      </div>
    </div>
  )
}
