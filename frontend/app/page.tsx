'use client';

import React, { useEffect, useState } from 'react';
import AppHeader, { AppMode } from '../components/AppHeader';
import ImageCompare from '../components/ImageCompare';
import VirtualTryOn from '../components/VirtualTryOn';
import ClassCard from '../components/ClassCard';
import Predictor from '../components/Predictor';
import TrainingDashboard from '../components/TrainingDashboard';
import { useProjectStore } from '../store/useProjectStore';
import { Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

function ClassLab() {
  const {
    classes,
    backendOnline,
    isCheckingStatus,
    checkBackendStatus,
    loadClasses,
    addClass,
  } = useProjectStore();

  useEffect(() => {
    const initApp = async () => {
      const isOnline = await checkBackendStatus();
      if (isOnline) await loadClasses();
    };
    initApp();
  }, [checkBackendStatus, loadClasses]);

  useEffect(() => {
    if (!isCheckingStatus && classes.length === 0) {
      const populateDefaults = async () => {
        try {
          await addClass('Class 1');
          await addClass('Class 2');
        } catch (e) {
          console.error('Error prepopulating default classes', e);
        }
      };
      populateDefaults();
    }
  }, [classes.length, isCheckingStatus, addClass]);

  const handleAddNewClass = async () => {
    let suffix = classes.length + 1;
    let name = `Class ${suffix}`;
    while (classes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      suffix++;
      name = `Class ${suffix}`;
    }
    try {
      await addClass(name);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <section className="animate-ol-rise mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8" aria-labelledby="lab-heading">
      <div className="mb-6 max-w-2xl">
        <h1 id="lab-heading" className="font-display text-3xl font-bold text-[var(--ink)]">
          Class Lab
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Optional local classifier workspace (MobileNet features + logistic regression). This is
          <strong> not </strong> virtual try-on — use AI Virtual Try-On for garment previews.
          {!backendOnline && ' Backend appears offline.'}
        </p>
      </div>

      <div className="flex flex-col items-start justify-center gap-6 lg:flex-row">
        <div className="flex w-full flex-1 flex-col gap-4 lg:max-w-2xl">
          <AnimatePresence mode="popLayout">
            {classes.map((cls) => (
              <ClassCard key={cls.name} className={cls.name} />
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={handleAddNewClass}
            className="ol-btn ol-btn-ghost w-full border-dashed py-4 uppercase tracking-wider"
          >
            <Plus className="h-4 w-4" />
            Add a class
          </button>
        </div>

        <div className="w-full shrink-0 lg:w-72">
          <TrainingDashboard />
        </div>

        <div className="w-full shrink-0 lg:max-w-md">
          <Predictor />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>('compare');

  return (
    <div className="ol-shell flex min-h-screen flex-col">
      <AppHeader mode={mode} onModeChange={setMode} />
      <main id="main" className="flex-grow pb-16">
        {mode === 'compare' && <ImageCompare />}
        {mode === 'tryon' && <VirtualTryOn />}
        {mode === 'lab' && <ClassLab />}
      </main>
      <footer className="border-t border-[var(--line)] bg-white/50 py-4 text-center text-xs text-[var(--muted)]">
        OutfitLens · local-first image tools · not affiliated with Google Teachable Machine
      </footer>
    </div>
  );
}
