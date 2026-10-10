'use client';

import React, { useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { Aperture, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export type AppMode = 'compare' | 'tryon' | 'lab';

interface AppHeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const MODES: { id: AppMode; label: string; hint: string }[] = [
  { id: 'compare', label: 'Image Compare', hint: 'Visual similarity score' },
  { id: 'tryon', label: 'AI Virtual Try-On', hint: 'Wear garment preview' },
  { id: 'lab', label: 'Class Lab', hint: 'Train a local classifier' },
];

export default function AppHeader({ mode, onModeChange }: AppHeaderProps) {
  const { backendOnline, isCheckingStatus, checkBackendStatus } = useProjectStore();

  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(() => checkBackendStatus(), 10000);
    return () => clearInterval(interval);
  }, [checkBackendStatus]);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[rgba(247,250,251,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--brand)] shadow-lg shadow-teal-900/10"
              aria-hidden
            >
              <Aperture className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div>
              <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-[var(--ink)] sm:text-[1.75rem]">
                OutfitLens
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                See likeness. Preview fit. Built for real images — not magic labels.
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 px-3 py-1.5"
            role="status"
            aria-live="polite"
          >
            {isCheckingStatus ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--brand)]" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Connecting
                </span>
              </>
            ) : backendOnline ? (
              <>
                <span className="h-2 w-2 rounded-full bg-[var(--ok)]" aria-hidden />
                <Wifi className="h-3.5 w-3.5 text-[var(--ok)]" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ok)]">
                  Engine online
                </span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-[var(--danger)]" aria-hidden />
                <WifiOff className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--danger)]">
                  Offline
                </span>
                <button
                  type="button"
                  onClick={() => checkBackendStatus()}
                  className="rounded-full p-1 hover:bg-slate-100"
                  aria-label="Retry connection"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>

        <nav aria-label="Application modes" className="flex flex-wrap gap-2">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                aria-pressed={active}
                className={`min-w-[9.5rem] flex-1 rounded-2xl border px-4 py-3 text-left transition sm:flex-none ${
                  active
                    ? 'border-transparent bg-[var(--ink)] text-white shadow-lg shadow-teal-950/15'
                    : 'border-[var(--line)] bg-white/70 text-[var(--ink)] hover:border-[var(--brand)]'
                }`}
              >
                <span className="block text-sm font-semibold">{m.label}</span>
                <span className={`mt-0.5 block text-[11px] ${active ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                  {m.hint}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
