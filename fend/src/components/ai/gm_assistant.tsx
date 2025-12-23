import { useState, useRef, useEffect } from 'react'
import { Card, Button, Badge, Spinner } from '@styles/processors/_internal'
import { Send, HelpCircle, BookOpen, Scale, Lightbulb, Clock, History, Trash2 } from 'lucide-react'
import { trpc } from '@api/trpc'

export interface GmAssistantProps {
  campaignId: string
  sessionId?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  category?: 'rules' | 'advice' | 'reminder' | 'general'
  timestamp: Date
}

const QUICK_PROMPTS = [
  { icon: <Scale size={14} />, label: 'Rule check', prompt: 'How does the rule for ' },
  { icon: <Lightbulb size={14} />, label: 'Plot hook', prompt: 'Give me a plot hook that ' },
  { icon: <Clock size={14} />, label: 'Pacing', prompt: 'How should I pace the next ' },
  { icon: <BookOpen size={14} />, label: 'Lore', prompt: 'Tell me about ' },
]

export function GmAssistant({ campaignId, sessionId }: GmAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const askMutation = trpc.ai.gmAssist.useMutation({
    onSuccess: (response) => {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.message,
        category: response.category as any,
        timestamp: new Date(),
      }])
      setIsProcessing(false)
    },
    onError: () => {
      setIsProcessing(false)
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

    askMutation.mutate({
      campaignId,
      sessionId,
      question: input,
      conversationHistory: messages.slice(-6).map(m => ({
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

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
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
        <HelpCircle size={20} style={{ color: '#22c55e' }} />
        <span style={{ fontWeight: 600, color: '#f8fafc' }}>GM Assistant</span>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Out-of-character help</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Quick Prompts */}
      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        borderBottom: '1px solid #1e293b',
        overflowX: 'auto',
      }}>
        {QUICK_PROMPTS.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleQuickPrompt(qp.prompt)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              color: '#94a3b8',
              fontSize: '0.75rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {qp.icon}
            {qp.label}
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
            <HelpCircle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <p style={{ margin: '0 0 8px' }}>I'm here to help with GM questions</p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.8125rem',
              textAlign: 'left',
              maxWidth: '280px',
              margin: '0 auto',
            }}>
              <span>📜 Rules clarifications</span>
              <span>💡 Story advice</span>
              <span>⚖️ Ruling suggestions</span>
              <span>🎭 Roleplay tips</span>
            </div>
          </div>
        )}

        {messages.map(message => (
          <AssistantMessageBubble key={message.id} message={message} />
        ))}

        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(34,197,94,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <HelpCircle size={16} style={{ color: '#22c55e' }} />
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
              <span>Consulting the tomes...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Disclaimer */}
      <div style={{
        padding: '8px 16px',
        borderTop: '1px solid #1e293b',
        fontSize: '0.6875rem',
        color: '#475569',
        textAlign: 'center',
      }}>
        Rules interpretations may vary. You're the final arbiter at your table.
      </div>

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
          placeholder="Ask a GM question..."
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

function AssistantMessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  const categoryColors: Record<string, string> = {
    rules: '#f59e0b',
    advice: '#22c55e',
    reminder: '#0ea5e9',
    general: '#64748b',
  }

  const categoryLabels: Record<string, string> = {
    rules: 'Rules',
    advice: 'Advice',
    reminder: 'Reminder',
    general: 'Info',
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      flexDirection: isUser ? 'row-reverse' : 'row',
    }}>
      {!isUser && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <HelpCircle size={16} style={{ color: '#22c55e' }} />
        </div>
      )}

      <div style={{ maxWidth: '80%' }}>
        {!isUser && message.category && (
          <Badge
            variant="default"
            style={{
              marginBottom: '4px',
              fontSize: '0.625rem',
              color: categoryColors[message.category],
              borderColor: categoryColors[message.category],
            }}
          >
            {categoryLabels[message.category]}
          </Badge>
        )}
        <div style={{
          padding: '12px 16px',
          background: isUser ? '#0ea5e9' : '#1e293b',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          color: isUser ? '#0f172a' : '#e2e8f0',
        }}>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {message.content}
          </div>
        </div>
      </div>
    </div>
  )
}
