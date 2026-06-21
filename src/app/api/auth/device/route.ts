import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/auth/device
 *
 * Simple device-based auth. The browser generates a random key on first
 * visit and sends it here. We create a User row if it doesn't exist.
 * Returns the user ID which is stored in localStorage and sent with
 * every subsequent API request.
 *
 * For production multi-user, replace with NextAuth.js.
 */

export async function POST(req: NextRequest) {
  const { deviceKey } = await req.json()

  if (!deviceKey || typeof deviceKey !== 'string') {
    return NextResponse.json(
      { error: 'Missing deviceKey' },
      { status: 400 },
    )
  }

  // Find or create user
  let user = await db.user.findUnique({
    where: { deviceKey },
  })

  if (!user) {
    user = await db.user.create({
      data: { deviceKey },
    })
    console.log(`[auth] Created new user: ${user.id}`)
  }

  return NextResponse.json({
    userId: user.id,
    isNew: user.createdAt.getTime() > Date.now() - 5000,
  })
}
