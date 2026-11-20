import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppearanceProvider } from '@/app/appearance'
import { AuthUiProvider } from '@/app/auth'
import { ImmersiveProvider } from '@/app/ImmersiveContext'
import { prefetchPages, router } from '@/app/router'
import { ShareProvider } from '@/components/ui/ShareSheet'
import { SessionProvider } from '@/app/session'
import { SoundProvider } from '@/app/sound'
import { ToastProvider } from '@/components/ui/Toast'
import { WorldThemeProvider } from '@/theme/WorldThemeProvider'
import { registerSW } from 'virtual:pwa-register'
import { reloadForNewBuild } from '@/lib/chunkReload'
import { keepViewportInPlace } from '@/lib/viewport'
import '@/styles/index.css'
import { startTranslation } from '@/lib/language'

startTranslation()

// Open tabs look for a new deploy every half hour; it takes over once they close.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) window.setInterval(() => void registration.update(), 30 * 60 * 1000)
  },
})

// Vite reports a preload that failed because a newer build replaced the file.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForNewBuild()
})

keepViewportInPlace()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <WorldThemeProvider>
          <AppearanceProvider>
            <SoundProvider>
              <ImmersiveProvider>
                <ToastProvider>
                  <ShareProvider>
                    <AuthUiProvider>
                      <RouterProvider router={router} />
                    </AuthUiProvider>
                  </ShareProvider>
                </ToastProvider>
              </ImmersiveProvider>
            </SoundProvider>
          </AppearanceProvider>
        </WorldThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  </StrictMode>,
)

prefetchPages()
