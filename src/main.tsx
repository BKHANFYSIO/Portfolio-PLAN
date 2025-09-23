import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ensureSeed } from './lib/curriculum'
import PlanDetail from './pages/PlanDetail'

ensureSeed()

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/plan/:id', element: <PlanDetail /> }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
