import { useState } from 'react'
import { nanoid } from 'nanoid'

export function useBettorId(): string {
  const [id] = useState(() => {
    if (typeof window === 'undefined') return ''
    const stored = localStorage.getItem('bettor-id')
    if (stored) return stored
    const newId = nanoid()
    localStorage.setItem('bettor-id', newId)
    return newId
  })
  return id
}
