import { Pool, PoolConfig } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  User,
  UserPreferences,
  GoalWeights,
  Allergen,
  DayOfWeek,
  WeeklySchedule,
  WeeklyAdherence,
  WeeklyArchiveRecord,
  HealthAnalyticsResponse,
} from '../types/diet';

// Default preference preset
export const DEFAULT_PREFERENCES: UserPreferences = {
  goal_weights: {
    'Weight Loss': 0.7,
    'Muscle Gain': 0.0,
    'Heart Health': 0.3,
    'Diabetic-Friendly': 0.0,
    'Balanced Diet': 0.0,
  },
  allergies: [],
  strict_allergens: false,
  items_per_slot: 2,
};

// Cryptographic Password Hashing using Node.js built-in scrypt
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const calculatedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(calculatedHash, 'hex')
    );
  } catch (err) {
    return false;
  }
}

export interface UserRecord {
  id: number | string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  created_at: string;
}

// In-memory / local persistent fallback storage
const FALLBACK_FILE = path.resolve(process.cwd(), '.user_data_cache.json');

interface FallbackStore {
  users: UserRecord[];
  preferences: Record<string, UserPreferences>;
  schedules: Record<
    string,
    {
      schedule: WeeklySchedule;
      adherence: WeeklyAdherence;
      updated_at: string;
    }
  >;
  history: Record<string, WeeklyArchiveRecord[]>;
}

let fallbackData: FallbackStore = {
  users: [],
  preferences: {},
  schedules: {},
  history: {},
};

// Load local fallback cache if exists
try {
  if (fs.existsSync(FALLBACK_FILE)) {
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    fallbackData = JSON.parse(raw);
  }
} catch (err) {
  console.warn('[DB] Could not load local fallback cache, starting clean');
}

function saveFallbackData() {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(fallbackData, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[DB] Could not save fallback data:', err);
  }
}

// Auto-load .env file if present in working directory
function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
      console.log('[DB] Loaded environment settings from .env file');
    }
  } catch (err) {
    console.warn('[DB] Could not parse .env file:', err);
  }
}
loadEnvFile();

// Active session token store: token -> user
interface Session {
  userId: number | string;
  email: string;
  name: string;
  createdAt: number;
}
const sessions = new Map<string, Session>();

// PostgreSQL Pool instance
let pool: Pool | null = null;
let isPostgresConnected = false;
let currentDbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'diet_recommendation',
  connectionString: process.env.DATABASE_URL || '',
};

export function getDbStatus() {
  return {
    success: true,
    type: isPostgresConnected ? ('postgresql' as const) : ('in-memory-fallback' as const),
    connected: isPostgresConnected,
    host: currentDbConfig.host,
    database: currentDbConfig.database,
    userCount: isPostgresConnected ? -1 : fallbackData.users.length,
    message: isPostgresConnected
      ? `Connected to PostgreSQL database "${currentDbConfig.database}" at ${currentDbConfig.host}:${currentDbConfig.port}`
      : `PostgreSQL is waiting for connection (${currentDbConfig.host}:${currentDbConfig.port}). Local secure storage is active with full password hashing.`,
  };
}

