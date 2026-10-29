import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_FOOD_DATABASE } from './src/data/foodDatabase';
import {
  filterByAllergens,
  scoreFoodsMultiCriteria,
  calculateGoalScores,
  assignMealSlot,
  predictMlpGoal,
} from './src/utils/scoring';
import {
  loadMasterDatasetFromFolder,
  getAvailableDatasetFiles,
  parseHealthyFoodsDb,
  parseOpenFoodFactsDb,
} from './src/server/datasetPipeline';
import {
  registerUser,
  loginUser,
  logoutUser,
  authenticateToken,
  getUserPreferences,
  updateUserPreferences,
  getDbStatus,
  initPostgres,
  getWeeklySchedule,
  saveWeeklySchedule,
  updateWeeklyAdherence,
  archiveAndResetWeeklySchedule,
  getUserWeeklyHistory,
  getUserHealthAnalytics,
} from './src/server/db';
import {
  generate7DaySchedule,
  generateInitialAdherence,
  computeAdherenceStats,
  DAYS_OF_WEEK,
} from './src/server/weeklyScheduler';
import { FoodItem, GoalType, Allergen, GoalWeights } from './src/types/diet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// In-memory food database loaded directly from /Dataset folder
let foodDb: FoodItem[] = [];
let datasetStats = {
  healthyFoodsCount: 0,
  openFoodFactsCount: 0,
  totalMasterCount: 0,
};

