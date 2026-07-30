import React, { useState, useContext, useMemo } from 'react';
import { DataContext } from './context/DataContext';
import { CalendarIcon, PlusCircleIcon, TrashIcon, XCircleIcon, CheckCircleIcon, SpinnerIcon, ExclamationIcon } from './icons';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, FileText, Filter, ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';

// Helper para formatar data ignorando fuso horário local (Força UTC)
const formatUtcDate = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

const DeleteAusenciaModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (motivo: string) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, onConfirm, isLoading }) => {
    const [motivo, setMotivo] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 w-full max-w-sm text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-6">
                    <TrashIcon className="w-8 h-8 text-red-500 dark:text-red-400"/>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Excluir Ausência</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                    Para fins de auditoria, informe o motivo da exclusão deste registro.
                </p>

                <textarea 
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-6 resize-none"
                    placeholder="Motivo (Obrigatório)..."
                    rows={2}
                    autoFocus
                />

                <div className="flex space-x-3 justify-center">
                    <button onClick={onClose} disabled={isLoading} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-6 py-3 rounded-xl font-bold text-sm border border-slate-200 dark:border-slate-700 shadow-sm">Cancelar</button>
                    <button 
                        onClick={() => onConfirm(motivo)} 
                        disabled={isLoading || !motivo.trim()} 
                        className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center disabled:opacity-50 shadow-lg shadow-red-600/20"
                    >
                        {isLoading ? <SpinnerIcon className="w-4 h-4 mr-2"/> : 'Excluir'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const GestaoAusencias: React.FC = () => {
    const { colaboradores, ausencias, addAusencia, deleteAusencia } = useContext(DataContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Delete State
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Form States
    const [colabId, setColabId] = useState('');
    const [dtInicio, setDtInicio] = useState('');
    const [dtFim, setDtFim] = useState('');
    const [motivo, setMotivo] = useState('');
    const [error, setError] = useState('');

    // Filtros, Busca, Ordenação e Paginação
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrupo, setSelectedGrupo] = useState('');
    const [sortField, setSortField] = useState<'colaborador' | 'codigo' | 'grupo' | 'periodo' | 'motivo'>('periodo');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Mapeamento otimizado de Colaboradores para rápida busca por ID/Pulsus
    const colabMap = useMemo(() => {
        const map = new Map<number, any>();
        colaboradores.forEach(c => {
            map.set(c.ID_Colaborador, c);
            if (c.ID_Pulsus) map.set(c.ID_Pulsus, c);
        });
        return map;
    }, [colaboradores]);

    // Grupos únicos para o filtro dropdown
    const gruposDisponiveis = useMemo(() => {
        const set = new Set<string>();
        colaboradores.forEach(c => {
            if (c.Grupo && c.Grupo.trim() !== '') {
                set.add(c.Grupo.trim());
            }
        });
        return Array.from(set).sort();
    }, [colaboradores]);

    // Filtragem dos Registros
    const ausenciasFiltradas = useMemo(() => {
        return ausencias.filter(aus => {
            const colab = colabMap.get(aus.ID_Colaborador) || colaboradores.find(c => c.ID_Pulsus === aus.ID_Pulsus);
            const nome = (aus.NomeColaborador || colab?.Nome || '').toLowerCase();
            const pulsus = String(aus.ID_Pulsus || colab?.ID_Pulsus || '').toLowerCase();
            const setor = String(colab?.CodigoSetor || '').toLowerCase();
            const motivoStr = (aus.Motivo || '').toLowerCase();
            const grupo = (colab?.Grupo || '').toLowerCase();

            const query = searchTerm.toLowerCase().trim();
            const matchesSearch = !query || nome.includes(query) || pulsus.includes(query) || setor.includes(query) || motivoStr.includes(query);
            const matchesGrupo = !selectedGrupo || grupo === selectedGrupo.toLowerCase();

            return matchesSearch && matchesGrupo;
        });
    }, [ausencias, colabMap, colaboradores, searchTerm, selectedGrupo]);

    // Ordenação dos Registros
    const ausenciasOrdenadas = useMemo(() => {
        const copy = [...ausenciasFiltradas];
        copy.sort((a, b) => {
            const colabA = colabMap.get(a.ID_Colaborador) || colaboradores.find(c => c.ID_Pulsus === a.ID_Pulsus);
            const colabB = colabMap.get(b.ID_Colaborador) || colaboradores.find(c => c.ID_Pulsus === b.ID_Pulsus);

            let valA: any = '';
            let valB: any = '';

            if (sortField === 'colaborador') {
                valA = (a.NomeColaborador || colabA?.Nome || '').toLowerCase();
                valB = (b.NomeColaborador || colabB?.Nome || '').toLowerCase();
            } else if (sortField === 'codigo') {
                valA = Number(colabA?.CodigoSetor || 0);
                valB = Number(colabB?.CodigoSetor || 0);
                if (valA === valB) {
                    valA = Number(a.ID_Pulsus || colabA?.ID_Pulsus || 0);
                    valB = Number(b.ID_Pulsus || colabB?.ID_Pulsus || 0);
                }
            } else if (sortField === 'grupo') {
                valA = (colabA?.Grupo || '').toLowerCase();
                valB = (colabB?.Grupo || '').toLowerCase();
            } else if (sortField === 'periodo') {
                valA = new Date(a.DataInicio).getTime();
                valB = new Date(b.DataInicio).getTime();
            } else if (sortField === 'motivo') {
                valA = (a.Motivo || '').toLowerCase();
                valB = (b.Motivo || '').toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return copy;
    }, [ausenciasFiltradas, sortField, sortOrder, colabMap, colaboradores]);

    // Lógica de Paginação
    const totalItems = ausenciasOrdenadas.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const pageIndex = Math.min(Math.max(1, currentPage), totalPages);

    const ausenciasPaginadas = useMemo(() => {
        const start = (pageIndex - 1) * itemsPerPage;
        return ausenciasOrdenadas.slice(start, start + itemsPerPage);
    }, [ausenciasOrdenadas, pageIndex, itemsPerPage]);

    // Alternar ordenação ao clicar no cabeçalho
    const handleSort = (field: 'colaborador' | 'codigo' | 'grupo' | 'periodo' | 'motivo') => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    // Renderizar ícone da ordenação
    const renderSortIcon = (field: 'colaborador' | 'codigo' | 'grupo' | 'periodo' | 'motivo') => {
        if (sortField !== field) {
            return <ArrowUpDown size={14} className="ml-1.5 opacity-40 inline-block" />;
        }
        return sortOrder === 'asc' ? (
            <ArrowUp size={14} className="ml-1.5 text-blue-600 dark:text-sky-400 inline-block font-bold" />
        ) : (
            <ArrowDown size={14} className="ml-1.5 text-blue-600 dark:text-sky-400 inline-block font-bold" />
        );
    };

    // Exportação Excel
    const handleExportExcel = () => {
        const exportData = ausenciasOrdenadas.map(aus => {
            const colab = colabMap.get(aus.ID_Colaborador) || colaboradores.find(c => c.ID_Pulsus === aus.ID_Pulsus);
            const isInactive = colab ? (colab.Ativo === false || (colab.Ativo as any) === 0) : false;
            return {
                'Código Setor': colab?.CodigoSetor || '-',
                'ID Pulsus': aus.ID_Pulsus || colab?.ID_Pulsus || '-',
                'Colaborador': aus.NomeColaborador || colab?.Nome || '-',
                'Status Colaborador': isInactive ? 'Inativo' : 'Ativo',
                'Grupo / Cargo': colab?.Grupo || '-',
                'Data Início': formatUtcDate(aus.DataInicio),
                'Data Fim': formatUtcDate(aus.DataFim),
                'Motivo': aus.Motivo
            };
        });
        exportToExcel(exportData, `relatorio_ausencias_fuel360_${new Date().toISOString().slice(0, 10)}`);
    };

    // Exportação PDF
    const handleExportPDF = () => {
        const headers = ['Setor', 'ID Pulsus', 'Colaborador', 'Status', 'Grupo', 'Período', 'Motivo'];
        const rows = ausenciasOrdenadas.map(aus => {
            const colab = colabMap.get(aus.ID_Colaborador) || colaboradores.find(c => c.ID_Pulsus === aus.ID_Pulsus);
            const isInactive = colab ? (colab.Ativo === false || (colab.Ativo as any) === 0) : false;
            return [
                String(colab?.CodigoSetor || '-'),
                String(aus.ID_Pulsus || colab?.ID_Pulsus || '-'),
                aus.NomeColaborador || colab?.Nome || '-',
                isInactive ? 'INATIVO' : 'ATIVO',
                colab?.Grupo || '-',
                `${formatUtcDate(aus.DataInicio)} a ${formatUtcDate(aus.DataFim)}`,
                aus.Motivo
            ];
        });
        exportToPDF(headers, rows, `relatorio_ausencias_fuel360_${new Date().toISOString().slice(0, 10)}`, 'Relatório Geral de Ausências - Fuel360');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!colabId || !dtInicio || !dtFim || !motivo) {
            setError("Todos os campos são obrigatórios.");
            return;
        }

        if (new Date(dtInicio) > new Date(dtFim)) {
            setError("A data inicial não pode ser maior que a data final.");
            return;
        }

        setLoading(true);
        try {
            await addAusencia({
                ID_Colaborador: parseInt(colabId),
                DataInicio: dtInicio,
                DataFim: dtFim,
                Motivo: motivo
            });
            setIsModalOpen(false);
            setColabId('');
            setDtInicio('');
            setDtFim('');
            setMotivo('');
        } catch (e: any) {
            setError(e.message || "Erro ao salvar ausência.");
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async (motivoExclusao: string) => {
        if (!deleteId) return;
        setIsDeleting(true);
        try {
            await deleteAusencia(deleteId, motivoExclusao);
            setDeleteId(null);
        } catch (e: any) {
            alert(e.message || 'Erro ao excluir');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-8">
            <DeleteAusenciaModal 
                isOpen={!!deleteId} 
                onClose={() => setDeleteId(null)} 
                onConfirm={confirmDelete}
                isLoading={isDeleting}
            />

            {/* Cabeçalho e Ações Principais */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white mb-2 tracking-tight">Gestão de Ausências</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Controle de Férias, Atestados e Faltas para bloqueio de pagamento.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center text-xs shadow-md shadow-emerald-600/20 transition hover:-translate-y-0.5 active:scale-95"
                        title="Exportar em Planilha Excel"
                    >
                        <FileSpreadsheet size={16} className="mr-2" /> Excel
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center text-xs shadow-md shadow-rose-600/20 transition hover:-translate-y-0.5 active:scale-95"
                        title="Exportar em Documento PDF"
                    >
                        <FileText size={16} className="mr-2" /> PDF
                    </button>
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center text-sm shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 active:scale-95"
                    >
                        <PlusCircleIcon className="w-5 h-5 mr-2" /> Nova Ausência
                    </button>
                </div>
            </div>

            {/* Barra de Filtros, Busca e Paginação */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
                    {/* Campo de Busca */}
                    <div className="relative w-full sm:w-72">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            placeholder="Buscar por nome, setor, código..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none font-medium transition"
                        />
                    </div>

                    {/* Filtro por Grupo/Cargo */}
                    <div className="relative w-full sm:w-56">
                        <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={selectedGrupo}
                            onChange={e => { setSelectedGrupo(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none font-medium appearance-none transition cursor-pointer"
                        >
                            <option value="">Todos os Grupos / Setores</option>
                            {gruposDisponiveis.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Seletor de Itens Por Página */}
                <div className="flex items-center space-x-2 shrink-0 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <span>Exibir:</span>
                    <select
                        value={itemsPerPage}
                        onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-600 text-xs font-bold"
                    >
                        <option value={10}>10 por pág.</option>
                        <option value={25}>25 por pág.</option>
                        <option value={50}>50 por pág.</option>
                        <option value={100}>100 por pág.</option>
                    </select>
                </div>
            </div>

            {/* Listagem da Tabela */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300">
                        <thead className="text-xs text-slate-400 dark:text-slate-300 uppercase bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 font-semibold select-none">
                            <tr>
                                <th 
                                    onClick={() => handleSort('colaborador')} 
                                    className="p-5 tracking-wider cursor-pointer hover:text-blue-600 dark:hover:text-sky-400 transition"
                                >
                                    Colaborador {renderSortIcon('colaborador')}
                                </th>
                                <th 
                                    onClick={() => handleSort('codigo')} 
                                    className="p-5 tracking-wider cursor-pointer hover:text-blue-600 dark:hover:text-sky-400 transition"
                                >
                                    Código / Setor {renderSortIcon('codigo')}
                                </th>
                                <th 
                                    onClick={() => handleSort('grupo')} 
                                    className="p-5 tracking-wider cursor-pointer hover:text-blue-600 dark:hover:text-sky-400 transition"
                                >
                                    Grupo {renderSortIcon('grupo')}
                                </th>
                                <th 
                                    onClick={() => handleSort('periodo')} 
                                    className="p-5 tracking-wider cursor-pointer hover:text-blue-600 dark:hover:text-sky-400 transition"
                                >
                                    Período {renderSortIcon('periodo')}
                                </th>
                                <th 
                                    onClick={() => handleSort('motivo')} 
                                    className="p-5 tracking-wider cursor-pointer hover:text-blue-600 dark:hover:text-sky-400 transition"
                                >
                                    Motivo {renderSortIcon('motivo')}
                                </th>
                                <th className="p-5 tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {ausenciasPaginadas.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400 dark:text-slate-500">
                                        Nenhum registro de ausência encontrado.
                                    </td>
                                </tr>
                            ) : (
                                ausenciasPaginadas.map(aus => {
                                    const colab = colabMap.get(aus.ID_Colaborador) || colaboradores.find(c => c.ID_Pulsus === aus.ID_Pulsus);
                                    const isInactive = colab ? (colab.Ativo === false || (colab.Ativo as any) === 0) : false;

                                    return (
                                        <tr key={aus.ID_Ausencia} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                            <td className="p-5">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-slate-800 dark:text-white">
                                                        {aus.NomeColaborador || colab?.Nome || '-'}
                                                    </div>
                                                    {isInactive && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 uppercase tracking-widest" title="Colaborador Inativo no Sistema">
                                                            <UserX size={10} /> INATIVO
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                <div className="font-mono text-slate-800 dark:text-slate-100 font-bold">Setor: {colab?.CodigoSetor || '-'}</div>
                                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">Pulsus: {aus.ID_Pulsus || colab?.ID_Pulsus || '-'}</div>
                                            </td>
                                            <td className="p-5 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                                    {colab?.Grupo || '-'}
                                                </span>
                                            </td>
                                            <td className="p-5 font-mono text-slate-600 dark:text-slate-300">
                                                <div className="flex items-center text-xs font-bold">
                                                    <CalendarIcon className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-400"/>
                                                    {formatUtcDate(aus.DataInicio)} <span className="mx-2 text-slate-300 dark:text-slate-600">➜</span> {formatUtcDate(aus.DataFim)}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                                                    aus.Motivo.toLowerCase().includes('féria') ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 border-amber-100 dark:border-amber-800' :
                                                    aus.Motivo.toLowerCase().includes('atestado') ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-100 dark:border-red-800' :
                                                    'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                                }`}>
                                                    {aus.Motivo}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right">
                                                <button 
                                                    onClick={() => setDeleteId(aus.ID_Ausencia)} 
                                                    className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition" 
                                                    title="Excluir Registro de Ausência"
                                                >
                                                    <TrashIcon className="w-5 h-5"/>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Rodapé da Paginação */}
                {totalItems > 0 && (
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <div>
                            Exibindo <span className="font-bold text-slate-800 dark:text-white">{Math.min((pageIndex - 1) * itemsPerPage + 1, totalItems)}</span> a <span className="font-bold text-slate-800 dark:text-white">{Math.min(pageIndex * itemsPerPage, totalItems)}</span> de <span className="font-bold text-slate-800 dark:text-white">{totalItems}</span> registros
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={pageIndex === 1}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                title="Página Anterior"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 font-bold text-slate-800 dark:text-white">
                                {pageIndex} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={pageIndex === totalPages}
                                className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                title="Próxima Página"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Cadastro */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Registrar Ausência</h3>
                            <button onClick={() => setIsModalOpen(false)}><XCircleIcon className="w-6 h-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"/></button>
                        </div>

                        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-300 flex items-center"><ExclamationIcon className="w-5 h-5 mr-2"/>{error}</div>}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Colaborador</label>
                                <select 
                                    value={colabId} 
                                    onChange={e => setColabId(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    <option value="">Selecione...</option>
                                    {[...colaboradores].sort((a,b) => a.Nome.localeCompare(b.Nome)).map(c => (
                                        <option key={c.ID_Colaborador} value={c.ID_Colaborador}>{c.Nome} (ID: {c.ID_Pulsus}) {(!c.Ativo || (c.Ativo as any) === 0) ? '[INATIVO]' : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Início</label>
                                    <input type="date" value={dtInicio} onChange={e => setDtInicio(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-600"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Fim</label>
                                    <input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-600"/>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Motivo</label>
                                <select 
                                    value={motivo} 
                                    onChange={e => setMotivo(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    <option value="">Selecione...</option>
                                    <option value="Férias">Férias</option>
                                    <option value="Atestado Médico">Atestado Médico</option>
                                    <option value="Falta Justificada">Falta Justificada</option>
                                    <option value="Falta Injustificada">Falta Injustificada</option>
                                    <option value="Licença Maternidade/Paternidade">Licença Maternidade/Paternidade</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>

                            <div className="flex justify-end pt-4 space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 font-bold py-3 px-6 rounded-xl border border-slate-200 dark:border-slate-700">Cancelar</button>
                                <button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center shadow-lg shadow-blue-600/20">
                                    {loading ? <SpinnerIcon className="w-5 h-5 mr-2"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>} 
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
