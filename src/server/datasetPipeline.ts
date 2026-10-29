import fs from 'fs';
import path from 'path';
import { FoodItem, Allergen, GoalType, GoalWeights, MealSlot } from '../types/diet';
import {
  calculateGoalScores,
  assignMealSlot,
  ALLERGENS,
  ALLERGEN_KEYWORD_MAP,
  MEAL_MORNING_KEYWORDS,
  MEAL_SNACK_KEYWORDS,
  GOAL_WEIGHT_COL,
} from '../utils/scoring';

/**
 * Fast RFC-compliant CSV parser handling quotes, embedded commas, and escaped quotes.
 */
export function parseCsvRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const nextChar = csvContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 0 && currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export interface DatasetFileInfo {
  fileName: string;
  relativePath: string;
  title: string;
  description: string;
  rowCount: number;
  fileSizeBytes: number;
  source: 'healthy_db' | 'openfoodfacts' | 'usda';
}

function getDatasetDir(): string {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, 'Dataset'),
    path.resolve(cwd, '..', 'Dataset'),
    '/Dataset',
    '/app/applet/Dataset',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.resolve(cwd, 'Dataset');
}

/**
 * Lists all CSV files in Dataset folder with metadata
 */
export function getAvailableDatasetFiles(): DatasetFileInfo[] {
  const dir = getDatasetDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.csv'));
  return files.map((fileName) => {
    const fullPath = path.join(dir, fileName);
    const stats = fs.statSync(fullPath);
    let title = fileName;
    let description = 'Diet and nutrition dataset CSV';
    let source: 'healthy_db' | 'openfoodfacts' | 'usda' = 'healthy_db';

    if (fileName === 'healthy_foods_database.csv') {
      title = 'Healthy Foods Database (USDA)';
      description = '9,000+ comprehensive whole foods, macros, fibers, sodium and health scores';
      source = 'healthy_db';
    } else if (fileName === 'foods_health_scores_allergens.csv') {
      title = 'OpenFoodFacts Health Scores & Allergens';
      description = '5,500+ branded and packaged foods with 6 verified allergen flags and Nutri-Scores';
      source = 'openfoodfacts';
    } else if (fileName === 'foods_allergens.csv') {
      title = 'Dedicated Allergen Matrix';
      description = '3,300+ foods with binary allergen flags for gluten, dairy, nuts, soy, eggs, fish';
      source = 'openfoodfacts';
    } else if (fileName === 'foods_dietary_restrictions.csv') {
      title = 'Dietary Restrictions & Nutri-Score';
      description = '5,000+ foods with Nova ultra-processed group and allergen verification';
      source = 'openfoodfacts';
    }

    return {
      fileName,
      relativePath: `/Dataset/${fileName}`,
      title,
      description,
      rowCount: 0,
      fileSizeBytes: stats.size,
      source,
    };
  });
}

/**
 * Parses healthy_foods_database.csv matching clean_healthy_db in Project.py
 */
