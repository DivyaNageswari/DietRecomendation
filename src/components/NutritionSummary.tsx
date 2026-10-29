import React from 'react';
import { Flame, Dumbbell, Wheat, Droplets, Heart, ShieldAlert, Award } from 'lucide-react';
import { FoodItem } from '../types/diet';

interface NutritionSummaryProps {
  selectedFoods: FoodItem[];
}

export const NutritionSummary: React.FC<NutritionSummaryProps> = ({ selectedFoods }) => {
  const totals = selectedFoods.reduce(
    (acc, food) => {
      acc.calories += food.calories || 0;
      acc.protein += food.protein_g || 0;
      acc.carbs += food.carbs_g || 0;
      acc.fat += food.fat_g || 0;
      acc.fiber += food.fiber_g || 0;
      acc.sugar += food.sugar_g || 0;
      acc.sodium += food.sodium_mg || 0;
      acc.healthScore += food.health_score || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, healthScore: 0 }
  );

  const avgHealthScore = selectedFoods.length > 0 
    ? Math.round(totals.healthScore / selectedFoods.length) 
    : 0;

  // Recommended Daily Reference Values (Standard Adult Reference)
  const targets = {
    calories: 2000,
    protein: 75,
    carbs: 225,
    fat: 65,
    fiber: 30,
    sugarLimit: 36,
    sodiumLimit: 2300,
  };

  const getPercentage = (val: number, target: number) => {
    return Math.min(Math.round((val / target) * 100), 100);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span>Daily Nutrition Target Synthesis</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
              {selectedFoods.length} Items Selected
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated macro & micronutrient tally computed from the current plan
          </p>
        </div>

        {/* Health Score Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
          <Award className="w-5 h-5 text-amber-500" />
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Avg Health Index</div>
            <div className="text-sm font-extrabold text-slate-800">{avgHealthScore} / 100</div>
          </div>
        </div>
      </div>

      {/* Primary Macro Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {/* Calories */}
        <div className="bg-amber-50/60 border border-amber-100/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-semibold">Calories</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-950">
            {Math.round(totals.calories)} <span className="text-xs font-normal text-amber-700">kcal</span>
          </div>
          <div className="w-full bg-amber-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(totals.calories, targets.calories)}%` }}
            />
          </div>
          <div className="text-[10px] text-amber-700/80 mt-1 font-medium">
            {getPercentage(totals.calories, targets.calories)}% of ~{targets.calories} kcal
          </div>
        </div>

        {/* Protein */}
        <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-semibold">Protein</span>
            <Dumbbell className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-950">
            {Math.round(totals.protein)} <span className="text-xs font-normal text-emerald-700">g</span>
          </div>
          <div className="w-full bg-emerald-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(totals.protein, targets.protein)}%` }}
            />
          </div>
          <div className="text-[10px] text-emerald-700/80 mt-1 font-medium">
            {getPercentage(totals.protein, targets.protein)}% of {targets.protein}g RDA
          </div>
        </div>

        {/* Carbs */}
        <div className="bg-blue-50/60 border border-blue-100/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span className="text-xs font-semibold">Carbs</span>
            <Wheat className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-950">
            {Math.round(totals.carbs)} <span className="text-xs font-normal text-blue-700">g</span>
          </div>
          <div className="w-full bg-blue-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(totals.carbs, targets.carbs)}%` }}
            />
          </div>
          <div className="text-[10px] text-blue-700/80 mt-1 font-medium">
            {getPercentage(totals.carbs, targets.carbs)}% of {targets.carbs}g RDA
          </div>
        </div>

        {/* Fat */}
        <div className="bg-rose-50/60 border border-rose-100/80 rounded-xl p-3">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-semibold">Fat</span>
            <Droplets className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-950">
            {Math.round(totals.fat)} <span className="text-xs font-normal text-rose-700">g</span>
          </div>
          <div className="w-full bg-rose-200/50 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-rose-500 h-1.5 rounded-full transition-all"
              style={{ width: `${getPercentage(totals.fat, targets.fat)}%` }}
            />
          </div>
          <div className="text-[10px] text-rose-700/80 mt-1 font-medium">
            {getPercentage(totals.fat, targets.fat)}% of {targets.fat}g RDA
          </div>
        </div>
      </div>

      {/* Secondary Micronutrients strip */}
      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
          <Heart className="w-4 h-4 text-teal-600 shrink-0" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold">Dietary Fiber</div>
            <div className="font-bold text-slate-800">
              {Math.round(totals.fiber * 10) / 10}g{' '}
              <span className="text-[10px] font-normal text-slate-500">(Target: &gt;28g)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
          <Wheat className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold">Total Sugars</div>
            <div className="font-bold text-slate-800">
              {Math.round(totals.sugar * 10) / 10}g{' '}
              <span className={`text-[10px] font-medium ${totals.sugar > targets.sugarLimit ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                (Cap: &lt;{targets.sugarLimit}g)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
          <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <div className="text-slate-400 text-[10px] uppercase font-bold">Sodium</div>
            <div className="font-bold text-slate-800">
              {Math.round(totals.sodium)}mg{' '}
              <span className={`text-[10px] font-medium ${totals.sodium > targets.sodiumLimit ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                (Cap: &lt;{targets.sodiumLimit}mg)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
