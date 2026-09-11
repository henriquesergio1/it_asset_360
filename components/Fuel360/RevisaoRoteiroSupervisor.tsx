import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSimulacaoPublica, getSimulacaoSugestoes, saveSimulacaoSugestao } from './services/apiService';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
    MapPin,
    Navigation,
    Clock,
    Calendar,
    Users,
    ChevronRight,
    MessageSquarePlus,
    Share2,
    Copy,
    Check,
    CheckCircle2,
    AlertCircle,
    Building2,
    ArrowRight,
    ListFilter,
    Send,
    Eye,
    Sliders,
    XCircle,
    UserCheck,
    Sparkles,
    Briefcase
} from 'lucide-react';
import {
    UI_CARD_CONTAINER,
    UI_BUTTON_PRIMARY,
    UI_BUTTON_SECONDARY,
    UI_BUTTON_SUCCESS,
    UI_INPUT_BASE,
    UI_TEXTAREA_BASE,
    UI_TABLE_CONTAINER,
    UI_TABLE_TH,
    UI_TABLE_TD,
    UI_BADGE_SUCCESS
} from '../../constants';

// --- HELPER PARA FORMATAÇÃO DE MINUTOS EM HORAS/MINUTOS ---
const formatMinutesToHours = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '0 min';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
};

