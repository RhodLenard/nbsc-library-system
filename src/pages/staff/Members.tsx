import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Copy, Download, Eye, KeyRound, Pencil, Plus, Power, Trash2, UserCheck, UserX } from 'lucide-react'
import { Btn, Card, DataTable, Field, Modal, PageHeader, Status, inputCls, useConfirm, type Col } from '../../components/ui'
import { activeLoans, useActions } from '../../lib/actions'
import { PROGRAMS, today, uid, type Member } from '../../lib/types'
import { download, mutation } from '../../lib/api'

const blank = (): Member => ({ id: '', idNo: '', name: '', email: '', program: PROGRAMS[0], type: 'Student', status: 'Active', joined: today(), phone: '' })

export default function Members() {
  const { s, toast, upsertMember, setMemberStatus, deleteMembers } = useActions()
  const confirm = useConfirm()
  const nav = useNavigate()
  const canDelete = false
  const [program, setProgram] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [edit, setEdit] = useState<Member | null>(null)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [generatedPassword, setGeneratedPassword] = useState<{ member: Member; password: string } | null>(null)

  const rows = s.members.filter(m => (!program || m.program === program) && (!type || m.type === type) && (!status || m.status === status))
  const selCls = `${inputCls} w-auto`

  const openForm = (m: Member) => { setErrs({}); setEdit(m) }
  const save = async () => {
    if (!edit) return
    const e: Record<string, string> = {}
    if (!edit.name.trim()) e.name = 'Name is required.'
    if (!edit.idNo.trim()) e.idNo = 'ID number is required.'
    else if (s.members.some(m => m.id !== edit.id && m.idNo.toLowerCase() === edit.idNo.trim().toLowerCase())) e.idNo = 'This ID number already exists.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edit.email.trim())) e.email = 'Enter a valid email address.'
    else if (s.members.some(m => m.id !== edit.id && m.email.toLowerCase() === edit.email.trim().toLowerCase())) e.email = 'This email is already used.'
    if (edit.phone.trim() && !/^[0-9+\-\s()]{7,15}$/.test(edit.phone.trim())) e.phone = 'Enter a valid phone number.'
    setErrs(e)
    if (Object.keys(e).length) return
    const saved = await upsertMember({ ...edit, id: edit.id || uid('m'), joined: edit.id ? edit.joined : today(), name: edit.name.trim(), idNo: edit.idNo.trim(), email: edit.email.trim(), phone: edit.phone.trim() })
    if (saved) setEdit(null)
  }
  const del = async (ids: string[], clear?: () => void) => {
    if (!canDelete) return toast('Assistants cannot delete members.', 'error')
    if (await confirm({ title: 'Delete users', message: `Permanently delete ${ids.length} user(s)? This cannot be undone.`, confirmLabel: 'Delete', danger: true })) { deleteMembers(ids); clear?.() }
  }
  const setSt = async (ids: string[], st: Member['status'], clear?: () => void) => {
    if (await confirm({ title: st === 'Active' ? 'Activate users' : 'Deactivate users', message: `${st === 'Active' ? 'Activate' : 'Deactivate'} ${ids.length} user(s)?`, confirmLabel: st === 'Active' ? 'Activate' : 'Deactivate', danger: st === 'Inactive' })) { await setMemberStatus(ids, st); clear?.() }
  }
  const resetPassword = async (member: Member) => {
    try { const result = await mutation<{ password: string }>(`/staff/members/${member.id}/password/reset`, {}); setGeneratedPassword({ member, password: result.password }) } catch (cause) { toast(cause instanceof Error ? cause.message : 'Unable to reset password.', 'error') }
  }
  const copyPassword = async () => {
    if (!generatedPassword) return
    try { await navigator.clipboard.writeText(generatedPassword.password); toast('Generated password copied', 'success') } catch { toast('Copy the password manually.', 'info') }
  }

  const cols: Col<Member>[] = [
    { key: 'name', header: 'Name', sort: m => m.name, render: m => <div><div className="font-semibold">{m.name}</div><div className="text-xs text-mute">{m.email}</div></div> },
    { key: 'idNo', header: 'ID No.', sort: m => m.idNo, render: m => m.idNo },
    { key: 'program', header: 'Program', hideBelow: 'md', render: m => m.program },
    { key: 'type', header: 'Type', hideBelow: 'md', render: m => m.type },
    { key: 'loans', header: 'Active loans', hideBelow: 'lg', sort: m => activeLoans(s, m.id).length, render: m => activeLoans(s, m.id).length },
    { key: 'status', header: 'Status', render: m => <Status value={m.status} /> },
  ]
  const set = (k: keyof Member, v: string) => setEdit(e => e && { ...e, [k]: v })

  return (
    <div>
      <PageHeader demo title="Library Users" subtitle="Manage students, faculty and staff who use the library." />
      <Card flush>
        <DataTable rows={rows} columns={cols} selectable onRowClick={m => nav(`/staff/members/${m.id}`)}
          search={m => `${m.name} ${m.idNo} ${m.email}`}
          filters={<>
            <select aria-label="Program" className={selCls} value={program} onChange={e => setProgram(e.target.value)}><option value="">All programs</option>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</select>
            <select aria-label="Type" className={selCls} value={type} onChange={e => setType(e.target.value)}><option value="">All types</option><option>Student</option><option>Faculty</option><option>Staff</option></select>
            <select aria-label="Status" className={selCls} value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option>Active</option><option>Inactive</option></select>
          </>}
          bulk={(ids, clear) => <>
            <Btn size="sm" variant="success" icon={<UserCheck size={13} />} onClick={() => setSt(ids, 'Active', clear)}>Activate</Btn>
            <Btn size="sm" variant="light" icon={<UserX size={13} />} onClick={() => setSt(ids, 'Inactive', clear)}>Deactivate</Btn>
            {canDelete && <Btn size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={() => del(ids, clear)}>Delete</Btn>}
          </>}
          toolbarRight={<>
            <Btn variant="light" icon={<Download size={15} />} onClick={() => { const filters = new URLSearchParams({ format: 'csv', ...(program ? { program } : {}), ...(type ? { type } : {}), ...(status ? { status } : {}) }); void download(`/staff/members/export?${filters}`, 'members-export.csv').then(() => toast('Filtered member export downloaded', 'success')).catch(error => toast(error instanceof Error ? error.message : 'Export failed.', 'error')) }}>Export CSV</Btn>
            <Btn icon={<Plus size={15} />} onClick={() => openForm(blank())}>Add User</Btn>
          </>}
          actions={m => <>
            <Btn size="sm" variant="light" aria-label="View" title="View" icon={<Eye size={13} />} onClick={() => nav(`/staff/members/${m.id}`)} />
            <Btn size="sm" variant="light" aria-label="Edit" title="Edit" icon={<Pencil size={13} />} onClick={() => openForm(m)} />
            <Btn size="sm" variant="light" aria-label="Generate new password" title="Generate new password" icon={<KeyRound size={13} />} onClick={() => void resetPassword(m)} />
            <Btn size="sm" variant="light" aria-label={m.status === 'Active' ? 'Deactivate' : 'Activate'} title={m.status === 'Active' ? 'Deactivate' : 'Activate'} icon={<Power size={13} />} onClick={() => setSt([m.id], m.status === 'Active' ? 'Inactive' : 'Active')} />
            {canDelete && <Btn size="sm" variant="danger" aria-label="Delete" title="Delete" icon={<Trash2 size={13} />} onClick={() => del([m.id])} />}
          </>} />
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit User' : 'Add User'}
        footer={<><Btn variant="light" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save user</Btn></>}>
        {edit && (
          <form onSubmit={e => { e.preventDefault(); save() }} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Full name" required error={errs.name} className="sm:col-span-2"><input className={inputCls} value={edit.name} onChange={e => set('name', e.target.value)} /></Field>
            <Field label="ID no." required error={errs.idNo}><input className={inputCls} value={edit.idNo} onChange={e => set('idNo', e.target.value)} placeholder="2024-0001" /></Field>
            <Field label="Email" required error={errs.email}><input className={inputCls} type="email" value={edit.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Program" required><select className={inputCls} value={edit.program} onChange={e => set('program', e.target.value)}>{PROGRAMS.map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Type" required><select className={inputCls} value={edit.type} onChange={e => set('type', e.target.value)}><option>Student</option><option>Faculty</option><option>Staff</option></select></Field>
            <Field label="Phone" error={errs.phone}><input className={inputCls} value={edit.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Status"><select className={inputCls} value={edit.status} onChange={e => set('status', e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
            <button type="submit" className="hidden" />
          </form>
        )}
      </Modal>

      <Modal open={!!generatedPassword} onClose={() => setGeneratedPassword(null)} title="New member password"
        footer={<><Btn variant="light" onClick={() => setGeneratedPassword(null)}>Close</Btn><Btn icon={<Copy size={14} />} onClick={() => void copyPassword()}>Copy password</Btn></>}>
        {generatedPassword && <div className="space-y-3"><p className="text-sm text-mute">A new password was generated for <b>{generatedPassword.member.name}</b>. It is shown only now; give it to the member through an approved channel.</p><code className="block break-all rounded-md border border-line bg-slate-50 p-3 text-sm font-bold text-ink">{generatedPassword.password}</code><p className="text-xs text-mute">The system stores only a password hash. The previous password cannot be viewed or copied.</p></div>}
      </Modal>
    </div>
  )
}
