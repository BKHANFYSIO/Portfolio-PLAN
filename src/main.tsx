import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ensureSeed, importYearsFromPublic, importTemplatesFromPublic } from './lib/curriculum'
import PlanDetail from './pages/PlanDetail'
import Admin from './pages/Admin'

ensureSeed()
// Probeer jaarplanningen uit public te importeren (optioneel)
importYearsFromPublic().catch(()=>{ /* ignore */ })
importTemplatesFromPublic().catch(()=>{ /* ignore */ })

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/plan/:id', element: <PlanDetail /> },
  { path: '/admin', element: <Admin /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
