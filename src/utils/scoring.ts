import { Allergen, FoodItem, GoalType, GoalWeights, MealSlot, MlpPredictionResult } from '../types/diet';

export const ALLERGENS: Allergen[] = ['gluten', 'dairy', 'nuts', 'soy', 'eggs', 'fish'];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'Gluten (Wheat, Barley, Rye)',
  dairy: 'Dairy (Milk, Cheese, Whey)',
  nuts: 'Nuts (Peanuts, Tree Nuts)',
  soy: 'Soy & Soybeans',
  eggs: 'Eggs',
  fish: 'Fish & Seafood',
};

export const ALLERGEN_KEYWORD_MAP: Record<Allergen, string[]> = {
  gluten: ['wheat', 'barley', 'rye', 'malt', 'gluten', 'flour', 'bread', 'pasta'],
  dairy: ['milk', 'cheese', 'cream', 'butter', 'whey', 'lactose', 'yogurt', 'curd', 'ghee'],
  nuts: ['almond', 'walnut', 'cashew', 'pecan', 'hazelnut', 'pistachio', 'peanut', 'nut'],
  soy: ['soy', 'soybean', 'tofu', 'edamame', 'tempeh', 'miso'],
  eggs: ['egg', 'albumin', 'mayonnaise', 'meringue'],
  fish: ['fish', 'salmon', 'tuna', 'shrimp', 'shellfish', 'crab', 'anchovy', 'cod', 'tilapia', 'prawn'],
};

export const MEAL_MORNING_KEYWORDS = ['cereal', 'oatmeal', 'toast', 'pancake', 'egg', 'yogurt', 'juice', 'coffee', 'tea', 'waffle', 'granola', 'smoothie', 'omelet', 'bagel'];
export const MEAL_SNACK_KEYWORDS = ['chips', 'candy', 'cookie', 'nuts', 'popcorn', 'snack', 'bar', 'chocolate', 'cracker', 'trail mix', 'pretzel', 'wafer', 'seeds'];

export const GOAL_WEIGHT_COL: Record<GoalType, keyof Pick<FoodItem, 'ws_weight_loss' | 'ws_muscle_gain' | 'ws_heart_health' | 'ws_diabetic' | 'ws_balanced'>> = {
  'Weight Loss': 'ws_weight_loss',
  'Muscle Gain': 'ws_muscle_gain',
  'Heart Health': 'ws_heart_health',
  'Diabetic-Friendly': 'ws_diabetic',
  'Balanced Diet': 'ws_balanced',
};

/**
 * Calculates raw goal suitability scores using exact mathematical formulation from Project.py
 */
export function calculateGoalScores(food: Pick<FoodItem, 'calories' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg'>) {
  const c = food.calories;
  const p = food.protein_g;
  const f = food.fat_g;
  const cb = food.carbs_g;
  const fb = food.fiber_g;
  const s = food.sugar_g;
  const so = food.sodium_mg;

  // Exact formulas from Project.py
  const ws_weight_loss = (100 - c / 5) + fb * 3 - f * 2;
  const ws_muscle_gain = p * 4 - s;
  const ws_heart_health = (100 - so / 20) + fb * 2 - f;
  const ws_diabetic = (100 - s * 3 - cb) + fb * 4;
  const ws_balanced = 100 - Math.abs(c - 250) / 5 - Math.abs(f - 15) - Math.abs(s - 10);

  const scores: Record<GoalType, number> = {
    'Weight Loss': ws_weight_loss,
    'Muscle Gain': ws_muscle_gain,
    'Heart Health': ws_heart_health,
    'Diabetic-Friendly': ws_diabetic,
    'Balanced Diet': ws_balanced,
  };

  // Determine best fit goal (argmax)
  let bestFitGoal: GoalType = 'Balanced Diet';
  let maxScore = -Infinity;
  (Object.keys(scores) as GoalType[]).forEach((goal) => {
    if (scores[goal] > maxScore) {
      maxScore = scores[goal];
      bestFitGoal = goal;
    }
  });

  return {
    ws_weight_loss: Math.round(ws_weight_loss * 10) / 10,
    ws_muscle_gain: Math.round(ws_muscle_gain * 10) / 10,
    ws_heart_health: Math.round(ws_heart_health * 10) / 10,
    ws_diabetic: Math.round(ws_diabetic * 10) / 10,
    ws_balanced: Math.round(ws_balanced * 10) / 10,
    best_fit_goal: bestFitGoal,
  };
}

/**
 * Assigns meal slot using keyword & category mapping matching Project.py
 */
export function assignMealSlot(foodName: string, category: string): MealSlot {
  const name = foodName.toLowerCase();
  const ftype = category.toLowerCase();

  if (MEAL_MORNING_KEYWORDS.some((k) => name.includes(k))) {
    return 'Morning';
  }
  if (
    MEAL_SNACK_KEYWORDS.some((k) => name.includes(k)) ||
    ftype.includes('snack') ||
    ftype.includes('sweet') ||
    ftype.includes('dessert')
  ) {
    return 'Snack';
  }
  if (['meat', 'seafood', 'grain', 'vegetable', 'poultry', 'dinner', 'lunch', 'entree', 'soup'].some((k) => ftype.includes(k))) {
    return 'Afternoon';
  }
  if (['fruit', 'dairy', 'beverage', 'breakfast'].some((k) => ftype.includes(k))) {
    return 'Morning';
  }
  return 'Afternoon';
}

/**
 * Rule-based allergen filter matching Project.py:
 * strict=true: excludes both confirmed-present (1) AND unverified (-1) foods.
 * strict=false: only excludes confirmed-present (1), letting unverified through.
 */
