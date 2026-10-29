import React from 'react';
import { BookOpen, ShieldAlert, Cpu, Calculator, CheckCircle2, Award } from 'lucide-react';

export const MethodologyDoc: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Intro Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Algorithms, Scoring Formulation & Architecture
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Comprehensive specification of the data preprocessing pipeline, multi-criteria goal equations,
          allergen validation protocol, and MLP neural classifier ported from the original Python system.
        </p>
      </div>

      {/* 1. Multi-Criteria Goal Formulas */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Calculator className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-base text-slate-900">
            1. Mathematical Goal Formulations (from Project.py)
          </h3>
        </div>

        <p className="text-xs text-slate-600">
          Each food item is evaluated across 5 physiological target axes using continuous nutrient parameters:
          Calories (c), Protein (p), Fat (f), Carbs (cb), Fiber (fb), Sugar (s), and Sodium (so).
        </p>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-sans font-bold text-emerald-800 uppercase mb-1">
              Weight Loss Score (ws_weight_loss)
            </div>
            <code>ws_weight_loss = (100 - c / 5) + fb * 3 - f * 2</code>
            <p className="font-sans text-[11px] text-slate-500 mt-1">
              Rewards high dietary fiber while penalizing excessive caloric density and total fat content.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-sans font-bold text-blue-800 uppercase mb-1">
              Muscle Gain Score (ws_muscle_gain)
            </div>
            <code>ws_muscle_gain = p * 4 - s</code>
            <p className="font-sans text-[11px] text-slate-500 mt-1">
              Maximizes lean amino acid protein yield with a 4x multiplier while penalizing added simple sugars.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-sans font-bold text-rose-800 uppercase mb-1">
              Heart Health Score (ws_heart_health)
            </div>
            <code>ws_heart_health = (100 - so / 20) + fb * 2 - f</code>
            <p className="font-sans text-[11px] text-slate-500 mt-1">
              Protects cardiovascular health by sharply penalizing sodium (divided by 20) and fat while rewarding soluble fiber.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-sans font-bold text-teal-800 uppercase mb-1">
              Diabetic-Friendly Score (ws_diabetic)
            </div>
            <code>ws_diabetic = (100 - s * 3 - cb) + fb * 4</code>
            <p className="font-sans text-[11px] text-slate-500 mt-1">
              Controls glycemic spikes: penalizes sugar heavily (3x) and total carbohydrates, heavily rewarding fiber (4x) for slowing glucose absorption.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-sans font-bold text-purple-800 uppercase mb-1">
              Balanced Diet Score (ws_balanced)
            </div>
            <code>ws_balanced = 100 - |c - 250| / 5 - |f - 15| - |s - 10|</code>
            <p className="font-sans text-[11px] text-slate-500 mt-1">
              Measures proximity to ideal meal macro distributions (~250 kcal, ~15g fat, ~10g sugar).
            </p>
          </div>
        </div>
      </div>

      {/* 2. Allergen Safety Policy */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-base text-slate-900">
            2. Three-State Allergen Safety Protocol
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          In real-world data (such as OpenFoodFacts and healthy food databases), absence of an ingredient label does not equal safety.
          The pipeline encodes allergen presence into 3 discrete states:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="font-bold text-emerald-900">State: 0 (Safe)</div>
            <p className="text-[11px] text-emerald-800 mt-0.5">
              Verified absence. Allergen is guaranteed not present in the ingredients.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
            <div className="font-bold text-rose-900">State: 1 (Contains)</div>
            <p className="text-[11px] text-rose-800 mt-0.5">
              Confirmed presence of allergen via keyword match or manufacturer disclosure.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="font-bold text-amber-900">State: -1 (Unverified)</div>
            <p className="text-[11px] text-amber-800 mt-0.5">
              No verified ingredient list available or processed on shared machinery.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <strong>Strict Filtering Principle:</strong> When <code>strict=True</code>, both state <code>1</code> AND state <code>-1</code> are filtered out.
          Unknown foods are never treated as safe for allergies.
        </div>
      </div>

      {/* 3. Multi-Criteria Normalization */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Award className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-base text-slate-900">
            3. Multi-Criteria Recommendation Scoring
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Because the raw scores for Weight Loss (e.g., 60-110) and Muscle Gain (e.g., 20-160) operate on different scales,
          the system normalizes each score to a uniform [0, 1] range across eligible candidates before calculating the weighted sum:
        </p>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs">
          <code>norm_score = (ws_goal - min_goal) / (max_goal - min_goal)</code>
          <div className="mt-1">
            <code>total_score = Σ [ (weight_i / Σ weights) * norm_score_i ]</code>
          </div>
        </div>
      </div>

      {/* 4. MLP Classifier Architecture */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Cpu className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-base text-slate-900">
            4. Machine Learning Classification (MLP Classifier)
          </h3>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          The system implements a Multi-Layer Perceptron (MLP) neural classifier from scikit-learn:
        </p>

        <ul className="list-disc list-inside text-xs text-slate-700 space-y-1.5 pl-2">
          <li><strong>Architecture:</strong> Two dense hidden layers: (64, 32) neurons with ReLU activation.</li>
          <li><strong>Optimizer:</strong> Adam solver, early stopping with <code>n_iter_no_change=15</code>.</li>
          <li><strong>Preprocessing:</strong> MinMaxScaler fit strictly on the training set to prevent data leakage.</li>
          <li><strong>Feature Extraction:</strong> PCA keeping 95% of continuous variance, concatenated with allergen flags.</li>
          <li><strong>Output:</strong> 5-class Softmax probability distribution corresponding to the primary health goals.</li>
        </ul>
      </div>
    </div>
  );
};
