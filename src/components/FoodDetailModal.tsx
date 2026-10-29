import React, { useMemo } from 'react';
import { FoodItem, Allergen, GoalType } from '../types/diet';
import { ALLERGENS, ALLERGEN_LABELS, predictMlpGoal } from '../utils/scoring';
import { X, ShieldCheck, AlertTriangle, ShieldX, Sparkles, Award, Cpu, Check, Activity } from 'lucide-react';

interface FoodDetailModalProps {
  food: FoodItem | null;
  onClose: () => void;
}

export const FoodDetailModal: React.FC<FoodDetailModalProps> = ({ food, onClose }) => {
  if (!food) return null;

  // Run MLP classifier on this food
  const mlpResult = useMemo(() => {
    return predictMlpGoal(food);
  }, [food]);

  const getAllergenStatus = (allergen: Allergen) => {
    const key = `contains_${allergen}` as keyof FoodItem;
    const val = food[key] as number;
    if (val === 1) {
      return {
        label: 'Contains Allergen',
        color: 'bg-rose-100 text-rose-800 border-rose-200',
        icon: <ShieldX className="w-3.5 h-3.5 text-rose-600" />,
      };
    } else if (val === 0) {
      return {
        label: 'Safe (Confirmed Absent)',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />,
      };
    } else {
      return {
        label: 'Unverified / Unknown',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                {food.category}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700">
                Slot: {food.meal_slot}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-50 text-slate-500 border border-slate-200">
                Source: {food.source.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {food.food_name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Nutrition Facts Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              Nutritional Profile (per serving)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Calories</div>
                <div className="text-lg font-black text-slate-900">{food.calories} <span className="text-xs font-normal">kcal</span></div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Protein</div>
                <div className="text-lg font-black text-emerald-700">{food.protein_g}g</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Carbs</div>
                <div className="text-lg font-black text-blue-700">{food.carbs_g}g</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Fat</div>
                <div className="text-lg font-black text-rose-700">{food.fat_g}g</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Dietary Fiber</div>
                <div className="text-base font-bold text-slate-800">{food.fiber_g}g</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sugar</div>
                <div className="text-base font-bold text-slate-800">{food.sugar_g}g</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] uppercase font-bold text-slate-400">Sodium</div>
                <div className="text-base font-bold text-slate-800">{food.sodium_mg}mg</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <div className="text-[10px] uppercase font-bold text-amber-700">Health Score</div>
                <div className="text-base font-black text-amber-900">{food.health_score} / 100</div>
              </div>
            </div>
          </div>

          {/* MLP Classification & Probabilities */}
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-700" />
                <h3 className="font-bold text-sm text-purple-950">
                  MLP Neural Network Classifier Prediction
                </h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-extrabold bg-purple-200/80 text-purple-900">
                Best Fit: {mlpResult.predictedGoal}
              </span>
            </div>

            <p className="text-xs text-purple-800/80 mb-3">
              Evaluated by the (64, 32) MLP architecture trained on standardized USDA nutrients.
            </p>

            <div className="space-y-2">
              {(Object.keys(mlpResult.probabilities) as GoalType[]).map((goal) => {
                const prob = mlpResult.probabilities[goal];
                const isWinner = goal === mlpResult.predictedGoal;

                return (
                  <div key={goal} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className={isWinner ? 'text-purple-950 font-bold' : 'text-slate-600'}>
                        {goal} {isWinner && '★'}
                      </span>
                      <span className="font-mono text-purple-900 font-bold">{prob}%</span>
                    </div>
                    <div className="w-full bg-purple-200/60 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isWinner ? 'bg-purple-600' : 'bg-purple-400/60'
                        }`}
                        style={{ width: `${prob}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Goal Suitability Scores (ws_ metrics from Project.py) */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Raw Mathematical Goal Scores (from Project.py)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Weight Loss Score:</span>
                <span className="font-mono font-bold text-slate-900">{food.ws_weight_loss ?? 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Muscle Gain Score:</span>
                <span className="font-mono font-bold text-slate-900">{food.ws_muscle_gain ?? 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Heart Health Score:</span>
                <span className="font-mono font-bold text-slate-900">{food.ws_heart_health ?? 'N/A'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                <span className="text-slate-600">Diabetic-Friendly Score:</span>
                <span className="font-mono font-bold text-slate-900">{food.ws_diabetic ?? 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Allergen Matrix */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Allergen Safety Clearance Matrix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALLERGENS.map((allergen) => {
                const status = getAllergenStatus(allergen);
                return (
                  <div
                    key={allergen}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${status.color}`}
                  >
                    <span className="font-bold capitalize">{ALLERGEN_LABELS[allergen]}</span>
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      {status.icon}
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