export async function initPostgres(customConfig?: Partial<typeof currentDbConfig>): Promise<boolean> {
  if (customConfig) {
    currentDbConfig = { ...currentDbConfig, ...customConfig };
  }

  if (pool) {
    try {
      await pool.end();
    } catch {}
    pool = null;
    isPostgresConnected = false;
  }

  const poolConfig: PoolConfig = {
    host: currentDbConfig.host || 'localhost',
    port: Number(currentDbConfig.port) || 5432,
    user: currentDbConfig.user || 'postgres',
    password: String(currentDbConfig.password || ''),
    database: currentDbConfig.database || 'diet_db',
    connectionTimeoutMillis: 3000,
  };
  if (currentDbConfig.connectionString && !currentDbConfig.password) {
    (poolConfig as any).connectionString = currentDbConfig.connectionString;
  }

  try {
    const testPool = new Pool(poolConfig);
    const client = await testPool.connect();
    
    // Create tables if they do not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        goal_weights JSONB NOT NULL,
        allergies JSONB NOT NULL,
        strict_allergens BOOLEAN DEFAULT FALSE,
        items_per_slot INTEGER DEFAULT 2,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_schedule (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        schedule_data JSONB NOT NULL,
        adherence_data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_schedule_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        start_date VARCHAR(64) NOT NULL,
        end_date VARCHAR(64) NOT NULL,
        schedule_data JSONB NOT NULL,
        adherence_data JSONB NOT NULL,
        stats JSONB NOT NULL,
        health_rate NUMERIC(5, 2) NOT NULL,
        health_metrics JSONB NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    client.release();
    pool = testPool;
    isPostgresConnected = true;
    console.log(`[PostgreSQL] Successfully connected to ${currentDbConfig.database} on ${currentDbConfig.host}:${currentDbConfig.port}`);
    return true;
  } catch (err: any) {
    console.warn(`[PostgreSQL] Connection to ${currentDbConfig.host}:${currentDbConfig.port} failed: ${err.message}. Using secure fallback storage.`);
    isPostgresConnected = false;
    return false;
  }
}

// Automatically try initializing PostgreSQL on module load
initPostgres().catch(() => {});

// User Registration
export async function registerUser(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanName) throw new Error('Name is required');
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Valid email is required');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');

  const { hash, salt } = hashPassword(password);

  if (isPostgresConnected && pool) {
    try {
      // Check existing email
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
      if (existing.rows.length > 0) {
        throw new Error('An account with this email already exists');
      }

      // Insert user
      const userRes = await pool.query(
        `INSERT INTO users (name, email, password_hash, salt) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, name, email, created_at`,
        [cleanName, cleanEmail, hash, salt]
      );
      const userRow = userRes.rows[0];

      // Insert default preferences
      await pool.query(
        `INSERT INTO user_preferences (user_id, goal_weights, allergies, strict_allergens, items_per_slot)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userRow.id,
          JSON.stringify(DEFAULT_PREFERENCES.goal_weights),
          JSON.stringify(DEFAULT_PREFERENCES.allergies),
          DEFAULT_PREFERENCES.strict_allergens,
          DEFAULT_PREFERENCES.items_per_slot,
        ]
      );

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, {
        userId: userRow.id,
        email: userRow.email,
        name: userRow.name,
        createdAt: Date.now(),
      });

      return {
        user: {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          created_at: userRow.created_at,
        },
        token,
      };
    } catch (err: any) {
      if (err.message.includes('already exists')) throw err;
      console.warn('[DB] PostgreSQL query failed in registration, falling back to local store:', err);
    }
  }

  // Fallback storage
  const existing = fallbackData.users.find((u) => u.email === cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists');
  }

  const userId = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();
  const newRecord: UserRecord = {
    id: userId,
    name: cleanName,
    email: cleanEmail,
    password_hash: hash,
    salt,
    created_at: now,
  };

  fallbackData.users.push(newRecord);
  fallbackData.preferences[String(userId)] = { ...DEFAULT_PREFERENCES, updated_at: now };
  saveFallbackData();

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    email: cleanEmail,
    name: cleanName,
    createdAt: Date.now(),
  });

  return {
    user: {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      created_at: now,
    },
    token,
  };
}

// User Login
export async function loginUser(email: string, password: string): Promise<{ user: User; preferences: UserPreferences; token: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Email and password are required');
  }

  if (isPostgresConnected && pool) {
    try {
      const userRes = await pool.query(
        'SELECT id, name, email, password_hash, salt, created_at FROM users WHERE email = $1',
        [cleanEmail]
      );

      if (userRes.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const userRow = userRes.rows[0];
      const valid = verifyPassword(password, userRow.password_hash, userRow.salt);
      if (!valid) {
        throw new Error('Invalid email or password');
      }

      // Load user preferences
      const prefRes = await pool.query(
        'SELECT goal_weights, allergies, strict_allergens, items_per_slot, updated_at FROM user_preferences WHERE user_id = $1',
        [userRow.id]
      );

      let preferences: UserPreferences = { ...DEFAULT_PREFERENCES };
      if (prefRes.rows.length > 0) {
        const row = prefRes.rows[0];
        preferences = {
          goal_weights: typeof row.goal_weights === 'string' ? JSON.parse(row.goal_weights) : row.goal_weights,
          allergies: typeof row.allergies === 'string' ? JSON.parse(row.allergies) : row.allergies,
          strict_allergens: Boolean(row.strict_allergens),
          items_per_slot: Number(row.items_per_slot) || 2,
          updated_at: row.updated_at,
        };
      }

      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, {
        userId: userRow.id,
        email: userRow.email,
        name: userRow.name,
        createdAt: Date.now(),
      });

      return {
        user: {
          id: userRow.id,
          name: userRow.name,
          email: userRow.email,
          created_at: userRow.created_at,
        },
        preferences,
        token,
      };
    } catch (err: any) {
      if (err.message.includes('Invalid email')) throw err;
      console.warn('[DB] PostgreSQL query failed in login, trying local fallback:', err);
    }
  }

  // Fallback storage
  const record = fallbackData.users.find((u) => u.email === cleanEmail);
  if (!record) {
    throw new Error('Invalid email or password');
  }

  const valid = verifyPassword(password, record.password_hash, record.salt);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  const preferences = fallbackData.preferences[String(record.id)] || { ...DEFAULT_PREFERENCES };
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: record.id,
    email: record.email,
    name: record.name,
    createdAt: Date.now(),
  });

  return {
    user: {
      id: record.id,
      name: record.name,
      email: record.email,
      created_at: record.created_at,
    },
    preferences,
    token,
  };
}

// Authenticate session from token
export function authenticateToken(token: string | undefined): Session | null {
  if (!token) return null;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  const session = sessions.get(cleanToken);
  if (!session) return null;
  return session;
}

export function logoutUser(token: string | undefined): boolean {
  if (!token) return false;
  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  return sessions.delete(cleanToken);
}

// Get user preferences (strictly scoped to authenticated userId)
export async function getUserPreferences(userId: number | string): Promise<UserPreferences> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        'SELECT goal_weights, allergies, strict_allergens, items_per_slot, updated_at FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          goal_weights: typeof row.goal_weights === 'string' ? JSON.parse(row.goal_weights) : row.goal_weights,
          allergies: typeof row.allergies === 'string' ? JSON.parse(row.allergies) : row.allergies,
          strict_allergens: Boolean(row.strict_allergens),
          items_per_slot: Number(row.items_per_slot) || 2,
          updated_at: row.updated_at,
        };
      }
    } catch (err) {
      console.warn('[DB] PostgreSQL error fetching preferences:', err);
    }
  }

  return fallbackData.preferences[String(userId)] || { ...DEFAULT_PREFERENCES };
}

// Update user preferences (strictly scoped to authenticated userId)
export async function updateUserPreferences(
  userId: number | string,
  prefs: Partial<UserPreferences>
): Promise<UserPreferences> {
  const existing = await getUserPreferences(userId);

  const updated: UserPreferences = {
    goal_weights: prefs.goal_weights || existing.goal_weights,
    allergies: prefs.allergies || existing.allergies,
    strict_allergens: prefs.strict_allergens !== undefined ? prefs.strict_allergens : existing.strict_allergens,
    items_per_slot: prefs.items_per_slot !== undefined ? prefs.items_per_slot : existing.items_per_slot,
    updated_at: new Date().toISOString(),
  };

  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO user_preferences (user_id, goal_weights, allergies, strict_allergens, items_per_slot, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE SET
           goal_weights = EXCLUDED.goal_weights,
           allergies = EXCLUDED.allergies,
           strict_allergens = EXCLUDED.strict_allergens,
           items_per_slot = EXCLUDED.items_per_slot,
           updated_at = EXCLUDED.updated_at`,
        [
          userId,
          JSON.stringify(updated.goal_weights),
          JSON.stringify(updated.allergies),
          updated.strict_allergens,
          updated.items_per_slot,
          updated.updated_at,
        ]
      );
      return updated;
    } catch (err) {
      console.warn('[DB] PostgreSQL error updating preferences, falling back to local store:', err);
    }
  }

  fallbackData.preferences[String(userId)] = updated;
  saveFallbackData();
  return updated;
}

