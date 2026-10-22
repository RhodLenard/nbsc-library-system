import type { Book, Copy, CopyStatus } from '../../../lib/types'
import { today } from '../../../lib/types'
import { buildCallNo, generateAccessions } from '../../../lib/accession'

export const DUP_MSG = 'This accession number is already in use by another book.'
export type TabId = 'title' | 'access' | 'abstract' | 'description' | 'local' | 'pub' | 'copies'
export interface Group { id: string; start: string; count: string; edition: string; location: string }
export interface FormCopy { id: string; accession: string; copyNo: number; edition: string; location: string; status: CopyStatus; callNo: string }
export interface Contrib { key: string; writerId: string; role: string }
export interface CorpContrib { key: string; corpId: string; role: string }
export interface FormState {
  title: string; preferredTitle: string; parallelTitle: string
  subjectCategory: string; program: string; subjectDetail: string
  summary: string; contents: string
  images: string; dimension: string; series: string; volume: string; part: string; edition: string; pages: string; supplementary: string; isbn: string; language: string
  callBase: string; shelfLocation: string; contentType: string; mediaType: string; carrierType: string
  publisherId: string; place: string; year: string
  contributors: Contrib[]; corporate: CorpContrib[]
  groups: Group[]; copies: FormCopy[]
}
export type Errors = Record<string, string>
export type Patch = (p: Partial<FormState>) => void
export interface TabProps { form: FormState; patch: Patch; errors: Errors; show: boolean }

export const TAB_META: Record<TabId, { label: string; recommended: (keyof FormState)[] }> = {
  title: { label: 'Title Proper', recommended: ['preferredTitle'] },
  access: { label: 'Access Point', recommended: ['subjectDetail'] },
  abstract: { label: 'Abstract & Notes', recommended: ['contents'] },
  description: { label: 'Description', recommended: ['dimension', 'edition', 'isbn'] },
  local: { label: 'Local Information', recommended: [] },
  pub: { label: 'Publication', recommended: ['place'] },
  copies: { label: 'Individual Copies', recommended: [] },
}
export const ADD_TABS: TabId[] = ['title', 'access', 'abstract', 'description', 'local', 'pub']
export const EDIT_TABS: TabId[] = ['title', 'access', 'abstract', 'description', 'local', 'pub', 'copies']

let k = 0
export const newKey = () => 'k' + ++k + Math.random().toString(36).slice(2, 5)
export const newGroup = (): Group => ({ id: newKey(), start: '', count: '1', edition: '', location: '' })

export const emptyForm = (): FormState => ({
  title: '', preferredTitle: '', parallelTitle: '', subjectCategory: '', program: '', subjectDetail: '', summary: '', contents: '',
  images: '', dimension: '', series: '', volume: '', part: '', edition: '', pages: '', supplementary: '', isbn: '', language: 'English',
  callBase: '', shelfLocation: '', contentType: 'text', mediaType: 'unmediated', carrierType: 'volume',
  publisherId: '', place: '', year: '', contributors: [{ key: newKey(), writerId: '', role: 'Author' }], corporate: [],
  groups: [newGroup()], copies: [],
})

export function formFromBook(b: Book, copies: Copy[]): FormState {
  const { id: _i, addedOn: _a, contributors, corporate, ...rest } = b
  return {
    ...emptyForm(), ...rest,
    contributors: contributors.map(c => ({ ...c, key: newKey() })), corporate: corporate.map(c => ({ ...c, key: newKey() })),
    groups: [], copies: copies.map(c => ({ id: c.id, accession: c.accession, copyNo: c.copyNo, edition: c.edition, location: c.location, status: c.status, callNo: c.callNo })),
  }
}

export const callNoFor = (f: FormState, copyNo: number, loc?: string) =>
  buildCallNo({ shelf: loc || f.shelfLocation, callBase: f.callBase, year: f.year, volume: f.volume, part: f.part, copyNo })

/** Copies the accession groups would create, with copy numbers continuing after existing copies. */
export function planCopies(f: FormState): (FormCopy & { groupId: string })[] {
  let n = f.copies.reduce((m, c) => Math.max(m, c.copyNo), 0)
  return f.groups.flatMap(g => generateAccessions(g.start, Number(g.count) || 0).map(accession => {
    n += 1
    return { id: 'new-' + g.id + '-' + n, groupId: g.id, accession, copyNo: n, edition: g.edition || f.edition, location: g.location || f.shelfLocation, status: 'Available' as CopyStatus, callNo: callNoFor(f, n, g.location) }
  }))
}

export function tabOf(key: string): TabId {
  if (key === 'title') return 'title'
  if (key === 'subjectCategory' || key === 'program') return 'access'
  if (key === 'summary') return 'abstract'
  if (key === 'language') return 'description'
  if (key === 'shelfLocation' || key === 'callBase' || key.startsWith('g.') || key === 'groups') return 'local'
  if (key.startsWith('c.')) return 'copies'
  return 'pub'
}

