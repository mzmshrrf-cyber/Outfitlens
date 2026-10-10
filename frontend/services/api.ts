export interface PreviewSample {
  id: string;
  filename: string;
  thumbnail: string;
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

export interface TryOnStatus {
  provider: string;
  model: string;
  task?: string;
  region?: string;
  configured: boolean;
  estimated_cost_usd_per_generation?: number;
  estimated_cost_note?: string;
  notes: string[];
  setup: string;
}

export interface HealthStatus {
  status: string;
  product?: string;
  has_model: boolean;
  classes_count: number;
  tryon?: TryOnStatus;
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

export interface CompareResult {
  similarity_score: number;
  raw_cosine: number;
  label: string;
  explanation: string;
  method: string;
  limitations: string[];
}

export interface ProductImageResult {
  supported: boolean;
  source_url: string;
  image_url: string;
  image_data_url: string;
  message: string;
}

export interface TryOnResult {
  provider: string;
  model: string;
  category: string;
  mode: string;
  garment_count: number;
  result_url: string;
  result_data_url?: string | null;
  steps: Array<{
    garment_index: number;
    result_url: string;
    result_data_url?: string | null;
  }>;
  disclaimer: string;
  estimated_cost_usd: number;
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
          if (Array.isArray(errorMsg)) {
            errorMsg = errorMsg.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
          }
        } catch {
          // ignore
        }
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
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
    files.forEach((file) => formData.append('images', file));
    return this.request('/upload-sample', { method: 'POST', body: formData });
  }

  async deleteClass(className: string): Promise<{ message: string }> {
    return this.request(`/class/${encodeURIComponent(className)}`, { method: 'DELETE' });
  }

  async renameClass(oldName: string, newName: string): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('old_name', oldName);
    formData.append('new_name', newName);
    return this.request('/class/rename', { method: 'POST', body: formData });
  }

  async deleteSample(className: string, sampleId: string): Promise<{ message: string }> {
    return this.request(
      `/sample/${encodeURIComponent(className)}/${encodeURIComponent(sampleId)}`,
      { method: 'DELETE' }
    );
  }

  async trainModel(): Promise<{ status: string; message: string; metrics: TrainingMetrics }> {
    return this.request('/train', { method: 'POST' });
  }

  async evaluateModel(): Promise<DeepEvaluationResult> {
    return this.request('/evaluate', { method: 'POST' });
  }

  async predictImage(base64Image: string): Promise<PredictionResult> {
    return this.request('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image }),
    });
  }

  async resetProject(): Promise<{ message: string }> {
    return this.request('/reset', { method: 'POST' });
  }

  exportModelUrl(): string {
    return `${API_BASE_URL}/export-model`;
  }

  async compareImages(imageA: File, imageB: File): Promise<CompareResult> {
    const formData = new FormData();
    formData.append('image_a', imageA);
    formData.append('image_b', imageB);
    return this.request('/compare', { method: 'POST', body: formData });
  }

  async fetchProductImage(url: string): Promise<ProductImageResult> {
    return this.request('/fetch-product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  }

  async getTryOnStatus(): Promise<TryOnStatus> {
    return this.request('/tryon/status');
  }

  async runTryOn(
    personImage: File,
    garmentImages: File[],
    category: string = 'auto',
    mode: string = 'balanced'
  ): Promise<TryOnResult> {
    const formData = new FormData();
    formData.append('person_image', personImage);
    garmentImages.forEach((file) => formData.append('garment_images', file));
    formData.append('category', category);
    formData.append('mode', mode);
    return this.request('/tryon', { method: 'POST', body: formData });
  }
}

export const api = new ApiService();