export function parseHealthyFoodsDb(csvContent: string): FoodItem[] {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf('food_name');
  const typeIdx = headers.indexOf('food_type');
  const calIdx = headers.indexOf('calories');
  const protIdx = headers.indexOf('protein_g');
  const fatIdx = headers.indexOf('fat_g');
  const carbIdx = headers.indexOf('carbs_g');
  const fibIdx = headers.indexOf('fiber_g');
  const sugIdx = headers.indexOf('sugar_g');
  const sodIdx = headers.indexOf('sodium_mg');
  const healthIdx = headers.indexOf('health_score');

  const foods: FoodItem[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const foodName = (row[nameIdx] || '').trim();
    if (!foodName) continue;

    const category = (row[typeIdx] || 'General').trim();
    const calories = Math.max(0, parseFloat(row[calIdx]) || 0);

    // Deduplication key matching Project.py
    const dedupKey = `${foodName.toLowerCase()}|${category.toLowerCase()}|${calories}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const protein_g = Math.min(100, Math.max(0, parseFloat(row[protIdx]) || 0));
    const fat_g = Math.min(100, Math.max(0, parseFloat(row[fatIdx]) || 0));
    const carbs_g = Math.min(100, Math.max(0, parseFloat(row[carbIdx]) || 0));
    const fiber_g = Math.min(100, Math.max(0, parseFloat(row[fibIdx]) || 0));
    const sugar_g = Math.min(100, Math.max(0, parseFloat(row[sugIdx]) || 0));
    const sodium_mg = Math.min(40000, Math.max(0, parseFloat(row[sodIdx]) || 0));
    let health_score = parseFloat(row[healthIdx]);
    if (isNaN(health_score) || health_score <= 0) {
      health_score = 65;
    }

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

    // Allergens in healthy_foods_database: Project.py sets -1 (unknown) because ingredient text is not present
    foods.push({
      id: `hdb-${i}`,
      food_name: foodName,
      category,
      source: 'healthy_db',
      calories: Math.round(calories),
      protein_g: Math.round(protein_g * 10) / 10,
      fat_g: Math.round(fat_g * 10) / 10,
      carbs_g: Math.round(carbs_g * 10) / 10,
      fiber_g: Math.round(fiber_g * 10) / 10,
      sugar_g: Math.round(sugar_g * 10) / 10,
      sodium_mg: Math.round(sodium_mg),
      health_score: Math.min(100, Math.max(0, Math.round(health_score))),
      contains_gluten: -1,
      contains_dairy: -1,
      contains_nuts: -1,
      contains_soy: -1,
      contains_eggs: -1,
      contains_fish: -1,
      allergen_verified: false,
      meal_slot,
      ...goalScores,
    });
  }

  return foods;
}

/**
 * Parses foods_health_scores_allergens.csv matching clean_openfoodfacts in Project.py
 */
export function parseOpenFoodFactsDb(csvContent: string): FoodItem[] {
  const rows = parseCsvRows(csvContent);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf('product_name');
  const catIdx = headers.indexOf('categories');
  const brandIdx = headers.indexOf('brands');
  const calIdx = headers.indexOf('energy_kcal');
  const fatIdx = headers.indexOf('fat_100g');
  const carbIdx = headers.indexOf('carbs_100g');
  const sugIdx = headers.indexOf('sugars_100g');
  const fibIdx = headers.indexOf('fiber_100g');
  const protIdx = headers.indexOf('proteins_100g');
  const sodIdx = headers.indexOf('sodium_100g');
  const saltIdx = headers.indexOf('salt_100g');
  const nutriIdx = headers.indexOf('nutriscore_grade');
  const glutenIdx = headers.indexOf('contains_gluten');
  const dairyIdx = headers.indexOf('contains_dairy');
  const nutsIdx = headers.indexOf('contains_nuts');
  const soyIdx = headers.indexOf('contains_soy');
  const eggsIdx = headers.indexOf('contains_eggs');
  const fishIdx = headers.indexOf('contains_fish');
  const ingredientsIdx = headers.indexOf('ingredients');

  const parseBoolCol = (val: string | undefined): number => {
    if (!val) return 0;
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return 1;
    if (s === 'false' || s === '0' || s === 'no') return 0;
    return -1;
  };

  const foods: FoodItem[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    let foodName = (row[nameIdx] || '').trim();
    if (!foodName) continue;

    const brand = (row[brandIdx] || '').trim();
    if (brand && !foodName.toLowerCase().includes(brand.toLowerCase())) {
      foodName = `${foodName} (${brand})`;
    }

    const dedupKey = `${foodName.toLowerCase()}|${brand.toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    let category = (row[catIdx] || '').trim();
    if (category.startsWith('en:')) {
      category = category.replace(/en:/g, '').replace(/,/g, ', ');
    }
    if (!category) category = 'Packaged Foods';

    const calories = Math.min(1000, Math.max(0, parseFloat(row[calIdx]) || 0));
    const fat_g = Math.min(100, Math.max(0, parseFloat(row[fatIdx]) || 0));
    const carbs_g = Math.min(100, Math.max(0, parseFloat(row[carbIdx]) || 0));
    const sugar_g = Math.min(100, Math.max(0, parseFloat(row[sugIdx]) || 0));
    const fiber_g = Math.min(100, Math.max(0, parseFloat(row[fibIdx]) || 0));
    const protein_g = Math.min(100, Math.max(0, parseFloat(row[protIdx]) || 0));

    // Sodium in OFF is stored in g/100g -> convert to mg (sodium_mg = sodium_100g * 1000)
    let sodium_mg = 0;
    if (sodIdx >= 0 && row[sodIdx]) {
      sodium_mg = Math.min(40000, Math.max(0, parseFloat(row[sodIdx]) || 0) * 1000);
    } else if (saltIdx >= 0 && row[saltIdx]) {
      // Salt to sodium conversion: sodium = salt / 2.5
      sodium_mg = Math.min(40000, (Math.max(0, parseFloat(row[saltIdx]) || 0) / 2.5) * 1000);
    }

    // Map Nutriscore grade to health_score (0-100)
    let health_score = 60;
    const nutriscore = (row[nutriIdx] || '').trim().toUpperCase();
    if (nutriscore === 'A') health_score = 95;
    else if (nutriscore === 'B') health_score = 80;
    else if (nutriscore === 'C') health_score = 65;
    else if (nutriscore === 'D') health_score = 50;
    else if (nutriscore === 'E') health_score = 35;

    // Allergen flags
    let contains_gluten = glutenIdx >= 0 ? parseBoolCol(row[glutenIdx]) : 0;
    let contains_dairy = dairyIdx >= 0 ? parseBoolCol(row[dairyIdx]) : 0;
    let contains_nuts = nutsIdx >= 0 ? parseBoolCol(row[nutsIdx]) : 0;
    let contains_soy = soyIdx >= 0 ? parseBoolCol(row[soyIdx]) : 0;
    let contains_eggs = eggsIdx >= 0 ? parseBoolCol(row[eggsIdx]) : 0;
    let contains_fish = fishIdx >= 0 ? parseBoolCol(row[fishIdx]) : 0;

    // Check ingredients text if present
    if (ingredientsIdx >= 0 && row[ingredientsIdx]) {
      const ing = row[ingredientsIdx].toLowerCase();
      if (contains_gluten === 0 && ALLERGEN_KEYWORD_MAP.gluten.some((k) => ing.includes(k))) contains_gluten = 1;
      if (contains_dairy === 0 && ALLERGEN_KEYWORD_MAP.dairy.some((k) => ing.includes(k))) contains_dairy = 1;
      if (contains_nuts === 0 && ALLERGEN_KEYWORD_MAP.nuts.some((k) => ing.includes(k))) contains_nuts = 1;
      if (contains_soy === 0 && ALLERGEN_KEYWORD_MAP.soy.some((k) => ing.includes(k))) contains_soy = 1;
      if (contains_eggs === 0 && ALLERGEN_KEYWORD_MAP.eggs.some((k) => ing.includes(k))) contains_eggs = 1;
      if (contains_fish === 0 && ALLERGEN_KEYWORD_MAP.fish.some((k) => ing.includes(k))) contains_fish = 1;
    }

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

    foods.push({
      id: `off-${i}`,
      food_name: foodName,
      category,
      source: 'openfoodfacts',
      calories: Math.round(calories),
      protein_g: Math.round(protein_g * 10) / 10,
      fat_g: Math.round(fat_g * 10) / 10,
      carbs_g: Math.round(carbs_g * 10) / 10,
      fiber_g: Math.round(fiber_g * 10) / 10,
      sugar_g: Math.round(sugar_g * 10) / 10,
      sodium_mg: Math.round(sodium_mg),
      health_score,
      contains_gluten,
      contains_dairy,
      contains_nuts,
      contains_soy,
      contains_eggs,
      contains_fish,
      allergen_verified: true,
      meal_slot,
      ...goalScores,
    });
  }

  return foods;
}

/**
 * Loads and merges the actual datasets present in /Dataset folder matching build_master & finalize_for_mlp from Project.py
 */
export function loadMasterDatasetFromFolder(): {
  foods: FoodItem[];
  stats: {
    healthyFoodsCount: number;
    openFoodFactsCount: number;
    totalMasterCount: number;
  };
} {
  const dir = getDatasetDir();
  let healthyFoods: FoodItem[] = [];
  let openFoodFacts: FoodItem[] = [];

  const healthyPath = path.join(dir, 'healthy_foods_database.csv');
  if (fs.existsSync(healthyPath)) {
    try {
      const content = fs.readFileSync(healthyPath, 'utf-8');
      healthyFoods = parseHealthyFoodsDb(content);
      console.log(`[DatasetLoader] Loaded ${healthyFoods.length} items from healthy_foods_database.csv`);
    } catch (err) {
      console.error('[DatasetLoader] Error reading healthy_foods_database.csv:', err);
    }
  }

  const offPath = path.join(dir, 'foods_health_scores_allergens.csv');
  if (fs.existsSync(offPath)) {
    try {
      const content = fs.readFileSync(offPath, 'utf-8');
      openFoodFacts = parseOpenFoodFactsDb(content);
      console.log(`[DatasetLoader] Loaded ${openFoodFacts.length} items from foods_health_scores_allergens.csv`);
    } catch (err) {
      console.error('[DatasetLoader] Error reading foods_health_scores_allergens.csv:', err);
    }
  }

  // Cross-reference allergen information from foods_allergens.csv to verify healthy_db foods where names match
  const allergensPath = path.join(dir, 'foods_allergens.csv');
  if (fs.existsSync(allergensPath)) {
    try {
      const content = fs.readFileSync(allergensPath, 'utf-8');
      const rows = parseCsvRows(content);
      if (rows.length > 1) {
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const nameIdx = headers.indexOf('product_name');
        const gIdx = headers.indexOf('contains_gluten');
        const dIdx = headers.indexOf('contains_dairy');
        const nIdx = headers.indexOf('contains_nuts');
        const sIdx = headers.indexOf('contains_soy');
        const eIdx = headers.indexOf('contains_eggs');
        const fIdx = headers.indexOf('contains_fish');

        const allergenMap = new Map<string, { g: number; d: number; n: number; s: number; e: number; f: number }>();
        const parseB = (v: string) => {
          const l = (v || '').trim().toLowerCase();
          return l === 'true' || l === '1' ? 1 : 0;
        };

        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const name = (r[nameIdx] || '').trim().toLowerCase();
          if (name) {
            allergenMap.set(name, {
              g: parseB(r[gIdx]),
              d: parseB(r[dIdx]),
              n: parseB(r[nIdx]),
              s: parseB(r[sIdx]),
              e: parseB(r[eIdx]),
              f: parseB(r[fIdx]),
            });
          }
        }

        // Apply to any healthy food matching name
        healthyFoods.forEach((food) => {
          const lowerName = food.food_name.toLowerCase();
          for (const [key, val] of allergenMap.entries()) {
            if (lowerName.includes(key) || key.includes(lowerName)) {
              food.contains_gluten = val.g;
              food.contains_dairy = val.d;
              food.contains_nuts = val.n;
              food.contains_soy = val.s;
              food.contains_eggs = val.e;
              food.contains_fish = val.f;
              food.allergen_verified = true;
              break;
            }
          }
        });
      }
    } catch (err) {
      console.warn('[DatasetLoader] Warning processing foods_allergens.csv:', err);
    }
  }

  // Combine into master list (matching build_master in Project.py)
  const master = [...healthyFoods, ...openFoodFacts];

  return {
    foods: master,
    stats: {
      healthyFoodsCount: healthyFoods.length,
      openFoodFactsCount: openFoodFacts.length,
      totalMasterCount: master.length,
    },
  };
}
