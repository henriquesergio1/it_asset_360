
import React, { useState, useEffect } from 'react';
import { getRotaPrevistaHistory, getRotaPrevistaDetails, deleteRotaPrevista, updateRotaPrevistaDiario, getCalculoHistory, getCalculoDetails, updateCalculoDiario, getSimulacaoSugestoes, updateSugestaoStatus } from './services/apiService';
import { RotaPrevistaSaved, RotaPrevistaItem, CalculoSaved, CalculoItem } from './types';
import { ClipboardListIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon, SpinnerIcon, ExclamationIcon, PencilIcon, CheckCircleIcon, XCircleIcon, CalculatorIcon, LocationMarkerIcon } from './icons';
import { Share2, MessageSquare, ExternalLink, Check, X } from 'lucide-react';
import { ShareSimulationModal } from './ShareSimulationModal';

// --- HELPER VISUAL PARA DATA ---
// Evita o problema de D-1 convertendo a string ISO (YYYY-MM-DD) para uma data ao meio-dia local
const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Pega apenas a parte da data YYYY-MM-DD
    const ymd = dateStr.split('T')[0];
    // Cria data forçando 12:00:00 para neutralizar shifts de fuso horário (ex: -3h)
    const date = new Date(ymd + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

// --- HELPER PARA RENDERIZAR TAG DE ORIGEM ---
const renderPeriodWithTag = (period: string) => {
    if (!period) return '-';
    
    const isPromoter = period.includes('[PROMOTOR]');
    const isVendedor = period.includes('[VENDEDOR]');
    
    // Remove as tags do texto para exibição limpa
    const cleanPeriod = period.replace('[PROMOTOR]', '').replace('[VENDEDOR]', '').trim();
    
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
                {isPromoter && (
                    <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
                        Promotor
                    </span>
                )}
                {isVendedor && (
                    <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 text-[9px] font-black px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                        Vendedor
                    </span>
                )}
            </div>
            <span className="font-bold text-slate-800 dark:text-white">{cleanPeriod}</span>
        </div>
    );
};

