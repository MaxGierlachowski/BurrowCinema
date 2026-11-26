import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import type { DrawItem, Participant } from '@/lib/draws'
import { itemLink } from '@/lib/folders'
import { cn } from '@/lib/utils'
import { Poster } from './PosterCard'

export function Initials({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold uppercase', className)}>
      {name.slice(0, 2)}
    </span>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

export function ParticipantList({ participants, total }: { participants: Participant[]; total: number }) {
  return (
    <div className="space-y-3">
      {participants.map((p) => (
        <div key={p.id} className="flex items-center gap-3">
          <Initials name={p.name} />
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-muted-foreground">{p.swiped} / {total}</span>
            </div>
            <ProgressBar value={total ? p.swiped / total : 0} />
          </div>
        </div>
      ))}
    </div>
  )
}

export type VoteRow = { item: DrawItem; likes: number; votes: number; unanimous?: boolean; note?: string }

export function VoteList({ rows }: { rows: VoteRow[] }) {
  return (
    <ol className="space-y-2">
      {rows.map(({ item, likes, votes, unanimous, note }, index) => (
        <li key={item.key}>
          <Link to={itemLink(item)} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent">
            <span className="w-6 text-center text-sm font-semibold text-muted-foreground">{index + 1}</span>
            <div className="aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              <Poster src={item.poster} title={item.title} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{item.title}</p>
                {unanimous && <Badge className="shrink-0">Alle wollen</Badge>}
              </div>
              <ProgressBar value={votes ? likes / votes : 0} />
              <p className="text-xs text-muted-foreground">
                {Math.round((votes ? likes / votes : 0) * 100)} % · {likes} von {votes} wollen{note && ` · ${note}`}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}
