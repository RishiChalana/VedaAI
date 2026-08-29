import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

// Rounded geometric sans matching the Figma reference. Self-hosted by next/font.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VedaAI · Assessment Mapping',
  description: 'Map question papers to handwritten answer sheets with AI-assisted review.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