// --- SUB-COMPONENTE: MODAL DE EDIÇÃO DE KM (GENÉRICO) ---
const EditKmModal: React.FC<{
    isOpen: boolean;
    data: { id: number, km: number, date: string, name: string } | null;
    isFinancial: boolean;
    onClose: () => void;
    onConfirm: (km: number, reason: string) => void;
    isLoading: boolean;
}> = ({ isOpen, data, isFinancial, onClose, onConfirm, isLoading }) => {
    const [km, setKm] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (data) {
            setKm(data.km.toString());
            setReason('');
        }
    }, [data, isOpen]);

    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    {isFinancial ? 'Editar e Recalcular' : 'Editar KM Simulado'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{data.name} - {formatDisplayDate(data.date)}</p>
                
                {isFinancial && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 rounded-lg flex items-start">
                        <ExclamationIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2 mt-0.5 shrink-0"/>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
                            <strong>Atenção:</strong> Esta alteração recalculará automaticamente o valor financeiro do dia, o total do colaborador e o total geral do fechamento. A ação é irreversível e será auditada.
                        </p>
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Novo KM</label>
                    <input 
                        type="number" 
                        step="0.1" 
                        value={km} 
                        onChange={e => setKm(e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 text-lg font-mono font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                </div>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Motivo (Obrigatório)</label>
                    <textarea 
                        value={reason} 
                        onChange={e => setReason(e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                        rows={2}
                        placeholder="Ex: Ajuste após contestação..."
                    />
                </div>

                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700">Cancelar</button>
                    <button 
                        onClick={() => onConfirm(parseFloat(km), reason)} 
                        disabled={isLoading || !km || !reason.trim()} 
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm flex items-center shadow-lg disabled:opacity-50"
                    >
                        {isLoading ? <SpinnerIcon className="w-4 h-4 mr-2"/> : null} Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTE: MODAL DE EXCLUSÃO (APENAS SIMULAÇÃO) ---
const DeleteSimulacaoModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800">
                <div className="w-14 h-14 bg-red-50 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrashIcon className="w-7 h-7 text-red-500 dark:text-red-400"/>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Excluir Simulação?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Isso removerá todo o histórico de rotas deste período. Esta ação não pode ser desfeita.</p>
                
                <textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4"
                    rows={2}
                    placeholder="Motivo da exclusão..."
                    autoFocus
                />

                <div className="flex justify-center space-x-3">
                    <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Cancelar</button>
                    <button 
                        onClick={() => onConfirm(reason)} 
                        disabled={isLoading || !reason.trim()} 
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm flex items-center shadow-lg disabled:opacity-50"
                    >
                        {isLoading ? <SpinnerIcon className="w-4 h-4 mr-2"/> : 'Excluir Definitivamente'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const GestaoSimulacoes: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'SIMULACAO' | 'CALCULO'>('CALCULO');
    
    // Dados de Simulação (Rota Prevista)
    const [simHistory, setSimHistory] = useState<RotaPrevistaSaved[]>([]);
    const [expandedSim, setExpandedSim] = useState<number | null>(null);
    const [simDetails, setSimDetails] = useState<RotaPrevistaItem[]>([]);
    
    // Dados de Cálculo (Financeiro)
    const [calcHistory, setCalcHistory] = useState<CalculoSaved[]>([]);
    const [expandedCalc, setExpandedCalc] = useState<number | null>(null);
    const [calcDetails, setCalcDetails] = useState<CalculoItem[]>([]);

    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    // Modais
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [editData, setEditData] = useState<{ id: number, km: number, date: string, name: string } | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Modal de Compartilhamento para Supervisor
    const [shareModalData, setShareModalData] = useState<{ isOpen: boolean; simId: number; periodo: string; totalKm?: number } | null>(null);

    // Modal de Sugestões de Supervisores
    const [viewingSuggestions, setViewingSuggestions] = useState<{ simId: number; periodo: string; list: any[] } | null>(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [updatingSugestaoId, setUpdatingSugestaoId] = useState<number | null>(null);

    useEffect(() => {
        if (activeTab === 'SIMULACAO') loadSimHistory();
        else loadCalcHistory();
    }, [activeTab]);

    const loadSimHistory = async () => {
        setLoading(true);
        try { const data = await getRotaPrevistaHistory(); setSimHistory(data); } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const loadCalcHistory = async () => {
        setLoading(true);
        try { const data = await getCalculoHistory(); setCalcHistory(data); } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // --- LOGICA SIMULAÇÃO ---
    const toggleExpandSim = async (id: number) => {
        if (expandedSim === id) { setExpandedSim(null); setSimDetails([]); } 
        else {
            setExpandedSim(id); setLoadingDetails(true);
            try { const data = await getRotaPrevistaDetails(id); setSimDetails(data); } 
            catch (e) { alert("Erro ao carregar detalhes."); } finally { setLoadingDetails(false); }
        }
    };

    const handleDeleteSim = async (reason: string) => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            await deleteRotaPrevista(deleteId, reason);
            setDeleteId(null);
            loadSimHistory();
        } catch (e: any) {
            alert(e.message || "Erro ao excluir");
        } finally {
            setIsDeleting(false);
        }
    };

    // --- LOGICA SUGESTÕES DO SUPERVISOR ---
    const handleOpenSuggestionsModal = async (simId: number, periodo: string) => {
        setViewingSuggestions({ simId, periodo, list: [] });
        setLoadingSuggestions(true);
        try {
            const list = await getSimulacaoSugestoes(simId);
            setViewingSuggestions({ simId, periodo, list: list || [] });
        } catch (err: any) {
            alert('Erro ao carregar sugestões: ' + err.message);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleUpdateStatus = async (sugestaoId: number, newStatus: 'PENDENTE' | 'APLICADO' | 'REJEITADO') => {
        setUpdatingSugestaoId(sugestaoId);
        try {
            await updateSugestaoStatus(sugestaoId, newStatus);
            setViewingSuggestions(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    list: prev.list.map(s => s.ID_Sugestao === sugestaoId ? { ...s, Status: newStatus } : s)
                };
            });
        } catch (err: any) {
            alert('Erro ao atualizar status da sugestão: ' + err.message);
        } finally {
            setUpdatingSugestaoId(null);
        }
    };

    // --- LOGICA CÁLCULO ---
    const toggleExpandCalc = async (id: number) => {
        if (expandedCalc === id) { setExpandedCalc(null); setCalcDetails([]); }
        else {
            setExpandedCalc(id); setLoadingDetails(true);
            try { const data = await getCalculoDetails(id); setCalcDetails(data); }
            catch (e) { alert("Erro ao carregar detalhes."); } finally { setLoadingDetails(false); }
        }
    };

    // --- EDIÇÃO UNIFICADA ---
    const handleEditConfirm = async (newKm: number, reason: string) => {
        if (!editData) return;
        setIsEditing(true);
        try {
            if (activeTab === 'SIMULACAO') {
                await updateRotaPrevistaDiario(editData.id, newKm, reason);
                // Reload details and list
                if (expandedSim) { const d = await getRotaPrevistaDetails(expandedSim); setSimDetails(d); }
                loadSimHistory();
            } else {
                await updateCalculoDiario(editData.id, newKm, reason);
                // Reload details and list
                if (expandedCalc) { const d = await getCalculoDetails(expandedCalc); setCalcDetails(d); }
                loadCalcHistory();
            }
            setEditData(null);
        } catch (e: any) {
            alert("Erro ao editar: " + e.message);
        } finally {
            setIsEditing(false);
        }
    };

    // Helper de Agrupamento
    const groupItems = (items: any[], idKey: string) => {
        const groups = new Map<any, { name: string, items: any[], totalKm: number, totalVal?: number }>();
        (items || []).forEach((item: any) => {
            if (!item) return;
            const key = item[idKey] ?? item.ID_Pulsus ?? item.ID_Detalhe ?? item.Nome ?? Math.random();
            if (!groups.has(key)) {
                groups.set(key, { name: item.Nome || 'Sem Nome', items: [], totalKm: 0, totalVal: 0 });
            }
            const g = groups.get(key)!;
            g.items.push(item);
            g.totalKm += Number(item.KM || item.KM_Dia || 0);
            if (item.Valor_Dia !== undefined && item.Valor_Dia !== null) {
                g.totalVal = (g.totalVal || 0) + Number(item.Valor_Dia || 0);
            }
        });
        return Array.from(groups.values());
    };

    const groupedSimDetails = React.useMemo(() => groupItems(simDetails, 'ID_RotaDet'), [simDetails]);
    const groupedCalcDetails = React.useMemo(() => groupItems(calcDetails, 'ID_Detalhe'), [calcDetails]);

    return (
        <div className="space-y-6">
            <EditKmModal 
                isOpen={!!editData} 
                data={editData} 
                isFinancial={activeTab === 'CALCULO'}
                onClose={() => setEditData(null)} 
                onConfirm={handleEditConfirm} 
                isLoading={isEditing} 
            />
            
            <DeleteSimulacaoModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={handleDeleteSim} 
                isLoading={isDeleting} 
            />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Gestão de Simulações e Cálculos</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Auditoria, ajuste e exclusão de históricos.</p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 flex space-x-1 shadow-sm mt-4 md:mt-0 transition-colors">
                    <button 
                        onClick={() => setActiveTab('CALCULO')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'CALCULO' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <CalculatorIcon className="w-4 h-4 mr-2"/> Cálculos Fechados
                    </button>
                    <button 
                        onClick={() => setActiveTab('SIMULACAO')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md flex items-center transition-all ${activeTab === 'SIMULACAO' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        <LocationMarkerIcon className="w-4 h-4 mr-2"/> Simulações de Rota
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[400px] transition-colors">
                {loading ? (
                    <div className="p-20 text-center text-slate-400 dark:text-slate-500"><SpinnerIcon className="w-10 h-10 mx-auto mb-4 text-blue-500"/> Carregando dados...</div>
                ) : (
                    <>
                        {/* --- TABELA DE CÁLCULOS FECHADOS --- */}
                        {activeTab === 'CALCULO' && (
                            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                <thead className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 uppercase font-bold text-xs border-b border-emerald-100 dark:border-emerald-900">
                                    <tr>
                                        <th className="p-5 w-10"></th>
                                        <th className="p-5">Período de Referência</th>
                                        <th className="p-5">Data Fechamento</th>
                                        <th className="p-5">Responsável</th>
                                        <th className="p-5 text-right">Total Pago</th>
                                        <th className="p-5 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {calcHistory.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-slate-400 dark:text-slate-500">Nenhum cálculo fechado encontrado.</td></tr> : 
                                    calcHistory.map(calc => (
                                        <React.Fragment key={calc.ID_Historico}>
                                            <tr onClick={() => toggleExpandCalc(calc.ID_Historico)} className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${expandedCalc === calc.ID_Historico ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}>
                                                <td className="p-5 text-center text-slate-400">{expandedCalc === calc.ID_Historico ? <ChevronDownIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/> : <ChevronRightIcon className="w-5 h-5"/>}</td>
                                                <td className="p-5">
                                                    {renderPeriodWithTag(calc.Periodo)}
                                                    {calc.MotivoEdicao && <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal mt-1 flex items-center"><PencilIcon className="w-3 h-3 mr-1"/> Editado/Recalculado</div>}
                                                </td>
                                                <td className="p-5 font-mono text-xs text-slate-700 dark:text-slate-300">{calc.DataFechamento ? new Date(calc.DataFechamento).toLocaleString('pt-BR') : '-'}</td>
                                                <td className="p-5 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{calc.UsuarioFechamento || '-'}</td>
                                                <td className="p-5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-base">{(Number(calc.TotalGeral) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                <td className="p-5 text-right"><span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded text-[10px] font-bold uppercase border border-emerald-200 dark:border-emerald-800">Fechado</span></td>
                                            </tr>
                                            {expandedCalc === calc.ID_Historico && (
                                                <tr><td colSpan={6} className="p-0 border-b border-emerald-100 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/20">
                                                    <div className="p-6 space-y-4">
                                                        {loadingDetails ? <div className="text-center py-4 text-emerald-600 dark:text-emerald-400"><SpinnerIcon className="w-6 h-6 inline mr-2"/> Carregando detalhes...</div> : 
                                                        groupedCalcDetails.map((group, idx) => (
                                                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-emerald-100 dark:border-emerald-900 overflow-hidden shadow-sm">
                                                                <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/60 flex justify-between items-center border-b border-emerald-100 dark:border-emerald-900">
                                                                    <span className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">{group.name}</span>
                                                                    <div className="flex gap-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                                        <span>Total KM: {(Number(group.totalKm) || 0).toFixed(2)}</span>
                                                                        <span>Valor: {(Number(group.totalVal) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-0">
                                                                    {group.items.sort((a, b) => new Date(a.DataOcorrencia).getTime() - new Date(b.DataOcorrencia).getTime()).map((day: any) => (
                                                                        <div key={day.ID_Diario} className="p-3 border-r border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col justify-between h-full relative group">
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-bold mb-1">{formatDisplayDate(day.DataOcorrencia)}</p>
                                                                                <p className="text-sm font-black text-slate-700 dark:text-white">{(Number(day.KM_Dia) || 0).toFixed(2)} km</p>
                                                                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{(Number(day.Valor_Dia) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                                            </div>
                                                                            <button 
                                                                                onClick={() => setEditData({ id: day.ID_Diario, km: Number(day.KM_Dia || 0), date: day.DataOcorrencia, name: group.name })} 
                                                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 p-1 rounded transition-all"
                                                                                title="Editar e Recalcular"
                                                                            >
                                                                                <PencilIcon className="w-3 h-3"/>
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td></tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* --- TABELA DE SIMULAÇÕES --- */}
                        {activeTab === 'SIMULACAO' && (
                            <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                                <thead className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 uppercase font-bold text-xs border-b border-indigo-100 dark:border-indigo-900">
                                    <tr>
                                        <th className="p-5 w-10"></th>
                                        <th className="p-5">Período Simulado</th>
                                        <th className="p-5">Data Criação</th>
                                        <th className="p-5">Criado Por</th>
                                        <th className="p-5 text-right">Total KM</th>
                                        <th className="p-5 text-right">Status</th>
                                        <th className="p-5 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {simHistory.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-slate-400 dark:text-slate-500">Nenhuma simulação encontrada.</td></tr> : 
                                    simHistory.map(sim => (
                                        <React.Fragment key={sim.ID_RotaHist}>
                                            <tr onClick={() => toggleExpandSim(sim.ID_RotaHist)} className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${expandedSim === sim.ID_RotaHist ? 'bg-slate-50 dark:bg-slate-800/60' : ''}`}>
                                                <td className="p-5 text-center text-slate-400">{expandedSim === sim.ID_RotaHist ? <ChevronDownIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/> : <ChevronRightIcon className="w-5 h-5"/>}</td>
                                                <td className="p-5">
                                                    {renderPeriodWithTag(sim.Periodo)}
                                                    {sim.Descricao && (
                                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 italic">
                                                            "{sim.Descricao}"
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="p-5 font-mono text-xs text-slate-700 dark:text-slate-300">{sim.DataSimulacao ? new Date(sim.DataSimulacao).toLocaleString('pt-BR') : '-'}</td>
                                                <td className="p-5 text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{sim.UsuarioSimulacao || '-'}</td>
                                                <td className="p-5 text-right font-bold text-indigo-600 dark:text-indigo-400 font-mono">{(Number(sim.TotalKM) || 0).toFixed(2)} km</td>
                                                <td className="p-5 text-right">
                                                    {sim.JaCalculado ? 
                                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-[10px] font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 uppercase flex items-center w-fit ml-auto">Vinculado</span> : 
                                                        <span className="bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800 uppercase flex items-center w-fit ml-auto">Livre</span>
                                                    }
                                                </td>
                                                <td className="p-5 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setShareModalData({ 
                                                                    isOpen: true, 
                                                                    simId: sim.ID_RotaHist, 
                                                                    periodo: sim.Periodo, 
                                                                    totalKm: Number(sim.TotalKM) || 0 
                                                                }); 
                                                            }} 
                                                            className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition"
                                                            title="Link de Revisão para Supervisor"
                                                        >
                                                            <Share2 className="w-4 h-4"/>
                                                        </button>

                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                handleOpenSuggestionsModal(sim.ID_RotaHist, sim.Periodo); 
                                                            }} 
                                                            className="text-slate-400 hover:text-amber-600 p-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                                                            title="Ver Sugestões do Supervisor"
                                                        >
                                                            <MessageSquare className="w-4 h-4"/>
                                                        </button>

                                                        {!sim.JaCalculado ? (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setDeleteId(sim.ID_RotaHist); }} 
                                                                className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                                                title="Excluir Simulação"
                                                            >
                                                                <TrashIcon className="w-4 h-4"/>
                                                            </button>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-xs cursor-not-allowed ml-1" title="Não pode excluir pois já foi calculada">Bloqueado</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedSim === sim.ID_RotaHist && (
                                                <tr><td colSpan={7} className="p-0 border-b border-indigo-100 dark:border-indigo-900 bg-indigo-50/20 dark:bg-indigo-950/20">
                                                    <div className="p-6 space-y-4">
                                                        {loadingDetails ? <div className="text-center py-4 text-indigo-600 dark:text-indigo-400"><SpinnerIcon className="w-6 h-6 inline mr-2"/> Carregando detalhes...</div> : 
                                                        groupedSimDetails.map((group, idx) => (
                                                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 overflow-hidden shadow-sm">
                                                                <div className="px-4 py-3 bg-indigo-50 dark:bg-indigo-950/60 flex justify-between items-center border-b border-indigo-100 dark:border-indigo-900">
                                                                    <span className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">{group.name}</span>
                                                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Total: {(Number(group.totalKm) || 0).toFixed(2)} km</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-0">
                                                                    {group.items.sort((a, b) => new Date(a.DataVisita).getTime() - new Date(b.DataVisita).getTime()).map((day: any) => (
                                                                        <div key={day.ID_RotaDia} className="p-3 border-r border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex flex-col justify-between h-full relative group">
                                                                            <div>
                                                                                <p className="text-[10px] text-slate-400 dark:text-slate-400 uppercase font-bold mb-1">{formatDisplayDate(day.DataVisita)}</p>
                                                                                <p className="text-sm font-black text-slate-700 dark:text-white">{(Number(day.KM) || 0).toFixed(2)} km</p>
                                                                            </div>
                                                                            {!sim.JaCalculado && (
                                                                                <button 
                                                                                    onClick={() => setEditData({ id: day.ID_RotaDia, km: Number(day.KM || 0), date: day.DataVisita, name: group.name })} 
                                                                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-700 p-1 rounded transition-all"
                                                                                    title="Editar KM"
                                                                                >
                                                                                    <PencilIcon className="w-3 h-3"/>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td></tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                )}
            </div>

            {/* Modal de Compartilhamento para Supervisor */}
            {shareModalData && (
                <ShareSimulationModal
                    isOpen={shareModalData.isOpen}
                    onClose={() => setShareModalData(null)}
                    simId={shareModalData.simId}
                    periodo={shareModalData.periodo}
                    totalKm={shareModalData.totalKm}
                />
            )}

            {/* Modal de Sugestões de Supervisores */}
            {viewingSuggestions && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                                    Sugestões do Supervisor
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Simulação #{viewingSuggestions.simId} &bull; {viewingSuggestions.periodo}
                                </p>
                            </div>
                            <button 
                                onClick={() => setViewingSuggestions(null)} 
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {loadingSuggestions ? (
                                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                                    <SpinnerIcon className="w-8 h-8 mx-auto mb-2 text-indigo-500 animate-spin" />
                                    Carregando apontamentos dos supervisores...
                                </div>
                            ) : viewingSuggestions.list.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium text-sm">Nenhum apontamento ou sugestão registrada pelo supervisor para esta simulação.</p>
                                    <p className="text-xs text-slate-400 mt-1">Compartilhe o link da rota com o supervisor para que ele possa enviar sugestões.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {viewingSuggestions.list.map((sug: any) => {
                                        const isPendente = (sug.Status || 'PENDENTE') === 'PENDENTE';
                                        const isAplicado = sug.Status === 'APLICADO';
                                        const isRejeitado = sug.Status === 'REJEITADO';

                                        return (
                                            <div 
                                                key={sug.ID_Sugestao} 
                                                className={`p-4 rounded-xl border transition-all ${
                                                    isAplicado ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50' :
                                                    isRejeitado ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 opacity-60' :
                                                    'bg-white dark:bg-slate-850 border-amber-200 dark:border-amber-900/60 shadow-sm'
                                                }`}
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-bold text-slate-800 dark:text-white text-sm">
                                                            {sug.SupervisorNome || 'Supervisor'}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            {sug.DataCriacao ? new Date(sug.DataCriacao).toLocaleString('pt-BR') : '-'}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                            sug.TipoAjuste === 'MUDANCA_DIA' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                                            sug.TipoAjuste === 'MUDANCA_SEMANA' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                                            sug.TipoAjuste === 'CLIENTE_EXCLUSIVO' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                                                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                        }`}>
                                                            {sug.TipoAjuste === 'MUDANCA_DIA' ? 'Mudança de Dia' :
                                                             sug.TipoAjuste === 'MUDANCA_SEMANA' ? 'Mudança de Semana' :
                                                             sug.TipoAjuste === 'CLIENTE_EXCLUSIVO' ? 'Dia Específico' : sug.TipoAjuste || 'Geral'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                            isAplicado ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                                                            isRejeitado ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' :
                                                            'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                                        }`}>
                                                            {sug.Status || 'PENDENTE'}
                                                        </span>

                                                        <div className="flex items-center gap-1">
                                                            {!isAplicado && (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(sug.ID_Sugestao, 'APLICADO')}
                                                                    disabled={updatingSugestaoId === sug.ID_Sugestao}
                                                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 dark:text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                                                                    title="Marcar como Aplicado"
                                                                >
                                                                    <Check className="w-3.5 h-3.5" />
                                                                    <span className="hidden sm:inline">Aplicar</span>
                                                                </button>
                                                            )}
                                                            {!isRejeitado && (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(sug.ID_Sugestao, 'REJEITADO')}
                                                                    disabled={updatingSugestaoId === sug.ID_Sugestao}
                                                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/50 dark:hover:bg-red-900 dark:text-red-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                                                                    title="Rejeitar Sugestão"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                    <span className="hidden sm:inline">Rejeitar</span>
                                                                </button>
                                                            )}
                                                            {!isPendente && (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(sug.ID_Sugestao, 'PENDENTE')}
                                                                    disabled={updatingSugestaoId === sug.ID_Sugestao}
                                                                    className="p-1.5 text-slate-400 hover:text-slate-600 text-xs font-semibold transition"
                                                                    title="Reverter para Pendente"
                                                                >
                                                                    Reabrir
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Detalhes do Cliente e Vendedor */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-2">
                                                    <div>
                                                        <span className="text-slate-400">Cliente: </span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-200">
                                                            {sug.Cod_Cliente ? `#${sug.Cod_Cliente} - ` : ''}{sug.ClienteNome || 'Geral do Setor'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Vendedor: </span>
                                                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                            {sug.VendedorNome || '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* De -> Para de Dias / Semanas */}
                                                {(sug.DiaAtual || sug.DiaSugerido || sug.SemanaAtual || sug.SemanaSugerida) && (
                                                    <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-800/70 p-2 rounded-lg mb-2">
                                                        {sug.DiaSugerido && (
                                                            <div>
                                                                <span className="text-slate-400">Dia: </span>
                                                                <span className="line-through text-slate-400 mr-1">{sug.DiaAtual || 'Não inf.'}</span>
                                                                <span className="font-bold text-blue-600 dark:text-blue-400">&rarr; {sug.DiaSugerido}</span>
                                                            </div>
                                                        )}
                                                        {sug.SemanaSugerida && (
                                                            <div>
                                                                <span className="text-slate-400">Semana: </span>
                                                                <span className="line-through text-slate-400 mr-1">{sug.SemanaAtual || 'Não inf.'}</span>
                                                                <span className="font-bold text-purple-600 dark:text-purple-400">&rarr; {sug.SemanaSugerida}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Observação */}
                                                <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                                    <p className="font-medium">{sug.Observacao}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl flex justify-between items-center">
                            <span className="text-xs text-slate-400">
                                Total: {viewingSuggestions.list.length} sugestão(ões)
                            </span>
                            <button
                                onClick={() => setViewingSuggestions(null)}
                                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-bold transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
