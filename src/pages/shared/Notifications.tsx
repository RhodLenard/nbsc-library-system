import { useState } from 'react'
import { Bell, BookMarked, BookOpen, CheckCheck, HandCoins, Info } from 'lucide-react'
import { useActions } from '../../lib/actions'
import { fmtDateTime } from '../../lib/types'
import type { Notice } from '../../lib/types'
import { Badge, Btn, Card, EmptyState, PageHeader, Tabs, type Tone } from '../../components/ui'

const kinds: Record<Notice['kind'], { label: string; icon: typeof Bell; tone: Tone }> = {
  loan: { label: 'Loan', icon: BookOpen, tone: 'blue' },
  reservation: { label: 'Reservation', icon: BookMarked, tone: 'green' },
  fine: { label: 'Fine', icon: HandCoins, tone: 'red' },
  system: { label: 'System', icon: Info, tone: 'gray' },
}

export default function Notifications() {
  const { s, readNotice, readAllNotices } = useActions()
  const key = s.session!.role === 'Member' ? s.session!.userId : 'staff'
  const [kind, setKind] = useState('all')
  const mine = s.notices.filter(n => n.toId === key).sort((a, b) => b.date.localeCompare(a.date))
  const list = kind === 'all' ? mine : mine.filter(n => n.kind === kind)
  const unread = mine.filter(n => !n.read).length
  return (
    <div>
      <PageHeader demo title="Notifications" subtitle={unread ? `${unread} unread` : 'You are all caught up'} actions={<Btn variant="light" icon={<CheckCheck size={14} />} disabled={!unread} onClick={() => void readAllNotices(key)}>Mark all read</Btn>} />
      <Card flush>
        <Tabs value={kind} onChange={setKind} tabs={[{ id: 'all', label: 'All' }, ...Object.entries(kinds).map(([id, k]) => ({ id, label: k.label }))]} />
        {list.length === 0 ? <EmptyState title="No notifications" hint={kind === 'all' ? 'New alerts will appear here.' : 'Nothing in this category.'} /> : (
          <ul className="divide-y divide-line">
            {list.map(n => {
              const k = kinds[n.kind]; const I = k.icon
              return (
                <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read ? '' : 'bg-brand-soft/40'}`}>
                  <span className="mt-0.5 rounded-full bg-white p-2 text-brand ring-1 ring-line"><I size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={k.tone}>{k.label}</Badge>{!n.read && <span className="h-2 w-2 rounded-full bg-brand" aria-label="Unread" />}</div>
                    <p className={`mt-1 text-sm ${n.read ? 'text-slate-600' : 'font-bold text-ink'}`}>{n.text}</p>
                    <p className="text-xs text-mute">{fmtDateTime(n.date)}</p>
                  </div>
                  {!n.read && <Btn size="sm" variant="ghost" onClick={() => void readNotice(n.id)}>Mark read</Btn>}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
