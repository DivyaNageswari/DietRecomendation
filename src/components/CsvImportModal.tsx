import React, { useState, useEffect } from 'react';
import { FoodItem } from '../types/diet';
import { api } from '../services/api';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  RefreshCw,
  FolderOpen,
  Lock,
  FileText,
  ShieldCheck,
} from 'lucide-react';

interface DatasetFile {
  fileName: string;
  relativePath: string;
  title: string;
  description: string;
  rowCount: number;
  fileSizeBytes: number;
  source: 'healthy_db' | 'openfoodfacts' | 'usda';
}

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportFoods?: (foods: FoodItem[]) => void;
  onReloadFoods?: () => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportFoods,
  onReloadFoods,
}) => {
  if (!isOpen) return null;

  const [datasetFiles, setDatasetFiles] = useState<DatasetFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.getDatasetFiles()
      .then((files) => {
        setDatasetFiles(files as DatasetFile[]);
      })
      .catch((err) => {
        console.warn('Failed to load dataset files list:', err);
      });
  }, []);

  const handleLoadDatasetFile = async (file: DatasetFile) => {
    setSelectedFile(file.fileName);
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await api.loadDatasetFile(file.fileName);
      setSuccessMsg(`Active dataset switched to ${file.fileName} (${res.count.toLocaleString()} real foods)!`);
      if (onReloadFoods) {
        onReloadFoods();
      } else if (onImportFoods) {
        const updatedFoods = await api.getFoods();
        onImportFoods(updatedFoods);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to load ${file.fileName}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMasterCombined = async () => {
    setSelectedFile('master_combined');
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await api.resetMasterDataset();
      setSuccessMsg(res.message || `Loaded master integrated dataset (${res.count.toLocaleString()} foods) from /Dataset folder!`);
      if (onReloadFoods) {
        onReloadFoods();
      } else if (onImportFoods) {
        const updatedFoods = await api.getFoods();
        onImportFoods(updatedFoods);
      }
    } catch (err: any) {
      setErrorMsg(`Failed to load master dataset: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Dataset Repository & Classifier Sources
              </h2>
              <p className="text-xs text-slate-500">
                Pre-loaded from the project's <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">/Dataset</code> folder. External uploads disabled.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security policy notice */}
        <div className="mx-6 mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Deterministic Mode:</strong> Arbitrary external dataset uploads are restricted. All model predictions and meal recommendations strictly adhere to the files in the project's <code className="font-mono bg-white px-1 rounded border border-slate-200">/Dataset</code> directory.
          </span>
        </div>

        <div className="p-6 space-y-4">
          {/* Status feedback */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center gap-2 text-emerald-900 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Master Combined Card */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/40 border border-emerald-200 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Full Integrated Master Dataset (12,700+ Foods)</span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                Executes the complete <code className="font-mono font-semibold">build_master</code> &amp; <code className="font-mono font-semibold">finalize_for_mlp</code> pipeline from <span className="font-semibold text-emerald-900">Project.py</span>, merging USDA whole foods with OpenFoodFacts and verified allergen cross-referencing.
              </p>
            </div>
            <button
              onClick={handleLoadMasterCombined}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading && selectedFile === 'master_combined' ? 'animate-spin' : ''}`} />
              <span>Activate Master Dataset</span>
            </button>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-800 mb-2.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-slate-500" />
                <span>Individual Files in /Dataset Folder</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                Click any file to load it individually
              </span>
            </div>

            <div className="space-y-2.5">
              {datasetFiles.map((file) => (
                <div
                  key={file.fileName}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    selectedFile === file.fileName
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-xs text-slate-900 font-mono">
                        {file.fileName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
                        {formatBytes(file.fileSizeBytes)}
                      </span>
                      {file.source === 'healthy_db' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700">
                          USDA Whole Foods
                        </span>
                      )}
                      {file.source === 'openfoodfacts' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700">
                          OpenFoodFacts &amp; Allergens
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      {file.title}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {file.description}
                    </p>
                  </div>

                  <button
                    onClick={() => handleLoadDatasetFile(file)}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-800 transition-colors shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-2xs self-end sm:self-auto"
                  >
                    <span>Load This File</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Integrated with Project.py neural classifier &amp; goal scoring formulas</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-900 shadow-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
