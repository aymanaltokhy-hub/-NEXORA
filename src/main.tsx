import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Shell from './ui/Shell'
const Classic = lazy(() => import('./classic'))
createRoot(document.getElementById('root')!).render(location.hash === '#classic' ? <Suspense fallback={null}><Classic /></Suspense> : <Shell />)
