import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const username = verifyToken(token)
  if (!username) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ username })
}
