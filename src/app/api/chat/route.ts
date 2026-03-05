import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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
      // pdf-parse v2 class-based API
      const { PDFParse } = pdfParse as unknown as { PDFParse: new (o: { data: Buffer }) => { getText(): Promise<{ text: string }> } }
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

export async function POST(req: NextRequest) {
  try {
    const { messages, files } = await req.json()

    console.log('[chat] 수신된 files:', files?.length ?? 0, '개',
      files?.map((f: FileAttachment) => `${f.name}(${f.type})`))

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

    console.log('[chat] processedFiles:',
      processedFiles.map((f) =>
        f.kind === 'text' ? `text(${f.text.slice(0, 80)}...)` : `image(${f.mediaType})`
      )
    )

    const textFilesContent = processedFiles
      .filter((f): f is Extract<ProcessedFile, { kind: 'text' }> => f.kind === 'text')
      .map((f) => f.text)
      .join('\n\n')

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

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: allMessages as OpenAI.Chat.ChatCompletionMessageParam[],
    })

    const content = completion.choices[0].message.content
    return NextResponse.json({ content, userMessage: messageText })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[chat] POST error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
