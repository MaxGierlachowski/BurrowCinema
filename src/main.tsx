import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, Navigate, RouterProvider } from 'react-router'
import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import DrawDetail from '@/pages/DrawDetail'
import Draws from '@/pages/Draws'
import DrawStats from '@/pages/DrawStats'
import ExternalDetail from '@/pages/ExternalDetail'
import FolderDetail from '@/pages/FolderDetail'
import Folders from '@/pages/Folders'
import ItemDetail from '@/pages/ItemDetail'
import Library from '@/pages/Library'
import Login from '@/pages/Login'
import NewDraw from '@/pages/NewDraw'
import Search from '@/pages/Search'
import Settings from '@/pages/Settings'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false } },
})

function Protected() {
  const { session } = useAuth()
  return session ? <AppShell /> : <Navigate to="/login" replace />
}

const router = createHashRouter([
  { path: '/login', element: <Login /> },
  {
    element: <Protected />,
    children: [
      { index: true, element: <Library /> },
      { path: 'search', element: <Search /> },
      { path: 'item/:id', element: <ItemDetail /> },
      { path: 'external/:source/:id', element: <ExternalDetail /> },
      { path: 'draws', element: <Draws /> },
      { path: 'draws/new', element: <NewDraw /> },
      { path: 'draws/stats', element: <DrawStats /> },
      { path: 'draws/:id', element: <DrawDetail /> },
      { path: 'folders', element: <Folders /> },
      { path: 'folders/:id', element: <FolderDetail /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