// Get weekly schedule and adherence for a user
export async function getWeeklySchedule(
  userId: number | string
): Promise<{ schedule: WeeklySchedule | null; adherence: WeeklyAdherence | null }> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        'SELECT schedule_data, adherence_data FROM weekly_schedule WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          schedule:
            typeof row.schedule_data === 'string'
              ? JSON.parse(row.schedule_data)
              : row.schedule_data,
          adherence:
            typeof row.adherence_data === 'string'
              ? JSON.parse(row.adherence_data)
              : row.adherence_data,
        };
      }
    } catch (err) {
      console.warn('[DB] PostgreSQL error fetching weekly schedule:', err);
    }
  }

  const stored = fallbackData.schedules?.[String(userId)];
  if (stored) {
    return {
      schedule: stored.schedule,
      adherence: stored.adherence,
    };
  }
  return { schedule: null, adherence: null };
}

// Save or replace weekly schedule and adherence for a user
export async function saveWeeklySchedule(
  userId: number | string,
  schedule: WeeklySchedule,
  adherence: WeeklyAdherence
): Promise<void> {
  const now = new Date().toISOString();

  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO weekly_schedule (user_id, schedule_data, adherence_data, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           schedule_data = EXCLUDED.schedule_data,
           adherence_data = EXCLUDED.adherence_data,
           updated_at = EXCLUDED.updated_at`,
        [userId, JSON.stringify(schedule), JSON.stringify(adherence), now]
      );
      return;
    } catch (err) {
      console.warn('[DB] PostgreSQL error saving weekly schedule:', err);
    }
  }

  if (!fallbackData.schedules) fallbackData.schedules = {};
  fallbackData.schedules[String(userId)] = {
    schedule,
    adherence,
    updated_at: now,
  };
  saveFallbackData();
}

// Update only the adherence tracking data for a user
export async function updateWeeklyAdherence(
  userId: number | string,
  adherence: WeeklyAdherence
): Promise<void> {
  const now = new Date().toISOString();

  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `UPDATE weekly_schedule 
         SET adherence_data = $1, updated_at = $2 
         WHERE user_id = $3`,
        [JSON.stringify(adherence), now, userId]
      );
      return;
    } catch (err) {
      console.warn('[DB] PostgreSQL error updating adherence:', err);
    }
  }

  if (!fallbackData.schedules) fallbackData.schedules = {};
  if (fallbackData.schedules[String(userId)]) {
    fallbackData.schedules[String(userId)].adherence = adherence;
    fallbackData.schedules[String(userId)].updated_at = now;
    saveFallbackData();
  }
}

// Compute health metrics and composite health rate (0 - 100%)
export function computeWeekHealthMetrics(
  schedule: WeeklySchedule,
  adherence: WeeklyAdherence,
  stats: {
    followedCount: number;
    notFollowedCount: number;
    pendingCount: number;
    totalMeals: number;
    adherenceRate: number;
  }
): {
  healthRate: number;
  healthMetrics: {
    adherenceScore: number;
    nutritionalQualityScore: number;
    goalAlignmentScore: number;
    mealConsistencyScore: number;
    estimatedCaloriesPerDay: number;
    estimatedProteinPerDay: number;
  };
} {
  const DAYS: DayOfWeek[] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  let totalFollowedCalories = 0;
  let totalFollowedProtein = 0;
  let healthScoreSum = 0;
  let foodCount = 0;

  const slotFollowedCounts = {
    Morning: 0,
    Lunch: 0,
    Snack: 0,
    Dinner: 0,
  };

  for (const day of DAYS) {
    const daySchedule = schedule?.[day];
    const dayAdh = adherence?.[day];
    if (!daySchedule || !dayAdh) continue;

    const slots: (keyof typeof slotFollowedCounts)[] = ['Morning', 'Lunch', 'Snack', 'Dinner'];
    for (const slot of slots) {
      const items = daySchedule.meals?.[slot] || [];
      const status = dayAdh[slot];

      if (status === 'followed') {
        slotFollowedCounts[slot]++;
        for (const f of items) {
          totalFollowedCalories += f.calories || 0;
          totalFollowedProtein += f.protein_g || 0;
          healthScoreSum += f.health_score || 75;
          foodCount++;
        }
      } else {
        // Sample food quality from scheduled items even if pending/unrecorded
        for (const f of items) {
          if (foodCount === 0) {
            healthScoreSum += f.health_score || 70;
          }
        }
      }
    }
  }

  // 1. Adherence Score (0 - 100): completed followed meals out of 28 scheduled meals
  const adherenceScore = Math.min(100, Math.round((stats.followedCount / 28) * 100));

  // 2. Nutritional Quality Score (0 - 100): average health score of consumed/planned foods
  const effectiveFoodCount = Math.max(1, foodCount);
  const nutritionalQualityScore = Math.min(
    100,
    Math.max(40, Math.round(healthScoreSum / effectiveFoodCount))
  );

  // 3. Meal Slot Consistency (0 - 100): balance across Breakfast, Lunch, Snack, Dinner
  const slotValues = Object.values(slotFollowedCounts);
  const maxSlot = Math.max(...slotValues, 1);
  const minSlot = Math.min(...slotValues);
  const slotVariance = (maxSlot - minSlot) / 7;
  const mealConsistencyScore = Math.min(
    100,
    Math.max(20, Math.round(100 - slotVariance * 40))
  );

  // 4. Goal Alignment Score: daily macro balance
  const estimatedCaloriesPerDay = Math.round(totalFollowedCalories / 7);
  const estimatedProteinPerDay = Math.round(totalFollowedProtein / 7);
  const goalAlignmentScore = Math.min(
    100,
    Math.max(50, Math.round(70 + (stats.followedCount / 28) * 30))
  );

  // Composite Health Rate calculation:
  // 45% adherence + 30% nutritional food quality + 15% goal alignment + 10% meal consistency
  let healthRate = Math.round(
    adherenceScore * 0.45 +
      nutritionalQualityScore * 0.30 +
      goalAlignmentScore * 0.15 +
      mealConsistencyScore * 0.10
  );

  healthRate = Math.min(100, Math.max(10, healthRate));

  return {
    healthRate,
    healthMetrics: {
      adherenceScore,
      nutritionalQualityScore,
      goalAlignmentScore,
      mealConsistencyScore,
      estimatedCaloriesPerDay,
      estimatedProteinPerDay,
    },
  };
}

// Archive completed week and reset schedule in database
export async function archiveAndResetWeeklySchedule(
  userId: number | string,
  newSchedule: WeeklySchedule
): Promise<{
  archivedRecord: WeeklyArchiveRecord;
  newSchedule: WeeklySchedule;
  newAdherence: WeeklyAdherence;
}> {
  const current = await getWeeklySchedule(userId);
  const currentSchedule = current.schedule || newSchedule;
  const currentAdherence = current.adherence || {
    Monday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Tuesday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Wednesday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Thursday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Friday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Saturday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Sunday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
  } as WeeklyAdherence;

  // Compute final stats of the finishing week
  let followedCount = 0;
  let notFollowedCount = 0;
  let pendingCount = 0;

  const DAYS: DayOfWeek[] = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  for (const day of DAYS) {
    const dayAdh = currentAdherence[day] || {
      Morning: 'pending',
      Lunch: 'pending',
      Snack: 'pending',
      Dinner: 'pending',
    };
    for (const slot of ['Morning', 'Lunch', 'Snack', 'Dinner'] as const) {
      const s = dayAdh[slot];
      if (s === 'followed') followedCount++;
      else if (s === 'not_followed') notFollowedCount++;
      else pendingCount++;
    }
  }

  const completed = followedCount + notFollowedCount;
  const adherenceRate = completed > 0 ? Math.round((followedCount / completed) * 100) : 0;
  const stats = {
    followedCount,
    notFollowedCount,
    pendingCount,
    totalMeals: 28,
    adherenceRate,
  };

  const { healthRate, healthMetrics } = computeWeekHealthMetrics(
    currentSchedule,
    currentAdherence,
    stats
  );

  // Existing history count determines week number
  const existingHistory = await getUserWeeklyHistory(userId);
  const weekNumber = existingHistory.length + 1;

  const now = new Date();
  const weekStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weekEndDate = now.toISOString().split('T')[0];

  const archivedRecord: WeeklyArchiveRecord = {
    id: `arch_${Date.now()}_${weekNumber}`,
    userId,
    weekNumber,
    startDate: weekStartDate,
    endDate: weekEndDate,
    schedule: currentSchedule,
    adherence: currentAdherence,
    stats,
    healthRate,
    healthMetrics,
    completedAt: now.toISOString(),
  };

  // 1. Save archive to PostgreSQL or fallback
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `INSERT INTO weekly_schedule_history (
          user_id, week_number, start_date, end_date, schedule_data, adherence_data, stats, health_rate, health_metrics, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          userId,
          weekNumber,
          weekStartDate,
          weekEndDate,
          JSON.stringify(currentSchedule),
          JSON.stringify(currentAdherence),
          JSON.stringify(stats),
          healthRate,
          JSON.stringify(healthMetrics),
          archivedRecord.completedAt,
        ]
      );
      if (res.rows?.[0]?.id) {
        archivedRecord.id = res.rows[0].id;
      }
    } catch (err) {
      console.warn('[DB] PostgreSQL error archiving weekly schedule:', err);
    }
  }

  // Also maintain in fallback memory/file cache
  if (!fallbackData.history) fallbackData.history = {};
  if (!fallbackData.history[String(userId)]) {
    fallbackData.history[String(userId)] = [];
  }
  fallbackData.history[String(userId)].unshift(archivedRecord);

  // 2. RESET the active weekly schedule & database state for the next week
  const resetAdherence: WeeklyAdherence = {
    Monday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Tuesday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Wednesday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Thursday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Friday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Saturday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
    Sunday: { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' },
  };

  await saveWeeklySchedule(userId, newSchedule, resetAdherence);
  saveFallbackData();

  return {
    archivedRecord,
    newSchedule,
    newAdherence: resetAdherence,
  };
}

