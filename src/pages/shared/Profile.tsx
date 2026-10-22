import { useState } from 'react'
import { KeyRound, Pencil } from 'lucide-react'
import { useActions } from '../../lib/actions'
import { PROGRAMS, fmtDateTime } from '../../lib/types'
import type { Member, StaffAccount } from '../../lib/types'
import { Alert, Btn, Card, Field, Modal, PageHeader, Status, inputCls } from '../../components/ui'

export default function Profile() {
  const { s, updateProfile, changePassword } = useActions()
  const isMember = s.session!.role === 'Member'
  const member = isMember ? s.members.find(m => m.id === s.session!.userId) : undefined
  const staff = !isMember ? s.staff.find(m => m.id === s.session!.userId) : undefined
  const user = member ?? staff

  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState<Partial<Member & StaffAccount>>({})
  const [eErr, setEErr] = useState<Record<string, string>>({})
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' })
  const [pErr, setPErr] = useState<Record<string, string>>({})

  if (!user) return <Card><p className="text-sm text-mute">Profile not found.</p></Card>

  const startEdit = () => { setForm({ ...user }); setEErr({}); setEdit(true) }
  const save = async () => {
    const e: Record<string, string> = {}
    if (!form.name?.trim()) e.name = 'Name is required.'
    if (!/^\S+@\S+\.\S+$/.test(form.email ?? '')) e.email = 'Enter a valid email address.'
    setEErr(e)
    if (Object.keys(e).length) return
    const saved = await updateProfile({ name: form.name!.trim(), email: form.email!.trim(), ...(member ? { phone: form.phone ?? '', program: form.program ?? member.program } : {}) })
    if (saved) setEdit(false)
  }
  const changePw = async () => {
    const e: Record<string, string> = {}
    if (!pw.cur) e.cur = 'Enter your current password.'
    if (pw.next.length < 8) e.next = 'New password must be at least 8 characters.'
    else if (pw.next === pw.cur) e.next = 'New password must differ from the current one.'
    if (pw.conf !== pw.next) e.conf = 'Passwords do not match.'
    setPErr(e)
    if (Object.keys(e).length) return
    if (!(await changePassword(pw.cur, pw.next))) return
    setPw({ cur: '', next: '', conf: '' })
  }

  const rows: [string, React.ReactNode][] = member
    ? [['Name', member.name], ['ID number', member.idNo], ['Email', member.email], ['Program', member.program], ['Type', member.type], ['Phone', member.phone || '—'], ['Status', <Status value={member.status} />]]
    : [['Name', staff!.name], ['Email', staff!.email], ['Role', staff!.role], ['Last login', fmtDateTime(staff!.lastLogin)], ['Status', <Status value={staff!.status} />]]
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <PageHeader demo title="My Profile" actions={<Btn icon={<Pencil size={14} />} onClick={startEdit}>Edit profile</Btn>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Account details" className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-brand text-xl font-extrabold text-white">{user.name.charAt(0)}</div>
            <div><div className="text-lg font-extrabold text-ink">{user.name}</div><div className="text-sm text-mute">{member ? member.type : staff!.role}</div></div>
          </div>
          <dl className="grid gap-x-8 sm:grid-cols-2">
            {rows.map(([k, v]) => <div key={k} className="border-b border-line py-2"><dt className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-sm text-ink">{v}</dd></div>)}
          </dl>
        </Card>

        <Card title="Change password" actions={<KeyRound size={16} className="text-mute" />}>
          <Alert tone="info" className="mb-3">Your password is stored securely. Use at least 8 characters.</Alert>
          <div className="space-y-3">
            <Field label="Current password" error={pErr.cur}><input type="password" autoComplete="current-password" value={pw.cur} onChange={e => setPw({ ...pw, cur: e.target.value })} className={inputCls} /></Field>
            <Field label="New password" error={pErr.next} help="At least 8 characters."><input type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} className={inputCls} /></Field>
            <Field label="Confirm new password" error={pErr.conf}><input type="password" autoComplete="new-password" value={pw.conf} onChange={e => setPw({ ...pw, conf: e.target.value })} className={inputCls} /></Field>
            <Btn onClick={changePw}>Update password</Btn>
          </div>
        </Card>

        <Card title="Password help">
          <p className="text-sm text-slate-700">Contact a library administrator to reset a forgotten password.</p>
          <Alert tone="warning" className="mt-3">Email reset links are not configured yet.</Alert>
        </Card>
      </div>

      <Modal open={edit} onClose={() => setEdit(false)} title="Edit profile" footer={<><Btn variant="light" onClick={() => setEdit(false)}>Cancel</Btn><Btn onClick={save}>Save changes</Btn></>}>
        <div className="space-y-3">
          <Field label="Name" required error={eErr.name}><input value={form.name ?? ''} onChange={e => set('name', e.target.value)} className={inputCls} /></Field>
          <Field label="Email" required error={eErr.email}><input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} className={inputCls} /></Field>
          {member && <>
            <Field label="Phone"><input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} className={inputCls} /></Field>
            <Field label="Program"><select value={form.program ?? ''} onChange={e => set('program', e.target.value)} className={inputCls}>{[...new Set([...PROGRAMS, member.program])].map(p => <option key={p}>{p}</option>)}</select></Field>
          </>}
        </div>
      </Modal>
    </div>
  )
}
