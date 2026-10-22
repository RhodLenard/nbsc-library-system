import { useEffect } from 'react'
import { CalendarClock, CheckCircle2, DatabaseBackup, HardDrive } from 'lucide-react'
import { Alert, Btn, Card, DataTable, PageHeader, Status, StatCard, type Col } from '../../components/ui'
import { useActions } from '../../lib/actions'
import { mutation } from '../../lib/api'
import { fmtDateTime, type Backup } from '../../lib/types'

const mb = (size: string) => { const n = parseFloat(size); return /gb/i.test(size) ? n * 1024 : /kb/i.test(size) ? n / 1024 : n || 0 }

export default function Backups() {
  const { s, refresh, toast } = useActions()

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh() }, 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const running = s.backups.some(b => b.status === 'Running')
  const last = s.backups.filter(b => b.status === 'Completed').sort((a, b) => b.date.localeCompare(a.date))[0]
  const used = s.backups.filter(b => b.status === 'Completed').reduce((a, b) => a + mb(b.size), 0)

  const create = async () => { try { await mutation('/staff/backups', {}); await refresh(); toast('Backup job completed; status reflects checksum verification.', 'success') } catch (cause) { toast(cause instanceof Error ? cause.message : 'Backup failed.', 'error') } }
  const cols: Col<Backup>[] = [
    { key: 'name', header: 'File name', sort: b => b.name, render: b => <span className="font-mono text-xs font-semibold">{b.name}</span> },
    { key: 'date', header: 'Created', sort: b => b.date, render: b => fmtDateTime(b.date) },
    { key: 'kind', header: 'Type', hideBelow: 'md' },
    { key: 'size', header: 'Size' },
    { key: 'status', header: 'Status', render: b => b.status === 'Running' ? (
      <div className="w-28"><Status value="Running" /><div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200"><div className="h-full w-full origin-left animate-pulse rounded bg-brand" /></div></div>
    ) : <Status value={b.status} /> },
  ]

  return (
    <div>
      <PageHeader title="Backup Manager" subtitle="Create and monitor checksum-verified MariaDB backups." />
      <Alert tone="warning" className="mb-4"><b>Operational requirement:</b> a run is marked successful only after MariaDB dump creation and checksum verification. Restore tests run only against the separately configured clean database.</Alert>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Last successful backup" value={<span className="text-lg">{last ? fmtDateTime(last.date) : 'None'}</span>} icon={<CheckCircle2 size={36} />} tone="green" />
        <StatCard label="Schedule" value={<span className="text-lg">Nightly 02:00</span>} icon={<CalendarClock size={36} />} tone="dark" />
        <StatCard label="Storage used" value={<span className="text-lg">{used.toFixed(1)} MB</span>} hint={`${s.backups.length} backup(s)`} icon={<HardDrive size={36} />} />
      </div>

      <Card title="Backups" className="mb-4" flush
        actions={<Btn icon={<DatabaseBackup size={15} />} onClick={create} disabled={running}>{running ? 'Backing up…' : 'Create backup now'}</Btn>}>
        <DataTable rows={s.backups} columns={cols} pageSize={8} />
      </Card>
    </div>
  )
}
