import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import Shell from './ui/Shell'
const Classic = lazy(() => import('./classic'))
createRoot(document.getElementById('root')!).render(location.hash === '#classic' ? <Suspense fallback={null}><Classic /></Suspense> : <Shell />)

if (import.meta.env.MODE === 'web' && 'serviceWorker' in navigator && location.protocol.startsWith('http')) { let reloaded = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && sessionStorage.getItem('swReload') !== '1') { reloaded = true; sessionStorage.setItem('swReload', '1'); location.reload() } }); navigator.serviceWorker.register('./sw.js').catch(() => {}) }
