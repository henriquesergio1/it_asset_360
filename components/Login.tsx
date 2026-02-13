
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Cpu, Lock, Mail, AlertTriangle, Database, Loader2 } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const { settings, error, loading } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLocalError('');
    const success = await login(email, password);
    if (!success) {
      setLocalError('Credenciais inválidas. Verifique o e-mail e a senha digitados.');
    }
  };

  const switchToMockMode = () => {
      if (window.confirm("Isso mudará o sistema para o modo de TESTE (Mock). Dados reais não serão salvos. Deseja continuar?")) {
          localStorage.setItem('app_mode', 'mock');
          window.location.reload();
      }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-300 overflow-hidden">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border dark:border-slate-800 transition-all">
        <div className="bg-slate-900 p-6 text-center relative">
          <div className="flex justify-center mb-3">
            {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-10 object-contain" />
            ) : (
                <div className="bg-blue-600 p-2.5 rounded-xl">
                  <Cpu className="text-white h-7 w-7" />
                </div>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">{settings.appName || 'IT Asset 360'}</h1>
          <p className="text-gray-400 mt-1 text-xs uppercase tracking-widest font-medium">Gestão de Ativos</p>
          
          <div className="absolute top-4 right-4">
             <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${loading ? 'bg-slate-700 text-slate-400' : 'bg-green-600 text-white'}`}>
                {loading ? 'AUTO' : 'PROD'}
             </span>
          </div>
        </div>
        
        <div className="p-8">
          
          {/* Alerta de Erro de Conexão com API */}
          {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
                      <AlertTriangle size={16} /> Falha de Sincronização
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-300/80">{error}</p>
                  <button 
                    onClick={switchToMockMode}
                    className="mt-1 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 text-xs py-1.5 rounded hover:bg-red-50 dark:hover:bg-slate-700 font-semibold transition-colors"
                  >
                    Usar Modo de Emergência (Mock)
                  </button>
              </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1 tracking-widest">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                <input 
                  type="email" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 dark:disabled:bg-slate-800/50 disabled:text-gray-400 transition-all text-sm"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-1 ml-1 tracking-widest">Senha</label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 dark:disabled:bg-slate-800/50 disabled:text-gray-400 transition-all text-sm"
                  placeholder="••••••••"
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {localError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs rounded-lg text-center font-bold uppercase tracking-widest">
                {localError}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className={`w-full font-black py-4 rounded-xl transition-all text-white flex items-center justify-center gap-2 uppercase text-xs tracking-[0.2em]
                ${loading ? 'bg-gray-400 dark:bg-slate-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-[0.98]'}`}
            >
              {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin"/> 
                    Conectando ao SQL...
                  </>
              ) : 'Entrar no Sistema'}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 flex flex-col items-center gap-2">
            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Versão 2.12.23</p>
            <p className="text-[9px] font-medium text-gray-300 dark:text-slate-600 uppercase">Ambiente Seguro via SQL Server</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
