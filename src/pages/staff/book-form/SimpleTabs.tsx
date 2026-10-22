import { CATEGORIES, PROGRAMS } from '../../../lib/types'
import { Field, inputCls } from '../../../components/ui'
import TabFrame from './TabFrame'
import type { TabProps } from './model'

type P = TabProps & { onClear: () => void }
const err = (p: TabProps, k: string) => p.show && p.errors[k]

export function TitleTab(p: P) {
  const { form: f, patch } = p
  return (
    <TabFrame title="Title Proper" help="The title as it appears on the title page, with optional preferred and parallel titles." onClear={p.onClear}>
      <div className="grid gap-4">
        <Field label="Title proper" required error={err(p, 'title')} help="Include the subtitle after a colon."><input className={inputCls} value={f.title} onChange={e => patch({ title: e.target.value })} /></Field>
        <Field label="Preferred title" help="Uniform title used for filing."><input className={inputCls} value={f.preferredTitle} onChange={e => patch({ preferredTitle: e.target.value })} /></Field>
        <Field label="Parallel title" help="Title in another language, if printed on the item."><input className={inputCls} value={f.parallelTitle} onChange={e => patch({ parallelTitle: e.target.value })} /></Field>
      </div>
    </TabFrame>
  )
}

export function AccessTab(p: P) {
  const { form: f, patch } = p
  return (
    <TabFrame title="Access Point" help="Subject headings that help members find this book in the OPAC." onClear={p.onClear}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subject category" required error={err(p, 'subjectCategory')}>
          <select className={inputCls} value={f.subjectCategory} onChange={e => patch({ subjectCategory: e.target.value })}><option value="">Select category…</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Program" required error={err(p, 'program')}>
          <select className={inputCls} value={f.program} onChange={e => patch({ program: e.target.value })}><option value="">Select program…</option>{PROGRAMS.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Subject detail" className="sm:col-span-2" help="Free-text subject headings, separated by semicolons."><input className={inputCls} value={f.subjectDetail} onChange={e => patch({ subjectDetail: e.target.value })} /></Field>
      </div>
    </TabFrame>
  )
}

export function AbstractTab(p: P) {
  const { form: f, patch } = p
  return (
    <TabFrame title="Abstract & Notes" help="A short summary and the table of contents shown on the book detail page." onClear={p.onClear}>
      <div className="grid gap-4">
        <Field label="Summary" required error={err(p, 'summary')} help={`${f.summary.length} characters`}><textarea rows={5} className={inputCls} value={f.summary} onChange={e => patch({ summary: e.target.value })} /></Field>
        <Field label="Contents" help="One chapter or part per line."><textarea rows={5} className={inputCls} value={f.contents} onChange={e => patch({ contents: e.target.value })} /></Field>
      </div>
    </TabFrame>
  )
}

export const LANGUAGES = ['English', 'Filipino', 'English / Filipino', 'Spanish', 'Japanese', 'Other']
export function DescriptionTab(p: P) {
  const { form: f, patch } = p
  const t = (label: string, key: 'images' | 'dimension' | 'series' | 'volume' | 'part' | 'edition' | 'pages' | 'supplementary' | 'isbn', help?: string) => (
    <Field label={label} help={help}><input className={inputCls} value={f[key]} onChange={e => patch({ [key]: e.target.value })} /></Field>
  )
  return (
    <TabFrame title="Description" help="Physical description. Volume and part feed into the generated call number." onClear={p.onClear}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t('Images', 'images', 'e.g. illustrations, maps')}{t('Dimension', 'dimension', 'e.g. 26 cm')}{t('Pages', 'pages', 'e.g. 464 pages')}
        {t('Series', 'series')}{t('Volume', 'volume', 'Appears in call number as v.')}{t('Part', 'part', 'Appears in call number as pt.')}
        {t('Edition', 'edition')}{t('ISBN', 'isbn')}
        <Field label="Language" required error={err(p, 'language')}><select className={inputCls} value={f.language} onChange={e => patch({ language: e.target.value })}><option value="">Select…</option>{LANGUAGES.map(l => <option key={l}>{l}</option>)}</select></Field>
        <div className="sm:col-span-2 lg:col-span-3">{t('Supplementary contents', 'supplementary', 'e.g. includes bibliographical references and index')}</div>
      </div>
    </TabFrame>
  )
}
