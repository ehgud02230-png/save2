'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Paperclip, X, FileText, FileSpreadsheet, Presentation, File, Plus, Trash2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  apiContent?: string
  attachments?: { name: string; type: string; previewUrl?: string }[]
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

interface AttachedFile {
  id: string
  name: string
  type: string
  base64: string
  previewUrl?: string
}

const STORAGE_KEY = 'abidding-conversations'
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_TOTAL_BASE64 = 4 * 1024 * 1024
const ACCEPT_TYPES =
  'image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.txt,.csv,.docx,.xlsx,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation'

function FileIcon({ type, name }: { type: string; name: string }) {
  if (name.endsWith('.xlsx') || type.includes('spreadsheetml')) return <FileSpreadsheet className="w-5 h-5 text-green-600" />
  if (name.endsWith('.pptx') || type.includes('presentationml')) return <Presentation className="w-5 h-5 text-orange-500" />
  if (name.endsWith('.docx') || type.includes('wordprocessingml')) return <FileText className="w-5 h-5 text-blue-600" />
  if (type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />
  return <File className="w-5 h-5 text-gray-500" />
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function compressImage(file: File): Promise<{ base64: string; type: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      const MAX_DIM = 1920
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        readFileAsBase64(file).then((base64) => resolve({ base64, type: file.type })).catch(reject)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], type: 'image/jpeg' })
    }
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${file.name}`))
    img.src = objectUrl
  })
}

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs))
  } catch {
    // 저장 공간 부족 등 무시
  }
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentIdRef = useRef<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // 초기 로드
  useEffect(() => {
    setConversations(loadConversations())
  }, [])

  // currentId 변경 시 ref 동기화
  useEffect(() => {
    currentIdRef.current = currentId
  }, [currentId])

  // 메시지 변경 시 자동 저장
  useEffect(() => {
    if (messages.length === 0) return
    const title = (messages.find((m) => m.role === 'user')?.content ?? '새 대화').slice(0, 30)
    setConversations((prev) => {
      const id = currentIdRef.current
      let updated: Conversation[]
      if (id && prev.some((c) => c.id === id)) {
        updated = prev.map((c) => (c.id === id ? { ...c, title, messages } : c))
      } else {
        const newId = crypto.randomUUID()
        currentIdRef.current = newId
        setCurrentId(newId)
        updated = [{ id: newId, title, messages, createdAt: Date.now() }, ...prev]
      }
      saveConversations(updated)
      return updated
    })
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startNewChat = () => {
    setCurrentId(null)
    setMessages([])
    setInput('')
    setAttachedFiles([])
  }

  const selectConversation = (conv: Conversation) => {
    setCurrentId(conv.id)
    setMessages(conv.messages)
    setInput('')
    setAttachedFiles([])
  }

  const startEditTitle = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditingTitle(conv.title)
    setTimeout(() => titleInputRef.current?.select(), 0)
  }

  const commitEditTitle = () => {
    if (!editingId) return
    const trimmed = editingTitle.trim()
    if (trimmed) {
      setConversations((prev) => {
        const updated = prev.map((c) => (c.id === editingId ? { ...c, title: trimmed } : c))
        saveConversations(updated)
        return updated
      })
    }
    setEditingId(null)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEditTitle()
    if (e.key === 'Escape') setEditingId(null)
  }

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations((prev) => {
      const updated = prev.filter((c) => c.id !== id)
      saveConversations(updated)
      return updated
    })
    if (currentIdRef.current === id) startNewChat()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const oversized = selected.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      alert(
        `파일 크기 초과: ${oversized.map((f) => f.name).join(', ')}\n` +
          `파일 1개당 최대 10MB까지 첨부 가능합니다. (이미지는 자동 압축됩니다)`
      )
      e.target.value = ''
      return
    }
    for (const file of selected) {
      let base64: string
      let type = file.type
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file)
        base64 = compressed.base64
        type = compressed.type
      } else {
        base64 = await readFileAsBase64(file)
      }
      setAttachedFiles((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, type, base64, previewUrl },
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

    const filesToSend = [...attachedFiles]
    const totalBase64Size = filesToSend.reduce((sum, f) => sum + f.base64.length, 0)
    if (totalBase64Size > MAX_TOTAL_BASE64) {
      alert(
        `첨부파일 총 크기가 너무 큽니다. (${(totalBase64Size / 1024 / 1024).toFixed(1)}MB)\n` +
          `파일 총합 4MB 이하로 줄여주세요.`
      )
      return
    }

    const userText = trimmed || '파일을 첨부했습니다.'
    const attachments = filesToSend.map((f) => ({ name: f.name, type: f.type, previewUrl: f.previewUrl }))
    const newMessages: Message[] = [...messages, { role: 'user', content: userText, attachments }]
    setMessages(newMessages)
    setInput('')
    setAttachedFiles([])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.apiContent ?? m.content })),
          files: filesToSend.map((f) => ({ name: f.name, type: f.type, base64: f.base64 })),
        }),
      })

      const text = await res.text()
      let data: { content?: string; userMessage?: string; error?: string }
      try {
        data = JSON.parse(text)
      } catch {
        const msg =
          res.status === 413 || text.includes('Too Large') || text.includes('Entity')
            ? '파일 크기가 너무 큽니다. 파일을 줄이거나 나눠서 전송해주세요.'
            : `서버 오류 (${res.status})`
        alert(msg)
        return
      }

      if (!res.ok) {
        alert(data.error || `서버 오류 (${res.status})`)
        return
      }

      setMessages((prev) => {
        const updated = [...prev]
        if (data.userMessage && data.userMessage !== userText) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], apiContent: data.userMessage }
        }
        return [...updated, { role: 'assistant' as const, content: data.content ?? '' }]
      })
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다. 다시 시도해주세요.')
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
    <div className="flex h-[calc(100vh-65px)]">
      {/* 사이드바 */}
      <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 대화
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-6">저장된 대화가 없습니다.</p>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => editingId !== conv.id && selectConversation(conv)}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                currentId === conv.id ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {editingId === conv.id ? (
                <input
                  ref={titleInputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={commitEditTitle}
                  onKeyDown={handleTitleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-sm text-gray-900 outline-none min-w-0"
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  onDoubleClick={(e) => startEditTitle(conv, e)}
                  title="더블클릭하여 제목 수정"
                >
                  {conv.title}
                </span>
              )}
              {editingId !== conv.id && (
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0 px-4 py-6 max-w-2xl mx-auto w-full">
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
                          <img src={att.previewUrl} alt={att.name} className="w-20 h-20 object-cover rounded-lg" />
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
              <div className="bg-gray-100 text-gray-500 rounded-2xl px-4 py-2 text-sm">입력 중...</div>
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
                  <img src={file.previewUrl} alt={file.name} className="w-10 h-10 object-cover rounded" />
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
    </div>
  )
}