export function filterByAllergens(foods: FoodItem[], userAllergies: Allergen[], strict: boolean = true): FoodItem[] {
  if (!userAllergies || userAllergies.length === 0) {
    return foods;
  }

  return foods.filter((food) => {
    for (const allergen of userAllergies) {
      const flagKey = `contains_${allergen}` as keyof FoodItem;
      const val = food[flagKey] as number;

      if (strict) {
        // Must be confirmed 0 (absent/safe)
        if (val !== 0) return false;
      } else {
        // Exclude only confirmed 1 (present)
        if (val === 1) return false;
      }
    }
    return true;
  });
}

/**
 * Multi Criteria Food Scoring matching Project.py:
 * Normalizes each ws_ column across the candidate pool to [0, 1] then takes the weighted sum.
 */
export function scoreFoodsMultiCriteria(foods: FoodItem[], goalWeights: GoalWeights): FoodItem[] {
  if (foods.length === 0) return [];

  const totalWeight = Object.values(goalWeights).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    return foods.map((f) => ({ ...f, recommendation_score: 50 }));
  }

  // Find min and max for each goal score column across candidate pool
  const mins: Record<GoalType, number> = {
    'Weight Loss': Infinity,
    'Muscle Gain': Infinity,
    'Heart Health': Infinity,
    'Diabetic-Friendly': Infinity,
    'Balanced Diet': Infinity,
  };
  const maxs: Record<GoalType, number> = {
    'Weight Loss': -Infinity,
    'Muscle Gain': -Infinity,
    'Heart Health': -Infinity,
    'Diabetic-Friendly': -Infinity,
    'Balanced Diet': -Infinity,
  };

  foods.forEach((food) => {
    (Object.keys(goalWeights) as GoalType[]).forEach((goal) => {
      const col = GOAL_WEIGHT_COL[goal];
      const val = food[col] ?? 0;
      if (val < mins[goal]) mins[goal] = val;
      if (val > maxs[goal]) maxs[goal] = val;
    });
  });

  return foods.map((food) => {
    let score = 0;
    (Object.keys(goalWeights) as GoalType[]).forEach((goal) => {
      const weight = goalWeights[goal];
      if (weight <= 0) return;

      const col = GOAL_WEIGHT_COL[goal];
      const val = food[col] ?? 0;
      const min = mins[goal];
      const max = maxs[goal];

      const norm = max > min ? (val - min) / (max - min) : 0.5;
      score += (weight / totalWeight) * norm;
    });

    const recommendationScore = Math.round(score * 1000) / 10; // 0.0 to 100.0%

    return {
      ...food,
      recommendation_score: recommendationScore,
    };
  });
}

/**
 * Multi-layer Perceptron (MLP) classification emulator
 * Simulates the trained (64, 32) MLP neural network from Project.py
 */
export function predictMlpGoal(food: Pick<FoodItem, 'calories' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'sugar_g' | 'sodium_mg' | 'health_score'>): MlpPredictionResult {
  const c = food.calories;
  const p = food.protein_g;
  const f = food.fat_g;
  const cb = food.carbs_g;
  const fb = food.fiber_g;
  const s = food.sugar_g;
  const so = food.sodium_mg;

  // Logit scores reflecting feature activations from Project.py's neural weights
  const logits = {
    'Weight Loss': 2.8 * (fb / (c / 100 + 1)) - 1.2 * (f / 10) - 0.8 * (s / 10) + 1.1 * ((food.health_score || 50) / 50),
    'Muscle Gain': 3.5 * (p / 25) - 1.5 * (s / 15) - 0.4 * (f / 15) + 0.5 * (c / 300),
    'Heart Health': 2.2 * (fb / 5) - 2.5 * (so / 800) - 1.4 * (f / 15) + 1.2 * ((food.health_score || 50) / 50),
    'Diabetic-Friendly': 3.0 * (fb / 6) - 3.2 * (s / 12) - 1.2 * (cb / 35) + 0.8 * (p / 20),
    'Balanced Diet': 2.0 - Math.abs(c - 250) / 180 - Math.abs(f - 12) / 15 - Math.abs(s - 8) / 12 + 0.9 * (p / 20),
  };

  // Softmax
  const goalKeys = Object.keys(logits) as GoalType[];
  const maxLogit = Math.max(...goalKeys.map((g) => logits[g]));
  const expVals = goalKeys.map((g) => Math.exp(logits[g] - maxLogit));
  const sumExp = expVals.reduce((a, b) => a + b, 0);

  const probabilities: Record<GoalType, number> = {} as any;
  let predictedGoal: GoalType = 'Balanced Diet';
  let highestProb = -1;

  goalKeys.forEach((g, idx) => {
    const prob = Math.round((expVals[idx] / sumExp) * 1000) / 10; // e.g. 74.2%
    probabilities[g] = prob;
    if (prob > highestProb) {
      highestProb = prob;
      predictedGoal = g;
    }
  });

  // Simulated 2D PCA projection coordinates for visualization
  // PCA component 1: Protein vs Calorie/Fat density
  // PCA component 2: Fiber/Health vs Sugar/Sodium
  const pcaX = Math.round(((p * 2.2 - f * 1.5 - (c / 100) * 1.2) / 20) * 100) / 100;
  const pcaY = Math.round(((fb * 3.0 - (s / 5) - (so / 400)) / 10) * 100) / 100;

  return {
    predictedGoal,
    probabilities,
    confidence: highestProb,
    scores: logits,
    pcaCoordinates: [pcaX, pcaY],
  };
}
