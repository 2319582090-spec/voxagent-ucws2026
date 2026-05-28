import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';

// Three type families — one sans (UI), one display (italic serif accents), one mono.
// The next/font variable uses a family-specific name (e.g. `--font-geist-sans`),
// NOT the Tailwind utility name. Utility names are mapped in globals.css's @theme:
// `--font-ui: var(--font-geist-sans), …`. If the next/font variable and the utility
// name collided, the @theme alias would self-reference — CSS would drop the declaration.
const geist = Geist({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-geist-sans',
  display: 'swap',
});
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-geist-mono-face',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'VoxAgent - Singapore AI Voice Assistant | MiMo + Agora',
  description:
    "Real-time voice AI agent for Singapore. Talk naturally, get answers instantly. Powered by Xiaomi MiMo and Agora Conversational AI.",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png' }],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${instrumentSerif.variable} ${geistMono.variable}`}
    >
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}
