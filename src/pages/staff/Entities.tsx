import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router'
import { Pencil, Plus, Trash2, Unlink } from 'lucide-react'
import { Btn, Card, DataTable, EmptyState, Field, Modal, PageHeader, cx, inputCls, useConfirm, type Col } from '../../components/ui'
import { publisherName, useActions, writerName } from '../../lib/actions'
import { uid, type Corporate, type Publisher, type Writer } from '../../lib/types'

const KINDS: Record<string, { label: string; title: string; subtitle: string }> = {
  writers: { label: 'Writers', title: 'Writers', subtitle: 'Authors and individual creators of catalog items.' },
  publishers: { label: 'Publishers', title: 'Publishers', subtitle: 'Publishing houses and their places of publication.' },
  corporates: { label: 'Corporate Entities', title: 'Corporate Entities', subtitle: 'Organizations, agencies and institutions.' },
  contributors: { label: 'Individual Contributors', title: 'Individual Contributors', subtitle: 'Every writer-to-book link with its role.' },
  publications: { label: 'Publications', title: 'Publications', subtitle: 'Publication details for each book.' },
  'corporate-contributors': { label: 'Corporate Contributors', title: 'Corporate Contributors', subtitle: 'Every corporate entity-to-book link with its role.' },
}

type EntKind = 'writers' | 'publishers' | 'corporates'
type Ent = { id: string; name: string } & Record<string, string>
const PREFIX: Record<EntKind, string> = { writers: 'w', publishers: 'p', corporates: 'c' }
const FIELDS: Record<EntKind, { key: string; label: string; required?: boolean }[]> = {
  writers: [{ key: 'name', label: 'Name', required: true }, { key: 'born', label: 'Born' }, { key: 'notes', label: 'Notes' }],
  publishers: [{ key: 'name', label: 'Name', required: true }, { key: 'place', label: 'Place' }],
  corporates: [{ key: 'name', label: 'Name', required: true }, { key: 'kind', label: 'Kind' }],
}

function Switcher({ kind }: { kind: string }) {
  return (
    <div className="scroll-quiet mb-4 flex gap-2 overflow-x-auto pb-1">
      {Object.entries(KINDS).map(([k, v]) => (
        <NavLink key={k} to={`/staff/catalog/entities/${k}`} className={cx('whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold', k === kind ? 'border-brand bg-brand text-white' : 'border-line bg-white text-mute hover:text-ink')}>{v.label}</NavLink>
      ))}
    </div>
  )
}

