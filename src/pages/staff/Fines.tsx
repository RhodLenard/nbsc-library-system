import { useState } from 'react'
import { CheckCircle2, FileText, HandCoins, Receipt, Wallet } from 'lucide-react'
import { Btn, Card, DataTable, Field, Modal, PageHeader, ReceiptModal, StatCard, Status, inputCls, useConfirm, type Col } from '../../components/ui'
import { bookOf, copyOf, memberOf, useActions } from '../../lib/actions'
import { fmtDate, peso, today, type Fine } from '../../lib/types'

interface Doc { fines: Fine[]; paid: boolean; method?: string; received?: number }

export default function Fines() {
  const { s, toast, payFine } = useActions()
  const confirm = useConfirm()
  const [filter, setFilter] = useState('All')
  const [pay, setPay] = useState<Fine[] | null>(null)
  const [method, setMethod] = useState('Cash')
  const [received, setReceived] = useState('')
  const [err, setErr] = useState('')
  const [doc, setDoc] = useState<Doc | null>(null)

  const unpaid = s.fines.filter(f => !f.paid)
  const rows = s.fines.filter(f => filter === 'All' || (filter === 'Paid') === f.paid)
  const bookTitle = (f: Fine) => { const l = s.loans.find(x => x.id === f.loanId); return bookOf(s, copyOf(s, l?.copyId ?? '')?.bookId ?? '')?.title ?? '—' }
  const total = pay?.reduce((a, f) => a + f.amount, 0) ?? 0
  const change = Number(received) - total
  const selCls = `${inputCls} w-auto`

  const openPay = (list: Fine[]) => { setPay(list); setMethod('Cash'); setReceived(''); setErr('') }
  const submit = async () => {
    if (!pay) return
    if (!received.trim() || isNaN(Number(received))) return setErr('Enter the amount received.')
    if (Number(received) < total) return setErr(`Received amount is less than the total due (${peso(total)}).`)
    if (!(await confirm({ title: 'Confirm payment', message: `Record ${method} payment of ${peso(total)} for ${memberOf(s, pay[0].memberId)?.name}?`, confirmLabel: 'Record payment' }))) return
    const results = await Promise.all(pay.map(f => payFine(f.id, method)))
    if (results.some(result => !result)) return
    setDoc({ fines: pay.map(f => ({ ...f, paid: true, paidOn: today(), method })), paid: true, method, received: Number(received) })
    setPay(null)
  }
  const collect = (ids: string[], clear: () => void) => {
    const list = unpaid.filter(f => ids.includes(f.id))
    if (!list.length) return toast('No unpaid fines selected.', 'error')
    if (new Set(list.map(f => f.memberId)).size > 1) return toast('Select unpaid fines of a single member only.', 'error')
    openPay(list); clear()
  }
  const bulk = (ids: string[], clear: () => void) => <Btn size="sm" icon={<Wallet size={13} />} onClick={() => collect(ids, clear)}>Collect selected</Btn>

  const cols: Col<Fine>[] = [
    { key: 'm', header: 'Member', sort: f => memberOf(s, f.memberId)?.name ?? '', render: f => <div><div className="font-semibold">{memberOf(s, f.memberId)?.name ?? '—'}</div><div className="text-xs text-mute">{memberOf(s, f.memberId)?.idNo}</div></div> },
    { key: 'b', header: 'Book', hideBelow: 'md', render: bookTitle },
    { key: 'd', header: 'Days late', hideBelow: 'md', sort: f => f.days, render: f => f.days },
    { key: 'a', header: 'Amount', sort: f => f.amount, render: f => <b>{peso(f.amount)}</b> },
    { key: 's', header: 'Status', render: f => <Status value={f.paid ? 'Paid' : 'Unpaid'} /> },
    { key: 'p', header: 'Paid on', hideBelow: 'lg', render: f => f.paid ? `${fmtDate(f.paidOn)} · ${f.method ?? '—'}` : '—' },
  ]
  const first = doc?.fines[0]
  const dTotal = doc?.fines.reduce((a, f) => a + f.amount, 0) ?? 0

  return (
    <div>
      <PageHeader demo title="Fines Management" subtitle={`Late return fines at ${peso(5)} per day.`} />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Unpaid total" value={peso(unpaid.reduce((a, f) => a + f.amount, 0))} icon={<HandCoins size={36} />} />
        <StatCard label="Collected total" value={peso(s.fines.filter(f => f.paid).reduce((a, f) => a + f.amount, 0))} icon={<CheckCircle2 size={36} />} tone="green" />
        <StatCard label="Unpaid fines" value={unpaid.length} icon={<FileText size={36} />} tone="amber" />
      </div>
      <Card flush>
        <DataTable rows={rows} columns={cols} selectable search={f => `${memberOf(s, f.memberId)?.name} ${memberOf(s, f.memberId)?.idNo} ${bookTitle(f)}`}
          filters={<select aria-label="Filter" className={selCls} value={filter} onChange={e => setFilter(e.target.value)}><option value="All">All</option><option>Unpaid</option><option>Paid</option></select>}
          bulk={bulk}
          actions={f => <>
            {!f.paid && <Btn size="sm" icon={<Wallet size={13} />} onClick={() => openPay([f])}>Pay</Btn>}
            <Btn size="sm" variant="light" icon={<Receipt size={13} />} onClick={() => setDoc({ fines: [f], paid: f.paid, method: f.method ?? undefined })}>{f.paid ? 'Receipt' : 'Invoice'}</Btn>
          </>} />
      </Card>

      <Modal open={!!pay} onClose={() => setPay(null)} title="Record payment" size="sm" footer={<><Btn variant="light" onClick={() => setPay(null)}>Cancel</Btn><Btn onClick={submit}>Confirm payment</Btn></>}>
        {pay && (
          <form onSubmit={e => { e.preventDefault(); submit() }} className="space-y-3">
            <div className="text-sm"><span className="text-mute">Member: </span><b>{memberOf(s, pay[0].memberId)?.name}</b> <span className="text-mute">({pay.length} fine{pay.length > 1 ? 's' : ''})</span></div>
            <Field label="Amount due"><input className={inputCls} value={peso(total)} readOnly /></Field>
            <Field label="Method"><select className={inputCls} value={method} onChange={e => setMethod(e.target.value)}><option>Cash</option><option>GCash</option><option>Bank</option></select></Field>
            <Field label="Amount received" required error={err}><input className={inputCls} inputMode="decimal" value={received} onChange={e => { setReceived(e.target.value); setErr('') }} placeholder="0.00" /></Field>
            <div className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="text-mute">Change</span><b>{received && !isNaN(change) && change >= 0 ? peso(change) : '—'}</b></div>
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>

<ReceiptModal open={!!doc} onClose={() => setDoc(null)} title={doc?.paid ? 'Official receipt' : 'Invoice'}
        meta={doc && first ? [['Member', memberOf(s, first.memberId)?.name ?? '—'], ['Date', fmtDate(first.paidOn ?? today())], ['Status', doc.paid ? 'PAID' : 'UNPAID'], ...(doc.paid && doc.method ? [['Method', doc.method] as [string, string]] : []), ...(doc.received ? [['Received', peso(doc.received)] as [string, string], ['Change', peso(doc.received - dTotal)] as [string, string]] : [])] : []}
        lines={doc?.fines.map(f => ({ label: bookTitle(f), sub: `${f.days} day(s) late`, value: peso(f.amount) })) ?? []}
        total={peso(dTotal)} note={doc?.paid ? 'Payment received. Thank you!' : 'Please settle at the circulation desk.'} />
    </div>
  )
}
