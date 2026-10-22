import { useStore } from './store'
import { clearSessionToken, mutation } from './api'
import { useToast } from '../components/ui'
import type { Book, Copy, Fine, Incident, Loan, Member, Reservation, Role, State, StaffAccount } from './types'
import { RULES, addDays, daysBetween, isOverdue, today, uid } from './types'

type Lookup = {
  books: Map<string, Book>; copies: Map<string, Copy>; members: Map<string, Member>;
  writers: Map<string, string>; publishers: Map<string, string>; copiesByBook: Map<string, Copy[]>;
  availableByBook: Map<string, number>;
}
const lookupCache = new WeakMap<State, Lookup>()
function lookup(s: State): Lookup {
  const cached = lookupCache.get(s)
  if (cached) return cached
  const copiesByBook = new Map<string, Copy[]>()
  const availableByBook = new Map<string, number>()
  for (const copy of s.copies) {
    const copies = copiesByBook.get(copy.bookId) ?? []
    copies.push(copy); copiesByBook.set(copy.bookId, copies)
    if (copy.status === 'Available') availableByBook.set(copy.bookId, (availableByBook.get(copy.bookId) ?? 0) + 1)
  }
  const created: Lookup = {
    books: new Map(s.books.map(book => [book.id, book])), copies: new Map(s.copies.map(copy => [copy.id, copy])), members: new Map(s.members.map(member => [member.id, member])),
    writers: new Map(s.writers.map(writer => [writer.id, writer.name])), publishers: new Map(s.publishers.map(publisher => [publisher.id, publisher.name])), copiesByBook, availableByBook,
  }
  lookupCache.set(s, created)
  return created
}

export const bookOf = (s: State, id: string) => lookup(s).books.get(id)
export const copyOf = (s: State, id: string) => lookup(s).copies.get(id)
export const memberOf = (s: State, id: string) => lookup(s).members.get(id)
export const writerName = (s: State, id: string) => s.writers.find(w => w.id === id)?.name ?? '—'
export const publisherName = (s: State, id: string) => s.publishers.find(p => p.id === id)?.name ?? '—'
export const bookAuthors = (s: State, b: Book) => b.contributors.map(c => writerName(s, c.writerId)).join('; ') || '—'
export const copiesOf = (s: State, bookId: string) => lookup(s).copiesByBook.get(bookId) ?? []
export const availableOf = (s: State, bookId: string) => lookup(s).availableByBook.get(bookId) ?? 0
export const activeLoans = (s: State, memberId: string) => s.loans.filter(l => l.memberId === memberId && !l.returned)
export const actorName = (s: State) => (s.session?.role === 'Member' ? s.members : s.staff).find(u => u.id === s.session?.userId)?.name ?? 'System'
export const unpaidFines = (s: State, memberId: string) => s.fines.filter(f => f.memberId === memberId && !f.paid)
export const fineFor = (l: Loan, on = today()) => Math.max(0, daysBetween(l.due, on)) * RULES.finePerDay

/** Returns a blocking message or null — mirrors the familiar legacy blocking states. */
export function borrowBlocker(s: State, memberId: string, adding = 1): string | null {
  const m = memberOf(s, memberId)
  if (!m) return 'Member not found.'
  if (m.status === 'Inactive') return 'This account is inactive. Please see the librarian.'
  const loans = activeLoans(s, memberId)
  if (loans.some(isOverdue)) return 'You have an overdue book. Please return it before borrowing or reserving another.'
  if (unpaidFines(s, memberId).length) return 'You have unpaid fines. Please settle them at the circulation desk.'
  const reserved = s.reservations.filter(r => r.memberId === memberId && (r.status === 'Pending' || r.status === 'Ready')).length
  if (loans.length + reserved + adding > RULES.maxItems) return `Item limit reached: members may hold up to ${RULES.maxItems} books (loans + reservations).`
  return null
}