// Initialize with the real dataset from /Dataset folder
try {
  const loaded = loadMasterDatasetFromFolder();
  if (loaded.foods.length > 0) {
    foodDb = loaded.foods;
    datasetStats = loaded.stats;
    console.log(`[Server] Successfully loaded ${foodDb.length} real food records from /Dataset folder.`);
  } else {
    foodDb = [...INITIAL_FOOD_DATABASE];
    console.warn('[Server] /Dataset folder empty or unreadable, loaded fallback curated foods.');
  }
} catch (err) {
  console.error('[Server] Failed to load dataset from folder, using fallback:', err);
  foodDb = [...INITIAL_FOOD_DATABASE];
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // -------------------------------------------------------------------------
  // BACKEND API ROUTES (Ported from Project.py)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // USER REGISTRATION, AUTH & PREFERENCES (PostgreSQL + pgAdmin)
  // -------------------------------------------------------------------------

  // Get Database status
  app.get('/api/db/status', (_req: Request, res: Response) => {
    res.json(getDbStatus());
  });

  // Configure/test custom PostgreSQL connection (e.g. pgAdmin credentials)
  app.post('/api/db/config', async (req: Request, res: Response) => {
    try {
      const { host, port, user, password, database, connectionString } = req.body;
      const connected = await initPostgres({
        host,
        port: port ? Number(port) : undefined,
        user,
        password,
        database,
        connectionString,
      });
      res.json({
        success: true,
        connected,
        status: getDbStatus(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // User registration with password hashing
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      const result = await registerUser(name, email, password);
      const preferences = await getUserPreferences(result.user.id);
      res.status(201).json({
        success: true,
        token: result.token,
        user: result.user,
        preferences,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // User login with password hash verification
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await loginUser(email, password);
      res.json({
        success: true,
        token: result.token,
        user: result.user,
        preferences: result.preferences,
      });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message });
    }
  });

  // User logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    logoutUser(authHeader);
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Get current logged-in user profile & preferences
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }
    const preferences = await getUserPreferences(session.userId);
    res.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
      },
      preferences,
    });
  });

  // Get preferences for the authenticated user
  app.get('/api/user/preferences', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }
    const preferences = await getUserPreferences(session.userId);
    res.json({
      success: true,
      preferences,
    });
  });

  // Update preferences for the authenticated user
  app.put('/api/user/preferences', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }
    try {
      const updated = await updateUserPreferences(session.userId, req.body);
      res.json({
        success: true,
        preferences: updated,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // WEEKLY DIET SCHEDULE & ADHERENCE DASHBOARD
  // -------------------------------------------------------------------------

  // Get current user's 7-day schedule & adherence
  app.get('/api/user/weekly-schedule', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    try {
      let { schedule, adherence } = await getWeeklySchedule(session.userId);

      // If user has no weekly schedule yet, generate one automatically from their saved preferences
      if (!schedule || Object.keys(schedule).length === 0) {
        const preferences = await getUserPreferences(session.userId);
        schedule = generate7DaySchedule(
          foodDb,
          preferences.goal_weights,
          preferences.allergies,
          preferences.strict_allergens,
          preferences.items_per_slot || 2
        );
        adherence = generateInitialAdherence();
        await saveWeeklySchedule(session.userId, schedule, adherence);
      }

      const stats = computeAdherenceStats(adherence || generateInitialAdherence());

      res.json({
        success: true,
        schedule,
        adherence: adherence || generateInitialAdherence(),
        stats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Generate or re-generate 7-day diet schedule
  app.post('/api/user/weekly-schedule/generate', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    try {
      const preferences = await getUserPreferences(session.userId);
      const schedule = generate7DaySchedule(
        foodDb,
        preferences.goal_weights,
        preferences.allergies,
        preferences.strict_allergens,
        preferences.items_per_slot || 2
      );

      // Check if preserving existing adherence or resetting
      const { preserveAdherence = false } = req.body || {};
      let adherence = generateInitialAdherence();
      if (preserveAdherence) {
        const existing = await getWeeklySchedule(session.userId);
        if (existing.adherence) {
          adherence = existing.adherence;
        }
      }

      await saveWeeklySchedule(session.userId, schedule, adherence);
      const stats = computeAdherenceStats(adherence);

      res.json({
        success: true,
        schedule,
        adherence,
        stats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update adherence status for a day or meal
  app.put('/api/user/weekly-schedule/adherence', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    try {
      const { day, slot, status, adherence: fullAdherence, dayStatus } = req.body;
      const current = await getWeeklySchedule(session.userId);
      let updatedAdherence = current.adherence || generateInitialAdherence();

      const adherenceMap = updatedAdherence as Record<string, Record<string, any>>;

      if (fullAdherence) {
        updatedAdherence = fullAdherence;
      } else if (day && dayStatus) {
        // Bulk mark whole day
        if (adherenceMap[String(day)]) {
          adherenceMap[String(day)].Morning = dayStatus;
          adherenceMap[String(day)].Lunch = dayStatus;
          adherenceMap[String(day)].Snack = dayStatus;
          adherenceMap[String(day)].Dinner = dayStatus;
        }
      } else if (day && slot && status) {
        // Mark specific meal slot
        if (adherenceMap[String(day)]) {
          adherenceMap[String(day)][String(slot)] = status;
        }
      }

      await updateWeeklyAdherence(session.userId, updatedAdherence);
      const stats = computeAdherenceStats(updatedAdherence);

      res.json({
        success: true,
        adherence: updatedAdherence,
        stats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Complete and archive the current week, then reset database state for the upcoming week
  app.post('/api/user/weekly-schedule/complete-week', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    try {
      const preferences = await getUserPreferences(session.userId);

      // Generate a fresh new schedule for the incoming week based on preferences
      const nextWeekSchedule = generate7DaySchedule(
        foodDb,
        preferences.goal_weights,
        preferences.allergies,
        preferences.strict_allergens,
        preferences.items_per_slot || 2
      );

      // Archive current week and reset database for next week
      const result = await archiveAndResetWeeklySchedule(session.userId, nextWeekSchedule);
      const newStats = computeAdherenceStats(result.newAdherence);

      res.json({
        success: true,
        message: `Week ${result.archivedRecord.weekNumber} completed & archived successfully. Database reset for next week.`,
        archivedRecord: result.archivedRecord,
        schedule: result.newSchedule,
        adherence: result.newAdherence,
        stats: newStats,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get user's archived weekly history
  app.get('/api/user/weekly-history', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    try {
      const history = await getUserWeeklyHistory(session.userId);
      res.json({
        success: true,
        history,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get user health rate analytics
  app.get('/api/user/health-analytics', async (req: Request, res: Response) => {
    const session = authenticateToken(req.headers.authorization);
    if (!session) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    try {
      const analytics = await getUserHealthAnalytics(session.userId);
      res.json(analytics);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'Diet Recommendation System Backend API',
      timestamp: new Date().toISOString(),
      foodsCount: foodDb.length,
      datasetStats,
      model: 'MLP (64, 32) + PCA 95% + Multi-Criteria Goal Scoring (from Project.py)',
    });
  });

  // Get list of dataset files available in /Dataset folder
  app.get('/api/dataset/files', (_req: Request, res: Response) => {
    try {
      const files = getAvailableDatasetFiles();
      res.json({
        success: true,
        data: files,
        activeFoodsCount: foodDb.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Load or switch active dataset file from /Dataset folder
  app.post('/api/dataset/load-file', (req: Request, res: Response) => {
    try {
      const { fileName } = req.body;
      if (!fileName) {
        return res.status(400).json({ success: false, error: 'fileName is required' });
      }

      const dirCandidates = [
        path.resolve(process.cwd(), 'Dataset'),
        '/Dataset',
      ];
      let targetPath = '';
      for (const d of dirCandidates) {
        const p = path.join(d, path.basename(fileName));
        if (fs.existsSync(p)) {
          targetPath = p;
          break;
        }
      }

      if (!targetPath) {
        return res.status(404).json({ success: false, error: `File ${fileName} not found in Dataset folder` });
      }

      const content = fs.readFileSync(targetPath, 'utf-8');
      let loaded: FoodItem[] = [];

      if (fileName.includes('healthy')) {
        loaded = parseHealthyFoodsDb(content);
      } else {
        loaded = parseOpenFoodFactsDb(content);
      }

      if (loaded.length === 0) {
        return res.status(400).json({ success: false, error: 'No food items could be parsed from file' });
      }

      foodDb = loaded;
      res.json({
        success: true,
        count: foodDb.length,
        message: `Successfully loaded ${foodDb.length} records from ${fileName}`,
        sample: foodDb.slice(0, 5),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset to the full master dataset (all combined files from /Dataset)
  app.post('/api/dataset/reset-master', (_req: Request, res: Response) => {
    try {
      const loaded = loadMasterDatasetFromFolder();
      if (loaded.foods.length > 0) {
        foodDb = loaded.foods;
        datasetStats = loaded.stats;
      }
      res.json({
        success: true,
        count: foodDb.length,
        stats: datasetStats,
        message: `Reset active database to ${foodDb.length} master foods from /Dataset folder`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get foods with optional query filters or pagination
  app.get('/api/foods', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const slot = req.query.slot as string | undefined;

    let result = foodDb;

    if (category && category !== 'All') {
      result = result.filter((f) => f.category.toLowerCase() === category.toLowerCase());
    }

    if (slot && slot !== 'All') {
      result = result.filter((f) => f.meal_slot.toLowerCase() === slot.toLowerCase());
    }

    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (f) => f.food_name.toLowerCase().includes(term) || f.category.toLowerCase().includes(term)
      );
    }

    const totalMatching = result.length;
    if (limit && limit > 0) {
      result = result.slice(0, limit);
    }

    res.json({
      success: true,
      totalCount: foodDb.length,
      filteredCount: totalMatching,
      count: result.length,
      data: result,
    });
  });

  // Add custom food item
  app.post('/api/foods', (req: Request, res: Response) => {
    try {
      const raw = req.body;
      if (!raw.food_name) {
        return res.status(400).json({ success: false, error: 'food_name is required' });
      }

      const goalScores = calculateGoalScores({
        calories: Number(raw.calories) || 0,
        protein_g: Number(raw.protein_g) || 0,
        fat_g: Number(raw.fat_g) || 0,
        carbs_g: Number(raw.carbs_g) || 0,
        fiber_g: Number(raw.fiber_g) || 0,
        sugar_g: Number(raw.sugar_g) || 0,
        sodium_mg: Number(raw.sodium_mg) || 0,
      });

      const slot = assignMealSlot(raw.food_name, raw.category || 'General');

      const newFood: FoodItem = {
        id: `custom-${Date.now()}`,
        food_name: String(raw.food_name).trim(),
        category: String(raw.category || 'Custom').trim(),
        source: 'user',
        calories: Number(raw.calories) || 0,
        protein_g: Number(raw.protein_g) || 0,
        fat_g: Number(raw.fat_g) || 0,
        carbs_g: Number(raw.carbs_g) || 0,
        fiber_g: Number(raw.fiber_g) || 0,
        sugar_g: Number(raw.sugar_g) || 0,
        sodium_mg: Number(raw.sodium_mg) || 0,
        health_score: Number(raw.health_score) || 75,
        contains_gluten: Number(raw.contains_gluten) || 0,
        contains_dairy: Number(raw.contains_dairy) || 0,
        contains_nuts: Number(raw.contains_nuts) || 0,
        contains_soy: Number(raw.contains_soy) || 0,
        contains_eggs: Number(raw.contains_eggs) || 0,
        contains_fish: Number(raw.contains_fish) || 0,
        allergen_verified: true,
        meal_slot: slot,
        ...goalScores,
      };

      foodDb.unshift(newFood);

      res.status(201).json({
        success: true,
        message: 'Food added successfully',
        data: newFood,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Recommend daily meal plan (matching Project.py: recommend_daily_plan)
  app.post('/api/recommend', (req: Request, res: Response) => {
    try {
      const {
        user_goals = {
          'Weight Loss': 1.0,
          'Muscle Gain': 0.0,
          'Heart Health': 0.0,
          'Diabetic-Friendly': 0.0,
          'Balanced Diet': 0.0,
        },
        user_allergies = [],
        strict_allergens = true,
        top_n_per_slot = 2,
      }: {
        user_goals?: GoalWeights;
        user_allergies?: Allergen[];
        strict_allergens?: boolean;
        top_n_per_slot?: number;
      } = req.body;

      const resolvedGoals: GoalWeights = {
        'Weight Loss': user_goals?.['Weight Loss'] ?? 1.0,
        'Muscle Gain': user_goals?.['Muscle Gain'] ?? 0.0,
        'Heart Health': user_goals?.['Heart Health'] ?? 0.0,
        'Diabetic-Friendly': user_goals?.['Diabetic-Friendly'] ?? 0.0,
        'Balanced Diet': user_goals?.['Balanced Diet'] ?? 0.0,
      };

      // 1. Rule-based allergen filtering (filter_by_allergens in Project.py)
      const safeFoods = filterByAllergens(foodDb, user_allergies, strict_allergens);

      // 2. Multi-criteria normalization and scoring (score_foods_multi_criteria in Project.py)
      const scoredFoods = scoreFoodsMultiCriteria(safeFoods, resolvedGoals);

      // 3. Partition by meal slots (Morning, Afternoon, Snack)
      const morningSlot = scoredFoods
        .filter((f) => f.meal_slot === 'Morning')
        .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

      const afternoonSlot = scoredFoods
        .filter((f) => f.meal_slot === 'Afternoon')
        .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

      const snackSlot = scoredFoods
        .filter((f) => f.meal_slot === 'Snack')
        .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

      const n = Math.max(1, Number(top_n_per_slot) || 2);

      const plan = {
        Morning: morningSlot.slice(0, n),
        Lunch: afternoonSlot.slice(0, n),
        Snack: snackSlot.slice(0, Math.max(1, n - 1)),
        Dinner: afternoonSlot.slice(n, n * 2),
      };

      // Calculate totals
      const allItems = [...plan.Morning, ...plan.Lunch, ...plan.Snack, ...plan.Dinner];
      const totals = allItems.reduce(
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

      res.json({
        success: true,
        plan,
        totals,
        candidateCount: safeFoods.length,
        totalCatalogCount: foodDb.length,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Predict goal classification via MLP (predict_goal_for_food in Project.py)
  app.post('/api/predict-goal', (req: Request, res: Response) => {
    try {
      const foodInput = req.body;
      const prediction = predictMlpGoal({
        calories: Number(foodInput.calories) || 0,
        protein_g: Number(foodInput.protein_g) || 0,
        fat_g: Number(foodInput.fat_g) || 0,
        carbs_g: Number(foodInput.carbs_g) || 0,
        fiber_g: Number(foodInput.fiber_g) || 0,
        sugar_g: Number(foodInput.sugar_g) || 0,
        sodium_mg: Number(foodInput.sodium_mg) || 0,
        health_score: Number(foodInput.health_score) || 50,
      });

      res.json({
        success: true,
        data: prediction,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Model performance and confusion matrix metrics (from Project.py evaluation)
  app.get('/api/model-metrics', (_req: Request, res: Response) => {
    res.json({
      success: true,
      modelType: 'Multi-Layer Perceptron Classifier (MLP)',
      hiddenLayers: [64, 32],
      activation: 'relu',
      solver: 'adam',
      pcaVarianceExplained: 0.95,
      testAccuracy: 0.950,
      classes: ['Weight Loss', 'Muscle Gain', 'Heart Health', 'Diabetic-Friendly', 'Balanced Diet'],
      confusionMatrix: [
        [401, 4, 6, 3, 6],
        [3, 365, 2, 5, 5],
        [8, 1, 326, 6, 4],
        [5, 2, 7, 342, 4],
        [8, 5, 6, 5, 371],
      ],
      classificationReport: [
        { goal: 'Weight Loss', precision: 0.95, recall: 0.95, f1: 0.95, support: 420 },
        { goal: 'Muscle Gain', precision: 0.97, recall: 0.96, f1: 0.96, support: 380 },
        { goal: 'Heart Health', precision: 0.94, recall: 0.94, f1: 0.94, support: 345 },
        { goal: 'Diabetic-Friendly', precision: 0.95, recall: 0.95, f1: 0.95, support: 360 },
        { goal: 'Balanced Diet', precision: 0.95, recall: 0.94, f1: 0.94, support: 395 },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // FRONTEND INTEGRATION (Vite dev middleware vs Production static)
  // -------------------------------------------------------------------------
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexPath = path.resolve(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      app.use((_req: Request, res: Response) => {
        res.sendFile(indexPath);
      });
    } else {
      // Standalone backend mode (e.g., Render hosting backend API with frontend on Vercel)
      app.get('/', (_req: Request, res: Response) => {
        res.json({
          service: 'Diet Recommendation System Backend API',
          status: 'healthy',
          foodsCount: foodDb.length,
          endpoints: [
            '/api/health',
            '/api/foods',
            '/api/recommend',
            '/api/predict-goal',
            '/api/model-metrics',
            '/api/dataset/files',
          ],
        });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🥗 Diet Recommendation System is Running!`);
    console.log(`➜  Local:    http://localhost:${PORT}/`);
    console.log(`➜  Network:  http://127.0.0.1:${PORT}/`);
    console.log(`➜  Dataset:  ${foodDb.length.toLocaleString()} real foods loaded from /Dataset`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
