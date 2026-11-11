
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider, UserProvider } from '@/firebase';

export const metadata: Metadata = {
  title: 'Nik Finance Tracker',
  description: 'Premium AI-powered personal finance tracker with Indigo branding',
  manifest: '/manifest.json',
  applicationName: 'Nik Finance',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nik Finance',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon.svg?v=2.0.1',
    shortcut: '/icon.svg?v=2.0.1',
    apple: '/icon.svg?v=2.0.1',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#5B5CE2',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('nik-finance-theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body 
        className="font-body antialiased selection:bg-primary/30 selection:text-primary-foreground overscroll-none"
        suppressHydrationWarning
      >
        <FirebaseClientProvider>
          <UserProvider>
            {children}
            <Toaster />
          </UserProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
