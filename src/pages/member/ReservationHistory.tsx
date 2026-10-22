import { useState } from 'react'
import { useActions, bookOf } from '../../lib/actions'
import { fmtDate } from '../../lib/types'
import type { Reservation } from '../../lib/types'
import { Card, DataTable, PageHeader, Status, inputCls } from '../../components/ui'

export default function ReservationHistory() {
  const { s } = useActions()
  const me = s.session!.userId
  const [st, setSt] = useState('')
  const all = s.reservations.filter(r => r.memberId === me).sort((a, b) => b.date.localeCompare(a.date))
  const rows = st ? all.filter(r => r.status === st) : all
  const title = (r: Reservation) => bookOf(s, r.bookId)?.title ?? 'Unknown book'
  return (
    <div>
      <PageHeader demo title="Reservation History" subtitle="Every reservation you have made." />
      <Card flush>
        <DataTable rows={rows} search={r => `${title(r)} ${r.status}`}
          filters={<select aria-label="Status" value={st} onChange={e => setSt(e.target.value)} className={inputCls + ' !w-auto'}><option value="">All statuses</option>{['Pending', 'Ready', 'Received', 'Cancelled'].map(x => <option key={x}>{x}</option>)}</select>}
          columns={[
            { key: 'title', header: 'Title', sort: title, render: r => <span className="font-bold text-ink">{title(r)}</span> },
            { key: 'date', header: 'Reserved', sort: r => r.date, render: r => fmtDate(r.date) },
            { key: 'readyUntil', header: 'Pickup deadline', hideBelow: 'md', render: r => r.status === 'Ready' ? fmtDate(r.readyUntil) : '—' },
            { key: 'status', header: 'Status', sort: r => r.status, render: r => <Status value={r.status} /> },
          ]} />
      </Card>
    </div>
  )
}
