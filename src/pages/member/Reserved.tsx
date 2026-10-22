import { Link } from 'react-router'
import { X } from 'lucide-react'
import { useActions, bookAuthors, bookOf } from '../../lib/actions'
import { RULES, fmtDate } from '../../lib/types'
import { Alert, Btn, Card, CoverArt, EmptyState, PageHeader, Status, useConfirm } from '../../components/ui'

export default function Reserved() {
  const { s, cancelReservation } = useActions()
  const confirm = useConfirm()
  const me = s.session!.userId
  const rows = s.reservations.filter(r => r.memberId === me && (r.status === 'Pending' || r.status === 'Ready')).sort((a, b) => b.date.localeCompare(a.date))
  const cancel = async (id: string, title?: string) => {
    if (await confirm({ title: 'Cancel reservation', message: <>Cancel your reservation for <b>{title}</b>?</>, confirmLabel: 'Cancel reservation', danger: true })) await cancelReservation(id)
  }
  return (
    <div>
      <PageHeader demo title="Reserved Books" subtitle="Reservations waiting to be prepared or picked up." />
      <Alert className="mb-4"><b>How pickup works:</b> staff prepare your book and mark it Ready. You will get a notification, then have {RULES.readyHours} hours to collect it at the circulation desk with your ID. Unclaimed reservations may be released.</Alert>
      {rows.length === 0 ? (
        <Card><EmptyState title="No active reservations" action={<Link to="/member/catalog" className="text-sm font-bold text-brand hover:underline">Search catalog</Link>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(r => {
            const b = bookOf(s, r.bookId)
            return (
              <div key={r.id} className="flex gap-3 rounded-lg border border-line bg-white p-3 shadow-[0_1px_3px_rgba(20,24,40,.06)]">
                <div className="w-16 shrink-0 self-start">{b && <CoverArt book={b} className="!p-1.5" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><div className="font-extrabold text-ink">{b?.title ?? 'Unknown book'}</div><Status value={r.status} /></div>
                  {b && <div className="text-xs text-mute">{bookAuthors(s, b)}</div>}
                  <div className="mt-1 text-xs text-mute">Reserved {fmtDate(r.date)}</div>
                  {r.status === 'Ready' && <div className="text-xs font-bold text-emerald-700">Pick up by {fmtDate(r.readyUntil)}</div>}
                  <Btn size="sm" variant="light" className="mt-2" icon={<X size={12} />} onClick={() => cancel(r.id, b?.title)}>Cancel</Btn>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
