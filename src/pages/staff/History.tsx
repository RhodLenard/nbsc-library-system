import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { Btn, Card, DataTable, PageHeader, ReceiptModal, Status, inputCls, type Col } from '../../components/ui'
import { bookOf, copyOf, memberOf, useActions } from '../../lib/actions'
import { addDays, fmtDate, isOverdue, peso, today, type Loan } from '../../lib/types'

const statusOf = (l: Loan) => l.returned ? 'Returned' : isOverdue(l) ? 'Overdue' : 'On loan'

export default function History() {
  const { s } = useActions()
  const [status, setStatus] = useState('All')
  const [range, setRange] = useState('all')
  const [rec, setRec] = useState<Loan | null>(null)
  const title = (l: Loan) => bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.title ?? '—'
  const fineOf = (l: Loan) => s.fines.find(f => f.loanId === l.id)

  const rows = s.loans.filter(l => (status === 'All' || statusOf(l) === status) && (range === 'all' || l.borrowed >= addDays(today(), -Number(range)))).sort((a, b) => b.borrowed.localeCompare(a.borrowed))
  const cols: Col<Loan>[] = [
    { key: 'm', header: 'Member', sort: l => memberOf(s, l.memberId)?.name ?? '', render: l => <div><div className="font-semibold">{memberOf(s, l.memberId)?.name ?? '—'}</div><div className="text-xs text-mute">{memberOf(s, l.memberId)?.idNo}</div></div> },
    { key: 't', header: 'Book', sort: title, render: l => <span className="font-semibold">{title(l)}</span> },
    { key: 'a', header: 'Accession', hideBelow: 'md', render: l => copyOf(s, l.copyId)?.accession ?? '—' },
    { key: 'b', header: 'Borrowed', sort: l => l.borrowed, render: l => fmtDate(l.borrowed) },
    { key: 'd', header: 'Due', hideBelow: 'md', sort: l => l.due, render: l => fmtDate(l.due) },
    { key: 'r', header: 'Returned', hideBelow: 'lg', render: l => fmtDate(l.returned) },
    { key: 's', header: 'Status', render: l => <Status value={statusOf(l)} /> },
    { key: 'f', header: 'Fine', hideBelow: 'lg', render: l => { const f = fineOf(l); return f ? peso(f.amount) : '—' } },
  ]
  const f = rec ? fineOf(rec) : undefined
  const selCls = `${inputCls} w-auto`
  return (
    <div>
      <PageHeader demo title="Borrowing History" subtitle="Every loan ever recorded, across all members." />
      <Card flush>
        <DataTable rows={rows} columns={cols} search={l => `${memberOf(s, l.memberId)?.name} ${memberOf(s, l.memberId)?.idNo} ${title(l)} ${copyOf(s, l.copyId)?.accession}`}
          filters={<>
            <select aria-label="Status" className={selCls} value={status} onChange={e => setStatus(e.target.value)}><option value="All">All statuses</option><option>On loan</option><option>Overdue</option><option>Returned</option></select>
            <select aria-label="Date range" className={selCls} value={range} onChange={e => setRange(e.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
          </>}
          actions={l => <Btn size="sm" variant="light" icon={<Receipt size={13} />} onClick={() => setRec(l)}>Receipt</Btn>} />
      </Card>
      <ReceiptModal open={!!rec} onClose={() => setRec(null)} title="Loan receipt"
        meta={rec ? [['Member', memberOf(s, rec.memberId)?.name ?? '—'], ['ID no.', memberOf(s, rec.memberId)?.idNo ?? '—'], ['Borrowed', fmtDate(rec.borrowed)], ['Due', fmtDate(rec.due)], ['Returned', fmtDate(rec.returned)], ['Status', statusOf(rec)]] : []}
        lines={rec ? [{ label: title(rec), sub: copyOf(s, rec.copyId)?.accession }, ...(f ? [{ label: `Late fine (${f.days} day(s))`, value: peso(f.amount) }] : [])] : []}
        total={f ? peso(f.amount) : undefined} note="Thank you for using the library." />
    </div>
  )
}
