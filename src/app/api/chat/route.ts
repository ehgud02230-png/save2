import { NextRequest, NextResponse } from 'next/server'

// ── 타입 정의 ────────────────────────────────────────────────────────────────
interface FileAttachment {
  name: string
  type: string
  base64: string
}

type ProcessedFile =
  | { kind: 'image'; mediaType: string; data: string }
  | { kind: 'text'; text: string }

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface ApiMessage {
  role: 'user' | 'assistant'
  content: string | ContentPart[]
  reasoning_details?: unknown // 어시스턴트 메시지에서 받아 다음 턴에 그대로 전달
}

interface FrontendMessage {
  role: string
  content: string
  reasoning_details?: unknown
}

// ── 파일 파싱 함수들 ──────────────────────────────────────────────────────────
async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.match(/\d+/)?.[0] || '0')
      return numA - numB
    })

  const slideTexts: string[] = []
  for (const slideFile of slideFiles) {
    const content = await zip.files[slideFile].async('string')
    const matches = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
    const text = matches
      .map((m) => m.replace(/<[^>]+>/g, '').trim())
      .filter((t) => t.length > 0)
      .join(' ')
    if (text) slideTexts.push(text)
  }
  return slideTexts.join('\n')
}

async function processFile(file: FileAttachment): Promise<ProcessedFile> {
  const buffer = Buffer.from(file.base64, 'base64')

  if (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp') {
    return { kind: 'image', mediaType: file.type, data: file.base64 }
  }

  if (file.type === 'application/pdf') {
    try {
      const pdfParse = await import('pdf-parse')
      const fn = (pdfParse as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default
      if (typeof fn === 'function') {
        const result = await fn(buffer)
        return { kind: 'text', text: `[PDF 파일: ${file.name}]\n${result.text}` }
      }
      const { PDFParse } = pdfParse as unknown as {
        PDFParse: new (o: { data: Buffer }) => { getText(): Promise<{ text: string }> }
      }
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      return { kind: 'text', text: `[PDF 파일: ${file.name}]\n${result.text}` }
    } catch (err) {
      console.error('[pdf-parse] error:', err)
      return { kind: 'text', text: `[PDF 파일: ${file.name}] (텍스트 추출 실패)` }
    }
  }

  if (
    file.type === 'text/plain' ||
    file.type === 'text/csv' ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.csv')
  ) {
    return { kind: 'text', text: `[파일: ${file.name}]\n${buffer.toString('utf-8')}` }
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return { kind: 'text', text: `[Word 파일: ${file.name}]\n${result.value}` }
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.name.endsWith('.xlsx')
  ) {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer)
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name]
      return `[시트: ${name}]\n${XLSX.utils.sheet_to_csv(sheet)}`
    })
    return { kind: 'text', text: `[Excel 파일: ${file.name}]\n${sheets.join('\n\n')}` }
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.name.endsWith('.pptx')
  ) {
    const text = await extractPptxText(buffer)
    return { kind: 'text', text: `[PowerPoint 파일: ${file.name}]\n${text}` }
  }

  return { kind: 'text', text: `[파일: ${file.name}]` }
}

// ── 라우트 설정 ───────────────────────────────────────────────────────────────
export const maxDuration = 60

const MAX_BODY_BYTES = 4.5 * 1024 * 1024 // Vercel 무료 플랜 최대치

// ── POST 핸들러 ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Content-Length 사전 검사
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error: `요청 크기가 너무 큽니다. 파일 총 크기를 4MB 이하로 줄여주세요. (현재: ${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB)`,
        },
        { status: 413 }
      )
    }

    let messages: FrontendMessage[]
    let files: FileAttachment[]
    try {
      const body = await req.json()
      messages = body.messages
      files = body.files
    } catch {
      return NextResponse.json(
        { error: '요청 크기가 너무 큽니다. 파일 총 크기를 4MB 이하로 줄여주세요.' },
        { status: 413 }
      )
    }

    // 파일 파싱
    const processedFiles: ProcessedFile[] =
      files && files.length > 0
        ? await Promise.all(
            files.map(async (f) => {
              try {
                return await processFile(f)
              } catch (err) {
                console.error(`[chat] processFile 실패 - ${f.name}:`, err)
                return { kind: 'text' as const, text: `[파일 처리 오류: ${f.name}]` }
              }
            })
          )
        : []

    const textFilesContent = processedFiles
      .filter((f): f is Extract<ProcessedFile, { kind: 'text' }> => f.kind === 'text')
      .map((f) => f.text)
      .join('\n\n')

    // ── 메시지 히스토리 구성 (reasoning_details 보존) ─────────────────────────
    const historyMessages: ApiMessage[] = messages.slice(0, -1).map((msg) => {
      const base: ApiMessage = {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }
      // 어시스턴트 메시지의 reasoning_details를 그대로 전달 (샘플 코드의 핵심)
      if (msg.role === 'assistant' && msg.reasoning_details) {
        base.reasoning_details = msg.reasoning_details
      }
      return base
    })

    // 현재 유저 메시지 구성 (파일 포함)
    const lastMessage = messages[messages.length - 1]
    const messageText = textFilesContent
      ? `${textFilesContent}\n\n${lastMessage.content}`
      : lastMessage.content

    const imageFiles = processedFiles.filter(
      (f): f is Extract<ProcessedFile, { kind: 'image' }> => f.kind === 'image'
    )

    let currentContent: string | ContentPart[]
    if (imageFiles.length > 0) {
      const parts: ContentPart[] = imageFiles.map((f) => ({
        type: 'image_url' as const,
        image_url: { url: `data:${f.mediaType};base64,${f.data}` },
      }))
      parts.push({ type: 'text' as const, text: messageText })
      currentContent = parts
    } else {
      currentContent = messageText
    }

    const allMessages: ApiMessage[] = [
      ...historyMessages,
      { role: 'user', content: currentContent },
    ]

    // ── OpenRouter API 호출 ───────────────────────────────────────────────────
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.4',
        messages: allMessages,
        reasoning: { enabled: true },
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      const errMsg = (errData as { error?: { message?: string } }).error?.message
      throw new Error(errMsg || `OpenRouter 오류 (${response.status})`)
    }

    const result = await response.json()
    const message = result.choices[0].message

    return NextResponse.json({
      content: message.content,
      reasoning_details: message.reasoning_details, // 프론트엔드가 다음 턴에 전달할 수 있도록 반환
      userMessage: messageText,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[chat] POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
