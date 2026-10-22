import type { ReactNode } from 'react'
import { Eraser } from 'lucide-react'
import { Btn } from '../../../components/ui'

export default function TabFrame({ title, help, onClear, children }: { title: string; help: string; onClear?: () => void; children: ReactNode }) {
  return (
    <div data-testid="tab-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div><h3 className="text-lg font-extrabold">{title}</h3><p className="mt-0.5 max-w-xl text-sm text-mute">{help}</p></div>
        {onClear && <Btn variant="outline" size="sm" icon={<Eraser size={14} />} onClick={onClear}>Clear Tab</Btn>}
      </div>
      {children}
    </div>
  )
}
