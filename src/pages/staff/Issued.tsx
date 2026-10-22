import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, BookOpen, CalendarClock, HandCoins, Mail, PackageX, Undo2 } from 'lucide-react'
import { Alert, Badge, Btn, Card, DataTable, EmptyState, Field, Modal, PageHeader, ReceiptModal, StatCard, Status, inputCls, useConfirm, type Col } from '../../components/ui'
import { bookOf, copyOf, fineFor, memberOf, useActions } from '../../lib/actions'
import { daysBetween, fmtDate, isOverdue, peso, today, type Fine, type Loan } from '../../lib/types'

export default function Issued() {
  const { s, returnLoan, reportIncident } = useActions()
  const confirm = useConfirm()
  const [filter, setFilter] = useState('All')
  const [acc, setAcc] = useState('')
  const [accErr, setAccErr] = useState('')
  const [done, setDone] = useState<{ loan: Loan; fine: Fine | null } | null>(null)

  const active = s.loans.filter(l => !l.returned)
  const dueToday = active.filter(l => l.due === today()).length
  const overdue = active.filter(isOverdue).length
  const soon = (l: Loan) => !isOverdue(l) && daysBetween(today(), l.due) <= 2
  const rows = active.filter(l => filter === 'All' || (filter === 'Overdue' ? isOverdue(l) : soon(l))).sort((a, b) => a.due.localeCompare(b.due))
  const title = (l: Loan) => bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.title ?? '—'
  const selCls = `${inputCls} w-auto`

  const doReturn = async (l: Loan) => {
    const proj = fineFor(l)
    if (!(await confirm({ title: 'Return book', message: <>Return <b>{title(l)}</b> from {memberOf(s, l.memberId)?.name}?{proj > 0 && <> A late fine of <b>{peso(proj)}</b> will be created.</>}</>, confirmLabel: 'Return' }))) return
    const r = await returnLoan(l.id)
    if (r) setDone(r)
  }
  const byAccession = (e: React.FormEvent) => {
    e.preventDefault()
    const a = acc.trim().toLowerCase()
    if (!a) return
    const l = active.find(x => copyOf(s, x.copyId)?.accession.toLowerCase() === a)
    if (!l) return setAccErr(`No active loan found for accession "${acc.trim()}".`)
    setAccErr(''); setAcc('')
    doReturn(l)
  }
  const incident = async (l: Loan, type: 'Lost' | 'Damaged') => {
    if (!(await confirm({ title: `Mark as ${type.toLowerCase()}`, message: `Mark "${title(l)}" as ${type.toLowerCase()}? The loan will be closed and the copy removed from circulation.`, confirmLabel: `Mark ${type.toLowerCase()}`, danger: true }))) return
    await reportIncident(l.copyId, l.memberId, type)
  }

  const cols: Col<Loan>[] = [
    { key: 'm', header: 'Member', sort: l => memberOf(s, l.memberId)?.name ?? '', render: l => <div><div className="font-semibold">{memberOf(s, l.memberId)?.name ?? '—'}</div><div className="text-xs text-mute">{memberOf(s, l.memberId)?.idNo}</div></div> },
    { key: 't', header: 'Book', sort: title, render: l => <div><div className="font-semibold">{title(l)}</div><div className="text-xs text-mute">{copyOf(s, l.copyId)?.accession}</div></div> },
    { key: 'b', header: 'Borrowed', hideBelow: 'md', render: l => fmtDate(l.borrowed) },
    { key: 'd', header: 'Due', sort: l => l.due, render: l => fmtDate(l.due) },
    { key: 's', header: 'Status', render: l => isOverdue(l)
      ? <div className="space-y-0.5"><Badge tone="red">Overdue {daysBetween(l.due, today())}d</Badge><div className="text-xs font-semibold text-red-700">Fine {peso(fineFor(l))}</div></div>
      : soon(l) ? <Badge tone="yellow">Due soon</Badge> : <Status value="On loan" /> },
  ]
  const f = done?.fine
  const d = done?.loan

  return (
    <div>
      <PageHeader demo title="Issued Books" subtitle="Items currently on loan." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="On loan" value={active.length} icon={<BookOpen size={36} />} />
        <StatCard label="Due today" value={dueToday} icon={<CalendarClock size={36} />} tone="amber" />
        <StatCard label="Overdue" value={overdue} icon={<AlertTriangle size={36} />} tone="dark" />
      </div>
      <Card title="Return by accession" className="mb-4">
        <form onSubmit={byAccession} className="flex flex-wrap items-end gap-2">
          <Field label="Accession no." className="min-w-[12rem] flex-1 sm:max-w-xs"><input className={inputCls} value={acc} onChange={e => { setAcc(e.target.value); setAccErr('') }} placeholder="Type or scan accession" /></Field>
          <Btn type="submit" icon={<Undo2 size={15} />} disabled={!acc.trim()}>Return</Btn>
        </form>
        {accErr && <Alert tone="error" className="mt-3">{accErr}</Alert>}
      </Card>
      <Card flush>
        <DataTable rows={rows} columns={cols} search={l => `${memberOf(s, l.memberId)?.name} ${memberOf(s, l.memberId)?.idNo} ${title(l)} ${copyOf(s, l.copyId)?.accession}`}
          empty={<EmptyState title="No issued books" hint="Nothing matches this filter." />}
          filters={<select aria-label="Filter" className={selCls} value={filter} onChange={e => setFilter(e.target.value)}><option value="All">All</option><option>Due soon</option><option>Overdue</option></select>}
          actions={l => <>
            <Btn size="sm" icon={<Undo2 size={13} />} onClick={() => doReturn(l)}>Return</Btn>
            <Btn size="sm" variant="light" icon={<PackageX size={13} />} onClick={() => incident(l, 'Lost')}>Lost</Btn>
            <Btn size="sm" variant="light" onClick={() => incident(l, 'Damaged')}>Damaged</Btn>
            <Link to="/staff/messages" title="Message member"><Btn size="sm" variant="ghost" aria-label="Message member" icon={<Mail size={13} />} /></Link>
          </>} />
      </Card>

      <ReceiptModal open={!!done && !f} onClose={() => setDone(null)} title="Return receipt"
        meta={d ? [['Member', memberOf(s, d.memberId)?.name ?? '—'], ['Borrowed', fmtDate(d.borrowed)], ['Due', fmtDate(d.due)], ['Returned', fmtDate(d.returned)]] : []}
        lines={d ? [{ label: title(d), sub: copyOf(s, d.copyId)?.accession }] : []} note="Returned on time. Thank you!" />
      <Modal open={!!done && !!f} onClose={() => setDone(null)} title="Returned late" size="sm"
        footer={<><Btn variant="light" onClick={() => setDone(null)}>Close</Btn><Link to="/staff/fines"><Btn icon={<HandCoins size={14} />}>Go to fines</Btn></Link></>}>
        {d && f && (
          <div className="space-y-3 text-sm">
            <Alert tone="warning">A fine was created for this late return.</Alert>
            <div><div className="font-bold">{title(d)}</div><div className="text-mute">{memberOf(s, d.memberId)?.name}</div></div>
            <div className="flex justify-between"><span className="text-mute">Days late</span><b>{f.days}</b></div>
            <div className="flex justify-between"><span className="text-mute">Fine</span><b className="text-red-700">{peso(f.amount)}</b></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
