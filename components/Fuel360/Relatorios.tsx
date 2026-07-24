
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { DataContext } from './context/DataContext';
import { getRelatorioReembolso, getRelatorioAnalitico, corrigirAusenciasHistorico } from './services/apiService';
import { ItemRelatorio, ItemRelatorioAnalitico, Colaborador, CalculoReembolso, RegistroKM } from './types';
import { ChartBarIcon, SpinnerIcon, PrinterIcon, CarIcon, MotoIcon, UsersIcon, DocumentReportIcon, ChevronDownIcon, ChevronRightIcon, ExclamationIcon, CheckCircleIcon, TrophyIcon, PencilIcon, SearchIcon, XCircleIcon, CalendarIcon } from './icons';
import ReportPrint from './ReportPrint';

type ReportView = 'SINTETICO' | 'ANALITICO' | 'RANKING' | 'CICLO';

// --- SEARCHABLE SELECT COMPONENT ---
const SearchableSelect: React.FC<{
    options: Colaborador[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}> = ({ options, value, onChange, placeholder = "Selecione..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fecha ao clicar fora
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Reseta o termo de busca ao abrir
    useEffect(() => {
        if (isOpen) setSearchTerm('');
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => 
            opt.Nome.toLowerCase().includes(lowerTerm) || 
            String(opt.CodigoSetor).includes(lowerTerm) ||
            String(opt.ID_Pulsus).includes(lowerTerm)
        ).sort((a,b) => a.Nome.localeCompare(b.Nome));
    }, [options, searchTerm]);

    const selectedOption = options.find(o => String(o.ID_Pulsus) === value);

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 outline-none cursor-pointer flex items-center justify-between"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-500' : ''}`}>
                    {selectedOption ? `[${selectedOption.CodigoSetor}] - ${selectedOption.Nome}` : placeholder}
                </span>
                <div className="flex items-center">
                    {value && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onChange(''); setIsOpen(false); }}
                            className="mr-2 text-slate-400 hover:text-slate-600"
                        >
                            <XCircleIcon className="w-4 h-4"/>
                        </button>
                    )}
                    <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                        <div className="relative">
                            <SearchIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400"/>
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-sm outline-none focus:border-blue-500"
                                placeholder="Buscar por Nome ou Código..."
                                autoFocus
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        <div 
                            className={`p-2 hover:bg-blue-50 cursor-pointer text-sm font-bold text-blue-600 ${value === '' ? 'bg-blue-50' : ''}`}
                            onClick={() => { onChange(''); setIsOpen(false); }}
                        >
                            Todos os Colaboradores
                        </div>
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum resultado encontrado.</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <div 
                                    key={opt.ID_Pulsus}
                                    className={`p-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0 ${String(opt.ID_Pulsus) === value ? 'bg-blue-50 font-medium' : 'text-slate-700'}`}
                                    onClick={() => { onChange(String(opt.ID_Pulsus)); setIsOpen(false); }}
                                >
                                    <span className="font-mono font-bold text-xs text-slate-500 mr-2">[{opt.CodigoSetor}]</span>
                                    {opt.Nome}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const Relatorios: React.FC = () => {
    const { colaboradores } = useContext(DataContext);
    
    // Default dates: First day of current month to today
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(today);
    const [selectedColab, setSelectedColab] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>(''); // NOVO: v1.14.7
    const [sortBy, setSortBy] = useState<'NOME' | 'SETOR'>('NOME');
    
    // Data states
    const [reportData, setReportData] = useState<ItemRelatorio[]>([]);
    const [analyticData, setAnalyticData] = useState<ItemRelatorioAnalitico[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [viewMode, setViewMode] = useState<ReportView>('SINTETICO');

    // Sincroniza a origem ao mudar para a aba de Ciclo
    useEffect(() => {
        if (viewMode === 'CICLO') {
            setSelectedSource('CICLO');
            handleSearch();
        } else if (selectedSource === 'CICLO') {
            setSelectedSource('');
        }
    }, [viewMode]);

    // Modal Relatório Ciclo
    const [showCicloReport, setShowCicloReport] = useState(false);

    // Expanded states for Analytic View
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Obter lista única de grupos para o filtro
    const availableGroups = useMemo(() => {
        const groups = new Set<string>();
        colaboradores.forEach(c => {
            if (c.Grupo) groups.add(c.Grupo);
        });
        return Array.from(groups).sort();
    }, [colaboradores]);

    // Auto-load and reactive-load on filter change
    useEffect(() => {
        handleSearch();
    }, [startDate, endDate, selectedColab, selectedGroup, selectedSource]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Sintetico
            let dataSintetico = await getRelatorioReembolso(startDate, endDate, selectedColab, selectedGroup);
            if (selectedSource && selectedSource !== '') {
                dataSintetico = dataSintetico.filter(i => (i.OrigemDados || 'CSV') === selectedSource);
            }
            setReportData(dataSintetico);
            
            // Analitico
            let dataAnalitico = await getRelatorioAnalitico(startDate, endDate, selectedColab, selectedGroup);
            if (selectedSource && selectedSource !== '') {
                dataAnalitico = dataAnalitico.filter(i => (i.OrigemDados || 'CSV') === selectedSource);
            }
            setAnalyticData(dataAnalitico);
            
            setHasSearched(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // NOVO: Reconstrói o dado para o ReportPrint
    const handleOpenCicloReport = () => {
        const reconstructed: CalculoReembolso[] = reportData.map(sint => {
            // Filtrar diárias para garantir que APENAS diárias de CICLO entrem no relatório
            const diarias = analyticData.filter(a => 
                a.ID_Pulsus === sint.ID_Pulsus && 
                (a.OrigemDados === 'CICLO' || selectedSource === 'CICLO')
            );

            if (diarias.length === 0) return null;
            
            // Tenta encontrar o colaborador no contexto
            const colabRef = colaboradores.find(c => c.ID_Pulsus === sint.ID_Pulsus);
            
            const totalKm = diarias.reduce((sum, d) => sum + d.KM_Dia, 0);
            const totalVal = diarias.reduce((sum, d) => sum + d.Valor_Dia, 0);

            const item: CalculoReembolso = {
                Colaborador: colabRef || {
                    ID_Colaborador: 0,
                    ID_Pulsus: sint.ID_Pulsus,
                    Nome: sint.NomeColaborador,
                    Grupo: sint.Grupo,
                    TipoVeiculo: (sint.TipoVeiculo || 'Carro') as any,
                    Ativo: true,
                    CodigoSetor: sint.CodigoSetor || 0
                },
                TotalKM: totalKm,
                LitrosEstimados: totalKm / (sint.ParametroKmL || 10),
                ValorPagar: totalVal,
                Ajuste: 0,
                Efetividade: 1,
                Registros: diarias.map(d => ({
                    ID_Pulsus: d.ID_Pulsus,
                    Nome: d.NomeColaborador,
                    Grupo: d.Grupo,
                    Data: d.DataOcorrencia,
                    KM: d.KM_Dia,
                    ValorCalculado: d.Valor_Dia,
                    Observacao: d.Observacao || '',
                    isCiclo: true
                }))
            };
            return item;
        }).filter((c): c is CalculoReembolso => c !== null);

        if (reconstructed.length === 0) return alert("Nenhum registro de ciclo encontrado para reconstruir o relatório.");
        
        setShowCicloReport(true);
    };

    const toggleRow = (id: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedRows(newSet);
    };

    // Ordenação dos dados Sintéticos
    const sortedReportData = useMemo(() => {
        return [...reportData].sort((a, b) => {
            if (sortBy === 'SETOR') {
                const setorA = a.CodigoSetor || a.ID_Pulsus || 0;
                const setorB = b.CodigoSetor || b.ID_Pulsus || 0;
                return setorA - setorB;
            } else {
                return a.NomeColaborador.localeCompare(b.NomeColaborador);
            }
        });
    }, [reportData, sortBy]);

    // Grouping Analytic Data
    const groupedAnalyticData = useMemo(() => {
        const groups = new Map<number, {
            info: ItemRelatorioAnalitico,
            items: ItemRelatorioAnalitico[],
            totalKm: number,
            totalVal: number,
            hasConflicts: boolean
        }>();

        analyticData.forEach(item => {
            if (!groups.has(item.ID_Pulsus)) {
                groups.set(item.ID_Pulsus, {
                    info: item,
                    items: [],
                    totalKm: 0,
                    totalVal: 0,
                    hasConflicts: false
                });
            }
            const group = groups.get(item.ID_Pulsus)!;
            group.items.push(item);
            group.totalKm += item.KM_Dia;
            group.totalVal += item.Valor_Dia;
            
            if (item.TemAusencia && item.Valor_Dia > 0) {
                group.hasConflicts = true;
            }
        });

        // Convert Map to Array and Sort
        return Array.from(groups.values()).sort((a, b) => {
            if (sortBy === 'SETOR') {
                const setorA = a.info.CodigoSetor || a.info.ID_Pulsus || 0;
                const setorB = b.info.CodigoSetor || b.info.ID_Pulsus || 0;
                return setorA - setorB;
            } else {
                return a.info.NomeColaborador.localeCompare(b.info.NomeColaborador);
            }
        });
    }, [analyticData, sortBy]);

    const totalPago = reportData.reduce((acc, item) => acc + item.ValorReembolso, 0);
    const totalKM = reportData.reduce((acc, item) => acc + item.TotalKM, 0);
    
    // Identificar conflitos globais
    const conflictingIds = useMemo(() => {
        return analyticData
            .filter(i => i.TemAusencia && i.Valor_Dia > 0)
            .map(i => i.ID_Diario);
    }, [analyticData]);

    // Lógica para Ranking (Ordenado por VALOR FINANCEIRO)
    const rankingData = useMemo(() => {
        return [...reportData].sort((a, b) => b.ValorReembolso - a.ValorReembolso).slice(0, 10);
    }, [reportData]);

    // Lógica para Estatísticas de Veículos (Com Valores)
    const vehicleStats = useMemo(() => {
        const stats = { 
            Carro: 0, Moto: 0, Total: 0,
            CarroVal: 0, MotoVal: 0, TotalVal: 0
        };
        reportData.forEach(r => {
            if(r.TipoVeiculo === 'Carro') {
                stats.Carro += r.TotalKM;
                stats.CarroVal += r.ValorReembolso;
            }
            else if(r.TipoVeiculo === 'Moto') {
                stats.Moto += r.TotalKM;
                stats.MotoVal += r.ValorReembolso;
            }
            stats.Total += r.TotalKM;
            stats.TotalVal += r.ValorReembolso;
        });
        return stats;
    }, [reportData]);

    const handleFixConflicts = async () => {
        if (conflictingIds.length === 0) return;
        if (!confirm(`Deseja corrigir retroativamente ${conflictingIds.length} registros conflitantes? Isso zerará o valor pago e adicionará uma observação.`)) return;
        
        setLoading(true);
        try {
            await corrigirAusenciasHistorico(conflictingIds);
            alert('Correção aplicada com sucesso! Atualizando relatório...');
            handleSearch(); // Reload
        } catch (e: any) {
            alert('Erro ao corrigir: ' + e.message);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 print:w-full print:absolute print:top-0 print:left-0 print:bg-white print:z-[200]">
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2 tracking-tight">Relatórios de Reembolso</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Consulte o histórico financeiro e operacional.</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-full">
                    <ChartBarIcon className="w-8 h-8 text-blue-600 dark:text-sky-400"/>
                </div>
            </div>

            {/* Print Header (Visible only on print) */}
            <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-4">
                <h1 className="text-2xl font-black uppercase">Relatório de Reembolso - Fuel360</h1>
                <p className="text-sm">Período: {new Date(startDate).toLocaleDateString()} a {new Date(endDate).toLocaleDateString()}</p>
            </div>

            {/* Filter Card (Hidden on Print) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 print:hidden overflow-visible z-20 relative transition-colors">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Inicial</label>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Data Final</label>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Grupo</label>
                        <select 
                            value={selectedGroup} 
                            onChange={e => setSelectedGroup(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none"
                        >
                            <option value="">Todos</option>
                            {availableGroups.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Origem</label>
                        <select 
                            value={selectedSource} 
                            onChange={e => setSelectedSource(e.target.value)}
                            disabled={viewMode === 'CICLO'}
                            className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none ${viewMode === 'CICLO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value="">Todas</option>
                            <option value="CSV">Pulsus (CSV)</option>
                            <option value="ROTEIRIZADOR">Roteirizador</option>
                            <option value="CICLO">Reunião de Ciclo</option>
                        </select>
                    </div>
                    <div className="md:col-span-2 relative z-50">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Colaborador</label>
                        <SearchableSelect 
                            options={colaboradores}
                            value={selectedColab}
                            onChange={setSelectedColab}
                            placeholder="Todos os Colaboradores"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button 
                            onClick={handleSearch} 
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-all flex items-center justify-center"
                        >
                            {loading ? <SpinnerIcon className="w-5 h-5"/> : 'Filtrar'}
                        </button>
                    </div>
                </div>
                
                {/* SORTING CONTROLS */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end">
                    <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        <span className="text-xs font-bold text-slate-400 uppercase">Ordenar:</span>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="sortRel" checked={sortBy === 'NOME'} onChange={() => setSortBy('NOME')} className="mr-1 accent-blue-600"/>
                            <span className="text-xs font-bold text-slate-600">Nome</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input type="radio" name="sortRel" checked={sortBy === 'SETOR'} onChange={() => setSortBy('SETOR')} className="mr-1 accent-blue-600"/>
                            <span className="text-xs font-bold text-slate-600">Setor</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            {hasSearched && (
                <div className="animate-fade-in-up space-y-6 relative z-0">
                    {/* Retroactive Conflict Alert */}
                    {conflictingIds.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex justify-between items-center animate-pulse print:hidden">
                            <div className="flex items-center text-red-700">
                                <ExclamationIcon className="w-6 h-6 mr-3"/>
                                <div>
                                    <p className="font-bold">Atenção: Conflito Retroativo Detectado</p>
                                    <p className="text-sm">Existem {conflictingIds.length} dias que foram pagos mas possuem ausência cadastrada posteriormente.</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleFixConflicts}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center"
                            >
                                <CheckCircleIcon className="w-4 h-4 mr-2"/>
                                Corrigir Ausências no Histórico
                            </button>
                        </div>
                    )}

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-2">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center print:border print:p-4">
                            <div className="p-4 bg-emerald-50 rounded-full mr-4 border border-emerald-100 print:hidden">
                                <span className="text-2xl">💰</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Pago</p>
                                <p className="text-2xl font-extrabold text-slate-800">{totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center print:border print:p-4">
                             <div className="p-4 bg-blue-50 rounded-full mr-4 border border-blue-100 print:hidden">
                                <span className="text-2xl">🚗</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">KM Total</p>
                                <p className="text-2xl font-extrabold text-slate-800">{totalKM.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} km</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center print:border print:p-4">
                             <div className="p-4 bg-purple-50 rounded-full mr-4 border border-purple-100 print:hidden">
                                <UsersIcon className="w-6 h-6 text-purple-600"/>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Registros</p>
                                <p className="text-2xl font-extrabold text-slate-800">{reportData.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* View Switcher Tabs (Hidden on Print) */}
                    <div className="flex border-b border-slate-200 print:hidden">
                        <button 
                            onClick={() => setViewMode('SINTETICO')}
                            className={`px-6 py-3 text-sm font-bold flex items-center transition-all ${viewMode === 'SINTETICO' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <DocumentReportIcon className="w-5 h-5 mr-2"/>
                            Visão Sintética (Resumo)
                        </button>
                        <button 
                            onClick={() => setViewMode('ANALITICO')}
                            className={`px-6 py-3 text-sm font-bold flex items-center transition-all ${viewMode === 'ANALITICO' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ChartBarIcon className="w-5 h-5 mr-2"/>
                            Visão Analítica (Dia a Dia)
                        </button>
                        <button 
                            onClick={() => setViewMode('RANKING')}
                            className={`px-6 py-3 text-sm font-bold flex items-center transition-all ${viewMode === 'RANKING' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <TrophyIcon className="w-5 h-5 mr-2"/>
                            Ranking & Insights
                        </button>
                        <button 
                            onClick={() => setViewMode('CICLO')}
                            className={`px-6 py-3 text-sm font-bold flex items-center transition-all ${viewMode === 'CICLO' ? 'border-b-2 border-emerald-600 text-emerald-600 bg-emerald-50/30' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <CalendarIcon className="w-5 h-5 mr-2"/>
                            Reunião de Ciclo (Assinaturas)
                        </button>
                    </div>

                    {/* Table Area */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:border-none print:shadow-none">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center print:hidden">
                            <h3 className="font-bold text-slate-700">
                                {viewMode === 'CICLO' ? 'Registros de Reunião de Ciclo' : (viewMode === 'SINTETICO' ? 'Detalhamento por Colaborador' : viewMode === 'ANALITICO' ? 'Detalhamento Diário Agrupado' : 'Ranking Financeiro')}
                            </h3>
                            <div className="flex gap-2">
                                {(viewMode === 'CICLO' || selectedSource === 'CICLO') && reportData.length > 0 && (
                                    <button 
                                        onClick={handleOpenCicloReport}
                                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center hover:bg-emerald-700 transition shadow-lg border border-emerald-500 animate-bounce-subtle"
                                    >
                                        <CalendarIcon className="w-4 h-4 mr-2"/>
                                        Imprimir Lista de Assinaturas (Ciclo)
                                    </button>
                                )}
                                <button onClick={() => window.print()} className="text-slate-500 hover:text-blue-600 p-2 rounded hover:bg-white transition" title="Imprimir (Nativo)"><PrinterIcon className="w-5 h-5"/></button>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar print:overflow-visible print:max-h-none">
                            {viewMode === 'RANKING' ? (
                                <div className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-600 uppercase mb-4">Top 10 - Maior Valor Pago (R$)</h4>
                                            <div className="space-y-3">
                                                {rankingData.map((item, idx) => (
                                                    <div key={item.ID_Detalhe} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                        <div className="flex items-center">
                                                            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-3 ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{idx + 1}</span>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-800">{item.NomeColaborador}</p>
                                                                <p className="text-[10px] text-slate-400 uppercase font-bold">{item.Grupo} - {item.CodigoSetor || item.ID_Pulsus}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-black text-emerald-600 text-sm">{item.ValorReembolso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                            <p className="font-mono text-slate-400 text-xs">{item.TotalKM.toFixed(1)} km</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-600 uppercase mb-4">Distribuição Financeira por Veículo</h4>
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 h-full flex flex-col justify-center">
                                                <div className="flex items-end space-x-2 h-40 mb-4">
                                                    <div className="w-1/2 bg-blue-500 rounded-t-lg relative group transition-all hover:opacity-90" style={{ height: `${vehicleStats.TotalVal > 0 ? (vehicleStats.CarroVal / vehicleStats.TotalVal) * 100 : 0}%` }}>
                                                        <div className="absolute -top-8 w-full text-center font-bold text-blue-600">{vehicleStats.TotalVal > 0 ? ((vehicleStats.CarroVal / vehicleStats.TotalVal) * 100).toFixed(1) : 0}%</div>
                                                    </div>
                                                    <div className="w-1/2 bg-amber-500 rounded-t-lg relative group transition-all hover:opacity-90" style={{ height: `${vehicleStats.TotalVal > 0 ? (vehicleStats.MotoVal / vehicleStats.TotalVal) * 100 : 0}%` }}>
                                                        <div className="absolute -top-8 w-full text-center font-bold text-amber-600">{vehicleStats.TotalVal > 0 ? ((vehicleStats.MotoVal / vehicleStats.TotalVal) * 100).toFixed(1) : 0}%</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-3 text-xs border-t border-slate-200 pt-4">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center font-bold text-slate-600"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span> Carro</div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-blue-600">{vehicleStats.CarroVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                                            <div className="text-[10px] text-slate-400">{vehicleStats.Carro.toFixed(0)} km</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center font-bold text-slate-600"><span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span> Moto</div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-amber-600">{vehicleStats.MotoVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                                            <div className="text-[10px] text-slate-400">{vehicleStats.Moto.toFixed(0)} km</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : viewMode === 'SINTETICO' ? (
                                /* TABELA SINTÉTICA */
                                <table className="w-full text-sm text-left text-slate-600">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100 font-semibold sticky top-0 bg-white z-10 print:bg-white print:border-b-2 print:border-black">
                                        <tr>
                                            <th className="p-4 tracking-wider">Data Ger.</th>
                                            <th className="p-4 tracking-wider">Origem</th>
                                            <th className="p-4 tracking-wider">Período Ref.</th>
                                            <th className="p-4 tracking-wider">Colaborador</th>
                                            <th className="p-4 tracking-wider text-center">Veículo</th>
                                            <th className="p-4 tracking-wider text-right">KM Total</th>
                                            <th className="p-4 tracking-wider text-right">Valor Pago</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {sortedReportData.length === 0 ? (
                                            <tr><td colSpan={7} className="p-12 text-center text-slate-400">Nenhum registro encontrado para este período.</td></tr>
                                        ) : (
                                            sortedReportData.map((item) => (
                                                <tr key={item.ID_Detalhe} className="hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 text-xs font-mono">{new Date(item.DataGeracao).toLocaleDateString()}</td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${item.OrigemDados === 'ROTEIRIZADOR' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                            {item.OrigemDados || 'CSV'}
                                                        </span>
                                                        {item.MotivoEdicao && (
                                                            <div className="mt-1 print:hidden" title={item.MotivoEdicao}>
                                                                <span className="flex items-center text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase w-fit cursor-help">
                                                                    <PencilIcon className="w-2 h-2 mr-1"/> Editado
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-xs font-medium text-slate-500">{item.PeriodoReferencia}</td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-slate-800">{item.NomeColaborador}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{item.Grupo} - {item.CodigoSetor || item.ID_Pulsus}</div>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.TipoVeiculo === 'Carro' ? 'bg-blue-50 text-blue-600 border-blue-100' : item.TipoVeiculo === 'Moto' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                            {item.TipoVeiculo === 'Carro' ? <CarIcon className="w-3 h-3 mr-1"/> : item.TipoVeiculo === 'Moto' ? <MotoIcon className="w-3 h-3 mr-1"/> : null}
                                                            {item.TipoVeiculo}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-slate-700">{item.TotalKM.toFixed(2)}</td>
                                                    <td className="p-4 text-right font-bold text-emerald-600">{item.ValorReembolso.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                /* TABELA ANALÍTICA AGRUPADA */
                                <table className="w-full text-sm text-left text-slate-600">
                                    <thead className="text-xs text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100 font-semibold sticky top-0 bg-white z-10">
                                        <tr>
                                            <th className="p-4 w-12 text-center print:hidden"></th>
                                            <th className="p-4 tracking-wider">Origem</th>
                                            <th className="p-4 tracking-wider">Colaborador</th>
                                            <th className="p-4 tracking-wider text-center">Veículo</th>
                                            <th className="p-4 tracking-wider text-right">Total KM (Periodo)</th>
                                            <th className="p-4 tracking-wider text-right">Total Valor (Periodo)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedAnalyticData.length === 0 ? (
                                            <tr><td colSpan={6} className="p-12 text-center text-slate-400">Nenhum detalhe diário encontrado para este período.</td></tr>
                                        ) : (
                                            groupedAnalyticData.map((group) => {
                                                const isExpanded = expandedRows.has(group.info.ID_Pulsus);
                                                return (
                                                    <React.Fragment key={group.info.ID_Pulsus}>
                                                        {/* Parent Row */}
                                                        <tr 
                                                            onClick={() => toggleRow(group.info.ID_Pulsus)}
                                                            className={`cursor-pointer transition-colors ${group.hasConflicts ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : (isExpanded ? 'bg-blue-50/50' : 'hover:bg-slate-50')}`}
                                                        >
                                                            <td className="p-4 text-center print:hidden">
                                                                <div className={`transition-transform duration-200 ${isExpanded ? 'text-blue-600' : 'text-slate-400'}`}>
                                                                    {isExpanded ? <ChevronDownIcon className="w-5 h-5"/> : <ChevronRightIcon className="w-5 h-5"/>}
                                                                </div>
                                                            </td>
                                                            <td className="p-4">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${group.info.OrigemDados === 'ROTEIRIZADOR' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                                    {group.info.OrigemDados || 'CSV'}
                                                                </span>
                                                                {group.info.MotivoEdicao && (
                                                                    <div className="mt-1 print:hidden" title={group.info.MotivoEdicao}>
                                                                        <span className="flex items-center text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase w-fit">
                                                                            <PencilIcon className="w-2 h-2 mr-1"/> Editado
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4">
                                                                <div className="font-bold text-slate-800 text-base">{group.info.NomeColaborador}</div>
                                                                <div className="text-[10px] text-slate-500 font-bold uppercase">
                                                                    {group.info.Grupo} - {group.info.CodigoSetor || group.info.ID_Pulsus}
                                                                </div>
                                                                {group.hasConflicts && (
                                                                    <div className="text-xs font-bold text-red-600 mt-1 flex items-center">
                                                                        <ExclamationIcon className="w-3 h-3 mr-1"/>
                                                                        Conflito de Ausência Detectado
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${group.info.TipoVeiculo === 'Carro' ? 'bg-blue-50 text-blue-600 border-blue-100' : group.info.TipoVeiculo === 'Moto' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                                    {group.info.TipoVeiculo === 'Carro' ? <CarIcon className="w-3 h-3 mr-1"/> : group.info.TipoVeiculo === 'Moto' ? <MotoIcon className="w-3 h-3 mr-1"/> : null}
                                                                    {group.info.TipoVeiculo}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right font-mono text-slate-700 font-bold">{group.totalKm.toFixed(2)} km</td>
                                                            <td className="p-4 text-right font-bold text-emerald-600 text-lg">{group.totalVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        </tr>

                                                        {/* Expanded Child Row */}
                                                        {isExpanded && (
                                                            <tr className="bg-slate-50/50 shadow-inner">
                                                                <td colSpan={6} className="p-4 pl-16 print:pl-4">
                                                                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                                                        <table className="w-full text-xs">
                                                                            <thead className="bg-slate-100 text-slate-500 uppercase font-semibold">
                                                                                <tr>
                                                                                    <th className="px-4 py-2 text-left">Data</th>
                                                                                    <th className="px-4 py-2 text-right">KM Percorrido</th>
                                                                                    <th className="px-4 py-2 text-right">Valor Calculado</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-50 text-slate-600">
                                                                                {group.items.sort((a,b) => new Date(a.DataOcorrencia).getTime() - new Date(b.DataOcorrencia).getTime()).map(day => {
                                                                                    // Check conflict
                                                                                    const isConflict = day.TemAusencia && day.Valor_Dia > 0;
                                                                                    return (
                                                                                        <tr key={day.ID_Diario} className={`hover:bg-blue-50/30 ${isConflict ? 'bg-red-50' : ''}`}>
                                                                                            <td className="px-4 py-2 font-mono flex items-center">
                                                                                                {new Date(day.DataOcorrencia).toLocaleDateString('pt-BR')}
                                                                                                {isConflict && <span className="ml-2 text-red-600 text-[10px] font-bold border border-red-200 bg-white px-1 rounded flex items-center"><ExclamationIcon className="w-3 h-3 mr-1"/> Conflito: {day.MotivoAusencia}</span>}
                                                                                            </td>
                                                                                            <td className={`px-4 py-2 text-right font-mono ${isConflict ? 'text-red-600 line-through' : ''}`}>{day.KM_Dia.toFixed(2)} km</td>
                                                                                            <td className="px-4 py-2 text-right font-bold text-slate-700">
                                                                                                {day.Observacao ? (
                                                                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                                                        day.Observacao.toLowerCase().includes('féria') ? 'bg-amber-100 text-amber-700' :
                                                                                                        day.Observacao.toLowerCase().includes('atestado') ? 'bg-red-100 text-red-700' :
                                                                                                        'bg-slate-200 text-slate-700'
                                                                                                    }`}>
                                                                                                        {day.Observacao}
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className={isConflict ? 'text-red-600 line-through' : ''}>
                                                                                                        {day.Valor_Dia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                                    </span>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
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
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showCicloReport && (
                <div className="no-print">
                    <ReportPrint 
                        dados={reportData.map(sint => {
                            const diarias = analyticData.filter(a => a.ID_Pulsus === sint.ID_Pulsus);
                            const colabRef = colaboradores.find(c => c.ID_Pulsus === sint.ID_Pulsus);
                            return {
                                Colaborador: colabRef || {
                                    ID_Colaborador: 0,
                                    ID_Pulsus: sint.ID_Pulsus,
                                    Nome: sint.NomeColaborador,
                                    Grupo: sint.Grupo,
                                    TipoVeiculo: sint.TipoVeiculo as any,
                                    Ativo: true,
                                    CodigoSetor: sint.CodigoSetor || 0
                                },
                                TotalKM: sint.TotalKM,
                                LitrosEstimados: sint.TotalKM / sint.ParametroKmL,
                                ValorPagar: sint.ValorReembolso,
                                Ajuste: sint.Ajuste || 0,
                                Efetividade: 1,
                                Registros: diarias.map(d => ({
                                    ID_Pulsus: d.ID_Pulsus,
                                    Nome: d.NomeColaborador,
                                    Grupo: d.Grupo,
                                    Data: d.DataOcorrencia,
                                    KM: d.KM_Dia,
                                    ValorCalculado: d.Valor_Dia,
                                    Observacao: d.Observacao || '',
                                    isCiclo: true
                                }))
                            };
                        }).filter(c => c.Registros.length > 0)}
                        source="CICLO"
                        periodo={`Ciclo: ${new Date(startDate).toLocaleDateString()} a ${new Date(endDate).toLocaleDateString()}`}
                        onClose={() => setShowCicloReport(false)}
                    />
                </div>
            )}
        </div>
    );
};
