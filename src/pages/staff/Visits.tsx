import { useMemo, useState } from 'react'
import { DoorClosed, DoorOpen, LogIn, LogOut, Users } from 'lucide-react'
import { Alert, Badge, Btn, Card, DataTable, EmptyState, Field, PageHeader, StatCard, inputCls, type Col } from '../../components/ui'
import { memberOf, useActions } from '../../lib/actions'
import { fmtDateTime, today, type Visit } from '../../lib/types'

const dur = (v: Visit) => {
  if (!v.outAt) return 'Inside'
  const m = Math.max(1, Math.round((new Date(v.outAt).getTime() - new Date(v.inAt).getTime()) / 6e4))
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}

export default function Visits() {
  const { s, toast, logVisitEntry, logVisitExit } = useActions()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [focus, setFocus] = useState(false)
  const [scope, setScope] = useState('today')
  const [status, setStatus] = useState('all')

  const inside = s.visits.filter(v => !v.outAt)
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? s.members.filter(m => m.idNo.toLowerCase().includes(t) || m.name.toLowerCase().includes(t)).slice(0, 6) : []
  }, [q, s.members])
  const chosen = picked ? memberOf(s, picked) : undefined
  const todays = s.visits.filter(v => v.inAt.slice(0, 10) === today())

  const logEntry = async () => {
    const m = chosen ?? s.members.find(x => x.idNo.toLowerCase() === q.trim().toLowerCase() || x.name.toLowerCase() === q.trim().toLowerCase())
    if (!m) return toast('Member not found. Enter a valid ID number or name.', 'error')
    if (m.status === 'Inactive') return toast(`${m.name} is inactive and cannot enter. Please see the librarian.`, 'error')
    if (inside.some(v => v.memberId === m.id)) return toast(`${m.name} is already inside.`, 'warning')
    if (await logVisitEntry(m.id)) { setQ(''); setPicked(null) }
  }
  const logExit = async (v: Visit) => {
    await logVisitExit(v.id)
  }

  const rows = s.visits.filter(v => (scope === 'all' || v.inAt.slice(0, 10) === today()) && (status === 'all' || (status === 'inside') === !v.outAt))
  const cols: Col<Visit>[] = [
    { key: 'member', header: 'Member', sort: v => memberOf(s, v.memberId)?.name ?? '', render: v => <div><div className="font-semibold">{memberOf(s, v.memberId)?.name ?? '—'}</div><div className="text-xs text-mute">{memberOf(s, v.memberId)?.idNo}</div></div> },
    { key: 'program', header: 'Program', hideBelow: 'md', render: v => memberOf(s, v.memberId)?.program ?? '—' },
    { key: 'in', header: 'Time in', sort: v => v.inAt, render: v => fmtDateTime(v.inAt) },
    { key: 'out', header: 'Time out', render: v => fmtDateTime(v.outAt) },
    { key: 'dur', header: 'Duration', render: v => v.outAt ? dur(v) : <Badge tone="blue">Inside</Badge> },
  ]
  const selCls = `${inputCls} w-auto`

  return (
    <div>
      <PageHeader demo title="Entrance & Exit" subtitle="Log members entering and leaving the library." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Currently inside" value={inside.length} icon={<DoorOpen size={36} />} />
        <StatCard label="Visits today" value={todays.length} icon={<LogIn size={36} />} tone="dark" />
        <StatCard label="Unique visitors today" value={new Set(todays.map(v => v.memberId)).size} icon={<Users size={36} />} tone="green" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Quick log entry">
          <form onSubmit={e => { e.preventDefault(); logEntry() }} className="space-y-3">
            <div className="relative">
              <Field label="ID number or name" required>
                <input className={inputCls} value={q} placeholder="e.g. 2023-0001 or Juan" autoComplete="off"
                  onChange={e => { setQ(e.target.value); setPicked(null) }} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} />
              </Field>
              {focus && !picked && matches.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-white shadow-lg" role="listbox">
                  {matches.map(m => (
                    <li key={m.id}>
                      <button type="button" role="option" aria-selected={false} onMouseDown={() => { setPicked(m.id); setQ(`${m.idNo} — ${m.name}`) }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-soft">
                        <span><span className="font-semibold">{m.name}</span> <span className="text-xs text-mute">{m.idNo} · {m.program}</span></span>
                        {m.status === 'Inactive' && <Badge tone="red">Inactive</Badge>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {chosen?.status === 'Inactive' && <Alert tone="error">{chosen.name} is inactive. Entry is blocked until the account is reactivated.</Alert>}
            <Btn type="submit" icon={<LogIn size={15} />} disabled={!q.trim() || chosen?.status === 'Inactive'}>Log entry</Btn>
          </form>
        </Card>

        <Card title={`Currently inside (${inside.length})`} flush>
          {inside.length === 0 ? <EmptyState title="Nobody is inside" hint="Logged entries without an exit show up here." /> : (
            <ul className="scroll-thin max-h-72 divide-y divide-line overflow-y-auto">
              {inside.map(v => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{memberOf(s, v.memberId)?.name ?? '—'}</div>
                    <div className="text-xs text-mute">{memberOf(s, v.memberId)?.program} · in {fmtDateTime(v.inAt)}</div>
                  </div>
                  <Btn size="sm" variant="light" icon={<LogOut size={13} />} onClick={() => logExit(v)}>Log exit</Btn>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Visit log" flush>
        <DataTable rows={rows} columns={cols} pageSize={8} search={v => `${memberOf(s, v.memberId)?.name} ${memberOf(s, v.memberId)?.idNo}`}
          empty={<EmptyState title="No visits found" hint="Try switching to All dates or a different status." action={<DoorClosed className="text-slate-300" />} />}
          filters={<>
            <select aria-label="Date scope" className={selCls} value={scope} onChange={e => setScope(e.target.value)}><option value="today">Today</option><option value="all">All dates</option></select>
            <select aria-label="Status" className={selCls} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="inside">Inside</option><option value="exited">Exited</option></select>
          </>} />
      </Card>
    </div>
  )
}
