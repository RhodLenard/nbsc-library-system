import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Barcode, CreditCard, Pencil, Printer, RotateCcw } from 'lucide-react'
import { bookAuthors, bookOf, copiesOf, publisherName, useActions } from '../../lib/actions'
import { Badge, Btn, Card, CoverArt, DataTable, EmptyState, Modal, PageHeader, Status, Tabs, useConfirm } from '../../components/ui'
import type { Book, Copy } from '../../lib/types'

// Decorative Code 128–style bars derived from the accession text.
function Bars({ text, h = 44 }: { text: string; h?: number }) {
  const bars: { x: number; w: number }[] = []
  let x = 4
  const seq = ['11010010000', ...[...text].map(ch => (ch.charCodeAt(0) * 2654435761 >>> 0).toString(2).padStart(11, '0').slice(-11)), '1100011101011']
  seq.join('').split('').forEach((bit, i) => { if (bit === '1') bars.push({ x: x + i * 1.6, w: 1.4 }) })
  const width = seq.join('').length * 1.6 + 8
  return (
    <svg viewBox={`0 0 ${width} ${h}`} className="w-full" role="img" aria-label={`Barcode preview for ${text}`} preserveAspectRatio="none" style={{ height: h }}>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={h} fill="#111" />)}
    </svg>
  )
}

