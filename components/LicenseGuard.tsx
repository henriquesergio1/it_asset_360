
import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { ShieldAlert, Key, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export const LicenseGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getLicenseStatus, updateLicense } = useData();
  const [status, setStatus] = useState<{ status: 'ACTIVE' | 'EXPIRED' | 'LOADING', client: string, expiresAt: string | null }>({
    status: 'LOADING',
    client: '',
    expiresAt: null
  });
  const [licenseKey, setLicenseKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await getLicenseStatus();
      setStatus(res);
    } catch (error) {
      console.error("Erro ao verificar licença:", error);
      setStatus({ status: 'EXPIRED', client: 'Erro de Conexão', expiresAt: null });
    }
  }, [getLicenseStatus]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    setIsUpdating(true);
    setMessage(null);

    try {
      const res = await updateLicense(licenseKey);
      if (res.success) {
        setMessage({ text: 'Licença ativada com sucesso! Reiniciando...', type: 'success' });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage({ text: res.error || 'Chave de licença inválida.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Erro ao processar ativação.', type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  if (status.status === 'LOADING') {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[9999]">
        <Loader2 className="text-blue-500 animate-spin mb-4" size={48} />
        <p className="text-slate-400 font-medium animate-pulse">Validando Licença de Uso...</p>
      </div>
    );
  }

  if (status.status === 'EXPIRED') {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[9999] p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-900/30 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="bg-red-600/10 p-8 text-center border-b border-red-900/20">
            <div className="bg-red-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-600/20">
              <ShieldAlert className="text-white" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">Sistema Bloqueado</h2>
            <p className="text-red-400 mt-2 text-sm font-medium">Sua licença de uso expirou ou é inválida.</p>
          </div>

          <div className="p-8">
            <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-500 uppercase font-bold tracking-wider">Cliente</span>
                <span className="text-slate-300 font-bold">{status.client || 'Nenhum'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 uppercase font-bold tracking-wider">Expiração</span>
                <span className="text-red-400 font-bold">{status.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : 'Expirada'}</span>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">Nova Chave de Ativação</label>
                <div className="relative">
                  <Key className="absolute top-3 left-3 text-slate-500" size={18} />
                  <textarea
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-slate-100 text-sm focus:ring-2 focus:ring-blue-600 outline-none transition-all min-h-[100px] resize-none font-mono"
                    placeholder="Cole aqui seu token JWT de licença..."
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              {message && (
                <div className={`p-3 rounded-lg flex items-center gap-3 text-sm font-medium animate-in slide-in-from-top-2 ${
                  message.type === 'success' ? 'bg-green-900/20 text-green-400 border border-green-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdating || !licenseKey.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:grayscale text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Key size={20} />}
                {isUpdating ? 'Validando...' : 'Ativar Sistema'}
              </button>
            </form>

            <p className="text-center text-[10px] text-slate-500 mt-8 uppercase tracking-[0.2em]">
              Entre em contato com o administrador para renovação.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
