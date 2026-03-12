import { NextResponse } from 'next/server'

export function databaseUnavailableResponse() {
  return NextResponse.json(
    {
      error: 'database unavailable',
      detail: 'DATABASE_URL is not configured',
    },
    { status: 503 }
  )
}
