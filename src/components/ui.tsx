import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Info, Printer, Search, X, XCircle, Inbox, Database } from 'lucide-react'
import type { Book } from '../lib/types'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/* ---------- Buttons ---------- */
type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'light' | 'outline' | 'warning' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark border-transparent',
  secondary: 'bg-slate-600 text-white hover:bg-slate-700 border-transparent',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 border-transparent',
  danger: 'bg-red-700 text-white hover:bg-red-800 border-transparent',
  warning: 'bg-amber-400 text-slate-900 hover:bg-amber-500 border-transparent',
  light: 'bg-white text-ink hover:bg-slate-50 border-line',
  outline: 'bg-transparent text-brand hover:bg-brand-soft border-brand/40',
  ghost: 'bg-transparent text-mute hover:bg-slate-100 border-transparent',
}
export function Btn({ variant = 'primary', size = 'md', icon, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  return (
    <button {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-md border font-semibold transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm', variants[variant], className)}>
      {icon}{children}
    </button>
  )
}

/* ---------- Layout bits ---------- */
export function Card({ title, actions, children, className, bodyClass, flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; flush?: boolean }) {
  return (
    <section className={cx('rounded-lg border border-line bg-white shadow-[0_1px_3px_rgba(20,24,40,.06)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-brand">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={cx(!flush && 'p-4', bodyClass)}>{children}</div>
    </section>
  )
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-mute">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}
const tones = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', red: 'bg-red-50 text-red-700 ring-red-200', yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200', gray: 'bg-slate-100 text-slate-600 ring-slate-200',
}
export type Tone = keyof typeof tones
export const Badge = ({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset whitespace-nowrap', tones[tone])}>{children}</span>
)
const statusTone: Record<string, Tone> = {
  Available: 'green', Borrowed: 'blue', Reserved: 'yellow', Lost: 'red', Damaged: 'red', Replaced: 'gray', Active: 'green', Inactive: 'gray',
  Pending: 'yellow', Ready: 'green', Received: 'blue', Cancelled: 'gray', Paid: 'green', Unpaid: 'red', Overdue: 'red', Returned: 'gray', Completed: 'green',
  Failed: 'red', Running: 'blue', Unreplaced: 'red', 'On loan': 'blue',
}
export const Status = ({ value }: { value: string }) => <Badge tone={statusTone[value] ?? 'gray'}>{value}</Badge>
export function Alert({ tone = 'info', children, className }: { tone?: 'info' | 'success' | 'warning' | 'error'; children: ReactNode; className?: string }) {
  const m = { info: ['bg-sky-50 border-sky-200 text-sky-900', Info], success: ['bg-emerald-50 border-emerald-200 text-emerald-900', CheckCircle2], warning: ['bg-amber-50 border-amber-300 text-amber-900', AlertTriangle], error: ['bg-red-50 border-red-200 text-red-900', XCircle] } as const
  const [c, Icon] = m[tone]
  return <div role="alert" className={cx('flex items-start gap-2.5 rounded-md border px-3.5 py-2.5 text-sm', c, className)}><Icon size={17} className="mt-0.5 shrink-0" /><div>{children}</div></div>
}
export function StatCard({ label, value, icon, tone = 'brand', hint, onClick }: { label: string; value: ReactNode; icon: ReactNode; tone?: 'brand' | 'dark' | 'green' | 'amber'; hint?: string; onClick?: () => void }) {
  const edge = { brand: 'border-l-brand text-brand', dark: 'border-l-slate-700 text-slate-700', green: 'border-l-emerald-600 text-emerald-600', amber: 'border-l-amber-500 text-amber-600' }[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cx('flex items-center justify-between rounded-lg border border-line border-l-4 bg-white p-4 text-left shadow-[0_1px_3px_rgba(20,24,40,.06)]', edge, onClick && 'transition hover:-translate-y-0.5 hover:shadow-md')}>
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wider">{label}</div>
        <div className="mt-1 text-2xl font-extrabold text-ink">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-mute">{hint}</div>}
      </div>
      <div className="opacity-30">{icon}</div>
    </Tag>
  )
}
export function EmptyState({ title = 'Nothing to show', hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <Inbox size={36} className="text-slate-300" />
      <div className="font-bold text-ink">{title}</div>
      {hint && <div className="max-w-sm text-sm text-mute">{hint}</div>}
      {action}
    </div>
  )
}
export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 animate-pulse rounded bg-slate-100" style={{ opacity: 1 - i * 0.12 }} />)}
  </div>
)

/* ---------- Forms ---------- */
export const inputCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-slate-50'
export function Field({ label, help, error, required, children, className }: { label: string; help?: string; error?: string | false; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">{label}{required && <span className="ml-0.5 text-brand">*</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-red-700">{error}</span> : help ? <span className="mt-1 block text-xs text-mute">{help}</span> : null}
    </label>
  )
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('flex max-h-[92vh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:rounded-xl', w)}>
        <header className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="text-base font-extrabold text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-mute hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="scroll-thin overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-slate-50 px-5 py-3 sm:rounded-b-xl">{footer}</footer>}
      </div>
    </div>
  )
}

