import { create } from 'zustand';
import { api, ClassData, TrainingMetrics, PredictionResult, HealthStatus, DeepEvaluationResult } from '../services/api';

interface ProjectState {
  // Data State
  classes: ClassData[];
  backendOnline: boolean;
  isCheckingStatus: boolean;
  
  // Training State
  trainingStatus: 'idle' | 'training' | 'success' | 'error';
  trainingLogs: string[];
  trainingMetrics: TrainingMetrics | null;
  errorMessage: string | null;
  
  // Evaluation State
  evaluationResult: DeepEvaluationResult | null;
  isEvaluating: boolean;
  
  // Prediction State
  isPredicting: boolean;
  predictionResult: PredictionResult | null;
  
  // UI / Webcam Settings
  selectedClassForCapture: string | null;
  webcamActive: boolean;
  cameraDeviceId: string;
  isWebcamDenied: boolean;
  
  // Actions
  checkBackendStatus: () => Promise<boolean>;
  loadClasses: () => Promise<void>;
  addClass: (name: string) => Promise<void>;
  renameClass: (oldName: string, newName: string) => Promise<void>;
  deleteClass: (name: string) => Promise<void>;
  deleteSample: (className: string, sampleId: string) => Promise<void>;
  uploadSamples: (className: string, files: File[]) => Promise<void>;
  
  // Training Actions
  train: () => Promise<void>;
  evaluate: () => Promise<void>;
  clearLogs: () => void;
  
  // Prediction Actions
  setPredicting: (isPredicting: boolean) => void;
  predictFrame: (base64Image: string) => Promise<void>;
  
  // Project Actions
  resetProject: () => Promise<void>;
  setSelectedClassForCapture: (className: string | null) => void;
  setWebcamActive: (active: boolean) => void;
  setCameraDeviceId: (deviceId: string) => void;
  setWebcamDenied: (denied: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  classes: [],
  backendOnline: false,
  isCheckingStatus: true,
  
  trainingStatus: 'idle',
  trainingLogs: [],
  trainingMetrics: null,
  errorMessage: null,
  
  evaluationResult: null,
  isEvaluating: false,
  
  isPredicting: false,
  predictionResult: null,
  
  selectedClassForCapture: null,
  webcamActive: false,
  cameraDeviceId: '',
  isWebcamDenied: false,

  // Backend Health check
  checkBackendStatus: async () => {
    set({ isCheckingStatus: true });
    try {
      const health = await api.checkHealth();
      set({ backendOnline: health.status === 'healthy', isCheckingStatus: false });
      return true;
    } catch (e) {
      set({ backendOnline: false, isCheckingStatus: false });
      return false;
    }
  },

  // Dataset loader
  loadClasses: async () => {
    try {
      const data = await api.fetchClasses();
      set({ classes: data.classes });
      
      // Update selected class for capture if it is not selected or no longer exists
      const { selectedClassForCapture, classes } = get();
      if (classes.length > 0 && (!selectedClassForCapture || !classes.some(c => c.name === selectedClassForCapture))) {
        set({ selectedClassForCapture: classes[0].name });
      }
    } catch (e) {
      console.error('Failed to load dataset classes from backend', e);
    }
  },

  // Add custom class
  addClass: async (name: string) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    
    const { classes } = get();
    if (classes.some(c => c.name.toLowerCase() === cleaned.toLowerCase())) {
      throw new Error(`Class "${cleaned}" already exists.`);
    }

    // Optimistically add class to UI
    const newClass: ClassData = {
      name: cleaned,
      count: 0,
      previews: []
    };
    
    set({ 
      classes: [...classes, newClass],
      selectedClassForCapture: get().selectedClassForCapture || cleaned
    });
  },

  // Rename custom class
  renameClass: async (oldName: string, newName: string) => {
    const cleanedOld = oldName.trim();
    const cleanedNew = newName.trim();
    if (!cleanedOld || !cleanedNew || cleanedOld === cleanedNew) return;

    const { classes, selectedClassForCapture } = get();
    if (classes.some(c => c.name.toLowerCase() === cleanedNew.toLowerCase() && cleanedOld.toLowerCase() !== cleanedNew.toLowerCase())) {
      throw new Error(`Class "${cleanedNew}" already exists.`);
    }

    // Determine if we need to call API or if it's just a local rename for an empty class
    const targetClass = classes.find(c => c.name === cleanedOld);
    const hasSamples = targetClass ? targetClass.count > 0 : false;

    if (hasSamples) {
      // Backend folder exists, execute backend rename
      try {
        await api.renameClass(cleanedOld, cleanedNew);
      } catch (err: any) {
        throw new Error(err.message || 'Failed to rename class on backend.');
      }
    }

    // Update frontend state
    const updatedClasses = classes.map(c => {
      if (c.name === cleanedOld) {
        return { ...c, name: cleanedNew };
      }
      return c;
    });

    set({ 
      classes: updatedClasses,
      selectedClassForCapture: selectedClassForCapture === cleanedOld ? cleanedNew : selectedClassForCapture
    });
    
    // Sync class thumbnail list
    await get().loadClasses();
  },

