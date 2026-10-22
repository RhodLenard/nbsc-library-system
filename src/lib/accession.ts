export function parseAccession(v: string) {
  const m = v.trim().match(/^(.*?)(\d+)$/)
  return m ? { prefix: m[1], digits: m[2], width: m[2].length } : null
}

// Increments the numeric suffix, preserving prefix and leading zeros ("0001" x3 -> 0001, 0002, 0003).
export function generateAccessions(start: string, count: number): string[] {
  const s = start.trim()
  const n = Math.max(0, Math.floor(count) || 0)
  if (!s || n === 0) return []
  const p = parseAccession(s)
  if (!p) return Array.from({ length: n }, (_, i) => (i === 0 ? s : `${s}-${i + 1}`))
  const base = BigInt(p.digits)
  return Array.from({ length: n }, (_, i) => p.prefix + (base + BigInt(i)).toString().padStart(p.width, '0'))
}

export interface CallInput { shelf: string; callBase: string; year: string; volume: string; part: string; copyNo: number }
export function buildCallNo(c: CallInput) {
  return [c.shelf, c.callBase, c.year, c.volume && `v.${c.volume}`, c.part && `pt.${c.part}`, `c.${c.copyNo}`].filter(Boolean).join(' ')
}