function EntityTable({ kind }: { kind: EntKind }) {
  const { s, toast, upsertEntity, deleteEntity } = useActions()
  const confirm = useConfirm()
  const [edit, setEdit] = useState<Ent | null>(null)
  const [err, setErr] = useState('')
  const fields = FIELDS[kind]
  const rows = s[kind] as unknown as Ent[]
  const usage = (id: string) => s.books.filter(b => kind === 'writers' ? b.contributors.some(c => c.writerId === id) : kind === 'publishers' ? b.publisherId === id : b.corporate.some(c => c.corpId === id)).length
  const blank = (): Ent => ({ id: '', name: '', ...Object.fromEntries(fields.map(f => [f.key, ''])) } as Ent)

  const save = () => {
    if (!edit) return
    if (!edit.name.trim()) return setErr('Name is required.')
    if (rows.some(r => r.id !== edit.id && r.name.toLowerCase() === edit.name.trim().toLowerCase())) return setErr('A record with this name already exists.')
    const item = { ...edit, name: edit.name.trim(), id: edit.id || uid(PREFIX[kind]) } as Writer & Publisher & Corporate
    upsertEntity(kind, item); setEdit(null)
  }
  const del = async (r: Ent) => {
    const n = usage(r.id)
    if (n > 0) return toast(`Cannot delete "${r.name}" — it is used by ${n} book(s).`, 'error')
    if (await confirm({ title: 'Delete record', message: `Delete "${r.name}"?`, confirmLabel: 'Delete', danger: true })) deleteEntity(kind, [r.id])
  }
  const cols: Col<Ent>[] = [
    ...fields.map((f, i) => ({ key: f.key, header: f.label, sort: (r: Ent) => r[f.key] ?? '', hideBelow: i > 1 ? 'md' as const : undefined, render: (r: Ent) => r[f.key] || '—' })),
    { key: 'used', header: 'Books', sort: r => usage(r.id), render: r => usage(r.id) },
  ]
  return (
    <Card flush>
      <DataTable rows={rows} columns={cols} search={r => fields.map(f => r[f.key]).join(' ')}
        toolbarRight={undefined}
        />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? 'Edit' : 'Add'} ${KINDS[kind].label.replace(/s$/, '')}`} footer={<><Btn variant="light" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
        {edit && (
          <form onSubmit={e => { e.preventDefault(); save() }} className="grid gap-3">
            {fields.map(f => (
              <Field key={f.key} label={f.label} required={f.required} error={f.key === 'name' && err}>
                <input className={inputCls} value={edit[f.key] ?? ''} onChange={e => setEdit({ ...edit, [f.key]: e.target.value })} />
              </Field>
            ))}
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
    </Card>
  )
}

interface LinkRow { id: string; bookId: string; name: string; role: string; idx: number }

function LinkTable({ kind }: { kind: 'contributors' | 'corporate-contributors' }) {
  const { s, set, toast } = useActions()
  const confirm = useConfirm()
  const corp = kind === 'corporate-contributors'
  const rows: LinkRow[] = s.books.flatMap(b => corp
    ? b.corporate.map((c, idx) => ({ id: `${b.id}:${idx}`, bookId: b.id, name: s.corporates.find(x => x.id === c.corpId)?.name ?? '—', role: c.role, idx }))
    : b.contributors.map((c, idx) => ({ id: `${b.id}:${idx}`, bookId: b.id, name: writerName(s, c.writerId), role: c.role, idx })))
  const book = (id: string) => s.books.find(b => b.id === id)
  const remove = async (r: LinkRow) => {
    if (!(await confirm({ title: 'Remove link', message: `Remove ${r.name} (${r.role || 'no role'}) from "${book(r.bookId)?.title}"?`, confirmLabel: 'Remove', danger: true }))) return
    set(d => ({ ...d, books: d.books.map(b => b.id !== r.bookId ? b : corp ? { ...b, corporate: b.corporate.filter((_, i) => i !== r.idx) } : { ...b, contributors: b.contributors.filter((_, i) => i !== r.idx) }) }))
    toast('Link removed', 'success')
  }
  const cols: Col<LinkRow>[] = [
    { key: 'name', header: corp ? 'Corporate entity' : 'Writer', sort: r => r.name, render: r => <span className="font-semibold">{r.name}</span> },
    { key: 'role', header: 'Role', sort: r => r.role, render: r => r.role || '—' },
    { key: 'book', header: 'Book', sort: r => book(r.bookId)?.title ?? '', render: r => <Link className="font-semibold text-brand hover:underline" to={`/staff/catalog/${r.bookId}`}>{book(r.bookId)?.title}</Link> },
  ]
  return (
    <Card flush>
      <DataTable rows={rows} columns={cols} search={r => `${r.name} ${r.role} ${book(r.bookId)?.title}`}
        empty={<EmptyState title="No links" hint="Books have no entries of this type." />}
        />
    </Card>
  )
}

function Publications() {
  const { s } = useActions()
  const cols: Col<(typeof s.books)[number]>[] = [
    { key: 'title', header: 'Title', sort: b => b.title, render: b => <span className="font-semibold">{b.title}</span> },
    { key: 'pub', header: 'Publisher', sort: b => publisherName(s, b.publisherId), render: b => publisherName(s, b.publisherId) },
    { key: 'place', header: 'Place', hideBelow: 'md', render: b => b.place || '—' },
    { key: 'year', header: 'Year', sort: b => b.year, render: b => b.year || '—' },
    { key: 'ed', header: 'Edition', hideBelow: 'lg', render: b => b.edition || '—' },
    { key: 'isbn', header: 'ISBN', hideBelow: 'lg', render: b => b.isbn || '—' },
  ]
  return (
    <Card flush>
      <DataTable rows={s.books} columns={cols} search={b => `${b.title} ${publisherName(s, b.publisherId)} ${b.isbn} ${b.place} ${b.year}`}
        actions={b => <Link to={`/staff/catalog/${b.id}`}><Btn size="sm" variant="light">Open book</Btn></Link>} />
    </Card>
  )
}

export default function Entities() {
  const { kind = '' } = useParams()
  const k = KINDS[kind]
  if (!k) return <div><PageHeader title="Catalog records" /><Card><EmptyState title="Unknown record type" hint="Choose one of the catalog record types below." action={<Switcher kind="" />} /></Card></div>
  return (
    <div>
      <PageHeader demo title={k.title} subtitle={k.subtitle} />
      <Switcher kind={kind} />
      {kind === 'contributors' || kind === 'corporate-contributors' ? <LinkTable key={kind} kind={kind} /> : kind === 'publications' ? <Publications /> : <EntityTable key={kind} kind={kind as EntKind} />}
    </div>
  )
}
