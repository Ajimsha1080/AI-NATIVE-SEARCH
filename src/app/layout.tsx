import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Geist, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ShopMate AaaS — Enterprise E-Commerce AI Agent-as-a-Service Platform',
  description: 'Production-ready AI agents for high-converting e-commerce stores. Semantic catalog search, live order tracking, returns processing, and automated human handoff.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className={`${plusJakartaSans.className} font-display bg-[#f4f5f7] text-zinc-900 antialiased min-h-screen selection:bg-indigo-100 selection:text-indigo-900 tracking-[-0.015em]`}>
        {children}
      </body>
    </html>
  );
}
