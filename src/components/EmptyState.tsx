import type { ComponentType, ReactNode } from 'react'

type Props = { icon: ComponentType<{ className?: string }>; title: string; text?: ReactNode; children?: ReactNode }

export function EmptyState({ icon: Icon, title, text, children }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      </div>
      {children}
    </div>
  )
}
