import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.2',
    messages,
  })

  const content = completion.choices[0].message.content

  return NextResponse.json({ content })
}
