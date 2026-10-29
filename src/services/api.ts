import {
  FoodItem,
  GoalType,
  Allergen,
  GoalWeights,
  MlpPredictionResult,
  User,
  UserPreferences,
  AuthResponse,
  DbStatusResponse,
  DayOfWeek,
  AdherenceStatus,
  WeeklySchedule,
  WeeklyAdherence,
  WeeklyScheduleResponse,
  WeeklyArchiveRecord,
  HealthAnalyticsResponse,
} from '../types/diet';
import { INITIAL_FOOD_DATABASE } from '../data/foodDatabase';
import { filterByAllergens, scoreFoodsMultiCriteria, predictMlpGoal } from '../utils/scoring';

export interface RecommendRequest {
  user_goals: GoalWeights;
  user_allergies: Allergen[];
  strict_allergens: boolean;
  top_n_per_slot: number;
}

export interface RecommendResponse {
  success: boolean;
  plan: {
    Morning: FoodItem[];
    Lunch: FoodItem[];
    Snack: FoodItem[];
    Dinner: FoodItem[];
  };
  totals: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
  candidateCount: number;
  totalCatalogCount: number;
}

export interface ModelMetricsResponse {
  success: boolean;
  modelType: string;
  hiddenLayers: number[];
  activation: string;
  solver: string;
  pcaVarianceExplained: number;
  testAccuracy: number;
  classes: string[];
  confusionMatrix: number[][];
  classificationReport: Array<{
    goal: string;
    precision: number;
    recall: number;
    f1: number;
    support: number;
  }>;
}

