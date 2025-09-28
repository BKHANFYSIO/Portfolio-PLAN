import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ensureSeed, importYearsFromPublic, importTemplatesFromPublic, importCurriculumFromPublic } from './lib/curriculum'
import PlanDetail from './pages/PlanDetail'
import Admin from './pages/Admin'
import { applyTheme } from './lib/theme'

async function bootstrap(){
  ensureSeed()
  // Importeer data uit public en wacht af vóór eerste render, zodat dropdowns direct juiste data tonen
  try{
    await importYearsFromPublic().catch(()=>{})
    await importCurriculumFromPublic().catch(()=>{})
    await importTemplatesFromPublic().catch(()=>{})
  }catch{}

  // Zorg dat de gekozen thema-instelling (light/dark/system) direct geldt bij initial load
  applyTheme()

  const PrintPlan = (await import('./pages/PrintPlan')).default
  const router = createBrowserRouter([
    { path: '/', element: <App /> },
    { path: '/plan/:id', element: <PlanDetail /> },
    { path: '/print/:id', element: <PrintPlan /> },
    { path: '/admin', element: <Admin /> },
  ])

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

bootstrap()
