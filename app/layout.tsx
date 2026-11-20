import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Regulatory Trade Reporting Validation: Snowflake example',
  description: 'Catch CAT and CAIS reporting errors before submission, reconcile against the books, and work regulator rejects faster. Synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
