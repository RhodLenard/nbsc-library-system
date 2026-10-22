import { useState } from 'react'
import { CheckCheck, Plus, RotateCcw } from 'lucide-react'
import { Badge, Btn, Card, DataTable, EmptyState, Field, Modal, PageHeader, Status, Tabs, inputCls, useConfirm, type Col } from '../../components/ui'
import { bookOf, copyOf, memberOf, useActions } from '../../lib/actions'
import { fmtDate, type Incident } from '../../lib/types'

export default function Lost() {
  const { s, toast, markReplaced, restoreCopy, reportIncident } = useActions()
  const confirm = useConfirm()
  const [tab, setTab] = useState('unreplaced')
  const [open, setOpen] = useState(false)
  const [copyId, setCopyId] = useState('')
  const [type, setType] = useState<Incident['type']>('Lost')
  const [memberId, setMemberId] = useState('')
  const [err, setErr] = useState('')

  const title = (i: Incident) => bookOf(s, copyOf(s, i.copyId)?.bookId ?? '')?.title ?? '—'
  const all = [...s.incidents].sort((a, b) => b.date.localeCompare(a.date))
  const rows = all.filter(i => tab === 'all' || (tab === 'replaced') === (i.status === 'Replaced'))
  const eligible = s.copies.filter(c => c.status !== 'Lost')

  const replaced = async (i: Incident) => {
    const entered = window.prompt(`Replacement fine for "${title(i)}". Enter the amount to record:`, '')
    if (entered === null) return
    const amount = Number(entered)
    if (!Number.isFinite(amount) || amount <= 0) return toast('Enter a replacement fine greater than zero.', 'error')
    if (await confirm({ title: 'Record replacement', message: `Record a replacement fine of ${amount.toFixed(2)} and mark "${title(i)}" as replaced?`, confirmLabel: 'Record replacement' })) await markReplaced(i.id, amount)
  }
  const restore = async (i: Incident) => {
    if (await confirm({ title: 'Restore to circulation', message: `Return "${title(i)}" (${copyOf(s, i.copyId)?.accession}) to circulation as Available?` })) await restoreCopy(i.copyId)
  }
  const submit = async () => {
    if (!copyId) return setErr('Select a copy.')
    await reportIncident(copyId, memberId || null, type)
    setOpen(false)
  }
  const canRestore = (i: Incident) => { const st = copyOf(s, i.copyId)?.status; return st === 'Replaced' || st === 'Damaged' }

  const cols: Col<Incident>[] = [
    { key: 'a', header: 'Accession', sort: i => copyOf(s, i.copyId)?.accession ?? '', render: i => copyOf(s, i.copyId)?.accession ?? '—' },
    { key: 't', header: 'Book', sort: title, render: i => <span className="font-semibold">{title(i)}</span> },
    { key: 'ty', header: 'Type', render: i => <Badge tone={i.type === 'Lost' ? 'red' : 'yellow'}>{i.type}</Badge> },
    { key: 'm', header: 'Responsible', hideBelow: 'md', render: i => (i.memberId && memberOf(s, i.memberId)?.name) || '—' },
    { key: 'd', header: 'Date', hideBelow: 'md', sort: i => i.date, render: i => fmtDate(i.date) },
    { key: 's', header: 'Status', render: i => <Status value={i.status} /> },
  ]

  return (
    <div>
      <PageHeader demo title="Lost & Damaged" subtitle="Track lost, damaged, replaced and unreplaced copies." actions={<Btn icon={<Plus size={15} />} onClick={() => { setErr(''); setCopyId(''); setMemberId(''); setType('Lost'); setOpen(true) }}>Report new incident</Btn>} />
      <Card flush>
        <Tabs value={tab} onChange={setTab} tabs={[
          { id: 'unreplaced', label: `Unreplaced (${s.incidents.filter(i => i.status === 'Unreplaced').length})` },
          { id: 'replaced', label: `Replaced (${s.incidents.filter(i => i.status === 'Replaced').length})` },
          { id: 'all', label: `All (${s.incidents.length})` },
        ]} />
        <DataTable key={tab} rows={rows} columns={cols} search={i => `${title(i)} ${copyOf(s, i.copyId)?.accession} ${(i.memberId && memberOf(s, i.memberId)?.name) || ''}`}
          empty={<EmptyState title="No incidents" hint="Nothing to show in this tab." />}
          actions={i => <>
            {i.status === 'Unreplaced' && <Btn size="sm" icon={<CheckCheck size={13} />} onClick={() => replaced(i)}>Mark replaced</Btn>}
            {canRestore(i) && <Btn size="sm" variant="light" icon={<RotateCcw size={13} />} onClick={() => restore(i)}>Restore</Btn>}
          </>} />
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Report new incident" footer={<><Btn variant="light" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={submit}>Report incident</Btn></>}>
        <div className="grid gap-3">
          <Field label="Copy" required error={err}>
            <select className={inputCls} value={copyId} onChange={e => { setCopyId(e.target.value); setErr('') }}>
              <option value="">Select a copy…</option>
              {eligible.map(c => <option key={c.id} value={c.id}>{c.accession} — {bookOf(s, c.bookId)?.title} ({c.status})</option>)}
            </select>
          </Field>
          <Field label="Type"><select className={inputCls} value={type} onChange={e => setType(e.target.value as Incident['type'])}><option>Lost</option><option>Damaged</option></select></Field>
          <Field label="Responsible member (optional)">
            <select className={inputCls} value={memberId} onChange={e => setMemberId(e.target.value)}>
              <option value="">None</option>
              {s.members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.idNo})</option>)}
            </select>
          </Field>
        </div>
      </Modal>
    </div>
  )
}
