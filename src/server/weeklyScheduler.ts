import {
  DayOfWeek,
  FoodItem,
  GoalWeights,
  Allergen,
  WeeklySchedule,
  WeeklyAdherence,
} from '../types/diet';
import { filterByAllergens, scoreFoodsMultiCriteria } from '../utils/scoring';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function generateInitialAdherence(): WeeklyAdherence {
  const adherence: any = {};
  for (const day of DAYS_OF_WEEK) {
    adherence[day] = {
      Morning: 'pending',
      Lunch: 'pending',
      Snack: 'pending',
      Dinner: 'pending',
    };
  }
  return adherence;
}

export function generate7DaySchedule(
  foodDatabase: FoodItem[],
  goalWeights: GoalWeights,
  userAllergies: Allergen[],
  strictAllergens: boolean,
  itemsPerSlot: number = 2
): WeeklySchedule {
  // 1. Rule-based allergen filtering
  const safeFoods = filterByAllergens(foodDatabase, userAllergies, strictAllergens);
  // 2. Multi-criteria normalization and scoring
  const scoredFoods = scoreFoodsMultiCriteria(safeFoods, goalWeights);

  const morningCandidates = scoredFoods
    .filter((f) => f.meal_slot === 'Morning')
    .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

  const afternoonCandidates = scoredFoods
    .filter((f) => f.meal_slot === 'Afternoon')
    .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

  const snackCandidates = scoredFoods
    .filter((f) => f.meal_slot === 'Snack')
    .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

  const n = Math.max(1, itemsPerSlot || 2);
  const schedule: any = {};

  DAYS_OF_WEEK.forEach((day, dayIndex) => {
    const mLen = morningCandidates.length;
    const aLen = afternoonCandidates.length;
    const sLen = snackCandidates.length;

    // Distribute candidate variety smoothly across the 7 days
    const mOffset = mLen > n ? (dayIndex * n) % Math.max(1, mLen - n + 1) : 0;
    const lOffset = aLen > n ? (dayIndex * n) % Math.max(1, aLen - n * 2) : 0;
    const sOffset = sLen > 1 ? dayIndex % Math.max(1, sLen) : 0;
    const dOffset = aLen > n * 2 ? (lOffset + n) % Math.max(1, aLen - n + 1) : lOffset;

    const morning = (mLen > 0 ? morningCandidates.slice(mOffset, mOffset + n) : []).length > 0
      ? morningCandidates.slice(mOffset, mOffset + n)
      : morningCandidates.slice(0, n);

    const lunch = (aLen > 0 ? afternoonCandidates.slice(lOffset, lOffset + n) : []).length > 0
      ? afternoonCandidates.slice(lOffset, lOffset + n)
      : afternoonCandidates.slice(0, n);

    const snack = (sLen > 0 ? snackCandidates.slice(sOffset, sOffset + Math.max(1, n - 1)) : []).length > 0
      ? snackCandidates.slice(sOffset, sOffset + Math.max(1, n - 1))
      : snackCandidates.slice(0, Math.max(1, n - 1));

    const dinner = (aLen > n ? afternoonCandidates.slice(dOffset, dOffset + n) : []).length > 0
      ? afternoonCandidates.slice(dOffset, dOffset + n)
      : afternoonCandidates.slice(n, n * 2);

    const dayFoods = [...morning, ...lunch, ...snack, ...dinner];
    const totalCalories = dayFoods.reduce((acc, f) => acc + (f.calories || 0), 0);

    schedule[day] = {
      day,
      meals: {
        Morning: morning,
        Lunch: lunch,
        Snack: snack,
        Dinner: dinner,
      },
      totalCalories,
    };
  });

  return schedule;
}

export function computeAdherenceStats(adherence: WeeklyAdherence) {
  let followedCount = 0;
  let notFollowedCount = 0;
  let pendingCount = 0;

  for (const day of DAYS_OF_WEEK) {
    const dayAdh = adherence[day] || { Morning: 'pending', Lunch: 'pending', Snack: 'pending', Dinner: 'pending' };
    const slots: (keyof typeof dayAdh)[] = ['Morning', 'Lunch', 'Snack', 'Dinner'];
    for (const slot of slots) {
      const status = dayAdh[slot];
      if (status === 'followed') followedCount++;
      else if (status === 'not_followed') notFollowedCount++;
      else pendingCount++;
    }
  }

  const completed = followedCount + notFollowedCount;
  const adherenceRate = completed > 0 ? Math.round((followedCount / completed) * 100) : 0;

  return {
    followedCount,
    notFollowedCount,
    pendingCount,
    totalMeals: 28,
    adherenceRate,
  };
}
