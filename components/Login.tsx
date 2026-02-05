
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { Cpu, Lock, Mail, AlertTriangle, Database } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const { settings, error } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    const success = await login(email, password);
    if (!success) {
      setLocalError('Credenciais inválidas. Tente admin@empresa.com / admin');
    }
  };

  const switchToMockMode = () => {
      if (window.confirm("Isso mudará o sistema para o modo de TESTE (Mock). Dados reais não serão salvos. Deseja continuar?")) {
          localStorage.setItem('app_mode', 'mock');
          window.location.reload();
      }
  };

  const isProdMode = localStorage.getItem('app_mode') === 'prod';

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 p-8 text-center relative">
          <div className="flex justify-center mb-4">
            {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-12 object-contain" />
            ) : (
                <div className="bg-blue-600 p-3 rounded-xl">
                  <Cpu className="text-white h-8 w-8" />
                </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{settings.appName || 'IT Asset 360'}</h1>
          <p className="text-gray-400 mt-2 text-sm">Entre para gerenciar seus ativos de TI</p>
          
          {isProdMode && (
             <div className="absolute top-4 right-4">
                <span className="bg-green-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">PROD</span>
             </div>
          )}
        </div>
        
        <div className="p-8">
          
          {/* Alerta de Erro de Conexão com API */}
          {error && isProdMode && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                      <AlertTriangle size={16} /> Falha de Conexão com API
                  </div>
                  <p className="text-xs text-red-600">Não foi possível conectar ao servidor (Porta 5001). Verifique o Docker ou SQL Server.</p>
                  <button 
                    onClick={switchToMockMode}
                    className="mt-1 bg-white border border-red-300 text-red-700 text-xs py-1.5 rounded hover:bg-red-50 font-semibold"
                  >
                    Usar Modo de Emergência (Mock)
                  </button>
              </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                <input 
                  type="email" 
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute top-3 left-3 text-gray-400 h-5 w-5" />
                <input 
                  type="password" 
                  required
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {localError && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
                {localError}
              </div>
            )}

            <button type="submit" disabled={!!error && isProdMode} className={`w-full font-bold py-3 rounded-lg transition-colors text-white ${!!error && isProdMode ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
              Entrar no Sistema
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center gap-2">
            {!error && isProdMode && (
                <button onClick={switchToMockMode} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Database size={12}/> Alternar para Modo de Teste
                </button>
            )}
            <p className="text-xs text-gray-400">Versão 2.10.0</p>
            <p className="text-xs text-gray-300">Todos os acessos são monitorados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
