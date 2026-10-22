import { Link } from 'react-router'
import { BookOpen, BookMarked, HandCoins, Layers, LibraryBig, ShoppingCart, Mail, Bell } from 'lucide-react'
import { useActions, activeLoans, bookOf, copyOf, fineFor, unpaidFines } from '../../lib/actions'
import { RULES, daysBetween, fmtDate, fmtDateTime, isOverdue, peso, today } from '../../lib/types'
import { Alert, Card, EmptyState, PageHeader, StatCard, Status } from '../../components/ui'

export default function Dashboard() {
  const { s } = useActions()
  const me = s.session!.userId
  const member = s.members.find(m => m.id === me)
  const loans = activeLoans(s, me).sort((a, b) => a.due.localeCompare(b.due))
  const ready = s.reservations.filter(r => r.memberId === me && r.status === 'Ready')
  const pending = s.reservations.filter(r => r.memberId === me && r.status === 'Pending').length
  const fines = unpaidFines(s, me)
  const fineTotal = fines.reduce((a, f) => a + f.amount, 0)
  const held = loans.length + ready.length + pending
  const remaining = Math.max(0, RULES.maxItems - held)
  const overdue = loans.filter(isOverdue)
  const notices = s.notices.filter(n => n.toId === me).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)

  return (
    <div>
      <PageHeader demo title={`Welcome back, ${member?.name.split(' ')[0] ?? 'Reader'}!`} subtitle="Here is what is happening with your library account." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active loans" value={loans.length} icon={<BookOpen size={36} />} tone="brand" />
        <StatCard label="Ready for pickup" value={ready.length} icon={<BookMarked size={36} />} tone="green" />
        <StatCard label="Unpaid fines" value={peso(fineTotal)} icon={<HandCoins size={36} />} tone={fineTotal ? 'amber' : 'dark'} />
        <StatCard label="Items remaining" value={`${remaining} of ${RULES.maxItems}`} hint="Loans + reservations count toward the limit" icon={<Layers size={36} />} tone="dark" />
      </div>

      {overdue.length > 0 && (
        <Alert tone="error" className="mt-4">
          You have {overdue.length} overdue book{overdue.length > 1 ? 's' : ''}. Estimated fines so far: <b>{peso(overdue.reduce((a, l) => a + fineFor(l), 0))}</b> ({peso(RULES.finePerDay)}/day). Please return {overdue.length > 1 ? 'them' : 'it'} to the circulation desk.
        </Alert>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Due soon / overdue" actions={<Link to="/member/borrowed" className="text-xs font-bold text-brand hover:underline">All borrowed</Link>}>
            {loans.length === 0 ? <EmptyState title="No books on loan" hint="Browse the catalog to find your next read." action={<Link to="/member/catalog" className="text-sm font-bold text-brand hover:underline">Search catalog</Link>} /> : (
              <ul className="divide-y divide-line">
                {loans.map(l => {
                  const b = bookOf(s, copyOf(s, l.copyId)?.bookId ?? '')
                  const left = daysBetween(today(), l.due)
                  return (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-ink">{b?.title ?? 'Unknown book'}</div>
                        <div className="text-xs text-mute">Due {fmtDate(l.due)}</div>
                      </div>
                      {isOverdue(l)
                        ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">Overdue {-left}d · est. fine {peso(fineFor(l))}</span>
                        : <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${left <= 2 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}`}>{left === 0 ? 'Due today' : `${left} day${left > 1 ? 's' : ''} left`}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          <Card title="Ready for pickup" actions={<Link to="/member/reserved" className="text-xs font-bold text-brand hover:underline">My reservations</Link>}>
            {ready.length === 0 ? <p className="text-sm text-mute">No reservations are ready right now.{pending > 0 && ` ${pending} pending.`}</p> : (
              <ul className="divide-y divide-line">
                {ready.map(r => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="font-bold text-ink">{bookOf(s, r.bookId)?.title}</div>
                    <div className="flex items-center gap-2 text-xs text-mute"><Status value="Ready" /> Pick up by {fmtDate(r.readyUntil)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Quick links">
            <div className="grid gap-2">
              {[['/member/catalog', 'Search catalog', LibraryBig], ['/member/cart', `Cart (${(s.carts[me] ?? []).length})`, ShoppingCart], ['/member/messages', 'Messages', Mail], ['/member/notifications', 'Notifications', Bell]].map(([to, label, Icon]) => {
                const I = Icon as typeof Mail
                return <Link key={to as string} to={to as string} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-bold text-ink hover:border-brand hover:bg-brand-soft"><I size={16} className="text-brand" />{label as string}</Link>
              })}
            </div>
          </Card>
          <Card title="Recent activity">
            {notices.length === 0 ? <p className="text-sm text-mute">No recent activity.</p> : (
              <ul className="space-y-3">
                {notices.map(n => (
                  <li key={n.id} className="text-sm">
                    <div className={n.read ? 'text-slate-600' : 'font-bold text-ink'}>{n.text}</div>
                    <div className="text-xs text-mute">{fmtDateTime(n.date)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
