import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, Search, ShoppingCart } from 'lucide-react'
import { useActions, availableOf, bookAuthors, copiesOf } from '../../lib/actions'
import { Btn, Card, CoverArt, EmptyState, PageHeader, inputCls } from '../../components/ui'
import { api } from '../../lib/api'
import type { Book } from '../../lib/types'

const PER = 12
export default function Catalog() {
  const { s, addToCart } = useActions()
  const me = s.session!.userId
  const [q, setQ] = useState('')
  const [program, setProgram] = useState('')
  const [category, setCategory] = useState('')
  const [avail, setAvail] = useState('all')
  const [sort, setSort] = useState('title')
  const [page, setPage] = useState(1)

  const [result, setResult] = useState<{ ids: string[]; total: number; pages: number }>({ ids: [], total: 0, pages: 1 })
  const [loading, setLoading] = useState(true)
  const bookById = useMemo(() => new Map(s.books.map(book => [book.id, book])), [s.books])
  const categories = useMemo(() => [...new Set(s.books.map(book => book.subjectCategory.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [s.books])
  const programs = useMemo(() => [...new Set(s.books.map(book => book.program.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [s.books])
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), pageSize: String(PER) })
      if (q.trim()) params.set('search', q.trim())
      if (program) params.set('program', program)
      if (category) params.set('category', category)
      if (avail === 'avail') params.set('available', 'true')
      if (sort !== 'title') params.set('sort', sort)
      void api<{ items: Array<{ id: string }>; meta: { total: number; totalPages: number } }>(`/catalog/books?${params}`)
        .then(data => setResult({ ids: data.items.map(item => item.id), total: data.meta.total, pages: data.meta.totalPages }))
        .catch(() => setResult({ ids: [], total: 0, pages: 1 }))
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [q, program, category, avail, sort, page])
  const cur = Math.min(page, result.pages)
  const view = result.ids.map(id => bookById.get(id)).filter((book): book is Book => Boolean(book))
  const filtered = q || program || category || avail !== 'all'
  const clear = () => { setQ(''); setProgram(''); setCategory(''); setAvail('all'); setPage(1) }
  const upd = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPage(1) }

  return (
    <div>
      <PageHeader demo title="Search Catalog" subtitle={`${s.books.length} titles in the collection`} />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => upd(setQ)(e.target.value)} placeholder="Title, author, ISBN or subject" aria-label="Search catalog" className={inputCls + ' pl-8'} />
          </div>
          <select aria-label="Program" value={program} onChange={e => upd(setProgram)(e.target.value)} className={inputCls}><option value="">All programs</option>{programs.map(program => <option key={program}>{program}</option>)}</select>
          <select aria-label="Category" value={category} onChange={e => upd(setCategory)(e.target.value)} className={inputCls}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select>
          <select aria-label="Availability" value={avail} onChange={e => upd(setAvail)(e.target.value)} className={inputCls}><option value="all">All items</option><option value="avail">Available only</option></select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-mute">
          <span>{loading ? 'Searching…' : `${result.total} result${result.total !== 1 ? 's' : ''}`}</span>
          <label className="flex items-center gap-2">Sort by
            <select value={sort} onChange={e => setSort(e.target.value)} className={inputCls + ' !w-auto'}><option value="title">Title A–Z</option><option value="year">Year (newest)</option><option value="new">Recently added</option></select>
          </label>
        </div>
      </Card>

      {!loading && view.length === 0 ? (
        <Card><EmptyState title="No books found" hint="Try different keywords or remove some filters." action={filtered ? <Btn variant="outline" onClick={clear}>Clear filters</Btn> : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {view.map(b => {
            const n = availableOf(s, b.id), total = copiesOf(s, b.id).length
            const inCart = (s.carts[me] ?? []).includes(b.id)
            return (
              <div key={b.id} className="flex gap-3 rounded-lg border border-line bg-white p-3 shadow-[0_1px_3px_rgba(20,24,40,.06)]">
                <Link to={`/member/book/${b.id}`} className="w-24 shrink-0 self-start"><CoverArt book={b} /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/member/book/${b.id}`} className="line-clamp-2 font-extrabold leading-snug text-ink hover:text-brand">{b.title}</Link>
                  <div className="mt-0.5 line-clamp-2 text-xs text-mute">{bookAuthors(s, b)}</div>
                  <div className="text-xs text-mute">{b.year} · {b.subjectCategory}</div>
                  <div className="mt-1.5">
                    {n > 0 ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">{n} of {total} available</span>
                      : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-inset ring-red-200">No copies available</span>}
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                    <Link to={`/member/book/${b.id}`} className="inline-flex items-center rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink hover:bg-slate-50">View</Link>
                    <Btn size="sm" icon={<ShoppingCart size={12} />} disabled={n === 0 || inCart} title={n === 0 ? 'No copies are available to reserve right now' : inCart ? 'Already in cart' : undefined} onClick={() => addToCart(me, b.id)}>{inCart ? 'In cart' : 'Add to cart'}</Btn>
                  </div>
                  {n === 0 && <div className="mt-1 text-[11px] text-mute">Unavailable until a copy is returned.</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {result.total > PER && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <Btn size="sm" variant="light" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={14} /></Btn>
           <span className="px-2 text-sm font-bold">{cur} / {result.pages}</span>
           <Btn size="sm" variant="light" disabled={cur >= result.pages} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={14} /></Btn>
        </div>
      )}
    </div>
  )
}
