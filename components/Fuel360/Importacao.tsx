
import { UploadIcon, DropIcon, CarIcon, MotoIcon, PrinterIcon, ExclamationIcon, CheckCircleIcon, SpinnerIcon, DocumentReportIcon, CalculatorIcon, ChevronDownIcon, ChevronRightIcon, PencilIcon, ArrowRightIcon, CalendarIcon, UsersIcon, PlusCircleIcon, ChevronUpIcon, ChartBarIcon, RefreshIcon, XCircleIcon, LocationMarkerIcon, UserGroupIcon } from './icons';
import React, { useState, useContext, useMemo } from 'react';
import { DataContext } from './context/DataContext';
import { CalculoReembolso, RegistroKM, SalvarCalculoPayload, StagingRecord, Colaborador, Ausencia, RotaPrevistaSaved } from './types';
import { saveCalculo, checkCalculoExists, getAusencias, getSugestoesVinculo, getRotaPrevistaHistory, getRotaPrevistaDetails, getOSRMData, calcDistance } from './services/apiService';
import Papa from 'papaparse';

// --- SUB-COMPONENTE: MODAL DE EDIÇÃO DE KM ---
const EditKmModal: React.FC<{
    isOpen: boolean;
    record: StagingRecord | null;
    onClose: () => void;
    onSave: (id: string, newKm: number, reason: string) => void;
}> = ({ isOpen, record, onClose, onSave }) => {
    const [km, setKm] = useState<string>('');
    const [reason, setReason] = useState('');

    React.useEffect(() => {
        if (record) {
            setKm(record.kmConsiderado.toString());
            setReason(record.editReason || '');
        } else {
            setKm('');
            setReason('');
        }
    }, [record, isOpen]);

    if (!isOpen || !record) return null;

    const handleConfirm = () => {
        const val = parseFloat(km.replace(',', '.'));
        if (isNaN(val) || val < 0) {
            alert("Valor de KM inválido.");
            return;
        }
        if (!reason.trim()) {
            alert("A justificativa é obrigatória para auditoria.");
            return;
        }
        onSave(record.id, val, reason);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Ajuste Manual de KM</h3>
                <p className="text-xs text-slate-500 mb-4">{record.nome} - {record.dataOriginal}</p>
                
                <div className="mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Novo KM</label>
                    <input 
                        type="number" 
                        step="0.1"
                        value={km}
                        onChange={e => setKm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-lg font-bold font-mono focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Justificativa (Obrigatório)</label>
                    <textarea 
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none resize-none"
                        placeholder="Ex: Erro GPS, Rota alternativa..."
                        rows={3}
                    />
                </div>

                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200">Cancelar</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-md">Confirmar Ajuste</button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL DE SELEÇÃO DE ROTA PREVISTA ---
const RouteSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (rotaId: number, periodo: string) => void;
}> = ({ isOpen, onClose, onSelect }) => {
    const [history, setHistory] = useState<RotaPrevistaSaved[]>([]);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setLoading(true);
            getRotaPrevistaHistory().then(setHistory).catch(() => {}).finally(() => setLoading(false));
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70]">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-3xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-800">Selecione uma Simulação Salva</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><XCircleIcon className="w-6 h-6 text-slate-400"/></button>
                </div>
                
                {loading ? <div className="p-10 text-center"><SpinnerIcon className="w-10 h-10 mx-auto text-blue-600"/></div> : (
                    <div className="max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-xs sticky top-0">
                                <tr>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Período</th>
                                    <th className="p-3">Gerado em</th>
                                    <th className="p-3 text-right">Total KM</th>
                                    <th className="p-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {history.map(item => (
                                    <tr key={item.ID_RotaHist} className={`hover:bg-blue-50 transition-colors ${item.JaCalculado ? 'bg-slate-50 opacity-90' : ''}`}>
                                        <td className="p-3">
                                            {item.JaCalculado ? 
                                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded border border-emerald-200 uppercase">Calculado</span> : 
                                                <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded border border-slate-300 uppercase">Pendente</span>
                                            }
                                        </td>
                                        <td className="p-3 font-bold text-slate-700">{item.Periodo}</td>
                                        <td className="p-3 font-mono text-xs">{new Date(item.DataSimulacao).toLocaleString('pt-BR')}</td>
                                        <td className="p-3 text-right font-mono">{item.TotalKM.toFixed(1)} km</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => onSelect(item.ID_RotaHist, item.Periodo)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 shadow-sm active:scale-95 transition-all">Carregar</button>
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Nenhuma simulação salva encontrada.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- NOVO SUB-COMPONENTE: MODAL DE EFETIVIDADE EM MASSA ---
const EffectivenessModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onApply: (data: Record<number, number>) => void;
}> = ({ isOpen, onClose, onApply }) => {
    const [rawText, setRawText] = useState('');
    const [preview, setPreview] = useState<{setor: number, perc: number}[]>([]);

    // Parser em tempo real
    React.useEffect(() => {
        const lines = rawText.split('\n');
        const results: {setor: number, perc: number}[] = [];
        lines.forEach(line => {
            // Regex para pegar 2 números na linha (Setor e Percentual)
            const matches = line.match(/(\d+)/g);
            if (matches && matches.length >= 2) {
                const setor = parseInt(matches[0]);
                // Trata percentuais como 80 ou 0.8
                let perc = parseFloat(matches[1].replace(',', '.'));
                if (perc > 1.1) perc = perc / 100; // Se digitou 80, vira 0.8. Se digitou 0.8, mantém.
                if (!isNaN(setor) && !isNaN(perc)) {
                    results.push({setor, perc});
                }
            }
        });
        setPreview(results);
    }, [rawText]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        const map: Record<number, number> = {};
        preview.forEach(p => map[p.setor] = p.perc);
        onApply(map);
        setRawText('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70]">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center"><ChartBarIcon className="w-6 h-6 mr-2 text-indigo-600"/> Aplicar Efetividade por Setor</h3>
                        <p className="text-sm text-slate-500">Cole os dados do Excel ou digite no formato: <b>Código - Percentual</b></p>
                    </div>
                    {/* Added XCircleIcon to imports above to fix find name error */}
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2"><XCircleIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
                    <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Entrada de Dados</label>
                        <textarea 
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            className="flex-1 w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            placeholder={"101 - 80%\n102 - 50%\n103 - 99,5%"}
                        />
                    </div>
                    <div className="flex flex-col h-full">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Prévia de Processamento ({preview.length})</label>
                        <div className="flex-1 bg-slate-50 border border-slate-300 rounded-xl overflow-y-auto">
                            {preview.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-xs italic p-4 text-center">Nenhum dado válido detectado na entrada.</div>
                            ) : (
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-200 sticky top-0">
                                        <tr><th className="p-2">Setor</th><th className="p-2 text-right">Efetividade</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {preview.map((p, i) => (
                                            <tr key={i} className="hover:bg-indigo-50">
                                                <td className="p-2 font-bold">{p.setor}</td>
                                                <td className="p-2 text-right text-indigo-600 font-bold">{(p.perc * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end space-x-3 pt-6 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition">Cancelar</button>
                    <button 
                        onClick={handleConfirm}
                        disabled={preview.length === 0}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        Aplicar a {preview.length} Setores
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTE: MODAL DE MERGE MANUAL (Troca de Aparelho) ---
const MergeModal: React.FC<{
    isOpen: boolean;
    data: { id: number, nome: string } | null;
    colaboradores: Colaborador[];
    onClose: () => void;
    onConfirm: (targetColabId: number) => void;
}> = ({ isOpen, data, colaboradores, onClose, onConfirm }) => {
    const [selectedColab, setSelectedColab] = useState('');
    
    if (!isOpen || !data) return null;

    const handleSubmit = () => {
        if (!selectedColab) return alert("Selecione um colaborador.");
        onConfirm(Number(selectedColab));
        setSelectedColab('');
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                     <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center">Vincular Registro (Merge)</h3>
                <p className="text-xs text-slate-500 text-center mb-6">
                    O ID <b>{data.id}</b> será unificado ao colaborador selecionado abaixo. Use isso em caso de troca de aparelho.
                </p>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Destino (Colaborador Ativo)</label>
                    <select 
                        value={selectedColab} 
                        onChange={e => setSelectedColab(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                        <option value="">Selecione...</option>
                        {colaboradores.sort((a,b) => a.Nome.localeCompare(b.Nome)).map(c => (
                            <option key={c.ID_Colaborador} value={c.ID_Colaborador}>{c.Nome} (ID: {c.ID_Pulsus})</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200">Cancelar</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 shadow-md">Confirmar Vínculo</button>
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTE: MODAL DE AUSÊNCIA RÁPIDA ---
const QuickAbsenceModal: React.FC<{
    isOpen: boolean;
    data: { colabId: number; name: string; date: string } | null;
    onClose: () => void;
    onConfirm: (dtInicio: string, dtFim: string, motivo: string) => Promise<void>;
}> = ({ isOpen, data, onClose, onConfirm }) => {
    const [dtInicio, setDtInicio] = useState('');
    const [dtFim, setDtFim] = useState('');
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (data) {
            setDtInicio(data.date);
            setDtFim(data.date);
            setMotivo('');
        }
    }, [data, isOpen]);

    const handleSubmit = async () => {
        if (!motivo) return alert('Selecione um motivo.');
        if (!dtInicio || !dtFim) return alert('Datas obrigatórias.');
        
        setLoading(true);
        await onConfirm(dtInicio, dtFim, motivo);
        setLoading(false);
    };

    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70]">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 w-full max-w-sm">
                <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-full mx-auto mb-4">
                    <CalendarIcon className="w-6 h-6 text-red-500"/>
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Registrar Ausência</h3>
                <p className="text-xs text-slate-500 text-center mb-6">Colaborador: <b>{data.name}</b></p>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label>
                        <input type="date" value={dtInicio} onChange={e => setDtInicio(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fim</label>
                        <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm"/>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo</label>
                    <select value={motivo} onChange={e => setMotivo(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">Selecione...</option>
                        <option value="Férias">Férias</option>
                        <option value="Atestado Médico">Atestado Médico</option>
                        <option value="Falta Justificada">Falta Justificada</option>
                        <option value="Falta Injustificada">Falta Injustificada</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>

                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} disabled={loading} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-200">Cancelar</button>
                    <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 shadow-md flex items-center">
                        {loading ? <SpinnerIcon className="w-4 h-4 mr-2"/> : null} Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

import ReportPrint from './ReportPrint';

// --- COMPONENTE PRINCIPAL ---
export const Importacao: React.FC = () => {
    const { colaboradores, configReembolso, ausencias, logSystemAction, refreshData, addAusencia, systemConfig } = useContext(DataContext);
    
    // Steps: 1=Upload, 2=Conferencia/Edicao, 3=Final/Salvar
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Data Stores
    const [stagingData, setStagingData] = useState<StagingRecord[]>([]);
    const [ignoredList, setIgnoredList] = useState<{id: number, nome: string, rawRows: any[]}[]>([]);
    const [calculoFinal, setCalculoFinal] = useState<CalculoReembolso[]>([]);
    const [smartSuggestions, setSmartSuggestions] = useState<{id: number, nomeHist: string, grupoHist: string, targetColab: Colaborador}[]>([]);
    const [dataSourceType, setDataSourceType] = useState<'CSV' | 'ROTEIRIZADOR' | 'CICLO'>('CSV');
    
    // NOVO: Armazena o ID da simulação selecionada para vínculo forte
    const [selectedRotaId, setSelectedRotaId] = useState<number | null>(null);
    
    // UI States
    const [isProcessing, setIsProcessing] = useState(false);
    const [periodo, setPeriodo] = useState('');
    const [expandedColabs, setExpandedColabs] = useState<Set<number>>(new Set());
    const [ignoredExpanded, setIgnoredExpanded] = useState(false); 
    
    // Filters (New)
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [sortBy, setSortBy] = useState<'NOME' | 'SETOR'>('NOME');
    const [isRefreshingAbsences, setIsRefreshingAbsences] = useState(false);
    
    // SELEÇÃO (NOVO)
    const [selectedPulsusIds, setSelectedPulsusIds] = useState<Set<number>>(new Set());

    // Saving
    const [isSaving, setIsSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const [showReport, setShowReport] = useState(false);

    // Modals
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState<StagingRecord | null>(null);
    const [effModalOpen, setEffModalOpen] = useState(false);
    const [routeModalOpen, setRouteModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [meetingDate, setMeetingDate] = useState('');

    // Merge Modal
    const [mergeModalOpen, setMergeModalOpen] = useState(false);
    const [mergeTarget, setMergeTarget] = useState<{id: number, nome: string} | null>(null);

    // Quick Absence Modal
    const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
    const [targetQuickAbsence, setTargetQuickAbsence] = useState<{ colabId: number, name: string, date: string } | null>(null);

    // Helper: Create Date from YYYY-MM-DD
    const createDateFromYmd = (ymd: string): Date => {
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    
    // Helper: Normalize Date
    const toIsoDateKey = (input: string | Date): string | null => {
        if (!input) return null;
        const s = input.toString().trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        if (s.includes('T')) return s.split('T')[0];
        const normalizedS = s.replace(/-/g, '/').replace(/\./g, '/');
        if (normalizedS.includes('/')) {
             const parts = normalizedS.split('/');
             if (parts.length === 3) {
                 const d = parts[0].padStart(2, '0');
                 const m = parts[1].padStart(2, '0');
                 const y = parts[2];
                 const fullYear = y.length === 2 ? `20${y}` : y;
                 return `${fullYear}-${m}-${d}`;
             }
        }
        return null;
    };

    // --- CARREGAR DE ROTA PREVISTA (NOVO) ---
    const handleRouteSelect = async (rotaId: number, periodoRota: string) => {
        setRouteModalOpen(false);
        setIsProcessing(true);
        setDataSourceType('ROTEIRIZADOR');
        setPeriodo(periodoRota);
        setSelectedRotaId(rotaId); // Armazena o ID para vínculo forte
        
        // Reset
        setStagingData([]);
        setIgnoredList([]);
        setCalculoFinal([]);
        setSavedSuccess(false);
        setStep(1);
        setIgnoredExpanded(false);
        setSmartSuggestions([]);
        setSelectedPulsusIds(new Set());

        try {
            const details = await getRotaPrevistaDetails(rotaId);
            
            // Converter detalhes da API para o formato StagingRecord (simulando a importação do CSV)
            const tempStaging: StagingRecord[] = [];
            
            details.forEach((item, idx) => {
                const id = item.ID_Pulsus;
                const km = item.KM;
                const dateStr = item.DataVisita.substring(0, 10);
                const csvDateKey = dateStr;

                const colab = colaboradores.find(c => c.ID_Pulsus === id);
                if (colab) {
                    const check = checkAbsence(colab.ID_Colaborador, csvDateKey, ausencias);
                    
                    let isBlocked = check.isBlocked;
                    let blockReason = check.reason;

                    // Bloqueio se inativo ou Sem Veículo / VT
                    if (!colab.Ativo) {
                        isBlocked = true;
                        blockReason = "CADASTRO INATIVO";
                    } else if (colab.TipoVeiculo === 'Sem Veículo / VT') {
                        isBlocked = true;
                        blockReason = "SEM VEÍCULO / VT";
                    }

                    tempStaging.push({
                        id: `ROUTE-${id}-${idx}`,
                        id_pulsus: id,
                        nome: item.Nome,
                        dataOriginal: dateStr,
                        dataISO: dateStr,
                        kmOriginal: km,
                        kmConsiderado: isBlocked ? 0 : km,
                        efetividade: 1.0,
                        isLowKm: !isBlocked && km < 1,
                        isBlocked: isBlocked,
                        blockReason: blockReason,
                        isEdited: false,
                        colaboradorRef: colab,
                        supervisor: '' 
                    });
                }
            });

            setStagingData(tempStaging);
            // Marcar todos como selecionados inicialmente
            setSelectedPulsusIds(new Set(tempStaging.map(i => i.id_pulsus)));

            if (tempStaging.length > 0) setStep(2);
            else alert("Nenhum dado válido encontrado nesta simulação.");

        } catch (e: any) {
            alert("Erro ao carregar rota prevista: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- CÁLCULO REUNIÃO DE CICLO (NOVO) ---
    const handleMeetingStart = async () => {
        if (!meetingDate) return alert("Selecione a data da reunião.");
        if (!systemConfig.headquartersLat || !systemConfig.headquartersLong) {
            return alert("O endereço da sede não está configurado ou não possui coordenadas lat/long. Vá em Administração > Empresa para configurar.");
        }

        setMeetingModalOpen(false);
        setIsProcessing(true);
        setDataSourceType('CICLO');
        setPeriodo(`Reunião Ciclo - ${meetingDate.split('-').reverse().join('/')}`);
        setSelectedRotaId(null);

        // Reset
        setStagingData([]);
        setIgnoredList([]);
        setCalculoFinal([]);
        setSavedSuccess(false);
        setStep(1);
        setSelectedPulsusIds(new Set());

        try {
            const tempStaging: StagingRecord[] = [];
            const activeColabs = colaboradores.filter(c => c.Ativo);

            for (const colab of activeColabs) {
                if (colab.LatitudeBase && colab.LongitudeBase) {
                    // Simula pontos para OSRM: Casa -> Sede
                    const points = [
                        { Lat: colab.LatitudeBase, Long: colab.LongitudeBase } as any,
                        { Lat: systemConfig.headquartersLat, Long: systemConfig.headquartersLong } as any
                    ];

                    const osrm = await getOSRMData(points, true); // true = Round trip
                    const dist = osrm ? osrm.distance : calcDistance(colab.LatitudeBase, colab.LongitudeBase, systemConfig.headquartersLat, systemConfig.headquartersLong) * 2;

                    const check = checkAbsence(colab.ID_Colaborador, meetingDate, ausencias);

                    let isBlocked = check.isBlocked;
                    let blockReason = check.reason;

                    if (colab.TipoVeiculo === 'Sem Veículo / VT') {
                        isBlocked = true;
                        blockReason = "SEM VEÍCULO / VT";
                    }

                    tempStaging.push({
                        id: `MEETING-${colab.ID_Pulsus}`,
                        id_pulsus: colab.ID_Pulsus,
                        nome: colab.Nome,
                        dataOriginal: meetingDate.split('-').reverse().join('/'),
                        dataISO: meetingDate,
                        kmOriginal: dist,
                        kmConsiderado: isBlocked ? 0 : dist,
                        efetividade: 1,
                        isLowKm: !isBlocked && dist < 1,
                        isBlocked: isBlocked,
                        blockReason: blockReason,
                        isEdited: false,
                        isCiclo: true, // Identificador Único p/ Relatório Exclusivo
                        colaboradorRef: colab,
                        supervisor: ''
                    });
                }
            }

            if (tempStaging.length === 0) {
                alert("Nenhum colaborador ativo com endereço base configurado foi encontrado.");
                setStep(1);
            } else {
                setStagingData(tempStaging);
                setSelectedPulsusIds(new Set(tempStaging.map(i => i.id_pulsus)));
                setStep(2);
            }
        } catch (e: any) {
            alert("Erro ao calcular reunião: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- ETAPA 1: UPLOAD & PARSING ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setDataSourceType('CSV');
        setSelectedRotaId(null); // Reseta ID de rota
        // Reset states
        setStagingData([]);
        setIgnoredList([]);
        setCalculoFinal([]);
        setSavedSuccess(false);
        setStep(1);
        setIgnoredExpanded(false);
        setSmartSuggestions([]);
        setSelectedPulsusIds(new Set());

        Papa.parse(file, {
            header: true,
            delimiter: ";",
            skipEmptyLines: true,
            complete: async (results: Papa.ParseResult<any>) => {
                logSystemAction('IMPORTACAO_CSV', `Upload: ${file.name}. Linhas: ${results.data.length}`);
                await processarCSV(results.data);
                setIsProcessing(false);
            },
            error: (err: Error) => {
                alert("Erro ao ler CSV: " + err.message);
                setIsProcessing(false);
            }
        });
    };

    const processarCSV = async (rows: any[]) => {
        const tempStaging: StagingRecord[] = [];
        const tempIgnored: {id: number, nome: string, rawRows: any[]}[] = [];
        const allDateKeys: string[] = [];

        rows.forEach((row, idx) => {
            const id = parseInt(row['ID Pulsus']);
            const nome = row['Nome'] && row['Nome'].trim() ? row['Nome'].trim() : `Colaborador ${id}`;
            const kmStr = row['Estimativa de distância percorrida (KM)'];
            const km = parseFloat(kmStr ? kmStr.replace(',', '.') : '0'); 
            const dateStr = row['Data'];
            
            // Supervisor removido da lógica de processamento conforme solicitado

            if (!isNaN(id) && !isNaN(km)) {
                const csvDateKey = toIsoDateKey(dateStr);
                if(csvDateKey) allDateKeys.push(csvDateKey);

                const colab = colaboradores.find(c => c.ID_Pulsus === id);
                if (!colab) {
                    const existing = tempIgnored.find(i => i.id === id);
                    if (existing) {
                        existing.rawRows.push({ ...row, idx });
                    } else {
                        tempIgnored.push({id, nome, rawRows: [{ ...row, idx }]});
                    }
                    return;
                }

                // Initial Check Ausências
                const check = checkAbsence(colab.ID_Colaborador, csvDateKey, ausencias);
                
                let isBlocked = check.isBlocked;
                let blockReason = check.reason;

                // NOVO: Bloqueio automático se cadastro estiver inativo ou Sem Veículo / VT
                if (!colab.Ativo) {
                    isBlocked = true;
                    blockReason = "CADASTRO INATIVO";
                } else if (colab.TipoVeiculo === 'Sem Veículo / VT') {
                    isBlocked = true;
                    blockReason = "SEM VEÍCULO / VT";
                }

                tempStaging.push({
                    id: `${id}-${idx}`, // Unique React Key
                    id_pulsus: id,
                    nome: nome,
                    dataOriginal: dateStr,
                    dataISO: csvDateKey || '',
                    kmOriginal: km,
                    kmConsiderado: isBlocked ? 0 : km,
                    efetividade: 1.0, // Inicia com 100%
                    isLowKm: !isBlocked && km < 1,
                    isBlocked: isBlocked,
                    blockReason: blockReason,
                    isEdited: false,
                    colaboradorRef: colab,
                    supervisor: ''
                });
            }
        });

        // Define Período
        if(allDateKeys.length > 0) {
            allDateKeys.sort();
            const minKey = allDateKeys[0];
            const maxKey = allDateKeys[allDateKeys.length - 1];
            setPeriodo(`${createDateFromYmd(minKey).toLocaleDateString('pt-BR')} até ${createDateFromYmd(maxKey).toLocaleDateString('pt-BR')}`);
        } else {
            setPeriodo('Período não identificado');
        }

        setStagingData(tempStaging);
        // Marcar todos como selecionados inicialmente
        setSelectedPulsusIds(new Set(tempStaging.map(i => i.id_pulsus)));
        setIgnoredList(tempIgnored);

        // --- SMART SUGGESTIONS (New v1.7) ---
        if (tempIgnored.length > 0) {
             const ignoredIds = tempIgnored.map(i => i.id);
             try {
                 const suggestions = await getSugestoesVinculo(ignoredIds);
                 const matches = [];
                 
                 for (const sug of suggestions) {
                     // Tenta encontrar um colaborador ativo que "bata" com o histórico
                     const match = colaboradores.find(c => 
                        c.Nome.trim().toLowerCase() === sug.NomeSuggestion.trim().toLowerCase() && 
                        c.Grupo === sug.GrupoSuggestion
                     );
                     
                     if (match) {
                         matches.push({
                             id: sug.ID_Pulsus,
                             nomeHist: sug.NomeSuggestion,
                             grupoHist: sug.GrupoSuggestion,
                             targetColab: match
                         });
                     }
                 }
                 setSmartSuggestions(matches);
             } catch (e) {
                 console.error("Falha ao buscar sugestões inteligentes", e);
             }
        }
        
        // Auto-advance if data found
        if (tempStaging.length > 0 || tempIgnored.length > 0) {
            setStep(2);
        }
    };

    // Helper para checar ausências
    const checkAbsence = (colabId: number, dateKey: string | null, absenceList: Ausencia[]) => {
        if (!dateKey) return { isBlocked: false, reason: '' };
        
        const ausencia = absenceList.find(aus => {
            if (Number(aus.ID_Colaborador) !== Number(colabId)) return false;
            const startKey = toIsoDateKey(aus.DataInicio);
            const endKey = toIsoDateKey(aus.DataFim);
            if (!startKey || !endKey) return false;
            return dateKey >= startKey && dateKey <= endKey;
        });

        if (ausencia) {
            return { isBlocked: true, reason: ausencia.Motivo };
        }
        return { isBlocked: false, reason: '' };
    };

    // --- FUNCIONALIDADE: REVALIDAR AUSÊNCIAS ---
    const revalidateAbsences = async () => {
        setIsRefreshingAbsences(true);
        try {
            await refreshData();
            const freshAusencias = await getAusencias();
            setStagingData(prev => prev.map(item => {
                if (item.isEdited) return item;
                if (!item.colaboradorRef) return item;
                
                // Se já estiver bloqueado por INATIVO, mantém
                if (!item.colaboradorRef.Ativo) {
                    return { ...item, isBlocked: true, blockReason: "CADASTRO INATIVO", kmConsiderado: 0, isLowKm: false };
                }

                const check = checkAbsence(item.colaboradorRef.ID_Colaborador, item.dataISO, freshAusencias);
                if (check.isBlocked) {
                    return { ...item, isBlocked: true, blockReason: check.reason, kmConsiderado: 0, isLowKm: false };
                } else {
                    if (item.isBlocked && item.blockReason !== "CADASTRO INATIVO") {
                        return { ...item, isBlocked: false, blockReason: '', kmConsiderado: item.kmOriginal, isLowKm: item.kmOriginal < 1 };
                    }
                }
                return item;
            }));
        } catch (e) { console.error(e); } finally { setIsRefreshingAbsences(false); }
    };

    // --- FUNCIONALIDADE: APLICAR EFETIVIDADE EM MASSA ---
    const handleApplyEffectiveness = (map: Record<number, number>) => {
        setStagingData(prev => prev.map(item => {
            const setor = item.colaboradorRef?.CodigoSetor;
            if (setor !== undefined && map[setor] !== undefined) {
                return { ...item, efetividade: map[setor] };
            }
            return item;
        }));
        alert(`Fator de efetividade aplicado a ${Object.keys(map).length} setores.`);
    };

    // --- ETAPA 2: CONFERÊNCIA & EDIÇÃO ---
    const handleEditClick = (record: StagingRecord) => {
        setRecordToEdit(record);
        setEditModalOpen(true);
    };

    const saveEdit = (id: string, newKm: number, reason: string) => {
        setStagingData(prev => prev.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    kmConsiderado: newKm,
                    isEdited: true,
                    editReason: reason,
                    isLowKm: false 
                };
            }
            return item;
        }));
        setEditModalOpen(false);
        setRecordToEdit(null);
    };

    // --- QUICK ABSENCE HANDLERS ---
    const openQuickAbsence = (record: StagingRecord) => {
        if (!record.colaboradorRef) return;
        setTargetQuickAbsence({
            colabId: record.colaboradorRef.ID_Colaborador,
            name: record.nome,
            date: record.dataISO
        });
        setAbsenceModalOpen(true);
    };

    const handleQuickAbsenceSave = async (dtInicio: string, dtFim: string, motivo: string) => {
        if (!targetQuickAbsence) return;
        
        try {
            await addAusencia({
                ID_Colaborador: targetQuickAbsence.colabId,
                DataInicio: dtInicio,
                DataFim: dtFim,
                Motivo: motivo
            });
            setAbsenceModalOpen(false);
            setTargetQuickAbsence(null);
            
            // Revalidate immediately to reflect changes
            await revalidateAbsences();
        } catch (e: any) {
            alert("Erro ao salvar ausência: " + e.message);
        }
    };

    // --- MERGE HANDLER (Link Ignored to Active) ---
    const handleMerge = (sourceId: number, targetColabId: number) => {
        // Find ignored item
        const ignoredItem = ignoredList.find(i => i.id === sourceId);
        const targetColab = colaboradores.find(c => c.ID_Colaborador === targetColabId);
        
        if (!ignoredItem || !targetColab) return;

        // Create new staging records from raw rows
        const newRecords: StagingRecord[] = ignoredItem.rawRows.map(row => {
            const kmStr = row['Estimativa de distância percorrida (KM)'];
            const km = parseFloat(kmStr ? kmStr.replace(',', '.') : '0'); 
            const dateStr = row['Data'];
            const csvDateKey = toIsoDateKey(dateStr);
            
            // Re-check absence for the TARGET collaborator
            const check = checkAbsence(targetColab.ID_Colaborador, csvDateKey, ausencias);
            
            let isBlocked = check.isBlocked;
            let blockReason = check.reason;

            // Check Inactive on Merge Target
            if (!targetColab.Ativo) {
                isBlocked = true;
                blockReason = "CADASTRO INATIVO";
            }

            return {
                id: `${sourceId}-${row.idx}-merged`,
                id_pulsus: targetColab.ID_Pulsus, // Masquerade as target ID for grouping
                nome: targetColab.Nome,
                dataOriginal: dateStr,
                dataISO: csvDateKey || '',
                kmOriginal: km,
                kmConsiderado: isBlocked ? 0 : km,
                efetividade: 1.0,
                isLowKm: !isBlocked && km < 1,
                isBlocked: isBlocked,
                blockReason: blockReason,
                isEdited: true, // Mark as edited so we know it was merged
                editReason: `Origem: ID Antigo ${sourceId}`,
                colaboradorRef: targetColab,
                supervisor: ''
            };
        });

        // Add to staging data
        setStagingData(prev => [...prev, ...newRecords]);
        // Ao fazer merge, seleciona o novo ID automaticamente
        setSelectedPulsusIds(prev => new Set(prev).add(targetColab.ID_Pulsus));
        
        // Remove from ignored list
        setIgnoredList(prev => prev.filter(i => i.id !== sourceId));
        
        // Remove from smart suggestions if present
        setSmartSuggestions(prev => prev.filter(s => s.id !== sourceId));

        setMergeModalOpen(false);
        setMergeTarget(null);
    };

    const openMergeModal = (id: number, nome: string) => {
        setMergeTarget({id, nome});
        setMergeModalOpen(true);
    }


    const toggleExpand = (idPulsus: number) => {
        const newSet = new Set(expandedColabs);
        if (newSet.has(idPulsus)) newSet.delete(idPulsus);
        else newSet.add(idPulsus);
        setExpandedColabs(newSet);
    };

    // Grupos disponíveis para filtro
    const availableGroups = useMemo(() => {
        const groups = new Set<string>();
        stagingData.forEach(item => {
            if (item.colaboradorRef?.Grupo) groups.add(item.colaboradorRef.Grupo);
        });
        return Array.from(groups).sort();
    }, [stagingData]);

    // Filtragem e Agrupamento
    const groupedStaging = useMemo(() => {
        const groups = new Map<number, StagingRecord[]>();
        
        // Filtra primeiro
        const filtered = stagingData.filter(item => {
            if (selectedGroup !== '' && item.colaboradorRef?.Grupo !== selectedGroup) return false;
            return true;
        });

        // Agrupa
        filtered.forEach(item => {
            if (!groups.has(item.id_pulsus)) groups.set(item.id_pulsus, []);
            groups.get(item.id_pulsus)?.push(item);
        });
        return groups;
    }, [stagingData, selectedGroup]);

    // Ordenação do Array de Grupos
    const sortedStagedGroups = useMemo(() => {
        const array = Array.from(groupedStaging.entries());
        return array.sort((a, b) => {
            const itemA = a[1][0];
            const itemB = b[1][0];
            if (sortBy === 'SETOR') {
                return (itemA.colaboradorRef?.CodigoSetor || 0) - (itemB.colaboradorRef?.CodigoSetor || 0);
            } else {
                return (itemA.nome || '').localeCompare(itemB.nome || '');
            }
        });
    }, [groupedStaging, sortBy]);

    // --- Lógica de Seleção ---
    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            // Seleciona todos os visíveis
            const visibleIds = sortedStagedGroups.map(([id, _]) => id);
            setSelectedPulsusIds(new Set(visibleIds));
        } else {
            // Deseleciona todos os visíveis (mantém os que não estão filtrados se houver? Geralmente limpa tudo visível)
            // Aqui vamos limpar apenas os que estão visíveis no filtro atual para ser menos destrutivo
            const newSet = new Set(selectedPulsusIds);
            sortedStagedGroups.forEach(([id, _]) => newSet.delete(id));
            setSelectedPulsusIds(newSet);
        }
    };

    const toggleSelectOne = (idPulsus: number) => {
        const newSet = new Set(selectedPulsusIds);
        if (newSet.has(idPulsus)) newSet.delete(idPulsus);
        else newSet.add(idPulsus);
        setSelectedPulsusIds(newSet);
    };

    const allVisibleSelected = sortedStagedGroups.length > 0 && sortedStagedGroups.every(([id, _]) => selectedPulsusIds.has(id));

    const handleAdvanceToCalc = () => {
        if (stagingData.length === 0) return;
        
        // Transformar Staging -> CalculoReembolso
        const finalCalculos: CalculoReembolso[] = [];
        
        // Re-grouping ALL data for calculation
        const allGroupsMap = new Map<number, StagingRecord[]>();
        stagingData.forEach(item => {
            // FILTRAGEM FINAL: Apenas processa se estiver selecionado no checkbox
            if (!selectedPulsusIds.has(item.id_pulsus)) return;
            
            // NOVO: Filtragem por grupo selecionado na Etapa 2
            if (selectedGroup !== '' && item.colaboradorRef?.Grupo !== selectedGroup) return;

            if (!allGroupsMap.has(item.id_pulsus)) allGroupsMap.set(item.id_pulsus, []);
            allGroupsMap.get(item.id_pulsus)?.push(item);
        });
        
        allGroupsMap.forEach((records, idPulsus) => {
            const colab = records[0].colaboradorRef;
            if (!colab) return;
            
            // Ignorar Grupo 'Outros' no cálculo financeiro
            if (colab.Grupo === 'Outros') return;

            // Ignorar colaboradores Sem Veículo / VT no cálculo
            if (colab.TipoVeiculo === 'Sem Veículo / VT') return;

            // Pega a efetividade do primeiro registro (é por setor, então é a mesma para todos os dias do colab)
            const efetividade = records[0].efetividade;

            // O KM Total a pagar é a soma dos KMs Diários JÁ multiplicados pela efetividade
            const totalKmReal = records.reduce((acc, r) => acc + (r.kmConsiderado * r.efetividade), 0);
            
            const eficiencia = colab.TipoVeiculo === 'Moto' ? configReembolso.KmL_Moto : configReembolso.KmL_Carro;
            const litros = totalKmReal / eficiencia;
            const valorTotal = litros * configReembolso.PrecoCombustivel;
            const valorPorKm = configReembolso.PrecoCombustivel / eficiencia;

            // Map Staging Records to RegistroKM
            const registros: RegistroKM[] = records.map(r => {
                let obs = '';
                if (r.isBlocked) obs = r.blockReason || 'Ausência';
                if (r.isEdited) obs = `Ajuste: ${r.editReason}`;
                if (r.efetividade < 1) obs += (obs ? ' | ' : '') + `Efetividade: ${(r.efetividade * 100).toFixed(0)}%`;

                return {
                    ID_Pulsus: r.id_pulsus,
                    Nome: r.nome,
                    Grupo: colab.Grupo,
                    Data: r.dataOriginal, 
                    KM: r.kmConsiderado * r.efetividade, // Salva o valor final calculado
                    ValorCalculado: (r.kmConsiderado * r.efetividade) * valorPorKm,
                    Observacao: obs,
                    isCiclo: r.isCiclo
                };
            });

            finalCalculos.push({
                Colaborador: colab,
                TotalKM: totalKmReal,
                LitrosEstimados: litros,
                ValorPagar: valorTotal,
                Ajuste: 0, // Novo: Inicializa com 0
                Efetividade: efetividade,
                Registros: registros
            });
        });

        if (finalCalculos.length === 0) {
            alert("Nenhum colaborador selecionado para cálculo.");
            return;
        }

        setCalculoFinal(finalCalculos);
        setStep(3);
    };

    // --- FUNCTION TO UPDATE ADJUSTMENT ---
    const handleUpdateAdjustment = (idPulsus: number, newValue: number) => {
        setCalculoFinal(prev => prev.map(item => {
            if (item.Colaborador.ID_Pulsus === idPulsus) {
                return { ...item, Ajuste: newValue };
            }
            return item;
        }));
    };

    // --- ETAPA 3: SALVAR ---
    const handleSaveHistory = async (overwrite: boolean, motivoOverwrite?: string) => {
        // CONFIRMAÇÃO DE SEGURANÇA (NOVA LÓGICA)
        if (!overwrite) {
            const confirmMsg = "ATENÇÃO: FECHAMENTO DE CÁLCULO\n\n" +
                "Deseja realmente salvar e fechar este reembolso?\n\n" +
                "• Certifique-se de que todos os dados (KMs, valores e ausências) foram conferidos.\n" +
                "• Após esta etapa, os dados ficarão salvos nos relatórios do sistema.\n" +
                "• Não será possível 'voltar' para esta tela de edição sem reprocessar o arquivo.\n\n" +
                "Clique em OK para confirmar o salvamento.";
            
            if (!window.confirm(confirmMsg)) return;
        }

        setIsSaving(true);
        try {
            // BLOQUEIO REFORÇADO (Fail-safe v1.15.4): 
            // Se qualquer item no cálculo final for oriundo de ciclo, a origem DEVE ser CICLO.
            const isAnyCiclo = calculoFinal.some(c => c.Registros.some(r => r.isCiclo === true));
            const finalOrigin = isAnyCiclo ? 'CICLO' : dataSourceType;

            const payload: SalvarCalculoPayload = {
                Periodo: periodo,
                TotalGeral: calculoFinal.reduce((acc, c) => acc + c.ValorPagar + (c.Ajuste || 0), 0), 
                OrigemDados: finalOrigin, 
                ID_RotaHist: finalOrigin === 'ROTEIRIZADOR' ? selectedRotaId : null, 
                Overwrite: overwrite,
                MotivoOverwrite: motivoOverwrite,
                Itens: calculoFinal.map(c => ({
                    ID_Pulsus: c.Colaborador.ID_Pulsus,
                    Nome: c.Colaborador.Nome,
                    Grupo: c.Colaborador.Grupo,
                    TipoVeiculo: c.Colaborador.TipoVeiculo,
                    TotalKM: c.TotalKM,
                    ValorReembolso: c.ValorPagar + (c.Ajuste || 0), // Valor final salvo já com ajuste
                    Ajuste: c.Ajuste || 0, // Salva o valor do ajuste para auditoria
                    ParametroPreco: configReembolso.PrecoCombustivel,
                    ParametroKmL: c.Colaborador.TipoVeiculo === 'Carro' ? configReembolso.KmL_Carro : configReembolso.KmL_Moto,
                    Efetividade: c.Efetividade,
                    RegistrosDiarios: c.Registros.map(reg => {
                        const dateIso = toIsoDateKey(reg.Data) || new Date().toISOString().split('T')[0];
                        return {
                            Data: dateIso,
                            KM: reg.KM,
                            Valor: reg.ValorCalculado || 0,
                            Observacao: reg.Observacao
                        };
                    })
                }))
            };

            const exists = !overwrite ? await checkCalculoExists(periodo) : false;
            
            if (exists) {
                // Solicita motivo obrigatório para reprocessamento
                const motivo = prompt(`ATENÇÃO: Já existe um cálculo fechado para o período ${periodo}.\n\nPara REPROCESSAR e sobrescrever o valor anterior, digite o motivo abaixo (obrigatório para auditoria):`);
                
                if (motivo && motivo.trim().length > 3) {
                    await saveCalculo({ ...payload, Overwrite: true, MotivoOverwrite: motivo });
                    setSavedSuccess(true);
                    alert("Cálculo sobrescrito com sucesso! A ação foi registrada no log de auditoria.");
                } else {
                    if (motivo !== null) alert("Operação cancelada: O motivo é obrigatório para reprocessamento.");
                    setIsSaving(false);
                    return; // Cancelou
                }
            } else {
                await saveCalculo(payload);
                setSavedSuccess(true);
                alert("Cálculo salvo com sucesso!");
            }

        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- RENDERIZADORES DE ETAPAS ---

    // Etapa 1: Upload (Mantido visual similar mas simplificado)
    const renderStep1 = () => (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center animate-fade-in transition-colors">
            <RouteSelectionModal isOpen={routeModalOpen} onClose={() => setRouteModalOpen(false)} onSelect={handleRouteSelect} />
            
            {/* Modal Reunião Ciclo */}
            {meetingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70]">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm text-left">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Reunião de Ciclo</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Selecione a data da reunião para calcular o deslocamento ida/volta da casa de cada colaborador até a sede.</p>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data da Reunião</label>
                            <input 
                                type="date" 
                                value={meetingDate} 
                                onChange={e => setMeetingDate(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-3 focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setMeetingModalOpen(false)} className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition">Cancelar</button>
                            <button 
                                onClick={handleMeetingStart}
                                disabled={!meetingDate}
                                className="flex-[2] bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
                            >
                                Iniciar Cálculo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <CalculatorIcon className="w-10 h-10 text-blue-600 dark:text-sky-400"/>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Iniciar Novo Cálculo</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">Escolha a origem dos dados para iniciar o processamento de reembolso.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                {/* Opção 1: CSV */}
                <label className={`block w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all h-full ${isProcessing && dataSourceType === 'CSV' ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 ring-2 ring-blue-200' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 hover:shadow-md'}`}>
                    {isProcessing && dataSourceType === 'CSV' ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <SpinnerIcon className="w-8 h-8 text-blue-600 mb-2"/>
                            <span className="text-blue-600 font-bold text-xs uppercase">Processando CSV...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                            <UploadIcon className="w-10 h-10 text-blue-500 mb-4"/>
                            <span className="text-slate-800 dark:text-white font-bold text-base">Importar CSV</span>
                            <span className="text-[10px] text-slate-400 mt-2">Dados Reais (Pulsus)</span>
                        </div>
                    )}
                    <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={isProcessing} />
                </label>

                {/* Opção 2: Roteirizador */}
                <button 
                    onClick={() => setRouteModalOpen(true)}
                    disabled={isProcessing}
                    className={`block w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all h-full ${isProcessing && dataSourceType === 'ROTEIRIZADOR' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-200' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:shadow-md'}`}
                >
                    {isProcessing && dataSourceType === 'ROTEIRIZADOR' ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <SpinnerIcon className="w-8 h-8 text-indigo-600 mb-2"/>
                            <span className="text-indigo-600 font-bold text-xs uppercase">Carregando Rota...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                            <LocationMarkerIcon className="w-10 h-10 text-indigo-500 mb-4"/>
                            <span className="text-slate-800 dark:text-white font-bold text-base">Roteirizador</span>
                            <span className="text-[10px] text-slate-400 mt-2">Dados Previstos (Smart)</span>
                        </div>
                    )}
                </button>

                {/* Opção 3: Reunião Ciclo */}
                <button 
                    onClick={() => setMeetingModalOpen(true)}
                    disabled={isProcessing}
                    className={`block w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all h-full ${isProcessing && dataSourceType === 'CICLO' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 hover:shadow-md'}`}
                >
                    {isProcessing && dataSourceType === 'CICLO' ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <SpinnerIcon className="w-8 h-8 text-emerald-600 mb-2"/>
                            <span className="text-emerald-600 font-bold text-xs uppercase text-center">Calculando Reunião de Ciclo...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                            <UserGroupIcon className="w-10 h-10 text-emerald-500 mb-4"/>
                            <span className="text-slate-800 dark:text-white font-bold text-base">Reunião Ciclo</span>
                            <span className="text-[10px] text-slate-400 mt-2">Ida/Volta Casa-Sede</span>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );

    // Etapa 2: Conferência (Mantido)
    const renderStep2 = () => {
        const issuesCount = stagingData.filter(i => i.isLowKm || i.isBlocked).length;

        return (
            <div className="space-y-6 animate-fade-in">
                <EditKmModal isOpen={editModalOpen} record={recordToEdit} onClose={() => setEditModalOpen(false)} onSave={saveEdit} />
                <QuickAbsenceModal isOpen={absenceModalOpen} data={targetQuickAbsence} onClose={() => setAbsenceModalOpen(false)} onConfirm={handleQuickAbsenceSave} />
                <MergeModal isOpen={mergeModalOpen} data={mergeTarget} colaboradores={colaboradores} onClose={() => setMergeModalOpen(false)} onConfirm={(targetId) => mergeTarget && handleMerge(mergeTarget.id, targetId)} />
                <EffectivenessModal isOpen={effModalOpen} onClose={() => setEffModalOpen(false)} onApply={handleApplyEffectiveness} />

                {/* Info Bar */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-colors">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                                Conferência de Dados
                                <span className={`ml-3 text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${dataSourceType === 'CSV' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-sky-300 border-blue-200 dark:border-blue-800' : dataSourceType === 'ROTEIRIZADOR' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'}`}>
                                    Fonte: {dataSourceType === 'CSV' ? 'KM REALIZADO (CSV)' : dataSourceType === 'ROTEIRIZADOR' ? 'KM PREVISTO (ROTEIRIZADOR)' : 'REUNIÃO DE CICLO'}
                                </span>
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Período: <b>{periodo}</b></p>
                        </div>
                        <div className="mt-4 md:mt-0 flex items-center space-x-3">
                             <button 
                                onClick={() => setEffModalOpen(true)}
                                className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold text-sm flex items-center transition shadow-sm"
                            >
                                <ChartBarIcon className="w-4 h-4 mr-2"/>
                                Efetividade em Massa
                            </button>
                             <button 
                                onClick={revalidateAbsences} 
                                disabled={isRefreshingAbsences}
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-bold text-sm flex items-center transition"
                            >
                                {isRefreshingAbsences ? <SpinnerIcon className="w-4 h-4 mr-2"/> : <CalendarIcon className="w-4 h-4 mr-2"/>}
                                Verificar Ausências
                            </button>
                            <button onClick={handleAdvanceToCalc} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center shadow-lg shadow-blue-600/20">
                                Próximo: Calcular <ArrowRightIcon className="w-4 h-4 ml-2"/>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        {/* FILTRO GRUPO */}
                        <div className="flex items-center">
                            <UsersIcon className="w-5 h-5 text-slate-400 mr-2"/>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 mr-2">Grupo:</span>
                            <select 
                                value={selectedGroup} 
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md text-sm py-1 pl-2 pr-8 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Todos</option>
                                {availableGroups.map(grp => (
                                    <option key={grp} value={grp}>{grp}</option>
                                ))}
                            </select>
                        </div>

                        <div className="h-4 w-px bg-slate-300 hidden md:block"></div>

                        {/* ORDENAÇÃO */}
                        <div className="flex items-center space-x-3 bg-white px-2 py-1 rounded border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 uppercase">Ordenar:</span>
                            <label className="flex items-center cursor-pointer">
                                <input type="radio" name="sort" checked={sortBy === 'NOME'} onChange={() => setSortBy('NOME')} className="mr-1 accent-blue-600"/>
                                <span className="text-xs font-bold text-slate-600">Nome</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input type="radio" name="sort" checked={sortBy === 'SETOR'} onChange={() => setSortBy('SETOR')} className="mr-1 accent-blue-600"/>
                                <span className="text-xs font-bold text-slate-600">Setor</span>
                            </label>
                        </div>

                        <div className="h-4 w-px bg-slate-300 hidden md:block"></div>

                        <div className="text-xs text-slate-500 flex items-center">
                            {issuesCount > 0 && (
                                <span className="flex items-center text-amber-600 font-bold mr-3">
                                    <ExclamationIcon className="w-4 h-4 mr-1"/> {issuesCount} Alertas Totais
                                </span>
                            )}
                            <span>Exibindo <b>{sortedStagedGroups.length}</b> colaboradores.</span>
                            <div className="flex items-center ml-2">
                                <span className={`px-2 py-0.5 rounded-full font-bold transition-all flex items-center ${selectedPulsusIds.size > sortedStagedGroups.filter(([id, _]) => selectedPulsusIds.has(id)).length ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'text-indigo-600'}`}>
                                    {selectedPulsusIds.size > sortedStagedGroups.filter(([id, _]) => selectedPulsusIds.has(id)).length && <UsersIcon className="w-3 h-3 mr-1"/>}
                                    ({sortedStagedGroups.filter(([id, _]) => selectedPulsusIds.has(id)).length} selecionados)
                                </span>
                                
                                {selectedPulsusIds.size > sortedStagedGroups.filter(([id, _]) => selectedPulsusIds.has(id)).length && (
                                    <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex items-center animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                                        </svg>
                                        Filtro Ativo: {selectedPulsusIds.size - sortedStagedGroups.filter(([id, _]) => selectedPulsusIds.has(id)).length} ocultos
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SMART SUGGESTIONS ALERT --- */}
                {smartSuggestions.length > 0 && (
                     <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm animate-fade-in-up">
                         <h4 className="text-sm font-bold text-blue-700 flex items-center mb-2">
                             <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2">!</span>
                             Sugestões Inteligentes de Vínculo
                         </h4>
                         <p className="text-xs text-blue-600/80 mb-3">
                             O sistema identificou possíveis trocas de aparelho baseadas no histórico de pagamento anterior.
                         </p>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                             {smartSuggestions.map(sug => (
                                 <div key={sug.id} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm flex items-center justify-between">
                                     <div>
                                         <p className="text-xs font-bold text-slate-700">ID Ignorado: {sug.id}</p>
                                         <p className="text-[10px] text-slate-500">Histórico: <b>{sug.nomeHist}</b> ({sug.grupoHist})</p>
                                         <p className="text-[10px] text-blue-600 mt-1">Sugerido: <b>{sug.targetColab.Nome}</b> (ID Atual: {sug.targetColab.ID_Pulsus})</p>
                                     </div>
                                     <button 
                                        onClick={() => handleMerge(sug.id, sug.targetColab.ID_Colaborador)}
                                        className="ml-3 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-xs font-bold transition"
                                     >
                                         Aceitar
                                     </button>
                                 </div>
                             ))}
                         </div>
                     </div>
                )}

                {/* Ignored List Alert (Collapsible) */}
                {ignoredList.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition-all shadow-sm">
                        <div 
                            onClick={() => setIgnoredExpanded(!ignoredExpanded)}
                            className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        >
                            <h4 className="text-sm font-bold text-slate-600 flex items-center">
                                <ExclamationIcon className="w-5 h-5 mr-2 text-amber-500"/> 
                                {ignoredList.length} Registros Ignorados (Sem Cadastro)
                            </h4>
                            <div className="text-slate-400">
                                {ignoredExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                            </div>
                        </div>
                        
                        {ignoredExpanded && (
                            <div className="p-4 pt-0 border-t border-slate-100 bg-white animate-fade-in">
                                <p className="text-xs text-slate-400 mb-3 mt-3">Estes registros existem no arquivo CSV mas não foram encontrados no cadastro do sistema. Eles serão ignorados no cálculo, a menos que você os vincule.</p>
                                <div className="space-y-2">
                                    {ignoredList.map((ig, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded border border-slate-200 text-slate-500 font-mono">
                                            <span>{ig.id} - {ig.nome}</span>
                                            <button 
                                                onClick={() => openMergeModal(ig.id, ig.nome)}
                                                className="flex items-center text-blue-600 hover:text-blue-800 font-bold bg-white px-2 py-1 rounded border border-blue-100 shadow-sm"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                                Vincular / Unificar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-600">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                                <tr>
                                    <th className="p-4 w-10"></th>
                                    <th className="p-4">Colaborador</th>
                                    <th className="p-4 text-center">Efetividade</th>
                                    <th className="p-4 text-center">Dias</th>
                                    <th className="p-4 text-right">KM Total (Prévia)</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                            checked={allVisibleSelected}
                                            title="Selecionar Todos Visíveis"
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedStagedGroups.length === 0 ? (
                                     <tr><td colSpan={7} className="p-12 text-center text-slate-400">Nenhum colaborador encontrado para este filtro.</td></tr>
                                ) : (
                                    sortedStagedGroups.map(([idPulsus, records]) => {
                                        const colab = records[0].colaboradorRef!;
                                        const efetividade = records[0].efetividade;
                                        const isExpanded = expandedColabs.has(idPulsus);
                                        const totalKmOriginal = records.reduce((acc, r) => acc + r.kmConsiderado, 0);
                                        const totalKmEfetivo = totalKmOriginal * efetividade;
                                        
                                        const hasAlerts = records.some(r => r.isLowKm || r.isBlocked);
                                        const hasEdits = records.some(r => r.isEdited);
                                        
                                        const isSelected = selectedPulsusIds.has(idPulsus);

                                        return (
                                            <React.Fragment key={idPulsus}>
                                                <tr onClick={() => toggleExpand(idPulsus)} className={`cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''} ${!isSelected ? 'opacity-50 grayscale' : ''}`}>
                                                    <td className="p-4 text-center">
                                                        {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-blue-500"/> : <ChevronRightIcon className="w-4 h-4 text-slate-400"/>}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800 flex items-center">
                                                            {colab.Nome}
                                                            {!colab.Ativo && <span className="ml-2 bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded font-black uppercase">INATIVO</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-400">Setor: {colab.CodigoSetor} - ID: {idPulsus}</div>
                                                        {records[0].supervisor && <div className="text-[10px] text-indigo-400 font-bold mt-0.5">Sup: {records[0].supervisor}</div>}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${efetividade === 1 ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                                            {(efetividade * 100).toFixed(0)}%
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center font-mono">{records.length}</td>
                                                    <td className="p-4 text-right">
                                                        <div className={`font-mono font-bold ${efetividade < 1 ? 'text-indigo-600' : 'text-slate-800'}`}>
                                                            {totalKmEfetivo.toFixed(1)} km
                                                        </div>
                                                        {efetividade < 1 && (
                                                            <div className="text-[10px] text-slate-400 line-through">original: {totalKmOriginal.toFixed(1)} km</div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <div className="flex justify-center space-x-1">
                                                            {hasAlerts && <span className="w-2 h-2 rounded-full bg-amber-500" title="Possui Alertas"></span>}
                                                            {hasEdits && <span className="w-2 h-2 rounded-full bg-blue-500" title="Possui Edições"></span>}
                                                            {!hasAlerts && !hasEdits && <span className="w-2 h-2 rounded-full bg-emerald-500" title="OK"></span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectOne(idPulsus)}
                                                            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={7} className="p-4 pl-12">
                                                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                                <table className="w-full text-xs">
                                                                    <thead className="bg-slate-100 text-slate-500">
                                                                        <tr>
                                                                            <th className="p-2 text-left">Data</th>
                                                                            <th className="p-2 text-right">KM Original</th>
                                                                            <th className="p-2 text-right">KM Considerado</th>
                                                                            <th className="p-2 text-right bg-indigo-50">KM Final ({ (efetividade*100).toFixed(0) }%)</th>
                                                                            <th className="p-2 text-left">Observação/Status</th>
                                                                            <th className="p-2 text-center">Ação</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50">
                                                                        {records.sort((a,b) => a.dataISO.localeCompare(b.dataISO)).map(day => (
                                                                            <tr key={day.id} className="hover:bg-blue-50/30">
                                                                                <td className="p-2 font-mono">{day.dataOriginal}</td>
                                                                                <td className="p-2 text-right text-slate-400">{day.kmOriginal.toFixed(1)}</td>
                                                                                <td className="p-2 text-right text-slate-500">{day.kmConsiderado.toFixed(1)}</td>
                                                                                <td className="p-2 text-right font-bold text-indigo-700 bg-indigo-50/30">{(day.kmConsiderado * day.efetividade).toFixed(1)}</td>
                                                                                <td className="p-2">
                                                                                    {day.isBlocked && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold mr-2">Bloqueado: {day.blockReason}</span>}
                                                                                    {day.isLowKm && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold mr-2">&lt; 1 KM</span>}
                                                                                    {day.isEdited && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold mr-2">Editado</span>}
                                                                                </td>
                                                                                <td className="p-2 text-center flex justify-end space-x-2">
                                                                                    {!day.isBlocked && (
                                                                                         <button 
                                                                                            onClick={(e) => { e.stopPropagation(); openQuickAbsence(day); }} 
                                                                                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                                                                                            title="Lançar Ausência"
                                                                                         >
                                                                                             <div className="relative">
                                                                                                <CalendarIcon className="w-4 h-4"/>
                                                                                                <div className="absolute -top-1 -right-1 bg-red-600 rounded-full w-2 h-2 flex items-center justify-center text-[6px] text-white font-bold">+</div>
                                                                                             </div>
                                                                                         </button>
                                                                                    )}
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleEditClick(day); }} className="text-blue-600 hover:text-blue-800 font-bold hover:underline">
                                                                                        Editar
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Etapa 3: Finalização (Igual ao anterior, mas usando calculoFinal)
    const renderStep3 = () => {
        const totalVal = calculoFinal.reduce((acc, c) => acc + c.ValorPagar + (c.Ajuste || 0), 0);
        const totalKm = calculoFinal.reduce((acc, c) => acc + c.TotalKM, 0);

        return (
            <div className="space-y-6 animate-fade-in">
                {showReport && <ReportPrint dados={calculoFinal} periodo={periodo} source={dataSourceType} onClose={() => setShowReport(false)} />}
                
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center">
                    <div>
                        <h3 className="text-emerald-900 font-bold text-lg">Cálculo Finalizado</h3>
                        <p className="text-emerald-700/70 text-sm">Pronto para salvar no histórico.</p>
                        <div className="mt-2 text-xs font-bold bg-white/50 text-emerald-800 inline-block px-2 py-1 rounded border border-emerald-200">
                            Origem: {dataSourceType} {dataSourceType === 'ROTEIRIZADOR' && selectedRotaId && `(Simulação #${selectedRotaId})`}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-emerald-600 uppercase font-bold">Valor Total Final</p>
                        <p className="text-3xl font-extrabold text-emerald-700">{totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>

                <div className="flex justify-end space-x-3">
                    <button onClick={() => setStep(2)} className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-600 font-bold text-sm">Voltar e Ajustar</button>
                    <button onClick={() => setShowReport(true)} className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-700 flex items-center"><PrinterIcon className="w-4 h-4 mr-2"/> Visualizar Relatório</button>
                    <button onClick={() => handleSaveHistory(false)} disabled={isSaving || savedSuccess} className={`px-6 py-2 rounded-lg font-bold text-sm text-white flex items-center shadow-lg ${savedSuccess ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
                         {isSaving ? <SpinnerIcon className="w-4 h-4 mr-2"/> : <CheckCircleIcon className="w-4 h-4 mr-2"/>}
                         {savedSuccess ? 'Salvo!' : 'Salvar Histórico'}
                    </button>
                </div>

                {/* Tabela Resumo Final */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                     <table className="w-full text-sm text-left text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-b border-slate-200">
                            <tr>
                                <th className="p-4">Colaborador</th>
                                <th className="p-4 text-center">Veículo</th>
                                <th className="p-4 text-center">Fator</th>
                                <th className="p-4 text-right">KM Total</th>
                                <th className="p-4 text-right">Valor Calc.</th>
                                <th className="p-4 text-right bg-amber-50">Ajuste (R$)</th>
                                <th className="p-4 text-right">Valor Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {calculoFinal.map(c => (
                                <tr key={c.Colaborador.ID_Pulsus}>
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">{c.Colaborador.Nome}</div>
                                        <div className="text-xs text-slate-400">Setor: {c.Colaborador.CodigoSetor} - ID: {c.Colaborador.ID_Pulsus}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${c.Colaborador.TipoVeiculo === 'Carro' ? 'bg-blue-50 text-blue-600 border-blue-100' : c.Colaborador.TipoVeiculo === 'Moto' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                            {c.Colaborador.TipoVeiculo}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.Efetividade < 1 ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}>
                                            {(c.Efetividade * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-700">{c.TotalKM.toFixed(2)}</td>
                                    <td className="p-4 text-right font-bold text-slate-500">{c.ValorPagar.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                                    
                                    {/* COLUNA DE AJUSTE EDITÁVEL */}
                                    <td className="p-4 text-right bg-amber-50/50">
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            value={c.Ajuste} 
                                            onChange={(e) => handleUpdateAdjustment(c.Colaborador.ID_Pulsus, parseFloat(e.target.value) || 0)}
                                            className={`w-24 text-right bg-transparent border-b border-dashed border-amber-300 focus:border-amber-600 outline-none font-bold text-sm ${c.Ajuste < 0 ? 'text-red-600' : c.Ajuste > 0 ? 'text-emerald-600' : 'text-slate-400'}`}
                                            placeholder="0.00"
                                        />
                                    </td>

                                    <td className="p-4 text-right font-black text-emerald-600 bg-emerald-50/30">
                                        {(c.ValorPagar + (c.Ajuste || 0)).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Stepper Header */}
            <div className="flex justify-center mb-8">
                <div className="flex items-center space-x-4 bg-white p-2 rounded-full shadow-sm border border-slate-200">
                    <div className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${step >= 1 ? 'bg-blue-50 text-blue-700' : 'text-slate-400'}`}>
                        <span className="font-bold">1</span> <span className="text-sm font-medium">Origem</span>
                    </div>
                    <div className="w-8 h-px bg-slate-300"></div>
                    <div className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${step >= 2 ? 'bg-blue-50 text-blue-700' : 'text-slate-400'}`}>
                        <span className="font-bold">2</span> <span className="text-sm font-medium">Conferência & Ajustes</span>
                    </div>
                    <div className="w-8 h-px bg-slate-300"></div>
                    <div className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors ${step === 3 ? 'bg-blue-50 text-blue-700' : 'text-slate-400'}`}>
                        <span className="font-bold">3</span> <span className="text-sm font-medium">Fechamento</span>
                    </div>
                </div>
            </div>

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
        </div>
    );
};