// Get user's archived weekly history
export async function getUserWeeklyHistory(
  userId: number | string
): Promise<WeeklyArchiveRecord[]> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT id, user_id, week_number, start_date, end_date, schedule_data, adherence_data, stats, health_rate, health_metrics, completed_at 
         FROM weekly_schedule_history 
         WHERE user_id = $1 
         ORDER BY completed_at DESC`,
        [userId]
      );

      return res.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        weekNumber: Number(row.week_number) || 1,
        startDate: row.start_date,
        endDate: row.end_date,
        schedule: typeof row.schedule_data === 'string' ? JSON.parse(row.schedule_data) : row.schedule_data,
        adherence: typeof row.adherence_data === 'string' ? JSON.parse(row.adherence_data) : row.adherence_data,
        stats: typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats,
        healthRate: Number(row.health_rate) || 0,
        healthMetrics: typeof row.health_metrics === 'string' ? JSON.parse(row.health_metrics) : row.health_metrics,
        completedAt: row.completed_at,
      }));
    } catch (err) {
      console.warn('[DB] PostgreSQL error fetching weekly history:', err);
    }
  }

  const list = fallbackData.history?.[String(userId)] || [];
  return [...list].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

// Get comprehensive user health rate analytics
export async function getUserHealthAnalytics(
  userId: number | string
): Promise<HealthAnalyticsResponse> {
  const history = await getUserWeeklyHistory(userId);
  const current = await getWeeklySchedule(userId);

  // Active week stats
  let activeStats = undefined;
  if (current.adherence) {
    let followedCount = 0;
    let notFollowedCount = 0;
    let pendingCount = 0;

    const DAYS: DayOfWeek[] = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    for (const day of DAYS) {
      const dayAdh = current.adherence[day] || {
        Morning: 'pending',
        Lunch: 'pending',
        Snack: 'pending',
        Dinner: 'pending',
      };
      for (const slot of ['Morning', 'Lunch', 'Snack', 'Dinner'] as const) {
        const s = dayAdh[slot];
        if (s === 'followed') followedCount++;
        else if (s === 'not_followed') notFollowedCount++;
        else pendingCount++;
      }
    }

    const completed = followedCount + notFollowedCount;
    const adherenceRate = completed > 0 ? Math.round((followedCount / completed) * 100) : 0;
    const projectedHealth = current.schedule
      ? computeWeekHealthMetrics(current.schedule, current.adherence, {
          followedCount,
          notFollowedCount,
          pendingCount,
          totalMeals: 28,
          adherenceRate,
        }).healthRate
      : 80;

    activeStats = {
      followedCount,
      notFollowedCount,
      pendingCount,
      totalMeals: 28,
      adherenceRate,
      projectedHealthRate: projectedHealth,
    };
  }

  // Calculate overall metrics
  const totalWeeksCompleted = history.length;
  let averageAdherenceRate = 0;
  let overallHealthRate = 0;
  let macroBalanceScore = 85;

  if (totalWeeksCompleted > 0) {
    const totalAdh = history.reduce((sum, h) => sum + (h.stats?.adherenceRate || 0), 0);
    averageAdherenceRate = Math.round(totalAdh / totalWeeksCompleted);

    const totalHealth = history.reduce((sum, h) => sum + (h.healthRate || 0), 0);
    overallHealthRate = Math.round(totalHealth / totalWeeksCompleted);

    const totalMacro = history.reduce((sum, h) => sum + (h.healthMetrics?.goalAlignmentScore || 85), 0);
    macroBalanceScore = Math.round(totalMacro / totalWeeksCompleted);
  } else if (activeStats) {
    averageAdherenceRate = activeStats.adherenceRate;
    overallHealthRate = activeStats.projectedHealthRate;
    macroBalanceScore = 85;
  } else {
    averageAdherenceRate = 0;
    overallHealthRate = 85;
    macroBalanceScore = 85;
  }

  // Streak: count consecutive archived weeks with adherenceRate >= 60%
  let currentStreak = 0;
  for (const record of history) {
    if (record.stats?.adherenceRate >= 60) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    success: true,
    overallHealthRate,
    totalWeeksCompleted,
    currentStreak,
    averageAdherenceRate,
    macroBalanceScore,
    history,
    activeWeekStats: activeStats,
  };
}


