import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { State } from './types'
import { api } from './api'

interface Ctx { s: State; set: (fn: (d: State) => State) => void; reset: () => void; refresh: () => Promise<void> }
const C = createContext<Ctx>(null as never)
type AppData = Pick<State, 'books' | 'copies' | 'writers' | 'publishers' | 'corporates' | 'members' | 'staff' | 'loans' | 'reservations' | 'fines'>

const emptyState = (): State => ({ v: 2, session: null, books: [], copies: [], writers: [], publishers: [], corporates: [], members: [], staff: [], loans: [], reservations: [], fines: [], incidents: [], messages: [], visits: [], notices: [], activity: [], backups: [], carts: {} })

function load(): State {
  try {
    const raw = sessionStorage.getItem('library-v2-session')
    if (raw) return { ...emptyState(), session: JSON.parse(raw) as State['session'] }
  } catch { /* fall through */ }
  return emptyState()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(load)
  useEffect(() => { if (s.session) sessionStorage.setItem('library-v2-session', JSON.stringify(s.session)); else sessionStorage.removeItem('library-v2-session') }, [s.session])
  const set = useCallback((fn: (d: State) => State) => setS(p => fn(p)), [])
  const reset = useCallback(() => setS(emptyState()), [])
  const sessionId = s.session?.userId
  const refresh = useCallback(async () => {
    if (!sessionId) return
    const data = await api<AppData>('/app/bootstrap')
    setS(current => current.session?.userId === sessionId ? { ...current, ...data } : current)
  }, [sessionId])
  useEffect(() => {
    if (!sessionId) return
    void refresh().catch(() => undefined)
  }, [refresh, sessionId])
  return <C.Provider value={{ s, set, reset, refresh }}>{children}</C.Provider>
}
export const useStore = () => useContext(C)
