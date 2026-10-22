import { useState } from 'react'
import { ArrowLeft, Mail, Send } from 'lucide-react'
import { useActions, memberOf } from '../../lib/actions'
import { fmtDateTime } from '../../lib/types'
import type { Message } from '../../lib/types'
import { Btn, Card, EmptyState, Field, Modal, PageHeader, inputCls } from '../../components/ui'

export default function Messages() {
  const { s, sendMessage, readMessage, toast } = useActions() as ReturnType<typeof useActions> & { readMessage: (id: string) => void }
  const isStaff = s.session!.role !== 'Member'
  const key = isStaff ? 'staff' : s.session!.userId
  const [selId, setSelId] = useState<string | null>(null)
  const [compose, setCompose] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [err, setErr] = useState('')

  const list = s.messages.filter(m => m.fromId === key || m.toId === key).sort((a, b) => b.date.localeCompare(a.date))
  const other = (m: Message) => (m.fromId === key ? m.toId : m.fromId)
  const label = (id: string) => id === 'staff' ? 'Library Staff' : memberOf(s, id)?.name ?? 'Unknown member'
  const unread = (m: Message) => m.toId === key && !m.read
  const sel = list.find(m => m.id === selId) ?? null
  const thread = sel ? list.filter(m => other(m) === other(sel) && m.subject.replace(/^Re:\s*/i, '') === sel.subject.replace(/^Re:\s*/i, '')).sort((a, b) => a.date.localeCompare(b.date)) : []

  const open = (m: Message) => { setSelId(m.id); setReply(''); void Promise.all(list.filter(x => unread(x) && x.subject.replace(/^Re:\s*/i, '') === m.subject.replace(/^Re:\s*/i, '')).map(x => readMessage(x.id))) }

  const send = async () => {
    const rcpt = isStaff ? to : 'staff'
    if (isStaff && !rcpt) return setErr('Choose a recipient.')
    if (!subject.trim()) return setErr('Subject is required.')
    if (!body.trim()) return setErr('Message cannot be empty.')
    if (!await sendMessage(key, rcpt, subject.trim(), body.trim())) return
    setCompose(false); setSubject(''); setBody(''); setTo(''); setErr('')
  }
  const sendReply = async () => {
    if (!sel) return
    if (!reply.trim()) return toast('Write a reply first.', 'warning')
    if (!await sendMessage(key, other(sel), /^Re:/i.test(sel.subject) ? sel.subject : 'Re: ' + sel.subject, reply.trim())) return
    setReply('')
  }

  return (
    <div>
      <PageHeader demo title="Messages" subtitle={isStaff ? 'Conversations with library members' : 'Talk to the librarian'} actions={<Btn icon={<Send size={14} />} onClick={() => { setErr(''); setCompose(true) }}>New message</Btn>} />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card flush className={sel ? 'hidden lg:block' : ''}>
          {list.length === 0 ? <EmptyState title="No messages yet" hint="Start a conversation with New message." /> : (
            <ul className="scroll-thin max-h-[70vh] divide-y divide-line overflow-y-auto">
              {list.map(m => (
                <li key={m.id}>
                  <button onClick={() => open(m)} className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${sel?.id === m.id ? 'bg-brand-soft/60' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${unread(m) ? 'font-extrabold text-ink' : 'text-slate-700'}`}>{m.fromId === key ? 'To: ' : ''}{label(other(m))}</span>
                      <span className="shrink-0 text-[11px] text-mute">{fmtDateTime(m.date)}</span>
                    </div>
                    <div className={`truncate text-sm ${unread(m) ? 'font-bold text-ink' : 'text-slate-600'}`}>{unread(m) && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand" />}{m.subject}</div>
                    <div className="truncate text-xs text-mute">{m.body}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={sel ? '' : 'hidden lg:block'}>
          {!sel ? <EmptyState title="Select a message" hint="Choose a conversation on the left to read it." /> : (
            <div>
              <button onClick={() => setSelId(null)} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-brand lg:hidden"><ArrowLeft size={14} /> Back to inbox</button>
              <h2 className="text-lg font-extrabold text-ink">{sel.subject}</h2>
              <p className="mb-3 text-xs text-mute">Conversation with {label(other(sel))}</p>
              <div className="space-y-3">
                {thread.map(m => (
                  <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.fromId === key ? 'ml-6 border-brand/20 bg-brand-soft/40' : 'mr-6 border-line bg-slate-50'}`}>
                    <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs"><b className="text-ink">{m.fromId === key ? 'You' : label(m.fromId)}</b><span className="text-mute">{fmtDateTime(m.date)}</span></div>
                    <p className="whitespace-pre-wrap text-slate-700">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <Field label="Reply"><textarea rows={3} value={reply} onChange={e => setReply(e.target.value)} className={inputCls} placeholder="Write your reply…" /></Field>
                <Btn className="mt-2" icon={<Mail size={14} />} onClick={sendReply}>Send reply</Btn>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={compose} onClose={() => setCompose(false)} title="New message" footer={<><Btn variant="light" onClick={() => setCompose(false)}>Cancel</Btn><Btn icon={<Send size={14} />} onClick={send}>Send</Btn></>}>
        <div className="space-y-3">
          {isStaff ? (
            <Field label="To" required><select value={to} onChange={e => setTo(e.target.value)} className={inputCls}><option value="">Select member…</option>{s.members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.idNo})</option>)}</select></Field>
          ) : <Field label="To"><input disabled value="Library Staff" className={inputCls} /></Field>}
          <Field label="Subject" required><input value={subject} onChange={e => setSubject(e.target.value)} className={inputCls} /></Field>
          <Field label="Message" required><textarea rows={5} value={body} onChange={e => setBody(e.target.value)} className={inputCls} /></Field>
          {err && <p className="text-xs font-semibold text-red-700">{err}</p>}
        </div>
      </Modal>
    </div>
  )
}
