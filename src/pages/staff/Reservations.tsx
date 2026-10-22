import { useState } from 'react'
import { Check, HandHelping, X } from 'lucide-react'
import { bookOf, copiesOf, copyOf, memberOf, useActions } from '../../lib/actions'
import { Alert, Btn, Card, DataTable, Field, Modal, PageHeader, ReceiptModal, Status, Tabs, inputCls, useConfirm } from '../../components/ui'
import { fmtDate, today, type Loan, type Reservation } from '../../lib/types'

export default function Reservations() {
  const a = useActions()
  const { s } = a
  const confirm = useConfirm()
  const [tab, setTab] = useState('open')
  const [ready, setReady] = useState<Reservation | null>(null)
  const [copyId, setCopyId] = useState('')
  const [loan, setLoan] = useState<Loan | null>(null)

  const rows = s.reservations.filter(r => tab === 'all' || (tab === 'open' ? r.status === 'Pending' : tab === 'ready' ? r.status === 'Ready' : r.status === 'Received' || r.status === 'Cancelled'))
  const count = (st: string) => s.reservations.filter(r => r.status === st).length
  const avail = ready ? copiesOf(s, ready.bookId).filter(c => c.status === 'Available') : []
  const open = (r: Reservation) => { setReady(r); setCopyId(copiesOf(s, r.bookId).find(c => c.status === 'Available')?.id ?? '') }

  return (
    <div>
      <PageHeader title="Reservation Queue" subtitle="Online reservations from members, oldest first." demo />
      <Card flush>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'open', label: `Pending (${count('Pending')})` }, { id: 'ready', label: `Ready (${count('Ready')})` }, { id: 'done', label: 'Completed / Cancelled' }, { id: 'all', label: 'All' }]} />
        <DataTable<Reservation> rows={[...rows].sort((x, y) => x.date.localeCompare(y.date))} search={r => memberOf(s, r.memberId)?.name + ' ' + bookOf(s, r.bookId)?.title}
          columns={[
            { key: 'pos', header: '#', render: r => <span className="font-bold text-mute">{s.reservations.filter(x => x.status === 'Pending').sort((p, q) => p.date.localeCompare(q.date)).findIndex(x => x.id === r.id) + 1 || '—'}</span> },
            { key: 'm', header: 'Member', render: r => { const m = memberOf(s, r.memberId); return <div><div className="font-bold">{m?.name}</div><div className="text-xs text-mute">{m?.idNo} · {m?.program}</div></div> } },
            { key: 'b', header: 'Book', render: r => { const n = copiesOf(s, r.bookId).filter(c => c.status === 'Available').length; return <div><div className="font-semibold">{bookOf(s, r.bookId)?.title}</div>{r.status === 'Pending' && <div className={n ? 'text-xs text-emerald-700' : 'text-xs font-bold text-red-700'}>{n ? `${n} copy available` : 'No copy available'}</div>}</div> } },
            { key: 'd', header: 'Requested', hideBelow: 'md', render: r => fmtDate(r.date) },
            { key: 'c', header: 'Held copy', hideBelow: 'lg', render: r => r.copyId ? <span className="font-mono text-xs">{copyOf(s, r.copyId)?.accession} · until {fmtDate(r.readyUntil)}</span> : '—' },
            { key: 's', header: 'Status', render: r => <Status value={r.status} /> },
          ]}
          actions={r => <>
            {r.status === 'Pending' && <Btn size="sm" icon={<Check size={13} />} onClick={() => open(r)}>Mark ready</Btn>}
            {r.status === 'Ready' && <Btn size="sm" variant="success" icon={<HandHelping size={13} />} onClick={async () => { if (await confirm({ title: 'Hand over book?', message: 'This creates a loan for the member and removes the hold.', confirmLabel: 'Receive & lend' })) { const l = await a.receiveReservation(r.id); if (l) setLoan(l) } }}>Receive</Btn>}
            {(r.status === 'Pending' || r.status === 'Ready') && <Btn size="sm" variant="light" className="text-brand" icon={<X size={13} />} onClick={async () => { if (await confirm({ title: 'Cancel reservation?', message: 'The member will be able to reserve again.', confirmLabel: 'Cancel reservation', danger: true })) await a.cancelReservation(r.id) }}>Cancel</Btn>}
          </>} />
      </Card>

      <Modal open={!!ready} onClose={() => setReady(null)} title="Mark reservation ready" footer={<><Btn variant="light" onClick={() => setReady(null)}>Close</Btn><Btn disabled={!copyId} onClick={() => void a.markReady(ready!.id, copyId).then(() => setReady(null))}>Mark ready & notify</Btn></>}>
        {ready && (<div className="space-y-3">
          <p className="text-sm"><b>{bookOf(s, ready.bookId)?.title}</b> for {memberOf(s, ready.memberId)?.name}.</p>
          {avail.length === 0 ? <Alert tone="warning">No copy is available right now. Check Lost &amp; Damaged or wait for a return.</Alert> : (
            <Field label="Copy to hold" help="Pick an alternative copy if the first one is damaged or mislabelled.">
              <select className={inputCls} value={copyId} onChange={e => setCopyId(e.target.value)}>{avail.map(c => <option key={c.id} value={c.id}>{c.accession} · c.{c.copyNo} · {c.location} · {c.callNo}</option>)}</select>
            </Field>)}
        </div>)}
      </Modal>
      {loan && <ReceiptModal open onClose={() => setLoan(null)} title="Loan receipt" meta={[['Member', memberOf(s, loan.memberId)?.name ?? ''], ['Date', fmtDate(today())], ['Due', fmtDate(loan.due)]]} lines={[{ label: bookOf(s, copyOf(s, loan.copyId)!.bookId)?.title ?? '', sub: `Acc. ${copyOf(s, loan.copyId)?.accession}` }]} />}
    </div>
  )
}
