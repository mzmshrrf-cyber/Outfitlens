'use client';

import React, { useCallback, useRef, useState } from 'react';
import { api, CompareResult } from '../services/api';
import { AlertTriangle, ImagePlus, Loader2, Scale, X } from 'lucide-react';

const ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
const MAX_BYTES = 8 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return 'Use PNG, JPG, or WebP only.';
  }
  if (file.size > MAX_BYTES) return 'Each image must be 8MB or smaller.';
  return null;
}

function Slot({
  label,
  file,
  preview,
  onPick,
  onClear,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      alert(err);
      return;
    }
    onPick(f);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ink)]">{label}</h3>
        {file && (
          <button type="button" className="ol-btn ol-btn-ghost !px-2 !py-1 text-xs" onClick={onClear}>
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        className={`ol-dropzone relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center overflow-hidden p-4 ${
          drag ? 'is-active' : ''
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${label} preview`} className="max-h-56 w-full object-contain" />
        ) : (
          <>
            <ImagePlus className="mb-2 h-8 w-8 text-[var(--brand)]" aria-hidden />
            <p className="text-sm font-medium">Drop an image or click to browse</p>
            <p className="mt-1 text-xs text-[var(--muted)]">PNG, JPG, WebP · max 8MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {file && <p className="truncate text-xs text-[var(--muted)]">{file.name}</p>}
    </div>
  );
}

export default function ImageCompare() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [prevA, setPrevA] = useState<string | null>(null);
  const [prevB, setPrevB] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);

  const setSide = useCallback((side: 'a' | 'b', file: File | null) => {
    const url = file ? URL.createObjectURL(file) : null;
    if (side === 'a') {
      setPrevA((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setFileA(file);
    } else {
      setPrevB((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setFileB(file);
    }
    setResult(null);
    setError(null);
  }, []);

  const runCompare = async () => {
    if (!fileA || !fileB) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.compareImages(fileA, fileB);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Comparison failed.');
    } finally {
      setLoading(false);
    }
  };

  const pct = result ? Math.round(result.similarity_score * 100) : 0;

  return (
    <section className="animate-ol-rise mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="compare-heading">
      <div className="mb-8 max-w-2xl">
        <h1 id="compare-heading" className="font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
          Image Compare
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Upload two images to measure visual similarity with deep embeddings — not facial ID,
          not product matching, and not virtual try-on.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="ol-panel p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Slot
              label="Image A"
              file={fileA}
              preview={prevA}
              onPick={(f) => setSide('a', f)}
              onClear={() => setSide('a', null)}
            />
            <Slot
              label="Image B"
              file={fileB}
              preview={prevB}
              onPick={(f) => setSide('b', f)}
              onClear={() => setSide('b', null)}
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="ol-btn ol-btn-primary"
              disabled={!fileA || !fileB || loading}
              onClick={runCompare}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              {loading ? 'Comparing…' : 'Compare images'}
            </button>
            {error && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <aside className="ol-panel flex flex-col items-center justify-center gap-4 p-6 text-center">
          {loading && <div className="ol-skeleton h-40 w-40 rounded-full" aria-hidden />}
          {!loading && !result && (
            <p className="text-sm text-[var(--muted)]">
              Results appear here after you compare two images.
            </p>
          )}
          {!loading && result && (
            <>
              <div
                className="ol-score-ring flex items-center justify-center"
                style={{ ['--p' as string]: pct }}
                aria-label={`Similarity score ${pct} percent`}
              >
                <div>
                  <p className="font-display text-3xl font-bold tabular-nums">{pct}%</p>
                  <p className="text-xs text-[var(--muted)]">similarity</p>
                </div>
              </div>
              <div>
                <p className="font-display text-xl font-bold">{result.label}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{result.explanation}</p>
                <p className="mt-3 text-[11px] text-[var(--muted)]">{result.method}</p>
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="ol-panel mt-6 border-l-4 border-l-[var(--accent)] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Limitations (read before trusting a score)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              {(result?.limitations || [
                'Visual embedding similarity only — not identity verification.',
                'Lighting, crop, and pose can change scores for the same subject.',
                'Cannot perform virtual try-on or measure garment fit.',
              ]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
