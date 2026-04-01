'use client'

import { useEffect, useState } from 'react'
import { CustomCursorArt } from '@/components/site/CustomCursorArt'

type CursorState = {
  x: number
  y: number
  visible: boolean
  pressed: boolean
}

const INITIAL_CURSOR_STATE: CursorState = {
  x: 0,
  y: 0,
  visible: false,
  pressed: false,
}

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false)
  const [cursor, setCursor] = useState<CursorState>(INITIAL_CURSOR_STATE)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const mediaQuery = window.matchMedia('(pointer: fine)')
    const updateEnabled = () => {
      const canEnable = mediaQuery.matches
      setEnabled(canEnable)
      document.documentElement.classList.toggle('custom-cursor-enabled', canEnable)
    }

    updateEnabled()
    mediaQuery.addEventListener('change', updateEnabled)

    return () => {
      mediaQuery.removeEventListener('change', updateEnabled)
      document.documentElement.classList.remove('custom-cursor-enabled')
    }
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setCursor(INITIAL_CURSOR_STATE)
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      setCursor((current) => ({
        ...current,
        x: event.clientX,
        y: event.clientY,
        visible: true,
      }))
    }

    const handleMouseLeave = () => {
      setCursor((current) => ({ ...current, visible: false, pressed: false }))
    }

    const handleMouseEnter = () => {
      setCursor((current) => ({ ...current, visible: true }))
    }

    const handleMouseDown = () => {
      setCursor((current) => ({ ...current, pressed: true }))
    }

    const handleMouseUp = () => {
      setCursor((current) => ({ ...current, pressed: false }))
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mousedown', handleMouseDown, { passive: true })
    window.addEventListener('mouseup', handleMouseUp, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [enabled])

  if (!enabled) {
    return null
  }

  return (
    <div
      aria-hidden="true"
      className={`custom-cursor ${cursor.visible ? 'is-visible' : ''} ${cursor.pressed ? 'is-pressed' : ''}`}
      style={{
        left: cursor.x,
        top: cursor.y,
      }}
    >
      <CustomCursorArt />
    </div>
  )
}
