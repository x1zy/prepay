import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { worker } from './server/worker'

// Инициализируем MSW worker только в development режиме
async function enableMocking() {
  if (import.meta.env.MODE === 'development') {
    // В development Vite dev server отдает файлы из public по корневому пути
    // независимо от base path, поэтому используем путь без base path
    // Если это не работает, попробуйте использовать полный URL: `${window.location.origin}/mockServiceWorker.js`
    const workerUrl = '/mockServiceWorker.js'
    
    return worker.start({
      onUnhandledRequest: (req) => {
        // Пропускаем запросы к bicycle API - они должны идти через Vite proxy
        const url = new URL(req.url)
        if (url.pathname.startsWith('/api/bicycle') || url.pathname.startsWith('/prepay/api/bicycle')) {
          return
        }
        // Пропускаем другие необработанные запросы
        console.warn('Unhandled request:', req.method, req.url)
      },
      serviceWorker: {
        url: workerUrl,
        // Не указываем scope явно, чтобы MSW использовал дефолтный
      },
    }).catch((error) => {
      // Если не удалось зарегистрировать service worker, продолжаем без него
      console.warn('Failed to start MSW worker:', error)
      console.warn('MSW will not intercept requests, but the app will continue to work')
      console.warn('Make sure mockServiceWorker.js exists in public/ directory')
    })
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
