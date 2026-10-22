import { useMemo, useState } from 'react'
import { Card, DataTable, PageHeader, inputCls, type Col } from '../../components/ui'
import { useActions } from '../../lib/actions'
import { fmtDateTime, type Activity as Act } from '../../lib/types'

export default function Activity() {
  const { s } = useActions()
  const [actor, setActor] = useState('')
  const actors = useMemo(() => [...new Set(s.activity.map(a => a.actor))].sort(), [s.activity])
  const rows = s.activity.filter(a => !actor || a.actor === actor)
  const cols: Col<Act>[] = [
    { key: 'date', header: 'Date', sort: a => a.date, render: a => <span className="whitespace-nowrap">{fmtDateTime(a.date)}</span> },
    { key: 'actor', header: 'Actor', sort: a => a.actor, render: a => <span className="font-semibold">{a.actor}</span> },
    { key: 'text', header: 'Activity' },
  ]
  return (
    <div>
      <PageHeader title="Activity Log" subtitle="Read-only audit trail of staff actions and member-record access." />
      <Card flush>
        <DataTable rows={rows} columns={cols} search={a => `${a.actor} ${a.text}`} pageSize={10}
          filters={<select aria-label="Filter by actor" className={`${inputCls} w-auto`} value={actor} onChange={e => setActor(e.target.value)}><option value="">All actors</option>{actors.map(a => <option key={a}>{a}</option>)}</select>} />
      </Card>
    </div>
  )
}
