import { useState } from 'react'
import { useActions, bookOf, copyOf, fineFor } from '../../lib/actions'
import { fmtDate, isOverdue, peso } from '../../lib/types'
import type { Loan } from '../../lib/types'
import { Card, DataTable, PageHeader, Status, inputCls } from '../../components/ui'

export default function BorrowHistory() {
  const { s } = useActions()
  const me = s.session!.userId
  const [st, setSt] = useState('')
  const state = (l: Loan) => l.returned ? 'Returned' : isOverdue(l) ? 'Overdue' : 'On loan'
  const all = s.loans.filter(l => l.memberId === me).sort((a, b) => b.borrowed.localeCompare(a.borrowed))
  const rows = st ? all.filter(l => state(l) === st) : all
  const title = (l: Loan) => bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')?.title ?? 'Unknown book'
  const acc = (l: Loan) => copyOf(s, l.copyId)?.accession ?? '—'
  const fine = (l: Loan) => { const f = s.fines.find(x => x.loanId === l.id); return f ? f.amount : l.returned ? 0 : fineFor(l) }
  return (
    <div>
      <PageHeader demo title="Borrowing History" subtitle="All books you have borrowed." />
      <Card flush>
        <DataTable rows={rows} search={l => `${title(l)} ${acc(l)}`}
          filters={<select aria-label="Status" value={st} onChange={e => setSt(e.target.value)} className={inputCls + ' !w-auto'}><option value="">All statuses</option>{['On loan', 'Overdue', 'Returned'].map(x => <option key={x}>{x}</option>)}</select>}
          columns={[
            { key: 'title', header: 'Title', sort: title, render: l => <span className="font-bold text-ink">{title(l)}</span> },
            { key: 'acc', header: 'Accession', hideBelow: 'md', render: l => <span className="font-mono text-xs">{acc(l)}</span> },
            { key: 'borrowed', header: 'Borrowed', sort: l => l.borrowed, render: l => fmtDate(l.borrowed) },
            { key: 'due', header: 'Due', sort: l => l.due, render: l => fmtDate(l.due) },
            { key: 'returned', header: 'Returned', hideBelow: 'md', render: l => fmtDate(l.returned) },
            { key: 'status', header: 'Status', render: l => <Status value={state(l)} /> },
            { key: 'fine', header: 'Fine', sort: fine, render: l => fine(l) > 0 ? <span className="font-bold text-red-700">{peso(fine(l))}{!l.returned && <span className="text-xs font-normal"> (est.)</span>}</span> : '—' },
          ]} />
      </Card>
    </div>
  )
}