  // Delete class
  deleteClass: async (name: string) => {
    const { classes, selectedClassForCapture } = get();
    const targetClass = classes.find(c => c.name === name);
    const hasSamples = targetClass ? targetClass.count > 0 : false;

    if (hasSamples) {
      try {
        await api.deleteClass(name);
      } catch (err: any) {
        throw new Error(err.message || 'Failed to delete class from backend.');
      }
    }

    const remainingClasses = classes.filter(c => c.name !== name);
    set({ 
      classes: remainingClasses,
      selectedClassForCapture: selectedClassForCapture === name 
        ? (remainingClasses[0]?.name || null) 
        : selectedClassForCapture
    });

    await get().loadClasses();
  },

  // Delete single thumbnail image
  deleteSample: async (className: string, sampleId: string) => {
    try {
      await api.deleteSample(className, sampleId);
      
      // Update local state count and filter previews
      const updatedClasses = get().classes.map(c => {
        if (c.name === className) {
          return {
            ...c,
            count: Math.max(0, c.count - 1),
            previews: c.previews.filter(p => p.id !== sampleId)
          };
        }
        return c;
      });
      set({ classes: updatedClasses });
      
      // Reload from backend to confirm syncing
      await get().loadClasses();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete sample.');
    }
  },

  // Upload/ingest multiple image files
  uploadSamples: async (className: string, files: File[]) => {
    if (files.length === 0) return;
    try {
      await api.uploadSample(className, files);
      await get().loadClasses();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload samples.');
    }
  },

  // Reset Zustand store logs
  clearLogs: () => set({ trainingLogs: [] }),

  // Unified training trigger
  train: async () => {
    const addLog = (msg: string) => {
      set(state => ({ trainingLogs: [...state.trainingLogs, `[${new Date().toLocaleTimeString()}] ${msg}`] }));
    };

    set({ trainingStatus: 'training', errorMessage: null });
    set({ trainingLogs: [] });

    addLog("Initializing fast training sequence...");
    addLog("Scanning datasets directory for structured custom classes...");

    // Validate classes
    const { classes } = get();
    if (classes.length < 2) {
      const err = "Failed to train: Minimum 2 classes are required. Create another class.";
      addLog(err);
      set({ trainingStatus: 'error', errorMessage: err });
      return;
    }

    const emptyClasses = classes.filter(c => c.count === 0);
    if (emptyClasses.length > 0) {
      const err = `Failed to train: Class "${emptyClasses[0].name}" has 0 samples. Upload images or hold record.`;
      addLog(err);
      set({ trainingStatus: 'error', errorMessage: err });
      return;
    }

    const totalSamples = classes.reduce((sum, c) => sum + c.count, 0);
    addLog(`Found ${classes.length} classes with a total of ${totalSamples} samples.`);
    
    // Begin actual training call
    try {
      addLog("Extracting deep high-level feature vectors (576-dim) via MobileNetV3 small backbone...");
      addLog("Preprocessing and normalizing images to match ImageNet standard statistics...");
      
      const response = await api.trainModel();
      
      if (response.status === 'error') {
        addLog(`[Error] Training failed: ${response.message}`);
        set({ 
          trainingStatus: 'error', 
          errorMessage: response.message 
        });
        return;
      }
      
      addLog("Deep features extracted. Fitting fast scikit-learn Logistic Regression classifier...");
      addLog("Computing final model calibration weights & training statistics...");
      
      // Success logs
      addLog(`Model trained successfully!`);
      addLog(`Overall Training Accuracy: ${(response.metrics.accuracy * 100).toFixed(2)}%`);
      addLog(`Backbone extraction + fit time: ${response.metrics.training_time_seconds.toFixed(3)}s`);
      
      set({ 
        trainingStatus: 'success',
        trainingMetrics: response.metrics
      });
      
      // Reload classes to sync latest states
      await get().loadClasses();
    } catch (err: any) {
      const errMsg = err.message || "An unexpected error occurred during training.";
      addLog(`[Error] Training failed: ${errMsg}`);
      set({ 
        trainingStatus: 'error', 
        errorMessage: errMsg 
      });
    }
  },

  // Toggle prediction mode
  setPredicting: (isPredicting) => {
    set({ isPredicting, predictionResult: isPredicting ? get().predictionResult : null });
  },

  // Predict frame base64
  predictFrame: async (base64Image: string) => {
    if (!get().isPredicting) return;
    try {
      const result = await api.predictImage(base64Image);
      set({ predictionResult: result });
    } catch (e) {
      console.error('Frame prediction error', e);
    }
  },

  // Wipe the slate clean
  resetProject: async () => {
    try {
      await api.resetProject();
      set({
        classes: [
          { name: 'Class 1', count: 0, previews: [] },
          { name: 'Class 2', count: 0, previews: [] }
        ],
        selectedClassForCapture: 'Class 1',
        trainingStatus: 'idle',
        trainingLogs: [],
        trainingMetrics: null,
        errorMessage: null,
        isPredicting: false,
        predictionResult: null
      });
    } catch (err: any) {
      throw new Error(err.message || 'Failed to reset project.');
    }
  },

  // Set individual states
  setSelectedClassForCapture: (selectedClassForCapture) => set({ selectedClassForCapture }),
  setWebcamActive: (webcamActive) => set({ webcamActive }),
  setCameraDeviceId: (cameraDeviceId) => set({ cameraDeviceId }),
  setWebcamDenied: (isWebcamDenied) => set({ isWebcamDenied })
}));
