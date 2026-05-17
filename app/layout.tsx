import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { AccentColorSync } from '@/components/accent-color-sync'
import { PwaUpdateBanner } from '@/components/pwa-update-banner'
import { Toaster } from '@/components/ui/sonner'
import { CloudSyncManager } from '@/components/lemonade/cloud-sync-manager'
import { SessionManager } from '@/components/lemonade/session-manager'
import { NotificationManager } from '@/components/lemonade/notification-manager'
import { DevNotificationDispatcher } from '@/components/lemonade/dev-notification-dispatcher'
import { ServiceWorkerManager } from '@/components/lemonade/service-worker-manager'
import './globals.css'

export const metadata: Metadata = {
  title: 'Alessandro',
  description: 'A beautifully simple way to organize your days and get things done.',
  applicationName: 'Alessandro',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Alessandro',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#2563eb',
    'msapplication-tap-highlight': 'no',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AccentColorSync />
          <SessionManager />
          <CloudSyncManager />
          <ServiceWorkerManager />
          <NotificationManager />
          <DevNotificationDispatcher />
          {children}
          <PwaUpdateBanner />
          <Toaster richColors closeButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
