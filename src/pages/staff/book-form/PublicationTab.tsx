import { Plus, Trash2 } from 'lucide-react'
import { Btn, Field, inputCls } from '../../../components/ui'
import type { Corporate, Publisher, Writer } from '../../../lib/types'
import TabFrame from './TabFrame'
import { newKey, type TabProps } from './model'

const ROLES = ['Author', 'Co-author', 'Editor', 'Translator', 'Illustrator', 'Compiler', 'Foreword by']
const CORP_ROLES = ['Sponsoring body', 'Issuing body', 'Organizer', 'Funding body']

export default function PublicationTab(p: TabProps & { writers: Writer[]; publishers: Publisher[]; corporates: Corporate[]; title: string; onClear: () => void }) {
  const { form: f, patch, writers, publishers, corporates } = p
  const err = (k: string) => p.show && p.errors[k]
  return (
    <TabFrame title={p.title} help="Publisher details plus the people and organizations credited on this book." onClear={p.onClear}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Publisher" required error={err('publisherId')}>
          <select className={inputCls} value={f.publisherId} onChange={e => { const pub = publishers.find(x => x.id === e.target.value); patch({ publisherId: e.target.value, place: f.place || pub?.place || '' }) }}>
            <option value="">Select publisher…</option>{publishers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Place of publication" help="Filled from the publisher when empty."><input className={inputCls} value={f.place} onChange={e => patch({ place: e.target.value })} /></Field>
        <Field label="Publication year" required error={err('year')} help="Used in the call number."><input className={inputCls} inputMode="numeric" maxLength={4} value={f.year} onChange={e => patch({ year: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>

      <h4 className="mb-2 mt-6 text-sm font-extrabold uppercase tracking-wide text-brand">Individual contributors</h4>
      {err('contributors') && <p className="mb-2 text-sm font-semibold text-red-700">{err('contributors')}</p>}
      <div className="space-y-2">
        {f.contributors.map(c => (
          <div key={c.key} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]" data-testid="contributor-row">
            <select aria-label="Writer" className={inputCls} value={c.writerId} onChange={e => patch({ contributors: f.contributors.map(x => x.key === c.key ? { ...x, writerId: e.target.value } : x) })}><option value="">Select writer…</option>{writers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
            <select aria-label="Role" className={inputCls} value={c.role} onChange={e => patch({ contributors: f.contributors.map(x => x.key === c.key ? { ...x, role: e.target.value } : x) })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
            <Btn variant="ghost" icon={<Trash2 size={14} />} aria-label="Remove contributor" onClick={() => patch({ contributors: f.contributors.filter(x => x.key !== c.key) })} />
          </div>
        ))}
      </div>
      <Btn size="sm" variant="light" className="mt-2" icon={<Plus size={14} />} onClick={() => patch({ contributors: [...f.contributors, { key: newKey(), writerId: '', role: 'Co-author' }] })}>Add contributor</Btn>

      <h4 className="mb-2 mt-6 text-sm font-extrabold uppercase tracking-wide text-brand">Corporate contributors</h4>
      <div className="space-y-2">
        {f.corporate.length === 0 && <p className="text-sm text-mute">None added.</p>}
        {f.corporate.map(c => (
          <div key={c.key} className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
            <select aria-label="Corporate entity" className={inputCls} value={c.corpId} onChange={e => patch({ corporate: f.corporate.map(x => x.key === c.key ? { ...x, corpId: e.target.value } : x) })}><option value="">Select entity…</option>{corporates.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
            <select aria-label="Corporate role" className={inputCls} value={c.role} onChange={e => patch({ corporate: f.corporate.map(x => x.key === c.key ? { ...x, role: e.target.value } : x) })}>{CORP_ROLES.map(r => <option key={r}>{r}</option>)}</select>
            <Btn variant="ghost" icon={<Trash2 size={14} />} aria-label="Remove corporate contributor" onClick={() => patch({ corporate: f.corporate.filter(x => x.key !== c.key) })} />
          </div>
        ))}
      </div>
      <Btn size="sm" variant="light" className="mt-2" icon={<Plus size={14} />} onClick={() => patch({ corporate: [...f.corporate, { key: newKey(), corpId: '', role: 'Sponsoring body' }] })}>Add corporate contributor</Btn>
    </TabFrame>
  )
}
