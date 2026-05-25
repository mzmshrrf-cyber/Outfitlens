'use client';

import React, { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { api } from '../services/api';
import { 
  Plus, Play, RotateCcw, Download, 
  FolderHeart, BarChart4, AlertTriangle, Layers, Info
} from 'lucide-react';

export default function Sidebar() {
  const { 
    classes, 
    backendOnline, 
    trainingStatus, 
    train, 
    addClass, 
    resetProject 
  } = useProjectStore();

  const [newClassName, setNewClassName] = useState('');
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const totalSamples = classes.reduce((sum, c) => sum + c.count, 0);
  const isTraining = trainingStatus === 'training';
  
  // Verify we meet training criteria: at least 2 classes, each has at least 1 image
  const canTrain = backendOnline && 
                    classes.length >= 2 && 
                    classes.every(c => c.count > 0) &&
                    !isTraining;

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    try {
      addClass(name);
      setNewClassName('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportModel = () => {
    // Navigate directly to backend export endpoint
    window.location.href = api.exportModelUrl();
  };

  return (
    <aside className="w-full lg:w-80 flex flex-col gap-6 bg-slate-950/40 p-6 border-r border-white/5 h-full">
      {/* Dynamic Class Creator */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          <Layers className="h-4 w-4 text-brand-400" />
          <span>Class Manager</span>
        </div>
        
        <form onSubmit={handleAddClass} className="flex gap-2">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Add class (e.g. Cat)"
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-900 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
          />
          <button
            type="submit"
            disabled={!newClassName.trim()}
            className="p-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 active:scale-95 transition"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
      </div>

      <hr className="border-white/5" />

      {/* Dataset Summary */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          <BarChart4 className="h-4 w-4 text-brand-400" />
          <span>Dataset Summary</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-center">
            <p className="text-2xl font-extrabold text-white">{classes.length}</p>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">Classes</p>
          </div>
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 text-center">
            <p className="text-2xl font-extrabold text-white">{totalSamples}</p>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-1">Samples</p>
          </div>
        </div>
      </div>

      <hr className="border-white/5" />

      {/* Training Action Center */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          <FolderHeart className="h-4 w-4 text-brand-400" />
          <span>ML Engine Dashboard</span>
        </div>

        {/* Train Trigger */}
        <button
          onClick={() => train()}
          disabled={!canTrain}
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm tracking-wide shadow-xl transition-all duration-300 active:scale-[0.98] ${
            isTraining
              ? 'bg-gradient-to-r from-warning/80 to-amber-500/80 text-black cursor-wait animate-pulse'
              : canTrain
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white hover:scale-[1.01] glow-pulse-brand shadow-brand-500/20'
              : 'bg-slate-900 border border-white/5 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isTraining ? (
            <>
              <RotateCcw className="h-5 w-5 animate-spin" />
              <span>TRAINING MODEL...</span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5 fill-current" />
              <span>TRAIN CLASSIFIER</span>
            </>
          )}
        </button>

        {/* Info Helpers */}
        {!backendOnline && (
          <div className="flex gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-xs text-error">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Backend ML server is offline. Check connection or start Python server first.</p>
          </div>
        )}
        
        {backendOnline && classes.length < 2 && (
          <div className="flex gap-2 p-3 bg-slate-900 border border-white/5 rounded-lg text-xs text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-brand-400" />
            <p>Add at least 2 distinct classes to activate training.</p>
          </div>
        )}

        {backendOnline && classes.length >= 2 && classes.some(c => c.count === 0) && (
          <div className="flex gap-2 p-3 bg-slate-900 border border-white/5 rounded-lg text-xs text-slate-400">
            <Info className="h-4 w-4 shrink-0 text-brand-400" />
            <p>Every class must contain at least 1 image sample before training.</p>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {/* Model Export */}
        <button
          onClick={handleExportModel}
          disabled={!backendOnline || trainingStatus !== 'success'}
          className="w-full py-2.5 rounded-lg bg-slate-900 border border-white/10 hover:border-brand-500 hover:text-brand-300 disabled:opacity-50 text-slate-300 font-semibold text-xs tracking-wide flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Download className="h-4 w-4" />
          <span>EXPORT TRAINED MODEL (.ZIP)</span>
        </button>

        {/* Reset Project */}
        {showConfirmReset ? (
          <div className="bg-slate-900 p-3 rounded-lg border border-error/30 flex flex-col gap-2.5 animate-fade-in">
            <p className="text-[11px] text-error font-medium leading-relaxed">
              Are you sure? This will wipe the dataset folder and the active model from disk.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await resetProject();
                    setShowConfirmReset(false);
                  } catch (e: any) {
                    alert(e.message);
                  }
                }}
                className="flex-1 py-1 rounded bg-error text-white font-bold text-xs hover:bg-red-500"
              >
                Yes, Wipe All
              </button>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-1 rounded bg-slate-800 text-slate-350 font-bold text-xs hover:bg-slate-750"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmReset(true)}
            className="w-full py-2 rounded-lg bg-transparent border border-transparent text-slate-500 hover:text-error hover:bg-error/5 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Project</span>
          </button>
        )}
      </div>
    </aside>
  );
}
