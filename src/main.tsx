import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ensureSeed, importYearsFromPublic } from './lib/curriculum'
import PlanDetail from './pages/PlanDetail'

ensureSeed()
// Probeer jaarplanningen uit public te importeren (optioneel)
importYearsFromPublic().catch(()=>{ /* ignore */ })

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/plan/:id', element: <PlanDetail /> }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
