import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { PDFParse } from 'pdf-parse'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface FileAttachment {
  name: string
  type: string
  base64: string
}

type ProcessedFile =
  | { kind: 'image'; mediaType: string; data: string }
  | { kind: 'text'; text: string }

async function extractPptxText(buffer: Buffer): Promise<string> {
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
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    return { kind: 'text', text: `[PDF 파일: ${file.name}]\n${result.text}` }
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
    const result = await mammoth.extractRawText({ buffer })
    return { kind: 'text', text: `[Word 파일: ${file.name}]\n${result.value}` }
  }

  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.name.endsWith('.xlsx')
  ) {
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

export async function POST(req: NextRequest) {
  const { messages, files } = await req.json()

  // ── 1. 수신된 파일 목록 확인 ──────────────────────────────────────
  console.log('[chat] 수신된 files:', files?.length ?? 0, '개',
    files?.map((f: FileAttachment) => `${f.name}(${f.type}, base64 len:${f.base64?.length})`))

  const processedFiles: ProcessedFile[] =
    files && files.length > 0
      ? await Promise.all(
          files.map(async (f: FileAttachment) => {
            try {
              return await processFile(f)
            } catch (err) {
              console.error(`[chat] processFile 실패 - ${f.name}:`, err)
              return { kind: 'text' as const, text: `[파일 처리 오류: ${f.name}]` }
            }
          })
        )
      : []

  // ── 2. 파싱 결과 확인 ─────────────────────────────────────────────
  console.log('[chat] processedFiles:',
    processedFiles.map((f) =>
      f.kind === 'text'
        ? `text(${f.text.slice(0, 100)}...)`
        : `image(${f.mediaType})`
    )
  )

  // Collect text from non-image files
  const textFilesContent = processedFiles
    .filter((f): f is Extract<ProcessedFile, { kind: 'text' }> => f.kind === 'text')
    .map((f) => f.text)
    .join('\n\n')

  // Build OpenAI message history
  type ContentPart =
    | OpenAI.Chat.ChatCompletionContentPartText
    | OpenAI.Chat.ChatCompletionContentPartImage

  type ApiMessage = {
    role: 'user' | 'assistant'
    content: string | ContentPart[]
  }

  const historyMessages: ApiMessage[] = messages.slice(0, -1).map(
    (msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })
  )

  // Build current message content
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

  // ── 3. API에 전달되는 최종 메시지 확인 ───────────────────────────
  console.log('[chat] allMessages (마지막 메시지):',
    JSON.stringify(
      allMessages[allMessages.length - 1],
      (key, val) =>
        key === 'url' && typeof val === 'string' && val.startsWith('data:')
          ? val.slice(0, 50) + '...[base64 truncated]'
          : val
    )
  )

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: allMessages as OpenAI.Chat.ChatCompletionMessageParam[],
  })

  const content = completion.choices[0].message.content
  // userMessage: 파일 내용이 포함된 실제 전송 텍스트 (히스토리 보존용)
  return NextResponse.json({ content, userMessage: messageText })
}
