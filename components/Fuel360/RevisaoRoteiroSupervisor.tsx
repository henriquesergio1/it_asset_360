import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// --- PALETA CROMÁTICA OFICIAL POR VENDEDOR PARA VISÃO MULTI-SETOR NO MAPA ---
export const SELLER_COLORS: { hex: string; bg: string; text: string; border: string }[] = [
    { hex: '#2563eb', bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-500' },       // Azul Royal
    { hex: '#16a34a', bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-500' }, // Verde Esmeralda
    { hex: '#9333ea', bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-500' },   // Roxo
    { hex: '#ea580c', bg: 'bg-orange-600', text: 'text-orange-600', border: 'border-orange-500' },   // Laranja
    { hex: '#db2777', bg: 'bg-pink-600', text: 'text-pink-600', border: 'border-pink-500' },       // Pink
    { hex: '#0891b2', bg: 'bg-cyan-600', text: 'text-cyan-600', border: 'border-cyan-500' },       // Ciano
    { hex: '#d97706', bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-500' },     // Âmbar
    { hex: '#4f46e5', bg: 'bg-indigo-600', text: 'text-indigo-600', border: 'border-indigo-500' },   // Índigo
    { hex: '#e11d48', bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-500' },       // Rosa Carmesim
    { hex: '#059669', bg: 'bg-teal-600', text: 'text-teal-600', border: 'border-teal-500' },       // Teal
    { hex: '#ca8a04', bg: 'bg-yellow-600', text: 'text-yellow-600', border: 'border-yellow-500' },   // Dourado
    { hex: '#0284c7', bg: 'bg-sky-600', text: 'text-sky-600', border: 'border-sky-500' },         // Azul Celeste
    { hex: '#be123c', bg: 'bg-red-700', text: 'text-red-700', border: 'border-red-600' },         // Vermelho Vinho
    { hex: '#475569', bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-500' },     // Slate
    { hex: '#84cc16', bg: 'bg-lime-600', text: 'text-lime-600', border: 'border-lime-500' },       // Lima
    { hex: '#6366f1', bg: 'bg-violet-600', text: 'text-violet-600', border: 'border-violet-500' }    // Violeta
];

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

// --- CÁLCULO DE DISTÂNCIA HAVERSINE EM KM ---
const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// --- CÁLCULO ESTIMADO DE TEMPO DE TRÂNSITO POR TRECHO VIÁRIO ---
const calcLegMinutes = (roadKm: number): number => {
    if (roadKm <= 0) return 0;
    let speed = 30; // km/h
    if (roadKm < 2.5) speed = 22;
    else if (roadKm >= 15) speed = 55;
    return Math.max(1, Math.round((roadKm / speed) * 60));
};

// --- SEQUÊNCIA DE VISITA POR CICLO (1/3 prioriza Sequencia_13; 2/4 prioriza Sequencia_24) ---
const getSeq13 = (c: any): number => Number(c.Sequencia_13 || c.Sequencia_24 || c.sequencia || c.ordem || 999);
const getSeq24 = (c: any): number => Number(c.Sequencia_24 || c.Sequencia_13 || c.sequencia || c.ordem || 999);

// --- VALIDAÇÃO DE COORDENADAS DA PARADA ---
const hasValidStopCoords = (v: any): boolean => {
    const lat = Number(v.Lat || v.Latitude);
    const lon = Number(v.Long || v.Longitude);
    return !isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 0.001;
};

// --- KM VIÁRIO ESTIMADO DE UM CIRCUITO (BASE -> PARADAS -> BASE) ---
const calcCircuitKm = (base: { lat: number; lng: number } | null | undefined, stops: any[]): number => {
    let km = 0;
    let pLat = base?.lat || 0;
    let pLng = base?.lng || 0;
    let hasStops = false;
    stops.forEach((s: any) => {
        if (!hasValidStopCoords(s)) return;
        const lat = Number(s.Lat || s.Latitude);
        const lng = Number(s.Long || s.Longitude);
        if (pLat && pLng) km += calcDist(pLat, pLng, lat, lng);
        pLat = lat;
        pLng = lng;
        hasStops = true;
    });
    if (hasStops && base?.lat && base?.lng) km += calcDist(pLat, pLng, base.lat, base.lng);
    return km * 1.18;
};

// --- COMPRIMENTO DE UMA POLILINHA EM KM ---
const calcPolylineKm = (points: [number, number][]): number => {
    let km = 0;
    for (let i = 0; i < points.length - 1; i++) {
        km += calcDist(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    }
    return km;
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
    // Identificador do link: código aleatório da simulação (ou ID numérico dos links antigos, durante a transição)
    const simId = String(id || '').trim();

    // Estados de Carga
    const [loading, setLoading] = useState<boolean>(true);
    const [simulacaoData, setSimulacaoData] = useState<any>(null);
    const [sugestoes, setSugestoes] = useState<any[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Filtros de Setor, Semana e Dia
    const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
    const [selectedWeek, setSelectedWeek] = useState<string>('ALL'); // 'ALL', '13', '24'
    const [selectedDay, setSelectedDay] = useState<string>('SEGUNDA-FEIRA');

    // Vendedores ocultos na legenda do modo TODOS (vazio = todos visíveis) e exibição das rotas no mapa
    const [hiddenSellerIds, setHiddenSellerIds] = useState<Set<string>>(new Set());
    const [showRoutes, setShowRoutes] = useState<boolean>(true);

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
    const [tipoAjuste, setTipoAjuste] = useState<string>('HORARIO_ESPECIFICO');
    const [turnoSugerido, setTurnoSugerido] = useState<string>('MANHA');
    const [diaSugerido, setDiaSugerido] = useState<string>('TERÇA-FEIRA');
    const [semanaSugerida, setSemanaSugerida] = useState<string>('1_3');
    const [observacao, setObservacao] = useState<string>('');
    const [savingSuggestion, setSavingSuggestion] = useState<boolean>(false);
    const [channelServiceTimes, setChannelServiceTimes] = useState<Record<string, number>>({});

    // Carregar Dados da Simulação e Canais de Atendimento
    const loadSimulation = async () => {
        if (!simId || !/^[a-zA-Z0-9]+$/.test(simId)) {
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

            // Carregar tempos corporativos por canal de remuneração
            try {
                const resCanais = await fetch('/api/fuel360/canais-atendimento');
                const dataCanais = await resCanais.json();
                if (dataCanais.success && Array.isArray(dataCanais.canais)) {
                    const timeMap: Record<string, number> = {};
                    dataCanais.canais.forEach((item: any) => {
                        if (item.Canal && item.TempoMinutos && item.Ativo !== false && item.Ativo !== 0) {
                            timeMap[String(item.Canal).trim().toUpperCase()] = Number(item.TempoMinutos);
                        }
                    });
                    setChannelServiceTimes(timeMap);
                }
            } catch (errCanais) {
                console.warn('[Fuel360] Aviso ao buscar canais de atendimento:', errCanais);
            }
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

    // Resolução do tempo em minutos de atendimento por cliente com base no canal
    const getClientServiceTime = useCallback((client?: { Canal_Remuneracao?: string; canal_remuneracao?: string }): number => {
        const defaultMins = channelServiceTimes['PADRAO'] || 15;
        const rawCanal = client?.Canal_Remuneracao || client?.canal_remuneracao || '';
        if (!rawCanal || !rawCanal.trim()) {
            return defaultMins;
        }
        const canalNorm = rawCanal.trim().toUpperCase();

        // 1. Coincidência Exata
        if (channelServiceTimes[canalNorm] !== undefined) {
            return Number(channelServiceTimes[canalNorm]) || defaultMins;
        }

        // 2. Coincidência por Palavra-Chave (com chave >= 4 letras)
        for (const [key, val] of Object.entries(channelServiceTimes)) {
            if (key === 'PADRAO') continue;
            if (key.length >= 4 && canalNorm.includes(key)) {
                return Number(val) || defaultMins;
            }
        }
        return defaultMins;
    }, [channelServiceTimes]);

    // Extrair Lista de Vendedores / Setores da Simulação com padronização Cód - Nome
    const sellersList = useMemo(() => {
        if (!simulacaoData || !simulacaoData.snapshot) return [];
        const snapshot = simulacaoData.snapshot;

        // Se o snapshot tiver lista de setores/vendedores
        if (Array.isArray(snapshot.sellers)) {
            return snapshot.sellers.map((s: any) => {
                const sId = String(s.id || s.Cod_Vend || s.Nome);
                const rawName = s.name || s.Nome || `Vendedor ${sId}`;
                return {
                    id: sId,
                    name: formatSellerDisplayName(sId, rawName),
                    clients: s.clients || s.visitas || []
                };
            });
        }

        // Se o snapshot tiver lista de visitas diretas
        if (Array.isArray(snapshot.visitas)) {
            const map = new Map<string, { id: string; name: string; clients: any[] }>();
            snapshot.visitas.forEach((v: any) => {
                const sId = String(v.Cod_Vend || v.Nome_Vendedor || '1');
                const rawName = v.Nome_Vendedor || `Vendedor ${sId}`;
                if (!map.has(sId)) {
                    map.set(sId, { 
                        id: sId, 
                        name: formatSellerDisplayName(sId, rawName), 
                        clients: [] 
                    });
                }
                map.get(sId)?.clients.push(v);
            });
            return Array.from(map.values());
        }

        return [];
    }, [simulacaoData]);

    // Mapeamento de cores exclusivas para cada vendedor
    const sellerColorMap = useMemo(() => {
        const map = new Map<string, { hex: string; bg: string; text: string; border: string }>();
        sellersList.forEach((s, idx) => {
            map.set(String(s.id), SELLER_COLORS[idx % SELLER_COLORS.length]);
        });
        return map;
    }, [sellersList]);

    // Setar o primeiro vendedor por default apenas na primeira carga
    const initialSellerSetRef = useRef<boolean>(false);
    useEffect(() => {
        if (sellersList.length > 0 && !initialSellerSetRef.current) {
            setSelectedSeller(sellersList[0].id);
            initialSellerSetRef.current = true;
        }
    }, [sellersList]);

    // Obter clientes do setor selecionado com vínculo de vendedor
    const currentSellerClients = useMemo(() => {
        if (sellersList.length === 0) return [];
        if (selectedSeller === 'ALL') {
            return sellersList.filter(s => !hiddenSellerIds.has(String(s.id))).flatMap(s =>
                s.clients.map((c: any) => ({
                    ...c,
                    _sellerId: String(s.id),
                    _sellerName: s.name
                }))
            );
        }
        const s = sellersList.find(item => item.id === selectedSeller);
        return s ? s.clients.map((c: any) => ({
            ...c,
            _sellerId: String(s.id),
            _sellerName: s.name
        })) : [];
    }, [sellersList, selectedSeller, hiddenSellerIds]);

    // Identificar tipo de equipe da simulação ('vendedores' ou 'promotores')
    const teamType = useMemo<'vendedores' | 'promotores'>(() => {
        const rawType = simulacaoData?.snapshot?.teamType;
        if (rawType === 'promotores') return 'promotores';
        if (rawType === 'vendedores') return 'vendedores';

        const desc = String(simulacaoData?.descricao || '').toUpperCase();
        if (desc.includes('PROMOTOR') || desc.includes('PROMOTORES') || desc.includes('[PROMOTOR]')) {
            return 'promotores';
        }
        return 'vendedores';
    }, [simulacaoData]);

    // Localizador resiliente de colaborador por código de setor e/ou nome, blindando contra colisões entre Vendedores e Promotores
    const getColabForCurrentSeller = useCallback((sellerId: string | number, sellerName?: string) => {
        const colabList: any[] = simulacaoData?.collaborators || [];
        if (colabList.length === 0) return undefined;

        const sCodeNum = Number(sellerId);
        // Limpar prefixo "217 - " se houver no sellerName
        let cleanName = (sellerName || '').trim();
        if (/^\d+\s*-\s*/.test(cleanName)) {
            cleanName = cleanName.replace(/^\d+\s*-\s*/, '').trim();
        }
        const normName = cleanName.toLowerCase();

        // 1. Filtrar lista estrita da equipe ativa (vendedores ou promotores)
        const teamColabs = colabList.filter((c: any) => {
            const g = String(c.Grupo || '').trim().toUpperCase();
            if (teamType === 'vendedores') {
                return g === 'VENDEDOR' || g === 'VENDEDORES' || g === 'VENDAS';
            }
            return g === 'PROMOTOR' || g === 'PROMOTORES' || g === 'PROMOÇÃO' || g === 'PROMOCAO';
        });

        // 1.1 Match exato de Código E Nome no time ativo (máxima precisão de desempate)
        if (normName) {
            const exactInTeam = teamColabs.find((c: any) => 
                (sCodeNum > 0 && Number(c.CodigoSetor) === sCodeNum) &&
                c.Nome && c.Nome.trim().toLowerCase() === normName
            );
            if (exactInTeam) return exactInTeam;

            // 1.2 Match por Código E semelhança de Nome no time ativo
            const byCodeAndNameLike = teamColabs.find((c: any) => {
                if (sCodeNum > 0 && Number(c.CodigoSetor) !== sCodeNum) return false;
                const cName = (c.Nome || '').trim().toLowerCase();
                return cName.includes(normName) || normName.includes(cName);
            });
            if (byCodeAndNameLike) return byCodeAndNameLike;
        }

        // 1.3 Match apenas por Código no time ativo
        if (sCodeNum > 0) {
            const byCodeInTeam = teamColabs.find((c: any) => Number(c.CodigoSetor) === sCodeNum);
            if (byCodeInTeam) return byCodeInTeam;
        }

        // 1.4 Match por ID_Pulsus no time ativo
        const byPulsusInTeam = teamColabs.find((c: any) => c.ID_Pulsus && String(c.ID_Pulsus) === String(sellerId));
        if (byPulsusInTeam) return byPulsusInTeam;

        // 1.5 Match apenas por Nome no time ativo
        if (normName) {
            const byNameInTeam = teamColabs.find((c: any) => {
                const cName = (c.Nome || '').trim().toLowerCase();
                return cName === normName || cName.includes(normName) || normName.includes(cName);
            });
            if (byNameInTeam) return byNameInTeam;
        }

        // 2. Fallback resiliente: caso o colaborador não esteja com o Grupo correto no cadastro,
        // busca no pool geral MAS prioriza correspondência estrita de nome para evitar pegar outra pessoa com mesmo código
        if (normName) {
            const exactGlobal = colabList.find((c: any) => 
                (sCodeNum > 0 && Number(c.CodigoSetor) === sCodeNum) &&
                c.Nome && c.Nome.trim().toLowerCase() === normName
            );
            if (exactGlobal) return exactGlobal;

            const byNameGlobal = colabList.find((c: any) => {
                const cName = (c.Nome || '').trim().toLowerCase();
                return cName === normName || (normName.length > 5 && (cName.includes(normName) || normName.includes(cName)));
            });
            if (byNameGlobal) return byNameGlobal;
        }

        // Se só temos o código e não há nome disponível para validação cruzada
        if (sCodeNum > 0) {
            return colabList.find((c: any) => Number(c.CodigoSetor) === sCodeNum);
        }

        return undefined;
    }, [simulacaoData, teamType]);

    // Identificação do Supervisor vinculado ao vendedor selecionado (com formato Cód - Nome)
    const currentSupervisor = useMemo<string>(() => {
        if (!currentSellerClients || currentSellerClients.length === 0) return '';
        const found = currentSellerClients.find((c: any) => c.Nome_Supervisor || c.nome_supervisor || c.NomeSupervisor);
        if (!found) {
            const currentSellerObj = sellersList.find(s => s.id === selectedSeller);
            const rawSellerCode = currentSellerObj?.id || selectedSeller;
            const rawSellerName = currentSellerObj?.name || '';
            const colab = getColabForCurrentSeller(rawSellerCode, rawSellerName);
            if (colab && (colab.Nome_Supervisor || colab.NomeSupervisor || colab.Supervisor)) {
                const sNome = (colab.Nome_Supervisor || colab.NomeSupervisor || colab.Supervisor).trim();
                const sCod = colab.Cod_Supervisor || colab.CodSupervisor || '';
                return sCod && sNome ? (sNome.startsWith(`${sCod} -`) ? sNome : `${sCod} - ${sNome}`) : sNome;
            }
            return '';
        }
        const sCod = found.Cod_Supervisor || found.cod_supervisor || found.CodSupervisor || '';
        const sNome = String(found.Nome_Supervisor || found.nome_supervisor || found.NomeSupervisor || '').trim();
        if (sCod && sNome) {
            if (sNome.startsWith(`${sCod} -`)) return sNome;
            return `${sCod} - ${sNome}`;
        }
        return sNome || (sCod ? `Supervisor ${sCod}` : '');
    }, [currentSellerClients, sellersList, selectedSeller, getColabForCurrentSeller]);

    // Auto-preenchimento do nome do supervisor quando identificado
    useEffect(() => {
        if (currentSupervisor) {
            setSupervisorName(currentSupervisor);
        }
    }, [currentSupervisor]);

    // Informações da Base do Vendedor Selecionado (Partida Stop 0 e Retorno)
    const activeBaseInfo = useMemo(() => {
        if (!simulacaoData) return null;

        const currentSellerObj = sellersList.find(s => s.id === selectedSeller);
        const firstClient = currentSellerClients[0];
        const rawSellerName = currentSellerObj?.name || firstClient?.Nome_Vendedor || '';
        const rawSellerCode = currentSellerObj?.id || firstClient?.Cod_Vend || selectedSeller;

        // 1. Tentar encontrar nos colaboradores da simulação usando a blindagem por equipe e nome
        const colab = getColabForCurrentSeller(rawSellerCode, rawSellerName);

        if (colab && colab.LatitudeBase && colab.LongitudeBase && Math.abs(Number(colab.LatitudeBase)) > 0.001) {
            const finalCode = colab.CodigoSetor || rawSellerCode;
            const finalName = colab.Nome || rawSellerName;
            return {
                type: 'COLABORADOR' as const,
                label: teamType === 'vendedores' ? 'Base do Vendedor' : 'Base do Promotor',
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
    }, [simulacaoData, sellersList, selectedSeller, currentSellerClients, getColabForCurrentSeller, teamType]);

    // Bases de todos os vendedores para o modo ALL
    const allSellersBases = useMemo(() => {
        if (!simulacaoData || selectedSeller !== 'ALL') return [];
        const bases: any[] = [];
        sellersList.forEach((s, idx) => {
            if (hiddenSellerIds.has(String(s.id))) return;
            const firstClient = s.clients[0];
            const rawSellerName = s.name || firstClient?.Nome_Vendedor || '';
            const rawSellerCode = s.id || firstClient?.Cod_Vend || '';
            const colab = getColabForCurrentSeller(rawSellerCode, rawSellerName);
            const colorCfg = sellerColorMap.get(String(s.id)) || SELLER_COLORS[idx % SELLER_COLORS.length];

            if (colab && colab.LatitudeBase && colab.LongitudeBase && Math.abs(Number(colab.LatitudeBase)) > 0.001) {
                bases.push({
                    sellerId: String(s.id),
                    sellerName: s.name,
                    color: colorCfg.hex,
                    codigoSetor: colab.CodigoSetor || rawSellerCode,
                    name: colab.Nome || rawSellerName,
                    address: colab.EnderecoBase || 'Residência do Colaborador',
                    lat: Number(colab.LatitudeBase),
                    lng: Number(colab.LongitudeBase)
                });
            }
        });
        return bases;
    }, [simulacaoData, selectedSeller, sellersList, getColabForCurrentSeller, sellerColorMap, hiddenSellerIds]);

    // Ponto de partida/retorno de cada vendedor (base residencial ou, na falta dela, a sede) para traçados e cálculos por setor
    const sellerBaseMap = useMemo(() => {
        const map = new Map<string, { lat: number; lng: number }>();
        if (!simulacaoData) return map;
        const hq = simulacaoData.headquarters;
        const hqPoint = hq && hq.headquartersLat && hq.headquartersLong && Math.abs(Number(hq.headquartersLat)) > 0.001
            ? { lat: Number(hq.headquartersLat), lng: Number(hq.headquartersLong) }
            : null;
        sellersList.forEach(s => {
            const firstClient = s.clients[0];
            const colab = getColabForCurrentSeller(s.id || firstClient?.Cod_Vend || '', s.name || firstClient?.Nome_Vendedor || '');
            if (colab && colab.LatitudeBase && colab.LongitudeBase && Math.abs(Number(colab.LatitudeBase)) > 0.001) {
                map.set(String(s.id), { lat: Number(colab.LatitudeBase), lng: Number(colab.LongitudeBase) });
            } else if (hqPoint) {
                map.set(String(s.id), hqPoint);
            }
        });
        return map;
    }, [simulacaoData, sellersList, getColabForCurrentSeller]);

    // Base a ser usada para um vendedor: no modo individual segue a base ativa; no modo TODOS usa a base de cada setor
    const getBaseForSeller = useCallback((sellerId: string): { lat: number; lng: number } | null => {
        if (selectedSeller === 'ALL') return sellerBaseMap.get(sellerId) || null;
        return activeBaseInfo ? { lat: activeBaseInfo.lat, lng: activeBaseInfo.lng } : null;
    }, [selectedSeller, sellerBaseMap, activeBaseInfo]);

    // Sequência da visita conforme o ciclo filtrado
    const getVisitSeq = useCallback((c: any): number => {
        return selectedWeek === '24' ? getSeq24(c) : getSeq13(c);
    }, [selectedWeek]);

    // Separação das visitas em circuitos por ciclo: com "Todas" gera o circuito 1/3 e o 2/4 separadamente (rotas reais de cada semana)
    const splitByCycle = useCallback((visits: any[]): Array<{ cycle: '13' | '24'; stops: any[] }> => {
        if (selectedWeek === '13') return [{ cycle: '13', stops: [...visits].sort((a, b) => getSeq13(a) - getSeq13(b)) }];
        if (selectedWeek === '24') return [{ cycle: '24', stops: [...visits].sort((a, b) => getSeq24(a) - getSeq24(b)) }];
        const tipoOf = (c: any) => parsePeriodicidade(c.Periodicidade || c.periodicidade).tipo;
        return [
            { cycle: '13', stops: visits.filter(c => tipoOf(c) !== 'QUINZENAL_2_4').sort((a, b) => getSeq13(a) - getSeq13(b)) },
            { cycle: '24', stops: visits.filter(c => tipoOf(c) !== 'QUINZENAL_1_3').sort((a, b) => getSeq24(a) - getSeq24(b)) }
        ];
    }, [selectedWeek]);

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
            // No modo TODOS mantém a sequência de cada vendedor contígua (evita emendar rotas de setores diferentes)
            if (selectedSeller === 'ALL') {
                const sA = String(a._sellerId || '');
                const sB = String(b._sellerId || '');
                if (sA !== sB) return sA.localeCompare(sB, undefined, { numeric: true });
            }
            return getVisitSeq(a) - getVisitSeq(b);
        });
    }, [currentSellerClients, selectedDay, selectedWeek, selectedSeller, getVisitSeq]);

    // Chave única da parada (vendedor + cliente) e numeração da parada dentro do dia de cada vendedor
    const getStopKey = (v: any): string => `${v._sellerId || ''}|${v.Cod_Cliente || v.id}`;
    const stopSeqMap = useMemo(() => {
        const map = new Map<string, number>();
        const counters = new Map<string, number>();
        filteredVisits.forEach((v: any) => {
            const groupKey = `${v._sellerId || ''}|${normalizeDiaSemana(v.Dia_Semana || v.dia)}`;
            const n = (counters.get(groupKey) || 0) + 1;
            counters.set(groupKey, n);
            map.set(getStopKey(v), n);
        });
        return map;
    }, [filteredVisits]);

    // Ação ao Clicar / Destacar um Cliente (Sincroniza Semana, Dia e Rota ou Desmarca no clique repetido)
    const handleSelectClient = (client: any) => {
        const isCurrentSelected = Boolean(highlightedClient && (
            (client.Cod_Cliente && String(highlightedClient.Cod_Cliente) === String(client.Cod_Cliente)) ||
            (client.id && String(highlightedClient.id) === String(client.id))
        ));

        // Se já está selecionado, desmarca (toggle)
        if (isCurrentSelected) {
            setHighlightedClient(null);
            return;
        }

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

    // Paradas com cálculos precisos de deslocamento viário e tempo de atendimento individual
    const itineraryStops = useMemo(() => {
        let prevLat = 0;
        let prevLng = 0;
        let currentGroupKey: string | null = null;

        return filteredVisits.map((v: any, index: number) => {
            // Cada vendedor/dia parte da sua própria base (não emenda o último cliente de um circuito no primeiro do próximo)
            const groupKey = `${v._sellerId || ''}|${normalizeDiaSemana(v.Dia_Semana || v.dia)}`;
            if (groupKey !== currentGroupKey) {
                currentGroupKey = groupKey;
                const base = getBaseForSeller(String(v._sellerId || ''));
                prevLat = base?.lat || 0;
                prevLng = base?.lng || 0;
            }

            const curLat = Number(v.Lat || v.Latitude || 0);
            const curLng = Number(v.Long || v.Longitude || 0);

            const hasValidCoords = Boolean(prevLat && prevLng && curLat && curLng);
            const legKm = hasValidCoords
                ? Math.round(calcDist(prevLat, prevLng, curLat, curLng) * 1.18 * 10) / 10
                : 0;
            const legTravelTime = calcLegMinutes(legKm);
            const serviceTime = getClientServiceTime(v);

            if (curLat && curLng) {
                prevLat = curLat;
                prevLng = curLng;
            }

            return {
                ...v,
                stopIndex: index + 1,
                legKm,
                legTravelTime,
                serviceTime
            };
        });
    }, [filteredVisits, getBaseForSeller, getClientServiceTime]);

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
            const dayVisits = clientsInCurrentCycle.filter((c: any) => normalizeDiaSemana(c.Dia_Semana || c.dia) === day);
            stats[day].count = dayVisits.length;

            // KM por vendedor (circuito Base -> Paradas -> Base); com "Todas" usa a média semanal dos ciclos 1/3 e 2/4
            const bySeller = new Map<string, any[]>();
            dayVisits.forEach((c: any) => {
                const sId = String(c._sellerId || '');
                if (!bySeller.has(sId)) bySeller.set(sId, []);
                bySeller.get(sId)!.push(c);
            });

            let km = 0;
            bySeller.forEach((list, sId) => {
                const base = getBaseForSeller(sId);
                const cycleKms = splitByCycle(list).map(g => calcCircuitKm(base, g.stops));
                const sellerKm = cycleKms.reduce((acc, k) => acc + k, 0);
                km += selectedWeek === 'ALL' ? sellerKm / 2 : sellerKm;
            });
            stats[day].estimatedKm = Math.round(km * 10) / 10;
        });

        return stats;
    }, [clientsInCurrentCycle, getBaseForSeller, splitByCycle, selectedWeek]);

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
    const [roadTracks, setRoadTracks] = useState<Array<{
        key: string;
        day: string;
        sellerId: string;
        cycle: '13' | '24';
        color: string;
        dashed: boolean;
        points: [number, number][];
        distance: number;
    }>>([]);

    // Efeito para carregar trajetos viários reais OSRM incluindo Ponto de Partida e Retorno na Base
    // Um circuito por vendedor x dia x ciclo: no modo individual usa a cor do dia; no modo TODOS usa a cor de cada vendedor
    useEffect(() => {
        let isMounted = true;

        const calculateTracks = async () => {
            if (filteredVisits.length === 0) {
                setRoadTracks([]);
                return;
            }

            const isAllMode = selectedSeller === 'ALL';

            // Agrupa as paradas por vendedor e dia (preservando a ordem já sequenciada)
            const bySellerDay = new Map<string, { sellerId: string; day: string; visits: any[] }>();
            filteredVisits.forEach((v: any) => {
                const sellerId = String(v._sellerId || '');
                const day = normalizeDiaSemana(v.Dia_Semana || v.dia);
                const k = `${sellerId}|${day}`;
                if (!bySellerDay.has(k)) bySellerDay.set(k, { sellerId, day, visits: [] });
                bySellerDay.get(k)!.visits.push(v);
            });

            const groups: Array<{
                key: string;
                day: string;
                sellerId: string;
                cycle: '13' | '24';
                color: string;
                dashed: boolean;
                base: { lat: number; lng: number } | null;
                stops: any[];
            }> = [];

            bySellerDay.forEach(({ sellerId, day, visits }) => {
                const base = getBaseForSeller(sellerId);
                const color = isAllMode
                    ? (sellerColorMap.get(sellerId)?.hex || SELLER_COLORS[0].hex)
                    : (DAY_COLORS[day]?.hex || '#2563eb');
                const baseKey = base ? `${base.lat.toFixed(4)},${base.lng.toFixed(4)}` : 'nobase';

                splitByCycle(visits).forEach(g => {
                    const validStops = g.stops.filter(hasValidStopCoords);
                    if (validStops.length === 0) return;
                    groups.push({
                        key: `${sellerId}-${g.cycle}-${day}-${baseKey}-${validStops.map((v: any) => v.Cod_Cliente || v.id).join(',')}`,
                        day,
                        sellerId,
                        cycle: g.cycle,
                        color,
                        dashed: selectedWeek === 'ALL' && g.cycle === '24',
                        base,
                        stops: validStops
                    });
                });
            });

            // Exibe imediatamente o traçado em linha reta (ou o cache viário) e depois substitui pelo traçado real
            const initialTracks = groups.map(g => {
                const cached = osrmCacheRef.current.get(g.key);
                const basePt: [number, number][] = g.base ? [[g.base.lat, g.base.lng]] : [];
                const straight: [number, number][] = [
                    ...basePt,
                    ...g.stops.map((v: any) => [Number(v.Lat || v.Latitude), Number(v.Long || v.Longitude)] as [number, number]),
                    ...basePt
                ];
                return {
                    key: g.key,
                    day: g.day,
                    sellerId: g.sellerId,
                    cycle: g.cycle,
                    color: g.color,
                    dashed: g.dashed,
                    points: cached ? cached.geometry : straight,
                    distance: cached ? cached.distance : 0
                };
            });

            if (isMounted) setRoadTracks(initialTracks);

            // Consulta OSRM com no máximo 3 requisições simultâneas (o servidor aplica limite de taxa)
            const pending = groups.filter(g => !osrmCacheRef.current.has(g.key));
            let cursor = 0;
            const worker = async () => {
                while (isMounted && cursor < pending.length) {
                    const g = pending[cursor++];
                    try {
                        // Ponto de Partida e Retorno na Base (Stop 0 e Chegada)
                        const basePoint = g.base ? {
                            Lat: g.base.lat,
                            Long: g.base.lng,
                            LatitudeBase: g.base.lat,
                            LongitudeBase: g.base.lng,
                            Razao_Social: 'Base'
                        } : null;

                        const pointsForOsrm = basePoint ? [basePoint, ...g.stops] : g.stops;
                        const osrm = await getOSRMData(pointsForOsrm, Boolean(basePoint));
                        if (!isMounted) return;

                        if (osrm && osrm.geometry && osrm.geometry.length > 0) {
                            const entry = { geometry: osrm.geometry as [number, number][], distance: osrm.distance || 0 };
                            osrmCacheRef.current.set(g.key, entry);
                            setRoadTracks(prev => prev.map(t => (t.key === g.key ? { ...t, points: entry.geometry, distance: entry.distance } : t)));
                        }
                    } catch (err) {
                        console.warn(`[OSRM] Falha ao obter traçado viário para ${g.day}:`, err);
                    }
                }
            };

            await Promise.all(Array.from({ length: Math.min(3, pending.length) }, () => worker()));
        };

        calculateTracks();

        return () => {
            isMounted = false;
        };
    }, [filteredVisits, selectedSeller, selectedWeek, getBaseForSeller, sellerColorMap, splitByCycle]);

    // Métricas de Tempo da Rota Selecionada
    const metrics = useMemo(() => {
        const totalVisitas = filteredVisits.length;
        const tempoAtendimentoMin = filteredVisits.reduce((acc: number, v: any) => acc + getClientServiceTime(v), 0);
        const mediaAtendimentoMin = totalVisitas > 0 ? Math.round(tempoAtendimentoMin / totalVisitas) : 15;

        // KM por circuito (vendedor x dia x ciclo): distância viária OSRM quando disponível,
        // senão o comprimento do traçado em linha reta (Base -> Paradas -> Base) com fator de sinuosidade 1.18
        let totalKm = 0;
        roadTracks.forEach(t => {
            totalKm += t.distance > 0 ? t.distance : calcPolylineKm(t.points) * 1.18;
        });
        // Com "Todas" as semanas há um circuito 1/3 e um 2/4 por dia: exibe a média semanal
        if (selectedWeek === 'ALL') {
            totalKm = totalKm / 2;
        }

        const tempoPercursoMin = Math.round((totalKm / 26) * 60);
        const tempoTotalMin = tempoAtendimentoMin + tempoPercursoMin;

        return {
            totalVisitas,
            totalKm: Math.round(totalKm),
            tempoAtendimentoMin,
            mediaAtendimentoMin,
            tempoPercursoMin,
            tempoTotalMin
        };
    }, [filteredVisits, roadTracks, selectedWeek, getClientServiceTime]);

    // Limites do Mapa (Enquadra a Base e todas as Paradas)
    const mapBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
        const pts: [number, number][] = [];
        if (selectedSeller === 'ALL') {
            allSellersBases.forEach(b => {
                if (b.lat && b.lng) pts.push([b.lat, b.lng]);
            });
        } else if (activeBaseInfo) {
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
    }, [filteredVisits, activeBaseInfo, selectedSeller, allSellersBases]);

    // Abrir Modal de Sugestão
    const handleOpenSuggestionModal = (client?: any) => {
        setSelectedClientForSuggestion(client || null);
        setTipoAjuste(client ? 'HORARIO_ESPECIFICO' : 'OUTRO');
        setTurnoSugerido('MANHA');
        setObservacao('');
        if (currentSupervisor) {
            setSupervisorName(currentSupervisor);
        }
        setIsSuggestionModalOpen(true);
    };

    // Salvar Sugestão
    const handleSaveSuggestion = async () => {
        if (!observacao.trim()) {
            alert('Por favor, digite a observação ou justificativa do ajuste.');
            return;
        }

        const name = supervisorName.trim() || currentSupervisor || 'Supervisor da Equipe';
        localStorage.setItem('fuel360_supervisor_name', name);
        setSavingSuggestion(true);

        try {
            let obsFinal = observacao.trim();
            if (tipoAjuste === 'HORARIO_ESPECIFICO') {
                const turnoLabel = turnoSugerido === 'MANHA'
                    ? 'Turno Manhã (08:00 às 12:00)'
                    : turnoSugerido === 'TARDE'
                    ? 'Turno Tarde (13:00 às 18:00)'
                    : 'Horário Agendado / Janela Específica';
                obsFinal = `[Janela/Turno Solicitado: ${turnoLabel}] ${obsFinal}`;
            }

            const payload = {
                supervisorNome: name,
                codCliente: selectedClientForSuggestion?.Cod_Cliente || selectedClientForSuggestion?.id || null,
                clienteNome: selectedClientForSuggestion?.Razao_Social || selectedClientForSuggestion?.nome || null,
                vendedorNome: sellersList.find(s => s.id === selectedSeller)?.name || 'Vendedor',
                diaAtual: selectedClientForSuggestion?.Dia_Semana || selectedDay,
                diaSugerido: tipoAjuste === 'MUDANCA_DIA' ? diaSugerido : null,
                semanaAtual: selectedClientForSuggestion?.Periodicidade || selectedWeek,
                semanaSugerida: tipoAjuste === 'MUDANCA_SEMANA' ? semanaSugerida : null,
                turnoSugerido: tipoAjuste === 'HORARIO_ESPECIFICO' ? turnoSugerido : null,
                tipoAjuste,
                observacao: obsFinal
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-5 transition-colors duration-200">
            <div className="space-y-4 max-w-[1800px] mx-auto pb-8">
                {/* BLOCO ÚNICO INTEGRADO E COMPACTO: IDENTIFICAÇÃO, SELETOR, AÇÕES, FILTROS E MÉTRICAS */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 shadow-sm space-y-3">
                    {/* LINHA 1: CABEÇALHO COMPACTO INTEGRADO COM SELETOR DE VENDEDOR E AÇÕES */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                <UserCheck size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                        Validação de Rota
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        ID #{simulacaoData.id} • v{SYSTEM_VERSION}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate max-w-[260px] sm:max-w-md" title={simulacaoData.periodo}>
                                        {simulacaoData.periodo}
                                    </h2>
                                    <span className="text-[10px] text-slate-400 hidden sm:inline shrink-0">
                                        • por <strong>{simulacaoData.usuarioSimulacao}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                            {/* SELETOR DE VENDEDOR / SETOR */}
                            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <select
                                    value={selectedSeller}
                                    onChange={e => setSelectedSeller(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer pr-1 py-0.5 max-w-[230px] sm:max-w-xs"
                                >
                                    <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black">
                                        👥 TODOS OS VENDEDORES ({sellersList.reduce((acc, s) => acc + s.clients.length, 0)} PDVs)
                                    </option>
                                    {sellersList.map(s => (
                                        <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                                            {s.name} ({s.clients.length} PDVs)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* IDENTIFICAÇÃO DO SUPERVISOR VINCULADO */}
                            {currentSupervisor && (
                                <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-xl border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold" title="Supervisor vinculado a este setor/vendedor">
                                    <UserCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span className="truncate max-w-[180px]">Sup: {currentSupervisor}</span>
                                </div>
                            )}

                            {/* ALTERNADOR DE TEMA */}
                            <ThemeToggle />

                            {/* BOTÕES DE AÇÃO */}
                            <button
                                onClick={() => setIsHistoryModalOpen(true)}
                                className={`${UI_BUTTON_SECONDARY} text-xs py-1.5 px-2.5 flex items-center gap-1.5 relative`}
                            >
                                <Briefcase size={13} className="text-blue-500" />
                                <span>Sugestões</span>
                                {sugestoes.length > 0 && (
                                    <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                                        {sugestoes.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => handleOpenSuggestionModal()}
                                className={`${UI_BUTTON_SUCCESS} text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs font-bold`}
                            >
                                <MessageSquarePlus size={13} />
                                <span>Sugerir Ajuste</span>
                            </button>
                        </div>
                    </div>

                    {/* LINHA 2: BOTÕES EM PÍLULA DE CICLO E DIAS DA SEMANA */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* GRUPO CICLO */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Ciclo:
                            </span>
                            <div className="inline-flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeek('ALL')}
                                    className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-xs ${
                                        selectedWeek === 'ALL'
                                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    Todas ({cycleCounts.total})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeek('13')}
                                    className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-xs flex items-center gap-1.5 ${
                                        selectedWeek === '13'
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-600'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400 border border-white shrink-0" />
                                    <span>Sem 1/3: <strong>{cycleCounts.c13}</strong></span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedWeek('24')}
                                    className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-xs flex items-center gap-1.5 ${
                                        selectedWeek === '24'
                                            ? 'bg-purple-600 text-white shadow-xs'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-purple-400 border border-white shrink-0" />
                                    <span>Sem 2/4: <strong>{cycleCounts.c24}</strong></span>
                                </button>
                            </div>
                        </div>

                        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden md:block" />

                        {/* GRUPO DIAS DA SEMANA */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                Dias:
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDay('ALL')}
                                    className={`px-2.5 py-1 rounded-lg font-black transition cursor-pointer text-xs border ${
                                        selectedDay === 'ALL'
                                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
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
                                            className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border cursor-pointer ${
                                                isSelected
                                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs ring-2 ring-offset-1'
                                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                            }`}
                                            style={isSelected ? { borderColor: cfg.hex, boxShadow: `0 0 0 1.5px ${cfg.hex}` } : {}}
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: cfg.hex }}
                                            />
                                            <span>{cfg.label}: <strong style={!isSelected ? { color: cfg.hex } : {}}>{stat.count}</strong></span>
                                            {stat.count > 0 && (
                                                <span className="text-[9px] text-slate-400 font-medium">
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
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border cursor-pointer ${
                                            selectedDay === 'SÁBADO'
                                                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs ring-2 ring-cyan-500'
                                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                        }`}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: DAY_COLORS['SÁBADO'].hex }}
                                        />
                                        <span>SÁB: <strong>{dayStats['SÁBADO'].count}</strong></span>
                                        <span className="text-[9px] text-slate-400 font-medium">
                                            • {dayStats['SÁBADO'].estimatedKm}km
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* LINHA 3: CARDS DE MÉTRICAS E TEMPOS DA ROTA (COMPACTADOS) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between text-slate-500 text-[9px] font-extrabold uppercase tracking-wider">
                                <span>PDVs no Dia</span>
                                <Building2 size={12} className="text-blue-500" />
                            </div>
                            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                                {metrics.totalVisitas}
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">visitas programadas</div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between text-slate-500 text-[9px] font-extrabold uppercase tracking-wider">
                                <span>Distância Estimada</span>
                                <Navigation size={12} className="text-emerald-500" />
                            </div>
                            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                                {metrics.totalKm} km
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">{selectedWeek === 'ALL' ? 'média semanal (Sem 1/3 e 2/4)' : 'deslocamento viário'}</div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between text-slate-500 text-[9px] font-extrabold uppercase tracking-wider">
                                <span>Tempo Atendimento</span>
                                <Clock size={12} className="text-amber-500" />
                            </div>
                            <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 leading-tight">
                                {formatMinutesToHours(metrics.tempoAtendimentoMin)}
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">média de {metrics.mediaAtendimentoMin} min/visita</div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between text-slate-500 text-[9px] font-extrabold uppercase tracking-wider">
                                <span>Tempo Percurso</span>
                                <Navigation size={12} className="text-indigo-500" />
                            </div>
                            <div className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 leading-tight">
                                {formatMinutesToHours(metrics.tempoPercursoMin)}
                            </div>
                            <div className="text-[9px] text-slate-400 leading-tight">deslocamento entre pontos</div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 text-[9px] font-extrabold uppercase tracking-wider">
                                <span>Tempo Total Jornada</span>
                                <Clock size={12} className="text-blue-600" />
                            </div>
                            <div className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300 leading-tight">
                                {formatMinutesToHours(metrics.tempoTotalMin)}
                            </div>
                            <div className="text-[9px] text-blue-600 font-bold leading-tight">Atendimento + Percurso</div>
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

                    {/* LEGENDA MULTI-VENDEDOR QUANDO 'ALL' ESTIVER SELECIONADO */}
                    {selectedSeller === 'ALL' && (
                        <div className="mb-3 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Users size={12} className="text-indigo-500" />
                                    Cores por Vendedor / Setor (Clique para mostrar/ocultar)
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-2">
                                    {hiddenSellerIds.size > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setHiddenSellerIds(new Set())}
                                            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-black"
                                        >
                                            Mostrar todos
                                        </button>
                                    )}
                                    <span>{sellersList.length} vendedores • {sellersList.reduce((acc, s) => acc + s.clients.length, 0)} PDVs</span>
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto pr-1">
                                {sellersList.map((s, idx) => {
                                    const colorCfg = sellerColorMap.get(String(s.id)) || SELLER_COLORS[idx % SELLER_COLORS.length];
                                    const isHidden = hiddenSellerIds.has(String(s.id));
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setHiddenSellerIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(String(s.id))) next.delete(String(s.id));
                                                else next.add(String(s.id));
                                                return next;
                                            })}
                                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition hover:scale-105 cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xs ${isHidden ? 'opacity-40 line-through' : ''}`}
                                            title={isHidden ? `Clique para mostrar ${s.name}` : `Clique para ocultar ${s.name}`}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: colorCfg.hex }} />
                                            <span className="truncate max-w-[130px] sm:max-w-[170px] text-slate-800 dark:text-slate-100">{s.name}</span>
                                            <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                {s.clients.length}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="w-full h-[520px] rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800">
                        {/* Controles do traçado: mostrar/ocultar rotas e legenda dos ciclos */}
                        {mapBounds && (
                            <div className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setShowRoutes(prev => !prev)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md cursor-pointer hover:border-slate-400"
                                    title={showRoutes ? 'Ocultar o traçado das rotas no mapa' : 'Exibir o traçado das rotas no mapa'}
                                >
                                    <Navigation size={12} className={showRoutes ? 'text-emerald-600' : 'text-slate-400'} />
                                    <span>{showRoutes ? 'Ocultar rotas' : 'Mostrar rotas'}</span>
                                </button>
                                {showRoutes && selectedWeek === 'ALL' && roadTracks.length > 0 && (
                                    <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/95 dark:bg-slate-900/95 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-md space-y-0.5">
                                        <div className="flex items-center gap-1.5">
                                            <svg width="22" height="4"><line x1="0" y1="2" x2="22" y2="2" stroke="currentColor" strokeWidth="3" /></svg>
                                            <span>Sem 1/3</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <svg width="22" height="4"><line x1="0" y1="2" x2="22" y2="2" stroke="currentColor" strokeWidth="3" strokeDasharray="5 3" /></svg>
                                            <span>Sem 2/4</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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

                                {/* Traçado Viário da Rota com Malha OSRM Real (individual: cor do dia; TODOS: cor de cada vendedor; Sem 2/4 tracejado quando "Todas") */}
                                {showRoutes && roadTracks.map((track) => {
                                    if (!track.points || track.points.length < 2) return null;
                                    const isAllMode = selectedSeller === 'ALL';
                                    return (
                                        <Polyline
                                            key={`track-${track.key}`}
                                            positions={track.points}
                                            pathOptions={{
                                                color: track.color,
                                                weight: isAllMode ? 3 : 4,
                                                opacity: isAllMode ? 0.7 : 0.85,
                                                dashArray: track.dashed ? '8 6' : undefined
                                            }}
                                        />
                                    );
                                })}

                                {/* Marcadores Especiais das Bases Residenciais: No modo ALL exibe de todos os vendedores com suas cores */}
                                {selectedSeller === 'ALL' ? (
                                    allSellersBases.map((base) => (
                                        <Marker
                                            key={`base-${base.sellerId}`}
                                            position={[base.lat, base.lng]}
                                            icon={createHomeIcon(base.color)}
                                            zIndexOffset={1000}
                                        >
                                            <Popup>
                                                <div className="text-xs p-1 space-y-1 font-sans min-w-[200px]">
                                                    <div className="flex items-center space-x-1.5 font-black" style={{ color: base.color }}>
                                                        <span>🏠</span>
                                                        <span className="uppercase tracking-wider text-[10px]">BASE / RESIDÊNCIA</span>
                                                    </div>
                                                    <p className="text-slate-900 dark:text-slate-100 font-bold text-sm">
                                                        {formatSellerDisplayName(base.codigoSetor, base.name)}
                                                    </p>
                                                    {base.address && (
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                                            {base.address}
                                                        </p>
                                                    )}
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                                                        Ponto de partida e retorno diário do colaborador
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))
                                ) : (
                                    activeBaseInfo && filteredVisits.length > 0 && (
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
                                    )
                                )}

                                {/* Marcadores Numerados dos Clientes */}
                                {filteredVisits.map((v: any, index: number) => {
                                    const lat = Number(v.Lat || v.Latitude);
                                    const lon = Number(v.Long || v.Longitude);
                                    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) < 0.001) return null;

                                    const dayKey = normalizeDiaSemana(v.Dia_Semana || v.dia);
                                    // Numeração da parada dentro do dia de cada vendedor
                                    const pinSeq = stopSeqMap.get(getStopKey(v)) || (index + 1);

                                    // Determinação da Cor: No modo TODOS OS VENDEDORES usa a cor do vendedor; caso contrário usa a cor do dia
                                    const sellerId = String(v._sellerId || v.Cod_Vend || '');
                                    const sellerColorCfg = sellerColorMap.get(sellerId) || SELLER_COLORS[0];
                                    const pinColor = selectedSeller === 'ALL' ? sellerColorCfg.hex : (DAY_COLORS[dayKey]?.hex || '#2563eb');

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

                                                    {/* TAG DO VENDEDOR QUANDO NO MODO TODOS */}
                                                    {selectedSeller === 'ALL' && (
                                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border" style={{ backgroundColor: `${pinColor}15`, color: pinColor, borderColor: `${pinColor}40` }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pinColor }} />
                                                            <span>Vendedor: {v._sellerName || `Setor ${sellerId}`}</span>
                                                        </div>
                                                    )}

                                                    <p className="font-bold text-slate-900 leading-tight">
                                                        {v.Cod_Cliente ? `${v.Cod_Cliente} - ${v.Razao_Social || v.nome}` : (v.Razao_Social || v.nome)}
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
                                                    {(() => {
                                                        const stopData = itineraryStops.find((s: any) => (v.Cod_Cliente && s.Cod_Cliente === v.Cod_Cliente) || (v.id && s.id === v.id));
                                                        return stopData ? (
                                                            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-1 text-[9px]">
                                                                <span className="text-blue-700 dark:text-blue-300 font-bold">
                                                                    🚗 Deslocamento: ~{stopData.legTravelTime} min ({stopData.legKm} km)
                                                                </span>
                                                                <span className="text-amber-700 dark:text-amber-300 font-bold">
                                                                    🏢 Atendimento: {stopData.serviceTime} min
                                                                </span>
                                                            </div>
                                                        ) : null;
                                                    })()}
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
                        {selectedSeller === 'ALL' ? (
                            <div className="p-2.5 rounded-2xl bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500/30 dark:border-indigo-800/50 flex items-center justify-between gap-2.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xs flex items-center justify-center shrink-0 border-2 border-white shadow-xs">
                                        🏠
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-black text-slate-900 dark:text-white">
                                                {allSellersBases.length} Bases Residenciais no Mapa
                                            </span>
                                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-indigo-600 text-white uppercase tracking-wider">
                                                MULTI-SETOR
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                            Pontos de partida com as cores exclusivas de cada vendedor
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                    Equipe
                                </span>
                            </div>
                        ) : (
                            activeBaseInfo && filteredVisits.length > 0 && (
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
                            )
                        )}

                        {itineraryStops.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 text-xs">
                                Nenhuma visita agendada para este dia/semana.
                            </div>
                        ) : (
                            itineraryStops.map((v: any, idx: number) => {
                                const dayKey = normalizeDiaSemana(v.Dia_Semana || v.dia);
                                // Numeração da parada dentro do dia de cada vendedor
                                const pinSeq = stopSeqMap.get(getStopKey(v)) || (idx + 1);

                                // Determinação da Cor: No modo TODOS OS VENDEDORES usa a cor do vendedor; caso contrário usa a cor do dia
                                const sellerId = String(v._sellerId || v.Cod_Vend || '');
                                const sellerColorCfg = sellerColorMap.get(sellerId) || SELLER_COLORS[0];
                                const pinColor = selectedSeller === 'ALL' ? sellerColorCfg.hex : (DAY_COLORS[dayKey]?.hex || '#2563eb');

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
                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                            <div
                                                className={`w-6 h-6 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${isSelected ? 'ring-2 ring-white scale-110' : ''}`}
                                                style={{ backgroundColor: isSelected ? '#f43f5e' : pinColor }}
                                            >
                                                {pinSeq}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                                                        {v.Cod_Cliente ? `${v.Cod_Cliente} - ${v.Razao_Social || v.nome}` : (v.Razao_Social || v.nome)}
                                                    </span>

                                                    {/* TAG DO VENDEDOR QUANDO NO MODO TODOS */}
                                                    {selectedSeller === 'ALL' && (
                                                        <span
                                                            className="text-[9px] font-black px-1.5 py-0.2 rounded border shadow-2xs"
                                                            style={{ backgroundColor: `${pinColor}15`, color: pinColor, borderColor: `${pinColor}40` }}
                                                        >
                                                            {v._sellerName ? v._sellerName.split(' - ')[0] : `Setor ${sellerId}`}
                                                        </span>
                                                    )}

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
                                                <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                    PDV {v.Cod_Cliente} • {v.Endereco || v.Bairro || 'Endereço não informado'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {v.Bairro} - {v.Cidade}
                                                </div>
                                                {/* DETALHAMENTO REAL DE DESLOCAMENTO E ATENDIMENTO */}
                                                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[10px]">
                                                    <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-bold px-2 py-0.5 rounded border border-blue-200/80 dark:border-blue-800" title="Tempo e distância estimada de deslocamento desde o ponto anterior">
                                                        <span>🚗</span>
                                                        <span>Deslocamento: <b>~{v.legTravelTime} min</b> ({v.legKm} km)</span>
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-200/80 dark:border-amber-800" title={`Permanência estimada no PDV conforme canal (${v.Canal_Remuneracao || 'PADRÃO'})`}>
                                                        <span>🏢</span>
                                                        <span>Atendimento: <b>{v.serviceTime} min</b></span>
                                                        {v.Canal_Remuneracao && <span className="opacity-75 font-normal">({v.Canal_Remuneracao})</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenSuggestionModal(v);
                                            }}
                                            className="p-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-600 transition-all border border-slate-200 dark:border-slate-600 shrink-0 cursor-pointer mt-0.5"
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
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                        Seu Nome (Supervisor)
                                    </label>
                                    {currentSupervisor && (
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                            Vinculado automaticamente
                                        </span>
                                    )}
                                </div>
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
                                        {selectedClientForSuggestion.Cod_Cliente
                                            ? `${selectedClientForSuggestion.Cod_Cliente} - ${selectedClientForSuggestion.Razao_Social || selectedClientForSuggestion.nome}`
                                            : (selectedClientForSuggestion.Razao_Social || selectedClientForSuggestion.nome)}
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
                                    <option value="HORARIO_ESPECIFICO">Horário específico de atendimento (Janela / Turno)</option>
                                    <option value="MUDANCA_DIA">Alterar dia de atendimento</option>
                                    <option value="MUDANCA_SEMANA">Alterar semana de atendimento</option>
                                    <option value="MUDANCA_SETOR">Transferir para outro setor / vendedor</option>
                                    <option value="OUTRO">Outra observação / Restrição</option>
                                </select>
                            </div>

                            {/* Campos Condicionais */}
                            {tipoAjuste === 'HORARIO_ESPECIFICO' && (
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500">
                                        Janela / Turno Solicitado
                                    </label>
                                    <select
                                        value={turnoSugerido}
                                        onChange={e => setTurnoSugerido(e.target.value)}
                                        className={`${UI_INPUT_BASE} font-bold cursor-pointer`}
                                    >
                                        <option value="MANHA">Manhã (08:00 às 12:00)</option>
                                        <option value="TARDE">Tarde (13:00 às 18:00)</option>
                                        <option value="HORARIO_MARCADO">Horário Agendado / Janela Específica (informar abaixo)</option>
                                    </select>
                                </div>
                            )}

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
                                                PDV: {sug.Cod_Cliente ? `${sug.Cod_Cliente} - ${sug.ClienteNome}` : sug.ClienteNome}
                                            </div>
                                        )}

                                        <div className="text-slate-600 dark:text-slate-300">
                                            {sug.Observacao}
                                        </div>

                                        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                            <span>Tipo: <b>{sug.TipoAjuste === 'HORARIO_ESPECIFICO' ? 'Horário Específico' : sug.TipoAjuste === 'DIA_ESPECIFICO' ? 'Dia Específico' : sug.TipoAjuste === 'MUDANCA_DIA' ? 'Mudança de Dia' : sug.TipoAjuste === 'MUDANCA_SEMANA' ? 'Mudança de Semana' : sug.TipoAjuste === 'MUDANCA_SETOR' ? 'Mudança de Setor' : (sug.TipoAjuste || 'Geral')}</b></span>
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
