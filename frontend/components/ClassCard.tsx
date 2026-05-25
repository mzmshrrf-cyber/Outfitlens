'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { 
  Camera, Upload, Trash2, Edit3, Check, X,
  Video, VideoOff, RefreshCw, ChevronRight, FileImage, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ClassCardProps {
  className: string;
}

export default function ClassCard({ className: initialClassName }: ClassCardProps) {
  const {
    classes,
    selectedClassForCapture,
    webcamActive,
    cameraDeviceId,
    isWebcamDenied,
    renameClass,
    deleteClass,
    deleteSample,
    uploadSamples,
    setSelectedClassForCapture,
    setWebcamActive,
    setWebcamDenied,
    setCameraDeviceId
  } = useProjectStore();

  const targetClass = classes.find(c => c.name === initialClassName);
  const sampleCount = targetClass ? targetClass.count : 0;
  const previews = targetClass ? targetClass.previews : [];
  const classIndex = classes.findIndex(c => c.name === initialClassName);

  // Local UI State
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(initialClassName);
  const [isDragging, setIsDragging] = useState(false);
  const [isCapturingContinuous, setIsCapturingContinuous] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeSource, setActiveSource] = useState<'webcam' | 'upload' | null>(null);
  const [showKebabMenu, setShowKebabMenu] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);

  const isSelected = selectedClassForCapture === initialClassName;

  // Sync edited name with props
  useEffect(() => {
    setEditedName(initialClassName);
  }, [initialClassName]);

  // Load available camera devices
  useEffect(() => {
    if (isSelected && webcamActive && activeSource === 'webcam') {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(d => d.kind === 'videoinput');
          setCameras(videoDevices);
          if (videoDevices.length > 0 && !cameraDeviceId) {
            setCameraDeviceId(videoDevices[0].deviceId);
          }
        })
        .catch(err => console.error('Error listing cameras', err));
    }
  }, [isSelected, webcamActive, cameraDeviceId, setCameraDeviceId, activeSource]);

  // Handle active webcam stream lifecycle
  useEffect(() => {
    if (isSelected && webcamActive && activeSource === 'webcam') {
      const constraints: MediaStreamConstraints = {
        video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
        audio: false
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setWebcamDenied(false);
        })
        .catch(err => {
          console.error('Webcam access error', err);
          setWebcamDenied(true);
          setWebcamActive(false);
        });
    } else {
      stopWebcam();
    }

    return () => {
      stopWebcam();
    };
  }, [isSelected, webcamActive, cameraDeviceId, activeSource]);

  const stopWebcam = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setIsCapturingContinuous(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Camera frame extraction
  const captureSingleFrame = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const size = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - size) / 2;
      const sy = (video.videoHeight - size) / 2;
      
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `frame_${Date.now()}.jpg`, { type: 'image/jpeg' });
          uploadSamples(initialClassName, [file]).catch(err => console.error(err));
        }
      }, 'image/jpeg', 0.85);
    }
  };

  // Continuous Hold-to-Record capture
  const startContinuousCapture = () => {
    if (!webcamActive) return;
    setIsCapturingContinuous(true);
    
    captureSingleFrame();
    captureIntervalRef.current = setInterval(() => {
      captureSingleFrame();
    }, 200);
  };

  const stopContinuousCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setIsCapturingContinuous(false);
  };

  // Rename Class Handler
  const handleRename = async () => {
    const name = editedName.trim();
    if (!name || name === initialClassName) {
      setIsEditing(false);
      return;
    }
    try {
      await renameClass(initialClassName, name);
      setIsEditing(false);
    } catch (e: any) {
      alert(e.message);
      setEditedName(initialClassName);
    }
  };

  // Drag and drop events
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    dragCounterRef.current = 0;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files).filter(file => 
          file.type.startsWith('image/')
      );
      if (filesArray.length > 0) {
        try {
          await uploadSamples(initialClassName, filesArray);
        } catch (err: any) {
          alert(err.message);
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      try {
        await uploadSamples(initialClassName, filesArray);
      } catch (err: any) {
        alert(err.message);
      }
      e.target.value = '';
    }
  };

  const triggerWebcamSource = () => {
    setSelectedClassForCapture(initialClassName);
    setActiveSource('webcam');
    setWebcamActive(true);
  };

  const triggerUploadSource = () => {
    setSelectedClassForCapture(initialClassName);
    setActiveSource('upload');
    setWebcamActive(false);
  };

  const handleBackToOptions = () => {
    setActiveSource(null);
    setWebcamActive(false);
    stopWebcam();
  };

  return (
    <motion.div 
      layout
      id={`class-card-${initialClassName.replace(/\s+/g, '')}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`bg-white border border-[#dadce0] rounded-xl flex flex-col relative shadow-[0_1px_2px_0_rgba(60,64,67,0.3),_0_1px_3px_1px_rgba(60,64,67,0.15)] hover:shadow-[0_2px_6px_2px_rgba(60,64,67,0.15),_0_1px_2px_0_rgba(60,64,67,0.3)] transition-all duration-200 overflow-hidden ${
        isSelected ? 'ring-1 ring-[#1a73e8] border-[#1a73e8]' : ''
      }`}
    >
      {/* Google TM top index color stripe */}
      <div 
        className={`absolute top-0 left-0 right-0 h-1.5 class-bg-${classIndex !== -1 ? classIndex % 7 : 0}`} 
      />

      {/* Header controls */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between mt-1">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="px-2 py-0.5 text-sm rounded border border-[#1a73e8] focus:outline-none text-slate-800 font-bold bg-slate-50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
              <button onClick={handleRename} className="p-1 text-[#0f9d58] hover:bg-slate-100 rounded">
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setIsEditing(false); setEditedName(initialClassName); }} className="p-1 text-[#db4437] hover:bg-slate-100 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#202124] tracking-tight">{initialClassName}</h3>
              <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-[#5f6368] transition" title="Rename Class">
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Kebab Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowKebabMenu(!showKebabMenu)}
            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-450 hover:text-slate-700 transition"
            title="Class Actions"
          >
            <MoreVertical className="h-4.5 w-4.5" />
          </button>
          
          <AnimatePresence>
            {showKebabMenu && (
              <>
                {/* Backdrop overlay to close dropdown */}
                <div className="fixed inset-0 z-10" onClick={() => setShowKebabMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 mt-1 w-36 bg-white border border-[#dadce0] rounded-lg shadow-lg py-1 z-20"
                >
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setShowKebabMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Rename Class
                  </button>
                  <button
                    onClick={async () => {
                      setShowKebabMenu(false);
                      if (confirm(`Delete class "${initialClassName}"?`)) {
                        try {
                          await deleteClass(initialClassName);
                        } catch (e: any) {
                          alert(e.message);
                        }
                      }
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[#db4437] hover:bg-rose-50 transition"
                  >
                    Delete Class
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Full-bleed divider line */}
      <div className="border-b border-[#dadce0]" />

      {/* Main Content Area */}
      <div className="p-5 pt-4">
        {sampleCount === 0 && activeSource === null ? (
          /* Empty state: full width buttons side-by-side */
          <div className="flex flex-col gap-3 min-h-[120px] justify-center">
            <span className="text-[13px] font-bold text-[#5f6368]">
              Add Image Samples:
            </span>
            <div className="flex gap-4">
              {/* Webcam Button */}
              <button
                onClick={triggerWebcamSource}
                className="w-24 h-20 bg-[#e8f0fe] hover:bg-[#d2e3fc] border border-transparent hover:border-[#1a73e8] rounded-xl flex flex-col items-center justify-center gap-1.5 transition text-[#1a73e8] shadow-sm font-bold duration-150"
              >
                <Video className="h-6 w-6 stroke-[2.5]" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Webcam</span>
              </button>

              {/* Upload Button */}
              <button
                onClick={triggerUploadSource}
                className="w-24 h-20 bg-[#e8f0fe] hover:bg-[#d2e3fc] border border-transparent hover:border-[#1a73e8] rounded-xl flex flex-col items-center justify-center gap-1.5 transition text-[#1a73e8] shadow-sm font-bold duration-150"
              >
                <Upload className="h-6 w-6 stroke-[2.5]" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Upload</span>
              </button>
            </div>
          </div>
        ) : (
          /* Split grid layout: active source on left, samples list on right */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left Column (5 columns) */}
            <div className="md:col-span-5 flex flex-col min-h-[170px] justify-center">
              {activeSource === null ? (
                /* Choice view inside split column (if samples > 0 but source switch clicked) */
                <div className="flex flex-col gap-2.5 w-full">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Add Samples:</span>
                  <div className="flex gap-3">
                    <button
                      onClick={triggerWebcamSource}
                      className="flex-1 py-3 px-3 bg-[#e8f0fe] hover:bg-[#d2e3fc] border border-transparent hover:border-[#1a73e8] rounded-lg flex flex-col items-center gap-1 transition text-[#1a73e8] shadow-sm font-bold"
                    >
                      <Video className="h-5 w-5" />
                      <span className="text-[9px] uppercase tracking-wider">Webcam</span>
                    </button>
                    <button
                      onClick={triggerUploadSource}
                      className="flex-1 py-3 px-3 bg-[#e8f0fe] hover:bg-[#d2e3fc] border border-transparent hover:border-[#1a73e8] rounded-lg flex flex-col items-center gap-1 transition text-[#1a73e8] shadow-sm font-bold"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="text-[9px] uppercase tracking-wider">Upload</span>
                    </button>
                  </div>
                </div>
              ) : activeSource === 'webcam' ? (
                /* Webcam Stream active */
                <div className="flex flex-col gap-2 relative bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-hidden shadow-inner">
                  <div className="aspect-video w-full rounded bg-black overflow-hidden relative">
                    {webcamActive ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-[10px]">
                        Webcam stream off
                      </div>
                    )}
                    
                    {webcamActive && cameras.length > 1 && (
                      <select
                        value={cameraDeviceId}
                        onChange={(e) => setCameraDeviceId(e.target.value)}
                        className="absolute top-1.5 left-1.5 text-[8px] bg-black/60 border border-white/20 text-white px-1 py-0.5 rounded focus:outline-none"
                      >
                        {cameras.map(cam => (
                          <option key={cam.deviceId} value={cam.deviceId}>
                            {cam.label || `Cam ${cameras.indexOf(cam) + 1}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onMouseDown={startContinuousCapture}
                      onMouseUp={stopContinuousCapture}
                      onMouseLeave={stopContinuousCapture}
                      onTouchStart={startContinuousCapture}
                      onTouchEnd={stopContinuousCapture}
                      className={`flex-1 py-2 px-3 rounded-md text-[10px] font-bold select-none flex items-center justify-center gap-1.5 active:scale-95 transition-all duration-150 ${
                        isCapturingContinuous 
                          ? 'capture-active text-white'
                          : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-sm'
                      }`}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>{isCapturingContinuous ? 'RECORDING...' : 'HOLD TO RECORD'}</span>
                    </button>

                    <button
                      onClick={captureSingleFrame}
                      className="p-2 rounded-md bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition"
                      title="Capture 1 frame"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button 
                    onClick={handleBackToOptions}
                    className="text-[9px] text-slate-500 hover:text-[#db4437] font-bold uppercase tracking-wider self-center mt-0.5 flex items-center gap-0.5 transition"
                  >
                    <X className="h-2.5 w-2.5" />
                    <span>Switch source</span>
                  </button>
                </div>
              ) : (
                /* Upload Drag & Drop active */
                <div className="flex flex-col gap-2">
                  <div
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed relative cursor-pointer min-h-[125px] bg-slate-50 transition-all duration-150 ${
                      isDragging 
                        ? 'border-[#1a73e8] bg-blue-50/50' 
                        : 'border-slate-300 hover:border-slate-400 hover:bg-slate-100/50'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      multiple
                      accept="image/*"
                      className="hidden"
                    />
                    
                    <Upload className="h-5 w-5 text-slate-400 mb-1" />
                    <p className="text-[10px] text-slate-500 max-w-[120px] text-center leading-tight">
                      Drag files or click to choose
                    </p>
                  </div>

                  <button 
                    onClick={handleBackToOptions}
                    className="text-[9px] text-slate-500 hover:text-[#db4437] font-bold uppercase tracking-wider self-center flex items-center gap-0.5 transition"
                  >
                    <X className="h-2.5 w-2.5" />
                    <span>Switch source</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column (7 columns) */}
            <div className="md:col-span-7 md:border-l md:border-slate-100 md:pl-5 flex flex-col justify-start min-h-[170px]">
              <div className="flex items-center justify-between pb-1.5 mb-1.5">
                <span className="text-[11px] font-bold text-[#5f6368] uppercase tracking-wider">
                  {sampleCount} image samples
                </span>
              </div>

              {previews.length > 0 ? (
                <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-4 gap-1.5 overflow-y-auto max-h-[135px] pr-1 pb-1 scroll-smooth">
                  <AnimatePresence>
                    {previews.map((preview) => (
                      <motion.div
                        key={preview.id}
                        layout
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="aspect-square rounded border border-slate-200 overflow-hidden relative group bg-slate-100"
                      >
                        <img
                          src={preview.thumbnail}
                          alt="Sample Preview"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSample(initialClassName, preview.id);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white hover:text-[#db4437] transition duration-100"
                          title="Delete Image Sample"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-slate-200 bg-slate-50/50 rounded-lg text-slate-400 text-center gap-1 min-h-[125px]">
                  <FileImage className="h-5 w-5 text-slate-300" />
                  <p className="text-[9px] font-medium leading-relaxed max-w-[150px] mx-auto text-slate-400">
                    No samples added. Record using your webcam or upload image folders.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