/* ---------- Toasts & confirm ---------- */
type ToastTone = 'success' | 'error' | 'warning' | 'info'
interface ConfirmOpts { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }
const ToastCtx = createContext<(m: string, t?: ToastTone) => void>(() => {})
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false)
export const useToast = () => useContext(ToastCtx)
export const useConfirm = () => useContext(ConfirmCtx)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; m: string; t: ToastTone }[]>([])
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const n = useRef(0)
  const toast = useCallback((m: string, t: ToastTone = 'info') => {
    const id = ++n.current
    setToasts(x => [...x, { id, m, t }])
    setTimeout(() => setToasts(x => x.filter(i => i.id !== id)), 4200)
  }, [])
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => setDlg({ ...o, resolve })), [])
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null) }
  const icon = { success: <CheckCircle2 size={18} className="text-emerald-600" />, error: <XCircle size={18} className="text-red-600" />, warning: <AlertTriangle size={18} className="text-amber-500" />, info: <Info size={18} className="text-sky-600" /> }
  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-white px-3.5 py-3 text-sm shadow-lg">
              {icon[t.t]}<span className="flex-1 font-semibold">{t.m}</span>
              <button onClick={() => setToasts(x => x.filter(i => i.id !== t.id))} aria-label="Dismiss" className="text-mute"><X size={15} /></button>
            </div>
          ))}
        </div>
        <Modal open={!!dlg} onClose={() => close(false)} title={dlg?.title ?? ''} size="sm"
          footer={<><Btn variant="light" onClick={() => close(false)}>Cancel</Btn><Btn variant={dlg?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{dlg?.confirmLabel ?? 'Confirm'}</Btn></>}>
          <div className="text-sm text-slate-700">{dlg?.message}</div>
        </Modal>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  )
}

/* ---------- Data table ---------- */
export interface Col<T> { key: string; header: string; render?: (r: T) => ReactNode; sort?: (r: T) => string | number; className?: string; hideBelow?: 'md' | 'lg' }
export function DataTable<T extends { id: string }>({ rows, columns, search, filters, selectable, bulk, actions, pageSize = 8, empty, toolbarRight, onRowClick }: {
  rows: T[]; columns: Col<T>[]; search?: (r: T) => string; filters?: ReactNode; selectable?: boolean
  bulk?: (ids: string[], clear: () => void) => ReactNode; actions?: (r: T) => ReactNode; pageSize?: number; empty?: ReactNode; toolbarRight?: ReactNode; onRowClick?: (r: T) => void
}) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { const t = setTimeout(() => setLoading(false), 350); return () => clearTimeout(t) }, [])
  const filtered = useMemo(() => {
    let r = q && search ? rows.filter(x => search(x).toLowerCase().includes(q.toLowerCase())) : rows
    const col = columns.find(c => c.key === sort?.key)
    if (col?.sort && sort) r = [...r].sort((a, b) => { const x = col.sort!(a), y = col.sort!(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir })
    return r
  }, [rows, q, sort, columns, search])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const cur = Math.min(page, pages)
  const view = filtered.slice((cur - 1) * pageSize, cur * pageSize)
  const allOn = view.length > 0 && view.every(r => sel.includes(r.id))
  const hide = (h?: string) => h === 'md' ? 'hidden md:table-cell' : h === 'lg' ? 'hidden lg:table-cell' : ''
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        {search && (
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search…" aria-label="Search table" className={cx(inputCls, 'pl-8')} />
          </div>
        )}
        {filters}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {sel.length > 0 && bulk && <><span className="text-xs font-bold text-brand">{sel.length} selected</span>{bulk(sel, () => setSel([]))}</>}
          {toolbarRight}
        </div>
      </div>
      {loading ? <Skeleton /> : filtered.length === 0 ? (empty ?? <EmptyState title="No matching records" hint={q ? `Nothing matches “${q}”. Try a different search.` : 'There are no records yet.'} />) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                {selectable && <th className="w-10 px-4 py-2.5"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? sel.filter(i => !view.some(r => r.id === i)) : [...new Set([...sel, ...view.map(r => r.id)])])} className="accent-[#c62828]" /></th>}
                {columns.map(c => (
                  <th key={c.key} className={cx('px-4 py-2.5', hide(c.hideBelow), c.className)}>
                    {c.sort ? (
                      <button onClick={() => setSort(s => s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 })} className="inline-flex items-center gap-1 uppercase hover:text-brand">
                        {c.header}{sort?.key === c.key && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                      </button>
                    ) : c.header}
                  </th>
                ))}
                {actions && <th className="px-4 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {view.map(r => (
                <tr key={r.id} className={cx('hover:bg-slate-50/70', sel.includes(r.id) && 'bg-brand-soft/50', onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(r)}>
                  {selectable && <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label="Select row" checked={sel.includes(r.id)} onChange={() => setSel(sel.includes(r.id) ? sel.filter(i => i !== r.id) : [...sel, r.id])} className="accent-[#c62828]" /></td>}
                  {columns.map(c => <td key={c.key} className={cx('px-4 py-2.5 align-middle', hide(c.hideBelow), c.className)}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '—')}</td>)}
                  {actions && <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}><div className="flex justify-end gap-1.5">{actions(r)}</div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-mute">
        <span>{filtered.length === 0 ? 'No entries' : `Showing ${(cur - 1) * pageSize + 1}–${Math.min(cur * pageSize, filtered.length)} of ${filtered.length} entries`}</span>
        <div className="flex items-center gap-1">
          <Btn size="sm" variant="light" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={14} /></Btn>
          <span className="px-2 font-bold text-ink">{cur} / {pages}</span>
          <Btn size="sm" variant="light" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={14} /></Btn>
        </div>
      </div>
    </div>
  )
}

