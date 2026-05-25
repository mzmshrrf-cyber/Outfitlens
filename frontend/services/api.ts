export interface PreviewSample {
  id: string;
  filename: string;
  thumbnail: string; // Base64 JPEG data URL
}

export interface ClassData {
  name: string;
  count: number;
  previews: PreviewSample[];
}

export interface TrainingMetrics {
  accuracy: number;
  sample_counts: Record<string, number>;
  training_time_seconds: number;
  confusion_matrix: number[][];
  classes: string[];
  trained_at: string;
}

export interface PredictionResult {
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface HealthStatus {
  status: string;
  has_model: boolean;
  classes_count: number;
}

export interface ClassReportDetails {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface DeepEvaluationResult {
  cross_val_accuracy: number;
  cross_val_std: number;
  method: string;
  precision: number;
  recall: number;
  f1_score: number;
  class_report: Record<string, ClassReportDetails>;
  diagnosis: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        let errorMsg = `HTTP error! Status: ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.detail || errorMsg;
        } catch {
          // ignore parsing error if not JSON
        }
        throw new Error(errorMsg);
      }
      return (await response.json()) as T;
    } catch (error) {
      console.error(`API Request failed on ${url}:`, error);
      throw error;
    }
  }

  async checkHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>('/health');
  }

  async fetchClasses(): Promise<{ classes: ClassData[] }> {
    return this.request<{ classes: ClassData[] }>('/classes');
  }

  async uploadSample(className: string, files: File[]): Promise<{ message: string; samples: any[] }> {
    const formData = new FormData();
    formData.append('class_name', className);
    files.forEach((file) => {
      formData.append('images', file);
    });

    return this.request<{ message: string; samples: any[] }>('/upload-sample', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteClass(className: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/class/${encodeURIComponent(className)}`, {
      method: 'DELETE',
    });
  }

  async renameClass(oldName: string, newName: string): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('old_name', oldName);
    formData.append('new_name', newName);

    return this.request<{ message: string }>('/class/rename', {
      method: 'POST',
      body: formData,
    });
  }

  async deleteSample(className: string, sampleId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/sample/${encodeURIComponent(className)}/${encodeURIComponent(sampleId)}`,
      {
        method: 'DELETE',
      }
    );
  }

  async trainModel(): Promise<{ status: string; message: string; metrics: TrainingMetrics }> {
    return this.request<{ status: string; message: string; metrics: TrainingMetrics }>('/train', {
      method: 'POST',
    });
  }

  async evaluateModel(): Promise<DeepEvaluationResult> {
    return this.request<DeepEvaluationResult>('/evaluate', {
      method: 'POST',
    });
  }

  async predictImage(base64Image: string): Promise<PredictionResult> {
    return this.request<PredictionResult>('/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });
  }

  async resetProject(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/reset', {
      method: 'POST',
    });
  }

  exportModelUrl(): string {
    return `${API_BASE_URL}/export-model`;
  }
}

export const api = new ApiService();
