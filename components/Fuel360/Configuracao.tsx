import React, { useContext, useState, useEffect } from 'react';
import { DataContext } from './context/DataContext';
import { getFuelConfigHistory } from './services/apiService';
import { LogSistema } from './types';
import { CogIcon, DropIcon, CarIcon, MotoIcon, CheckCircleIcon, ExclamationIcon, SpinnerIcon, ChartBarIcon } from './icons';

const ConfirmSaveModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (motivo: string) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [motivo, setMotivo] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 w-full max-w-md transition-colors">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Confirmar Alterações</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Para fins de auditoria, informe o motivo destas alterações.</p>
                
                <textarea 
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent mb-6 resize-none shadow-sm outline-none"
                    placeholder="Ex: Reajuste anual..."
                    rows={3}
                    autoFocus
                />

                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} disabled={isLoading} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2 px-4 rounded-lg text-sm transition border border-slate-200 dark:border-slate-700">Cancelar</button>
                    <button 
                        onClick={() => onConfirm(motivo)}
                        disabled={!motivo.trim() || isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center shadow-lg shadow-blue-600/20"
                    >
                        {isLoading ? <SpinnerIcon className="w-4 h-4 mr-2"/> : null} Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

const RouteParamsCard: React.FC = () => {
    const { systemConfig, updateSystemConfig } = useContext(DataContext);
    const [alertMaxDailyKM, setAlertMaxDailyKM] = useState(systemConfig.alertMaxDailyKM || 400);
    const [alertMaxClientDist, setAlertMaxClientDist] = useState(systemConfig.alertMaxClientDist || 100);
    const [isSavingRouteParams, setIsSavingRouteParams] = useState(false);
    const [routeParamMsg, setRouteParamMsg] = useState('');

    useEffect(() => {
        setAlertMaxDailyKM(systemConfig.alertMaxDailyKM || 400);
        setAlertMaxClientDist(systemConfig.alertMaxClientDist || 100);
    }, [systemConfig]);

    const handleSaveRouteParams = async () => {
        setIsSavingRouteParams(true);
        setRouteParamMsg('');
        try {
            await updateSystemConfig({
                ...systemConfig,
                alertMaxDailyKM,
                alertMaxClientDist
            });
            setRouteParamMsg('Parâmetros de rota atualizados com sucesso!');
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            setIsSavingRouteParams(false);
            setTimeout(() => setRouteParamMsg(''), 3000);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors">
            <div className="flex items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl mr-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <ChartBarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Parâmetros de Alerta de Rota</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Defina os limites para exibição de alertas no Roteirizador.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/60 rounded-xl">
                    <label className="block text-xs font-bold text-red-700 dark:text-red-400 uppercase mb-2">Limite de KM Diário (Alerta)</label>
                    <div className="flex items-center">
                        <input 
                            type="number" 
                            value={alertMaxDailyKM} 
                            onChange={(e) => setAlertMaxDailyKM(Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-red-200 dark:border-red-800 rounded-xl p-3 focus:ring-2 focus:ring-red-500 font-bold text-lg outline-none"
                        />
                        <span className="ml-3 font-bold text-red-400 dark:text-red-400">km</span>
                    </div>
                    <p className="text-[10px] text-red-600 dark:text-red-300 mt-2">Dias com quilometragem acima deste valor serão marcados como suspeitos.</p>
                </div>

                <div className="p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60 rounded-xl">
                    <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-2">Raio Máximo do Cliente (Alerta)</label>
                    <div className="flex items-center">
                        <input 
                            type="number" 
                            value={alertMaxClientDist} 
                            onChange={(e) => setAlertMaxClientDist(Number(e.target.value))}
                            className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-amber-200 dark:border-amber-800 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 font-bold text-lg outline-none"
                        />
                        <span className="ml-3 font-bold text-amber-400 dark:text-amber-400">km</span>
                    </div>
                    <p className="text-[10px] text-amber-600 dark:text-amber-300 mt-2">Clientes distantes do ponto de partida acima deste valor gerarão alerta.</p>
                </div>
            </div>

            <div className="flex items-center">
                <button onClick={handleSaveRouteParams} disabled={isSavingRouteParams} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center shadow-lg shadow-blue-600/20 transition disabled:opacity-50">
                    {isSavingRouteParams ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>} 
                    Salvar Parâmetros de Rota
                </button>
                {routeParamMsg && <span className="ml-4 text-emerald-600 dark:text-emerald-400 font-bold text-sm animate-pulse">{routeParamMsg}</span>}
            </div>
        </div>
    );
};

export const Configuracao: React.FC = () => {
    const { configReembolso, saveConfigReembolso } = useContext(DataContext);
    const [localConfig, setLocalConfig] = useState(configReembolso);
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
    const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [history, setHistory] = useState<LogSistema[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => { 
        setLocalConfig(configReembolso); 
        loadHistory(); 
    }, [configReembolso]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try { const logs = await getFuelConfigHistory(); setHistory(logs); } catch(e) {} finally { setLoadingHistory(false); }
    };

    const handleFuelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setLocalConfig(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };

    const handleConfirmFuelSave = async (motivo: string) => {
        setIsSaving(true);
        setMessage(null);
        try {
            await saveConfigReembolso({ ...localConfig, MotivoAlteracao: motivo.trim() });
            setMessage({ type: 'success', text: 'Parâmetros atualizados com sucesso!' });
            setIsFuelModalOpen(false);
            loadHistory();
        } catch (e: any) {
            setMessage({ type: 'error', text: 'Erro ao salvar: ' + (e.message || 'Erro desconhecido') });
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-4 space-y-8 pb-10">
            {/* Main Config Card */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors">
                <ConfirmSaveModal isOpen={isFuelModalOpen} onClose={() => setIsFuelModalOpen(false)} onConfirm={handleConfirmFuelSave} isLoading={isSaving} />

                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex items-center mb-8 pb-6 border-b border-slate-100 dark:border-slate-800 relative z-10">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl mr-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <CogIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Parâmetros de Reembolso</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Defina os valores base para o cálculo automático de combustível e médias KM/L.</p>
                    </div>
                </div>

                <div className="space-y-6 relative z-10">
                    {/* Price Input */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group">
                        <div className="flex items-center mb-3">
                            <DropIcon className="w-5 h-5 text-amber-500 mr-2 group-hover:scale-110 transition-transform" />
                            <label className="text-slate-700 dark:text-slate-200 font-bold text-sm uppercase tracking-wide">Preço Combustível (R$)</label>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                            <input 
                                type="number" name="PrecoCombustivel" value={localConfig.PrecoCombustivel} onChange={handleFuelChange} step="0.01"
                                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl p-4 pl-12 text-xl font-bold focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 transition-colors">
                            <div className="flex items-center mb-3">
                                <CarIcon className="w-5 h-5 text-blue-500 mr-2" />
                                <label className="text-slate-700 dark:text-slate-200 font-bold text-sm uppercase tracking-wide">Média Carro (KM/L)</label>
                            </div>
                            <input 
                                type="number" name="KmL_Carro" value={localConfig.KmL_Carro} onChange={handleFuelChange}
                                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-lg font-bold focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none shadow-sm"
                            />
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-orange-500/50 transition-colors">
                            <div className="flex items-center mb-3">
                                <MotoIcon className="w-5 h-5 text-orange-500 mr-2" />
                                <label className="text-slate-700 dark:text-slate-200 font-bold text-sm uppercase tracking-wide">Média Moto (KM/L)</label>
                            </div>
                            <input 
                                type="number" name="KmL_Moto" value={localConfig.KmL_Moto} onChange={handleFuelChange}
                                className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-lg font-bold focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none shadow-sm"
                            />
                        </div>
                    </div>

                    <button onClick={() => setIsFuelModalOpen(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center shadow-lg shadow-blue-600/20 transform hover:-translate-y-0.5 border border-transparent">
                        <CheckCircleIcon className="w-6 h-6 mr-2" /> Salvar Configurações
                    </button>

                    {message && (
                        <div className={`p-4 rounded-xl text-center border flex items-center justify-center text-sm font-bold animate-fade-in ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-200 dark:border-red-800'}`}>
                            {message.type === 'error' && <ExclamationIcon className="w-5 h-5 mr-2"/>} {message.text}
                        </div>
                    )}
                </div>
            </div>

            {/* Parâmetros de Alerta de Rota */}
            <RouteParamsCard />

            {/* History Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-slate-600 dark:text-slate-300 font-bold text-sm uppercase tracking-widest flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Últimas 10 Alterações
                    </h3>
                </div>
                
                {loadingHistory ? (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400"><SpinnerIcon className="w-8 h-8 mx-auto mb-3 text-blue-500"/> Carregando histórico...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-500 dark:text-slate-300">
                            <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase font-semibold text-xs border-b border-slate-200 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 tracking-wider">Data</th>
                                    <th className="px-6 py-4 tracking-wider">Usuário</th>
                                    <th className="px-6 py-4 tracking-wider w-1/2">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {history.length === 0 ? (
                                    <tr><td colSpan={3} className="p-8 text-center text-slate-400 dark:text-slate-500 italic">Nenhum registro encontrado.</td></tr>
                                ) : (
                                    history.map((log) => (
                                        <tr key={log.ID_Log} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {new Date(log.DataHora).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{log.Usuario}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{log.Detalhes}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};