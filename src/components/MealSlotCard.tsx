import React from 'react';
import { FoodItem } from '../types/diet';
import { Sun, Utensils, Coffee, Moon, RefreshCw, CheckCircle2, AlertTriangle, Eye, ShieldCheck } from 'lucide-react';

interface MealSlotCardProps {
  slotName: 'Morning' | 'Lunch' | 'Snack' | 'Dinner';
  title: string;
  description: string;
  items: FoodItem[];
  allCandidates: FoodItem[];
  onSwapItem: (slotName: 'Morning' | 'Lunch' | 'Snack' | 'Dinner', oldItemIndex: number, newItem: FoodItem) => void;
  onViewDetails: (food: FoodItem) => void;
}

export const MealSlotCard: React.FC<MealSlotCardProps> = ({
  slotName,
  title,
  description,
  items,
  allCandidates,
  onSwapItem,
  onViewDetails,
}) => {
  const getSlotIcon = () => {
    switch (slotName) {
      case 'Morning':
        return <Sun className="w-5 h-5 text-amber-500" />;
      case 'Lunch':
        return <Utensils className="w-5 h-5 text-emerald-500" />;
      case 'Snack':
        return <Coffee className="w-5 h-5 text-indigo-500" />;
      case 'Dinner':
        return <Moon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSlotHeaderBg = () => {
    switch (slotName) {
      case 'Morning':
        return 'bg-amber-50/60 border-amber-100 text-amber-900';
      case 'Lunch':
        return 'bg-emerald-50/60 border-emerald-100 text-emerald-900';
      case 'Snack':
        return 'bg-indigo-50/60 border-indigo-100 text-indigo-900';
      case 'Dinner':
        return 'bg-blue-50/60 border-blue-100 text-blue-900';
    }
  };

  // Subtotal for this slot
  const slotCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
  const slotProtein = items.reduce((sum, item) => sum + (item.protein_g || 0), 0);
  const slotCarbs = items.reduce((sum, item) => sum + (item.carbs_g || 0), 0);
  const slotFat = items.reduce((sum, item) => sum + (item.fat_g || 0), 0);

  // Quick swap handler: find next highest scoring food from candidates not in current items
  const handleShuffleItem = (index: number) => {
    const currentItemIds = new Set(items.map((i) => i.id));
    const available = allCandidates.filter((cand) => !currentItemIds.has(cand.id));
    if (available.length > 0) {
      // Pick a high scoring alternative or rotate
      const randomIdx = Math.floor(Math.random() * Math.min(5, available.length));
      onSwapItem(slotName, index, available[randomIdx]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow">
      {/* Slot Header */}
      <div className={`p-4 border-b flex items-center justify-between ${getSlotHeaderBg()}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white shadow-xs">
            {getSlotIcon()}
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight text-slate-900">{title}</h3>
            <p className="text-xs text-slate-600 mt-0.5">{description}</p>
          </div>
        </div>

        {/* Slot Nutritional Subtotals */}
        <div className="text-right">
          <span className="text-xs font-black text-slate-900">{Math.round(slotCalories)} kcal</span>
          <div className="text-[11px] text-slate-500 font-medium">
            {Math.round(slotProtein)}g P • {Math.round(slotCarbs)}g C • {Math.round(slotFat)}g F
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="p-4 divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs italic">
            No foods match your strict criteria for this meal slot. Try adjusting allergen toggles or goal weights.
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {item.food_name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-600">
                    {item.category}
                  </span>
                  {item.best_fit_goal && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ★ {item.best_fit_goal}
                    </span>
                  )}
                </div>

                {/* Macro metrics chips */}
                <div className="flex items-center gap-2.5 text-xs text-slate-600 flex-wrap">
                  <span className="font-semibold text-slate-800">{item.calories} kcal</span>
                  <span>•</span>
                  <span>{item.protein_g}g Protein</span>
                  <span>•</span>
                  <span>{item.carbs_g}g Carbs</span>
                  <span>•</span>
                  <span>{item.fat_g}g Fat</span>
                  <span>•</span>
                  <span>{item.fiber_g}g Fiber</span>
                </div>

                {/* Allergen check indication */}
                <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                  {item.allergen_verified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified Allergen-Safe
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Unverified / Shared Facility
                    </span>
                  )}

                  {/* Recommendation match percentage */}
                  {item.recommendation_score !== undefined && (
                    <span className="ml-auto sm:ml-2 font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md text-[10px]">
                      Match: {item.recommendation_score}%
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                <button
                  onClick={() => onViewDetails(item)}
                  title="View full nutritional breakdown"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleShuffleItem(idx)}
                  title="Swap with another top candidate"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                  <span>Swap</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
