import { Film, FolderHeart, Search, Settings } from 'lucide-react'
import { NavLink, Outlet, ScrollRestoration } from 'react-router'
import { cn } from '@/lib/utils'
import { BurrowMark } from './BurrowMark'

const NAV = [
  { to: '/', label: 'Bibliothek', icon: Film },
  { to: '/search', label: 'Suche', icon: Search },
  { to: '/folders', label: 'Ordner', icon: FolderHeart },
  { to: '/settings', label: 'Einstellungen', icon: Settings },
]

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <BurrowMark className="size-5" />
      </span>
      BurrowCinema
    </span>
  )
}

export function AppShell() {
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-40 border-b bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <NavLink to="/">
            <Logo />
          </NavLink>
          <nav className="ml-auto hidden gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-accent text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] text-muted-foreground transition-colors',
                  isActive && 'text-primary',
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      <ScrollRestoration />
    </div>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-6xl px-4 py-5 md:py-8', className)}>{children}</div>
}
