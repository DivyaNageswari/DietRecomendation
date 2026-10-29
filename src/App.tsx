import React, { useState, useEffect } from 'react';
import { FoodItem } from './types/diet';
import { INITIAL_FOOD_DATABASE } from './data/foodDatabase';
import { Header, ActiveTab } from './components/Header';
import { MealPlanGenerator } from './components/MealPlanGenerator';
import { UserDashboard } from './components/UserDashboard';
import { HealthAnalyticsPage } from './components/HealthAnalyticsPage';
import { FoodExplorer } from './components/FoodExplorer';
import { MlpClassifierLab } from './components/MlpClassifierLab';
import { MethodologyDoc } from './components/MethodologyDoc';
import { FoodDetailModal } from './components/FoodDetailModal';
import { CsvImportModal } from './components/CsvImportModal';
import { BackendConnectionModal } from './components/BackendConnectionModal';
import { AuthModal } from './components/AuthModal';
import { AuthProvider } from './context/AuthContext';
import { api } from './services/api';

export const AppContent: React.FC = () => {
  const [foods, setFoods] = useState<FoodItem[]>(INITIAL_FOOD_DATABASE);
  const [activeTab, setActiveTab] = useState<ActiveTab>('generator');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(true);

  // Synchronize with backend API on mount
  const syncWithBackend = () => {
    return api
      .checkHealth()
      .then((health) => {
        if (health.healthy) {
          setIsBackendConnected(true);
        }
        return api.getFoods();
      })
      .then((data) => {
        if (data && data.length > 0) {
          setFoods(data);
          setIsBackendConnected(true);
          return true;
        }
        return false;
      })
      .catch((err) => {
        console.warn('Backend sync warning:', err);
        setIsBackendConnected(false);
        return false;
      });
  };

  useEffect(() => {
    let isMounted = true;

    // Initial check
    syncWithBackend().then((connected) => {
      // If initially not connected, retry at 6s and 18s in case Render Web Service is waking up
      if (isMounted && !connected) {
        const timer1 = setTimeout(() => {
          if (isMounted) syncWithBackend();
        }, 6000);
        const timer2 = setTimeout(() => {
          if (isMounted) syncWithBackend();
        }, 18000);
        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);


  const handleImportFoods = (importedFoods: FoodItem[]) => {
    setFoods((prev) => [...importedFoods, ...prev]);
    // Also batch sync with backend in background
    importedFoods.forEach((f) => api.addFood(f).catch(() => {}));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Fixed Right Side Panel */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        foodsCount={foods.length}
        isBackendConnected={isBackendConnected}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area (Scrollable next to fixed right panel) */}
      <div className="flex-1 lg:pr-72 flex flex-col min-h-screen w-full">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'dashboard' && (
            <UserDashboard
              foodDatabase={foods}
              onViewDetails={(food) => setSelectedFood(food)}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onNavigateToAnalytics={() => setActiveTab('analytics')}
            />
          )}

          {activeTab === 'analytics' && (
            <HealthAnalyticsPage
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
              onNavigateToDashboard={() => setActiveTab('dashboard')}
              onViewFoodDetails={(food) => setSelectedFood(food)}
            />
          )}

          {activeTab === 'generator' && (
            <MealPlanGenerator
              foodDatabase={foods}
              onViewDetails={(food) => setSelectedFood(food)}
              onOpenAuthModal={() => setIsAuthModalOpen(true)}
            />
          )}

          {activeTab === 'explorer' && (
            <FoodExplorer
              foods={foods}
              onViewDetails={(food) => setSelectedFood(food)}
              onOpenCsvModal={() => setIsCsvModalOpen(true)}
            />
          )}

          {activeTab === 'mlplab' && (
            <MlpClassifierLab
              sampleFoods={foods}
              onViewDetails={(food) => setSelectedFood(food)}
            />
          )}

          {activeTab === 'methodology' && <MethodologyDoc />}
        </main>

        {/* Clean Footer */}
        <footer className="bg-white border-t border-slate-200 mt-auto py-5 text-xs text-slate-500 text-center">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Diet Recommendation System</span>
              <span>•</span>
              <span>Multi-Criteria Optimization & Neural Classification</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span>Personalized Nutrition Planner</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Food Details Modal */}
      <FoodDetailModal
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
      />

      {/* User Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Backend Connection Modal */}
      <BackendConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        onConnected={() => {
          syncWithBackend();
          setIsConnectionModalOpen(false);
        }}
        isBackendConnected={isBackendConnected}
        activeFoodsCount={foods.length}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImportFoods={handleImportFoods}
        onReloadFoods={() => {
          api.getFoods().then((data) => {
            if (data && data.length > 0) setFoods(data);
          });
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