export function validate(f: FormState, mode: 'add' | 'edit', existing: Set<string>, originalAccessions = new Set<string>()): { errors: Errors; dups: Set<string> } {
  const e: Errors = {}
  const req = (key: keyof FormState, msg: string) => { if (!String(f[key]).trim()) e[key] = msg }
  req('title', 'Title proper is required')
  // A migrated legacy record may legitimately lack catalog metadata. Keep
  // those gaps editable but do not make them block a normal v2 edit.
  if (mode === 'add') {
    req('subjectCategory', 'Choose a subject category'); req('program', 'Choose a program')
    req('summary', 'A summary is required'); req('language', 'Language is required')
    req('shelfLocation', 'Shelf location is required'); req('callBase', 'Classification / call number base is required')
    req('publisherId', 'Choose a publisher')
    if (!/^\d{4}$/.test(f.year.trim())) e.year = 'Enter a four-digit publication year'
    if (!f.contributors.some(c => c.writerId)) e.contributors = 'Add at least one individual contributor'
  }

  const planned = planCopies(f)
  const all = [...f.copies.map(c => c.accession.trim()), ...planned.map(c => c.accession)].filter(Boolean)
  const count: Record<string, number> = {}
  all.forEach(a => { count[a] = (count[a] ?? 0) + 1 })
  // Original legacy accessions can be duplicated. Permit an unchanged value
  // on edit, but keep collisions blocked for new or changed accessions.
  const dups = new Set(all.filter(a => count[a] > 1 || (existing.has(a) && !(mode === 'edit' && originalAccessions.has(a)))))

  if (mode === 'add' && f.groups.length === 0) e.groups = 'Add at least one accession group'
  f.groups.forEach(g => {
    if (!g.start.trim()) e[`g.${g.id}.start`] = 'Starting accession is required'
    const n = Number(g.count)
    if (!g.count.trim() || !Number.isInteger(n) || n < 1 || n > 999) e[`g.${g.id}.count`] = 'Enter a number of copies from 1 to 999'
    if (!e[`g.${g.id}.start`] && generateAccessions(g.start, n).some(a => dups.has(a))) e[`g.${g.id}.start`] = DUP_MSG
  })
  f.copies.forEach(c => {
    if (!c.accession.trim()) e[`c.${c.id}.accession`] = 'Accession is required'
    else if (dups.has(c.accession.trim())) e[`c.${c.id}.accession`] = DUP_MSG
    if (!c.location.trim()) e[`c.${c.id}.location`] = 'Location is required'
  })
  return { errors: e, dups }
}

export function tabErrors(errors: Errors, tab: TabId) { return Object.keys(errors).filter(k => tabOf(k) === tab) }
export function tabStatus(f: FormState, errors: Errors, tab: TabId): 'red' | 'yellow' | 'green' {
  if (tabErrors(errors, tab).length) return 'red'
  return TAB_META[tab].recommended.every(r => String(f[r]).trim()) ? 'green' : 'yellow'
}

export function clearTab(tab: TabId, f: FormState): Partial<FormState> {
  const e = emptyForm()
  switch (tab) {
    case 'title': return { title: '', preferredTitle: '', parallelTitle: '' }
    case 'access': return { subjectCategory: '', program: '', subjectDetail: '' }
    case 'abstract': return { summary: '', contents: '' }
    case 'description': return { images: '', dimension: '', series: '', volume: '', part: '', edition: '', pages: '', supplementary: '', isbn: '', language: '' }
    case 'local': return { callBase: '', shelfLocation: '', contentType: e.contentType, mediaType: e.mediaType, carrierType: e.carrierType, groups: f.copies.length ? [] : [newGroup()] }
    case 'pub': return { publisherId: '', place: '', year: '', contributors: e.contributors, corporate: [] }
    case 'copies': return {}
  }
}

export function toBook(f: FormState, id: string, addedOn = today()): Book {
  return {
    id, addedOn,
    title: f.title.trim(), preferredTitle: f.preferredTitle, parallelTitle: f.parallelTitle, subjectCategory: f.subjectCategory, program: f.program, subjectDetail: f.subjectDetail,
    summary: f.summary, contents: f.contents, coverImage: '', images: f.images, dimension: f.dimension, series: f.series, volume: f.volume, part: f.part, edition: f.edition, pages: f.pages,
    supplementary: f.supplementary, isbn: f.isbn, language: f.language, callBase: f.callBase, shelfLocation: f.shelfLocation, contentType: f.contentType, mediaType: f.mediaType,
    carrierType: f.carrierType, publisherId: f.publisherId, place: f.place, year: f.year,
    contributors: f.contributors.filter(c => c.writerId).map(({ writerId, role }) => ({ writerId, role })),
    corporate: f.corporate.filter(c => c.corpId).map(({ corpId, role }) => ({ corpId, role })),
  }
}
