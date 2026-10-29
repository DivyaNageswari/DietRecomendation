export type Allergen = 'gluten' | 'dairy' | 'nuts' | 'soy' | 'eggs' | 'fish';

export type GoalType = 
  | 'Weight Loss'
  | 'Muscle Gain'
  | 'Heart Health'
  | 'Diabetic-Friendly'
  | 'Balanced Diet';

export type MealSlot = 'Morning' | 'Afternoon' | 'Snack';

export interface FoodItem {
  id: string;
  food_name: string;
  category: string;
  source: 'usda' | 'healthy_db' | 'openfoodfacts' | 'user';
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  health_score: number; // 0 - 100
  contains_gluten: number; // 1 = present, 0 = safe, -1 = unverified
  contains_dairy: number;
  contains_nuts: number;
  contains_soy: number;
  contains_eggs: number;
  contains_fish: number;
  allergen_verified: boolean;
  meal_slot: MealSlot;
  best_fit_goal?: GoalType;
  // Computed dynamic properties
  ws_weight_loss?: number;
  ws_muscle_gain?: number;
  ws_heart_health?: number;
  ws_diabetic?: number;
  ws_balanced?: number;
  recommendation_score?: number; // 0 - 100% normalized weighted score
}

export interface GoalWeights {
  'Weight Loss': number;
  'Muscle Gain': number;
  'Heart Health': number;
  'Diabetic-Friendly': number;
  'Balanced Diet': number;
}

export interface DailyPlanSlotResult {
  slot: MealSlot;
  title: string;
  description: string;
  items: FoodItem[];
}

export interface DailyPlan {
  Morning: FoodItem[];
  Lunch: FoodItem[];
  Snack: FoodItem[];
  Dinner: FoodItem[];
  totalNutrition: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fiber_g: number;
    sugar_g: number;
    sodium_mg: number;
  };
}

export interface MlpPredictionResult {
  predictedGoal: GoalType;
  probabilities: Record<GoalType, number>;
  confidence: number;
  scores: Record<GoalType, number>;
  pcaCoordinates: [number, number];
}

export interface User {
  id: number | string;
  name: string;
  email: string;
  created_at?: string;
}

export interface UserPreferences {
  goal_weights: GoalWeights;
  allergies: Allergen[];
  strict_allergens: boolean;
  items_per_slot: number;
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  preferences?: UserPreferences;
  error?: string;
  message?: string;
}

export interface DbStatusResponse {
  success: boolean;
  type: 'postgresql' | 'in-memory-fallback';
  connected: boolean;
  host?: string;
  database?: string;
  userCount: number;
  message?: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type AdherenceStatus = 'followed' | 'not_followed' | 'pending';

export interface DaySchedule {
  day: DayOfWeek;
  meals: {
    Morning: FoodItem[];
    Lunch: FoodItem[];
    Snack: FoodItem[];
    Dinner: FoodItem[];
  };
  totalCalories: number;
}

export type WeeklySchedule = Record<DayOfWeek, DaySchedule>;

export type WeeklyAdherence = Record<DayOfWeek, {
  Morning: AdherenceStatus;
  Lunch: AdherenceStatus;
  Snack: AdherenceStatus;
  Dinner: AdherenceStatus;
}>;

export interface WeeklyScheduleResponse {
  success: boolean;
  schedule: WeeklySchedule;
  adherence: WeeklyAdherence;
  stats: {
    followedCount: number;
    notFollowedCount: number;
    pendingCount: number;
    totalMeals: number;
    adherenceRate: number;
  };
  currentWeekNumber?: number;
}

export interface WeeklyArchiveRecord {
  id: string | number;
  userId: string | number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  schedule: WeeklySchedule;
  adherence: WeeklyAdherence;
  stats: {
    followedCount: number;
    notFollowedCount: number;
    pendingCount: number;
    totalMeals: number;
    adherenceRate: number;
  };
  healthRate: number;
  healthMetrics: {
    adherenceScore: number;
    nutritionalQualityScore: number;
    goalAlignmentScore: number;
    mealConsistencyScore: number;
    estimatedCaloriesPerDay: number;
    estimatedProteinPerDay: number;
  };
  completedAt: string;
}

export interface HealthAnalyticsResponse {
  success: boolean;
  overallHealthRate: number;
  totalWeeksCompleted: number;
  currentStreak: number;
  averageAdherenceRate: number;
  macroBalanceScore: number;
  history: WeeklyArchiveRecord[];
  activeWeekStats?: {
    followedCount: number;
    notFollowedCount: number;
    pendingCount: number;
    totalMeals: number;
    adherenceRate: number;
    projectedHealthRate: number;
  };
}



