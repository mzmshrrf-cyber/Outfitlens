'use client';

import React, { useEffect, useRef, useState } from 'react';
import { api, TryOnResult, TryOnStatus } from '../services/api';
import {
  AlertCircle,
  Link2,
  Loader2,
  Shirt,
  Sparkles,
  Upload,
  UserRound,
  X,
} from 'lucide-react';

const ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_GARMENTS = 3;

function validateFile(file: File): string | null {
  if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return 'Use PNG, JPG, or WebP only.';
  }
  if (file.size > MAX_BYTES) return 'Each image must be 8MB or smaller.';
  return null;
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  return new File([blob], name.endsWith(`.${ext}`) ? name : `${name}.${ext}`, {
    type: blob.type || 'image/jpeg',
  });
}

export default function VirtualTryOn() {
  const personInputRef = useRef<HTMLInputElement>(null);
  const garmentInputRef = useRef<HTMLInputElement>(null);

  const [personFile, setPersonFile] = useState<File | null>(null);
  const [personPreview, setPersonPreview] = useState<string | null>(null);
  const [garments, setGarments] = useState<{ file: File; preview: string }[]>([]);
  const [productUrl, setProductUrl] = useState('');
  const [category, setCategory] = useState('auto');
  const [mode, setMode] = useState('balanced');
  const [status, setStatus] = useState<TryOnStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);

  useEffect(() => {
    api.getTryOnStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    return () => {
      if (personPreview) URL.revokeObjectURL(personPreview);
      garments.forEach((g) => URL.revokeObjectURL(g.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPerson = (file: File | null) => {
    setPersonPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
    setPersonFile(file);
    setResult(null);
    setError(null);
  };

  const addGarments = (files: FileList | File[]) => {
    const list = Array.from(files);
    const next = [...garments];
    for (const f of list) {
      if (next.length >= MAX_GARMENTS) break;
      const err = validateFile(f);
      if (err) {
        alert(err);
        continue;
      }
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setGarments(next);
    setResult(null);
    setError(null);
  };

  const removeGarment = (idx: number) => {
    setGarments((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[idx].preview);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const fetchFromUrl = async () => {
    if (!productUrl.trim()) return;
    setFetchingUrl(true);
    setError(null);
    try {
      const res = await api.fetchProductImage(productUrl.trim());
      const file = await dataUrlToFile(res.image_data_url, 'product-garment');
      addGarments([file]);
      setProductUrl('');
    } catch (e: any) {
      setError(e.message || 'Could not retrieve a product image from that URL.');
    } finally {
      setFetchingUrl(false);
    }
  };

  const runTryOn = async () => {
    if (!personFile || garments.length === 0) return;
    if (status && !status.configured) {
      setError(
        'Virtual try-on needs Amazon Bedrock credentials/IAM. Classification alone cannot generate try-on previews.'
      );
      return;
    }
    setLoading(true);
    setProgress('Uploading images securely to the OutfitLens API…');
    setError(null);
    setResult(null);
    try {
      setProgress(
        garments.length > 1
          ? `Generating Bedrock try-on for ${garments.length} garments sequentially…`
          : 'Generating try-on with Amazon Nova Canvas (Bedrock)…'
      );
      const res = await api.runTryOn(
        personFile,
        garments.map((g) => g.file),
        category,
        mode
      );
      setResult(res);
      setProgress(null);
    } catch (e: any) {
      setError(e.message || 'Try-on failed.');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const resultSrc = result?.result_data_url || result?.result_url || null;

  return (
    <section className="animate-ol-rise mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="tryon-heading">
      <div className="mb-8 max-w-2xl">
        <h1 id="tryon-heading" className="font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
          AI Virtual Try-On
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Upload a person photo and one or more clothing images. OutfitLens uses a dedicated
          generative try-on model — not image classification.
        </p>
      </div>

      {status && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            status.configured
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-950'
          }`}
          role="status"
        >
          {status.configured ? (
            <p>
              Try-on ready via <strong>{status.provider}</strong> ({status.model}
              {status.task ? ` · ${status.task}` : ''}). Pay-per-use Bedrock billing applies.
            </p>
          ) : (
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Amazon Bedrock not configured</p>
                <p className="mt-1">{status.setup}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ol-panel space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4 text-[var(--brand)]" /> Person photo
            </h2>
            <div
              className="ol-dropzone flex min-h-[200px] cursor-pointer flex-col items-center justify-center p-4"
              role="button"
              tabIndex={0}
              onClick={() => personInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') personInputRef.current?.click();
              }}
            >
              {personPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={personPreview} alt="Person preview" className="max-h-52 object-contain" />
              ) : (
                <>
                  <Upload className="mb-2 h-7 w-7 text-[var(--brand)]" />
                  <p className="text-sm font-medium">Full-body or upper-body photo works best</p>
                </>
              )}
              <input
                ref={personInputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const err = validateFile(f);
                  if (err) return alert(err);
                  setPerson(f);
                }}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Shirt className="h-4 w-4 text-[var(--brand)]" /> Clothing ({garments.length}/{MAX_GARMENTS})
              </h2>
              <button
                type="button"
                className="ol-btn ol-btn-ghost !py-1 text-xs"
                onClick={() => garmentInputRef.current?.click()}
                disabled={garments.length >= MAX_GARMENTS}
              >
                Add image
              </button>
              <input
                ref={garmentInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) addGarments(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {garments.map((g, idx) => (
                <div key={g.preview} className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.preview} alt={`Garment ${idx + 1}`} className="aspect-square object-cover" />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                    aria-label={`Remove garment ${idx + 1}`}
                    onClick={() => removeGarment(idx)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {garments.length === 0 && (
                <p className="col-span-3 text-sm text-[var(--muted)]">
                  Add shirt, pants, or dress photos (flat-lay or on-model).
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="product-url" className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-[var(--brand)]" /> Or product page URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="product-url"
                type="url"
                inputMode="url"
                placeholder="https://shop.example/product/…"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none ring-[var(--brand)] focus:ring-2"
              />
              <button
                type="button"
                className="ol-btn ol-btn-ghost shrink-0"
                onClick={fetchFromUrl}
                disabled={fetchingUrl || !productUrl.trim()}
              >
                {fetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Fetch image
              </button>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Works when the page exposes public og:image metadata. Many stores block bots — upload
              manually if fetch fails.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <option value="auto">Auto-detect</option>
                <option value="tops">Tops / shirts</option>
                <option value="bottoms">Pants / bottoms</option>
                <option value="one-pieces">Dresses / one-pieces</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Quality mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <option value="performance">Performance (faster)</option>
                <option value="balanced">Balanced</option>
                <option value="quality">Quality (slower)</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className="ol-btn ol-btn-primary w-full"
            disabled={!personFile || garments.length === 0 || loading}
            onClick={runTryOn}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Generating preview…' : 'Generate try-on preview'}
          </button>
          {progress && <p className="text-sm text-[var(--muted)]">{progress}</p>}
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
        </div>

        <aside className="ol-panel flex min-h-[420px] flex-col p-5 sm:p-6">
          <h2 className="mb-4 text-sm font-semibold">Preview</h2>
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="ol-skeleton h-64 w-full max-w-sm" />
              <p className="text-sm text-[var(--muted)]">This usually takes 10–40 seconds…</p>
            </div>
          )}
          {!loading && !resultSrc && (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-[var(--muted)]">
              Your generated try-on will appear here. Images are processed for this request and not
              kept as a long-term gallery on the server.
            </div>
          )}
          {!loading && resultSrc && (
            <div className="flex flex-1 flex-col gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultSrc}
                alt="Virtual try-on result"
                className="mx-auto max-h-[480px] w-full rounded-xl object-contain"
              />
              {result && (
                <div className="rounded-xl bg-[var(--brand-soft)] p-3 text-xs text-[var(--ink)]">
                  <p>{result.disclaimer}</p>
                  <p className="mt-2 text-[var(--muted)]">
                    Model: {result.model} · Provider: {result.provider} · Garments:{' '}
                    {result.garment_count}
                  </p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
