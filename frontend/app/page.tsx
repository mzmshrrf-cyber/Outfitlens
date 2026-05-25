'use client';

import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import ClassCard from '../components/ClassCard';
import Predictor from '../components/Predictor';
import TrainingDashboard from '../components/TrainingDashboard';
import ConnectorLines from '../components/ConnectorLines';
import { useProjectStore } from '../store/useProjectStore';
import { Plus } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

export default function Home() {
  const {
    classes,
    backendOnline,
    isCheckingStatus,
    checkBackendStatus,
    loadClasses,
    addClass
  } = useProjectStore();

  // 1. Initial health ping and sync dataset classes
  useEffect(() => {
    const initApp = async () => {
      const isOnline = await checkBackendStatus();
      if (isOnline) {
        await loadClasses();
      }
    };
    initApp();
  }, [checkBackendStatus, loadClasses]);

  // 2. Prepopulate 2 default classes if starting a fresh project (0 classes)
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

  // 3. Action to append a new class automatically (e.g. Class 3, Class 4)
  const handleAddNewClass = async () => {
    let suffix = classes.length + 1;
    let name = `Class ${suffix}`;
    
    // Ensure we do not duplicate names in edge cases
    while (classes.some(c => c.name.toLowerCase() === name.toLowerCase())) {
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
    <div className="flex flex-col min-h-screen bg-[#f1f3f4] relative overflow-hidden">
      {/* Navbar Header */}
      <Navbar />

      {/* Dynamic SVG Workflow lines layer behind elements */}
      <ConnectorLines />

      {/* Main Core 3-Column Workspace Canvas */}
      <main className="flex-grow flex flex-col lg:flex-row gap-0 pt-28 pb-12 px-8 max-w-[1600px] mx-auto w-full items-start justify-center relative z-10">
        
        {/* Column 1: Classes & Datasets (~45% width on desktop) */}
        <section className="flex-1 flex flex-col gap-4 lg:max-w-2xl w-full">
          <div className="flex flex-col gap-4 w-full">
            <AnimatePresence mode="popLayout">
              {classes.map((cls) => (
                <ClassCard key={cls.name} className={cls.name} />
              ))}
            </AnimatePresence>
            
            {/* Google TM Style "+ Add a class" Dashed Card at the bottom of the list */}
            <button
              onClick={handleAddNewClass}
              className="w-full py-4 border-2 border-dashed border-[#dadce0] hover:border-[#1a73e8] bg-white/70 hover:bg-white text-slate-500 hover:text-[#1a73e8] rounded-xl flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-[0.99]"
            >
              <Plus className="h-4.5 w-4.5" />
              <span>Add a class</span>
            </button>
          </div>
        </section>

        {/* Spacing gap for dynamic SVG connector lines */}
        <div className="hidden lg:block shrink-0 w-16" />

        {/* Column 2: Training Controls & Advanced Parameters (~22% width) */}
        <section className="w-full lg:w-72 shrink-0">
          <TrainingDashboard />
        </section>

        {/* Spacing gap for dynamic SVG connector lines */}
        <div className="hidden lg:block shrink-0 w-16" />

        {/* Column 3: Live Inference Test, Predictions, and Export (~33% width) */}
        <section className="flex-1 lg:max-w-md w-full shrink-0">
          <Predictor />
        </section>

      </main>
    </div>
  );
}
