import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BookMarked, ShoppingCart } from 'lucide-react'
import { useActions, activeLoans, availableOf, bookAuthors, bookOf, borrowBlocker, copiesOf, copyOf, publisherName, writerName } from '../../lib/actions'
import { RULES } from '../../lib/types'
import { Alert, Btn, Card, CoverArt, DataTable, EmptyState, Modal, PageHeader, Status, type Col } from '../../components/ui'
import type { Copy } from '../../lib/types'

export default function BookDetail() {
  const { id } = useParams()
  const { s, reserve, addToCart } = useActions()
  const me = s.session!.userId
  const [open, setOpen] = useState(false)
  const book = id ? bookOf(s, id) : undefined

  if (!book) {
    return <Card><EmptyState title="Book not found" hint="This title may have been removed from the catalog." action={<Link to="/member/catalog" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"><ArrowLeft size={14} /> Back to catalog</Link>} /></Card>
  }

  const copies = copiesOf(s, book.id)
  const n = availableOf(s, book.id)
  const dup = s.reservations.some(r => r.memberId === me && r.bookId === book.id && (r.status === 'Pending' || r.status === 'Ready')) || activeLoans(s, me).some(l => copyOf(s, l.copyId)?.bookId === book.id)
  const blocker = borrowBlocker(s, me, 1)
  const block = dup ? 'You already have this book reserved or borrowed.' : n === 0 ? 'No copies are available to reserve right now.' : blocker
  const inCart = (s.carts[me] ?? []).includes(book.id)
  const related = s.books.filter(b => b.id !== book.id && b.subjectCategory === book.subjectCategory).slice(0, 6)
  const contents = book.contents.split(/\r?\n|;/).map(x => x.trim()).filter(Boolean)

  const rows: [string, React.ReactNode][] = [
    ['Preferred title', book.preferredTitle], ['Parallel title', book.parallelTitle],
    ['Authors / contributors', book.contributors.length ? book.contributors.map((c, i) => <div key={i}>{writerName(s, c.writerId)}{c.role && <span className="text-mute"> ({c.role})</span>}</div>) : '—'],
    ['Corporate contributors', book.corporate.length ? book.corporate.map((c, i) => <div key={i}>{s.corporates.find(x => x.id === c.corpId)?.name ?? '—'}{c.role && <span className="text-mute"> ({c.role})</span>}</div>) : ''],
    ['Publisher', [publisherName(s, book.publisherId), book.place, book.year].filter(Boolean).join(', ')],
    ['Edition', book.edition], ['Pages', book.pages], ['ISBN', book.isbn], ['Language', book.language],
    ['Series', [book.series, book.volume && `vol. ${book.volume}`, book.part && `part ${book.part}`].filter(Boolean).join(' ')],
    ['Subject category', book.subjectCategory], ['Program', book.program], ['Subject detail', book.subjectDetail],
  ]

  const cols: Col<Copy>[] = [
    { key: 'accession', header: 'Accession', render: c => <span className="font-mono text-xs font-bold">{c.accession}</span> },
    { key: 'copyNo', header: 'Copy', render: c => `#${c.copyNo}` },
    { key: 'callNo', header: 'Call no.', hideBelow: 'md' },
    { key: 'location', header: 'Location' },
    { key: 'status', header: 'Status', render: c => <Status value={c.status} /> },
  ]

  return (
    <div>
      <PageHeader demo title="Book Details" actions={<Link to="/member/catalog" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"><ArrowLeft size={14} /> Back to catalog</Link>} />
      <Card>
        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <div className="mx-auto w-48 md:w-full"><CoverArt book={book} /></div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-ink sm:text-2xl">{book.title}</h2>
            <p className="text-sm text-mute">{bookAuthors(s, book)} · {book.year}</p>
            <div className="mt-2">
              {n > 0 ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">{n} of {copies.length} available</span>
                : <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 ring-1 ring-inset ring-red-200">No copies available</span>}
            </div>
            {block && <Alert tone={dup ? 'info' : 'warning'} className="mt-3">{block}</Alert>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn icon={<BookMarked size={15} />} disabled={!!block} onClick={() => setOpen(true)}>Reserve this book</Btn>
              <Btn variant="light" icon={<ShoppingCart size={15} />} disabled={n === 0 || inCart} title={n === 0 ? 'No copies available' : undefined} onClick={() => addToCart(me, book.id)}>{inCart ? 'In cart' : 'Add to cart'}</Btn>
            </div>
            <dl className="mt-5 divide-y divide-line text-sm">
              {rows.filter(r => r[1] && r[1] !== '—').map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2 sm:grid-cols-[11rem_1fr]"><dt className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-ink">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </Card>

      {(book.summary || contents.length > 0) && (
        <Card title="Summary & contents" className="mt-4">
          {book.summary && <p className="text-sm leading-relaxed text-slate-700">{book.summary}</p>}
          {contents.length > 0 && <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-slate-700">{contents.map((c, i) => <li key={i}>{c}</li>)}</ul>}
        </Card>
      )}

      <Card title="Copies" flush className="mt-4">
        <DataTable rows={copies} columns={cols} pageSize={6} empty={<EmptyState title="No copies recorded" />} />
      </Card>

      {related.length > 0 && (
        <Card title={`Related books in ${book.subjectCategory}`} className="mt-4">
          <div className="scroll-thin flex gap-4 overflow-x-auto pb-2">
            {related.map(b => (
              <Link key={b.id} to={`/member/book/${b.id}`} className="w-28 shrink-0 text-xs font-bold text-ink hover:text-brand">
                <CoverArt book={b} /><div className="mt-1.5 line-clamp-2">{b.title}</div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Confirm reservation"
         footer={<><Btn variant="light" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={() => { void reserve(me, [book.id]).then(ok => { if (ok) setOpen(false) }) }}>Reserve</Btn></>}> 
        <p className="text-sm text-slate-700">Reserve <b>{book.title}</b>? Staff will prepare a copy and notify you. You will have {RULES.readyHours} hours to pick it up once it is ready.</p>
      </Modal>
    </div>
  )
}
