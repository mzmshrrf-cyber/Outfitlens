import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Teachable Core - Custom Image Project',
  description: 'Production-grade offline-first image classification clone of Google Teachable Machine using Next.js 15, PyTorch MobileNetV3 feature extraction, and fast scikit-learn classifiers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-brand-500/35 selection:text-white">
        {children}
      </body>
    </html>
  );
}