export function useActions() {
  const { s, set, reset, refresh } = useStore()
  const toast = useToast()
  const log = (d: State, text: string): State => ({ ...d, activity: [{ id: uid('a'), actor: actorName(d), text, date: new Date().toISOString() }, ...d.activity] })
  const notice = (d: State, toId: string, text: string, kind: State['notices'][number]['kind']): State => ({ ...d, notices: [{ id: uid('n'), toId, text, kind, date: new Date().toISOString(), read: false }, ...d.notices] })

  return {
    s, set, reset, refresh, toast, log,
    login(role: Role, userId: string) { set(d => ({ ...d, session: { role, userId } })) },
    logout() { clearSessionToken(); set(d => ({ ...d, session: null })); toast('Signed out. See you soon!', 'info') },
    async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
      try { await mutation('/auth/change-password', { currentPassword, newPassword }); toast('Password updated', 'success'); return true } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to update password.', 'error'); return false }
    },
    async updateProfile(profile: { name: string; email: string; phone?: string; program?: string }): Promise<boolean> {
      try { await mutation('/auth/profile', profile); await refresh(); toast('Profile updated', 'success'); return true } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to update profile.', 'error'); return false }
    },

    async borrow(memberId: string, copyIds: string[]): Promise<Loan[] | null> {
      const err = borrowBlocker(s, memberId, copyIds.length)
      if (err) { toast(err, 'error'); return null }
      try {
        const due = addDays(today(), RULES.loanDays)
        const loans = await mutation<Array<{ id: string; copyId: string; memberId: string; issuedAt: string; dueAt: string; returnedAt: string | null }>>('/staff/loans', { memberId, copyIds, dueAt: `${due}T23:59:59.999Z` })
        await refresh()
        toast(`Loan confirmed — due ${due}`, 'success')
        return loans.map(loan => ({ id: loan.id, copyId: loan.copyId, memberId: loan.memberId, borrowed: loan.issuedAt.slice(0, 10), due: loan.dueAt.slice(0, 10), returned: loan.returnedAt?.slice(0, 10) ?? null }))
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to create loan.', 'error'); return null }
      /* Legacy optimistic implementation retained below temporarily.
      const due = addDays(today(), RULES.loanDays)
      const loans: Loan[] = copyIds.map(copyId => ({ id: uid('l'), copyId, memberId, borrowed: today(), due, returned: null }))
      set(d => {
        let n = { ...d, loans: [...loans, ...d.loans], copies: d.copies.map(c => copyIds.includes(c.id) ? { ...c, status: 'Borrowed' as const } : c) }
        n = log(n, `Issued ${copyIds.length} item(s) to ${memberOf(d, memberId)?.name}`)
        return notice(n, memberId, `You borrowed ${copyIds.length} item(s). Due ${due}.`, 'loan')
      })
      toast(`Loan confirmed — due ${due}`, 'success')
      return loans */
    },
    async returnLoan(loanId: string): Promise<{ loan: Loan; fine: Fine | null } | null> {
      const loan = s.loans.find(l => l.id === loanId)
      if (!loan || loan.returned) return null
      try {
        const updated = await mutation<{ returnedAt: string | null }>('/staff/loans/' + loanId + '/return', {})
        await refresh()
        toast('Book returned successfully', 'success')
        return { loan: { ...loan, returned: updated.returnedAt?.slice(0, 10) ?? today() }, fine: null }
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to return book.', 'error'); return null }
      /* Legacy optimistic implementation retained below temporarily.
      const days = Math.max(0, daysBetween(loan.due, today()))
      const fine: Fine | null = days > 0 ? { id: uid('f'), loanId, memberId: loan.memberId, amount: days * RULES.finePerDay, days, paid: false, paidOn: null, method: null } : null
      set(d => {
        let n: State = { ...d, loans: d.loans.map(l => l.id === loanId ? { ...l, returned: today() } : l), copies: d.copies.map(c => c.id === loan.copyId ? { ...c, status: 'Available' as const } : c), fines: fine ? [fine, ...d.fines] : d.fines }
        n = log(n, `Returned ${bookOf(d, copyOf(d, loan.copyId)!.bookId)?.title}${fine ? ` (fine ₱${fine.amount})` : ''}`)
        return fine ? notice(n, loan.memberId, `A fine of ₱${fine.amount}.00 was added for a late return.`, 'fine') : n
      })
      toast(fine ? `Returned late — fine ₱${fine.amount}.00 created` : 'Book returned successfully', fine ? 'warning' : 'success')
      return { loan: { ...loan, returned: today() }, fine } */
    },
    async payFine(fineId: string, method: string): Promise<boolean> {
      try {
        await mutation('/staff/fines/payments', { fineIds: [fineId], method })
        await refresh()
        toast('Payment recorded', 'success')
        return true
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to record payment.', 'error'); return false }
      /* Legacy optimistic implementation retained below temporarily.
      set(d => log({ ...d, fines: d.fines.map(f => f.id === fineId ? { ...f, paid: true, paidOn: today(), method } : f) }, `Recorded fine payment ${fineId} (${method})`))
      toast('Payment recorded', 'success') */
    },
    async reportIncident(copyId: string, memberId: string | null, type: Incident['type']): Promise<void> {
      try { await mutation('/staff/incidents', { copyId, memberId, type }); await refresh(); toast(`Copy marked as ${type.toLowerCase()}`, 'warning') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to report incident.', 'error') }
    },
    async markReplaced(incidentId: string, amount: number, reason = 'Replacement'): Promise<void> {
      try { await mutation('/staff/incidents/' + incidentId + '/replace', { amount, reason }); await refresh(); toast('Replacement fine recorded and copy marked as replaced', 'success') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to mark replacement.', 'error') }
    },
    async restoreCopy(copyId: string): Promise<void> {
      try { await mutation('/staff/copies/' + copyId + '/restore', {}); await refresh(); toast('Copy returned to circulation', 'success') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to restore copy.', 'error') }
    },

    async reserve(memberId: string, bookIds: string[]): Promise<boolean> {
      const err = borrowBlocker(s, memberId, bookIds.length)
      if (err) { toast(err, 'error'); return false }
      try {
        await mutation('/staff/reservations', { titleIds: bookIds })
        await refresh()
        set(d => ({ ...d, carts: { ...d.carts, [memberId]: (d.carts[memberId] ?? []).filter(id => !bookIds.includes(id)) } }))
        toast('Reservation placed. We will notify you when it is ready.', 'success')
        return true
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to place reservation.', 'error'); return false }
      /* Legacy optimistic implementation retained below temporarily.
      const dup = bookIds.find(id => s.reservations.some(r => r.memberId === memberId && r.bookId === id && (r.status === 'Pending' || r.status === 'Ready')) || activeLoans(s, memberId).some(l => copyOf(s, l.copyId)?.bookId === id))
      if (dup) { toast(`You already have "${bookOf(s, dup)?.title}" reserved or borrowed.`, 'error'); return false }
      const unavailable = bookIds.find(id => availableOf(s, id) === 0)
      if (unavailable) { toast(`"${bookOf(s, unavailable)?.title}" has no available copies right now.`, 'error'); return false }
      const res: Reservation[] = bookIds.map(bookId => ({ id: uid('r'), memberId, bookId, copyId: null, status: 'Pending', date: today(), readyUntil: null }))
      set(d => {
        const n = log({ ...d, reservations: [...res, ...d.reservations], carts: { ...d.carts, [memberId]: (d.carts[memberId] ?? []).filter(id => !bookIds.includes(id)) } }, `Reserved ${bookIds.length} book(s)`)
        return notice(n, 'staff', `${memberOf(d, memberId)?.name} placed ${bookIds.length} new reservation(s).`, 'reservation')
      })
      toast('Reservation placed. We will notify you when it is ready.', 'success')
      return true */
    },
    async cancelReservation(id: string): Promise<void> {
      try { await mutation('/staff/reservations/' + id + '/cancel', {}); await refresh(); toast('Reservation cancelled', 'info') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to cancel reservation.', 'error') }
      /* Legacy optimistic implementation retained below temporarily.
      set(d => {
        const r = d.reservations.find(x => x.id === id)!
        return log({ ...d, reservations: d.reservations.map(x => x.id === id ? { ...x, status: 'Cancelled' as const, copyId: null } : x), copies: d.copies.map(c => c.id === r.copyId ? { ...c, status: 'Available' as const } : c) }, `Cancelled reservation ${id}`)
      })
      toast('Reservation cancelled', 'info') */
    },
    async markReady(id: string, copyId: string): Promise<void> {
      try { await mutation('/staff/reservations/' + id + '/ready', { copyId }); await refresh(); toast('Reservation marked ready', 'success') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to prepare reservation.', 'error') }
      /* Legacy optimistic implementation retained below temporarily.
      set(d => {
        const r = d.reservations.find(x => x.id === id)!
        const n = log({ ...d, reservations: d.reservations.map(x => x.id === id ? { ...x, status: 'Ready' as const, copyId, readyUntil: addDays(today(), RULES.readyHours / 24) } : x), copies: d.copies.map(c => c.id === copyId ? { ...c, status: 'Reserved' as const } : c) }, `Marked reservation ${id} as ready`)
        return notice(n, r.memberId, `Your reserved book "${bookOf(d, r.bookId)?.title}" is ready for pickup.`, 'reservation')
      })
      toast('Marked ready — member notified', 'success')
       */
    },
      async receiveReservation(id: string): Promise<Loan | null> {
      try {
        const loan = await mutation<{ id: string; copyId: string; memberId: string; issuedAt: string; dueAt: string; returnedAt: string | null }>('/staff/reservations/' + id + '/receive', {})
        await refresh(); toast('Book handed over and loan created', 'success')
        return { id: loan.id, copyId: loan.copyId, memberId: loan.memberId, borrowed: loan.issuedAt.slice(0, 10), due: loan.dueAt.slice(0, 10), returned: loan.returnedAt?.slice(0, 10) ?? null }
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to receive reservation.', 'error'); return null }
      /* Legacy optimistic implementation retained below temporarily.
      const r = s.reservations.find(x => x.id === id)
      if (!r?.copyId) return null
      const loan: Loan = { id: uid('l'), copyId: r.copyId, memberId: r.memberId, borrowed: today(), due: addDays(today(), RULES.loanDays), returned: null }
      set(d => log({ ...d, reservations: d.reservations.map(x => x.id === id ? { ...x, status: 'Received' as const } : x), loans: [loan, ...d.loans], copies: d.copies.map(c => c.id === r.copyId ? { ...c, status: 'Borrowed' as const } : c) }, `Received reservation ${id} and issued loan`))
      toast('Book handed over and loan created', 'success')
      return loan */
    },

    addToCart(memberId: string, bookId: string) {
      if ((s.carts[memberId] ?? []).includes(bookId)) return toast('Already in your cart', 'info')
      set(d => ({ ...d, carts: { ...d.carts, [memberId]: [...(d.carts[memberId] ?? []), bookId] } }))
      toast('Added to cart', 'success')
    },
    removeFromCart(memberId: string, bookId: string) {
      set(d => ({ ...d, carts: { ...d.carts, [memberId]: (d.carts[memberId] ?? []).filter(i => i !== bookId) } }))
      toast('Removed from cart', 'info')
    },

    async sendMessage(_fromId: string, toId: string, subject: string, body: string): Promise<boolean> {
      try { await mutation('/staff/messages', { recipientId: toId, subject, body }); await refresh(); toast('Message sent', 'success'); return true } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to send message.', 'error'); return false }
    },
    async readMessage(id: string): Promise<void> { try { await mutation('/staff/messages/' + id + '/read', {}); await refresh() } catch { /* non-blocking read receipt */ } },
    async readNotice(id: string): Promise<void> { try { await mutation('/staff/notifications/' + id + '/read', {}); await refresh() } catch { /* non-blocking read receipt */ } },
    async readAllNotices(_toId: string): Promise<void> { try { await mutation('/staff/notifications/read-all', {}); await refresh() } catch { /* non-blocking read receipt */ } },
    async logVisitEntry(memberId: string): Promise<boolean> {
      try { await mutation('/staff/visits', { memberId }); await refresh(); toast('Entry logged', 'success'); return true } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to log entry.', 'error'); return false }
    },
    async logVisitExit(visitId: string): Promise<boolean> {
      try { await mutation('/staff/visits/' + visitId + '/exit', {}); await refresh(); toast('Exit logged', 'success'); return true } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to log exit.', 'error'); return false }
    },

    async saveBook(book: Book, copies: Copy[]): Promise<string | null> {
      try {
        const exists = s.books.some(item => item.id === book.id)
        const result = await mutation<{ id: string }>(exists ? '/catalog/books/' + book.id : '/catalog/books', { title: book.title, preferredTitle: book.preferredTitle, isbn: book.isbn, subjectCategory: book.subjectCategory, program: book.program, summary: book.summary, contents: book.contents, publisherId: book.publisherId || null, year: book.year, contributors: book.contributors, corporate: book.corporate, copies: copies.map(copy => ({ ...(s.copies.some(current => current.id === copy.id) ? { id: copy.id } : {}), accession: copy.accession, copyNo: copy.copyNo, location: copy.location, callNo: copy.callNo, status: ({ Available: 'AVAILABLE', Borrowed: 'ON_LOAN', Reserved: 'RESERVED', Lost: 'LOST', Damaged: 'DAMAGED', Replaced: 'REPLACED' } as const)[copy.status] })) })
        await refresh(); toast(`Book saved with ${copies.length} cop${copies.length === 1 ? 'y' : 'ies'}`, 'success')
        return result.id
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to save book.', 'error'); return null }
    },
    deleteBooks(ids: string[]) {
      set(d => log({ ...d, books: d.books.filter(b => !ids.includes(b.id)), copies: d.copies.filter(c => !ids.includes(c.bookId)) }, `Deleted ${ids.length} book(s)`))
      toast(`${ids.length} book(s) deleted`, 'success')
    },
    upsertEntity(kind: 'writers' | 'publishers' | 'corporates', item: { id: string }) {
      set(d => { const list = d[kind] as { id: string }[]; const has = list.some(x => x.id === item.id); return { ...d, [kind]: has ? list.map(x => x.id === item.id ? item : x) : [item, ...list] } as State })
      toast('Record saved', 'success')
    },
    deleteEntity(kind: 'writers' | 'publishers' | 'corporates', ids: string[]) {
      set(d => ({ ...d, [kind]: (d[kind] as { id: string }[]).filter(x => !ids.includes(x.id)) }) as State)
      toast('Record(s) removed', 'success')
    },
    async upsertMember(m: Member): Promise<string | null> {
      try {
        const exists = s.members.some(member => member.id === m.id)
        const result = await mutation<{ id: string }>(exists ? '/staff/members/' + m.id : '/staff/members', { idNo: m.idNo, name: m.name, email: m.email, program: m.program, type: m.type, phone: m.phone, status: m.status })
        await refresh(); toast('Member saved', 'success'); return result.id
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to save member.', 'error'); return null }
    },
    async setMemberStatus(ids: string[], status: Member['status']): Promise<void> {
      try { await mutation('/staff/members/status', { ids, status }); await refresh(); toast(`${ids.length} member(s) ${status === 'Active' ? 'activated' : 'deactivated'}`, 'success') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to update member status.', 'error') }
    },
    deleteMembers(ids: string[]) {
      set(d => log({ ...d, members: d.members.filter(m => !ids.includes(m.id)) }, `Deleted ${ids.length} member(s)`))
      toast(`${ids.length} member(s) deleted`, 'success')
    },
    async upsertStaff(a: StaffAccount & { password?: string }): Promise<boolean> {
      try {
        const result = await mutation<{ id: string }>(a.id ? '/staff/accounts/' + a.id : '/staff/accounts', { employeeId: a.employeeId, name: a.name, email: a.email, role: a.role, status: a.status, ...(a.password ? { password: a.password } : {}) })
        await refresh(); toast('Account saved', 'success'); return Boolean(result.id)
      } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to save account.', 'error'); return false }
    },
    deleteStaff(id: string) { set(d => ({ ...d, staff: d.staff.filter(x => x.id !== id) })); toast('Account deleted', 'success') },
  }
}
