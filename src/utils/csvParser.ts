import { FoodItem, Allergen } from '../types/diet';
import { calculateGoalScores, assignMealSlot, ALLERGEN_KEYWORD_MAP } from './scoring';

export function parseFoodCsv(csvText: string, sourceName: 'usda' | 'openfoodfacts' | 'healthy_db' = 'usda'): FoodItem[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const getIdx = (candidates: string[]) => {
    return headers.findIndex((h) => candidates.some((cand) => h.includes(cand)));
  };

  const nameIdx = getIdx(['food_name', 'product_name', 'name', 'item']);
  const categoryIdx = getIdx(['food_category', 'category', 'categories', 'food_type', 'type']);
  const caloriesIdx = getIdx(['calories', 'energy_kcal', 'energy', 'calorie', 'kcal']);
  const proteinIdx = getIdx(['protein_g', 'protein_100g', 'proteins_100g', 'protein']);
  const fatIdx = getIdx(['fat_g', 'fat_100g', 'total_fat', 'fat']);
  const carbsIdx = getIdx(['carbs_g', 'carbs_100g', 'carbohydrate', 'carbs']);
  const fiberIdx = getIdx(['fiber_g', 'fiber_100g', 'dietary_fiber', 'fiber']);
  const sugarIdx = getIdx(['sugar_g', 'sugars_100g', 'sugars', 'sugar']);
  const sodiumIdx = getIdx(['sodium_mg', 'sodium_100g', 'sodium']);
  const healthScoreIdx = getIdx(['health_score', 'nutriscore', 'score']);
  const ingredientsIdx = getIdx(['ingredients', 'ingredient_text', 'ingredients_text']);

  const parsedFoods: FoodItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV comma split with quotes
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
    const cleanVal = (idx: number) => {
      if (idx < 0 || idx >= values.length) return '';
      return values[idx].trim().replace(/^["']|["']$/g, '');
    };

    const foodName = cleanVal(nameIdx);
    if (!foodName) continue;

    const category = cleanVal(categoryIdx) || 'General';
    const calories = parseFloat(cleanVal(caloriesIdx)) || 0;
    const protein_g = parseFloat(cleanVal(proteinIdx)) || 0;
    const fat_g = parseFloat(cleanVal(fatIdx)) || 0;
    const carbs_g = parseFloat(cleanVal(carbsIdx)) || 0;
    const fiber_g = parseFloat(cleanVal(fiberIdx)) || 0;
    const sugar_g = parseFloat(cleanVal(sugarIdx)) || 0;
    let sodium_mg = parseFloat(cleanVal(sodiumIdx)) || 0;

    // If sodium was in grams (OpenFoodFacts style), convert to mg
    if (sodium_mg < 10 && sodium_mg > 0) {
      sodium_mg = sodium_mg * 1000;
    }

    const health_score = Math.min(100, Math.max(0, parseFloat(cleanVal(healthScoreIdx)) || 75));
    const ingredients = (cleanVal(ingredientsIdx) + ' ' + foodName).toLowerCase();

    // Check allergens using keyword mapping from Project.py
    const allergenFlags: Record<`contains_${Allergen}`, number> = {
      contains_gluten: 0,
      contains_dairy: 0,
      contains_nuts: 0,
      contains_soy: 0,
      contains_eggs: 0,
      contains_fish: 0,
    };

    const allergens: Allergen[] = ['gluten', 'dairy', 'nuts', 'soy', 'eggs', 'fish'];
    allergens.forEach((alg) => {
      const keywords = ALLERGEN_KEYWORD_MAP[alg];
      const contains = keywords.some((kw) => ingredients.includes(kw));
      allergenFlags[`contains_${alg}`] = contains ? 1 : 0;
    });

    const goalScores = calculateGoalScores({
      calories,
      protein_g,
      fat_g,
      carbs_g,
      fiber_g,
      sugar_g,
      sodium_mg,
    });

    const meal_slot = assignMealSlot(foodName, category);

    parsedFoods.push({
      id: `imported-${Date.now()}-${i}`,
      food_name: foodName,
      category,
      source: sourceName,
      calories,
      protein_g,
      fat_g,
      carbs_g,
      fiber_g,
      sugar_g,
      sodium_mg,
      health_score,
      ...allergenFlags,
      allergen_verified: true,
      meal_slot,
      ...goalScores,
    });
  }

  return parsedFoods;
}