/* ---------- Receipt ---------- */
export function ReceiptModal({ open, onClose, title, meta, lines, total, note }: { open: boolean; onClose: () => void; title: string; meta: [string, string][]; lines: { label: string; sub?: string; value?: string }[]; total?: string; note?: string }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Btn variant="light" onClick={onClose}>Close</Btn><Btn icon={<Printer size={14} />} onClick={() => window.print()}>Print</Btn></>}>
      <div className="print-area mx-auto max-w-xs bg-white font-mono text-xs text-slate-800">
        <div className="text-center"><div className="text-sm font-bold">NBS LIBRARY</div><div>{title.toUpperCase()}</div></div>
        <hr className="my-3 border-dashed border-slate-400" />
        {meta.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><span className="text-slate-500">{k}</span><span className="text-right font-bold">{v}</span></div>)}
        <hr className="my-3 border-dashed border-slate-400" />
        {lines.map((l, i) => <div key={i} className="mb-1.5 flex justify-between gap-3"><div><div className="font-bold">{l.label}</div>{l.sub && <div className="text-slate-500">{l.sub}</div>}</div>{l.value && <div>{l.value}</div>}</div>)}
        {total && <><hr className="my-3 border-dashed border-slate-400" /><div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{total}</span></div></>}
        {note && <p className="mt-3 text-center text-[10px] text-slate-500">{note}</p>}
      </div>
    </Modal>
  )
}

/* ---------- Generated book cover (no network) ---------- */
const palettes = [['#7f1d1d', '#f4d9a0'], ['#1e3a5f', '#e8edf5'], ['#14532d', '#e6f2d8'], ['#3b2f2f', '#f2e0c9'], ['#4a1d6b', '#f1e3f9'], ['#0f4c5c', '#e1f3f0'], ['#6b2d0f', '#fbe8cf']]
export function CoverArt({ book, className }: { book: Pick<Book, 'title' | 'id' | 'subjectCategory' | 'coverImage'>; className?: string }) {
  const [unavailable, setUnavailable] = useState(false)
  if (book.coverImage && !unavailable) return <img src={book.coverImage} alt={`Cover of ${book.title}`} className={cx('aspect-[3/4] w-full rounded-sm object-cover shadow-md', className)} loading="lazy" onError={() => setUnavailable(true)} />
  const h = [...book.id].reduce((a, c) => a + c.charCodeAt(0), 0)
  const [bg, fg] = palettes[h % palettes.length]
  return (
    <div className={cx('relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-sm p-3 shadow-md', className)} style={{ background: bg, color: fg }} role="img" aria-label={`Cover of ${book.title}`}>
      <div className="absolute inset-y-0 left-0 w-2 bg-black/25" />
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-15" style={{ background: fg }} />
      <div className="pl-2 text-[9px] font-bold uppercase tracking-[.18em] opacity-70">{book.subjectCategory}</div>
      <div className="pl-2 text-[clamp(.7rem,2.4cqw,1.05rem)] font-extrabold leading-tight [container-type:inline-size]">{book.title.length > 52 ? book.title.slice(0, 50) + '…' : book.title}</div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="scroll-quiet flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold transition', value === t.id ? 'border-brand text-brand' : 'border-transparent text-mute hover:text-ink')}>{t.label}</button>
      ))}
    </div>
  )
}
