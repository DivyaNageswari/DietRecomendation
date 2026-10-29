import React, { useState, useMemo } from 'react';
import { FoodItem, GoalType } from '../types/diet';
import { predictMlpGoal } from '../utils/scoring';
import { Cpu, Play, BarChart3, Layers, CheckCircle2, Sliders, Sparkles, BrainCircuit } from 'lucide-react';

interface MlpClassifierLabProps {
  sampleFoods: FoodItem[];
  onViewDetails: (food: FoodItem) => void;
}

export const MlpClassifierLab: React.FC<MlpClassifierLabProps> = ({ sampleFoods, onViewDetails }) => {
  // Test food inputs
  const [testCalories, setTestCalories] = useState<number>(220);
  const [testProtein, setTestProtein] = useState<number>(32);
  const [testFat, setTestFat] = useState<number>(4);
  const [testCarbs, setTestCarbs] = useState<number>(10);
  const [testFiber, setTestFiber] = useState<number>(5);
  const [testSugar, setTestSugar] = useState<number>(1);
  const [testSodium, setTestSodium] = useState<number>(140);
  const [testHealthScore, setTestHealthScore] = useState<number>(94);

  // Compute MLP prediction
  const prediction = useMemo(() => {
    return predictMlpGoal({
      calories: testCalories,
      protein_g: testProtein,
      fat_g: testFat,
      carbs_g: testCarbs,
      fiber_g: testFiber,
      sugar_g: testSugar,
      sodium_mg: testSodium,
      health_score: testHealthScore,
    });
  }, [testCalories, testProtein, testFat, testCarbs, testFiber, testSugar, testSodium, testHealthScore]);

  // Quick preset foods to test
  const quickTestPresets = [
    { name: 'Lean Grilled Salmon', c: 285, p: 34, f: 14, cb: 3, fb: 2, s: 1, so: 125, h: 96 },
    { name: 'Pure Whey / Chicken Breast', c: 165, p: 35, f: 2, cb: 0, fb: 0, s: 0, so: 120, h: 92 },
    { name: 'Lentil & Kale Fiber Bowl', c: 215, p: 14, f: 3, cb: 34, fb: 11, s: 3, so: 230, h: 97 },
    { name: 'Avocado Whole Grain Toast', c: 220, p: 6, f: 11, cb: 24, fb: 7, s: 2, so: 190, h: 89 },
    { name: 'Almond Chia Pudding', c: 160, p: 5, f: 8, cb: 16, fb: 8, s: 4, so: 85, h: 91 },
  ];

  const applyPreset = (preset: typeof quickTestPresets[0]) => {
    setTestCalories(preset.c);
    setTestProtein(preset.p);
    setTestFat(preset.f);
    setTestCarbs(preset.cb);
    setTestFiber(preset.fb);
    setTestSugar(preset.s);
    setTestSodium(preset.so);
    setTestHealthScore(preset.h);
  };

  // Static performance metrics ported from Project.py evaluation
  const evaluationMetrics = [
    { goal: 'Weight Loss', precision: '0.95', recall: '0.95', f1: '0.95', support: '420' },
    { goal: 'Muscle Gain', precision: '0.97', recall: '0.96', f1: '0.96', support: '380' },
    { goal: 'Heart Health', precision: '0.94', recall: '0.94', f1: '0.94', support: '345' },
    { goal: 'Diabetic-Friendly', precision: '0.95', recall: '0.95', f1: '0.95', support: '360' },
    { goal: 'Balanced Diet', precision: '0.95', recall: '0.94', f1: '0.94', support: '395' },
  ];

  // Confusion matrix rows from Project.py
  const confusionClasses: GoalType[] = [
    'Weight Loss',
    'Muscle Gain',
    'Heart Health',
    'Diabetic-Friendly',
    'Balanced Diet',
  ];

  const confusionData = [
    [401, 4, 6, 3, 6],    // True: Weight Loss (95.5%)
    [3, 365, 2, 5, 5],    // True: Muscle Gain (96.1%)
    [8, 1, 326, 6, 4],    // True: Heart Health (94.5%)
    [5, 2, 7, 342, 4],    // True: Diabetic (95.0%)
    [8, 5, 6, 5, 371],    // True: Balanced (93.9%)
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-white/10 text-purple-200">
                <BrainCircuit className="w-5 h-5" />
              </span>
              <span className="text-xs uppercase font-bold tracking-wider text-purple-200">
                Machine Learning Inspection
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              MLP Classifier & Neural Food Lab
            </h2>
            <p className="text-xs text-purple-200 max-w-2xl mt-1 leading-relaxed">
              Multi-Layer Perceptron (64, 32) trained on 14 standardized features with PCA 95% variance extraction
              to predict the optimal health goal label for any given nutrient composition.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 px-4 py-3 rounded-2xl border border-white/15">
            <div>
              <div className="text-[10px] uppercase font-bold text-purple-200">Test Accuracy</div>
              <div className="text-2xl font-black text-white">95.0%</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-[10px] uppercase font-bold text-purple-200">Components</div>
              <div className="text-sm font-bold text-white">PCA (95% var)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Input Controls (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Nutrient Input Sandbox
              </h3>
            </div>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              Live Feedforward
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-2 mb-3">
            Modify any continuous feature or choose a preset to see the neural network activate in real time.
          </p>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {quickTestPresets.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-purple-50 hover:text-purple-800 text-slate-700 transition-colors border border-transparent hover:border-purple-200"
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Feature Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {/* Protein */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Protein (g)</span>
                <span className="font-mono text-emerald-700 font-bold">{testProtein}g</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={testProtein}
                onChange={(e) => setTestProtein(Number(e.target.value))}
                className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fiber */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Dietary Fiber (g)</span>
                <span className="font-mono text-teal-700 font-bold">{testFiber}g</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={testFiber}
                onChange={(e) => setTestFiber(Number(e.target.value))}
                className="w-full accent-teal-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Calories */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Calories (kcal)</span>
                <span className="font-mono text-amber-700 font-bold">{testCalories} kcal</span>
              </div>
              <input
                type="range"
                min="20"
                max="600"
                step="10"
                value={testCalories}
                onChange={(e) => setTestCalories(Number(e.target.value))}
                className="w-full accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fat */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Total Fat (g)</span>
                <span className="font-mono text-rose-700 font-bold">{testFat}g</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={testFat}
                onChange={(e) => setTestFat(Number(e.target.value))}
                className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sugar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Sugar (g)</span>
                <span className="font-mono text-indigo-700 font-bold">{testSugar}g</span>
              </div>
              <input
                type="range"
                min="0"
                max="35"
                value={testSugar}
                onChange={(e) => setTestSugar(Number(e.target.value))}
                className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sodium */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Sodium (mg)</span>
                <span className="font-mono text-slate-700 font-bold">{testSodium}mg</span>
              </div>
              <input
                type="range"
                min="0"
                max="800"
                step="20"
                value={testSodium}
                onChange={(e) => setTestSodium(Number(e.target.value))}
                className="w-full accent-slate-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Carbs */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Carbs (g)</span>
                <span className="font-mono text-blue-700 font-bold">{testCarbs}g</span>
              </div>
              <input
                type="range"
                min="0"
                max="75"
                value={testCarbs}
                onChange={(e) => setTestCarbs(Number(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Health Score */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-700">Health Score</span>
                <span className="font-mono text-purple-700 font-bold">{testHealthScore} / 100</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                value={testHealthScore}
                onChange={(e) => setTestHealthScore(Number(e.target.value))}
                className="w-full accent-purple-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Real-Time Prediction Output (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  Predicted Goal Classification
                </h3>
              </div>
            </div>

            {/* Winning Label Box */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-tr from-purple-50 to-indigo-50 border border-purple-200 text-center">
              <span className="text-[10px] uppercase font-extrabold text-purple-600 tracking-wider">
                Predicted Best Fit Label
              </span>
              <div className="text-2xl font-black text-purple-950 mt-0.5">
                {prediction.predictedGoal}
              </div>
              <div className="text-xs font-bold text-purple-700 mt-1">
                {prediction.confidence}% Model Confidence
              </div>
            </div>

            {/* Softmax Probability Bars */}
            <div className="mt-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-700 mb-1">
                Softmax Class Probability Distribution
              </div>
              {(Object.keys(prediction.probabilities) as GoalType[]).map((goal) => {
                const prob = prediction.probabilities[goal];
                const isWinner = goal === prediction.predictedGoal;

                return (
                  <div key={goal} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className={isWinner ? 'text-purple-900 font-black' : 'text-slate-600'}>
                        {goal}
                      </span>
                      <span className="font-mono text-slate-800">{prob}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isWinner ? 'bg-purple-600' : 'bg-slate-300'
                        }`}
                        style={{ width: `${prob}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2D PCA Projections */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>PCA Coordinates:</span>
            <span className="font-mono font-bold text-slate-700">
              PC1: {prediction.pcaCoordinates[0]}, PC2: {prediction.pcaCoordinates[1]}
            </span>
          </div>
        </div>
      </div>

      {/* Model Performance & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Classification Report Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              Model Evaluation Report (scikit-learn MLP)
            </h3>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Goal Class</th>
                  <th className="py-2.5 px-2">Precision</th>
                  <th className="py-2.5 px-2">Recall</th>
                  <th className="py-2.5 px-2">F1-Score</th>
                  <th className="py-2.5 px-2 text-right">Support</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {evaluationMetrics.map((row) => (
                  <tr key={row.goal} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{row.goal}</td>
                    <td className="py-2.5 px-2 font-mono">{row.precision}</td>
                    <td className="py-2.5 px-2 font-mono">{row.recall}</td>
                    <td className="py-2.5 px-2 font-mono font-bold text-emerald-700">{row.f1}</td>
                    <td className="py-2.5 px-2 font-mono text-right text-slate-500">{row.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confusion Matrix Heatmap (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              MLP Confusion Matrix
            </h3>
          </div>

          <div className="mt-4">
            <div className="text-[11px] text-slate-500 mb-2 font-medium">
              Rows: True Goal Label | Columns: Predicted Goal Label
            </div>

            <div className="grid grid-cols-6 gap-1 text-[10px] text-center font-bold">
              <div className="text-slate-400">True \ Pred</div>
              {['WL', 'MG', 'HH', 'DF', 'BD'].map((lbl) => (
                <div key={lbl} className="bg-slate-100 py-1 rounded text-slate-700">{lbl}</div>
              ))}

              {confusionData.map((row, rIdx) => (
                <React.Fragment key={rIdx}>
                  <div className="bg-slate-100 py-1.5 rounded flex items-center justify-center font-mono text-slate-700">
                    {['WL', 'MG', 'HH', 'DF', 'BD'][rIdx]}
                  </div>
                  {row.map((val, cIdx) => {
                    const isDiagonal = rIdx === cIdx;
                    return (
                      <div
                        key={cIdx}
                        className={`py-1.5 rounded font-mono font-bold ${
                          isDiagonal
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : val > 10
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {val}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>WL: Weight Loss • MG: Muscle Gain</span>
              <span>HH: Heart Health • DF: Diabetic</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
