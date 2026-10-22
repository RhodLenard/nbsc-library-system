import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BookOpen, HandCoins, History, Pencil, Power, Undo2 } from 'lucide-react'
import { Badge, Btn, Card, DataTable, EmptyState, Field, Modal, PageHeader, StatCard, Status, Tabs, inputCls, useConfirm, type Col } from '../../components/ui'
import { bookOf, copyOf, useActions } from '../../lib/actions'
import { PROGRAMS, daysBetween, fmtDate, fmtDateTime, isOverdue, peso, today, type Fine, type Loan, type Member, type Reservation, type Visit } from '../../lib/types'

export default function MemberDetail() {
  const { id } = useParams()
  const { s, toast, returnLoan, setMemberStatus, upsertMember } = useActions()
  const confirm = useConfirm()
  const [tab, setTab] = useState('current')
  const [edit, setEdit] = useState<Member | null>(null)
  const m = s.members.find(x => x.id === id)
  if (!m) return <div><PageHeader title="User not found" /><Card><EmptyState title="Unknown library user" hint="This record may have been deleted." action={<Link to="/staff/members" className="text-sm font-bold text-brand">Back to Library Users</Link>} /></Card></div>

  const loans = s.loans.filter(l => l.memberId === m.id)
  const current = loans.filter(l => !l.returned)
  const history = loans.filter(l => l.returned)
  const fines = s.fines.filter(f => f.memberId === m.id)
  const unpaid = fines.filter(f => !f.paid)
  const res = s.reservations.filter(r => r.memberId === m.id)
  const visits = s.visits.filter(v => v.memberId === m.id)
  const title = (l: Loan) => bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.title ?? '—'
  const initials = m.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const doReturn = async (l: Loan) => {
    if (await confirm({ title: 'Return book', message: `Return "${title(l)}" for ${m.name}?`, confirmLabel: 'Return' })) returnLoan(l.id)
  }
  const toggle = async () => {
    const st = m.status === 'Active' ? 'Inactive' : 'Active'
    if (await confirm({ title: st === 'Active' ? 'Activate user' : 'Deactivate user', message: `${st === 'Active' ? 'Activate' : 'Deactivate'} ${m.name}?`, danger: st === 'Inactive' })) await setMemberStatus([m.id], st)
  }
  const save = async () => {
    if (!edit) return
    if (!edit.name.trim()) return toast('Name is required.', 'error')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edit.email.trim())) return toast('Enter a valid email address.', 'error')
    if (s.members.some(x => x.id !== edit.id && (x.idNo === edit.idNo || x.email.toLowerCase() === edit.email.toLowerCase()))) return toast('ID number or email already in use.', 'error')
    if (await upsertMember(edit)) setEdit(null)
  }
  const sc = (k: keyof Member, v: string) => setEdit(e => e && { ...e, [k]: v })

  const loanCols = (withReturn: boolean): Col<Loan>[] => [
    { key: 't', header: 'Book', render: l => <div><div className="font-semibold">{title(l)}</div><div className="text-xs text-mute">{copyOf(s, l.copyId)?.accession}</div></div> },
    { key: 'b', header: 'Borrowed', sort: l => l.borrowed, render: l => fmtDate(l.borrowed) },
    { key: 'd', header: 'Due', render: l => fmtDate(l.due) },
    withReturn
      ? { key: 'st', header: 'Status', render: l => isOverdue(l) ? <Badge tone="red">Overdue {daysBetween(l.due, today())}d</Badge> : <Status value="On loan" /> }
      : { key: 'r', header: 'Returned', render: l => fmtDate(l.returned) },
  ]
  const fineCols: Col<Fine>[] = [
    { key: 'b', header: 'Book', render: f => { const l = s.loans.find(x => x.id === f.loanId); return l ? title(l) : '—' } },
    { key: 'days', header: 'Days late', render: f => f.days },
    { key: 'a', header: 'Amount', render: f => peso(f.amount) },
    { key: 's', header: 'Status', render: f => <Status value={f.paid ? 'Paid' : 'Unpaid'} /> },
    { key: 'p', header: 'Paid on', hideBelow: 'md', render: f => f.paid ? `${fmtDate(f.paidOn)} · ${f.method}` : '—' },
  ]
  const resCols: Col<Reservation>[] = [
    { key: 'b', header: 'Book', render: r => bookOf(s, r.bookId)?.title ?? '—' },
    { key: 'd', header: 'Date', render: r => fmtDate(r.date) },
    { key: 'u', header: 'Ready until', hideBelow: 'md', render: r => fmtDate(r.readyUntil) },
    { key: 's', header: 'Status', render: r => <Status value={r.status} /> },
  ]
  const visitCols: Col<Visit>[] = [
    { key: 'i', header: 'Time in', sort: v => v.inAt, render: v => fmtDateTime(v.inAt) },
    { key: 'o', header: 'Time out', render: v => v.outAt ? fmtDateTime(v.outAt) : <Badge tone="blue">Inside</Badge> },
  ]
  const det: [string, string][] = [['ID no.', m.idNo], ['Email', m.email], ['Phone', m.phone || '—'], ['Program', m.program], ['Type', m.type], ['Joined', fmtDate(m.joined)]]

  return (
    <div>
      <PageHeader demo title={m.name} subtitle={`Library user · ${m.idNo}`} actions={<Link to="/staff/members"><Btn variant="light" icon={<ArrowLeft size={15} />}>Back</Btn></Link>} />
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-xl font-extrabold text-white">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-extrabold">{m.name}</h2><Status value={m.status} /></div>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {det.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-mute">{k}:</dt><dd className="min-w-0 break-words font-semibold">{v}</dd></div>)}
            </dl>
          </div>
          <div className="flex gap-2">
            <Btn variant="light" icon={<Pencil size={14} />} onClick={() => setEdit(m)}>Edit</Btn>
            <Btn variant={m.status === 'Active' ? 'light' : 'success'} icon={<Power size={14} />} onClick={toggle}>{m.status === 'Active' ? 'Deactivate' : 'Activate'}</Btn>
          </div>
        </div>
      </Card>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Active loans" value={current.length} icon={<BookOpen size={36} />} />
        <StatCard label="Total borrowed" value={loans.length} icon={<History size={36} />} tone="dark" />
        <StatCard label="Unpaid fines" value={peso(unpaid.reduce((a, f) => a + f.amount, 0))} icon={<HandCoins size={36} />} tone="amber" />
      </div>
      <Card flush>
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'current', label: `Current loans (${current.length})` }, { id: 'history', label: `History (${history.length})` },
          { id: 'fines', label: `Fines (${fines.length})` }, { id: 'res', label: `Reservations (${res.length})` }, { id: 'visits', label: `Visits (${visits.length})` },
        ]} />
        {tab === 'current' && <DataTable key="c" rows={current} columns={loanCols(true)} pageSize={6} empty={<EmptyState title="No current loans" />}
          actions={l => <Btn size="sm" variant="light" icon={<Undo2 size={13} />} onClick={() => doReturn(l)}>Return</Btn>} />}
        {tab === 'history' && <DataTable key="h" rows={history} columns={loanCols(false)} pageSize={6} empty={<EmptyState title="No borrowing history" />} />}
        {tab === 'fines' && <DataTable key="f" rows={fines} columns={fineCols} pageSize={6} empty={<EmptyState title="No fines" />}
          filters={<span className="text-xs text-mute">{unpaid.length} unpaid · {fines.length - unpaid.length} paid</span>} />}
        {tab === 'res' && <DataTable key="r" rows={res} columns={resCols} pageSize={6} empty={<EmptyState title="No reservations" />} />}
        {tab === 'visits' && <DataTable key="v" rows={visits} columns={visitCols} pageSize={6} empty={<EmptyState title="No visits" />} />}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit User" footer={<><Btn variant="light" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save user</Btn></>}>
        {edit && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2"><input className={inputCls} value={edit.name} onChange={e => sc('name', e.target.value)} /></Field>
            <Field label="ID no." required><input className={inputCls} value={edit.idNo} onChange={e => sc('idNo', e.target.value)} /></Field>
            <Field label="Email" required><input className={inputCls} value={edit.email} onChange={e => sc('email', e.target.value)} /></Field>
            <Field label="Program"><select className={inputCls} value={edit.program} onChange={e => sc('program', e.target.value)}>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Type"><select className={inputCls} value={edit.type} onChange={e => sc('type', e.target.value)}><option>Student</option><option>Faculty</option><option>Staff</option></select></Field>
            <Field label="Phone"><input className={inputCls} value={edit.phone} onChange={e => sc('phone', e.target.value)} /></Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
