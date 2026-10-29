import React, { useState, useMemo } from 'react';
import { FoodItem, Allergen } from '../types/diet';
import { ALLERGENS } from '../utils/scoring';
import { Search, Database, Filter, ShieldCheck, AlertTriangle, ArrowUpDown, Eye, Check, FileSpreadsheet } from 'lucide-react';

interface FoodExplorerProps {
  foods: FoodItem[];
  onViewDetails: (food: FoodItem) => void;
  onOpenAddModal?: () => void;
  onOpenCsvModal?: () => void;
}

export const FoodExplorer: React.FC<FoodExplorerProps> = ({
  foods,
  onViewDetails,
  onOpenAddModal,
  onOpenCsvModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSlot, setSelectedSlot] = useState<string>('All');
  const [allergenFreeFilter, setAllergenFreeFilter] = useState<Allergen[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'calories' | 'protein' | 'fiber' | 'health_score'>('health_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Reset page when filters change
  const handleFilterChange = (setter: (val: any) => void, val: any) => {
    setter(val);
    setCurrentPage(1);
  };

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(foods.map((f) => f.category))).filter(Boolean);
    return ['All', ...cats.sort()];
  }, [foods]);

  // Filtered and sorted list
  const filteredFoods = useMemo(() => {
    return foods
      .filter((food) => {
        // Search filter
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchName = food.food_name.toLowerCase().includes(term);
          const matchCat = food.category.toLowerCase().includes(term);
          if (!matchName && !matchCat) return false;
        }

        // Category filter
        if (selectedCategory !== 'All' && food.category !== selectedCategory) {
          return false;
        }

        // Slot filter
        if (selectedSlot !== 'All' && food.meal_slot !== selectedSlot) {
          return false;
        }

        // Allergen exclusion filter: exclude confirmed allergens (1)
        for (const allergen of allergenFreeFilter) {
          const key = `contains_${allergen}` as keyof FoodItem;
          if (food[key] === 1) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortBy) {
          case 'name':
            return sortOrder === 'asc'
              ? a.food_name.localeCompare(b.food_name)
              : b.food_name.localeCompare(a.food_name);
          case 'calories':
            valA = a.calories;
            valB = b.calories;
            break;
          case 'protein':
            valA = a.protein_g;
            valB = b.protein_g;
            break;
          case 'fiber':
            valA = a.fiber_g;
            valB = b.fiber_g;
            break;
          case 'health_score':
            valA = a.health_score;
            valB = b.health_score;
            break;
        }

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [foods, searchTerm, selectedCategory, selectedSlot, allergenFreeFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredFoods.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedFoods = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredFoods.slice(start, start + pageSize);
  }, [filteredFoods, safeCurrentPage, pageSize]);

  const toggleAllergenFree = (allergen: Allergen) => {
    setAllergenFreeFilter((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Food Database Explorer
            </h2>
            <p className="text-xs text-slate-500">
              Explore nutritional specifications, nutrient metrics, and allergen profiles.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {onOpenCsvModal && (
              <button
                onClick={onOpenCsvModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
              >
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Dataset Files (/Dataset)</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mt-4">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by food name or ingredient..."
              value={searchTerm}
              onChange={(e) => handleFilterChange(setSearchTerm, e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => handleFilterChange(setSelectedCategory, e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Meal Slot Dropdown */}
          <div className="sm:col-span-2">
            <select
              value={selectedSlot}
              onChange={(e) => handleFilterChange(setSelectedSlot, e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
            >
              <option value="All">All Slots</option>
              <option value="Morning">Morning (Breakfast)</option>
              <option value="Afternoon">Afternoon (Lunch/Dinner)</option>
              <option value="Snack">Snack</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="sm:col-span-2 flex gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-2 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium text-slate-700"
            >
              <option value="health_score">Health Score</option>
              <option value="calories">Calories</option>
              <option value="protein">Protein</option>
              <option value="fiber">Fiber</option>
              <option value="name">Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
              title={`Sorting ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Must-Be-Free-Of Allergen Quick Filters */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Require Safe From:
          </span>
          {ALLERGENS.map((allergen) => {
            const active = allergenFreeFilter.includes(allergen);
            return (
              <button
                key={allergen}
                onClick={() => toggleAllergenFree(allergen)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors border ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                No {allergen}
              </button>
            );
          })}
          {allergenFreeFilter.length > 0 && (
            <button
              onClick={() => setAllergenFreeFilter([])}
              className="text-[11px] text-slate-400 hover:text-slate-600 underline font-medium ml-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results Count & Food Cards Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">
            Showing {filteredFoods.length > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0} - {Math.min(safeCurrentPage * pageSize, filteredFoods.length)} of {filteredFoods.length} items (Catalog total: {foods.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Page {safeCurrentPage} of {totalPages}
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          {filteredFoods.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No foods match your search or filter criteria.
            </div>
          ) : (
            paginatedFoods.map((food) => (
              <div
                key={food.id}
                onClick={() => onViewDetails(food)}
                className="p-4 hover:bg-slate-50/80 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {food.food_name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-600">
                      {food.category}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700">
                      Slot: {food.meal_slot}
                    </span>
                    {food.best_fit_goal && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {food.best_fit_goal}
                      </span>
                    )}
                  </div>

                  {/* Nutrients Line */}
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 flex-wrap">
                    <span className="font-black text-slate-900">{food.calories} kcal</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">{food.protein_g}g Protein</span>
                    <span>•</span>
                    <span>{food.carbs_g}g Carbs</span>
                    <span>•</span>
                    <span>{food.fat_g}g Fat</span>
                    <span>•</span>
                    <span>{food.fiber_g}g Fiber</span>
                    <span>•</span>
                    <span className="text-slate-400 text-[11px]">
                      Source: {food.source.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Right badges & health score */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Health Score</div>
                    <div className="text-sm font-black text-emerald-800">
                      {food.health_score} <span className="text-[10px] text-slate-400">/100</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetails(food);
                    }}
                    className="p-2 rounded-xl text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-50 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              Previous
            </button>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span>Page</span>
              <span className="font-bold text-slate-900">{safeCurrentPage}</span>
              <span>of</span>
              <span className="font-bold text-slate-900">{totalPages}</span>
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
