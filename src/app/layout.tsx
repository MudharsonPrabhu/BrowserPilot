import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrowserPilot — Autonomous AI Browser Platform',
  description: 'AI-native autonomous browser interaction platform. Intelligent web navigation, agentic workflow execution, contextual understanding, and persistent browser sessions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
