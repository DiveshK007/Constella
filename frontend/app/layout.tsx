import './globals.css';
import type { Metadata } from 'next';
import { Space_Grotesk, Manrope, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error-boundary';
import { AnalyticsProvider } from '@/components/analytics-provider';

// Display: geometric grotesk for headings + wordmark.
const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});
// Body/UI: clean, modern sans.
const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
// Data: monospace for wallet addresses and tx hashes.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StellrFlow — Visual automation for Stellar',
  description:
    'Build and run on-chain Stellar workflows on a drag-and-drop canvas. No code, verifiable on-chain.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {/* Ambient cosmic backdrop — non-interactive, reduced-motion aware. */}
          <div className="cosmic-stars" aria-hidden="true" />
          <div className="cosmic-noise" aria-hidden="true" />
          <ErrorBoundary>{children}</ErrorBoundary>
          <Toaster />
          <AnalyticsProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