function CardCatalog({ book, s, copies }: { book: Book; s: ReturnType<typeof useActions>['s']; copies: Copy[] }) {
  const authors = book.contributors.map(c => s.writers.find(w => w.id === c.writerId)?.name ?? '')
  const sur = (authors[0] ?? '').split(' ').slice(-1)[0]
  return (
    <div className="mx-auto aspect-[5/3] w-full max-w-xl rounded-sm border border-slate-300 bg-[#fffdf5] p-5 font-mono text-[11px] leading-relaxed text-slate-800 shadow-md sm:text-xs" data-testid="card-catalog">
      <div className="relative h-full border-b border-dashed border-slate-300">
        <div className="absolute bottom-3 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-slate-400 bg-page" />
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <div className="font-bold">{book.callBase}<br />{book.shelfLocation}</div>
          <div>
            <div className="font-bold">{sur}, {authors[0]}</div>
            <div className="pl-4">{book.title} / {authors.join(', ')}. — {book.edition} ed. — {book.place} : {publisherName(s, book.publisherId)}, {book.year}.</div>
            <div className="pl-4">{book.pages}{book.images && ` : ${book.images}`} ; {book.dimension}.</div>
            {book.isbn && <div className="pl-4">ISBN {book.isbn}</div>}
            <div className="mt-1 pl-4">1. {book.subjectCategory}. 2. {book.subjectDetail}.</div>
            <div className="mt-1 pl-4 text-[10px]">Acc. no.: {copies.map(c => `${c.accession} (c.${c.copyNo})`).join(', ')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BookDetail() {
  const { id } = useParams()
  const a = useActions()
  const { s } = a
  const confirm = useConfirm()
  const [tab, setTab] = useState('details')
  const [sheet, setSheet] = useState(false)
  const book = bookOf(s, id ?? '')
  const copies = useMemo(() => copiesOf(s, id ?? ''), [s, id])
  if (!book) return <EmptyState title="Book not found" action={<Link to="/staff/catalog" className="font-bold text-brand">Back to catalog</Link>} />
  const meta: [string, string][] = [
    ['Preferred title', book.preferredTitle], ['Parallel title', book.parallelTitle], ['Authors', bookAuthors(s, book)], ['Publisher', `${publisherName(s, book.publisherId)}, ${book.place}, ${book.year}`],
    ['Edition', book.edition], ['Physical description', [book.pages, book.images, book.dimension].filter(Boolean).join(' · ')], ['ISBN', book.isbn], ['Language', book.language],
    ['Series / volume / part', [book.series, book.volume && `v.${book.volume}`, book.part && `pt.${book.part}`].filter(Boolean).join(' ')], ['Subject', `${book.subjectCategory} · ${book.program}`], ['Subject detail', book.subjectDetail],
    ['Call number base', book.callBase], ['Shelf location', book.shelfLocation], ['Content / media / carrier', `${book.contentType} / ${book.mediaType} / ${book.carrierType}`],
    ['Corporate contributors', book.corporate.map(c => `${s.corporates.find(x => x.id === c.corpId)?.name} (${c.role})`).join('; ')],
  ]
  return (
    <div>
      <PageHeader title={book.title} subtitle={`Added ${book.addedOn}`} demo actions={<><Link to="/staff/catalog"><Btn variant="light" icon={<ArrowLeft size={15} />}>Back</Btn></Link><Link to={`/staff/catalog/${book.id}/edit`}><Btn icon={<Pencil size={15} />}>Edit Book</Btn></Link></>} />
      <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
        <div className="space-y-3"><CoverArt book={book} className="mx-auto w-48 lg:w-full" />
          <div className="flex flex-wrap justify-center gap-1.5 text-center"><Badge tone="green">{copies.filter(c => c.status === 'Available').length} available</Badge><Badge tone="gray">{copies.length} copies</Badge></div>
        </div>
        <Card flush>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'details', label: 'Details' }, { id: 'copies', label: `Copies (${copies.length})` }, { id: 'barcodes', label: 'Barcodes' }, { id: 'card', label: 'Card catalog' }]} />
          <div className="p-4">
            {tab === 'details' && (<>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{meta.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-[11px] font-extrabold uppercase tracking-wider text-mute">{k}</dt><dd className="text-sm">{v}</dd></div>)}</dl>
              <h3 className="mb-1 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-mute">Summary</h3><p className="text-sm">{book.summary}</p>
              <h3 className="mb-1 mt-5 text-[11px] font-extrabold uppercase tracking-wider text-mute">Contents</h3><pre className="whitespace-pre-wrap font-sans text-sm">{book.contents}</pre>
            </>)}
            {tab === 'copies' && (
              <div className="-m-4"><DataTable<Copy> rows={copies} pageSize={10} search={c => c.accession + c.callNo}
                columns={[
                  { key: 'acc', header: 'Accession', sort: c => c.accession, render: c => <span className="font-mono font-bold">{c.accession}</span> },
                  { key: 'no', header: 'Copy', sort: c => c.copyNo, render: c => `c.${c.copyNo}` },
                  { key: 'ed', header: 'Edition', hideBelow: 'md' }, { key: 'location', header: 'Location', hideBelow: 'md' },
                  { key: 'call', header: 'Call number', hideBelow: 'lg', render: c => <span className="font-mono text-xs">{c.callNo}</span> },
                  { key: 'st', header: 'Status', render: c => <Status value={c.status} /> },
                ]}
                actions={c => (c.status === 'Lost' || c.status === 'Damaged' || c.status === 'Replaced') ? <Btn size="sm" variant="light" icon={<RotateCcw size={13} />} onClick={async () => (await confirm({ title: 'Return copy to circulation?', message: `Accession ${c.accession} will be marked Available.`, confirmLabel: 'Restore' })) && a.restoreCopy(c.id)}>Restore</Btn> : <Link to={`/staff/catalog/${book.id}/edit`}><Btn size="sm" variant="light" icon={<Pencil size={13} />}>Edit</Btn></Link>} /></div>
            )}
            {tab === 'barcodes' && (<>
              <div className="mb-3 flex items-center justify-between"><p className="text-sm text-mute">Label preview — accession, copy number and call number per copy.</p><Btn icon={<Printer size={14} />} onClick={() => setSheet(true)}>Generate label sheet</Btn></div>
              <div className="grid gap-3 sm:grid-cols-2">{copies.slice(0, 6).map(c => <Label key={c.id} c={c} title={book.title} />)}</div>
            </>)}
            {tab === 'card' && (<><div className="mb-3 flex items-center justify-between"><p className="text-sm text-mute"><CreditCard size={14} className="mr-1 inline" />Main entry card preview</p><Btn variant="light" icon={<Printer size={14} />} onClick={() => window.print()}>Print card</Btn></div><div className="print-area"><CardCatalog book={book} s={s} copies={copies} /></div></>)}
          </div>
        </Card>
      </div>
      <Modal open={sheet} onClose={() => setSheet(false)} title="Barcode label sheet" size="xl" footer={<><Btn variant="light" onClick={() => setSheet(false)}>Close</Btn><Btn icon={<Printer size={14} />} onClick={() => window.print()}>Print</Btn></>}>
        <div className="print-area grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{copies.map(c => <Label key={c.id} c={c} title={book.title} />)}</div>
        <p className="mt-3 text-xs text-mute"><Barcode size={12} className="mr-1 inline" />Bars are decorative in this prototype and are not scannable.</p>
      </Modal>
    </div>
  )
}

function Label({ c, title }: { c: Copy; title: string }) {
  return (
    <div className="rounded border border-slate-300 bg-white p-3">
      <div className="truncate text-[10px] font-bold uppercase text-slate-500">NBS Library · {title}</div>
      <Bars text={c.accession} />
      <div className="mt-1 flex items-baseline justify-between"><span className="font-mono text-sm font-bold tracking-widest">{c.accession}</span><span className="text-xs font-bold">c.{c.copyNo}</span></div>
      <div className="font-mono text-[10px] text-slate-600">{c.callNo}</div>
    </div>
  )
}
