'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { api } from '../services/api';
import { 
  Play, StopCircle, Video, Camera, Info, 
  TrendingUp, Award, AlertCircle, Upload, FileImage, RefreshCw,
  Download, RotateCcw, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Predictor() {
  const {
    classes,
    backendOnline,
    trainingStatus,
    isPredicting,
    predictionResult,
    setPredicting,
    predictFrame,
    resetProject
  } = useProjectStore();

  // Ingestion Modes: 'webcam' | 'file'
  const [inputType, setInputType] = useState<'webcam' | 'file'>('webcam');
  const [inputActive, setInputActive] = useState(true); // ON / OFF input toggle switch
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [predictionLatency, setPredictionLatency] = useState<number>(0);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loopRef = useRef<NodeJS.Timeout | null>(null);
  
  const isModelTrained = trainingStatus === 'success';

  // Force stop everything if input switch is toggled OFF
  useEffect(() => {
    if (!inputActive) {
      stopTestingCamera();
      setPredicting(false);
    }
  }, [inputActive, setPredicting]);

  // Terminate camera stream when switching modes
  useEffect(() => {
    if (inputType !== 'webcam') {
      stopTestingCamera();
      setPredicting(false);
    }
  }, [inputType, setPredicting]);

  // Manage webcam stream dedicated to live testing
  useEffect(() => {
    if (inputActive && inputType === 'webcam' && isPredicting && isModelTrained) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
        .then(stream => {
          setLocalStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraError(null);
        })
        .catch(err => {
          console.error('Inference webcam error', err);
          setCameraError('Webcam access denied. Ensure another app is not using the camera.');
          setPredicting(false);
        });
    } else {
      stopTestingCamera();
    }

    return () => {
      stopTestingCamera();
    };
  }, [isPredicting, isModelTrained, inputType, inputActive]);

  const stopTestingCamera = () => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Prediction loop running at 300ms intervals (Webcam)
  useEffect(() => {
    if (inputActive && inputType === 'webcam' && isPredicting && localStream && isModelTrained) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
      const ctx = canvas.getContext('2d');

      const predictTick = async () => {
        if (!video || video.paused || video.ended || !ctx) return;
        
        // Draw centered square frame from webcam
        const size = Math.min(video.videoWidth, video.videoHeight);
        if (size === 0) return; // Video not loaded yet
        
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);
        
        try {
          const base64Image = canvas.toDataURL('image/jpeg', 0.8);
          
          const start = performance.now();
          await predictFrame(base64Image);
          const end = performance.now();
          setPredictionLatency(end - start);
        } catch (e) {
          console.error('Predict frame failure', e);
        }
      };

      loopRef.current = setInterval(predictTick, 300);
    } else {
      if (loopRef.current) {
        clearInterval(loopRef.current);
        loopRef.current = null;
      }
    }

    return () => {
      if (loopRef.current) {
        clearInterval(loopRef.current);
      }
    };
  }, [isPredicting, localStream, isModelTrained, predictFrame, inputType, inputActive]);

  // Static File Prediction Handler
  const handleFilePredict = async (base64Image: string) => {
    if (!inputActive || !isModelTrained || !backendOnline) return;
    
    try {
      const start = performance.now();
      const result = await api.predictImage(base64Image);
      
      // Update global Zustand store predictions manually
      useProjectStore.setState({ 
        predictionResult: result,
        isPredicting: true
      });
      
      const end = performance.now();
      setPredictionLatency(end - start);
    } catch (e) {
      console.error('File prediction error', e);
      alert('Failed to predict the uploaded image. Check backend status.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAndPredictFile(file);
  };

  const processAndPredictFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFilePreview(base64);
      handleFilePredict(base64);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop event handlers for file predict
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processAndPredictFile(file);
    }
  };

  const handleExportModel = () => {
    window.location.href = api.exportModelUrl();
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Main Preview Card */}
      <div id="preview-card" className="bg-white border border-[#dadce0] rounded-xl p-5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),_0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),_0_1px_2px_0_rgba(60,64,67,0.3)] transition duration-200">
        <div className="flex items-center justify-between pb-3 mt-1">
          <h2 className="text-base font-bold text-[#202124] tracking-tight">Preview</h2>
          
          {/* Export Model button in header */}
          <button
            onClick={handleExportModel}
            disabled={!backendOnline || !isModelTrained}
            className={`px-3 py-1.5 rounded-md font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all duration-150 border ${
              isModelTrained
                ? 'bg-white border-[#dadce0] hover:border-[#1a73e8] hover:text-[#1a73e8] text-slate-700 shadow-sm cursor-pointer'
                : 'bg-[#f1f3f4] border-[#dadce0] text-slate-400 cursor-not-allowed'
            }`}
          >
            <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Export Model</span>
          </button>
        </div>

        {/* Full-bleed divider line */}
        <div className="border-b border-[#dadce0] -mx-5" />

        {/* Prediction view body */}
        <div className="mt-4">
          {!isModelTrained ? (
            /* Google TM Style: Untrained message bottom half */
            <div className="flex flex-col items-center justify-center bg-[#f8f9fa] border-t border-[#dadce0] -mx-5 -mb-5 p-8 text-center min-h-[170px]">
              <p className="text-[12px] text-slate-500 font-medium leading-relaxed max-w-[210px]">
                You must train a model on the left before you can preview it here.
              </p>
            </div>
          ) : (
            /* Trained Preview Feed & Live inference test components */
            <div className="flex flex-col gap-4">
              {/* Input Switch & Webcam/File toggle row */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                {/* Input ON/OFF Switch */}
                <div className="flex items-center gap-1.5 border border-[#dadce0] px-2.5 py-1 rounded-full bg-slate-50">
                  <span className="text-[10px] font-bold text-[#5f6368] uppercase tracking-wider">
                    Input: {inputActive ? 'ON' : 'OFF'}
                  </span>
                  <button
                    onClick={() => setInputActive(!inputActive)}
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                      inputActive ? 'bg-[#1a73e8]' : 'bg-slate-350'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
                        inputActive ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Webcam/File Toggler */}
                {inputActive && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-[#dadce0]">
                    <button
                      onClick={() => setInputType('webcam')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[9px] uppercase tracking-wide flex items-center gap-1 transition-all ${
                        inputType === 'webcam'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Camera className="h-3 w-3" />
                      <span>Webcam</span>
                    </button>
                    <button
                      onClick={() => setInputType('file')}
                      className={`px-2.5 py-1 rounded-md font-bold text-[9px] uppercase tracking-wide flex items-center gap-1 transition-all ${
                        inputType === 'file'
                          ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileImage className="h-3 w-3" />
                      <span>File</span>
                    </button>
                  </div>
                )}
              </div>

              {!inputActive ? (
                /* Input Turned Off Slate */
                <div className="aspect-square w-full rounded-lg border border-[#dadce0] bg-slate-100/50 flex flex-col items-center justify-center text-center p-6 gap-3">
                  <EyeOff className="h-8 w-8 text-slate-350 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold text-[#202124]">Live Test Input Inactive</p>
                    <p className="text-[10px] text-slate-500 max-w-[200px] mx-auto mt-0.5 leading-normal">
                      Turn the input switch to **ON** to start feeding video/files into the model.
                    </p>
                  </div>
                  <button
                    onClick={() => setInputActive(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-[10px] uppercase tracking-wider shadow-sm transition"
                  >
                    Turn Input ON
                  </button>
                </div>
              ) : inputType === 'webcam' ? (
                /* Webcam live test view */
                <div className="aspect-square w-full rounded-lg border border-[#dadce0] bg-slate-50 overflow-hidden relative flex flex-col items-center justify-center text-center shadow-inner">
                  {isPredicting ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  ) : (
                    <div className="p-4 flex flex-col items-center gap-2">
                      <div className="p-2.5 rounded-full bg-slate-100 text-slate-400">
                        <Video className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#202124]">Webcam Test Feed</p>
                        <p className="text-[10px] text-[#5f6368] max-w-[190px] mx-auto mt-0.5 leading-tight">
                          Click "Start" below to run model predictions on your camera stream.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Glowing match tag */}
                  {isPredicting && predictionResult && (
                    <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur border border-[#dadce0] shadow-md px-2.5 py-1.5 rounded-md flex items-center gap-1.5 animate-fade-in">
                      <Award className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[10px] text-slate-500 font-bold">Match:</span>
                      <span className="text-[10px] font-extrabold text-[#202124] uppercase">{predictionResult.predicted_class}</span>
                      <span className="text-[9px] text-white font-extrabold bg-[#1a73e8] px-1 py-0.5 rounded">
                        {(predictionResult.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Static file drop predict box */
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`aspect-square w-full rounded-lg border-2 border-dashed overflow-hidden relative flex flex-col items-center justify-center text-center cursor-pointer transition ${
                    isDragging 
                      ? 'border-[#1a73e8] bg-blue-50/50' 
                      : filePreview 
                      ? 'border-[#dadce0] bg-slate-150' 
                      : 'border-slate-350 bg-slate-50 hover:border-slate-400 hover:bg-slate-100/50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                    disabled={!isModelTrained}
                  />
                  
                  {filePreview ? (
                    <div className="w-full h-full relative group">
                      <img
                        src={filePreview}
                        alt="Static testing upload"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition duration-150">
                        <Upload className="h-4.5 w-4.5 text-white" />
                        <span className="text-[10px] text-white font-bold">Replace image</span>
                      </div>
                      
                      {/* Glowing match tag */}
                      {predictionResult && (
                        <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur border border-[#dadce0] shadow-md px-2.5 py-1.5 rounded-md flex items-center gap-1.5 animate-fade-in">
                          <Award className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-[10px] text-slate-500 font-bold">Match:</span>
                          <span className="text-[10px] font-extrabold text-[#202124] uppercase">{predictionResult.predicted_class}</span>
                          <span className="text-[9px] text-white font-extrabold bg-[#1a73e8] px-1.5 py-0.5 rounded">
                            {(predictionResult.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 flex flex-col items-center gap-2">
                      <div className="p-2.5 rounded-full bg-slate-100 text-slate-400">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#202124]">Drag & Drop Test Image</p>
                        <p className="text-[10px] text-slate-500 max-w-[190px] mx-auto mt-0.5 leading-tight">
                          Select or drop a photo to see instant predictions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {cameraError && inputType === 'webcam' && inputActive && (
                <div className="flex gap-2 p-2.5 bg-rose-50 border border-[#fad2cf] rounded text-[10px] text-[#db4437]">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <p className="font-medium">{cameraError}</p>
                </div>
              )}

              {/* Live webcam predicted loop control toggle button */}
              {inputType === 'webcam' && inputActive && (
                <button
                  onClick={() => setPredicting(!isPredicting)}
                  disabled={!isModelTrained || !backendOnline}
                  className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-all duration-200 active:scale-98 shadow-sm ${
                    isPredicting
                      ? 'bg-rose-50 border-[#fad2cf] text-[#db4437] hover:bg-rose-100/70'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0] border-[#1a73e8] text-white'
                  }`}
                >
                  {isPredicting ? (
                    <>
                      <StopCircle className="h-4 w-4" />
                      <span>Stop Live Prediction</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      <span>Start Live Testing</span>
                    </>
                  )}
                </button>
              )}

              {/* Output probabilities lists */}
              <div className="flex flex-col gap-2.5 mt-2 border-t border-slate-100 pt-4">
                <h3 className="text-[10px] font-bold text-[#5f6368] tracking-wider uppercase flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-[#1a73e8]" />
                  <span>Output Probabilities</span>
                </h3>
                
                <div className="flex flex-col gap-2">
                  {classes.map((cls, idx) => {
                    const confidenceVal = predictionResult?.probabilities?.[cls.name] || 0;
                    const pct = (confidenceVal * 100).toFixed(1);
                    
                    return (
                      <div key={cls.name} className="flex items-center gap-3 p-2 bg-slate-50 border border-[#dadce0] rounded-lg shadow-sm">
                        <div className={`h-3 w-3 rounded-sm class-bg-${idx % 7} shrink-0`} />
                        
                        <span className="text-[11px] font-bold text-[#202124] capitalize truncate w-24">
                          {cls.name}
                        </span>

                        <div className="flex-1 h-3.5 bg-slate-200 border border-slate-300 rounded overflow-hidden relative shadow-inner">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.1, ease: 'easeOut' }}
                            className={`h-full rounded-l class-bar-${idx % 7}`}
                          />
                        </div>

                        <span className="w-12 text-right text-[11px] font-bold text-[#202124] font-mono shrink-0">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {backendOnline && isModelTrained && predictionLatency > 0 && inputActive && (
                <div className="flex items-center justify-between px-0.5 mt-1">
                  <p className="text-[9px] text-slate-400 font-bold tracking-wide uppercase">
                    Latency: <span className="text-[#202124] font-bold">{predictionLatency.toFixed(1)}ms</span>
                  </p>
                  {filePreview && inputType === 'file' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilePreview(null);
                        useProjectStore.setState({ predictionResult: null, isPredicting: false });
                      }}
                      className="text-[9px] text-[#5f6368] hover:text-[#db4437] font-bold transition flex items-center gap-1"
                    >
                      <RefreshCw className="h-2.5 w-2.5" />
                      <span>Clear testing file</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unified Reset block below Preview Card */}
      <div className="bg-white border border-[#dadce0] rounded-xl p-4 flex flex-col gap-2.5 shadow-[0_1px_2px_0_rgba(60,64,67,0.3),_0_1px_3px_1px_rgba(60,64,67,0.15)]">
        {showConfirmReset ? (
          <div className="bg-rose-50 p-3 rounded-lg border border-[#fad2cf] flex flex-col gap-2 animate-fade-in">
            <p className="text-[10px] text-[#db4437] font-bold leading-normal">
              Warning: Resetting deletes the dataset folders and the trained model from disk.
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    await resetProject();
                    setFilePreview(null);
                    setShowConfirmReset(false);
                  } catch (e: any) {
                    alert(e.message);
                  }
                }}
                className="flex-1 py-1 bg-[#db4437] hover:bg-[#b0352a] text-white font-bold text-[10px] rounded shadow-sm"
              >
                Yes, Reset All
              </button>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-1 bg-white border border-[#dadce0] text-[#5f6368] font-bold text-[10px] rounded hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmReset(true)}
            className="w-full py-1.5 rounded-lg bg-transparent border border-transparent text-[#80868b] hover:text-[#db4437] hover:bg-rose-50/50 text-[10px] font-bold tracking-wide flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Workspace</span>
          </button>
        )}
      </div>
    </div>
  );
}
