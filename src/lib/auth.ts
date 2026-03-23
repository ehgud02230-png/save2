import { createHmac } from 'crypto'

const SECRET = process.env.AUTH_SECRET ?? 'abidding-secret-key-change-me'

export function createToken(username: string): string {
  const payload = `${username}:${Date.now()}`
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const lastColon = decoded.lastIndexOf(':')
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex')
    if (sig !== expected) return null
    return payload.split(':')[0]
  } catch {
    return null
  }
}

export function getUsers(): Record<string, string> {
  const raw = process.env.AUTH_USERS ?? ''
  const users: Record<string, string> = {}
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':')
    if (idx === -1) continue
    const u = pair.slice(0, idx).trim()
    const p = pair.slice(idx + 1).trim()
    if (u && p) users[u] = p
  }
  return users
}
