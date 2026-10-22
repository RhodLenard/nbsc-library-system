import { useState } from 'react'
import { Check, Minus, Pencil, Plus, Power } from 'lucide-react'
import { Badge, Btn, Card, DataTable, Field, Modal, PageHeader, Status, inputCls, useConfirm, type Col, type Tone } from '../../components/ui'
import { useActions } from '../../lib/actions'
import { staffNav } from '../../lib/nav'
import { fmtDateTime, type StaffAccount } from '../../lib/types'

const ROLES: StaffAccount['role'][] = ['Admin', 'Librarian', 'Student Assistant']
const roleTone: Record<string, Tone> = { Admin: 'red', Librarian: 'blue', 'Student Assistant': 'yellow' }
type StaffForm = StaffAccount & { password: string }
const blank = (): StaffForm => ({ id: '', employeeId: '', name: '', email: '', role: 'Librarian', status: 'Active', lastLogin: '', password: '' })

const areas: [string, string[]][] = [
  ['Dashboard', ['/staff']], ['Catalog', ['/staff/catalog']], ['Members', ['/staff/members']],
  ['Circulation', ['/staff/issued']], ['Reports', ['/staff/reports']], ['Backups', ['/staff/backups']], ['Admin accounts', ['/staff/admins']],
]
const can = (role: string, paths: string[]) => staffNav.some(g => g.items.some(i => paths.includes(i.to) && (i.roles as string[]).includes(role)))

export default function Admins() {
  const { s, toast, upsertStaff } = useActions()
  const confirm = useConfirm()
  const me = s.session!.userId
  const [edit, setEdit] = useState<StaffForm | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})

  const save = async () => {
    if (!edit) return
    const e: Record<string, string> = {}
    if (!(edit.employeeId ?? '').trim()) e.employeeId = 'Employee ID is required.'
    if (!edit.name.trim()) e.name = 'Name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edit.email.trim())) e.email = 'Enter a valid email address.'
    else if (s.staff.some(x => x.id !== edit.id && x.email.toLowerCase() === edit.email.trim().toLowerCase())) e.email = 'This email is already used.'
    if (edit.id === me && edit.status === 'Inactive') e.status = 'You cannot deactivate your own account.'
    if (!edit.id && edit.password.length < 12) e.password = 'Initial password must be at least 12 characters.'
    setErrs(e)
    if (Object.keys(e).length) return
    if (await upsertStaff({ ...edit, employeeId: (edit.employeeId ?? '').trim(), name: edit.name.trim(), email: edit.email.trim(), lastLogin: edit.lastLogin || new Date().toISOString() })) setEdit(null)
  }
  const toggle = async (a: StaffAccount) => {
    if (a.id === me) return toast('You cannot deactivate your own account.', 'error')
    const st = a.status === 'Active' ? 'Inactive' : 'Active'
    if (await confirm({ title: `${st === 'Active' ? 'Activate' : 'Deactivate'} account`, message: `${st === 'Active' ? 'Activate' : 'Deactivate'} ${a.name}?`, danger: st === 'Inactive' })) await upsertStaff({ ...a, status: st })
  }

  const cols: Col<StaffAccount>[] = [
    { key: 'name', header: 'Name', sort: a => a.name, render: a => <div><div className="font-semibold">{a.name}{a.id === me && <span className="ml-1.5 text-xs font-bold text-brand">(you)</span>}</div><div className="text-xs text-mute">{a.email}</div></div> },
    { key: 'role', header: 'Role', sort: a => a.role, render: a => <Badge tone={roleTone[a.role]}>{a.role}</Badge> },
    { key: 'status', header: 'Status', render: a => <Status value={a.status} /> },
    { key: 'last', header: 'Last login', hideBelow: 'md', sort: a => a.lastLogin, render: a => fmtDateTime(a.lastLogin) },
  ]
  const f = (k: keyof StaffAccount, v: string) => setEdit(e => e && { ...e, [k]: v })

  return (
    <div className="space-y-4">
      <PageHeader demo title="Admin Accounts" subtitle="Staff accounts and their roles." />
      <Card flush>
        <DataTable rows={s.staff} columns={cols} search={a => `${a.name} ${a.email} ${a.role}`}
          toolbarRight={<Btn icon={<Plus size={15} />} onClick={() => { setErrs({}); setEdit(blank()) }}>Add Account</Btn>}
          actions={a => <>
            <Btn size="sm" variant="light" aria-label="Edit" title="Edit" icon={<Pencil size={13} />} onClick={() => { setErrs({}); setEdit({ ...a, password: '' }) }} />
            <Btn size="sm" variant="light" aria-label="Toggle status" title={a.status === 'Active' ? 'Deactivate' : 'Activate'} icon={<Power size={13} />} onClick={() => toggle(a)} />
          </>} />
      </Card>

      <Card title="Role permissions" flush>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-2.5">Area</th>{ROLES.map(r => <th key={r} className="px-4 py-2.5 text-center">{r}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {areas.map(([label, paths]) => (
                <tr key={label}>
                  <td className="px-4 py-2.5 font-semibold">{label}</td>
                  {ROLES.map(r => <td key={r} className="px-4 py-2.5 text-center">{can(r, paths) ? <Check size={16} className="mx-auto text-emerald-600" aria-label="Allowed" /> : <Minus size={16} className="mx-auto text-slate-300" aria-label="Not allowed" />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit Account' : 'Add Account'} footer={<><Btn variant="light" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save account</Btn></>}>
        {edit && (
          <form onSubmit={e => { e.preventDefault(); save() }} className="grid grid-cols-1 gap-3">
            <Field label="Employee ID" required error={errs.employeeId}><input className={inputCls} value={edit.employeeId} onChange={e => f('employeeId', e.target.value)} /></Field>
            <Field label="Full name" required error={errs.name}><input className={inputCls} value={edit.name} onChange={e => f('name', e.target.value)} /></Field>
            <Field label="Email" required error={errs.email}><input className={inputCls} type="email" value={edit.email} onChange={e => f('email', e.target.value)} /></Field>
            <Field label={edit.id ? 'New password (optional)' : 'Initial password'} required={!edit.id} error={errs.password}><input className={inputCls} type="password" autoComplete="new-password" value={edit.password} onChange={e => setEdit(x => x && { ...x, password: e.target.value })} /></Field>
            <Field label="Role"><select className={inputCls} value={edit.role} onChange={e => f('role', e.target.value)}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Status" error={errs.status}><select className={inputCls} value={edit.status} onChange={e => f('status', e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>
    </div>
  )
}
