export type Role = 'Admin' | 'Librarian' | 'Student Assistant' | 'Member'
export type CopyStatus = 'Available' | 'Borrowed' | 'Reserved' | 'Lost' | 'Damaged' | 'Replaced'

export interface Writer { id: string; name: string; born: string; notes: string }
export interface Publisher { id: string; name: string; place: string }
export interface Corporate { id: string; name: string; kind: string }

export interface Book {
  id: string
  title: string; preferredTitle: string; parallelTitle: string
  subjectCategory: string; program: string; subjectDetail: string
  summary: string; contents: string
  coverImage: string
  images: string; dimension: string; series: string; volume: string; part: string
  edition: string; pages: string; supplementary: string; isbn: string; language: string
  callBase: string; shelfLocation: string; contentType: string; mediaType: string; carrierType: string
  publisherId: string; place: string; year: string
  contributors: { writerId: string; role: string }[]
  corporate: { corpId: string; role: string }[]
  addedOn: string
}
export interface Copy {
  id: string; bookId: string; accession: string; copyNo: number
  edition: string; location: string; status: CopyStatus; callNo: string
}
export interface Member {
  id: string; idNo: string; name: string; email: string; program: string
  type: 'Student' | 'Faculty' | 'Staff'; status: 'Active' | 'Inactive'; joined: string; phone: string
}
export interface StaffAccount { id: string; employeeId?: string; name: string; email: string; role: Exclude<Role, 'Member'>; status: 'Active' | 'Inactive'; lastLogin: string }
export interface Loan { id: string; copyId: string; memberId: string; borrowed: string; due: string; returned: string | null }
export interface Reservation {
  id: string; memberId: string; bookId: string; copyId: string | null
  status: 'Pending' | 'Ready' | 'Received' | 'Cancelled'; date: string; readyUntil: string | null
}
export interface Fine { id: string; loanId: string; memberId: string; amount: number; days: number; paid: boolean; paidOn: string | null; method: string | null }
export interface Incident { id: string; copyId: string; memberId: string | null; type: 'Lost' | 'Damaged'; status: 'Unreplaced' | 'Replaced'; date: string }
export interface Message { id: string; fromId: string; toId: string; subject: string; body: string; date: string; read: boolean }
export interface Visit { id: string; memberId: string; inAt: string; outAt: string | null }
export interface Notice { id: string; toId: string; text: string; date: string; read: boolean; kind: 'loan' | 'reservation' | 'fine' | 'system' }
export interface Activity { id: string; actor: string; text: string; date: string }
export interface Backup { id: string; name: string; date: string; size: string; status: 'Completed' | 'Failed' | 'Running'; kind: 'Automatic' | 'Manual' }
export interface Session { role: Role; userId: string }

export interface State {
  v: number
  session: Session | null
  books: Book[]; copies: Copy[]
  writers: Writer[]; publishers: Publisher[]; corporates: Corporate[]
  members: Member[]; staff: StaffAccount[]
  loans: Loan[]; reservations: Reservation[]; fines: Fine[]; incidents: Incident[]
  messages: Message[]; visits: Visit[]; notices: Notice[]; activity: Activity[]; backups: Backup[]
  carts: Record<string, string[]>
}

export const RULES = { loanDays: 7, maxItems: 3, finePerDay: 5, readyHours: 48 }
export const PROGRAMS = ['BSCS', 'BSA', 'BSAIS', 'BSE', 'BSTM'] as const
export const CATEGORIES = ['Computer Science', 'Education', 'Business', 'Nursing', 'Engineering', 'Literature', 'Science', 'Mathematics', 'Philippine Studies']
export const SHELVES = ['CIRC-A1', 'CIRC-A2', 'CIRC-B1', 'REF-01', 'FIL-02', 'RES-03', 'RES-04']
export const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const d0 = (o = 0) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10) }
export const today = () => d0(0)
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 864e5)
export const fmtDate = (iso?: string | null) => iso ? new Date(iso.length === 10 ? iso + 'T00:00:00' : iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
export const fmtDateTime = (iso?: string | null) => iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8)
export const isOverdue = (l: Loan) => !l.returned && l.due < today()
