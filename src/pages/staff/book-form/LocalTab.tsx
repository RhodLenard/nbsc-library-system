import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { SHELVES } from '../../../lib/types'
import { generateAccessions } from '../../../lib/accession'
import { Btn, Field, cx, inputCls } from '../../../components/ui'
import TabFrame from './TabFrame'
import { DUP_MSG, callNoFor, newGroup, planCopies, type TabProps } from './model'

const CONTENT = ['text', 'still image', 'cartographic image', 'notated music', 'computer program', 'performed music']
const MEDIA = ['unmediated', 'computer', 'microform', 'video', 'audio']
const CARRIER = ['volume', 'online resource', 'computer disc', 'sheet', 'audio disc']

export default function LocalTab(p: TabProps & { dups: Set<string>; mode: 'add' | 'edit'; onClear: () => void }) {
  const { form: f, patch, dups, mode } = p
  const err = (k: string) => p.show && p.errors[k]
  const planned = planCopies(f)
  const setGroup = (id: string, v: Partial<typeof f.groups[number]>) => patch({ groups: f.groups.map(g => g.id === id ? { ...g, ...v } : g) })
  const sel = (label: string, key: 'contentType' | 'mediaType' | 'carrierType', opts: string[]) => (
    <Field label={label}><select className={inputCls} value={f[key]} onChange={e => patch({ [key]: e.target.value })}>{opts.map(o => <option key={o}>{o}</option>)}</select></Field>
  )
  return (
    <TabFrame title="Local Information" help="Where the book lives in this library: shelf, call number, and the accession numbers for each physical copy." onClear={p.onClear}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Shelf location" required error={err('shelfLocation')}>
          <input list="shelves" className={inputCls} value={f.shelfLocation} onChange={e => patch({ shelfLocation: e.target.value })} placeholder="e.g. CIRC-A1" />
          <datalist id="shelves">{SHELVES.map(s => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Classification / call number base" required error={err('callBase')} help="e.g. QA76.73 .J38 R43"><input className={inputCls} value={f.callBase} onChange={e => patch({ callBase: e.target.value })} /></Field>
        {sel('Content type', 'contentType', CONTENT)}{sel('Media type', 'mediaType', MEDIA)}{sel('Carrier type', 'carrierType', CARRIER)}
      </div>

      <section className="mt-6 rounded-lg border border-line" aria-labelledby="acc-h">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50 px-4 py-3">
          <div>
            <h4 id="acc-h" className="text-sm font-extrabold uppercase tracking-wide text-brand">Accession Numbers &amp; Call Numbers</h4>
            <p className="text-xs text-mute">{mode === 'add' ? 'Enter a starting accession and the number of copies. Consecutive values are generated, keeping leading zeros.' : 'Add more copies here. Existing copies are edited on the Individual Copies tab.'}</p>
          </div>
          <Btn size="sm" variant="light" icon={<Plus size={14} />} onClick={() => patch({ groups: [...f.groups, newGroup()] })}>Add Another Accession Group</Btn>
        </header>
        <div className="space-y-4 p-4">
          {err('groups') && <p className="text-sm font-semibold text-red-700">{err('groups')}</p>}
          {f.groups.length === 0 && <p className="text-sm text-mute">No new copies queued.</p>}
          {f.groups.map((g, i) => {
            const accs = generateAccessions(g.start, Number(g.count) || 0)
            const mine = planned.filter(c => c.groupId === g.id)
            return (
              <div key={g.id} className="rounded-md border border-line p-3" data-testid="accession-group">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Group {i + 1}</span>
                  {(f.groups.length > 1 || mode === 'edit') && <Btn size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => patch({ groups: f.groups.filter(x => x.id !== g.id) })} aria-label={`Remove group ${i + 1}`}>Remove</Btn>}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Starting accession" required error={err(`g.${g.id}.start`)}><input className={cx(inputCls, err(`g.${g.id}.start`) && 'border-red-500 bg-red-50')} value={g.start} onChange={e => setGroup(g.id, { start: e.target.value })} placeholder="0001" /></Field>
                  <Field label="Number of copies" required error={err(`g.${g.id}.count`)}><input type="number" min={1} max={999} className={inputCls} value={g.count} onChange={e => setGroup(g.id, { count: e.target.value })} /></Field>
                  <Field label="Variant / edition" help="Optional"><input className={inputCls} value={g.edition} onChange={e => setGroup(g.id, { edition: e.target.value })} /></Field>
                  <Field label="Location override" help="Optional"><input className={inputCls} value={g.location} onChange={e => setGroup(g.id, { location: e.target.value })} /></Field>
                </div>
                {accs.length > 0 && (
                  <div className="mt-3" aria-live="polite">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Generated accessions ({accs.length})</div>
                    <div className="flex flex-wrap gap-1.5">
                      {accs.slice(0, 40).map(a => <span key={a} className={cx('rounded border px-2 py-0.5 font-mono text-xs font-medium', dups.has(a) ? 'border-red-400 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800')}>{a}</span>)}
                      {accs.length > 40 && <span className="px-1 text-xs text-mute">+{accs.length - 40} more</span>}
                    </div>
                    {accs.some(a => dups.has(a)) && <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-700"><AlertCircle size={14} />{DUP_MSG}</p>}
                  </div>
                )}
                {mine.length > 0 && <p className="mt-2 text-xs text-mute">Call numbers: <span className="font-mono">{mine[0].callNo}</span>{mine.length > 1 && <> … <span className="font-mono">{mine[mine.length - 1].callNo}</span></>}</p>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-6" aria-label="Copy previews">
        <div className="mb-2 flex items-baseline justify-between"><h4 className="text-sm font-extrabold uppercase tracking-wide text-brand">Individual copy preview</h4><span className="text-xs text-mute">{planned.length} new cop{planned.length === 1 ? 'y' : 'ies'}</span></div>
        <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">Call number = shelf location + base + publication year ({f.year || '—'}) + volume ({f.volume || '—'}) + part ({f.part || '—'}) + copy number. Example: <span className="font-mono font-bold text-ink">{callNoFor(f, 1) || '—'}</span></div>
        {planned.length === 0 ? <p className="text-sm text-mute">Enter an accession group to preview copies.</p> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {planned.slice(0, 30).map(c => (
              <div key={c.id} className={cx('rounded-md border p-3 text-xs', dups.has(c.accession) ? 'border-red-300 bg-red-50' : 'border-line bg-white')} data-testid="copy-card">
                <div className="flex items-center justify-between"><span className="font-mono text-sm font-bold">{c.accession}</span><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{c.status}</span></div>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-600"><dt>Copy</dt><dd className="font-bold text-ink">c.{c.copyNo}</dd><dt>Location</dt><dd>{c.location || '—'}</dd><dt>Call no.</dt><dd className="break-all font-mono">{c.callNo}</dd></dl>
              </div>
            ))}
          </div>
        )}
        {planned.length > 30 && <p className="mt-2 text-xs text-mute">Showing the first 30 of {planned.length} copies.</p>}
      </section>
    </TabFrame>
  )
}