// --- FUNÇÃO PARA CRIAR ÍCONE DE PARADA NUMERADA NO MAPA ---
const createNumberedPinIcon = (seq: number, isSelected: boolean = false) => {
    const bg = isSelected ? '#ef4444' : '#2563eb';
    return L.divIcon({
        className: 'custom-numbered-pin',
        iconSize: [32, 42],
        iconAnchor: [16, 40],
        popupAnchor: [0, -38],
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35));">
                <div style="
                    background: ${bg};
                    color: #ffffff;
                    width: 30px;
                    height: 30px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 2px solid #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: 11px;
                ">
                    <span style="transform: rotate(45deg);">${seq}</span>
                </div>
            </div>
        `
    });
};

// --- AJUSTADOR DE LIMITES DO MAPA ---
const MapFitBounds: React.FC<{ bounds: L.LatLngBoundsExpression | null }> = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds) {
            try {
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
                setTimeout(() => map.invalidateSize(), 250);
            } catch (e) {
                console.warn('Erro ao ajustar bounds do mapa:', e);
            }
        }
    }, [bounds, map]);
    return null;
};

export const RevisaoRoteiroSupervisor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const simId = Number(id);

    // Estados de Carga
    const [loading, setLoading] = useState<boolean>(true);
    const [simulacaoData, setSimulacaoData] = useState<any>(null);
    const [sugestoes, setSugestoes] = useState<any[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Filtros de Setor, Semana e Dia
    const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
    const [selectedWeek, setSelectedWeek] = useState<string>('ALL'); // 'ALL', '13', '24'
    const [selectedDay, setSelectedDay] = useState<string>('SEGUNDA-FEIRA');

    // Modais
    const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState<boolean>(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
    const [selectedClientForSuggestion, setSelectedClientForSuggestion] = useState<any | null>(null);

    // Formulário de Sugestão
    const [supervisorName, setSupervisorName] = useState<string>(() => {
        return localStorage.getItem('fuel360_supervisor_name') || '';
    });
    const [tipoAjuste, setTipoAjuste] = useState<string>('DIA_ESPECIFICO');
    const [diaSugerido, setDiaSugerido] = useState<string>('TERÇA-FEIRA');
    const [semanaSugerida, setSemanaSugerida] = useState<string>('1_3');
    const [observacao, setObservacao] = useState<string>('');
    const [savingSuggestion, setSavingSuggestion] = useState<boolean>(false);
    const [copiedLink, setCopiedLink] = useState<boolean>(false);

    // Carregar Dados da Simulação
    const loadSimulation = async () => {
        if (!simId || isNaN(simId)) {
            setErrorMsg('Identificador de simulação inválido.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setErrorMsg(null);
        try {
            const data = await getSimulacaoPublica(simId);
            if (!data) {
                setErrorMsg('Simulação não encontrada ou indisponível.');
                setLoading(false);
                return;
            }
            setSimulacaoData(data);

            // Carregar sugestões já cadastradas
            const sugs = await getSimulacaoSugestoes(simId);
            setSugestoes(sugs || []);
        } catch (err: any) {
            console.error('Erro ao carregar simulação pública:', err);
            setErrorMsg(err.message || 'Falha ao consultar simulação.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSimulation();
    }, [simId]);

    // Extrair Lista de Vendedores / Setores da Simulação
    const sellersList = useMemo(() => {
        if (!simulacaoData || !simulacaoData.snapshot) return [];
        const snapshot = simulacaoData.snapshot;

        // Se o snapshot tiver lista de setores/vendedores
        if (Array.isArray(snapshot.sellers)) {
            return snapshot.sellers.map((s: any) => ({
                id: String(s.id || s.Cod_Vend || s.Nome),
                name: s.name || s.Nome || `Vendedor ${s.id}`,
                clients: s.clients || s.visitas || []
            }));
        }

        // Se o snapshot tiver lista de visitas diretas
        if (Array.isArray(snapshot.visitas)) {
            const map = new Map<string, { id: string; name: string; clients: any[] }>();
            snapshot.visitas.forEach((v: any) => {
                const sId = String(v.Cod_Vend || v.Nome_Vendedor || '1');
                if (!map.has(sId)) {
                    map.set(sId, { id: sId, name: v.Nome_Vendedor || `Vendedor ${sId}`, clients: [] });
                }
                map.get(sId)?.clients.push(v);
            });
            return Array.from(map.values());
        }

        return [];
    }, [simulacaoData]);

    // Setar o primeiro vendedor por default
    useEffect(() => {
        if (sellersList.length > 0 && selectedSeller === 'ALL') {
            setSelectedSeller(sellersList[0].id);
        }
    }, [sellersList]);

    // Obter clientes do setor selecionado
    const currentSellerClients = useMemo(() => {
        if (sellersList.length === 0) return [];
        if (selectedSeller === 'ALL') {
            return sellersList.flatMap(s => s.clients);
        }
        const s = sellersList.find(item => item.id === selectedSeller);
        return s ? s.clients : [];
    }, [sellersList, selectedSeller]);

    // Filtragem por Semana e Dia
    const filteredVisits = useMemo(() => {
        return currentSellerClients.filter((c: any) => {
            // Normalizar Dia da Semana
            const diaC = String(c.Dia_Semana || c.dia || '').toUpperCase().trim();
            const diaFiltro = selectedDay.toUpperCase().trim();
            if (selectedDay !== 'ALL' && !diaC.includes(diaFiltro.replace('-FEIRA', ''))) {
                return false;
            }

            // Normalizar Semana (1 e 3 vs 2 e 4)
            if (selectedWeek !== 'ALL') {
                const per = String(c.Periodicidade || c.periodicidade || '').toUpperCase();
                if (selectedWeek === '13' && (per.includes('2_4') || per.includes('2 E 4') || per.includes('24'))) {
                    return false;
                }
                if (selectedWeek === '24' && (per.includes('1_3') || per.includes('1 E 3') || per.includes('13'))) {
                    return false;
                }
            }

            return true;
        }).sort((a: any, b: any) => {
            const seqA = Number(a.Sequencia_13 || a.Sequencia_24 || a.sequencia || a.ordem || 999);
            const seqB = Number(b.Sequencia_13 || b.Sequencia_24 || b.sequencia || b.ordem || 999);
            return seqA - seqB;
        });
    }, [currentSellerClients, selectedDay, selectedWeek]);

    // Métricas de Tempo da Rota Selecionada
    const metrics = useMemo(() => {
        const totalVisitas = filteredVisits.length;
        // Padrão de 20 min por visita (ou campo salvo)
        const tempoAtendimentoMin = totalVisitas * 20;

        // Cálculo aproximado de KM e Percurso viário entre as visitas ordenadas
        let totalKm = 0;
        for (let i = 0; i < filteredVisits.length - 1; i++) {
            const p1 = filteredVisits[i];
            const p2 = filteredVisits[i + 1];
            if (p1.Lat && p1.Long && p2.Lat && p2.Long) {
                const dLat = (p2.Lat - p1.Lat) * 111;
                const dLon = (p2.Long - p1.Long) * 111;
                totalKm += Math.sqrt(dLat * dLat + dLon * dLon) * 1.25; // Fator viário
            }
        }

        // Velocidade média urbana de ~25 km/h para cálculo de percurso
        const tempoPercursoMin = Math.round((totalKm / 25) * 60);
        const tempoTotalMin = tempoAtendimentoMin + tempoPercursoMin;

        return {
            totalVisitas,
            totalKm: Math.round(totalKm),
            tempoAtendimentoMin,
            tempoPercursoMin,
            tempoTotalMin
        };
    }, [filteredVisits]);

    // Limites do Mapa
    const mapBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
        const pts: [number, number][] = [];
        filteredVisits.forEach((v: any) => {
            const lat = Number(v.Lat || v.Latitude);
            const lon = Number(v.Long || v.Longitude);
            if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001) {
                pts.push([lat, lon]);
            }
        });
        if (pts.length === 0) return null;
        if (pts.length === 1) {
            return [
                [pts[0][0] - 0.01, pts[0][1] - 0.01],
                [pts[0][0] + 0.01, pts[0][1] + 0.01]
            ];
        }
        return pts as L.LatLngBoundsExpression;
    }, [filteredVisits]);

    // Coordenadas para Polyline
    const routePolyline = useMemo<[number, number][]>(() => {
        const pts: [number, number][] = [];
        filteredVisits.forEach((v: any) => {
            const lat = Number(v.Lat || v.Latitude);
            const lon = Number(v.Long || v.Longitude);
            if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001) {
                pts.push([lat, lon]);
            }
        });
        return pts;
    }, [filteredVisits]);

    // Abrir Modal de Sugestão
    const handleOpenSuggestionModal = (client?: any) => {
        setSelectedClientForSuggestion(client || null);
        setTipoAjuste(client ? 'DIA_ESPECIFICO' : 'OUTRO');
        setObservacao('');
        setIsSuggestionModalOpen(true);
    };

    // Salvar Sugestão
    const handleSaveSuggestion = async () => {
        if (!observacao.trim()) {
            alert('Por favor, digite a observação ou justificativa do ajuste.');
            return;
        }

        const name = supervisorName.trim() || 'Supervisor da Equipe';
        localStorage.setItem('fuel360_supervisor_name', name);
        setSavingSuggestion(true);

        try {
            const payload = {
                supervisorNome: name,
                codCliente: selectedClientForSuggestion?.Cod_Cliente || selectedClientForSuggestion?.id || null,
                clienteNome: selectedClientForSuggestion?.Razao_Social || selectedClientForSuggestion?.nome || null,
                vendedorNome: sellersList.find(s => s.id === selectedSeller)?.name || 'Vendedor',
                diaAtual: selectedClientForSuggestion?.Dia_Semana || selectedDay,
                diaSugerido: tipoAjuste === 'MUDANCA_DIA' ? diaSugerido : null,
                semanaAtual: selectedClientForSuggestion?.Periodicidade || selectedWeek,
                semanaSugerida: tipoAjuste === 'MUDANCA_SEMANA' ? semanaSugerida : null,
                tipoAjuste,
                observacao: observacao.trim()
            };

            const res = await saveSimulacaoSugestao(simId, payload);
            if (res && res.success) {
                alert('Sugestão registrada com sucesso! O analista de rotas poderá conferir e aplicar na rota.');
                setIsSuggestionModalOpen(false);
                // Recarregar lista de sugestões
                const updated = await getSimulacaoSugestoes(simId);
                setSugestoes(updated || []);
            }
        } catch (e: any) {
            alert('Erro ao salvar sugestão: ' + e.message);
        } finally {
            setSavingSuggestion(false);
        }
    };

    // Copiar Link da Página
    const handleCopyPageLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    // Renderização de Estados de Carregamento
    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    Carregando Simulação de Rotas para o Supervisor...
                </p>
            </div>
        );
    }

    if (errorMsg || !simulacaoData) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 text-center p-6">
                <div className="p-4 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-full">
                    <AlertCircle size={36} />
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Não foi possível carregar o roteiro</h3>
                <p className="text-xs text-slate-500 max-w-md">{errorMsg || 'Simulação inexistente ou removida.'}</p>
                <Link to="/fuel360/roteirizador" className={`${UI_BUTTON_PRIMARY} text-xs py-2 px-6`}>
                    Voltar ao Roteirizador
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-[1800px] mx-auto pb-12">
            {/* CABEÇALHO DA TELA DE REVISÃO */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                        <UserCheck size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                Validação de Rota • Supervisor
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                                ID #{simulacaoData.id}
                            </span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                            {simulacaoData.periodo}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Criado por <strong>{simulacaoData.usuarioSimulacao}</strong> • KM Total: <strong>{Math.round(simulacaoData.totalKm)} km</strong>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setIsHistoryModalOpen(true)}
                        className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-3 flex items-center gap-2 relative`}
                    >
                        <Briefcase size={14} className="text-blue-500" />
                        Sugestões Enviadas
                        {sugestoes.length > 0 && (
                            <span className="ml-1 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                {sugestoes.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => handleOpenSuggestionModal()}
                        className={`${UI_BUTTON_SUCCESS} text-xs py-2 px-4 flex items-center gap-2 shadow-md`}
                    >
                        <MessageSquarePlus size={14} />
                        Sugerir Ajuste Geral
                    </button>

                    <button
                        onClick={handleCopyPageLink}
                        className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-3 flex items-center gap-1.5`}
                        title="Copiar link para enviar ao supervisor"
                    >
                        {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                    </button>
                </div>
            </div>

            {/* SELETORES E FILTROS DE SETOR, SEMANA E DIA */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Seletor de Vendedor / Setor */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Selecione o Vendedor / Setor
                        </label>
                        <select
                            value={selectedSeller}
                            onChange={e => setSelectedSeller(e.target.value)}
                            className={`${UI_INPUT_BASE} text-xs py-2 font-bold cursor-pointer`}
                        >
                            {sellersList.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.clients.length} PDVs)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Seletor de Semana (1 e 3 vs 2 e 4) */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Semana de Atendimento
                        </label>
                        <select
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(e.target.value)}
                            className={`${UI_INPUT_BASE} text-xs py-2 font-bold cursor-pointer`}
                        >
                            <option value="ALL">Todas as Semanas (Visão Geral)</option>
                            <option value="13">Semana 1 e 3 (Ímpar)</option>
                            <option value="24">Semana 2 e 4 (Par)</option>
                        </select>
                    </div>

                    {/* Seletor do Dia da Semana */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Dia da Semana
                        </label>
                        <select
                            value={selectedDay}
                            onChange={e => setSelectedDay(e.target.value)}
                            className={`${UI_INPUT_BASE} text-xs py-2 font-bold cursor-pointer`}
                        >
                            <option value="ALL">Todos os Dias</option>
                            <option value="SEGUNDA-FEIRA">Segunda-feira</option>
                            <option value="TERÇA-FEIRA">Terça-feira</option>
                            <option value="QUARTA-FEIRA">Quarta-feira</option>
                            <option value="QUINTA-FEIRA">Quinta-feira</option>
                            <option value="SEXTA-FEIRA">Sexta-feira</option>
                            <option value="SÁBADO">Sábado</option>
                        </select>
                    </div>
                </div>

                {/* CARDS DE MÉTRICAS E TEMPOS DA ROTA (ATENDIMENTO, PERCURSO E TOTAL) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>PDVs no Dia</span>
                            <Building2 size={14} className="text-blue-500" />
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                            {metrics.totalVisitas}
                        </div>
                        <div className="text-[10px] text-slate-500">visitas programadas</div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>Distância Estimada</span>
                            <Navigation size={14} className="text-emerald-500" />
                        </div>
                        <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {metrics.totalKm} km
                        </div>
                        <div className="text-[10px] text-slate-500">deslocamento viário</div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>Tempo Atendimento</span>
                            <Clock size={14} className="text-amber-500" />
                        </div>
                        <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                            {formatMinutesToHours(metrics.tempoAtendimentoMin)}
                        </div>
                        <div className="text-[10px] text-slate-500">~20 min por visita</div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-slate-500 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>Tempo Percurso</span>
                            <Navigation size={14} className="text-indigo-500" />
                        </div>
                        <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {formatMinutesToHours(metrics.tempoPercursoMin)}
                        </div>
                        <div className="text-[10px] text-slate-500">deslocamento entre pontos</div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 text-[10px] font-extrabold uppercase tracking-wider">
                            <span>Tempo Total Jornada</span>
                            <Clock size={14} className="text-blue-600" />
                        </div>
                        <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                            {formatMinutesToHours(metrics.tempoTotalMin)}
                        </div>
                        <div className="text-[10px] text-blue-600 font-bold">Atendimento + Percurso</div>
                    </div>
                </div>
            </div>

            {/* ÁREA PRINCIPAL: MAPA INTERATIVO + TABELA DO ITINERÁRIO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* MAPA INTERATIVO LEAFLET */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-3 px-2">
                        <div className="flex items-center gap-2">
                            <MapPin size={18} className="text-emerald-600" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Traçado no Mapa • Sequenciamento
                            </h3>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">
                            {filteredVisits.length} paradas no mapa
                        </span>
                    </div>

                    <div className="w-full h-[520px] rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800">
                        {mapBounds ? (
                            <MapContainer
                                style={{ width: '100%', height: '100%' }}
                                zoom={13}
                                center={[-23.5505, -46.6333]}
                            >
                                <MapFitBounds bounds={mapBounds} />
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />

                                {/* Traçado Viário da Rota */}
                                {routePolyline.length > 1 && (
                                    <Polyline
                                        positions={routePolyline}
                                        pathOptions={{
                                            color: '#2563eb',
                                            weight: 3.5,
                                            dashArray: '6, 6',
                                            opacity: 0.8
                                        }}
                                    />
                                )}

                                {/* Marcadores Numerados dos Clientes */}
                                {filteredVisits.map((v: any, index: number) => {
                                    const lat = Number(v.Lat || v.Latitude);
                                    const lon = Number(v.Long || v.Longitude);
                                    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) < 0.001) return null;

                                    const seq = index + 1;
                                    return (
                                        <Marker
                                            key={`visit-${v.Cod_Cliente || index}-${index}`}
                                            position={[lat, lon]}
                                            icon={createNumberedPinIcon(seq)}
                                        >
                                            <Popup>
                                                <div className="text-xs p-1 space-y-1.5 font-sans min-w-[200px]">
                                                    <div className="flex items-center justify-between gap-2 border-b pb-1">
                                                        <span className="font-extrabold text-blue-600">Parada #{seq}</span>
                                                        <span className="text-[10px] text-slate-500 font-mono">PDV {v.Cod_Cliente}</span>
                                                    </div>
                                                    <p className="font-bold text-slate-900 leading-tight">
                                                        {v.Razao_Social || v.nome}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {v.Endereco || 'Endereço não cadastrado'} - {v.Bairro}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] text-slate-600 bg-slate-100 p-1 rounded">
                                                        <span>Dia: <b>{v.Dia_Semana || selectedDay}</b></span>
                                                        <span>Sem: <b>{v.Periodicidade || selectedWeek}</b></span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleOpenSuggestionModal(v)}
                                                        className="w-full mt-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-1 px-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                                                    >
                                                        <MessageSquarePlus size={12} />
                                                        Sugerir Ajuste neste Cliente
                                                    </button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </MapContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-2 p-8">
                                <MapPin size={40} className="text-slate-300 animate-pulse" />
                                <p className="text-xs font-bold">Nenhum ponto com coordenadas válidas para o filtro selecionado.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* TABELA DE ITINERÁRIO OPERACIONAL */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-3 px-2">
                        <div className="flex items-center gap-2">
                            <ListFilter size={18} className="text-blue-600" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                                Sequência de Visitas ({filteredVisits.length})
                            </h3>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            {selectedDay}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[520px] pr-1 space-y-2">
                        {filteredVisits.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 text-xs">
                                Nenhuma visita agendada para este dia/semana.
                            </div>
                        ) : (
                            filteredVisits.map((v: any, idx: number) => {
                                const seq = idx + 1;
                                return (
                                    <div
                                        key={`item-${v.Cod_Cliente || idx}-${idx}`}
                                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex items-start justify-between gap-3 hover:border-blue-400 transition-all"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                                {seq}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                                                    {v.Razao_Social || v.nome}
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    PDV {v.Cod_Cliente} • {v.Endereco || v.Bairro || 'Endereço não informado'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                                    <span>{v.Bairro} - {v.Cidade}</span>
                                                    <span>•</span>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">~20 min</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleOpenSuggestionModal(v)}
                                            className="p-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 shrink-0 cursor-pointer"
                                            title="Sugerir alteração neste cliente"
                                        >
                                            <MessageSquarePlus size={14} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL PARA FORMULÁRIO DE SUGESTÃO */}
            {isSuggestionModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                                    <MessageSquarePlus size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                        Sugerir Ajuste na Rota
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Feedback e correções para o analista de rotas
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSuggestionModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            {/* Nome do Supervisor */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                                    Seu Nome (Supervisor)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: Carlos Silva"
                                    value={supervisorName}
                                    onChange={e => setSupervisorName(e.target.value)}
                                    className={UI_INPUT_BASE}
                                />
                            </div>

                            {/* Cliente em Questão */}
                            {selectedClientForSuggestion ? (
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cliente Selecionado</span>
                                    <div className="font-black text-slate-900 dark:text-white text-xs mt-0.5">
                                        {selectedClientForSuggestion.Razao_Social || selectedClientForSuggestion.nome}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                        Dia Atual: <b>{selectedClientForSuggestion.Dia_Semana || selectedDay}</b> • Semana: <b>{selectedClientForSuggestion.Periodicidade || selectedWeek}</b>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px]">
                                    Ajuste geral para o setor selecionado ({selectedDay}).
                                </div>
                            )}

                            {/* Tipo de Ajuste */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                                    Tipo de Ajuste
                                </label>
                                <select
                                    value={tipoAjuste}
                                    onChange={e => setTipoAjuste(e.target.value)}
                                    className={`${UI_INPUT_BASE} font-bold cursor-pointer`}
                                >
                                    <option value="DIA_ESPECIFICO">Cliente só atende em dia específico</option>
                                    <option value="MUDANCA_DIA">Alterar dia de atendimento</option>
                                    <option value="MUDANCA_SEMANA">Alterar semana de atendimento</option>
                                    <option value="MUDANCA_SETOR">Transferir para outro setor / vendedor</option>
                                    <option value="OUTRO">Outra observação / Restrição</option>
                                </select>
                            </div>

                            {/* Campos Condicionais */}
                            {tipoAjuste === 'MUDANCA_DIA' && (
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                                        Dia Sugerido
                                    </label>
                                    <select
                                        value={diaSugerido}
                                        onChange={e => setDiaSugerido(e.target.value)}
                                        className={`${UI_INPUT_BASE} font-bold cursor-pointer`}
                                    >
                                        <option value="SEGUNDA-FEIRA">Segunda-feira</option>
                                        <option value="TERÇA-FEIRA">Terça-feira</option>
                                        <option value="QUARTA-FEIRA">Quarta-feira</option>
                                        <option value="QUINTA-FEIRA">Quinta-feira</option>
                                        <option value="SEXTA-FEIRA">Sexta-feira</option>
                                        <option value="SÁBADO">Sábado</option>
                                    </select>
                                </div>
                            )}

                            {tipoAjuste === 'MUDANCA_SEMANA' && (
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                                        Semana Sugerida
                                    </label>
                                    <select
                                        value={semanaSugerida}
                                        onChange={e => setSemanaSugerida(e.target.value)}
                                        className={`${UI_INPUT_BASE} font-bold cursor-pointer`}
                                    >
                                        <option value="1_3">Semana 1 e 3</option>
                                        <option value="2_4">Semana 2 e 4</option>
                                        <option value="SEMANAL">Semanal (Toda semana)</option>
                                    </select>
                                </div>
                            )}

                            {/* Justificativa / Observação */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                                    Observação / Justificativa detalhada *
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Ex: Este cliente só recebe mercadoria na Terça de manhã devido à escala do comprador..."
                                    value={observacao}
                                    onChange={e => setObservacao(e.target.value)}
                                    className={UI_TEXTAREA_BASE}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setIsSuggestionModalOpen(false)}
                                className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-4`}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveSuggestion}
                                disabled={savingSuggestion}
                                className={`${UI_BUTTON_SUCCESS} text-xs py-2 px-5 flex items-center gap-1.5`}
                            >
                                <Send size={13} />
                                {savingSuggestion ? 'Enviando...' : 'Enviar Sugestão'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE HISTÓRICO DE SUGESTÕES DO SUPERVISOR */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-fade-in max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    Sugestões Enviadas ({sugestoes.length})
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Apontamentos registrados nesta simulação para conferência do analista
                                </p>
                            </div>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                            {sugestoes.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    Nenhuma sugestão registrada até o momento.
                                </div>
                            ) : (
                                sugestoes.map((sug: any) => (
                                    <div
                                        key={sug.ID_Sugestao}
                                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-blue-600 dark:text-blue-400">
                                                {sug.SupervisorNome || 'Supervisor'}
                                            </span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                                sug.Status === 'APLICADO' ? 'bg-emerald-100 text-emerald-700' :
                                                sug.Status === 'REJEITADO' ? 'bg-red-100 text-red-700' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {sug.Status || 'PENDENTE'}
                                            </span>
                                        </div>

                                        {sug.ClienteNome && (
                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                PDV: {sug.ClienteNome} (Cód {sug.Cod_Cliente})
                                            </div>
                                        )}

                                        <div className="text-slate-600 dark:text-slate-300">
                                            {sug.Observacao}
                                        </div>

                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                            <span>Tipo: <b>{sug.TipoAjuste}</b></span>
                                            {sug.DiaSugerido && <span>Dia Sugerido: <b>{sug.DiaSugerido}</b></span>}
                                            {sug.SemanaSugerida && <span>Semana Sugerida: <b>{sug.SemanaSugerida}</b></span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-5`}
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
