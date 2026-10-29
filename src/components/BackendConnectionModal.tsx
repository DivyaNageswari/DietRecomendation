import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Link2 } from 'lucide-react';
import { api, getApiBaseUrl, setCustomBackendUrl } from '../services/api';

interface BackendConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
  isBackendConnected: boolean;
  activeFoodsCount: number;
}

export const BackendConnectionModal: React.FC<BackendConnectionModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  isBackendConnected,
  activeFoodsCount,
}) => {
  const [urlInput, setUrlInput] = useState(() => getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    foodsCount?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const cleanUrl = urlInput.trim().replace(/\/+$/, '');

    try {
      // Temporarily save to test
      setCustomBackendUrl(cleanUrl || null);
      const health = await api.checkHealth();

      if (health.healthy) {
        setTestResult({
          success: true,
          message: 'Connected successfully to Render backend!',
          foodsCount: health.foodsCount,
        });
        onConnected();
      } else {
        setTestResult({
          success: false,
          message:
            'Could not reach backend at this URL. If using Render Free tier, it may be waking up (takes ~50s). Check that the URL is correct.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection error: ${err.message || 'Failed to fetch'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetToDefault = () => {
    setCustomBackendUrl(null);
    setUrlInput('');
    setTestResult(null);
    onConnected();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Backend Connection Settings</h3>
              <p className="text-xs text-slate-500">
                Connect your Vercel frontend to your Render backend API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Current Status Pill */}
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${
              isBackendConnected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isBackendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="font-bold">
                {isBackendConnected
                  ? `Live Backend Connected (${activeFoodsCount.toLocaleString()} foods)`
                  : `Real CSV Dataset Active (${activeFoodsCount} foods)`}
              </span>
            </div>
            <span className="text-[11px] font-semibold">
              {isBackendConnected ? 'Fully Synced' : 'Standalone'}
            </span>
          </div>

          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Render Backend Service URL
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://your-service-name.onrender.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Paste your live Render Web Service URL. If left empty, the frontend uses relative requests (configured via <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">vercel.json</code>).
              </p>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResult.message}</div>
                  {testResult.foodsCount !== undefined && (
                    <div className="text-[11px] mt-0.5">
                      Loaded {testResult.foodsCount.toLocaleString()} real food items from Render!
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
              >
                Reset to Default
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testing}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>Test & Save</span>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Quick Info Box on Render Free Tier */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>💡 Render Free Tier Tip:</span>
            </div>
            <p>
              Free Render web services spin down after 15 minutes of inactivity. When accessed for the first time, Render takes about <strong>50 seconds to wake up</strong>.
            </p>
            <p>
              Our app automatically falls back to an offline seed database so you never see an empty screen while it wakes up!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
