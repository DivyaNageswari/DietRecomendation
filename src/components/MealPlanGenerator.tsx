import React, { useState, useMemo, useEffect } from 'react';
import { FoodItem, GoalType, Allergen, GoalWeights } from '../types/diet';
import { ALLERGENS, ALLERGEN_LABELS, filterByAllergens, scoreFoodsMultiCriteria } from '../utils/scoring';
import { MealSlotCard } from './MealSlotCard';
import { NutritionSummary } from './NutritionSummary';
import { Sliders, Shield, ShieldAlert, Sparkles, Printer, RotateCcw, Info, Check, Filter, Save, UserCheck, Database, CheckCircle2, RefreshCw, User } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface MealPlanGeneratorProps {
  foodDatabase: FoodItem[];
  onViewDetails: (food: FoodItem) => void;
  onOpenAuthModal?: () => void;
}

export const MealPlanGenerator: React.FC<MealPlanGeneratorProps> = ({
  foodDatabase,
  onViewDetails,
  onOpenAuthModal,
}) => {
  const { user, preferences, updatePreferences, isAuthenticated, dbStatus } = useAuth();
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefSaveMsg, setPrefSaveMsg] = useState<string | null>(null);
  // Goal weights state
  const [goalWeights, setGoalWeights] = useState<GoalWeights>({
    'Weight Loss': 0.7,
    'Muscle Gain': 0.0,
    'Heart Health': 0.3,
    'Diabetic-Friendly': 0.0,
    'Balanced Diet': 0.0,
  });

  // Allergens to filter out (starts empty so all foods are visible until selected)
  const [userAllergies, setUserAllergies] = useState<Allergen[]>([]);

  // Strict allergen safety toggle: default to false (permissive mode: only excludes confirmed allergens, allowing USDA whole foods)
  const [strictAllergens, setStrictAllergens] = useState<boolean>(false);

  // Items per meal slot (1 to 3)
  const [itemsPerSlot, setItemsPerSlot] = useState<number>(2);

  // Backend recommendations state
  const [backendPlan, setBackendPlan] = useState<{
    Morning?: FoodItem[];
    Lunch?: FoodItem[];
    Snack?: FoodItem[];
    Dinner?: FoodItem[];
  } | null>(null);

  // Manual swapped/customized items per slot
  const [customSlotItems, setCustomSlotItems] = useState<{
    Morning?: FoodItem[];
    Lunch?: FoodItem[];
    Snack?: FoodItem[];
    Dinner?: FoodItem[];
  }>({});

  // Automatically load saved preferences and allergies after login
  useEffect(() => {
    if (preferences) {
      if (preferences.goal_weights) {
        setGoalWeights(preferences.goal_weights);
      }
      if (Array.isArray(preferences.allergies)) {
        setUserAllergies(preferences.allergies);
      }
      if (preferences.strict_allergens !== undefined) {
        setStrictAllergens(preferences.strict_allergens);
      }
      if (preferences.items_per_slot !== undefined) {
        setItemsPerSlot(preferences.items_per_slot);
      }
    }
  }, [preferences]);

  // Save current preferences to PostgreSQL database for the logged-in user
  const handleSavePreferences = async () => {
    if (!isAuthenticated) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    setIsSavingPrefs(true);
    setPrefSaveMsg(null);
    try {
      await updatePreferences({
        goal_weights: goalWeights,
        allergies: userAllergies,
        strict_allergens: strictAllergens,
        items_per_slot: itemsPerSlot,
      });
      setPrefSaveMsg(
        dbStatus?.connected
          ? 'Preferences saved to PostgreSQL database!'
          : 'Preferences saved to your profile!'
      );
      setTimeout(() => setPrefSaveMsg(null), 3500);
    } catch (err: any) {
      setPrefSaveMsg('Error saving preferences: ' + (err.message || 'Failed'));
      setTimeout(() => setPrefSaveMsg(null), 3500);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Quick goal presets
  const presets: { label: string; weights: GoalWeights }[] = [
    {
      label: 'Fat Loss & Cardio',
      weights: { 'Weight Loss': 0.7, 'Muscle Gain': 0.0, 'Heart Health': 0.3, 'Diabetic-Friendly': 0.0, 'Balanced Diet': 0.0 },
    },
    {
      label: 'Lean Muscle Hypertrophy',
      weights: { 'Weight Loss': 0.2, 'Muscle Gain': 0.8, 'Heart Health': 0.0, 'Diabetic-Friendly': 0.0, 'Balanced Diet': 0.0 },
    },
    {
      label: 'Diabetic & Glycemic Control',
      weights: { 'Weight Loss': 0.2, 'Muscle Gain': 0.0, 'Heart Health': 0.2, 'Diabetic-Friendly': 0.6, 'Balanced Diet': 0.0 },
    },
    {
      label: 'Cardiovascular Longevity',
      weights: { 'Weight Loss': 0.1, 'Muscle Gain': 0.0, 'Heart Health': 0.8, 'Diabetic-Friendly': 0.1, 'Balanced Diet': 0.0 },
    },
    {
      label: 'Whole-Body Balanced',
      weights: { 'Weight Loss': 0.0, 'Muscle Gain': 0.0, 'Heart Health': 0.0, 'Diabetic-Friendly': 0.0, 'Balanced Diet': 1.0 },
    },
  ];

  // Allergen filtering and multi-criteria scoring
  const { safeFoods, scoredFoods, morningCandidates, afternoonCandidates, snackCandidates } = useMemo(() => {
    // 1. Filter by allergens (strict vs permissive)
    const safe = filterByAllergens(foodDatabase, userAllergies, strictAllergens);

    // 2. Score multi-criteria based on weights
    const scored = scoreFoodsMultiCriteria(safe, goalWeights);

    // 3. Partition by meal slots
    const morning = scored
      .filter((f) => f.meal_slot === 'Morning')
      .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

    const afternoon = scored
      .filter((f) => f.meal_slot === 'Afternoon')
      .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

    const snack = scored
      .filter((f) => f.meal_slot === 'Snack')
      .sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

    return {
      safeFoods: safe,
      scoredFoods: scored,
      morningCandidates: morning,
      afternoonCandidates: afternoon,
      snackCandidates: snack,
    };
  }, [foodDatabase, userAllergies, strictAllergens, goalWeights]);

  // Fetch real-time recommendation from backend (running on 12,722 dataset items)
  useEffect(() => {
    let active = true;
    api
      .getRecommendation({
        user_goals: goalWeights,
        user_allergies: userAllergies,
        strict_allergens: strictAllergens,
        top_n_per_slot: itemsPerSlot,
      })
      .then((res) => {
        if (active && res && res.plan) {
          setBackendPlan(res.plan);
        }
      })
      .catch((err) => {
        console.warn('Backend recommendation error:', err);
      });
    return () => {
      active = false;
    };
  }, [goalWeights, userAllergies, strictAllergens, itemsPerSlot]);

  // Derived current plan items (using custom overrides, or backend plan, or local candidates)
  const currentMorning =
    customSlotItems.Morning ||
    (backendPlan?.Morning && backendPlan.Morning.length > 0
      ? backendPlan.Morning
      : morningCandidates.slice(0, itemsPerSlot));

  const currentLunch =
    customSlotItems.Lunch ||
    (backendPlan?.Lunch && backendPlan.Lunch.length > 0
      ? backendPlan.Lunch
      : afternoonCandidates.slice(0, itemsPerSlot));

  const currentSnack =
    customSlotItems.Snack ||
    (backendPlan?.Snack && backendPlan.Snack.length > 0
      ? backendPlan.Snack
      : snackCandidates.slice(0, Math.max(1, itemsPerSlot - 1)));

  const currentDinner =
    customSlotItems.Dinner ||
    (backendPlan?.Dinner && backendPlan.Dinner.length > 0
      ? backendPlan.Dinner
      : afternoonCandidates.slice(itemsPerSlot, itemsPerSlot * 2));

  // All selected foods in the current daily plan
  const allPlanFoods = [...currentMorning, ...currentLunch, ...currentSnack, ...currentDinner];

  const handleGoalSliderChange = (goal: GoalType, value: number) => {
    setGoalWeights((prev) => ({
      ...prev,
      [goal]: value,
    }));
    setCustomSlotItems({});
  };

  const toggleAllergen = (allergen: Allergen) => {
    setUserAllergies((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
    setCustomSlotItems({});
  };

  const handleApplyPreset = (presetWeights: GoalWeights) => {
    setGoalWeights(presetWeights);
    setCustomSlotItems({});
  };

  const handleSwapSlotItem = (
    slotName: 'Morning' | 'Lunch' | 'Snack' | 'Dinner',
    oldIdx: number,
    newItem: FoodItem
  ) => {
    setCustomSlotItems((prev) => {
      let currentItems: FoodItem[] = [];
      if (slotName === 'Morning') currentItems = [...currentMorning];
      else if (slotName === 'Lunch') currentItems = [...currentLunch];
      else if (slotName === 'Snack') currentItems = [...currentSnack];
      else if (slotName === 'Dinner') currentItems = [...currentDinner];

      currentItems[oldIdx] = newItem;
      return {
        ...prev,
        [slotName]: currentItems,
      };
    });
  };

  const handleReset = () => {
    setGoalWeights({
      'Weight Loss': 0.7,
      'Muscle Gain': 0.0,
      'Heart Health': 0.3,
      'Diabetic-Friendly': 0.0,
      'Balanced Diet': 0.0,
    });
    setUserAllergies([]);
    setStrictAllergens(true);
    setItemsPerSlot(2);
    setCustomSlotItems({});
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* User Preferences Sync Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isAuthenticated
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-emerald-200'
          : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isAuthenticated
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {isAuthenticated ? <UserCheck className="w-5 h-5" /> : <Database className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-slate-900">
                  {isAuthenticated ? `Personalized Diet Profile: ${user?.name}` : 'Diet Profile & Preferences'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isAuthenticated
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {isAuthenticated ? 'Profile Synced' : 'Guest Mode'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAuthenticated
                  ? 'Your multi-criteria priorities and allergen restrictions are linked to your secure account.'
                  : 'Register or sign in to save your custom goal weights and allergy filters.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {prefSaveMsg && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg animate-in fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {prefSaveMsg}
              </span>
            )}

            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={isSavingPrefs}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSavingPrefs ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Save Preferences to Database</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sign In to Save</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Goal Multi-Criteria Weights (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                Multi-Criteria Goal Priorities
              </h2>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-2 mb-3">
            Set multiple simultaneous targets. The mathematical model scores each food based on weighted normalization.
          </p>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleApplyPreset(preset.weights)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 transition-colors border border-transparent hover:border-emerald-200"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Sliders for each goal */}
          <div className="space-y-3">
            {(Object.keys(goalWeights) as GoalType[]).map((goal) => {
              const weightVal = goalWeights[goal];
              const percent = Math.round(weightVal * 100);

              return (
                <div key={goal} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${percent > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {goal}
                    </span>
                    <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                      {percent}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weightVal}
                    onChange={(e) => handleGoalSliderChange(goal, parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Allergen Safety Controls (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  Allergen Safety Protocol
                </h2>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                {safeFoods.length} / {foodDatabase.length} Safe
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-3">
              Select any allergens to strictly exclude from your meal suggestions.
            </p>

            {/* Allergen Chips */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ALLERGENS.map((allergen) => {
                const isSelected = userAllergies.includes(allergen);
                return (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => toggleAllergen(allergen)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="capitalize">{allergen}</span>
                    {isSelected ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 inline-block" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Strict Allergen Mode Toggle */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Strict Verification Mode</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-800 font-extrabold uppercase">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    {strictAllergens
                      ? 'Excludes both confirmed allergen foods AND unverified/shared facility ingredients.'
                      : 'Permissive mode: Only excludes confirmed allergens (lets unverified through).'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="strict-toggle"
                  checked={strictAllergens}
                  onChange={(e) => {
                    setStrictAllergens(e.target.checked);
                    setCustomSlotItems({});
                  }}
                  className="h-4 w-4 rounded accent-emerald-600 cursor-pointer mt-0.5"
                />
              </div>
            </div>
          </div>

          {/* Items per slot selector */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Foods per Meal Slot:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    setItemsPerSlot(num);
                    setCustomSlotItems({});
                  }}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                    itemsPerSlot === num
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Nutrition Synthesis Card */}
      <NutritionSummary selectedFoods={allPlanFoods} />

      {/* Daily Meal Schedule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Your Daily 4-Meal Plan</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Optimal Match
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Curated using slot heuristics, multi-criteria goal weights, and allergen safety clearance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print / Save Plan</span>
          </button>
        </div>
      </div>

      {/* Empty State Warning with 1-click toggle */}
      {allPlanFoods.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <p className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>No foods found with strict allergen verification</span>
            </p>
            <p className="text-amber-800 mt-1 leading-relaxed">
              Strict mode excludes all unverified foods. Whole foods in the USDA database have no packaged ingredient labels and are marked unverified (-1). Switch to Permissive mode to allow whole foods while strictly excluding confirmed allergens.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStrictAllergens(false);
              setCustomSlotItems({});
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Switch to Permissive Mode
          </button>
        </div>
      )}

      {/* 4 Meal Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Breakfast / Morning */}
        <MealSlotCard
          slotName="Morning"
          title="Breakfast (Morning Slot)"
          description="High-energy, complex carbs & protein to fuel your morning metabolism"
          items={currentMorning}
          allCandidates={morningCandidates}
          onSwapItem={handleSwapSlotItem}
          onViewDetails={onViewDetails}
        />

        {/* Lunch / Afternoon */}
        <MealSlotCard
          slotName="Lunch"
          title="Lunch (Afternoon Slot)"
          description="Balanced macronutrients, lean proteins, and fiber to sustain afternoon focus"
          items={currentLunch}
          allCandidates={afternoonCandidates}
          onSwapItem={handleSwapSlotItem}
          onViewDetails={onViewDetails}
        />

        {/* Snack */}
        <MealSlotCard
          slotName="Snack"
          title="Afternoon Snack"
          description="Controlled portions, nutrient-dense bites to curb glycemic dips"
          items={currentSnack}
          allCandidates={snackCandidates}
          onSwapItem={handleSwapSlotItem}
          onViewDetails={onViewDetails}
        />

        {/* Dinner */}
        <MealSlotCard
          slotName="Dinner"
          title="Dinner (Evening Slot)"
          description="Lean protein & anti-inflammatory vegetables for overnight recovery"
          items={currentDinner}
          allCandidates={afternoonCandidates}
          onSwapItem={handleSwapSlotItem}
          onViewDetails={onViewDetails}
        />
      </div>
    </div>
  );
};
