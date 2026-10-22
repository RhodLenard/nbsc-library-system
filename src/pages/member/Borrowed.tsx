import { Link } from 'react-router'
import { Mail } from 'lucide-react'
import { useActions, activeLoans, bookOf, copyOf, fineFor } from '../../lib/actions'
import { RULES, daysBetween, fmtDate, isOverdue, peso, today } from '../../lib/types'
import { Alert, Card, CoverArt, EmptyState, PageHeader } from '../../components/ui'

export default function Borrowed() {
  const { s } = useActions()
  const me = s.session!.userId
  const loans = activeLoans(s, me).sort((a, b) => a.due.localeCompare(b.due))
  const fines = s.fines.filter(f => f.memberId === me && !f.paid)
  const total = fines.reduce((a, f) => a + f.amount, 0)
  return (
    <div>
      <PageHeader demo title="Borrowed Books" subtitle={`Loans run ${RULES.loanDays} days. Late fee ${peso(RULES.finePerDay)} per day.`}
        actions={<Link to="/member/messages" className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-2 text-sm font-semibold hover:bg-slate-50"><Mail size={14} /> Message the librarian</Link>} />
      {fines.length > 0 && (
        <Alert tone="error" className="mb-4">
          <div className="font-bold">Unpaid fines: {peso(total)}</div>
          <ul className="mt-1 list-disc pl-4">
            {fines.map(f => { const l = s.loans.find(x => x.id === f.loanId); const b = l && bookOf(s, copyOf(s, l.copyId)?.bookId ?? ''); return <li key={f.id}>{b?.title ?? 'Book'} — {f.days} day{f.days !== 1 && 's'} late — <b>{peso(f.amount)}</b></li> })}
          </ul>
          <div className="mt-1 text-xs">Payment is made at the circulation desk.</div>
        </Alert>
      )}
      {loans.length === 0 ? (
        <Card><EmptyState title="You have no borrowed books" action={<Link to="/member/catalog" className="text-sm font-bold text-brand hover:underline">Search catalog</Link>} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {loans.map(l => {
            const c = copyOf(s, l.copyId)
            const b = bookOf(s, c?.bookId ?? '')
            const left = daysBetween(today(), l.due)
            return (
              <div key={l.id} className={`flex gap-3 rounded-lg border bg-white p-3 shadow-[0_1px_3px_rgba(20,24,40,.06)] ${isOverdue(l) ? 'border-red-300' : 'border-line'}`}>
                <div className="w-16 shrink-0 self-start">{b && <CoverArt book={b} className="!p-1.5" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-ink">{b?.title ?? 'Unknown book'}</div>
                  <div className="font-mono text-xs text-mute">{c?.accession}</div>
                  <div className="mt-1 text-xs text-mute">Borrowed {fmtDate(l.borrowed)} · Due <b className="text-ink">{fmtDate(l.due)}</b></div>
                  <div className="mt-1.5">
                    {isOverdue(l)
                      ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200">Overdue by {-left} day{-left !== 1 && 's'} · est. fine {peso(fineFor(l))}</span>
                      : <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${left <= 2 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}`}>{left === 0 ? 'Due today' : `${left} day${left !== 1 ? 's' : ''} left`}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
