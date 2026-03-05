'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Paperclip, X, FileText, FileSpreadsheet, Presentation, File } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  attachments?: { name: string; type: string; previewUrl?: string }[]
}

interface AttachedFile {
  id: string
  name: string
  type: string
  base64: string
  previewUrl?: string
}

const ACCEPT_TYPES =
  'image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.txt,.csv,.docx,.xlsx,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation'

function FileIcon({ type, name }: { type: string; name: string }) {
  if (name.endsWith('.xlsx') || type.includes('spreadsheetml')) {
    return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  }
  if (name.endsWith('.pptx') || type.includes('presentationml')) {
    return <Presentation className="w-5 h-5 text-orange-500" />
  }
  if (name.endsWith('.docx') || type.includes('wordprocessingml')) {
    return <FileText className="w-5 h-5 text-blue-600" />
  }
  if (type === 'application/pdf') {
    return <FileText className="w-5 h-5 text-red-500" />
  }
  return <File className="w-5 h-5 text-gray-500" />
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    for (const file of selected) {
      const base64 = await readFileAsBase64(file)
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      setAttachedFiles((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, type: file.type, base64, previewUrl },
      ])
    }
    e.target.value = ''
  }

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  const sendMessage = async () => {
    const trimmed = input.trim()
    if ((!trimmed && attachedFiles.length === 0) || loading) return

    const userText = trimmed || '파일을 첨부했습니다.'
    const filesToSend = [...attachedFiles]
    const attachments = filesToSend.map((f) => ({
      name: f.name,
      type: f.type,
      previewUrl: f.previewUrl,
    }))

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userText, attachments },
    ]
    setMessages(newMessages)
    setInput('')
    setAttachedFiles([])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          files: filesToSend.map((f) => ({ name: f.name, type: f.type, base64: f.base64 })),
        }),
      })
      const data = await res.json()
      setMessages((prev) => {
        const updated = [...prev]
        // 파일 내용이 포함된 실제 메시지로 히스토리 업데이트 (후속 대화에서도 파일 내용 유지)
        if (data.userMessage && data.userMessage !== userText) {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: data.userMessage,
          }
        }
        return [...updated, { role: 'assistant', content: data.content }]
      })
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-65px)] max-w-2xl mx-auto px-4 py-6">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-20">메시지를 입력하여 대화를 시작하세요.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap space-y-2 ${
                msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.attachments.map((att, j) => (
                    <div key={j} className="flex items-center gap-1">
                      {att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2 py-1">
                          <FileIcon type={att.type} name={att.name} />
                          <span className="text-xs max-w-[120px] truncate">{att.name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-2 text-sm">
              입력 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 첨부 파일 미리보기 */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="relative flex items-center gap-1.5 bg-white rounded-lg border border-gray-200 px-2 py-1.5 text-sm shadow-sm"
            >
              {file.previewUrl ? (
                <img
                  src={file.previewUrl}
                  alt={file.name}
                  className="w-10 h-10 object-cover rounded"
                />
              ) : (
                <FileIcon type={file.type} name={file.name} />
              )}
              <span className="max-w-[120px] truncate text-xs text-gray-700">{file.name}</span>
              <button
                onClick={() => removeFile(file.id)}
                className="ml-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 입력 영역 */}
      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_TYPES}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          title="파일 첨부"
        >
          <Paperclip className="w-5 h-5 text-gray-500" />
        </button>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력... (Enter 전송, Shift+Enter 줄바꿈)"
          className="resize-none min-h-[60px] max-h-[160px]"
          disabled={loading}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || (!input.trim() && attachedFiles.length === 0)}
        >
          전송
        </Button>
      </div>
    </div>
  )
}
