import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  WeeklyArchiveRecord,
  HealthAnalyticsResponse,
  DayOfWeek,
  FoodItem,
} from '../types/diet';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Activity,
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Award,
  RefreshCw,
  Archive,
  ChevronDown,
  ChevronUp,
  Flame,
  PieChart,
  User,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface HealthAnalyticsPageProps {
  onOpenAuthModal: () => void;
  onNavigateToDashboard: () => void;
  onViewFoodDetails?: (food: FoodItem) => void;
}

export const HealthAnalyticsPage: React.FC<HealthAnalyticsPageProps> = ({
  onOpenAuthModal,
  onNavigateToDashboard,
  onViewFoodDetails,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [analytics, setAnalytics] = useState<HealthAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedArchive, setSelectedArchive] = useState<WeeklyArchiveRecord | null>(null);
  const [completingWeek, setCompletingWeek] = useState<boolean>(false);
  const [completeSuccessMessage, setCompleteSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    if (isAuthenticated) {
      try {
        const data = await api.getHealthAnalytics();
        if (data.success) {
          setAnalytics(data);
          if (data.history && data.history.length > 0) {
            setSelectedArchive(data.history[0]);
          }
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Failed to load user health analytics:', err);
      }
    }

    // Default sample analytics for guests or new accounts
    setAnalytics({
      success: true,
      overallHealthRate: 86,
      totalWeeksCompleted: 0,
      currentStreak: 0,
      averageAdherenceRate: 82,
      macroBalanceScore: 88,
      history: [],
      activeWeekStats: {
        followedCount: 16,
        notFollowedCount: 3,
        pendingCount: 9,
        totalMeals: 28,
        adherenceRate: 84,
        projectedHealthRate: 86,
      },
    });
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Handle completing week and resetting database
  const handleCompleteWeek = async () => {
    setCompletingWeek(true);
    try {
      const res = await api.completeWeek();
      if (res.success) {
        setCompleteSuccessMessage(res.message);
        setShowConfirmModal(false);
        // Reload analytics
        await loadAnalytics();
        setTimeout(() => setCompleteSuccessMessage(null), 5000);
      }
    } catch (err: any) {
      console.error('Failed to complete week:', err);
      alert(err.message || 'Could not archive week. Please try again.');
    } finally {
      setCompletingWeek(false);
    }
  };

  // Health Rate Badge Color
  const getHealthRateColor = (score: number) => {
    if (score >= 85) return { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', stroke: '#10b981', label: 'Optimal Health' };
    if (score >= 70) return { bg: 'bg-teal-50 text-teal-800 border-teal-200', stroke: '#0d9488', label: 'Balanced' };
    if (score >= 50) return { bg: 'bg-amber-50 text-amber-800 border-amber-200', stroke: '#f59e0b', label: 'Moderate' };
    return { bg: 'bg-rose-50 text-rose-800 border-rose-200', stroke: '#f43f5e', label: 'Needs Focus' };
  };

  const healthRate = analytics?.overallHealthRate || 85;
  const badgeInfo = getHealthRateColor(healthRate);

  // SVG Gauge calculations (Radius = 75, Circumference = 2 * PI * 75 ≈ 471.24)
  const radius = 75;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthRate / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <span>User Health Rate Analytics</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Weekly Adherence & Health Index
            </span>
            {completeSuccessMessage && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {completeSuccessMessage}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track multi-week diet adherence, macro distribution fidelity, and completed weekly archives with automated database resets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={completingWeek}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Complete Week & Reset</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Log In to Save History</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="p-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Health Rate Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Health Rate Score
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">
              {healthRate}%
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeInfo.bg}`}>
                {badgeInfo.label}
              </span>
            </div>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="10"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke={badgeInfo.stroke}
                strokeWidth="10"
                strokeDasharray={2 * Math.PI * 40}
                strokeDashoffset={2 * Math.PI * 40 - (healthRate / 100) * (2 * Math.PI * 40)}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <Activity className="w-5 h-5 absolute text-slate-700" />
          </div>
        </div>

        {/* Average Adherence */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Avg Diet Adherence
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">
              {analytics?.averageAdherenceRate ?? 0}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Followed scheduled meals</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Macro Balance Accuracy */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Macro Target Balance
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">
              {analytics?.macroBalanceScore ?? 85}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Protein / Carbs / Fat align</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <PieChart className="w-6 h-6" />
          </div>
        </div>

        {/* Consistency Streak & Total Completed Weeks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Weeks
            </div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1">
              {analytics?.totalWeeksCompleted ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>{analytics?.currentStreak ?? 0} week streak (≥60%)</span>
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Active Week Live Health Status & Reset Controller */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Current Week Status & Health Projection</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live score calculated from your active 7-day schedule before weekly rollover.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>View 7-Day Meals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Complete Week</span>
              </button>
            )}
          </div>
        </div>

        {analytics?.activeWeekStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="text-[11px] font-semibold text-emerald-800">Followed Meals</div>
              <div className="text-xl font-bold font-mono text-emerald-900 mt-1">
                {analytics.activeWeekStats.followedCount} / {analytics.activeWeekStats.totalMeals}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">
                {Math.round((analytics.activeWeekStats.followedCount / analytics.activeWeekStats.totalMeals) * 100)}% of week
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100">
              <div className="text-[11px] font-semibold text-rose-800">Not Followed</div>
              <div className="text-xl font-bold font-mono text-rose-900 mt-1">
                {analytics.activeWeekStats.notFollowedCount}
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5">
                {Math.round((analytics.activeWeekStats.notFollowedCount / analytics.activeWeekStats.totalMeals) * 100)}% missed
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-semibold text-slate-700">Remaining Pending</div>
              <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                {analytics.activeWeekStats.pendingCount}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {analytics.activeWeekStats.pendingCount} meals to track
              </div>
            </div>

            <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
              <div className="text-[11px] font-semibold text-teal-800">Projected Health Rate</div>
              <div className="text-xl font-bold font-mono text-teal-900 mt-1">
                {analytics.activeWeekStats.projectedHealthRate}%
              </div>
              <div className="text-[10px] text-teal-700 mt-0.5">
                Based on current adherence
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Weeks & Archived Records Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Archived Weeks List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-emerald-600" />
                <span>Archived Completed Weeks</span>
              </h3>
              <span className="text-xs text-slate-400">
                {analytics?.history?.length ?? 0} saved
              </span>
            </div>

            {analytics?.history && analytics.history.length > 0 ? (
              <div className="space-y-2 mt-3 max-h-[460px] overflow-y-auto pr-1">
                {analytics.history.map((record) => {
                  const isSelected = selectedArchive?.id === record.id;
                  const itemColor = getHealthRateColor(record.healthRate);

                  return (
                    <div
                      key={record.id}
                      onClick={() => setSelectedArchive(record)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-xs text-slate-900">
                          Week {record.weekNumber}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${itemColor.bg}`}>
                          {record.healthRate}% Health Rate
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                        <span>{record.startDate} → {record.endDate}</span>
                        <span className="font-mono text-emerald-700 font-semibold">
                          {record.stats.followedCount}/28 Followed ({record.stats.adherenceRate}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
                <Archive className="w-8 h-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No completed weeks archived yet.</p>
                <p className="mt-1 text-slate-400 max-w-xs">
                  Once you finish your 7-day schedule, click "Complete Week & Reset" to archive your performance and start a fresh week!
                </p>
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="mt-4 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Archive Current Week Now
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="mt-4 px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                  >
                    Sign in to track history
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Health Rate Formula Info */}
          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">Health Rate Computation:</span> 45% diet adherence rate + 30% nutrient food quality + 15% goal macro alignment + 10% meal slot consistency.
          </div>
        </div>

        {/* Right Column: Selected Archived Week Inspector (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    {selectedArchive
                      ? `Week ${selectedArchive.weekNumber} Archive Inspection`
                      : 'Weekly Detail & Performance Review'}
                  </span>
                </h3>
                {selectedArchive && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Completed on {new Date(selectedArchive.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {selectedArchive && (
                <div className="text-right">
                  <span className="text-2xl font-extrabold font-mono text-slate-900">
                    {selectedArchive.healthRate}%
                  </span>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Health Rate
                  </div>
                </div>
              )}
            </div>

            {selectedArchive ? (
              <div className="space-y-4 mt-4">
                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Adherence Score</span>
                    <div className="text-base font-extrabold font-mono text-slate-800 mt-0.5">
                      {selectedArchive.healthMetrics?.adherenceScore ?? selectedArchive.stats.adherenceRate}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Nutritional Quality</span>
                    <div className="text-base font-extrabold font-mono text-slate-800 mt-0.5">
                      {selectedArchive.healthMetrics?.nutritionalQualityScore ?? 85}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Goal Alignment</span>
                    <div className="text-base font-extrabold font-mono text-slate-800 mt-0.5">
                      {selectedArchive.healthMetrics?.goalAlignmentScore ?? 80}%
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Meal Consistency</span>
                    <div className="text-base font-extrabold font-mono text-slate-800 mt-0.5">
                      {selectedArchive.healthMetrics?.mealConsistencyScore ?? 88}%
                    </div>
                  </div>
                </div>

                {/* 7-Day Adherence Grid Review */}
                <div>
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    Daily Adherence Record:
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as DayOfWeek[]).map((day) => {
                      const dayAdh = selectedArchive.adherence[day] || {
                        Morning: 'pending',
                        Lunch: 'pending',
                        Snack: 'pending',
                        Dinner: 'pending',
                      };
                      const slots = [dayAdh.Morning, dayAdh.Lunch, dayAdh.Snack, dayAdh.Dinner];
                      const followed = slots.filter((s) => s === 'followed').length;

                      return (
                        <div key={day} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center">
                          <span className="text-[11px] font-bold text-slate-700">{day.slice(0, 3)}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold mt-1 ${
                              followed === 4
                                ? 'bg-emerald-100 text-emerald-800'
                                : followed >= 2
                                ? 'bg-teal-50 text-teal-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {followed}/4
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Day Meals Sample */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="font-bold text-slate-800 mb-2 flex items-center justify-between">
                    <span>Sample Schedule Foods From Archive:</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ~{selectedArchive.schedule?.Monday?.totalCalories || 2100} kcal/day
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['Morning', 'Lunch', 'Dinner'] as const).map((slot) => {
                      const foods = selectedArchive.schedule?.Monday?.meals?.[slot] || [];
                      const food = foods[0];
                      if (!food) return null;

                      return (
                        <div
                          key={slot}
                          onClick={() => onViewFoodDetails && onViewFoodDetails(food)}
                          className="p-2 rounded-lg bg-white border border-slate-200/80 hover:border-emerald-300 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-700">{slot}</span>
                            <span className="text-emerald-700 font-mono font-semibold">{food.calories} kcal</span>
                          </div>
                          <div className="text-xs text-slate-800 font-medium truncate mt-0.5">
                            {food.food_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Select an archived week from the left panel to inspect detailed performance breakdown and adherence metrics.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Database state is automatically stored and reset upon every weekly completion.</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Complete Week & Reset - ZERO BLUR */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Complete & Archive This Week?
                </h3>
                <p className="text-xs text-slate-500">
                  Store current schedule & reset database for the next week
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <p>
                <strong>1.</strong> Your active 7-day schedule and adherence results will be saved into your <strong>Weekly History Archive</strong>.
              </p>
              <p>
                <strong>2.</strong> Your composite <strong>Health Rate Score</strong> will be recorded in PostgreSQL.
              </p>
              <p>
                <strong>3.</strong> The active database schedule will be <strong>reset</strong> with a fresh 7-day plan, setting all meal statuses to pending for the new week.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
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
                    <span>Confirm & Reset Week</span>
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
