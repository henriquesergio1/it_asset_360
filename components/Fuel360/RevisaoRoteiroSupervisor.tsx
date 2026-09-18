import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSimulacaoPublica, getSimulacaoSugestoes, saveSimulacaoSugestao, getOSRMData } from './services/apiService';
import { ThemeToggle } from '../ThemeToggle';
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
    Briefcase,
    Home
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
    UI_BADGE_SUCCESS,
    SYSTEM_VERSION
} from '../../constants';

// --- PALETA CROMÁTICA OFICIAL POR DIA DA SEMANA ---
export const DAY_COLORS: Record<string, { bg: string; text: string; border: string; hex: string; label: string }> = {
    'SEGUNDA-FEIRA': { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-500', hex: '#2563eb', label: 'SEG' },
    'TERÇA-FEIRA':   { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-500', hex: '#7c3aed', label: 'TER' },
    'QUARTA-FEIRA':  { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-500', hex: '#059669', label: 'QUA' },
    'QUINTA-FEIRA':  { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-500', hex: '#d97706', label: 'QUI' },
    'SEXTA-FEIRA':   { bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-500', hex: '#e11d48', label: 'SEX' },
    'SÁBADO':        { bg: 'bg-cyan-600', text: 'text-cyan-600', border: 'border-cyan-500', hex: '#0891b2', label: 'SÁB' },
    'DOMINGO':       { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-500', hex: '#64748b', label: 'DOM' },
    'SEM ATENDIMENTO': { bg: 'bg-red-600', text: 'text-red-600', border: 'border-red-500', hex: '#ef4444', label: 'SEM ATEND.' }
};

const WEEKDAYS = ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA'];

const normalizeDiaSemana = (dia: string | number | undefined): string => {
    if (dia !== undefined && dia !== null && String(dia).trim() !== '') {
        const d = String(dia).trim().toUpperCase();
        if (d === '1' || d.includes('SEG')) return 'SEGUNDA-FEIRA';
        if (d === '2' || d.includes('TER')) return 'TERÇA-FEIRA';
        if (d === '3' || d.includes('QUA')) return 'QUARTA-FEIRA';
        if (d === '4' || d.includes('QUI')) return 'QUINTA-FEIRA';
        if (d === '5' || d.includes('SEX')) return 'SEXTA-FEIRA';
        if (d === '6' || d.includes('SAB') || d.includes('SÁB')) return 'SÁBADO';
        if (d === '7' || d.includes('DOM')) return 'SEGUNDA-FEIRA';
    }
    return 'SEGUNDA-FEIRA';
};

// --- HELPER PARA FORMATAÇÃO DE MINUTOS EM HORAS/MINUTOS ---
const formatMinutesToHours = (totalMinutes: number): string => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '0 min';
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
};

// --- PARSER DE PERIODICIDADE PADRONIZADO COM O ROTEIRIZADOR ---
export type PeriodicidadeTipo = 'SEMANAL' | 'QUINZENAL_1_3' | 'QUINZENAL_2_4';

export const parsePeriodicidade = (raw: string | undefined): { tipo: PeriodicidadeTipo; original: string } => {
    const p = String(raw || '').trim().toUpperCase();
    if (!p) return { tipo: 'SEMANAL', original: 'SEMANAL' };

    // Quinzenal 1 3 (Semanas 1 e 3)
    if (
        p.includes('1 3') || p.includes('1, 3') || p.includes('1,3') || p.includes('1-3') || p.includes('1_3') || p.includes('1/3') ||
        p === '13' || (p.includes('QUINZENAL') && (p.includes('1') || p.includes('IMPAR') || p.includes('ÍMPAR')))
    ) {
        return { tipo: 'QUINZENAL_1_3', original: raw || '1 3' };
    }
    // Quinzenal 2 4 (Semanas 2 e 4)
    if (
        p.includes('2 4') || p.includes('2, 4') || p.includes('2,4') || p.includes('2-4') || p.includes('2_4') || p.includes('2/4') ||
        p === '24' || (p.includes('QUINZENAL') && (p.includes('2') || p.includes('PAR')))
    ) {
        return { tipo: 'QUINZENAL_2_4', original: raw || '2 4' };
    }
    // Quinzenal genérico
    if (p.includes('QUINZENAL') || p.includes('QUINZENA')) {
        return { tipo: 'QUINZENAL_1_3', original: raw || '1 3' };
    }
    return { tipo: 'SEMANAL', original: raw || 'SEMANAL' };
};

// --- HELPER PARA INFORMAÇÃO E BADGE DE FREQUÊNCIA ---
const getClientFrequencyInfo = (periodicidade: any) => {
    const parsed = parsePeriodicidade(periodicidade);
    if (parsed.tipo === 'QUINZENAL_1_3') {
        return {
            label: 'Semana 1 e 3 (Ímpar)',
            shortLabel: '1 3',
            code: '1 3',
            tipo: 'QUINZENAL_1_3',
            badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800'
        };
    }
    if (parsed.tipo === 'QUINZENAL_2_4') {
        return {
            label: 'Semana 2 e 4 (Par)',
            shortLabel: '2 4',
            code: '2 4',
            tipo: 'QUINZENAL_2_4',
            badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800'
        };
    }
    return {
        label: 'Semanal (1, 2, 3 e 4)',
        shortLabel: '1 2 3 4',
        code: '1 2 3 4',
        tipo: 'SEMANAL',
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
    };
};

// --- ÍCONE PARA A BASE (PADRONIZADO COM AJUSTE DE ROTA) ---
function createHomeIcon(promoterColor?: string) {
    return L.divIcon({
        className: 'custom-home-icon',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
                <div style="
                    background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: 2.5px solid #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 0 2px ${promoterColor || '#ef4444'};
                ">
                    <svg style="width: 20px; height: 20px; fill: white;" viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                </div>
                <div style="
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 8.5px;
                    font-weight: 900;
                    padding: 1.5px 6px;
                    border-radius: 6px;
                    margin-top: 3px;
                    white-space: nowrap;
                    border: 1px solid rgba(255,255,255,0.4);
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                ">
                    🏠 BASE
                </div>
            </div>
        `,
        iconSize: [38, 54],
        iconAnchor: [19, 22],
        popupAnchor: [0, -24]
    });
}

// --- HELPER PARA FORMATAÇÃO DO NOME DO VENDEDOR (PADRONIZADO COM AJUSTE DE ROTA) ---
const formatSellerDisplayName = (sellerId?: number | string, sellerName?: string): string => {
    const sId = sellerId !== undefined && sellerId !== null ? String(sellerId).trim() : '';
    let name = (sellerName || '').trim();
    if (!name && sId) return `Colaborador ${sId}`;
    if (!name) return 'Colaborador';
    // Se já possui o prefixo "101 - ...", retorna direto
    if (/^\d+\s*-\s*/.test(name)) {
        return name;
    }
    if (sId && !isNaN(Number(sId)) && Number(sId) > 0) {
        return `${sId} - ${name}`;
    }
    return name;
};

// --- FUNÇÃO PARA CRIAR ÍCONE DE PARADA NUMERADA NO MAPA COM COR DINÂMICA E DESTAQUE ---
const createNumberedPinIcon = (seq: number, isSelected: boolean = false, bgColor?: string) => {
    const bg = isSelected ? '#f43f5e' : (bgColor || '#2563eb');
    const size = isSelected ? 36 : 30;
    const pulseHtml = isSelected ? `
        <div style="
            position: absolute;
            top: -6px;
            left: -6px;
            width: ${size + 12}px;
            height: ${size + 12}px;
            border-radius: 50%;
            background: rgba(244, 63, 94, 0.45);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            pointer-events: none;
        "></div>
    ` : '';

    return L.divIcon({
        className: 'custom-numbered-pin',
        iconSize: [size + 4, size + 14],
        iconAnchor: [(size + 4) / 2, size + 10],
        popupAnchor: [0, -(size + 8)],
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35));">
                ${pulseHtml}
                <div style="
                    background: ${bg};
                    color: #ffffff;
                    width: ${size}px;
                    height: ${size}px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: ${isSelected ? '3px solid #ffffff' : '2px solid #ffffff'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 900;
                    font-size: ${isSelected ? '13px' : '11px'};
                    box-shadow: ${isSelected ? '0 0 14px rgba(244, 63, 94, 0.9)' : 'none'};
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

// --- AJUSTADOR PARA PAN DO MAPA AO SELECIONAR CLIENTE ---
const MapPanToSelected: React.FC<{ targetCoords: [number, number] | null }> = ({ targetCoords }) => {
    const map = useMap();
    useEffect(() => {
        if (targetCoords && !isNaN(targetCoords[0]) && !isNaN(targetCoords[1])) {
            map.flyTo(targetCoords, 16, { animate: true, duration: 0.8 });
        }
    }, [targetCoords, map]);
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

    // Cliente Selecionado / Destacado no Mapa e Lista
    const [highlightedClient, setHighlightedClient] = useState<any | null>(null);

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

    // Informações da Base do Vendedor Selecionado (Partida Stop 0 e Retorno)
    const activeBaseInfo = useMemo(() => {
        if (!simulacaoData) return null;

        const currentSellerObj = sellersList.find(s => s.id === selectedSeller);
        const firstClient = currentSellerClients[0];
        const rawSellerName = currentSellerObj?.name || firstClient?.Nome_Vendedor || '';
        const rawSellerCode = currentSellerObj?.id || firstClient?.Cod_Vend || selectedSeller;

        // 1. Tentar encontrar nos colaboradores da simulação
        const colabList: any[] = simulacaoData.collaborators || [];
        const sCodeNum = Number(rawSellerCode);
        const normName = rawSellerName.trim().toLowerCase();

        const colab = colabList.find(c => 
            (sCodeNum > 0 && Number(c.CodigoSetor) === sCodeNum) ||
            (c.ID_Pulsus && String(c.ID_Pulsus) === String(rawSellerCode)) ||
            (c.Nome && normName && (c.Nome.trim().toLowerCase() === normName || normName.includes(c.Nome.trim().toLowerCase()) || c.Nome.trim().toLowerCase().includes(normName)))
        );

        if (colab && colab.LatitudeBase && colab.LongitudeBase && Math.abs(Number(colab.LatitudeBase)) > 0.001) {
            const finalCode = colab.CodigoSetor || rawSellerCode;
            const finalName = colab.Nome || rawSellerName;
            return {
                type: 'COLABORADOR' as const,
                label: 'Base do Vendedor',
                codigoSetor: finalCode,
                name: finalName,
                address: colab.EnderecoBase || 'Residência do Colaborador',
                lat: Number(colab.LatitudeBase),
                lng: Number(colab.LongitudeBase)
            };
        }

        // 2. Fallback: Sede da Empresa
        const hq = simulacaoData.headquarters;
        if (hq && hq.headquartersLat && hq.headquartersLong && Math.abs(Number(hq.headquartersLat)) > 0.001) {
            return {
                type: 'SEDE' as const,
                label: 'Sede da Empresa',
                codigoSetor: rawSellerCode,
                name: 'Sede Rainha',
                address: hq.headquartersAddress || 'Sede da Empresa',
                lat: Number(hq.headquartersLat),
                lng: Number(hq.headquartersLong)
            };
        }

        return null;
    }, [simulacaoData, sellersList, selectedSeller, currentSellerClients]);

    // Filtragem por Semana e Dia
    const filteredVisits = useMemo(() => {
        return currentSellerClients.filter((c: any) => {
            // Normalizar Dia da Semana
            const diaC = normalizeDiaSemana(c.Dia_Semana || c.dia);
            const diaFiltro = selectedDay.toUpperCase().trim();
            if (selectedDay !== 'ALL' && diaC !== diaFiltro) {
                return false;
            }

            // Normalizar Semana (1 e 3 vs 2 e 4)
            if (selectedWeek !== 'ALL') {
                const p = parsePeriodicidade(c.Periodicidade || c.periodicidade).tipo;
                if (selectedWeek === '13' && p === 'QUINZENAL_2_4') {
                    return false;
                }
                if (selectedWeek === '24' && p === 'QUINZENAL_1_3') {
                    return false;
                }
            }

            return true;
        }).sort((a: any, b: any) => {
            if (selectedDay === 'ALL') {
                const orderDays = ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
                const diaA = normalizeDiaSemana(a.Dia_Semana || a.dia);
                const diaB = normalizeDiaSemana(b.Dia_Semana || b.dia);
                const idxA = orderDays.indexOf(diaA);
                const idxB = orderDays.indexOf(diaB);
                if (idxA !== idxB) return idxA - idxB;
            }
            const seqA = Number(a.Sequencia_13 || a.Sequencia_24 || a.sequencia || a.ordem || 999);
            const seqB = Number(b.Sequencia_13 || b.Sequencia_24 || b.sequencia || b.ordem || 999);
            return seqA - seqB;
        });
    }, [currentSellerClients, selectedDay, selectedWeek]);

    // Ação ao Clicar / Destacar um Cliente (Sincroniza Semana, Dia e Rota)
    const handleSelectClient = (client: any) => {
        setHighlightedClient(client);

        // Sincronizar o dia se estiver filtrado em outro dia
        const clientDay = normalizeDiaSemana(client.Dia_Semana || client.dia);
        if (selectedDay !== 'ALL' && selectedDay !== clientDay) {
            setSelectedDay(clientDay);
        }

        // Sincronizar ciclo/semana se o filtro atual estiver escondendo este cliente
        const p = parsePeriodicidade(client.Periodicidade || client.periodicidade).tipo;
        if (selectedWeek === '13' && p === 'QUINZENAL_2_4') {
            setSelectedWeek('24');
        } else if (selectedWeek === '24' && p === 'QUINZENAL_1_3') {
            setSelectedWeek('13');
        }
    };

    // Auto-scroll da lista lateral ao selecionar cliente
    useEffect(() => {
        if (highlightedClient) {
            const id = highlightedClient.Cod_Cliente || highlightedClient.id;
            const el = document.getElementById(`client-card-${id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [highlightedClient]);

    // Coordenadas do Cliente Destacado para Pan no Mapa
    const highlightedCoords = useMemo<[number, number] | null>(() => {
        if (!highlightedClient) return null;
        const lat = Number(highlightedClient.Lat || highlightedClient.Latitude);
        const lon = Number(highlightedClient.Long || highlightedClient.Longitude);
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001) {
            return [lat, lon];
        }
        return null;
    }, [highlightedClient]);

    // Contagens de Clientes por Ciclo (Todas, Sem 1/3, Sem 2/4) para o vendedor selecionado
    const cycleCounts = useMemo(() => {
        const total = currentSellerClients.length;
        let c13 = 0;
        let c24 = 0;
        currentSellerClients.forEach((c: any) => {
            const p = parsePeriodicidade(c.Periodicidade || c.periodicidade).tipo;
            if (p === 'QUINZENAL_1_3') {
                c13++;
            } else if (p === 'QUINZENAL_2_4') {
                c24++;
            } else {
                // SEMANAL: atende em ambas as quinzenas
                c13++;
                c24++;
            }
        });
        return { total, c13, c24 };
    }, [currentSellerClients]);

    // Clientes filtrados apenas pelo Ciclo selecionado
    const clientsInCurrentCycle = useMemo(() => {
        return currentSellerClients.filter((c: any) => {
            if (selectedWeek === 'ALL') return true;
            const p = parsePeriodicidade(c.Periodicidade || c.periodicidade).tipo;
            if (selectedWeek === '13' && p === 'QUINZENAL_2_4') return false;
            if (selectedWeek === '24' && p === 'QUINZENAL_1_3') return false;
            return true;
        });
    }, [currentSellerClients, selectedWeek]);

    // Contagem e KM estimado por Dia da Semana no Ciclo atual
    const dayStats = useMemo(() => {
        const stats: Record<string, { count: number; estimatedKm: number }> = {};
        const daysToInspect = ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
        daysToInspect.forEach(d => {
            stats[d] = { count: 0, estimatedKm: 0 };
        });

        daysToInspect.forEach(day => {
            const dayVisits = clientsInCurrentCycle.filter((c: any) => normalizeDiaSemana(c.Dia_Semana || c.dia) === day)
                .sort((a: any, b: any) => {
                    const seqA = Number(a.Sequencia_13 || a.Sequencia_24 || a.sequencia || a.ordem || 999);
                    const seqB = Number(b.Sequencia_13 || b.Sequencia_24 || b.sequencia || b.ordem || 999);
                    return seqA - seqB;
                });
            stats[day].count = dayVisits.length;
            let km = 0;
            for (let i = 0; i < dayVisits.length - 1; i++) {
                const p1 = dayVisits[i];
                const p2 = dayVisits[i + 1];
                const lat1 = Number(p1.Lat || p1.Latitude);
                const lon1 = Number(p1.Long || p1.Longitude);
                const lat2 = Number(p2.Lat || p2.Latitude);
                const lon2 = Number(p2.Long || p2.Longitude);
                if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                    const dLat = (lat2 - lat1) * 111;
                    const dLon = (lon2 - lon1) * 111;
                    km += Math.sqrt(dLat * dLat + dLon * dLon) * 1.25;
                }
            }
            stats[day].estimatedKm = Math.round(km * 10) / 10;
        });

        return stats;
    }, [clientsInCurrentCycle]);

    // Mapeamento de visitas agrupadas por dia da semana
    const dayVisitsMap = useMemo(() => {
        const map = new Map<string, any[]>();
        filteredVisits.forEach((v: any) => {
            const day = normalizeDiaSemana(v.Dia_Semana || v.dia);
            if (!map.has(day)) map.set(day, []);
            map.get(day)!.push(v);
        });
        return map;
    }, [filteredVisits]);

    // Cache de trajetos viários reais OSRM
    const osrmCacheRef = useRef<Map<string, { geometry: [number, number][]; distance: number }>>(new Map());
    const [roadTracks, setRoadTracks] = useState<Array<{ day: string; color: string; points: [number, number][]; distance: number }>>([]);

    // Efeito para carregar trajetos viários reais OSRM incluindo Ponto de Partida e Retorno na Base
    useEffect(() => {
        let isMounted = true;

        const calculateTracks = async () => {
            if (filteredVisits.length === 0) {
                setRoadTracks([]);
                return;
            }

            const daysToDraw: string[] = selectedDay === 'ALL'
                ? Array.from(new Set(filteredVisits.map((v: any) => normalizeDiaSemana(v.Dia_Semana || v.dia))))
                : [selectedDay];

            const initialTracks: Array<{ day: string; color: string; points: [number, number][]; distance: number }> = [];

            daysToDraw.forEach((day: string) => {
                const dayVisits = filteredVisits.filter((v: any) => normalizeDiaSemana(v.Dia_Semana || v.dia) === day);
                const dayPts = dayVisits
                    .map((v: any) => {
                        const lat = Number(v.Lat || v.Latitude);
                        const lon = Number(v.Long || v.Longitude);
                        return (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001) ? [lat, lon] as [number, number] : null;
                    })
                    .filter(Boolean) as [number, number][];

                const color = DAY_COLORS[day]?.hex || '#2563eb';
                const baseKey = activeBaseInfo ? `${activeBaseInfo.lat.toFixed(4)},${activeBaseInfo.lng.toFixed(4)}` : 'nobase';
                const cacheKey = `${selectedSeller}-${selectedWeek}-${day}-${baseKey}-${dayVisits.map(v => v.Cod_Cliente || v.id).join(',')}`;
                const cached = osrmCacheRef.current.get(cacheKey);

                if (cached) {
                    initialTracks.push({ day, color, points: cached.geometry, distance: cached.distance });
                } else {
                    const fallbackPoints: [number, number][] = [
                        ...(activeBaseInfo ? [[activeBaseInfo.lat, activeBaseInfo.lng] as [number, number]] : []),
                        ...dayPts,
                        ...(activeBaseInfo ? [[activeBaseInfo.lat, activeBaseInfo.lng] as [number, number]] : [])
                    ];
                    initialTracks.push({ day, color, points: fallbackPoints, distance: 0 });
                }
            });

            if (isMounted) setRoadTracks(initialTracks);

            for (const day of daysToDraw) {
                const dayVisits = filteredVisits.filter((v: any) => normalizeDiaSemana(v.Dia_Semana || v.dia) === day);
                const validDayVisits = dayVisits.filter((v: any) => {
                    const lat = Number(v.Lat || v.Latitude);
                    const lon = Number(v.Long || v.Longitude);
                    return !isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001;
                });

                if (validDayVisits.length === 0) continue;

                const baseKey = activeBaseInfo ? `${activeBaseInfo.lat.toFixed(4)},${activeBaseInfo.lng.toFixed(4)}` : 'nobase';
                const cacheKey = `${selectedSeller}-${selectedWeek}-${day}-${baseKey}-${dayVisits.map(v => v.Cod_Cliente || v.id).join(',')}`;
                if (osrmCacheRef.current.has(cacheKey)) continue;

                try {
                    // Ponto de Partida e Retorno na Base (Stop 0 e Chegada)
                    const basePoint = activeBaseInfo ? {
                        Lat: activeBaseInfo.lat,
                        Long: activeBaseInfo.lng,
                        LatitudeBase: activeBaseInfo.lat,
                        LongitudeBase: activeBaseInfo.lng,
                        Razao_Social: activeBaseInfo.label
                    } : null;

                    const pointsForOsrm = basePoint ? [basePoint, ...validDayVisits] : validDayVisits;
                    const isRoundTrip = Boolean(basePoint);

                    const osrm = await getOSRMData(pointsForOsrm, isRoundTrip);
                    if (!isMounted) return;

                    if (osrm && osrm.geometry && osrm.geometry.length > 0) {
                        const entry = { geometry: osrm.geometry as [number, number][], distance: osrm.distance || 0 };
                        osrmCacheRef.current.set(cacheKey, entry);

                        setRoadTracks(prev => prev.map(t => {
                            if (t.day === day) {
                                return { ...t, points: entry.geometry, distance: entry.distance };
                            }
                            return t;
                        }));
                    }
                } catch (err) {
                    console.warn(`[OSRM] Falha ao obter traçado viário para ${day}:`, err);
                }
            }
        };

        calculateTracks();

        return () => {
            isMounted = false;
        };
    }, [filteredVisits, selectedDay, selectedSeller, selectedWeek, activeBaseInfo]);

    // Métricas de Tempo da Rota Selecionada
    const metrics = useMemo(() => {
        const totalVisitas = filteredVisits.length;
        const tempoAtendimentoMin = totalVisitas * 20;

        let totalKm = 0;
        const hasOsrmDistances = roadTracks.some(t => t.distance > 0);
        if (hasOsrmDistances) {
            totalKm = roadTracks.reduce((acc, t) => acc + (t.distance || 0), 0);
        } else {
            // Fallback enquanto OSRM responde
            for (let i = 0; i < filteredVisits.length - 1; i++) {
                const p1 = filteredVisits[i];
                const p2 = filteredVisits[i + 1];
                if (p1.Lat && p1.Long && p2.Lat && p2.Long) {
                    const dLat = (p2.Lat - p1.Lat) * 111;
                    const dLon = (p2.Long - p1.Long) * 111;
                    totalKm += Math.sqrt(dLat * dLat + dLon * dLon) * 1.25;
                }
            }
        }

        const tempoPercursoMin = Math.round((totalKm / 25) * 60);
        const tempoTotalMin = tempoAtendimentoMin + tempoPercursoMin;

        return {
            totalVisitas,
            totalKm: Math.round(totalKm),
            tempoAtendimentoMin,
            tempoPercursoMin,
            tempoTotalMin
        };
    }, [filteredVisits, roadTracks]);

    // Limites do Mapa (Enquadra a Base e todas as Paradas)
    const mapBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
        const pts: [number, number][] = [];
        if (activeBaseInfo) {
            pts.push([activeBaseInfo.lat, activeBaseInfo.lng]);
        }
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
    }, [filteredVisits, activeBaseInfo]);

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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-6 transition-colors duration-200">
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
                                    ID #{simulacaoData.id} • v{SYSTEM_VERSION}
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
                        {/* ALTERNADOR DE TEMA VISUAL CLARO / ESCURO */}
                        <ThemeToggle />

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

            {/* SELETORES E FILTROS DE SETOR, CICLO E DIA DA SEMANA */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                {/* LINHA 1: SELETOR DE VENDEDOR / SETOR */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                            Vendedor / Setor:
                        </label>
                    </div>
                    <div className="flex-1 max-w-md">
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
                </div>

                {/* LINHA 2: BOTÕES EM PÍLULA DE CICLO (PERIODICIDADE) E DIAS DA SEMANA (PADRÃO ROTEIRIZADOR) */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                    {/* GRUPO CICLO */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Ciclo:
                        </span>
                        <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 gap-1">
                            <button
                                type="button"
                                onClick={() => setSelectedWeek('ALL')}
                                className={`px-3 py-1.5 rounded-xl font-black transition cursor-pointer text-xs ${
                                    selectedWeek === 'ALL'
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                Todas ({cycleCounts.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedWeek('13')}
                                className={`px-3 py-1.5 rounded-xl font-black transition cursor-pointer text-xs flex items-center gap-1.5 ${
                                    selectedWeek === '13'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-400 border border-white shrink-0" />
                                <span>Sem 1/3: <strong>{cycleCounts.c13}</strong></span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedWeek('24')}
                                className={`px-3 py-1.5 rounded-xl font-black transition cursor-pointer text-xs flex items-center gap-1.5 ${
                                    selectedWeek === '24'
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-purple-400 border border-white shrink-0" />
                                <span>Sem 2/4: <strong>{cycleCounts.c24}</strong></span>
                            </button>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:border-slate-800 hidden md:block" />

                    {/* GRUPO DIAS DA SEMANA */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Dias:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setSelectedDay('ALL')}
                                className={`px-3 py-1.5 rounded-xl font-black transition cursor-pointer text-xs border ${
                                    selectedDay === 'ALL'
                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                }`}
                            >
                                🌈 Todos ({clientsInCurrentCycle.length})
                            </button>

                            {WEEKDAYS.map(day => {
                                const cfg = DAY_COLORS[day] || { hex: '#2563eb', label: day.slice(0, 3) };
                                const stat = dayStats[day] || { count: 0, estimatedKm: 0 };
                                const isSelected = selectedDay === day;
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => setSelectedDay(day)}
                                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                                            isSelected
                                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm ring-2 ring-offset-1'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        }`}
                                        style={isSelected ? { borderColor: cfg.hex, boxShadow: `0 0 0 1.5px ${cfg.hex}` } : {}}
                                    >
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: cfg.hex }}
                                        />
                                        <span>{cfg.label}: <strong style={!isSelected ? { color: cfg.hex } : {}}>{stat.count}</strong></span>
                                        {stat.count > 0 && (
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                • {stat.estimatedKm}km
                                            </span>
                                        )}
                                    </button>
                                );
                            })}

                            {dayStats['SÁBADO'] && dayStats['SÁBADO'].count > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDay('SÁBADO')}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                                        selectedDay === 'SÁBADO'
                                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm ring-2 ring-cyan-500'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: DAY_COLORS['SÁBADO'].hex }}
                                    />
                                    <span>SÁB: <strong>{dayStats['SÁBADO'].count}</strong></span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        • {dayStats['SÁBADO'].estimatedKm}km
                                    </span>
                                </button>
                            )}
                        </div>
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
                                <MapPanToSelected targetCoords={highlightedCoords} />
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />

                                {/* Traçado Viário da Rota com Malha OSRM Real */}
                                {roadTracks.map((track) => {
                                    if (!track.points || track.points.length < 2) return null;
                                    return (
                                        <Polyline
                                            key={`track-${track.day}`}
                                            positions={track.points}
                                            pathOptions={{
                                                color: track.color,
                                                weight: 4,
                                                opacity: 0.85
                                            }}
                                        />
                                    );
                                })}

                                {/* Marcador Especial da Base (Padronizado com Ajuste de Rota) */}
                                {activeBaseInfo && filteredVisits.length > 0 && (
                                    <Marker
                                        position={[activeBaseInfo.lat, activeBaseInfo.lng]}
                                        icon={createHomeIcon('#ef4444')}
                                        zIndexOffset={1000}
                                    >
                                        <Popup>
                                            <div className="text-xs p-1 space-y-1 font-sans min-w-[200px]">
                                                <div className="flex items-center space-x-1.5 text-red-600 dark:text-red-400 font-black">
                                                    <span>🏠</span>
                                                    <span className="uppercase tracking-wider text-[10px]">BASE / RESIDÊNCIA</span>
                                                </div>
                                                <p className="text-slate-900 dark:text-slate-100 font-bold text-sm">
                                                    {formatSellerDisplayName(activeBaseInfo.codigoSetor || selectedSeller, activeBaseInfo.name)}
                                                </p>
                                                {activeBaseInfo.address && (
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                        {activeBaseInfo.address}
                                                    </p>
                                                )}
                                                <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                                                    Ponto de partida e retorno diário do colaborador
                                                </p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )}

                                {/* Marcadores Numerados dos Clientes */}
                                {filteredVisits.map((v: any, index: number) => {
                                    const lat = Number(v.Lat || v.Latitude);
                                    const lon = Number(v.Long || v.Longitude);
                                    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) < 0.001) return null;

                                    const dayKey = normalizeDiaSemana(v.Dia_Semana || v.dia);
                                    const dayVisitsList = dayVisitsMap.get(dayKey) || [];
                                    const daySeq = dayVisitsList.findIndex((item: any) => 
                                        (v.Cod_Cliente && item.Cod_Cliente === v.Cod_Cliente) || 
                                        (v.id && item.id === v.id)
                                    ) + 1;
                                    const pinSeq = selectedDay === 'ALL' ? (daySeq > 0 ? daySeq : index + 1) : (index + 1);
                                    const pinColor = DAY_COLORS[dayKey]?.hex || '#2563eb';
                                    const isSelected = Boolean(highlightedClient && (
                                        (v.Cod_Cliente && highlightedClient.Cod_Cliente === v.Cod_Cliente) ||
                                        (v.id && highlightedClient.id === v.id)
                                    ));
                                    const freqInfo = getClientFrequencyInfo(v.Periodicidade || v.periodicidade);

                                    return (
                                        <Marker
                                            key={`visit-${v.Cod_Cliente || index}-${index}`}
                                            position={[lat, lon]}
                                            icon={createNumberedPinIcon(pinSeq, isSelected, pinColor)}
                                            zIndexOffset={isSelected ? 1000 : 0}
                                            eventHandlers={{
                                                click: () => handleSelectClient(v)
                                            }}
                                        >
                                            <Popup>
                                                <div className="text-xs p-1 space-y-1.5 font-sans min-w-[210px]">
                                                    <div className="flex items-center justify-between gap-2 border-b pb-1">
                                                        <span className="font-extrabold" style={{ color: pinColor }}>
                                                            Parada #{pinSeq} ({DAY_COLORS[dayKey]?.label || dayKey})
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-mono">PDV {v.Cod_Cliente}</span>
                                                    </div>
                                                    <p className="font-bold text-slate-900 leading-tight">
                                                        {v.Razao_Social || v.nome}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500">
                                                        {v.Endereco || 'Endereço não cadastrado'} - {v.Bairro}
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] text-slate-600 bg-slate-100 dark:bg-slate-800 p-1.5 rounded gap-2">
                                                        <span>Dia: <b style={{ color: pinColor }}>{v.Dia_Semana || selectedDay}</b></span>
                                                        <span className={`px-1.5 py-0.5 rounded font-black border text-[9px] ${freqInfo.badgeClass}`}>
                                                            {freqInfo.label}
                                                        </span>
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
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {selectedDay === 'ALL' ? 'Todos os Dias' : selectedDay}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[520px] pr-1 space-y-2">
                        {/* CARD DA BASE (STOP 0 - PARTIDA E RETORNO) */}
                        {activeBaseInfo && filteredVisits.length > 0 && (
                            <div className="p-2.5 rounded-2xl bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 dark:border-rose-800/50 flex items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white font-black text-xs flex items-center justify-center shrink-0 border-2 border-white shadow-xs">
                                        🏠
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-900 dark:text-white">
                                                {formatSellerDisplayName(activeBaseInfo.codigoSetor || selectedSeller, activeBaseInfo.name)}
                                            </span>
                                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white uppercase tracking-wider">
                                                BASE / RESIDÊNCIA
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[280px]">
                                            {activeBaseInfo.address}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 shrink-0">
                                    Stop 0
                                </span>
                            </div>
                        )}

                        {filteredVisits.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 text-xs">
                                Nenhuma visita agendada para este dia/semana.
                            </div>
                        ) : (
                            filteredVisits.map((v: any, idx: number) => {
                                const dayKey = normalizeDiaSemana(v.Dia_Semana || v.dia);
                                const dayVisitsList = dayVisitsMap.get(dayKey) || [];
                                const daySeq = dayVisitsList.findIndex((item: any) => 
                                    (v.Cod_Cliente && item.Cod_Cliente === v.Cod_Cliente) || 
                                    (v.id && item.id === v.id)
                                ) + 1;
                                const pinSeq = selectedDay === 'ALL' ? (daySeq > 0 ? daySeq : idx + 1) : (idx + 1);
                                const pinColor = DAY_COLORS[dayKey]?.hex || '#2563eb';
                                const isSelected = Boolean(highlightedClient && (
                                    (v.Cod_Cliente && highlightedClient.Cod_Cliente === v.Cod_Cliente) ||
                                    (v.id && highlightedClient.id === v.id)
                                ));
                                const freqInfo = getClientFrequencyInfo(v.Periodicidade || v.periodicidade);

                                return (
                                    <div
                                        key={`item-${v.Cod_Cliente || idx}-${idx}`}
                                        id={`client-card-${v.Cod_Cliente || v.id}`}
                                        onClick={() => handleSelectClient(v)}
                                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                                            isSelected
                                                ? 'ring-2 ring-rose-500 bg-rose-50/80 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 shadow-md'
                                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/60 hover:border-blue-400 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div
                                                className={`w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${isSelected ? 'ring-2 ring-white scale-110' : ''}`}
                                                style={{ backgroundColor: isSelected ? '#f43f5e' : pinColor }}
                                            >
                                                {pinSeq}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                                                        {v.Razao_Social || v.nome}
                                                    </span>
                                                    {/* BADGE DE FREQUÊNCIA (1 3 / 2 4 / 1 2 3 4) */}
                                                    <span
                                                        className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${freqInfo.badgeClass}`}
                                                        title={`Frequência: ${freqInfo.label}`}
                                                    >
                                                        {freqInfo.shortLabel}
                                                    </span>
                                                    {selectedDay === 'ALL' && (
                                                        <span
                                                            className="text-[9px] font-black px-1.5 py-0.2 rounded text-white shadow-2xs"
                                                            style={{ backgroundColor: pinColor }}
                                                        >
                                                            {DAY_COLORS[dayKey]?.label || dayKey}
                                                        </span>
                                                    )}
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenSuggestionModal(v);
                                            }}
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
        </div>
    );
};
