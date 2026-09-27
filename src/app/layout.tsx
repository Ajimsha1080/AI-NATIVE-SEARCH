import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="bg-[#f4f5f7] text-zinc-900 font-sans antialiased min-h-screen selection:bg-indigo-100 selection:text-indigo-900 tracking-[-0.015em]">
        {children}
      </body>
    </html>
  );
}
