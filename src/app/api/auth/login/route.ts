import { NextRequest, NextResponse } from 'next/server'
import { createToken, getUsers } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  const users = getUsers()
  console.log('[login] AUTH_USERS raw:', process.env.AUTH_USERS)
  console.log('[login] parsed users:', Object.keys(users))
  console.log('[login] attempt:', username, '/ match:', users[username] === password)

  if (!username || !password || users[username] !== password) {
    return NextResponse.json(
      { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
      { status: 401 }
    )
  }

  const token = createToken(username)
  const res = NextResponse.json({ ok: true, username })
  res.cookies.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })
  return res
}
