import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { useActions, activeLoans, availableOf, bookAuthors, bookOf, borrowBlocker } from '../../lib/actions'
import { RULES } from '../../lib/types'
import { Alert, Btn, Card, CoverArt, EmptyState, PageHeader, useConfirm } from '../../components/ui'
import type { Book } from '../../lib/types'

export default function Cart() {
  const { s, reserve, removeFromCart } = useActions()
  const confirm = useConfirm()
  const nav = useNavigate()
  const me = s.session!.userId
  const books = (s.carts[me] ?? []).map(id => bookOf(s, id)).filter((b): b is Book => !!b)
  const [sel, setSel] = useState<string[]>([])
  const picked = sel.filter(id => books.some(b => b.id === id))
  const held = activeLoans(s, me).length + s.reservations.filter(r => r.memberId === me && (r.status === 'Pending' || r.status === 'Ready')).length
  const remaining = Math.max(0, RULES.maxItems - held)
  const blocker = picked.length ? borrowBlocker(s, me, picked.length) : null
  const unavailable = picked.filter(id => availableOf(s, id) === 0)
  const allOn = books.length > 0 && picked.length === books.length
  const toggle = (id: string) => setSel(picked.includes(id) ? picked.filter(i => i !== id) : [...picked, id])

  const remove = async (b: Book) => {
    if (await confirm({ title: 'Remove from cart', message: <>Remove <b>{b.title}</b> from your cart?</>, confirmLabel: 'Remove', danger: true })) removeFromCart(me, b.id)
  }
  const checkout = async () => { if (await reserve(me, picked)) nav('/member/reserved') }

  return (
    <div>
      <PageHeader demo title="My Cart" subtitle="Select the books you would like to reserve." />
      {books.length === 0 ? (
        <Card><EmptyState title="Your cart is empty" hint="Find books in the catalog and add them here." action={<Link to="/member/catalog" className="text-sm font-bold text-brand hover:underline">Browse catalog</Link>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card title={`Cart (${books.length})`} actions={<label className="flex items-center gap-1.5 text-xs font-bold text-ink"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? [] : books.map(b => b.id))} className="accent-[#c62828]" /> Select all</label>} flush>
            <ul className="divide-y divide-line">
              {books.map(b => {
                const n = availableOf(s, b.id)
                return (
                  <li key={b.id} className="flex items-center gap-3 p-3">
                    <input type="checkbox" aria-label={`Select ${b.title}`} checked={picked.includes(b.id)} onChange={() => toggle(b.id)} className="accent-[#c62828]" />
                    <Link to={`/member/book/${b.id}`} className="w-12 shrink-0"><CoverArt book={b} className="!p-1" /></Link>
                    <div className="min-w-0 flex-1">
                      <Link to={`/member/book/${b.id}`} className="line-clamp-2 font-bold text-ink hover:text-brand">{b.title}</Link>
                      <div className="truncate text-xs text-mute">{bookAuthors(s, b)}</div>
                      <div className={`text-xs font-bold ${n ? 'text-emerald-700' : 'text-red-700'}`}>{n ? `${n} available` : 'No copies available'}</div>
                    </div>
                    <Btn size="sm" variant="ghost" aria-label={`Remove ${b.title}`} icon={<Trash2 size={14} />} onClick={() => remove(b)}><span className="hidden sm:inline">Remove</span></Btn>
                  </li>
                )
              })}
            </ul>
          </Card>
          <Card title="Summary" className="h-fit">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-mute">Selected</dt><dd className="font-bold">{picked.length}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Currently holding</dt><dd className="font-bold">{held} of {RULES.maxItems}</dd></div>
              <div className="flex justify-between"><dt className="text-mute">Remaining limit</dt><dd className="font-bold">{remaining}</dd></div>
            </dl>
            {blocker && <Alert tone="error" className="mt-3">{blocker}</Alert>}
            {!blocker && unavailable.length > 0 && <Alert tone="warning" className="mt-3">Some selected books have no available copies. Remove them to continue.</Alert>}
            <Btn className="mt-4 w-full" icon={<ShoppingCart size={15} />} disabled={!picked.length || !!blocker || unavailable.length > 0} onClick={checkout}>Checkout → Reserve</Btn>
            {!picked.length && <p className="mt-2 text-center text-xs text-mute">Select at least one book.</p>}
          </Card>
        </div>
      )}
    </div>
  )
}