/**
 * Get the effective base API URL:
 * 1. User-configured custom URL in localStorage (e.g. from connection modal)
 * 2. Vite environment variable VITE_API_URL
 * 3. Empty string (same origin / relative path for local development and proxying)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('CUSTOM_BACKEND_URL');
    if (custom) return custom.replace(/\/+$/, '');
  }
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return String(envUrl).replace(/\/+$/, '');
  return '';
}

export function setCustomBackendUrl(url: string | null): void {
  if (typeof window !== 'undefined') {
    if (!url || url.trim() === '') {
      localStorage.removeItem('CUSTOM_BACKEND_URL');
    } else {
      localStorage.setItem('CUSTOM_BACKEND_URL', url.trim().replace(/\/+$/, ''));
    }
  }
}

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('AUTH_TOKEN');
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('AUTH_TOKEN', token);
    } else {
      localStorage.removeItem('AUTH_TOKEN');
    }
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  getApiBaseUrl,
  setCustomBackendUrl,
  getAuthToken,
  setAuthToken,

  // Register new user with password hashing
  async register(data: { name: string; email: string; password: string }): Promise<AuthResponse> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Registration failed');
    }
    if (json.token) {
      setAuthToken(json.token);
    }
    return json;
  },

  // Login user with email and password
  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Login failed');
    }
    if (json.token) {
      setAuthToken(json.token);
    }
    return json;
  },

  // Logout current user
  async logout(): Promise<void> {
    try {
      const base = getApiBaseUrl();
      await fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {}
    setAuthToken(null);
  },

  // Fetch current user and their saved preferences
  async getMe(): Promise<{ success: boolean; user?: User; preferences?: UserPreferences }> {
    const token = getAuthToken();
    if (!token) return { success: false };
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      if (res.status === 401) setAuthToken(null);
      return { success: false };
    }
    return await res.json();
  },

  // Get preferences for current user
  async getUserPreferences(): Promise<UserPreferences | null> {
    const token = getAuthToken();
    if (!token) return null;
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/preferences`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.preferences;
  },

  // Update preferences for current user in PostgreSQL
  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/preferences`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(preferences),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update preferences');
    }
    const data = await res.json();
    return data.preferences;
  },

  // Check PostgreSQL Database status
  async getDbStatus(): Promise<DbStatusResponse> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/db/status`);
      if (!res.ok) throw new Error('DB status check failed');
      return await res.json();
    } catch (err: any) {
      return {
        success: false,
        type: 'in-memory-fallback',
        connected: false,
        userCount: 0,
        message: 'Could not connect to database status endpoint',
      };
    }
  },

  // Configure custom PostgreSQL connection (e.g. for pgAdmin)
  async updateDbConfig(config: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    connectionString?: string;
  }): Promise<{ success: boolean; connected: boolean; status: DbStatusResponse }> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/db/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to update DB config');
    return await res.json();
  },

  // Get current user's 7-day schedule and adherence from PostgreSQL
  async getWeeklySchedule(): Promise<WeeklyScheduleResponse> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/weekly-schedule`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch weekly schedule');
    }
    return await res.json();
  },

  // Re-generate 7-day diet schedule
  async generateWeeklySchedule(preserveAdherence: boolean = false): Promise<WeeklyScheduleResponse> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/weekly-schedule/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ preserveAdherence }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to generate weekly schedule');
    }
    return await res.json();
  },

  // Update meal or day adherence status
  async updateAdherence(params: {
    day?: DayOfWeek;
    slot?: 'Morning' | 'Lunch' | 'Snack' | 'Dinner';
    status?: AdherenceStatus;
    dayStatus?: AdherenceStatus;
    adherence?: WeeklyAdherence;
  }): Promise<{ success: boolean; adherence: WeeklyAdherence; stats: any }> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/weekly-schedule/adherence`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update adherence');
    }
    return await res.json();
  },

  // Complete and archive current week, then reset database for the upcoming week
  async completeWeek(): Promise<{
    success: boolean;
    message: string;
    archivedRecord: WeeklyArchiveRecord;
    schedule: WeeklySchedule;
    adherence: WeeklyAdherence;
    stats: any;
  }> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/weekly-schedule/complete-week`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to complete and archive week');
    }
    return await res.json();
  },

  // Get user's archived weekly history
  async getWeeklyHistory(): Promise<{ success: boolean; history: WeeklyArchiveRecord[] }> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/weekly-history`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch weekly history');
    }
    return await res.json();
  },

  // Get comprehensive user health rate analytics
  async getHealthAnalytics(): Promise<HealthAnalyticsResponse> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/user/health-analytics`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch health analytics');
    }
    return await res.json();
  },

  // Check health of backend
  async checkHealth(): Promise<{ healthy: boolean; foodsCount?: number; message?: string }> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { healthy: false };
      const data = await res.json();
      return { healthy: true, foodsCount: data.foodsCount, message: data.service };
    } catch {
      return { healthy: false };
    }
  },

  // Fetch all foods from backend (with fallback to seed database)
  async getFoods(): Promise<FoodItem[]> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/foods`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        return data.data;
      }
      return INITIAL_FOOD_DATABASE;
    } catch (err) {
      console.warn('Backend /api/foods unavailable, using offline seed food database:', err);
      return INITIAL_FOOD_DATABASE;
    }
  },

  // Add custom food to backend
  async addFood(food: Partial<FoodItem>): Promise<FoodItem> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/foods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.warn('Backend /api/foods POST fallback:', err);
      return food as FoodItem;
    }
  },

  // Generate diet recommendation from backend
  async getRecommendation(params: RecommendRequest): Promise<RecommendResponse> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend /api/recommend fallback, computing locally:', err);
      // Fallback local execution
      const safe = filterByAllergens(INITIAL_FOOD_DATABASE, params.user_allergies, params.strict_allergens);
      const scored = scoreFoodsMultiCriteria(safe, params.user_goals);
      const morning = scored
        .filter((f) => f.meal_slot === 'Morning')
        .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));
      const afternoon = scored
        .filter((f) => f.meal_slot === 'Afternoon')
        .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));
      const snack = scored
        .filter((f) => f.meal_slot === 'Snack')
        .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

      const n = params.top_n_per_slot || 2;
      const plan = {
        Morning: morning.slice(0, n),
        Lunch: afternoon.slice(0, n),
        Snack: snack.slice(0, Math.max(1, n - 1)),
        Dinner: afternoon.slice(n, n * 2),
      };

      const all = [...plan.Morning, ...plan.Lunch, ...plan.Snack, ...plan.Dinner];
      const totals = all.reduce(
        (acc, item) => ({
          calories: acc.calories + (item.calories || 0),
          protein_g: acc.protein_g + (item.protein_g || 0),
          fat_g: acc.fat_g + (item.fat_g || 0),
          carbs_g: acc.carbs_g + (item.carbs_g || 0),
          fiber_g: acc.fiber_g + (item.fiber_g || 0),
          sugar_g: acc.sugar_g + (item.sugar_g || 0),
          sodium_mg: acc.sodium_mg + (item.sodium_mg || 0),
        }),
        { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 }
      );

      return {
        success: true,
        plan,
        totals,
        candidateCount: safe.length,
        totalCatalogCount: INITIAL_FOOD_DATABASE.length,
      };
    }
  },

  // Predict goal via MLP from backend
  async predictGoal(foodInput: Partial<FoodItem>): Promise<MlpPredictionResult> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/predict-goal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(foodInput),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.warn('Backend /api/predict-goal fallback, computing locally:', err);
      return predictMlpGoal(foodInput as any);
    }
  },

  // Fetch model metrics from backend
  async getModelMetrics(): Promise<ModelMetricsResponse | null> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/model-metrics`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('Backend /api/model-metrics fallback:', err);
      return null;
    }
  },

  // Fetch available CSV files in Dataset folder
  async getDatasetFiles(): Promise<Array<{
    fileName: string;
    relativePath: string;
    title: string;
    description: string;
    rowCount: number;
    fileSizeBytes: number;
    source: 'healthy_db' | 'openfoodfacts' | 'usda';
  }>> {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/dataset/files`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.data;
    } catch (err) {
      console.warn('Backend /api/dataset/files fallback:', err);
      return [
        {
          fileName: 'healthy_foods_database.csv',
          relativePath: '/Dataset/healthy_foods_database.csv',
          title: 'Healthy Foods Database (USDA)',
          description: '9,000+ comprehensive whole foods, macros, fibers, sodium and health scores',
          rowCount: 9030,
          fileSizeBytes: 845772,
          source: 'healthy_db',
        },
        {
          fileName: 'foods_health_scores_allergens.csv',
          relativePath: '/Dataset/foods_health_scores_allergens.csv',
          title: 'OpenFoodFacts Health Scores & Allergens',
          description: '5,500+ branded and packaged foods with 6 verified allergen flags and Nutri-Scores',
          rowCount: 5594,
          fileSizeBytes: 2088238,
          source: 'openfoodfacts',
        },
        {
          fileName: 'foods_allergens.csv',
          relativePath: '/Dataset/foods_allergens.csv',
          title: 'Dedicated Allergen Matrix',
          description: '3,300+ foods with binary allergen flags for gluten, dairy, nuts, soy, eggs, fish',
          rowCount: 3334,
          fileSizeBytes: 301561,
          source: 'openfoodfacts',
        },
        {
          fileName: 'foods_dietary_restrictions.csv',
          relativePath: '/Dataset/foods_dietary_restrictions.csv',
          title: 'Dietary Restrictions & Nutri-Score',
          description: '5,000+ foods with Nova ultra-processed group and allergen verification',
          rowCount: 4999,
          fileSizeBytes: 691096,
          source: 'openfoodfacts',
        },
      ];
    }
  },

  // Load a specific dataset file from /Dataset/
  async loadDatasetFile(fileName: string): Promise<{ success: boolean; count: number; message: string }> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/dataset/load-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  // Reset to full master dataset
  async resetMasterDataset(): Promise<{ success: boolean; count: number; message: string }> {
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/dataset/reset-master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
};
