import './globals.css';
import React from 'react';

export const metadata = {
  title: 'OutfitLens — Image Compare & Virtual Try-On',
  description:
    'OutfitLens compares visual similarity between images and generates AI virtual try-on previews. Not affiliated with Google Teachable Machine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[var(--brand-soft)] selection:text-[var(--ink)]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
