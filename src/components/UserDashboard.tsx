import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DayOfWeek,
  FoodItem,
  WeeklySchedule,
  WeeklyAdherence,
  AdherenceStatus,
} from '../types/diet';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  generate7DaySchedule,
  generateInitialAdherence,
  computeAdherenceStats,
  DAYS_OF_WEEK,
} from '../server/weeklyScheduler';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Database,
  Calendar,
  Utensils,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  User,
  Archive,
  Activity,
  ArrowRight,
} from 'lucide-react';

interface UserDashboardProps {
  foodDatabase: FoodItem[];
  onViewDetails: (food: FoodItem) => void;
  onOpenAuthModal: () => void;
  onNavigateToAnalytics?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  foodDatabase,
  onViewDetails,
  onOpenAuthModal,
  onNavigateToAnalytics,
}) => {
  const { user, preferences, isAuthenticated, dbStatus } = useAuth();

  const [schedule, setSchedule] = useState<WeeklySchedule | null>(null);
  const [adherence, setAdherence] = useState<WeeklyAdherence>(() => generateInitialAdherence());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [saveIndicator, setSaveIndicator] = useState<string | null>(null);
  const [completingWeek, setCompletingWeek] = useState<boolean>(false);
  const [showCompleteModal, setShowCompleteModal] = useState<boolean>(false);
  const [completeWeekSuccess, setCompleteWeekSuccess] = useState<string | null>(null);

  // Compute live adherence stats from current state
  const stats = useMemo(() => {
    return computeAdherenceStats(adherence);
  }, [adherence]);

  // Load schedule from backend or initialize locally
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    if (isAuthenticated) {
      try {
        const res = await api.getWeeklySchedule();
        if (res.success && res.schedule) {
          setSchedule(res.schedule);
          if (res.adherence) {
            setAdherence(res.adherence);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Could not load weekly schedule from backend:', err);
      }
    }

    // Fallback: Generate local 7-day schedule using current preferences or defaults
    const activeWeights = preferences?.goal_weights || {
      'Weight Loss': 0.7,
      'Muscle Gain': 0.0,
      'Heart Health': 0.3,
      'Diabetic-Friendly': 0.0,
      'Balanced Diet': 0.0,
    };
    const activeAllergies = preferences?.allergies || [];
    const activeStrict = preferences?.strict_allergens ?? false;
    const itemsPerSlot = preferences?.items_per_slot || 2;

    const localSched = generate7DaySchedule(
      foodDatabase,
      activeWeights,
      activeAllergies,
      activeStrict,
      itemsPerSlot
    );
    setSchedule(localSched);
    setLoading(false);
  }, [isAuthenticated, preferences, foodDatabase]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Handle marking an individual meal slot as followed / not_followed / pending
  const handleSetMealStatus = async (
    day: DayOfWeek,
    slot: 'Morning' | 'Lunch' | 'Snack' | 'Dinner',
    status: AdherenceStatus
  ) => {
    // 1. Immediately update local state so UI and chart react in real-time
    const updated: WeeklyAdherence = {
      ...adherence,
      [day]: {
        ...(adherence[day] || {
          Morning: 'pending',
          Lunch: 'pending',
          Snack: 'pending',
          Dinner: 'pending',
        }),
        [slot]: status,
      },
    };
    setAdherence(updated);

    // 2. Persist to PostgreSQL if authenticated
    if (isAuthenticated) {
      setSaveIndicator('Saving...');
      try {
        await api.updateAdherence({ day, slot, status });
        setSaveIndicator(dbStatus?.connected ? 'Saved to PostgreSQL' : 'Saved to Profile');
        setTimeout(() => setSaveIndicator(null), 2000);
      } catch (err) {
        console.warn('Failed to persist adherence update:', err);
        setSaveIndicator('Saved locally');
        setTimeout(() => setSaveIndicator(null), 2000);
      }
    }
  };

  // Handle marking an entire day as Followed or Not Followed
  const handleSetDayStatus = async (day: DayOfWeek, dayStatus: AdherenceStatus) => {
    const updated: WeeklyAdherence = {
      ...adherence,
      [day]: {
        Morning: dayStatus,
        Lunch: dayStatus,
        Snack: dayStatus,
        Dinner: dayStatus,
      },
    };
    setAdherence(updated);

    if (isAuthenticated) {
      setSaveIndicator('Saving...');
      try {
        await api.updateAdherence({ day, dayStatus });
        setSaveIndicator(dbStatus?.connected ? 'Saved to PostgreSQL' : 'Saved to Profile');
        setTimeout(() => setSaveIndicator(null), 2000);
      } catch (err) {
        console.warn('Failed to persist day adherence update:', err);
        setSaveIndicator('Saved locally');
        setTimeout(() => setSaveIndicator(null), 2000);
      }
    }
  };

  // Re-generate schedule
  const handleRegenerate = async (preserveExistingAdherence: boolean = true) => {
    setGenerating(true);
    if (isAuthenticated) {
      try {
        const res = await api.generateWeeklySchedule(preserveExistingAdherence);
        if (res.success && res.schedule) {
          setSchedule(res.schedule);
          if (res.adherence) setAdherence(res.adherence);
        }
      } catch (err) {
        console.warn('Backend generation failed, doing local:', err);
        await loadSchedule();
      }
    } else {
      await loadSchedule();
    }
    setGenerating(false);
  };

  // Complete and archive current week, reset schedule for next week
  const handleCompleteWeek = async () => {
    setCompletingWeek(true);
    try {
      if (isAuthenticated) {
        const res = await api.completeWeek();
        if (res.success) {
          setSchedule(res.schedule);
          setAdherence(res.adherence);
          setCompleteWeekSuccess(`Week ${res.archivedRecord.weekNumber} archived! Active schedule reset.`);
          setShowCompleteModal(false);
          setTimeout(() => setCompleteWeekSuccess(null), 5000);
        }
      } else {
        // Guest mode fallback: reset adherence
        setAdherence(generateInitialAdherence());
        setShowCompleteModal(false);
        setCompleteWeekSuccess('Weekly schedule reset for the new week.');
        setTimeout(() => setCompleteWeekSuccess(null), 5000);
      }
    } catch (err: any) {
      alert(err.message || 'Could not archive week. Please try again.');
    } finally {
      setCompletingWeek(false);
    }
  };

  // SVG Pie Chart calculations (Radius = 70, Circumference = 2 * PI * 70 ≈ 439.82)
  const pieMetrics = useMemo(() => {
    const total = stats.totalMeals || 28;
    const followedPct = (stats.followedCount / total) * 100;
    const notFollowedPct = (stats.notFollowedCount / total) * 100;
    const pendingPct = (stats.pendingCount / total) * 100;

    const circumference = 2 * Math.PI * 70; // 439.82

    const followedStroke = (followedPct / 100) * circumference;
    const notFollowedStroke = (notFollowedPct / 100) * circumference;
    const pendingStroke = (pendingPct / 100) * circumference;

    const notFollowedOffset = -followedStroke;
    const pendingOffset = -(followedStroke + notFollowedStroke);

    return {
      circumference,
      followedStroke,
      notFollowedStroke,
      pendingStroke,
      notFollowedOffset,
      pendingOffset,
      followedPct: Math.round(followedPct),
      notFollowedPct: Math.round(notFollowedPct),
      pendingPct: Math.round(pendingPct),
    };
  }, [stats]);

  const currentDaySchedule = schedule ? schedule[selectedDay] : null;
  const currentDayAdherence = adherence[selectedDay] || {
    Morning: 'pending',
    Lunch: 'pending',
    Snack: 'pending',
    Dinner: 'pending',
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <span>Weekly Diet Schedule & Adherence Dashboard</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              7-Day ML Planner
            </span>
            {saveIndicator && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 animate-in fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-teal-600" />
                {saveIndicator}
              </span>
            )}
            {completeWeekSuccess && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 animate-in fade-in flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {completeWeekSuccess}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Personalized meal allocation across Monday through Sunday with live adherence rate tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToAnalytics && (
            <button
              type="button"
              onClick={onNavigateToAnalytics}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Health Analytics</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCompleteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            title="Complete week, save to archive, and reset database for the next week"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Complete Week & Reset</span>
          </button>

          <button
            type="button"
            onClick={() => handleRegenerate(true)}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            title="Re-generate meal schedule using latest preferences"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          {!isAuthenticated && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-slate-600" />
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>

      {/* Adherence Dashboard Metrics & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive SVG Pie/Donut Chart (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Weekly Diet Adherence Rate</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Followed meals vs. completed scheduled meals
          </p>

          {/* SVG Pie / Donut Chart */}
          <div className="relative w-48 h-48 my-1 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
              {/* Background track circle */}
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="24"
              />

              {/* Pending slice (slate) */}
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="transparent"
                stroke="#cbd5e1"
                strokeWidth="24"
                strokeDasharray={`${pieMetrics.pendingStroke} ${pieMetrics.circumference}`}
                strokeDashoffset={pieMetrics.pendingOffset}
                className="transition-all duration-300"
              />

              {/* Not Followed slice (rose) */}
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="transparent"
                stroke="#f43f5e"
                strokeWidth="24"
                strokeDasharray={`${pieMetrics.notFollowedStroke} ${pieMetrics.circumference}`}
                strokeDashoffset={pieMetrics.notFollowedOffset}
                className="transition-all duration-300"
              />

              {/* Followed slice (emerald) */}
              <circle
                cx="90"
                cy="90"
                r="70"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="24"
                strokeDasharray={`${pieMetrics.followedStroke} ${pieMetrics.circumference}`}
                strokeDashoffset="0"
                className="transition-all duration-300"
              />
            </svg>

            {/* Inner Center Label */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {stats.adherenceRate}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Adherence
              </span>
            </div>
          </div>

          {/* Legend and Counts */}
          <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-3 border-t border-slate-100 text-xs">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 flex flex-col items-center">
              <div className="flex items-center gap-1 text-emerald-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Followed</span>
              </div>
              <span className="text-lg font-mono font-extrabold text-emerald-700 mt-0.5">
                {stats.followedCount}
              </span>
              <span className="text-[10px] text-emerald-600">
                {stats.totalMeals > 0 ? Math.round((stats.followedCount / stats.totalMeals) * 100) : 0}% of week
              </span>
            </div>

            <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 flex flex-col items-center">
              <div className="flex items-center gap-1 text-rose-800 font-bold">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Not Followed</span>
              </div>
              <span className="text-lg font-mono font-extrabold text-rose-700 mt-0.5">
                {stats.notFollowedCount}
              </span>
              <span className="text-[10px] text-rose-600">
                {stats.totalMeals > 0 ? Math.round((stats.notFollowedCount / stats.totalMeals) * 100) : 0}% of week
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Pending</span>
              </div>
              <span className="text-lg font-mono font-extrabold text-slate-700 mt-0.5">
                {stats.pendingCount}
              </span>
              <span className="text-[10px] text-slate-500">
                {stats.totalMeals > 0 ? Math.round((stats.pendingCount / stats.totalMeals) * 100) : 0}% left
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Day Overview Grid (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Weekly Status by Day</span>
              </h3>
              <span className="text-xs text-slate-500">
                Click a day to view its detailed meals
              </span>
            </div>

            {/* 7-day pill bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mt-4">
              {DAYS_OF_WEEK.map((day) => {
                const dayAdh = adherence[day] || {
                  Morning: 'pending',
                  Lunch: 'pending',
                  Snack: 'pending',
                  Dinner: 'pending',
                };
                const slots = [dayAdh.Morning, dayAdh.Lunch, dayAdh.Snack, dayAdh.Dinner];
                const followed = slots.filter((s) => s === 'followed').length;
                const notFollowed = slots.filter((s) => s === 'not_followed').length;
                const isSelected = selectedDay === day;

                let badgeColor = 'bg-slate-100 text-slate-600';
                if (followed === 4) badgeColor = 'bg-emerald-100 text-emerald-800 font-bold';
                else if (notFollowed > 0) badgeColor = 'bg-amber-100 text-amber-800 font-bold';
                else if (followed > 0) badgeColor = 'bg-teal-50 text-teal-800 font-semibold';

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-900">
                      {day.slice(0, 3)}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1.5 ${badgeColor}`}>
                      {followed}/4
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick summary notice */}
          <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                All scheduled meals reflect your personal goal targets & allergen clearance.
              </span>
            </div>
            {isAuthenticated && (
              <span className="text-[11px] text-emerald-700 font-semibold shrink-0 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Diet Profile Synced</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Selected Day's Meals & Adherence Controls */}
      {currentDaySchedule && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedDay}'s Scheduled Meals
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                  ~{currentDaySchedule.totalCalories} kcal total
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Mark each meal as followed or not followed. Changes immediately update your adherence percentage.
              </p>
            </div>

            {/* Quick bulk action buttons */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleSetDayStatus(selectedDay, 'followed')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark All Followed</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetDayStatus(selectedDay, 'not_followed')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Mark All Not Followed</span>
              </button>
            </div>
          </div>

          {/* 4 Meal Slots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['Morning', 'Lunch', 'Snack', 'Dinner'] as const).map((slot) => {
              const items = currentDaySchedule.meals[slot] || [];
              const status: AdherenceStatus = currentDayAdherence[slot] || 'pending';

              let cardBorder = 'border-slate-200';
              let statusBadge = (
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  <span>Pending</span>
                </span>
              );

              if (status === 'followed') {
                cardBorder = 'border-emerald-300 bg-emerald-50/20';
                statusBadge = (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Followed</span>
                  </span>
                );
              } else if (status === 'not_followed') {
                cardBorder = 'border-rose-300 bg-rose-50/20';
                statusBadge = (
                  <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <XCircle className="w-2.5 h-2.5 text-rose-600" />
                    <span>Not Followed</span>
                  </span>
                );
              }

              return (
                <div
                  key={slot}
                  className={`rounded-xl border p-4 flex flex-col justify-between transition-all ${cardBorder}`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="font-bold text-sm text-slate-800">{slot}</span>
                      {statusBadge}
                    </div>

                    {/* Food Items List */}
                    <div className="space-y-2 mb-3">
                      {items.map((food) => (
                        <div
                          key={food.id}
                          onClick={() => onViewDetails(food)}
                          className="p-2 rounded-lg bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-xs transition-all cursor-pointer"
                        >
                          <div className="font-semibold text-xs text-slate-800 line-clamp-1">
                            {food.food_name}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                            <span>{food.category}</span>
                            <span className="font-mono text-emerald-700 font-semibold">
                              {food.calories} kcal
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Followed vs Not Followed Toggle Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleSetMealStatus(
                          selectedDay,
                          slot,
                          status === 'followed' ? 'pending' : 'followed'
                        )
                      }
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        status === 'followed'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Followed</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSetMealStatus(
                          selectedDay,
                          slot,
                          status === 'not_followed' ? 'pending' : 'not_followed'
                        )
                      }
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        status === 'not_followed'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Not Followed</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Complete Week & Reset - ZERO BLUR */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Complete Week & Archive?
                </h3>
                <p className="text-xs text-slate-500">
                  Archive this week's progress and reset active database schedule
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <p>
                <strong>• Archive:</strong> Current week adherence ({stats.adherenceRate}%) and meals will be permanently saved to your history.
              </p>
              <p>
                <strong>• Health Rate:</strong> Your composite health score will be updated and visible on the Health Analytics page.
              </p>
              <p>
                <strong>• Reset:</strong> A fresh 7-day schedule will be initialized with all meals set to pending.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                disabled={completingWeek}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCompleteWeek}
                disabled={completingWeek}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {completingWeek ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Archiving & Resetting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Reset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

