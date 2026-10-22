import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, BookOpen, BookPlus, BookUp, ClipboardList, HandCoins, Users } from 'lucide-react'
import { bookOf, copyOf, memberOf, useActions } from '../../lib/actions'
import { Btn, Card, EmptyState, PageHeader, StatCard, Status } from '../../components/ui'
import { addDays, daysBetween, fmtDate, fmtDateTime, isOverdue, peso, today } from '../../lib/types'

const PIE = ['#c62828', '#334155', '#d97706', '#0f766e', '#7c3aed', '#64748b']

export default function Dashboard() {
  const { s } = useActions()
  const active = s.loans.filter(l => !l.returned)
  const overdue = active.filter(isOverdue)
  const pending = s.reservations.filter(r => r.status === 'Pending')
  const unpaid = s.fines.filter(f => !f.paid)
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13))
  const trend = days.map(d => ({ day: d.slice(5), Borrowed: s.loans.filter(l => l.borrowed === d).length, Returned: s.loans.filter(l => l.returned === d).length }))
  const byCat: Record<string, number> = {}
  s.loans.forEach(l => { const c = bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.subjectCategory ?? 'Other'; byCat[c] = (byCat[c] ?? 0) + 1 })
  const pie = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  const recent = [...s.loans].sort((a, b) => (b.returned ?? b.borrowed).localeCompare(a.returned ?? a.borrowed)).slice(0, 6)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Circulation overview · ${fmtDate(today())}`} demo
        actions={<><Link to="/staff/borrow"><Btn icon={<BookUp size={15} />}>Walk-in borrowing</Btn></Link><Link to="/staff/catalog/add"><Btn variant="light" icon={<BookPlus size={15} />}>Add book</Btn></Link></>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/staff/issued"><StatCard label="Books on loan" value={active.length} icon={<BookOpen size={38} />} hint={`${s.copies.filter(c => c.status === 'Available').length} copies on shelf`} /></Link>
        <Link to="/staff/issued"><StatCard tone="dark" label="Overdue loans" value={overdue.length} icon={<AlertTriangle size={38} />} hint="Needs follow-up" /></Link>
        <Link to="/staff/reservations"><StatCard tone="amber" label="Pending reservations" value={pending.length} icon={<ClipboardList size={38} />} hint={`${s.reservations.filter(r => r.status === 'Ready').length} ready for pickup`} /></Link>
        <Link to="/staff/fines"><StatCard tone="green" label="Unpaid fines" value={peso(unpaid.reduce((n, f) => n + f.amount, 0))} icon={<HandCoins size={38} />} hint={`${unpaid.length} open · ${peso(s.fines.filter(f => f.paid).reduce((n, f) => n + f.amount, 0))} collected`} /></Link>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Circulation — last 14 days">
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ left: -20, right: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#e3e6ee" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11 }} interval={1} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend />
              <Bar dataKey="Borrowed" fill="#c62828" radius={[3, 3, 0, 0]} /><Bar dataKey="Returned" fill="#334155" radius={[3, 3, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card title="Loans by category">
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>{pie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>
          </ResponsiveContainer></div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Overdue loans" actions={<Link to="/staff/issued" className="text-xs font-bold text-brand">View all</Link>} flush>
          {overdue.length === 0 ? <EmptyState title="No overdue loans" /> : <ul className="divide-y divide-line">{overdue.slice(0, 5).map(l => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.title}</div><div className="text-xs text-mute">{memberOf(s, l.memberId)?.name} · due {fmtDate(l.due)}</div></div><span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{daysBetween(l.due, today())}d late</span></li>))}</ul>}
        </Card>
        <Card title="Pending reservations" actions={<Link to="/staff/reservations" className="text-xs font-bold text-brand">Open queue</Link>} flush>
          {pending.length === 0 ? <EmptyState title="Queue is clear" /> : <ul className="divide-y divide-line">{pending.slice(0, 5).map(r => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{bookOf(s, r.bookId)?.title}</div><div className="text-xs text-mute">{memberOf(s, r.memberId)?.name} · {fmtDate(r.date)}</div></div><Status value={r.status} /></li>))}</ul>}
        </Card>
        <Card title="Recent circulation activity" className="lg:col-span-2" flush>
          <ul className="divide-y divide-line">{recent.map(l => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span><b>{memberOf(s, l.memberId)?.name}</b> {l.returned ? 'returned' : 'borrowed'} <span className="font-semibold">{bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.title}</span></span><span className="text-xs text-mute">{fmtDate(l.returned ?? l.borrowed)}</span></li>))}</ul>
        </Card>
        <Card title="Recent staff activity" className="lg:col-span-2" actions={<Users size={16} className="text-mute" />} flush>
          <ul className="divide-y divide-line">{s.activity.slice(0, 4).map(x => <li key={x.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5 text-sm"><span><b>{x.actor}</b> · {x.text}</span><span className="text-xs text-mute">{fmtDateTime(x.date)}</span></li>)}</ul>
        </Card>
      </div>
    </div>
  )
}
