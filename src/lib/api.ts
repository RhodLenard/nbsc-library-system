const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3001/v1").replace(/\/$/, "")
const TOKEN_KEY = "library-v2-access-token"

export type ApiPrincipal = { id: string; kind: "member" | "staff"; role: string; name: string; email: string | null }
export const sessionToken = () => sessionStorage.getItem(TOKEN_KEY)
export const clearSessionToken = () => sessionStorage.removeItem(TOKEN_KEY)

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionToken()
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } })
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message ?? "The server could not complete the request.")
  return payload.data as T
}

export function mutation<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'POST', headers: { 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body) })
}

export async function download(path: string, fallbackName: string) {
  const token = sessionToken()
  const response = await fetch(`${API_URL}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
  if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(payload.error?.message ?? 'Download failed.') }
  const disposition = response.headers.get('content-disposition') ?? ''
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url)
}

export async function login(accountType: "member" | "staff", identifier: string, password: string) {
  const result = await api<{ accessToken: string; principal: ApiPrincipal }>("/auth/login", { method: "POST", body: JSON.stringify({ accountType, identifier, password }) })
  sessionStorage.setItem(TOKEN_KEY, result.accessToken)
  return result.principal
}
