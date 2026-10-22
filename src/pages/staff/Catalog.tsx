import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Download, Eye, FileUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { availableOf, bookAuthors, copiesOf, publisherName, useActions } from '../../lib/actions'
import { Btn, Card, CoverArt, DataTable, Modal, PageHeader, inputCls, useConfirm, Badge } from '../../components/ui'
import { type Book } from '../../lib/types'
import { download } from '../../lib/api'

export default function Catalog() {
  const a = useActions()
  const { s } = a
  const nav = useNavigate()
  const confirm = useConfirm()
  const [cat, setCat] = useState('')
  const [prog, setProg] = useState('')
  const [avail, setAvail] = useState('')
  const [exp, setExp] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv')
  const categories = useMemo(() => [...new Set(s.books.map(book => book.subjectCategory.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [s.books])
  const programs = useMemo(() => [...new Set(s.books.map(book => book.program.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [s.books])
  const canDelete = false
  const rows = s.books.filter(b => (!cat || b.subjectCategory === cat) && (!prog || b.program === prog) && (!avail || (avail === 'yes' ? availableOf(s, b.id) > 0 : availableOf(s, b.id) === 0)))
  const del = async (ids: string[], clear?: () => void) => {
    if (await confirm({ title: `Delete ${ids.length} book(s)?`, message: 'All copies of the selected books will be removed.', confirmLabel: 'Delete', danger: true })) { a.deleteBooks(ids); clear?.() }
  }
  return (
    <div>
      <PageHeader title="Books" subtitle={`${s.books.length} titles · ${s.copies.length} copies`} demo
        actions={<><Link to="/staff/import/books"><Btn variant="light" icon={<FileUp size={15} />}>Import</Btn></Link><Btn variant="light" icon={<Download size={15} />} onClick={() => setExp(true)}>Export</Btn><Link to="/staff/catalog/add"><Btn icon={<Plus size={15} />}>Add Book</Btn></Link></>} />
      <Card flush>
        <DataTable<Book> rows={rows} selectable pageSize={8} onRowClick={b => nav(`/staff/catalog/${b.id}`)}
          search={b => [b.title, bookAuthors(s, b), b.isbn, ...copiesOf(s, b.id).map(c => c.accession)].join(' ')}
          filters={<>
            <select aria-label="Category" className={inputCls + ' w-auto'} value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select>
            <select aria-label="Program" className={inputCls + ' w-auto'} value={prog} onChange={e => setProg(e.target.value)}><option value="">All programs</option>{programs.map(program => <option key={program}>{program}</option>)}</select>
            <select aria-label="Availability" className={inputCls + ' w-auto'} value={avail} onChange={e => setAvail(e.target.value)}><option value="">Any availability</option><option value="yes">Has available copies</option><option value="no">None available</option></select>
          </>}
          bulk={(ids, clear) => canDelete && <Btn size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => del(ids, clear)}>Delete</Btn>}
          columns={[
            { key: 'title', header: 'Title', sort: b => b.title, render: b => (
              <div className="flex items-center gap-3"><CoverArt book={b} className="hidden !h-12 !w-9 shrink-0 sm:block" /><div className="min-w-0"><div className="font-bold text-ink">{b.title}</div><div className="text-xs text-mute">{bookAuthors(s, b)}</div></div></div>) },
            { key: 'cat', header: 'Category', hideBelow: 'md', render: b => <div><div className="text-sm">{b.subjectCategory}</div><div className="text-xs text-mute">{b.program}</div></div> },
            { key: 'pub', header: 'Publisher', hideBelow: 'lg', sort: b => b.year, render: b => <div><div className="text-sm">{publisherName(s, b.publisherId)}</div><div className="text-xs text-mute">{b.year}</div></div> },
            { key: 'acc', header: 'Accession', hideBelow: 'lg', render: b => { const c = copiesOf(s, b.id); return <span className="font-mono text-xs">{c[0]?.accession}{c.length > 1 && `–${c[c.length - 1].accession}`}</span> } },
            { key: 'avail', header: 'Copies', sort: b => availableOf(s, b.id), render: b => { const n = availableOf(s, b.id); const t = copiesOf(s, b.id).length; return <Badge tone={n ? 'green' : 'red'}>{n} / {t} available</Badge> } },
          ]}
          actions={b => <>
            <Link to={`/staff/catalog/${b.id}`}><Btn size="sm" variant="light" aria-label="View" icon={<Eye size={13} />} /></Link>
            <Link to={`/staff/catalog/${b.id}/edit`}><Btn size="sm" variant="light" aria-label="Edit" icon={<Pencil size={13} />} /></Link>
            {canDelete && <Btn size="sm" variant="light" aria-label="Delete" className="text-brand" icon={<Trash2 size={13} />} onClick={() => del([b.id])} />}
          </>} />
      </Card>
      <Modal open={exp} onClose={() => setExp(false)} title="Export catalog" size="sm" footer={<><Btn variant="light" onClick={() => setExp(false)}>Close</Btn><Btn onClick={() => { void download(`/catalog/export?format=${exportFormat}`, `catalog-export.${exportFormat}`).then(() => { setExp(false); a.toast('Catalog export downloaded', 'success') }).catch(error => a.toast(error instanceof Error ? error.message : 'Export failed.', 'error')) }}>Download</Btn></>}>
        <p className="mb-3 text-sm text-mute">Exports {rows.length} filtered titles with accession and copy numbers.</p>
        <select className={inputCls} value={exportFormat} onChange={event => setExportFormat(event.target.value as 'csv' | 'xlsx')}><option value="csv">CSV (.csv)</option><option value="xlsx">Excel (.xlsx)</option></select>
      </Modal>
    </div>
  )
}
