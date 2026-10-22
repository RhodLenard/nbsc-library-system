import { RefreshCw, Save, Trash2 } from 'lucide-react'
import { Btn, EmptyState, cx, inputCls } from '../../../components/ui'
import TabFrame from './TabFrame'
import { callNoFor, type TabProps } from './model'
import type { CopyStatus } from '../../../lib/types'

const STATUSES: CopyStatus[] = ['Available', 'Borrowed', 'Reserved', 'Lost', 'Damaged', 'Replaced']

export default function CopiesTab({ form: f, patch, errors, show, onSaveStatuses }: TabProps & { onSaveStatuses?: () => void }) {
  const upd = (id: string, v: object) => patch({ copies: f.copies.map(c => c.id === id ? { ...c, ...v } : c) })
  return (
    <TabFrame title="Individual Copies" help="Edit each physical copy. New copies are added from Local Information.">
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {onSaveStatuses && <Btn size="sm" icon={<Save size={13} />} onClick={onSaveStatuses}>Save copy status</Btn>}
        <Btn size="sm" variant="light" icon={<RefreshCw size={13} />} onClick={() => patch({ copies: f.copies.map(c => ({ ...c, callNo: callNoFor(f, c.copyNo, c.location) })) })}>Regenerate call numbers</Btn>
      </div>
      {onSaveStatuses && <p className="mb-3 text-xs text-mute">Saves only each copy’s availability status. Missing details or accession warnings in other tabs will not block this action.</p>}
      {f.copies.length === 0 ? <EmptyState title="No copies" hint="Add an accession group in Local Information." /> : (
        <div className="scroll-thin overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500"><tr>{['Accession', 'Copy no.', 'Edition', 'Location', 'Status', 'Call number', ''].map(h => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {f.copies.map(c => {
                const ea = show && errors[`c.${c.id}.accession`]
                return (
                  <tr key={c.id} data-testid="copy-row" className="align-top">
                    <td className="px-3 py-2"><input aria-label="Accession" className={cx(inputCls, 'w-32 font-mono', ea && 'border-red-500 bg-red-50')} value={c.accession} onChange={e => upd(c.id, { accession: e.target.value })} />{ea && <div className="mt-1 max-w-[12rem] text-[11px] font-semibold text-red-700">{ea}</div>}</td>
                    <td className="px-3 py-2"><input aria-label="Copy number" type="number" min={1} className={cx(inputCls, 'w-20')} value={c.copyNo} onChange={e => upd(c.id, { copyNo: Number(e.target.value) })} /></td>
                    <td className="px-3 py-2"><input aria-label="Edition" className={cx(inputCls, 'w-28')} value={c.edition} onChange={e => upd(c.id, { edition: e.target.value })} /></td>
                    <td className="px-3 py-2"><input aria-label="Location" className={cx(inputCls, 'w-28')} value={c.location} onChange={e => upd(c.id, { location: e.target.value })} /></td>
                    <td className="px-3 py-2"><select aria-label="Status" className={cx(inputCls, 'w-40')} value={c.status} onChange={e => upd(c.id, { status: e.target.value as CopyStatus })}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                    <td className="px-3 py-2"><input aria-label="Call number" className={cx(inputCls, 'w-64 font-mono text-xs')} value={c.callNo} onChange={e => upd(c.id, { callNo: e.target.value })} /></td>
                    <td className="px-3 py-2"><Btn variant="ghost" size="sm" aria-label="Remove copy" icon={<Trash2 size={14} />} disabled={c.status === 'Borrowed'} title={c.status === 'Borrowed' ? 'On loan — cannot remove' : 'Remove copy'} onClick={() => patch({ copies: f.copies.filter(x => x.id !== c.id) })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TabFrame>
  )
}
