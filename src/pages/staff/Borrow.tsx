import { useState } from 'react'
import { CalendarClock, CheckCircle2, Search, UserRound, X } from 'lucide-react'
import { Link } from 'react-router'
import { borrowBlocker, activeLoans, bookOf, copyOf, memberOf, publisherName, useActions } from '../../lib/actions'
import { Alert, Badge, Btn, Card, EmptyState, PageHeader, ReceiptModal, inputCls, cx } from '../../components/ui'
import { RULES, addDays, fmtDate, today, type Loan } from '../../lib/types'

export default function Borrow() {
  const a = useActions()
  const { s } = a
  const [q, setQ] = useState('')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [cq, setCq] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [receipt, setReceipt] = useState<Loan[] | null>(null)

  const m = memberId ? memberOf(s, memberId) : undefined
  const blocker = memberId ? borrowBlocker(s, memberId, Math.max(1, picked.length)) : null
  const hard = memberId ? borrowBlocker(s, memberId, 0) : null
  const hits = q.trim() ? s.members.filter(x => (x.name + x.idNo + x.email).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : []
  const copyHits = cq.trim() ? s.copies.filter(c => { const b = bookOf(s, c.bookId)!; return (b.title + c.accession + b.isbn).toLowerCase().includes(cq.toLowerCase()) }).slice(0, 8) : []
  const due = addDays(today(), RULES.loanDays)
  const reset = () => { setMemberId(null); setPicked([]); setQ(''); setCq('') }

  const confirm = async () => {
    const loans = await a.borrow(memberId!, picked)
    if (loans) { setReceipt(loans); setPicked([]); setCq('') }
  }

  return (
    <div>
      <PageHeader title="Walk-in Borrowing" subtitle="Look up a member, scan or pick copies, and confirm the loan." demo actions={memberId && <Btn variant="light" icon={<X size={15} />} onClick={reset}>Start over</Btn>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card title="1 · Member">
            {!m ? (
              <div>
                <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus className={cx(inputCls, 'pl-9')} placeholder="Search name, ID number or email…" value={q} onChange={e => setQ(e.target.value)} /></div>
                <ul className="mt-2 divide-y divide-line rounded-md border border-line empty:hidden">
                  {hits.map(x => <li key={x.id}><button onClick={() => setMemberId(x.id)} className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"><span><span className="block text-sm font-bold">{x.name}</span><span className="text-xs text-mute">{x.idNo} · {x.program} · {x.type}</span></span><Badge tone={x.status === 'Active' ? 'green' : 'gray'}>{x.status}</Badge></button></li>)}
                </ul>
                {q && hits.length === 0 && <p className="mt-2 text-sm text-mute">No member matches “{q}”.</p>}
                {!q && <p className="mt-2 text-sm text-mute">Try “Maria” or “2023-01000”.</p>}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white"><UserRound /></span>
                <div className="flex-1"><div className="font-extrabold">{m.name}</div><div className="text-xs text-mute">{m.idNo} · {m.program} · {m.type} · {activeLoans(s, m.id).length} active loan(s)</div></div>
                <Link to={`/staff/members/${m.id}`} className="text-sm font-bold text-brand">Profile</Link>
              </div>
            )}
            {m && hard && <Alert tone="error" className="mt-3">{hard}</Alert>}
          </Card>

          <Card title="2 · Copies">
            {!m || hard ? <EmptyState title="Select an eligible member first" hint="Copies can be added once a member without blocks is chosen." /> : (<>
              <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={cx(inputCls, 'pl-9 font-mono')} placeholder="Scan accession number or search a title…" value={cq} onChange={e => setCq(e.target.value)} /></div>
              <ul className="mt-2 divide-y divide-line rounded-md border border-line empty:hidden">
                {copyHits.map(c => { const b = bookOf(s, c.bookId)!; const ok = c.status === 'Available' && !picked.includes(c.id); return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0"><div className="truncate text-sm font-bold">{b.title}</div><div className="text-xs text-mute"><span className="font-mono">{c.accession}</span> · c.{c.copyNo} · {c.location} · {publisherName(s, b.publisherId)}</div></div>
                    {ok ? <Btn size="sm" disabled={picked.length >= RULES.maxItems - activeLoans(s, m.id).length} onClick={() => setPicked([...picked, c.id])}>Add</Btn> : <Badge tone={c.status === 'Available' ? 'blue' : 'red'}>{c.status === 'Available' ? 'Selected' : c.status}</Badge>}
                  </li>) })}
              </ul>
              {cq && copyHits.length === 0 && <p className="mt-2 text-sm text-mute">No copy found.</p>}
              {blocker && picked.length > 0 && <Alert tone="warning" className="mt-3">{blocker}</Alert>}
            </>)}
          </Card>
        </div>

        <Card title="3 · Confirm loan" className="h-fit lg:sticky lg:top-0">
          {picked.length === 0 ? <p className="text-sm text-mute">No copies selected yet.</p> : (
            <ul className="mb-4 space-y-2">{picked.map(id => { const c = copyOf(s, id)!; return <li key={id} className="flex items-start justify-between gap-2 rounded-md bg-slate-50 p-2.5"><div className="min-w-0"><div className="truncate text-sm font-bold">{bookOf(s, c.bookId)?.title}</div><div className="font-mono text-xs text-mute">{c.accession}</div></div><button aria-label="Remove" onClick={() => setPicked(picked.filter(x => x !== id))} className="text-mute hover:text-brand"><X size={15} /></button></li> })}</ul>
          )}
          <div className="flex items-center gap-2 rounded-md border border-line p-3 text-sm"><CalendarClock size={18} className="text-brand" /><div><div className="text-xs font-bold uppercase text-mute">Due date preview</div><div className="font-extrabold">{fmtDate(due)}</div><div className="text-xs text-mute">{RULES.loanDays}-day loan · ₱{RULES.finePerDay}/day late</div></div></div>
          <Btn className="mt-4 w-full" icon={<CheckCircle2 size={15} />} disabled={!m || !!blocker || picked.length === 0} onClick={() => void confirm()}>Confirm loan ({picked.length})</Btn>
        </Card>
      </div>
      {receipt && m && (
        <ReceiptModal open onClose={() => { setReceipt(null); reset() }} title="Loan receipt" meta={[['Member', m.name], ['ID no.', m.idNo], ['Date', fmtDate(today())], ['Due', fmtDate(receipt[0].due)]]}
          lines={receipt.map(l => { const c = copyOf(s, l.copyId)!; return { label: bookOf(s, c.bookId)?.title ?? '', sub: `Acc. ${c.accession} · c.${c.copyNo} · ${c.callNo}` } })} note="Return on or before the due date to avoid fines." />
      )}
    </div>
  )
}
