import { useMemo, useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, BookOpen, ChevronDown, Clock, DoorOpen, Download, FileSpreadsheet, HandCoins, Library, Table2, Users } from 'lucide-react'
import { Btn, Card, DataTable, Field, Modal, PageHeader, StatCard, Tabs, inputCls, type Col } from '../../components/ui'
import { bookOf, copyOf, memberOf, useActions } from '../../lib/actions'
import { CATEGORIES, PROGRAMS, addDays, fmtDate, fmtDateTime, isOverdue, peso, today } from '../../lib/types'
import { download } from '../../lib/api'

type Row = { id: string } & Record<string, string | number>
interface Chart { title: string; kind: 'bar' | 'line' | 'pie'; data: Record<string, string | number>[]; keys: string[]; yLabel?: string }
interface Kpi { label: string; value: ReactNode; icon: ReactNode; tone?: 'brand' | 'dark' | 'green' | 'amber' }
interface Report { kpis: Kpi[]; charts: Chart[]; cols: { key: string; header: string }[]; rows: Row[] }

const PALETTE = ['#c62828', '#334155', '#d97706', '#0f766e']
const TABS = [{ id: 'circulation', label: 'Circulation' }, { id: 'collection', label: 'Collection' }, { id: 'fines', label: 'Fines' }, { id: 'members', label: 'Members' }, { id: 'visits', label: 'Visits' }]
const TITLES: Record<string, string> = { circulation: 'Circulation Report', collection: 'Collection Report', fines: 'Fines Report', members: 'Members Report', visits: 'Library Visits Report' }

function tally<T>(items: T[], f: (x: T) => string, key = 'count') {
  const m = new Map<string, number>()
  items.forEach(i => m.set(f(i), (m.get(f(i)) ?? 0) + 1))
  return [...m.entries()].map(([name, v]) => ({ name, [key]: v }))
}

