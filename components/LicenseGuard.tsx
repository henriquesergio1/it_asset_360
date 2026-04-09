
import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { ShieldAlert, Key, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const LicenseGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getLicenseStatus, updateLicense, isReadOnly } = useData();
  const [status, setStatus] = useState<{ status: 'ACTIVE' | 'EXPIRED' | 'LOADING', client: string, expiresAt: string | null }>({
    status: 'LOADING',
    client: '',
    expiresAt: null
  });
  const [licenseKey, setLicenseKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  return (
    <>
      {isReadOnly && (
        <div className="bg-amber-600 text-white px-6 py-2 flex items-center justify-between z-[100] sticky top-0 shadow-lg animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3">
            <ShieldAlert size={18} className="animate-pulse" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <span className="text-xs font-black uppercase tracking-widest">Sistema em Modo Consulta</span>
              <span className="text-[10px] opacity-90 font-medium">Sua licença expirou ou não foi localizada. Ações de escrita estão desabilitadas.</span>
            </div>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-white text-amber-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 transition-colors shadow-sm"
          >
            Ativar Agora
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-slate-800 px-8 py-6 flex justify-between items-center border-b border-slate-700">
              <div className="flex items-center gap-3">
                <Key className="text-blue-400" size={20} />
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">Ativar Licença</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <Loader2 size={24} className="rotate-45" /> {/* Usando Loader2 rotacionado como X improvisado se não tiver X importado, mas vou importar X */}
              </button>
            </div>

            <div className="p-8">
              <form onSubmit={handleUpdate} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2 ml-1">Chave de Ativação (JWT)</label>
                  <textarea
                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-slate-100 text-sm focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none font-mono"
                    placeholder="Cole aqui seu token de licença..."
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    disabled={isUpdating}
                  />
                </div>

                {message && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-in slide-in-from-top-2 ${
                    message.type === 'success' ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900/50' : 'bg-red-900/20 text-red-400 border border-red-900/50'
                  }`}>
                    {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase text-[10px] tracking-widest py-4 rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || !licenseKey.trim()}
                    className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black uppercase text-[10px] tracking-widest py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                    {isUpdating ? 'Validando...' : 'Ativar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {children}
    </>
  );
};

