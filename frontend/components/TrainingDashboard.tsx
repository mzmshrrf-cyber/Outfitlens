'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { 
  Play, RotateCcw, ChevronDown, ChevronUp, 
  Terminal, BarChart2, Cpu, Grid, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TrainingDashboard() {
  const { 
    classes, 
    backendOnline, 
    trainingStatus, 
    trainingLogs, 
    trainingMetrics, 
    train 
  } = useProjectStore();

  // Advanced configurations dropdown state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [epochs, setEpochs] = useState(50);
  const [batchSize, setBatchSize] = useState(16);
  const [learningRate, setLearningRate] = useState(0.001);

  // Under the Hood drawer state
  const [showUnderTheHood, setShowUnderTheHood] = useState(false);

  // Simulated Epoch tracking for Google-like UX
  const [currentSimulatedEpoch, setCurrentSimulatedEpoch] = useState(0);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isTraining = trainingStatus === 'training';
  const totalSamples = classes.reduce((sum, c) => sum + c.count, 0);

  // Verify training activation criteria
  const canTrain = backendOnline && 
                    classes.length >= 2 && 
                    classes.every(c => c.count > 0) &&
                    !isTraining;

  // Auto scroll console shell logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [trainingLogs]);

  // Simulate Epoch Training Progress for authentic deep learning feel
  useEffect(() => {
    if (isTraining) {
      setCurrentSimulatedEpoch(1);
      // We increment simulated epochs to match the expected epochs count during training duration (~1.5s)
      const durationPerEpoch = Math.max(20, Math.floor(1500 / epochs));
      
      simIntervalRef.current = setInterval(() => {
        setCurrentSimulatedEpoch((prev) => {
          if (prev >= epochs) {
            if (simIntervalRef.current) clearInterval(simIntervalRef.current);
            return epochs;
          }
          return prev + 1;
        });
      }, durationPerEpoch);
    } else {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      setCurrentSimulatedEpoch(0);
    }

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isTraining, epochs]);

  const handleTrainClick = async () => {
    if (!canTrain) return;
    try {
      await train();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. Main Training Card */}
      <div id="training-card" className="bg-white border border-[#dadce0] rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),_0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),_0_1px_2px_0_rgba(60,64,67,0.3)] transition duration-200">
        <div className="pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#202124] tracking-tight">Training</h2>
        </div>
        <div className="border-b border-[#dadce0] -mx-5 mb-4" />

        <div className="flex flex-col gap-4">
          {/* Train Button */}
          <button
            onClick={handleTrainClick}
            disabled={!canTrain}
            className={`w-full py-3.5 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.98] ${
              isTraining
                ? 'bg-[#e8eaed] text-[#80868b] border-none cursor-wait'
                : canTrain
                ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white border-none'
                : 'bg-[#e8eaed] text-[#80868b] border-none cursor-not-allowed'
            }`}
          >
            {isTraining ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-800 border-t-transparent rounded-full animate-spin mr-1" />
                <span>Training (Epoch {currentSimulatedEpoch}/{epochs})</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current mr-0.5" />
                <span>Train Model</span>
              </>
            )}
          </button>

          {/* Status info/helpers */}
          {!backendOnline && (
            <div className="p-2.5 bg-rose-50 border border-[#fad2cf] rounded-md text-[10px] text-[#db4437] leading-normal font-medium flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#db4437] shrink-0" />
              <span>Python backend server is offline at port 8000.</span>
            </div>
          )}
          {backendOnline && classes.length < 2 && (
            <div className="p-2.5 bg-slate-50 border border-[#dadce0] rounded-md text-[10px] text-[#5f6368] leading-normal font-medium">
              Add at least 2 distinct classes to train your classifier.
            </div>
          )}
          {backendOnline && classes.length >= 2 && classes.some(c => c.count === 0) && (
            <div className="p-2.5 bg-slate-50 border border-[#dadce0] rounded-md text-[10px] text-[#5f6368] leading-normal font-medium">
              Record samples or upload images to activate training.
            </div>
          )}

          <div className="border-b border-[#dadce0] -mx-5 my-3" />

          {/* 2. Advanced parameters accordion */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 transition py-1"
            >
              <span>Advanced</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden flex flex-col gap-3 mt-3 pt-3 border-t border-slate-100"
                >
                  {/* Epochs */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5f6368] font-medium">Epochs:</span>
                    <input
                      type="number"
                      value={epochs}
                      onChange={(e) => setEpochs(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={isTraining}
                      className="w-20 px-2 py-1 text-center font-bold text-[#202124] bg-slate-50 border border-[#dadce0] rounded focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                    />
                  </div>

                  {/* Batch Size */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5f6368] font-medium">Batch Size:</span>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value))}
                      disabled={isTraining}
                      className="w-20 px-1 py-1 text-center font-bold text-[#202124] bg-slate-50 border border-[#dadce0] rounded focus:outline-none"
                    >
                      <option value={16}>16</option>
                      <option value={32}>32</option>
                      <option value={64}>64</option>
                      <option value={128}>128</option>
                    </select>
                  </div>

                  {/* Learning Rate */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5f6368] font-medium">Learning Rate:</span>
                    <select
                      value={learningRate}
                      onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                      disabled={isTraining}
                      className="w-20 px-1 py-1 text-center font-bold text-[#202124] bg-slate-50 border border-[#dadce0] rounded focus:outline-none"
                    >
                      <option value={0.001}>0.001</option>
                      <option value={0.0001}>0.0001</option>
                      <option value={0.01}>0.01</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 3. Under the Hood collapsible panel (Model Analytics) */}
      <div className="bg-white border border-[#dadce0] rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),_0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),_0_1px_2px_0_rgba(60,64,67,0.3)] transition duration-200">
        <button
          onClick={() => setShowUnderTheHood(!showUnderTheHood)}
          className="w-full flex items-center justify-between border-b border-slate-100 pb-2 mb-3 text-sm font-bold text-[#202124] hover:text-[#5f6368] transition"
        >
          <div className="flex items-center gap-1.5">
            <BarChart2 className="h-4.5 w-4.5 text-[#1a73e8]" />
            <span>Model Analytics</span>
          </div>
          {showUnderTheHood ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <AnimatePresence>
          {showUnderTheHood && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden flex flex-col gap-4"
            >
              {trainingMetrics ? (
                <div className="flex flex-col gap-4">
                  {/* General metrics cards */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-[#e6f4ea] border border-[#ceead6] p-2.5 rounded-lg">
                      <p className="text-xl font-bold text-[#0f9d58]">{(trainingMetrics.accuracy * 100).toFixed(1)}%</p>
                      <p className="text-[8px] text-[#5f6368] font-bold uppercase tracking-wider mt-0.5">Accuracy</p>
                    </div>
                    <div className="bg-slate-50 border border-[#dadce0] p-2.5 rounded-lg">
                      <p className="text-xl font-bold text-[#202124] font-mono">{trainingMetrics.training_time_seconds.toFixed(2)}s</p>
                      <p className="text-[8px] text-[#5f6368] font-bold uppercase tracking-wider mt-0.5">Fit Duration</p>
                    </div>
                  </div>

                  {/* Confusion Matrix heat map grid */}
                  {trainingMetrics.confusion_matrix && (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-[#5f6368] tracking-wider uppercase flex items-center gap-1">
                        <Grid className="h-3 w-3 text-[#1a73e8]" />
                        <span>Confusion Matrix</span>
                      </p>
                      <div className="bg-slate-50 p-3 rounded-lg border border-[#dadce0]">
                        <div 
                          className="grid gap-1 text-center" 
                          style={{ gridTemplateColumns: `repeat(${trainingMetrics.classes.length}, minmax(0, 1fr))` }}
                        >
                          {trainingMetrics.confusion_matrix.map((row, rowIdx) => 
                            row.map((val, colIdx) => {
                              const isDiagonal = rowIdx === colIdx;
                              let cellClass = 'bg-white text-slate-350 border-slate-100';
                              
                              if (val > 0) {
                                cellClass = isDiagonal 
                                  ? 'bg-[#e6f4ea] text-[#0f9d58] border-[#ceead6]' 
                                  : 'bg-[#fce8e6] text-[#db4437] border-[#fad2cf]';
                              }
                              
                              return (
                                <div 
                                  key={`${rowIdx}-${colIdx}`} 
                                  className={`p-1.5 border rounded font-mono text-[10px] font-bold shadow-sm ${cellClass}`}
                                  title={`True: ${trainingMetrics.classes[rowIdx]}, Predicted: ${trainingMetrics.classes[colIdx]}`}
                                >
                                  {val}
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div className="flex justify-between items-center text-[7px] text-[#80868b] font-bold uppercase tracking-widest mt-2 px-0.5">
                          <span>True ➜</span>
                          <span>Predicted ➜</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-5 text-center text-slate-400 gap-1.5 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                  <Cpu className="h-6 w-6 text-slate-300" />
                  <p className="text-[10px] font-medium leading-relaxed max-w-[185px]">
                    Analytics are calculated instantly upon successful training cycles.
                  </p>
                </div>
              )}

              {/* Terminal shell logs */}
              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold text-[#5f6368] tracking-wider uppercase flex items-center gap-1">
                  <Terminal className="h-3 w-3 text-[#1a73e8]" />
                  <span>Training Logs</span>
                </p>
                <div className="h-36 bg-[#202124] rounded-lg p-2.5 font-mono text-[9px] overflow-y-auto flex flex-col gap-1 text-[#f1f3f4] scroll-smooth shadow-inner">
                  {trainingLogs.length === 0 ? (
                    <p className="text-slate-500 italic">No logs recorded. Train model to see logs.</p>
                  ) : (
                    trainingLogs.map((log, idx) => {
                      const isError = log.includes('[Error]');
                      const isSuccess = log.includes('successfully') || log.includes('Accuracy:');
                      
                      let textColor = 'text-[#f1f3f4]';
                      if (isError) textColor = 'text-[#db4437] font-bold';
                      else if (isSuccess) textColor = 'text-[#0f9d58] font-bold';
                      
                      return (
                        <div key={idx} className={`leading-normal ${textColor}`}>
                          {log}
                        </div>
                      );
                    })
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