function ChartBox({ c }: { c: Chart }) {
  const axis = { fontSize: 11, fill: '#64748b' }
  return (
    <Card title={c.title}>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {c.kind === 'pie' ? (
            <PieChart>
              <Pie data={c.data} dataKey="value" nameKey="name" outerRadius={80} label={(p: { name?: string; value?: number }) => `${p.name}: ${p.value}`} labelLine={false} fontSize={11}>
                {c.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          ) : c.kind === 'line' ? (
            <LineChart data={c.data} margin={{ left: 0, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={axis} label={{ value: 'Period', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#64748b' }} height={40} />
              <YAxis tick={axis} allowDecimals={false} label={{ value: c.yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              {c.keys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % 4]} strokeWidth={2} dot={{ r: 3 }} />)}
            </LineChart>
          ) : (
            <BarChart data={c.data} margin={{ left: 0, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={axis} interval={0} height={40} />
              <YAxis tick={axis} allowDecimals={false} label={{ value: c.yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748b' }} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              {c.keys.map((k, i) => <Bar key={k} dataKey={k} fill={PALETTE[i % 4]} radius={[3, 3, 0, 0]} />)}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export default function Reports() {
  const { s, toast } = useActions()
  const [type, setType] = useState('circulation')
  const [range, setRange] = useState('30')
  const [program, setProgram] = useState('')
  const [category, setCategory] = useState('')
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [menu, setMenu] = useState(false)
  const [fmt, setFmt] = useState<null | 'Excel' | 'CSV'>(null)

  const report: Report = useMemo(() => {
    const cutoff = range === 'all' ? '' : addDays(today(), -Number(range))
    const inRange = (d: string | null | undefined) => !cutoff || (!!d && d.slice(0, 10) >= cutoff)
    const bucket = (d: string) => (range === '7' || range === '30' ? d.slice(5, 10) : d.slice(0, 7))
    const byBucket = (dates: string[]) => tally(dates.slice().sort(), bucket)
    const progOk = (p: string) => !program || p === program
    const loanBook = (copyId: string) => bookOf(s, copyOf(s, copyId)?.bookId ?? '')

    if (type === 'circulation') {
      const loans = s.loans.filter(l => inRange(l.borrowed) && progOk(memberOf(s, l.memberId)?.program ?? '') && (!category || loanBook(l.copyId)?.subjectCategory === category))
      const rows: Row[] = loans.map(l => ({ id: l.id, date: l.borrowed, member: memberOf(s, l.memberId)?.name ?? '—', title: loanBook(l.copyId)?.title ?? '—', category: loanBook(l.copyId)?.subjectCategory ?? '—', due: l.due, status: l.returned ? 'Returned' : isOverdue(l) ? 'Overdue' : 'On loan' }))
      return {
        kpis: [
          { label: 'Total loans', value: loans.length, icon: <BookOpen size={36} /> },
          { label: 'Returned', value: loans.filter(l => l.returned).length, icon: <Library size={36} />, tone: 'green' },
          { label: 'Still on loan', value: loans.filter(l => !l.returned && !isOverdue(l)).length, icon: <Clock size={36} />, tone: 'dark' },
          { label: 'Overdue', value: loans.filter(isOverdue).length, icon: <Clock size={36} />, tone: 'amber' },
        ],
        charts: [
          { title: 'Loans over time', kind: 'line', data: byBucket(loans.map(l => l.borrowed)).map(d => ({ name: d.name, Loans: d.count })), keys: ['Loans'], yLabel: 'Loans' },
          { title: 'Loans by category', kind: 'pie', data: tally(rows, r => String(r.category), 'value'), keys: ['value'] },
          { title: 'Loans by status', kind: 'bar', data: tally(rows, r => String(r.status)).map(d => ({ name: d.name, Loans: d.count })), keys: ['Loans'], yLabel: 'Loans' },
        ],
        cols: [{ key: 'date', header: 'Borrowed' }, { key: 'member', header: 'Member' }, { key: 'title', header: 'Title' }, { key: 'category', header: 'Category' }, { key: 'due', header: 'Due' }, { key: 'status', header: 'Status' }], rows,
      }
    }
    if (type === 'collection') {
      const books = s.books.filter(b => progOk(b.program) && (!category || b.subjectCategory === category))
      const ids = new Set(books.map(b => b.id))
      const copies = s.copies.filter(c => ids.has(c.bookId))
      const rows: Row[] = books.map(b => { const cs = copies.filter(c => c.bookId === b.id); return { id: b.id, title: b.title, category: b.subjectCategory, program: b.program, copies: cs.length, available: cs.filter(c => c.status === 'Available').length, year: b.year } })
      return {
        kpis: [
          { label: 'Titles', value: books.length, icon: <Library size={36} /> },
          { label: 'Copies', value: copies.length, icon: <BookOpen size={36} />, tone: 'dark' },
          { label: 'Available', value: copies.filter(c => c.status === 'Available').length, icon: <BookOpen size={36} />, tone: 'green' },
          { label: 'Lost / damaged', value: copies.filter(c => c.status === 'Lost' || c.status === 'Damaged').length, icon: <BookOpen size={36} />, tone: 'amber' },
        ],
        charts: [
          { title: 'Copies by status', kind: 'pie', data: tally(copies, c => c.status, 'value'), keys: ['value'] },
          { title: 'Titles by category', kind: 'bar', data: tally(books, b => b.subjectCategory).map(d => ({ name: d.name.split(' ')[0], Titles: d.count })), keys: ['Titles'], yLabel: 'Titles' },
          { title: 'Titles by program', kind: 'bar', data: tally(books, b => b.program).map(d => ({ name: d.name, Titles: d.count })), keys: ['Titles'], yLabel: 'Titles' },
        ],
        cols: [{ key: 'title', header: 'Title' }, { key: 'category', header: 'Category' }, { key: 'program', header: 'Program' }, { key: 'copies', header: 'Copies' }, { key: 'available', header: 'Available' }, { key: 'year', header: 'Year' }], rows,
      }
    }
    if (type === 'fines') {
      const items = s.fines.map(f => ({ f, loan: s.loans.find(l => l.id === f.loanId) })).filter(x => inRange(x.loan?.due ?? x.f.paidOn) && progOk(memberOf(s, x.f.memberId)?.program ?? '') && (!category || (x.loan && loanBook(x.loan.copyId)?.subjectCategory === category)))
      const rows: Row[] = items.map(({ f, loan }) => ({ id: f.id, date: loan?.due ?? '—', member: memberOf(s, f.memberId)?.name ?? '—', title: loan ? loanBook(loan.copyId)?.title ?? '—' : '—', days: f.days, amount: f.amount, status: f.paid ? 'Paid' : 'Unpaid' }))
      const sum = (paid: boolean) => items.filter(x => x.f.paid === paid).reduce((a, x) => a + x.f.amount, 0)
      return {
        kpis: [
          { label: 'Total fines', value: peso(sum(true) + sum(false)), icon: <HandCoins size={36} /> },
          { label: 'Collected', value: peso(sum(true)), icon: <HandCoins size={36} />, tone: 'green' },
          { label: 'Outstanding', value: peso(sum(false)), icon: <HandCoins size={36} />, tone: 'amber' },
          { label: 'Fine records', value: items.length, icon: <Table2 size={36} />, tone: 'dark' },
        ],
        charts: [
          { title: 'Paid vs unpaid (₱)', kind: 'pie', data: [{ name: 'Paid', value: sum(true) }, { name: 'Unpaid', value: sum(false) }], keys: ['value'] },
          { title: 'Fine amount by program (₱)', kind: 'bar', data: PROGRAMS.map(p => ({ name: p, Paid: items.filter(x => x.f.paid && memberOf(s, x.f.memberId)?.program === p).reduce((a, x) => a + x.f.amount, 0), Unpaid: items.filter(x => !x.f.paid && memberOf(s, x.f.memberId)?.program === p).reduce((a, x) => a + x.f.amount, 0) })).filter(d => d.Paid || d.Unpaid), keys: ['Paid', 'Unpaid'], yLabel: 'Pesos' },
        ],
        cols: [{ key: 'date', header: 'Loan due' }, { key: 'member', header: 'Member' }, { key: 'title', header: 'Title' }, { key: 'days', header: 'Days late' }, { key: 'amount', header: 'Amount (₱)' }, { key: 'status', header: 'Status' }], rows,
      }
    }
    if (type === 'members') {
      const ms = s.members.filter(m => progOk(m.program) && inRange(m.joined))
      const rows: Row[] = ms.map(m => ({ id: m.id, idNo: m.idNo, name: m.name, program: m.program, type: m.type, status: m.status, joined: m.joined, loans: s.loans.filter(l => l.memberId === m.id).length }))
      return {
        kpis: [
          { label: 'Members', value: ms.length, icon: <Users size={36} /> },
          { label: 'Active', value: ms.filter(m => m.status === 'Active').length, icon: <Users size={36} />, tone: 'green' },
          { label: 'Inactive', value: ms.filter(m => m.status === 'Inactive').length, icon: <Users size={36} />, tone: 'dark' },
          { label: 'Faculty / staff', value: ms.filter(m => m.type !== 'Student').length, icon: <Users size={36} />, tone: 'amber' },
        ],
        charts: [
          { title: 'Members by type', kind: 'pie', data: tally(ms, m => m.type, 'value'), keys: ['value'] },
          { title: 'Members by program', kind: 'bar', data: tally(ms, m => m.program).map(d => ({ name: d.name, Members: d.count })), keys: ['Members'], yLabel: 'Members' },
        ],
        cols: [{ key: 'idNo', header: 'ID no.' }, { key: 'name', header: 'Name' }, { key: 'program', header: 'Program' }, { key: 'type', header: 'Type' }, { key: 'status', header: 'Status' }, { key: 'joined', header: 'Joined' }, { key: 'loans', header: 'Loans' }], rows,
      }
    }
    const vs = s.visits.filter(v => inRange(v.inAt) && progOk(memberOf(s, v.memberId)?.program ?? ''))
    const mins = (v: { inAt: string; outAt: string | null }) => v.outAt ? Math.max(1, Math.round((new Date(v.outAt).getTime() - new Date(v.inAt).getTime()) / 6e4)) : null
    const done = vs.map(mins).filter((x): x is number => x !== null)
    const rows: Row[] = vs.map(v => ({ id: v.id, member: memberOf(s, v.memberId)?.name ?? '—', program: memberOf(s, v.memberId)?.program ?? '—', in: fmtDateTime(v.inAt), out: v.outAt ? fmtDateTime(v.outAt) : 'Inside', minutes: mins(v) ?? '—' }))
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return {
      kpis: [
        { label: 'Total visits', value: vs.length, icon: <DoorOpen size={36} /> },
        { label: 'Unique visitors', value: new Set(vs.map(v => v.memberId)).size, icon: <Users size={36} />, tone: 'dark' },
        { label: 'Avg. stay', value: done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) + ' min' : '—', icon: <Clock size={36} />, tone: 'green' },
        { label: 'Currently inside', value: vs.filter(v => !v.outAt).length, icon: <DoorOpen size={36} />, tone: 'amber' },
      ],
      charts: [
        { title: 'Visits over time', kind: 'line', data: byBucket(vs.map(v => v.inAt)).map(d => ({ name: d.name, Visits: d.count })), keys: ['Visits'], yLabel: 'Visits' },
        { title: 'Visits by weekday', kind: 'bar', data: dow.map((d, i) => ({ name: d, Visits: vs.filter(v => new Date(v.inAt).getDay() === i).length })), keys: ['Visits'], yLabel: 'Visits' },
        { title: 'Visits by program', kind: 'pie', data: tally(vs, v => memberOf(s, v.memberId)?.program ?? '—', 'value'), keys: ['value'] },
      ],
      cols: [{ key: 'member', header: 'Member' }, { key: 'program', header: 'Program' }, { key: 'in', header: 'Time in' }, { key: 'out', header: 'Time out' }, { key: 'minutes', header: 'Minutes' }], rows,
    }
  }, [s, type, range, program, category])

  const cols: Col<Row>[] = report.cols.map(c => ({ key: c.key, header: c.header, sort: r => r[c.key] }))
  const filterText = `Range: ${range === 'all' ? 'All time' : `Last ${range} days`} · Program: ${program || 'All'} · Category: ${category || 'All'}`
  const sel = 'w-auto min-w-[8rem]'

  return (
    <div>
      <PageHeader title="Reports" subtitle="Charts and tables derived from current library data."
        actions={
          <div className="relative">
            <Btn variant="light" icon={<Download size={15} />} onClick={() => setMenu(m => !m)} aria-expanded={menu}>Export <ChevronDown size={14} /></Btn>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-line bg-white shadow-lg">
                {([['Excel', FileSpreadsheet], ['CSV', Table2]] as const).map(([f, Icon]) => (
                  <button key={f} onClick={() => { setFmt(f); setMenu(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50"><Icon size={15} className="text-brand" />Export as {f}</button>
                ))}
              </div>
            )}
          </div>
        } />

      <Card className="mb-4" bodyClass="p-0">
        <Tabs tabs={TABS} value={type} onChange={setType} />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Date range" className={sel}>
            <select className={inputCls} value={range} onChange={e => setRange(e.target.value)}>
              <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option>
            </select>
          </Field>
          <Field label="Program" className={sel}>
            <select className={inputCls} value={program} onChange={e => setProgram(e.target.value)}><option value="">All programs</option>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</select>
          </Field>
          <Field label="Category" className={sel}>
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{CATEGORIES.map(p => <option key={p}>{p}</option>)}</select>
          </Field>
          <div className="ml-auto inline-flex overflow-hidden rounded-md border border-line" role="group" aria-label="View">
            {(['chart', 'table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${view === v ? 'bg-brand text-white' : 'bg-white text-mute hover:bg-slate-50'}`}>
                {v === 'chart' ? <BarChart3 size={14} /> : <Table2 size={14} />}{v === 'chart' ? 'Chart view' : 'Table view'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.kpis.map(k => <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} tone={k.tone} />)}
      </div>

      {view === 'chart' && <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">{report.charts.map(c => <ChartBox key={c.title} c={c} />)}</div>}

      <Card title={`${TITLES[type]} — data`} flush>
        <DataTable rows={report.rows} columns={cols} search={r => Object.values(r).join(' ')} pageSize={8} />
      </Card>

      <Modal open={!!fmt} onClose={() => setFmt(null)} title="Export preview" size="lg"
        footer={<><Btn variant="light" onClick={() => setFmt(null)}>Close</Btn><Btn icon={<Download size={14} />} onClick={() => { const format = fmt === 'Excel' ? 'xlsx' : 'csv'; const filters = new URLSearchParams({ kind: type, format, range, ...(program ? { program } : {}), ...(category ? { category } : {}) }); void download(`/staff/reports/export?${filters}`, `${type}-report.${format}`).then(() => { toast('Filtered report downloaded', 'success'); setFmt(null) }).catch(error => toast(error instanceof Error ? error.message : 'Report download failed.', 'error')) }}>Download {fmt}</Btn></>}>
        <div className="relative mx-auto overflow-hidden border border-slate-300 bg-white p-5 shadow-inner sm:p-8">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-25 select-none text-5xl font-black uppercase tracking-widest text-slate-200 sm:text-6xl">Preview</span>
          </div>
          <div className="relative">
            <div className="text-[10px] font-bold uppercase tracking-widest text-mute">NBS Library · {fmt} export</div>
            <h4 className="mt-1 text-lg font-extrabold text-ink">{TITLES[type]}</h4>
            <p className="text-xs text-mute">{filterText}</p>
            <p className="mb-3 text-xs text-mute">Generated {fmtDate(today())} · {report.rows.length} rows</p>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead><tr className="border-b-2 border-slate-400">{report.cols.map(c => <th key={c.key} className="px-1.5 py-1 font-bold">{c.header}</th>)}</tr></thead>
                <tbody>{report.rows.slice(0, 6).map(r => <tr key={r.id} className="border-b border-slate-200">{report.cols.map(c => <td key={c.key} className="whitespace-nowrap px-1.5 py-1">{String(r[c.key])}</td>)}</tr>)}</tbody>
              </table>
            </div>
            {report.rows.length === 0 && <p className="py-4 text-center text-xs text-mute">No rows match the current filters.</p>}
            <p className="mt-3 text-[10px] text-mute">Showing first {Math.min(6, report.rows.length)} of {report.rows.length} rows.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
