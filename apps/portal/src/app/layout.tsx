import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });

export const metadata: Metadata = {
  title: 'TendIA · Portal del aliado',
  description: 'Crédito basado en el negocio, no en el pasado bancario.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={nunito.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
