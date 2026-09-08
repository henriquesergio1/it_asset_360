import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { DataContext } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import { getVisitasPrevistas, getPromoterClients, saveRotaPrevista, getOSRMData } from './services/apiService';
import { VisitaPrevista, Colaborador } from './types';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';
import {
    CogIcon,
    SpinnerIcon,
    UploadIcon,
    LocationMarkerIcon,
    ArrowRightIcon,
    RefreshIcon,
    ChevronDownIcon,
    CheckCircleIcon,
    ExclamationIcon,
    UserGroupIcon,
    ClockIcon,
    GlobeIcon,
    ClipboardListIcon,
    TruckIcon,
    PlusCircleIcon,
    TrashIcon,
    UsersIcon,
    PresentationChartLineIcon,
    EyeIcon
} from './icons';

// --- CONFIGURAÇÃO DE ÍCONES ---
const PROMOTER_COLORS = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2',
    '#ea580c', '#4f46e5', '#ca8a04', '#65a30d', '#0d9488', '#0284c7', '#4338ca', '#be185d',
    '#e11d48', '#8b5cf6', '#059669', '#9333ea', '#34d399', '#f87171', '#60a5fa', '#a78bfa',
    '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#f43f5e', '#84cc16'
];

function createBaseIcon(color: string) {
    return L.divIcon({
        className: 'custom-base-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
}

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

// Paleta de cores cromáticas e consistentes por dia da semana para visão detalhada de vendedor
export const DAY_COLORS: Record<string, { bg: string, text: string, border: string, hex: string, label: string }> = {
    'SEGUNDA-FEIRA': { bg: 'bg-blue-600', text: 'text-blue-600', border: 'border-blue-500', hex: '#2563eb', label: 'SEG' },
    'TERÇA-FEIRA':   { bg: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-500', hex: '#7c3aed', label: 'TER' },
    'QUARTA-FEIRA':  { bg: 'bg-emerald-600', text: 'text-emerald-600', border: 'border-emerald-500', hex: '#059669', label: 'QUA' },
    'QUINTA-FEIRA':  { bg: 'bg-amber-600', text: 'text-amber-600', border: 'border-amber-500', hex: '#d97706', label: 'QUI' },
    'SEXTA-FEIRA':   { bg: 'bg-rose-600', text: 'text-rose-600', border: 'border-rose-500', hex: '#e11d48', label: 'SEX' },
    'SÁBADO':        { bg: 'bg-cyan-600', text: 'text-cyan-600', border: 'border-cyan-500', hex: '#0891b2', label: 'SÁB' },
    'DOMINGO':       { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-500', hex: '#64748b', label: 'DOM' }
};

// Camada de Mapa de Calor (Heatmap) em Canvas 2D acoplado ao Leaflet
interface HeatmapPoint {
    lat: number;
    lng: number;
}

const HeatmapLayer: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
    const map = useMap();

    useEffect(() => {
        if (!map || points.length === 0) return;

        const pane = map.getPane('overlayPane');
        if (!pane) return;

        const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer') as HTMLCanvasElement;
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '350';
        canvas.style.transition = 'opacity 0.3s ease';
        pane.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Paleta térmica de gradiente contínuo
        const paletteCanvas = document.createElement('canvas');
        paletteCanvas.width = 1;
        paletteCanvas.height = 256;
        const pCtx = paletteCanvas.getContext('2d');
        if (pCtx) {
            const grad = pCtx.createLinearGradient(0, 0, 0, 256);
            grad.addColorStop(0.0, 'rgba(0, 0, 255, 0)');
            grad.addColorStop(0.2, 'rgba(0, 180, 255, 0.45)');
            grad.addColorStop(0.4, 'rgba(0, 255, 120, 0.65)');
            grad.addColorStop(0.65, 'rgba(255, 230, 0, 0.8)');
            grad.addColorStop(0.85, 'rgba(255, 120, 0, 0.9)');
            grad.addColorStop(1.0, 'rgba(240, 20, 20, 0.95)');
            pCtx.fillStyle = grad;
            pCtx.fillRect(0, 0, 1, 256);
        }
        const palette = pCtx ? pCtx.getImageData(0, 0, 1, 256).data : null;

        const redraw = () => {
            const size = map.getSize();
            const bounds = map.getBounds();
            const topLeft = map.containerPointToLayerPoint([0, 0]);

            L.DomUtil.setPosition(canvas, topLeft);
            canvas.width = size.x;
            canvas.height = size.y;
            ctx.clearRect(0, 0, size.x, size.y);

            const visiblePoints = points.filter(p => bounds.contains([p.lat, p.lng]));
            if (visiblePoints.length === 0) return;

            const zoom = map.getZoom();
            const radius = Math.max(18, Math.min(52, Math.round(zoom * 2.8)));

            const shadowCanvas = document.createElement('canvas');
            shadowCanvas.width = size.x;
            shadowCanvas.height = size.y;
            const sCtx = shadowCanvas.getContext('2d');
            if (!sCtx) return;

            visiblePoints.forEach(p => {
                const pt = map.latLngToContainerPoint([p.lat, p.lng]);
                const radGrad = sCtx.createRadialGradient(pt.x, pt.y, radius * 0.15, pt.x, pt.y, radius);
                radGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
                radGrad.addColorStop(1, 'rgba(0,0,0,0)');
                sCtx.fillStyle = radGrad;
                sCtx.beginPath();
                sCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
                sCtx.fill();
            });

            const imgData = sCtx.getImageData(0, 0, size.x, size.y);
            const data = imgData.data;
            if (palette) {
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    if (alpha > 0) {
                        const offset = alpha * 4;
                        data[i] = palette[offset];
                        data[i + 1] = palette[offset + 1];
                        data[i + 2] = palette[offset + 2];
                        data[i + 3] = Math.min(235, Math.round(alpha * 1.25));
                    }
                }
            }
            ctx.putImageData(imgData, 0, 0);
        };

        redraw();

        map.on('moveend', redraw);
        map.on('zoomend', redraw);
        map.on('resize', redraw);

        return () => {
            map.off('moveend', redraw);
            map.off('zoomend', redraw);
            map.off('resize', redraw);
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        };
    }, [map, points]);

    return null;
};

const pinClientIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Helper de distância geodésica em KM
const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

const WEEKDAYS = ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

// Helpers de Periodicidade e Calendário
type PeriodicidadeTipo = 'SEMANAL' | 'QUINZENAL_1_3' | 'QUINZENAL_2_4';

const parsePeriodicidade = (raw: string | undefined): { tipo: PeriodicidadeTipo, original: string } => {
    const p = String(raw || '').trim().toUpperCase();
    if (!p) return { tipo: 'SEMANAL', original: 'SEMANAL' };

    // Quinzenal 1 3 (Semanas 1 e 3)
    if (p.includes('1 3') || p.includes('1, 3') || p.includes('1,3') || p.includes('1-3') || p === '13' || (p.includes('QUINZENAL') && (p.includes('1') || p.includes('IMPAR') || p.includes('ÍMPAR')))) {
        return { tipo: 'QUINZENAL_1_3', original: raw || '1 3' };
    }
    // Quinzenal 2 4 (Semanas 2 e 4)
    if (p.includes('2 4') || p.includes('2, 4') || p.includes('2,4') || p.includes('2-4') || p === '24' || (p.includes('QUINZENAL') && (p.includes('2') || p.includes('PAR')))) {
        return { tipo: 'QUINZENAL_2_4', original: raw || '2 4' };
    }
    // Quinzenal genérico
    if (p.includes('QUINZENAL') || p.includes('QUINZENA')) {
        return { tipo: 'QUINZENAL_1_3', original: raw || '1 3' };
    }
    return { tipo: 'SEMANAL', original: raw || 'SEMANAL' };
};

const normalizeDiaSemana = (dia: string | number | undefined, dateStr?: string): string => {
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
    if (dateStr) {
        return getWeekdayNameFromDate(dateStr);
    }
    return 'SEGUNDA-FEIRA';
};

const getWeekdayNameFromDate = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return 'SEGUNDA-FEIRA';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    switch (dayOfWeek) {
        case 1: return 'SEGUNDA-FEIRA';
        case 2: return 'TERÇA-FEIRA';
        case 3: return 'QUARTA-FEIRA';
        case 4: return 'QUINTA-FEIRA';
        case 5: return 'SEXTA-FEIRA';
        case 6: return 'SÁBADO';
        case 0: return 'DOMINGO';
        default: return 'SEGUNDA-FEIRA';
    }
};

const getWeekNumberInMonth = (dateStr: string): number => {
    const parts = dateStr.split('-');
    const day = parseInt(parts[2], 10) || 1;
    return Math.min(5, Math.floor((day - 1) / 7) + 1);
};

export interface QuinzenaStats {
    v13: number;
    v24: number;
    variationPct: number;
    isImbalanced: boolean;
    hasQuinzenal: boolean;
}

const getSellerQuinzenaStats = (sellerId: number, routes: VisitaPrevista[]): QuinzenaStats => {
    let v13 = 0;
    let v24 = 0;
    let hasQuinzenal = false;
    for (let i = 0; i < routes.length; i++) {
        const v = routes[i];
        if (v.Cod_Vend === sellerId) {
            const p = parsePeriodicidade(v.Periodicidade).tipo;
            if (p === 'SEMANAL') {
                v13++;
                v24++;
            } else if (p === 'QUINZENAL_1_3') {
                v13++;
                hasQuinzenal = true;
            } else if (p === 'QUINZENAL_2_4') {
                v24++;
                hasQuinzenal = true;
            }
        }
    }
    const diff = Math.abs(v13 - v24);
    const max = Math.max(v13, v24);
    const variationPct = max > 0 ? Math.round((diff / max) * 100) : 0;
    const isImbalanced = hasQuinzenal && variationPct > 30;
    return { v13, v24, variationPct, isImbalanced, hasQuinzenal };
};

export const AjusteRota: React.FC = () => {
    const { colaboradores } = useContext(DataContext);
    const { user: authUser } = useAuth();
    const [teamType, setTeamType] = useState<'vendedores' | 'promotores'>('vendedores');
    
    // Rota original carregada vs Rota sendo simulada / ajustada
    const [originalRoutes, setOriginalRoutes] = useState<VisitaPrevista[]>([]);
    const [adjustedRoutes, setAdjustedRoutes] = useState<VisitaPrevista[]>([]);
    
    // NOVO: Mapping manual
    const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
    const [nameMappings, setNameMappings] = useState<Record<string, number>>({});
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [pendingParsedData, setPendingParsedData] = useState<VisitaPrevista[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [optimizeProgress, setOptimizeProgress] = useState<{
        current: number;
        total: number;
        percentage: number;
        currentSellerName: string;
    } | null>(null);

    // Comparativo Antes x Depois
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareOnlyChanged, setCompareOnlyChanged] = useState(true);
    const [compareSearchFilter, setCompareSearchFilter] = useState('');

    // Parâmetros de Roteirização
    const [optMaxClients, setOptMaxClients] = useState(15);
    const [optMaxKm, setOptMaxKm] = useState(60);
    const [optDays, setOptDays] = useState<string[]>(['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
    const [optSatHalfPeriod, setOptSatHalfPeriod] = useState(true);
    const [optBalanceWorkload, setOptBalanceWorkload] = useState(true);

    // Map polylines
    const [originalPolylines, setOriginalPolylines] = useState<{ id: string, color: string, points: [number, number][] }[]>([]);
    const [adjustedPolylines, setAdjustedPolylines] = useState<{ id: string, color: string, points: [number, number][] }[]>([]);
    const [selectedPromoter, setSelectedPromoter] = useState<string>('ALL');

    // Escopo de Roteirização: 'geral' (todos), 'equipe' (supervisor) ou 'vendedor' (individual)
    const [scopeMode, setScopeMode] = useState<'geral' | 'equipe' | 'vendedor'>('geral');
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
    const [selectedSeller, setSelectedSeller] = useState<string>('');

    // Ordenação dinâmica da Grade de Ajuste Fino
    const [sortField, setSortField] = useState<'Cod_Cliente' | 'Razao_Social' | 'Endereco' | 'Nome_Vendedor' | 'Dia_Semana' | 'Periodicidade'>('Cod_Cliente');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Filtros Interativos da Grade de Ajuste Fino e Mapa
    const [selectedDaysFilter, setSelectedDaysFilter] = useState<string[]>([]);
    const [selectedQuinzenaFilter, setSelectedQuinzenaFilter] = useState<'ALL' | '1_3' | '2_4'>('ALL');
    const [showHeatmap, setShowHeatmap] = useState(false);

    // Scroll Spy: cliente em foco selecionado pelo mapa ou pela tabela
    const [highlightedClientCode, setHighlightedClientCode] = useState<number | null>(null);
    const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleToggleDayFilter = (day: string) => {
        setSelectedDaysFilter(prev => {
            if (prev.includes(day)) {
                return prev.filter(d => d !== day);
            } else {
                return [...prev, day];
            }
        });
    };

    const handleClearDayFilter = () => {
        setSelectedDaysFilter([]);
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const teamColaboradores = useMemo(() => {
        return colaboradores.filter(c => {
            const grupo = String(c.Grupo).trim().toUpperCase();
            if (teamType === 'vendedores') return c.Ativo && grupo === 'VENDEDOR';
            return c.Ativo && (grupo === 'PROMOTOR' || grupo === 'PROMOTORES');
        });
    }, [colaboradores, teamType]);

    // Supervisores únicos presentes nas rotas
    const supervisors = useMemo(() => {
        const map = new Map<string, string>();
        adjustedRoutes.forEach(r => {
            const supId = r.Cod_Supervisor ? String(r.Cod_Supervisor) : 'SEM_SUPERVISOR';
            const supNome = r.Nome_Supervisor || 'Equipe sem Supervisor';
            map.set(supId, supNome);
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [adjustedRoutes]);

    // Vendedores disponíveis conforme escopo
    const availableSellers = useMemo(() => {
        const map = new Map<number, { id: number; name: string; supId: string }>();
        adjustedRoutes.forEach(r => {
            const supId = r.Cod_Supervisor ? String(r.Cod_Supervisor) : 'SEM_SUPERVISOR';
            if (scopeMode === 'equipe' && selectedSupervisor && supId !== selectedSupervisor) {
                return;
            }
            if (!map.has(r.Cod_Vend)) {
                map.set(r.Cod_Vend, { id: r.Cod_Vend, name: r.Nome_Vendedor, supId });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [adjustedRoutes, scopeMode, selectedSupervisor]);

    // Rotas ajustadas filtradas pelo escopo ativo (para Mapa, KPIs e Grade)
    const scopedAdjustedRoutes = useMemo(() => {
        if (scopeMode === 'vendedor') {
            if (!selectedSeller) return adjustedRoutes;
            return adjustedRoutes.filter(r => String(r.Cod_Vend) === selectedSeller);
        }
        if (scopeMode === 'equipe') {
            if (!selectedSupervisor) return adjustedRoutes;
            return adjustedRoutes.filter(r => {
                const supId = r.Cod_Supervisor ? String(r.Cod_Supervisor) : 'SEM_SUPERVISOR';
                return supId === selectedSupervisor;
            });
        }
        return adjustedRoutes;
    }, [adjustedRoutes, scopeMode, selectedSupervisor, selectedSeller]);

    // Rotas originais filtradas pelo escopo ativo (para KPIs comparativos)
    const scopedOriginalRoutes = useMemo(() => {
        if (scopeMode === 'vendedor') {
            if (!selectedSeller) return originalRoutes;
            return originalRoutes.filter(r => String(r.Cod_Vend) === selectedSeller);
        }
        if (scopeMode === 'equipe') {
            if (!selectedSupervisor) return originalRoutes;
            return originalRoutes.filter(r => {
                const supId = r.Cod_Supervisor ? String(r.Cod_Supervisor) : 'SEM_SUPERVISOR';
                return supId === selectedSupervisor;
            });
        }
        return originalRoutes;
    }, [originalRoutes, scopeMode, selectedSupervisor, selectedSeller]);

    // Contagem de colaboradores com desbalanceamento quinzenal superior a 30% no escopo ativo
    const imbalancedSellersCount = useMemo(() => {
        const sellerIds = Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend)));
        return sellerIds.filter(id => getSellerQuinzenaStats(id, scopedAdjustedRoutes).isImbalanced).length;
    }, [scopedAdjustedRoutes]);

    // Identificar se a visão atual está focada em um vendedor individual (para ativar distinção de dias/quinzenas)
    const isSingleSellerView = useMemo(() => {
        if (scopeMode === 'vendedor' && selectedSeller) return true;
        if (selectedPromoter !== 'ALL') return true;
        const uniqueSellersInScope = new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend));
        return uniqueSellersInScope.size === 1;
    }, [scopeMode, selectedSeller, selectedPromoter, scopedAdjustedRoutes]);

    // Rotas ajustadas com os filtros interativos aplicados (dias da semana e quinzenas)
    const filteredRoutes = useMemo(() => {
        return scopedAdjustedRoutes.filter(v => {
            if (selectedPromoter !== 'ALL' && String(v.Cod_Vend) !== selectedPromoter) {
                return false;
            }
            if (selectedDaysFilter.length > 0 && !selectedDaysFilter.includes(v.Dia_Semana)) {
                return false;
            }
            if (selectedQuinzenaFilter === '1_3') {
                const p = parsePeriodicidade(v.Periodicidade).tipo;
                if (p !== 'SEMANAL' && p !== 'QUINZENAL_1_3') return false;
            } else if (selectedQuinzenaFilter === '2_4') {
                const p = parsePeriodicidade(v.Periodicidade).tipo;
                if (p !== 'SEMANAL' && p !== 'QUINZENAL_2_4') return false;
            }
            return true;
        });
    }, [scopedAdjustedRoutes, selectedPromoter, selectedDaysFilter, selectedQuinzenaFilter]);

    // Pontos geográficos para renderização do Mapa de Calor (Heatmap)
    const heatmapPoints = useMemo(() => {
        return filteredRoutes
            .filter(v => v.Lat && v.Long)
            .map(v => ({ lat: v.Lat, lng: v.Long }));
    }, [filteredRoutes]);

    // Totais acumulados por Quinzena (Semanas 1/3 e Semanas 2/4) no escopo selecionado
    const quinzenaTotals = useMemo(() => {
        const routes = scopedAdjustedRoutes.filter(v => {
            if (selectedPromoter !== 'ALL' && String(v.Cod_Vend) !== selectedPromoter) return false;
            if (selectedDaysFilter.length > 0 && !selectedDaysFilter.includes(v.Dia_Semana)) return false;
            return true;
        });

        let total13 = 0;
        let total24 = 0;
        let quinzenal13Count = 0;
        let quinzenal24Count = 0;
        let semanalCount = 0;

        routes.forEach(v => {
            const p = parsePeriodicidade(v.Periodicidade).tipo;
            if (p === 'SEMANAL') {
                total13++;
                total24++;
                semanalCount++;
            } else if (p === 'QUINZENAL_1_3') {
                total13++;
                quinzenal13Count++;
            } else if (p === 'QUINZENAL_2_4') {
                total24++;
                quinzenal24Count++;
            }
        });

        const diff = Math.abs(total13 - total24);
        const max = Math.max(total13, total24);
        const variationPct = max > 0 ? Math.round((diff / max) * 100) : 0;

        return {
            total13,
            total24,
            quinzenal13Count,
            quinzenal24Count,
            semanalCount,
            variationPct,
            isImbalanced: variationPct > 30 && (quinzenal13Count > 0 || quinzenal24Count > 0)
        };
    }, [scopedAdjustedRoutes, selectedPromoter, selectedDaysFilter]);

    // Resumo de visitas distribuídas por dia da semana no escopo ativo (Rota Ajustada/Simulada)
    const visitsByDay = useMemo(() => {
        const routes = scopedAdjustedRoutes.filter(v => {
            if (selectedPromoter !== 'ALL' && String(v.Cod_Vend) !== selectedPromoter) return false;
            if (selectedQuinzenaFilter === '1_3') {
                const p = parsePeriodicidade(v.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
            }
            if (selectedQuinzenaFilter === '2_4') {
                const p = parsePeriodicidade(v.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
            }
            return true;
        });
        const counts: Record<string, number> = {};
        WEEKDAYS.forEach(day => { counts[day] = 0; });
        routes.forEach(v => {
            if (counts[v.Dia_Semana] !== undefined) {
                counts[v.Dia_Semana]++;
            }
        });
        return counts;
    }, [scopedAdjustedRoutes, selectedPromoter, selectedQuinzenaFilter]);

    // Resumo de visitas distribuídas por dia da semana no escopo ativo (Rota Original)
    const originalVisitsByDay = useMemo(() => {
        const routes = scopedOriginalRoutes.filter(v => {
            if (selectedPromoter !== 'ALL' && String(v.Cod_Vend) !== selectedPromoter) return false;
            if (selectedQuinzenaFilter === '1_3') {
                const p = parsePeriodicidade(v.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
            }
            if (selectedQuinzenaFilter === '2_4') {
                const p = parsePeriodicidade(v.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
            }
            return true;
        });
        const counts: Record<string, number> = {};
        WEEKDAYS.forEach(day => { counts[day] = 0; });
        routes.forEach(v => {
            if (counts[v.Dia_Semana] !== undefined) {
                counts[v.Dia_Semana]++;
            }
        });
        return counts;
    }, [scopedOriginalRoutes, selectedPromoter, selectedQuinzenaFilter]);

    // Comparativo Detalhado de Clientes: Antes (Original) vs Depois (Simulado)
    const routeComparisonDiff = useMemo(() => {
        const origMap = new Map<string, VisitaPrevista>();
        scopedOriginalRoutes.forEach(r => {
            origMap.set(`${r.Cod_Cliente}-${r.Cod_Vend}`, r);
        });

        const adjMap = new Map<string, VisitaPrevista>();
        scopedAdjustedRoutes.forEach(r => {
            adjMap.set(`${r.Cod_Cliente}-${r.Cod_Vend}`, r);
        });

        const allKeys = Array.from(new Set([...Array.from(origMap.keys()), ...Array.from(adjMap.keys())]));

        interface ClientDiffItem {
            key: string;
            codCliente: number;
            razaoSocial: string;
            endereco: string;
            codVend: number;
            nomeVendedor: string;
            beforeDay: string;
            afterDay: string;
            beforePeriod: string;
            afterPeriod: string;
            changedDay: boolean;
            changedPeriod: boolean;
            isChanged: boolean;
            changeType: 'MUDOU_DIA' | 'MUDOU_QUINZENA' | 'MUDOU_AMBOS' | 'INALTERADO' | 'REMOVIDO' | 'NOVO';
        }

        const items: ClientDiffItem[] = [];

        allKeys.forEach(k => {
            const before = origMap.get(k);
            const after = adjMap.get(k);

            const codCliente = after?.Cod_Cliente || before?.Cod_Cliente || 0;
            const razaoSocial = after?.Razao_Social || before?.Razao_Social || '';
            const endereco = after?.Endereco || before?.Endereco || '';
            const codVend = after?.Cod_Vend || before?.Cod_Vend || 0;
            const nomeVendedor = after?.Nome_Vendedor || before?.Nome_Vendedor || '';

            const beforeDay = before?.Dia_Semana || 'Nenhum';
            const afterDay = after?.Dia_Semana || 'Nenhum';
            const beforePeriod = before?.Periodicidade || 'Semanal';
            const afterPeriod = after?.Periodicidade || 'Semanal';

            const changedDay = beforeDay !== afterDay;
            const changedPeriod = beforePeriod !== afterPeriod;

            let changeType: ClientDiffItem['changeType'] = 'INALTERADO';
            if (!before && after) changeType = 'NOVO';
            else if (before && !after) changeType = 'REMOVIDO';
            else if (changedDay && changedPeriod) changeType = 'MUDOU_AMBOS';
            else if (changedDay) changeType = 'MUDOU_DIA';
            else if (changedPeriod) changeType = 'MUDOU_QUINZENA';

            const isChanged = changeType !== 'INALTERADO';

            // Filtro por promotor/vendedor selecionado na lateral
            if (selectedPromoter !== 'ALL' && String(codVend) !== selectedPromoter) {
                return;
            }

            items.push({
                key: k,
                codCliente,
                razaoSocial,
                endereco,
                codVend,
                nomeVendedor,
                beforeDay,
                afterDay,
                beforePeriod,
                afterPeriod,
                changedDay,
                changedPeriod,
                isChanged,
                changeType
            });
        });

        const totalClients = items.length;
        const totalChanged = items.filter(i => i.isChanged).length;
        const totalUnchanged = totalClients - totalChanged;

        return {
            items,
            totalClients,
            totalChanged,
            totalUnchanged
        };
    }, [scopedOriginalRoutes, scopedAdjustedRoutes, selectedPromoter]);

    // Rotas do escopo ordenadas conforme a coluna selecionada (respeitando os filtros de dias e quinzenas)
    const sortedRoutes = useMemo(() => {
        return [...filteredRoutes].sort((a, b) => {
            let res = 0;
            if (sortField === 'Cod_Cliente') {
                res = Number(a.Cod_Cliente) - Number(b.Cod_Cliente);
            } else if (sortField === 'Razao_Social') {
                res = (a.Razao_Social || '').localeCompare(b.Razao_Social || '');
            } else if (sortField === 'Endereco') {
                res = (a.Endereco || '').localeCompare(b.Endereco || '');
            } else if (sortField === 'Nome_Vendedor') {
                res = (a.Nome_Vendedor || '').localeCompare(b.Nome_Vendedor || '');
            } else if (sortField === 'Dia_Semana') {
                const idxA = WEEKDAYS.indexOf(a.Dia_Semana);
                const idxB = WEEKDAYS.indexOf(b.Dia_Semana);
                res = (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
            } else if (sortField === 'Periodicidade') {
                res = (a.Periodicidade || '').localeCompare(b.Periodicidade || '');
            }
            return sortDirection === 'asc' ? res : -res;
        });
    }, [filteredRoutes, sortField, sortDirection]);

    // Limite dinâmico de renderização da tabela para Scroll Spy
    const visibleRoutesLimit = useMemo(() => {
        if (!highlightedClientCode) return 100;
        const targetIndex = sortedRoutes.findIndex(r => r.Cod_Cliente === highlightedClientCode);
        return targetIndex >= 100 ? Math.min(sortedRoutes.length, targetIndex + 15) : 100;
    }, [sortedRoutes, highlightedClientCode]);

    // Scroll Spy: Destacar cliente clicado no mapa e rolar até a respectiva linha na Grade de Ajuste Fino
    const handleSelectPdvFromMap = (codCliente: number) => {
        const targetRoute = scopedAdjustedRoutes.find(r => r.Cod_Cliente === codCliente);
        if (!targetRoute) return;

        // Se houver filtro de dia da semana ativo que exclua este cliente, inclui o dia no filtro
        if (selectedDaysFilter.length > 0 && !selectedDaysFilter.includes(targetRoute.Dia_Semana)) {
            setSelectedDaysFilter(prev => [...prev, targetRoute.Dia_Semana]);
        }

        // Se houver filtro de quinzena ativo que exclua este cliente, abre para 'ALL'
        if (selectedQuinzenaFilter !== 'ALL') {
            const pType = parsePeriodicidade(targetRoute.Periodicidade).tipo;
            if (selectedQuinzenaFilter === '1_3' && pType === 'QUINZENAL_2_4') {
                setSelectedQuinzenaFilter('ALL');
            } else if (selectedQuinzenaFilter === '2_4' && pType === 'QUINZENAL_1_3') {
                setSelectedQuinzenaFilter('ALL');
            }
        }

        // Se houver filtro de colaborador ativo divergente, expande para todos
        if (selectedPromoter !== 'ALL' && String(targetRoute.Cod_Vend) !== selectedPromoter) {
            setSelectedPromoter('ALL');
        }

        setHighlightedClientCode(codCliente);

        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = setTimeout(() => {
            setHighlightedClientCode(null);
        }, 4500);

        setTimeout(() => {
            const rowElem = document.getElementById(`row-pdv-${codCliente}`);
            if (rowElem) {
                rowElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 120);
    };

    // Limpa timer de destaque ao desmontar
    useEffect(() => {
        return () => {
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    // Mapeamento de cores
    const promoterColorMap = useMemo(() => {
        const map = new Map<string, string>();
        const uniqueIds = Array.from(new Set(originalRoutes.map(v => String(v.Cod_Vend))));
        uniqueIds.forEach((id, idx) => {
            map.set(id, PROMOTER_COLORS[idx % PROMOTER_COLORS.length]);
        });
        return map;
    }, [originalRoutes]);

    useEffect(() => {
        setOriginalRoutes([]);
        setAdjustedRoutes([]);
        setOriginalPolylines([]);
        setAdjustedPolylines([]);
        setScopeMode('geral');
        setSelectedSupervisor('');
        setSelectedSeller('');
        setSelectedDaysFilter([]);
        setSelectedQuinzenaFilter('ALL');
        setShowHeatmap(false);
    }, [teamType]);

    // Carregar rotas vigentes para ajuste (carteira integral da equipe)
    const handleLoadCurrentRoutes = async () => {
        setLoading(true);
        try {
            // Vendas carrega toda a carteira de clientes do banco pela API
            const data = await getVisitasPrevistas();
            
            // FILTRAR APENAS COLABORADORES DA EQUIPE SELECIONADA E NORMALIZAR DIA DA SEMANA
            const filteredData = data.filter(v => {
                let colab = teamColaboradores.find(c => Number(c.CodigoSetor) === Number(v.Cod_Vend));
                return !!colab;
            }).map(v => ({
                ...v,
                Dia_Semana: normalizeDiaSemana(v.Dia_Semana, v.Data_da_Visita)
            }));

            if (filteredData.length === 0) {
                alert(`Nenhum roteiro vigente de ${teamType} encontrado no sistema.`);
            }
            
            setOriginalRoutes(filteredData);
            setAdjustedRoutes(JSON.parse(JSON.stringify(filteredData)));
        } catch (e: any) {
            alert("Erro ao carregar rotas: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const processRoteiroParsedData = (parsedData: VisitaPrevista[], mappings: Record<string, number>) => {
        const finalData = parsedData.map(v => {
            const mappedId = mappings[v.Nome_Vendedor];
            if (mappedId) {
                v.Cod_Vend = Number(mappedId);
                const colab = teamColaboradores.find(c => c.CodigoSetor === v.Cod_Vend);
                if (colab) v.Nome_Vendedor = colab.Nome;
            }
            return v;
        }).filter(v => v.Cod_Vend && v.Cod_Vend > 0);

        if (finalData.length === 0) {
            alert("Nenhum dado válido restou após o mapeamento de promotores.");
            setLoading(false);
            return;
        }

        setOriginalRoutes(finalData);
        setAdjustedRoutes(JSON.parse(JSON.stringify(finalData)));
        setLoading(false);
        alert(`Sucesso! ${finalData.length} visitas carregadas da planilha.`);
    };

    // Fazer upload de roteiro personalizado via Excel (.xlsx)
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const ws = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws) as any[];

                const clients = await getPromoterClients();
                const clientMap = new Map();
                clients.forEach(c => {
                    const key = String(c.Cod_Cliente ?? c.COD_CLIENTE ?? c.CODCET ?? '').trim();
                    if (key) {
                        clientMap.set(key, c);
                        const keyNoZero = key.replace(/^0+/, '');
                        if (keyNoZero && !clientMap.has(keyNoZero)) {
                            clientMap.set(keyNoZero, c);
                        }
                    }
                });

                const parsed: VisitaPrevista[] = [];
                const uniqueNames = new Set<string>();

                json.forEach(row => {
                    const nome = row['NOME DO COLABORADOR'] || row['Nome'] || row['Colaborador'];
                    const codPdv = row['CODIGO PDV'] || row['Cod_Cliente'] || row['Codigo'] || row['Cod. Cliente'] || row['Cliente'] || row['CODIGO'];
                    
                    if (nome && codPdv) {
                        uniqueNames.add(nome);
                        const codPdvStr = String(codPdv).trim();
                        const codPdvNoZero = codPdvStr.replace(/^0+/, '');
                        const clientData = clientMap.get(codPdvStr) || clientMap.get(codPdvNoZero);
                        
                        const diaSemanaRaw = String(row['SEMANA'] || row['NOME DIA'] || row['DIA SEMANA'] || row['DIA SEN'] || row['Dia da Semana'] || 'SEGUNDA-FEIRA').trim().toUpperCase();
                        const diaSemana = (() => {
                            if (diaSemanaRaw === '1' || diaSemanaRaw.includes('SEGUNDA')) return 'SEGUNDA-FEIRA';
                            if (diaSemanaRaw === '2' || diaSemanaRaw.includes('TERCA') || diaSemanaRaw.includes('TERÇA')) return 'TERÇA-FEIRA';
                            if (diaSemanaRaw === '3' || diaSemanaRaw.includes('QUARTA')) return 'QUARTA-FEIRA';
                            if (diaSemanaRaw === '4' || diaSemanaRaw.includes('QUINTA')) return 'QUINTA-FEIRA';
                            if (diaSemanaRaw === '5' || diaSemanaRaw.includes('SEXTA')) return 'SEXTA-FEIRA';
                            if (diaSemanaRaw === '6' || diaSemanaRaw.includes('SABADO') || diaSemanaRaw.includes('SÁBADO')) return 'SÁBADO';
                            if (diaSemanaRaw === '7' || diaSemanaRaw.includes('DOMINGO')) return 'DOMINGO';
                            return 'SEGUNDA-FEIRA';
                        })();

                        parsed.push({
                            Cod_Vend: 0,
                            Nome_Vendedor: nome,
                            Cod_Supervisor: 0,
                            Nome_Supervisor: 'Equipe Importada',
                            Cod_Cliente: parseInt(codPdv),
                            Razao_Social: clientData ? clientData.Razao_Social : row['Razão Social'] || row['Razao_Social'] || `PDV ${codPdv}`,
                            Dia_Semana: diaSemana,
                            Periodicidade: row['FREQUENCIA'] || 'SEMANAL',
                            Data_da_Visita: new Date().toISOString().split('T')[0],
                            Endereco: clientData ? clientData.Endereco : row['Endereço'] || row['Endereco'] || '',
                            Bairro: clientData ? clientData.Bairro : row['Bairro'] || '',
                            Cidade: clientData ? clientData.Cidade : row['Cidade'] || '',
                            CEP: clientData ? clientData.CEP : row['CEP'] || '',
                            Lat: clientData ? clientData.Lat : parseFloat(row['Lat'] || '0'),
                            Long: clientData ? clientData.Long : parseFloat(row['Long'] || '0')
                        });
                    }
                });

                const newMappings: Record<string, number> = { ...nameMappings };
                const unmatched: string[] = [];

                uniqueNames.forEach(nome => {
                    if (newMappings[nome]) return;

                    const upperNome = nome.trim().toUpperCase();
                    const colab = teamColaboradores.find(col => col.Nome.trim().toUpperCase() === upperNome);

                    if (colab) {
                        newMappings[nome] = colab.CodigoSetor;
                    } else {
                        unmatched.push(nome);
                    }
                });

                setNameMappings(newMappings);

                if (unmatched.length > 0) {
                    setUnmatchedNames(unmatched);
                    setPendingParsedData(parsed);
                    setShowMappingModal(true);
                    setLoading(false);
                } else {
                    processRoteiroParsedData(parsed, newMappings);
                }
            } catch (err: any) {
                alert("Erro ao ler excel: " + err.message);
            } finally {
                // setLoading is handled by the branches
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // Algoritmo de Otimização (Carteira Blindada por Vendedor + Preservação Estrita de Periodicidade)
    const handleOptimizeSimulate = async () => {
        if (adjustedRoutes.length === 0) {
            alert("Nenhum dado de rota carregado para otimização.");
            return;
        }

        // A carteira é do vendedor: isolamento total por Cod_Vend (otimiza estritamente os vendedores do escopo selecionado)
        const sellers = Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend)));
        if (sellers.length === 0) {
            alert("Nenhum vendedor encontrado no escopo selecionado.");
            return;
        }

        setLoading(true);
        setOptimizeProgress({
            current: 0,
            total: sellers.length,
            percentage: 0,
            currentSellerName: 'Iniciando otimização...'
        });

        // Aguarda renderização inicial da barra
        await new Promise(r => setTimeout(r, 60));

        const result: VisitaPrevista[] = [];
        const activeDays = optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA'];

        for (let sIdx = 0; sIdx < sellers.length; sIdx++) {
            const sellerId = sellers[sIdx];
            const sellerVisits = adjustedRoutes.filter(r => r.Cod_Vend === sellerId);
            const colab = colaboradores.find(c => c.CodigoSetor === sellerId);
            const sellerName = colab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : `Vendedor ${sellerId}`);

            const currentPct = Math.round(((sIdx) / sellers.length) * 100);
            setOptimizeProgress({
                current: sIdx + 1,
                total: sellers.length,
                percentage: currentPct,
                currentSellerName: `${sellerName} (${sIdx + 1}/${sellers.length})`
            });

            // Permite que o browser renderize a barra de progresso
            await new Promise(r => setTimeout(r, 25));

            if (sellerVisits.length === 0) continue;

            // 1. Extrair clientes ÚNICOS da carteira deste vendedor
            const uniqueClientsMap = new Map<number, {
                sampleVisit: VisitaPrevista;
                tipo: PeriodicidadeTipo;
                originalPeriodicidade: string;
            }>();

            sellerVisits.forEach(v => {
                if (!uniqueClientsMap.has(v.Cod_Cliente)) {
                    const parsed = parsePeriodicidade(v.Periodicidade);
                    uniqueClientsMap.set(v.Cod_Cliente, {
                        sampleVisit: v,
                        tipo: parsed.tipo,
                        originalPeriodicidade: v.Periodicidade || parsed.original
                    });
                }
            });

            const uniqueClients = Array.from(uniqueClientsMap.values());
            if (uniqueClients.length === 0) continue;

            const baseLat = colab?.LatitudeBase || uniqueClients[0].sampleVisit.Lat || 0;
            const baseLong = colab?.LongitudeBase || uniqueClients[0].sampleVisit.Long || 0;

            // 2. Ordenação geográfica inicial a partir da base (Nearest Neighbor)
            let unassigned = [...uniqueClients];
            const orderedClients: typeof uniqueClients = [];
            let curLat = baseLat;
            let curLng = baseLong;

            while (unassigned.length > 0) {
                let nearestIdx = 0;
                let minDist = Infinity;
                for (let i = 0; i < unassigned.length; i++) {
                    const lat = unassigned[i].sampleVisit.Lat || 0;
                    const lng = unassigned[i].sampleVisit.Long || 0;
                    const dist = calcDist(curLat, curLng, lat, lng);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestIdx = i;
                    }
                }
                const nearest = unassigned.splice(nearestIdx, 1)[0];
                orderedClients.push(nearest);
                curLat = nearest.sampleVisit.Lat || curLat;
                curLng = nearest.sampleVisit.Long || curLng;
            }

            // 3. Alocação nos dias ativos respeitando capacidades e balanceamento de quinzenas
            interface DayBucket {
                day: string;
                maxCap: number;
                semanais: typeof uniqueClients;
                quinzenais13: typeof uniqueClients;
                quinzenais24: typeof uniqueClients;
            }

            const dayBuckets: DayBucket[] = activeDays.map(day => ({
                day,
                maxCap: (day === 'SÁBADO' && optSatHalfPeriod) ? Math.max(1, Math.floor(optMaxClients / 2)) : optMaxClients,
                semanais: [],
                quinzenais13: [],
                quinzenais24: []
            }));

            let dayIdx = 0;

            orderedClients.forEach(client => {
                if (client.tipo === 'SEMANAL') {
                    // Semanal: ocupa vaga em ambas as quinzenas (ímpar e par)
                    let placed = false;
                    for (let step = 0; step < dayBuckets.length; step++) {
                        const bucket = dayBuckets[(dayIdx + step) % dayBuckets.length];
                        const capImpar = bucket.semanais.length + bucket.quinzenais13.length;
                        const capPar = bucket.semanais.length + bucket.quinzenais24.length;

                        if (capImpar < bucket.maxCap && capPar < bucket.maxCap) {
                            bucket.semanais.push(client);
                            dayIdx = (dayIdx + step) % dayBuckets.length;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        // Fallback para dia com menor carga
                        const bestBucket = [...dayBuckets].sort((a, b) => 
                            (a.semanais.length * 2 + a.quinzenais13.length + a.quinzenais24.length) - 
                            (b.semanais.length * 2 + b.quinzenais13.length + b.quinzenais24.length)
                        )[0];
                        bestBucket.semanais.push(client);
                    }
                } else {
                    // Quinzenal: periodicidade estritamente quinzenal!
                    // Pode ajustar a quinzena (1 3 vs 2 4) para nivelar o teto diário
                    const preferredSlot: '1_3' | '2_4' = client.tipo === 'QUINZENAL_2_4' ? '2_4' : '1_3';
                    let placed = false;

                    for (let step = 0; step < dayBuckets.length; step++) {
                        const bucket = dayBuckets[(dayIdx + step) % dayBuckets.length];
                        const capImpar = bucket.semanais.length + bucket.quinzenais13.length;
                        const capPar = bucket.semanais.length + bucket.quinzenais24.length;

                        // 1ª tentativa: no slot preferido
                        if (preferredSlot === '1_3' && capImpar < bucket.maxCap) {
                            bucket.quinzenais13.push(client);
                            dayIdx = (dayIdx + step) % dayBuckets.length;
                            placed = true;
                            break;
                        } else if (preferredSlot === '2_4' && capPar < bucket.maxCap) {
                            bucket.quinzenais24.push(client);
                            dayIdx = (dayIdx + step) % dayBuckets.length;
                            placed = true;
                            break;
                        } else if (optBalanceWorkload) {
                            // 2ª tentativa: balanceia ajustando de 1 3 para 2 4 (ou 2 4 para 1 3)
                            if (preferredSlot === '1_3' && capPar < bucket.maxCap) {
                                bucket.quinzenais24.push(client);
                                dayIdx = (dayIdx + step) % dayBuckets.length;
                                placed = true;
                                break;
                            } else if (preferredSlot === '2_4' && capImpar < bucket.maxCap) {
                                bucket.quinzenais13.push(client);
                                dayIdx = (dayIdx + step) % dayBuckets.length;
                                placed = true;
                                break;
                            }
                        }
                    }

                    if (!placed) {
                        const bucket = dayBuckets[dayIdx % dayBuckets.length];
                        const capImpar = bucket.semanais.length + bucket.quinzenais13.length;
                        const capPar = bucket.semanais.length + bucket.quinzenais24.length;
                        if (capImpar <= capPar) {
                            bucket.quinzenais13.push(client);
                        } else {
                            bucket.quinzenais24.push(client);
                        }
                        dayIdx = (dayIdx + 1) % dayBuckets.length;
                    }
                }
            });

            // 4. Mapear cada cliente para seu plano com novo dia e periodicidade quinzenal ajustada
            interface ClientPlan {
                client: typeof uniqueClients[0];
                diaSemana: string;
                periodicidade: string;
                tipo: PeriodicidadeTipo;
            }

            const clientPlans: ClientPlan[] = [];

            dayBuckets.forEach(bucket => {
                bucket.semanais.forEach(c => {
                    clientPlans.push({
                        client: c,
                        diaSemana: bucket.day,
                        periodicidade: 'SEMANAL',
                        tipo: 'SEMANAL'
                    });
                });

                bucket.quinzenais13.forEach(c => {
                    const novaPeriod = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (1,3)' : '1 3';
                    clientPlans.push({
                        client: c,
                        diaSemana: bucket.day,
                        periodicidade: novaPeriod,
                        tipo: 'QUINZENAL_1_3'
                    });
                });

                bucket.quinzenais24.forEach(c => {
                    const novaPeriod = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (2,4)' : '2 4';
                    clientPlans.push({
                        client: c,
                        diaSemana: bucket.day,
                        periodicidade: novaPeriod,
                        tipo: 'QUINZENAL_2_4'
                    });
                });
            });

            // 5. Adicionar visitas com dias e periodicidades atualizados à rota final
            clientPlans.forEach(p => {
                result.push({
                    ...p.client.sampleVisit,
                    Cod_Vend: sellerId,
                    Nome_Vendedor: sellerName,
                    Dia_Semana: p.diaSemana,
                    Periodicidade: p.periodicidade,
                    Data_da_Visita: p.client.sampleVisit.Data_da_Visita || ''
                });
            });
        }

        setOptimizeProgress({
            current: sellers.length,
            total: sellers.length,
            percentage: 100,
            currentSellerName: 'Finalizando aplicação das rotas...'
        });
        await new Promise(r => setTimeout(r, 100));

        if (result.length === 0) {
            alert("Aviso: Nenhuma visita pôde ser gerada para os dias ativos configurados.");
            setLoading(false);
            setOptimizeProgress(null);
            return;
        }

        setAdjustedRoutes(prev => {
            const otherRoutes = prev.filter(r => !sellers.includes(r.Cod_Vend));
            return [...otherRoutes, ...result];
        });

        setLoading(false);
        setOptimizeProgress(null);

        const escopoDesc = scopeMode === 'vendedor' 
            ? 'do vendedor selecionado' 
            : (scopeMode === 'equipe' ? 'da equipe de supervisão selecionada' : 'geral');
        alert(`Otimização concluída (${escopoDesc})!\n\n• Carteiras mantidas 100% exclusivas por vendedor (zero transferência).\n• Clientes semanais preservados semanalmente.\n• Clientes quinzenais balanceados entre as semanas 1 3 e 2 4.\n• Total de visitas organizadas: ${result.length}`);
    };

    const osrmCacheRef = useRef<Map<string, [number, number][]>>(new Map());

    // Traçar polilinhas baseadas na ordem geográfica das visitas no mapa
    useEffect(() => {
        const traceAsync = async (routes: VisitaPrevista[]) => {
            const sellers = Array.from(new Set(routes.map(r => r.Cod_Vend)));
            const lines: { id: string, color: string, points: [number, number][] }[] = [];

            for (const sellerId of sellers) {
                if (selectedPromoter !== 'ALL' && String(sellerId) !== selectedPromoter) continue;

                const colab = colaboradores.find(c => c.CodigoSetor === sellerId);
                const sellerVisits = routes.filter(r => r.Cod_Vend === sellerId);
                const sellerBaseColor = promoterColorMap.get(String(sellerId)) || '#64748b';

                // Separar por dia da semana
                const groupedByDay = new Map<string, VisitaPrevista[]>();
                sellerVisits.forEach(v => {
                    if (!groupedByDay.has(v.Dia_Semana)) groupedByDay.set(v.Dia_Semana, []);
                    groupedByDay.get(v.Dia_Semana)!.push(v);
                });

                for (const [day, visits] of groupedByDay.entries()) {
                    const sortedVisits = visits; // Mantém a ordem sequencial
                    const lineColor = isSingleSellerView ? (DAY_COLORS[day]?.hex || sellerBaseColor) : sellerBaseColor;
                    
                    const pointsObj: any[] = [];
                    if (colab?.LatitudeBase && colab?.LongitudeBase) {
                        pointsObj.push({ Lat: colab.LatitudeBase, Long: colab.LongitudeBase });
                    }
                    sortedVisits.forEach(v => {
                        if (v.Lat && v.Long) pointsObj.push({ Lat: v.Lat, Long: v.Long });
                    });
                    if (colab?.LatitudeBase && colab?.LongitudeBase && pointsObj.length > 1) {
                        pointsObj.push({ Lat: colab.LatitudeBase, Long: colab.LongitudeBase });
                    }

                    if (pointsObj.length > 1) {
                        const hashKey = pointsObj.map(p => `${p.Lat},${p.Long}`).join('|');
                        
                        if (osrmCacheRef.current.has(hashKey)) {
                            lines.push({ id: `${sellerId}-${day}`, color: lineColor, points: osrmCacheRef.current.get(hashKey)! });
                        } else {
                            try {
                                const osrm = await getOSRMData(pointsObj, false);
                                if (osrm && osrm.geometry && osrm.geometry.length > 0) {
                                    osrmCacheRef.current.set(hashKey, osrm.geometry);
                                    lines.push({ id: `${sellerId}-${day}`, color: lineColor, points: osrm.geometry });
                                } else {
                                    const straightCoords = pointsObj.map(c => [c.Lat, c.Long] as [number, number]);
                                    osrmCacheRef.current.set(hashKey, straightCoords);
                                    lines.push({ id: `${sellerId}-${day}`, color: lineColor, points: straightCoords });
                                }
                            } catch (e) {
                                const straightCoords = pointsObj.map(c => [c.Lat, c.Long] as [number, number]);
                                lines.push({ id: `${sellerId}-${day}`, color: lineColor, points: straightCoords });
                            }
                        }
                    }
                }
            }
            return lines;
        };

        let isMounted = true;
        
        const updateLines = async () => {
            const filteredOriginal = scopedOriginalRoutes.filter(v => {
                if (selectedPromoter !== 'ALL' && String(v.Cod_Vend) !== selectedPromoter) return false;
                if (selectedDaysFilter.length > 0 && !selectedDaysFilter.includes(v.Dia_Semana)) return false;
                if (selectedQuinzenaFilter === '1_3') {
                    const p = parsePeriodicidade(v.Periodicidade).tipo;
                    if (p !== 'SEMANAL' && p !== 'QUINZENAL_1_3') return false;
                } else if (selectedQuinzenaFilter === '2_4') {
                    const p = parsePeriodicidade(v.Periodicidade).tipo;
                    if (p !== 'SEMANAL' && p !== 'QUINZENAL_2_4') return false;
                }
                return true;
            });

            if (filteredOriginal.length > 0) {
                const orig = await traceAsync(filteredOriginal);
                if (isMounted) setOriginalPolylines(orig);
            } else {
                if (isMounted) setOriginalPolylines([]);
            }

            if (filteredRoutes.length > 0) {
                const adj = await traceAsync(filteredRoutes);
                if (isMounted) setAdjustedPolylines(adj);
            } else {
                if (isMounted) setAdjustedPolylines([]);
            }
        };

        updateLines();
        
        return () => { isMounted = false; };
    }, [filteredRoutes, scopedOriginalRoutes, selectedDaysFilter, selectedQuinzenaFilter, selectedPromoter, promoterColorMap, colaboradores, isSingleSellerView]);

    // Calcular KPIs de Comparação
    const kpis = useMemo(() => {
        const getKpisForSet = (visits: VisitaPrevista[]) => {
            let totalKm = 0;
            const sellers = Array.from(new Set(visits.map(r => r.Cod_Vend)));
            const countsPerSellerAndDay = new Map<string, number>();

            sellers.forEach(sellerId => {
                const colab = colaboradores.find(c => c.CodigoSetor === sellerId);
                const sellerVisits = visits.filter(r => r.Cod_Vend === sellerId);

                // Calcular distância estimada sequencial
                let curLat = colab?.LatitudeBase || (sellerVisits[0]?.Lat || 0);
                let curLng = colab?.LongitudeBase || (sellerVisits[0]?.Long || 0);

                sellerVisits.forEach(v => {
                    const dist = calcDist(curLat, curLng, v.Lat, v.Long);
                    totalKm += dist;
                    curLat = v.Lat;
                    curLng = v.Long;

                    const dayKey = `${sellerId}-${v.Dia_Semana}`;
                    countsPerSellerAndDay.set(dayKey, (countsPerSellerAndDay.get(dayKey) || 0) + 1);
                });

                // Volta para base
                if (colab?.LatitudeBase && colab?.LongitudeBase && sellerVisits.length > 0) {
                    totalKm += calcDist(curLat, curLng, colab.LatitudeBase, colab.LongitudeBase);
                }
            });

            const maxClientsOnSingleDay = Math.max(...Array.from(countsPerSellerAndDay.values()), 0);
            const exceededKmCount = sellers.filter(sellerId => {
                // Cálculo individual simples
                let km = 0;
                const colab = colaboradores.find(c => c.CodigoSetor === sellerId);
                const sVisits = visits.filter(r => r.Cod_Vend === sellerId);
                let lat = colab?.LatitudeBase || (sVisits[0]?.Lat || 0);
                let lng = colab?.LongitudeBase || (sVisits[0]?.Long || 0);
                sVisits.forEach(v => {
                    km += calcDist(lat, lng, v.Lat, v.Long);
                    lat = v.Lat; lng = v.Long;
                });
                if (colab?.LatitudeBase && colab?.LongitudeBase) km += calcDist(lat, lng, colab.LatitudeBase, colab.LongitudeBase);
                return km > optMaxKm;
            }).length;

            return {
                totalKm: Math.round(totalKm * 1.15), // Fator de ajuste de rota real aproximado
                avgKmPerSeller: sellers.length ? Math.round((totalKm * 1.15) / sellers.length) : 0,
                maxClientsOnSingleDay,
                exceededKmCount,
                sellerCount: sellers.length,
                clientCount: visits.length
            };
        };

        const orig = getKpisForSet(scopedOriginalRoutes);
        const adj = getKpisForSet(scopedAdjustedRoutes);

        const kmSaved = orig.totalKm - adj.totalKm;
        const percentSaved = orig.totalKm ? Math.round((kmSaved / orig.totalKm) * 100) : 0;

        return {
            original: orig,
            adjusted: adj,
            kmSaved,
            percentSaved
        };
    }, [scopedOriginalRoutes, scopedAdjustedRoutes, colaboradores, optMaxKm]);

    // Reatribuir vendedor, dia de visita ou quinzena manualmente
    const handleManualReassign = (clientCode: number, targetSellerId: number, targetDay: string, targetPeriodicidade?: string) => {
        const targetColab = colaboradores.find(c => c.CodigoSetor === targetSellerId);
        
        setAdjustedRoutes(prev => prev.map(v => {
            if (v.Cod_Cliente === clientCode) {
                // Para equipe de vendas, a carteira é fechada: preserva rigorosamente o vendedor original
                const finalSellerId = teamType === 'vendedores' ? v.Cod_Vend : targetSellerId;
                const finalSellerName = teamType === 'vendedores' ? v.Nome_Vendedor : (targetColab?.Nome || v.Nome_Vendedor);
                return {
                    ...v,
                    Cod_Vend: finalSellerId,
                    Nome_Vendedor: finalSellerName,
                    Dia_Semana: targetDay,
                    Periodicidade: targetPeriodicidade !== undefined ? targetPeriodicidade : v.Periodicidade
                };
            }
            return v;
        }));
    };

    // Excluir visita do roteiro de ajuste
    const handleExcludeVisit = (clientCode: number) => {
        if (!confirm("Deseja remover esta visita do ajuste de rota?")) return;
        setAdjustedRoutes(prev => prev.filter(v => v.Cod_Cliente !== clientCode));
    };

    // Exportar Roteiro Otimizado em Múltiplas Abas no Excel (Consolidado e por Equipe/Vendedor)
    const handleExportExcel = () => {
        if (scopedAdjustedRoutes.length === 0) {
            alert("Nenhum dado para exportar no escopo atual.");
            return;
        }

        // Sanitização de nome da aba conforme limites estritos do Excel (máx 31 chars e sem caracteres inválidos)
        const sanitizeSheetName = (name: string, fallback: string) => {
            const cleaned = (name || fallback).replace(/[\\/?*\[\]:]/g, ' ').trim();
            return cleaned.slice(0, 30) || fallback;
        };

        const usedSheetNames = new Set<string>();
        const getUniqueSheetName = (rawName: string, fallback: string) => {
            let base = sanitizeSheetName(rawName, fallback);
            let candidate = base;
            let counter = 1;
            while (usedSheetNames.has(candidate.toLowerCase())) {
                const suffix = `_${counter}`;
                candidate = base.slice(0, 31 - suffix.length) + suffix;
                counter++;
            }
            usedSheetNames.add(candidate.toLowerCase());
            return candidate;
        };

        const mapRow = (v: VisitaPrevista, idx: number) => {
            const parsed = parsePeriodicidade(v.Periodicidade);
            let semanaDesc = 'Semanal (Todas as Semanas)';
            if (parsed.tipo === 'QUINZENAL_1_3') semanaDesc = '1 e 3 (Ímpares)';
            else if (parsed.tipo === 'QUINZENAL_2_4') semanaDesc = '2 e 4 (Pares)';

            return {
                'CARGO': teamType === 'vendedores' ? 'VENDEDOR' : 'PROMOTOR',
                'CODIGO': v.Cod_Vend,
                'NOME DO COLABORADOR': v.Nome_Vendedor,
                'SUPERVISOR': v.Nome_Supervisor || 'Não informado',
                'FREQUENCIA': v.Periodicidade || 'SEMANAL',
                'QUINZENA / SEMANA': semanaDesc,
                'DIA SEMANA': v.Dia_Semana,
                'ORDEM VISITA': idx + 1,
                'CODIGO PDV': v.Cod_Cliente,
                'RAZAO SOCIAL': v.Razao_Social,
                'ENDERECO': v.Endereco,
                'BAIRRO': v.Bairro,
                'CIDADE': v.Cidade,
                'CEP': v.CEP
            };
        };

        const wb = XLSX.utils.book_new();

        if (scopeMode === 'geral') {
            // 1. Aba Consolidada Geral
            const wsGeral = XLSX.utils.json_to_sheet(scopedAdjustedRoutes.map(mapRow));
            XLSX.utils.book_append_sheet(wb, wsGeral, getUniqueSheetName("Geral Consolidado", "Geral"));

            // 2. Abas individuais para cada Equipe de Supervisão
            const supMap = new Map<string, VisitaPrevista[]>();
            scopedAdjustedRoutes.forEach(v => {
                const supKey = v.Nome_Supervisor ? `Sup. ${v.Nome_Supervisor}` : (v.Cod_Supervisor ? `Supervisão ${v.Cod_Supervisor}` : 'Outros');
                if (!supMap.has(supKey)) supMap.set(supKey, []);
                supMap.get(supKey)?.push(v);
            });

            supMap.forEach((visits, supName) => {
                const ws = XLSX.utils.json_to_sheet(visits.map(mapRow));
                XLSX.utils.book_append_sheet(wb, ws, getUniqueSheetName(supName, "Equipe"));
            });
        } else if (scopeMode === 'equipe') {
            const currentSup = supervisors.find(s => s.id === selectedSupervisor);
            const supTitle = currentSup?.name ? `Sup. ${currentSup.name}` : `Equipe ${selectedSupervisor || 'Geral'}`;

            // 1. Aba Consolidada da Equipe Selecionada
            const wsTeam = XLSX.utils.json_to_sheet(scopedAdjustedRoutes.map(mapRow));
            XLSX.utils.book_append_sheet(wb, wsTeam, getUniqueSheetName(supTitle, "Equipe"));

            // 2. Abas individuais para cada Vendedor da equipe
            const sellerMap = new Map<number, VisitaPrevista[]>();
            scopedAdjustedRoutes.forEach(v => {
                if (!sellerMap.has(v.Cod_Vend)) sellerMap.set(v.Cod_Vend, []);
                sellerMap.get(v.Cod_Vend)?.push(v);
            });

            sellerMap.forEach((visits, vendId) => {
                const sellerName = visits[0]?.Nome_Vendedor || `Vend ${vendId}`;
                const wsSeller = XLSX.utils.json_to_sheet(visits.map(mapRow));
                XLSX.utils.book_append_sheet(wb, wsSeller, getUniqueSheetName(sellerName, `Vend_${vendId}`));
            });
        } else {
            // scopeMode === 'vendedor'
            const currentSeller = availableSellers.find(s => String(s.id) === selectedSeller);
            const sellerTitle = currentSeller?.name || `Vendedor ${selectedSeller || 'Individual'}`;

            // 1. Aba Consolidada do Vendedor
            const wsSeller = XLSX.utils.json_to_sheet(scopedAdjustedRoutes.map(mapRow));
            XLSX.utils.book_append_sheet(wb, wsSeller, getUniqueSheetName(sellerTitle, "Vendedor"));

            // 2. Abas por Dia da Semana do Vendedor
            const dayMap = new Map<string, VisitaPrevista[]>();
            scopedAdjustedRoutes.forEach(v => {
                if (!dayMap.has(v.Dia_Semana)) dayMap.set(v.Dia_Semana, []);
                dayMap.get(v.Dia_Semana)?.push(v);
            });

            WEEKDAYS.forEach(day => {
                const dayVisits = dayMap.get(day);
                if (dayVisits && dayVisits.length > 0) {
                    const wsDay = XLSX.utils.json_to_sheet(dayVisits.map(mapRow));
                    XLSX.utils.book_append_sheet(wb, wsDay, getUniqueSheetName(day.split('-')[0], day));
                }
            });
        }

        const tag = scopeMode === 'equipe' ? `_Equipe_${selectedSupervisor}` : (scopeMode === 'vendedor' ? `_Vend_${selectedSeller}` : '_Geral_Abas');
        XLSX.writeFile(wb, `Ajuste_Rota_${teamType}${tag}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Salvar Rota Ajustada no Banco (saveRotaPrevista)
    const handleSaveDatabase = async () => {
        if (adjustedRoutes.length === 0) {
            alert("Sem rotas para salvar.");
            return;
        }

        const tag = teamType === 'vendedores' ? '[VENDEDOR]' : '[PROMOTOR]';
        const periodName = `${tag} ROTA AJUSTADA OTIMIZADA - ${new Date().toLocaleDateString()}`;

        if (!confirm(`Deseja salvar estas alterações como um novo Roteiro Previsto?\nNome: ${periodName}`)) return;

        setSaving(true);
        try {
            // Agrupar visitas por colaborador para o payload
            const groups = new Map<number, VisitaPrevista[]>();
            adjustedRoutes.forEach(v => {
                if(!groups.has(v.Cod_Vend)) groups.set(v.Cod_Vend, []);
                groups.get(v.Cod_Vend)?.push(v);
            });

            const payload = {
                Periodo: periodName,
                TotalKM: kpis.adjusted.totalKm,
                UsuarioSimulacao: authUser?.Nome || 'Operador',
                Itens: Array.from(groups.entries()).map(([vendedorId, visits]) => {
                    const colab = colaboradores.find(c => c.CodigoSetor === vendedorId);
                    
                    // Separar visitas por dia
                    const dailyMap = new Map<string, VisitaPrevista[]>();
                    visits.forEach(v => {
                        if (!dailyMap.has(v.Dia_Semana)) dailyMap.set(v.Dia_Semana, []);
                        dailyMap.get(v.Dia_Semana)?.push(v);
                    });

                    return {
                        ID_Pulsus: colab?.ID_Pulsus || vendedorId,
                        Nome: colab?.Nome || visits[0].Nome_Vendedor,
                        Grupo: colab?.Grupo || 'Equipe',
                        TotalKM: Math.round(visits.length * 15), // KM estimado
                        Dias: Array.from(dailyMap.entries()).map(([day, pts]) => {
                            // Cálculo de KM diário aproximado
                            let km = 0;
                            let lat = colab?.LatitudeBase || pts[0].Lat;
                            let lng = colab?.LongitudeBase || pts[0].Long;
                            pts.forEach(p => {
                                km += calcDist(lat, lng, p.Lat, p.Long);
                                lat = p.Lat; lng = p.Long;
                            });
                            if (colab?.LatitudeBase && colab?.LongitudeBase) km += calcDist(lat, lng, colab.LatitudeBase, colab.LongitudeBase);
                            
                            return {
                                Data: new Date().toISOString().split('T')[0], // Vinculado ao dia
                                KM: Math.round(km * 1.15),
                                KMEstimado: Math.round(km * 1.1)
                            };
                        })
                    };
                })
            };

            await saveRotaPrevista(payload);
            alert("Ajuste de Rota salvo com sucesso na base de Simulações do Fuel360!");
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col space-y-4 pb-10">
            {showMappingModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white">Vincular Colaboradores</h3>
                                <p className="text-sm text-slate-500 mt-1">Alguns nomes do Excel não foram encontrados no sistema.</p>
                            </div>
                            <button onClick={() => setShowMappingModal(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="w-6 h-6 flex items-center justify-center font-bold text-xl">&times;</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {unmatchedNames.map(nome => (
                                <div key={nome} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex-1 font-bold text-slate-700 dark:text-slate-200">{nome}</div>
                                    <div className="flex-1">
                                        <select 
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNameMappings(prev => ({...prev, [nome]: Number(val)}));
                                            }}
                                            value={nameMappings[nome] || ''}
                                        >
                                            <option value="">Ignorar este colaborador</option>
                                            {teamColaboradores.map(c => (
                                                <option key={c.CodigoSetor} value={c.CodigoSetor}>{c.Nome} ({c.Grupo})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-end gap-3">
                            <button onClick={() => setShowMappingModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                            <button 
                                onClick={() => {
                                    setShowMappingModal(false);
                                    setLoading(true);
                                    processRoteiroParsedData(pendingParsedData, nameMappings);
                                }} 
                                className="px-6 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all"
                            >
                                Confirmar Vínculos
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* TOPO: SELEÇÃO DE EQUIPE */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                <div className="flex flex-col space-y-2">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center">
                        <CogIcon className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400 animate-spin-slow"/> Ajuste e Otimização Avançada de Rotas
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Simule ajustes, reatribua colaboradores, equilibre cargas de trabalho e salve as rotas otimizadas na base oficial.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setTeamType('vendedores')}
                            className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${teamType === 'vendedores' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <LocationMarkerIcon className="w-4 h-4 mr-1.5"/> Vendas
                        </button>
                        <button
                            onClick={() => setTeamType('promotores')}
                            className={`flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${teamType === 'promotores' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <UsersIcon className="w-4 h-4 mr-1.5"/> Promotores
                        </button>
                    </div>

                    {teamType === 'vendedores' ? (
                        <button
                            onClick={handleLoadCurrentRoutes}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center h-[36px]"
                            title="Carregar carteira de clientes integral de cada vendedor"
                        >
                            {loading ? <SpinnerIcon className="w-4 h-4 animate-spin mr-1.5"/> : <RefreshIcon className="w-4 h-4 mr-1.5"/>}
                            Carregar Rota Atual
                        </button>
                    ) : (
                        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center transition shadow-md h-[36px]">
                            <UploadIcon className="w-4 h-4 mr-1.5"/> Carregar Planilha (.xlsx)
                            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} disabled={loading} className="hidden" />
                        </label>
                    )}
                </div>
            </div>

            {/* SELETOR DE ESCOPO DE ROTEIRIZAÇÃO (GERAL / EQUIPE SUPERVISÃO / VENDEDOR INDIVIDUAL) */}
            {adjustedRoutes.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center mr-1">
                            <UsersIcon className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400"/> Escopo do Ajuste:
                        </span>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => {
                                    setScopeMode('geral');
                                    setSelectedPromoter('ALL');
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scopeMode === 'geral' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                🌐 Visão Geral ({Array.from(new Set(adjustedRoutes.map(r => r.Cod_Vend))).length})
                            </button>
                            <button
                                onClick={() => {
                                    setScopeMode('equipe');
                                    setSelectedPromoter('ALL');
                                    if (!selectedSupervisor && supervisors.length > 0) {
                                        setSelectedSupervisor(supervisors[0].id);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scopeMode === 'equipe' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                👥 Por Equipe (Supervisão)
                            </button>
                            <button
                                onClick={() => {
                                    setScopeMode('vendedor');
                                    setSelectedPromoter('ALL');
                                    if (!selectedSeller && availableSellers.length > 0) {
                                        setSelectedSeller(String(availableSellers[0].id));
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${scopeMode === 'vendedor' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                👤 Por Vendedor
                            </button>
                        </div>
                    </div>

                    {/* SELETORES DINÂMICOS CONFORME O ESCOPO */}
                    <div className="flex flex-wrap items-center gap-2">
                        {scopeMode === 'equipe' && (
                            <div className="flex items-center space-x-1.5">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Supervisor:</label>
                                <select
                                    value={selectedSupervisor}
                                    onChange={(e) => {
                                        setSelectedSupervisor(e.target.value);
                                        setSelectedPromoter('ALL');
                                    }}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Selecione uma Supervisão...</option>
                                    {supervisors.map(sup => (
                                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {scopeMode === 'vendedor' && (
                            <div className="flex items-center space-x-1.5">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Vendedor:</label>
                                <select
                                    value={selectedSeller}
                                    onChange={(e) => {
                                        setSelectedSeller(e.target.value);
                                        setSelectedPromoter('ALL');
                                    }}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Selecione um Vendedor...</option>
                                    {availableSellers.map(seller => (
                                        <option key={seller.id} value={String(seller.id)}>{seller.name} ({seller.id})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/60 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                            {Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend))).length} Colaborador(es) • {scopedAdjustedRoutes.length} PDVs em foco
                        </div>
                    </div>
                </div>
            )}

            {/* PAINEL CENTRAL: KPIS E COMPARATIVO */}
            {adjustedRoutes.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* KPI 1: Quilometragem */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Distância Total Estimada</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{kpis.adjusted.totalKm} KM</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{kpis.original.totalKm} KM</span>
                            </div>
                        </div>
                        {kpis.kmSaved > 0 && (
                            <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                <CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> Economia de {kpis.kmSaved} KM ({kpis.percentSaved}%)
                            </div>
                        )}
                    </div>

                    {/* KPI 2: Média KM por Colaborador */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Média de Deslocamento</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{kpis.adjusted.avgKmPerSeller} KM</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">/ colab</span>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Distribuído entre {kpis.adjusted.sellerCount} colaboradores ativos.</p>
                    </div>

                    {/* KPI 3: Carga de Clientes (Equilíbrio) */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Pico de Clientes / Dia</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{kpis.adjusted.maxClientsOnSingleDay} PDVs</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">Máx Config: {optMaxClients}</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-1">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                                <div 
                                    className="bg-indigo-600 h-1.5 rounded-full" 
                                    style={{ width: `${Math.min(100, (kpis.adjusted.maxClientsOnSingleDay / optMaxClients) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* KPI 4: Alertas de Distância */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Colaboradores com Alta KM</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className={`text-xl font-black ${kpis.adjusted.exceededKmCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {kpis.adjusted.exceededKmCount} / {kpis.adjusted.sellerCount}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">teto {optMaxKm} KM</span>
                            </div>
                        </div>
                        {kpis.adjusted.exceededKmCount > 0 ? (
                            <div className="mt-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                <ExclamationIcon className="w-3.5 h-3.5 mr-1"/> Necessita Ajuste Manual
                            </div>
                        ) : (
                            <div className="mt-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                <CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> Rotas dentro do limite
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ABAIXO: MAPA E SIDEBAR DE AJUSTES */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
                {/* COLUNA ESQUERDA: PARÂMETROS E LISTA DE AJUSTES */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col space-y-4 overflow-y-auto custom-scrollbar shadow-sm transition-colors">
                    {/* PARÂMETROS DO ROTEIRIZADOR */}
                    <div className="space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                            <CogIcon className="w-4 h-4 mr-1 text-slate-500"/> Parâmetros do Otimizador
                        </h4>
                        
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-2.5 text-[10px] text-indigo-700 dark:text-indigo-300 space-y-1">
                            <div className="font-bold flex items-center">
                                <CheckCircleIcon className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400 shrink-0"/> Carteira Blindada por Vendedor
                            </div>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                Clientes pertencem exclusivamente ao vendedor (zero transferência). Periodicidades semanais e quinzenais preservadas.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Clientes Máximo / Dia</label>
                            <input 
                                type="number" 
                                value={optMaxClients} 
                                onChange={(e) => setOptMaxClients(Number(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold outline-none text-slate-800 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">KM Máximo Rota / Dia</label>
                            <input 
                                type="number" 
                                value={optMaxKm} 
                                onChange={(e) => setOptMaxKm(Number(e.target.value))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-bold outline-none text-slate-800 dark:text-white"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">Sábado Meio-Período</span>
                            <input 
                                type="checkbox" 
                                checked={optSatHalfPeriod} 
                                onChange={(e) => setOptSatHalfPeriod(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase block">Equilibrar Quinzenas</span>
                                <span className="text-[8px] text-slate-400 block">Ajusta 1 3 e 2 4 para equalizar carga</span>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={optBalanceWorkload} 
                                onChange={(e) => setOptBalanceWorkload(e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="pt-1">
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Dias Ativos</label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {WEEKDAYS.map(day => (
                                    <label key={day} className="flex items-center space-x-1.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={optDays.includes(day)}
                                            onChange={(e) => {
                                                if(e.target.checked) setOptDays([...optDays, day]);
                                                else setOptDays(optDays.filter(d => d !== day));
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>{day.split('-')[0]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleOptimizeSimulate}
                            disabled={loading || adjustedRoutes.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-xl text-xs flex items-center justify-center shadow-sm disabled:opacity-50"
                        >
                            <RefreshIcon className="w-4 h-4 mr-1"/> Otimizar Rotas
                        </button>
                    </div>

                    {/* LISTA DE COLABORADORES PARA SELEÇÃO NO MAPA COM ALERTA DE DESBALANCEAMENTO QUINZENAL */}
                    {scopedAdjustedRoutes.length > 0 && (
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                                    <UserGroupIcon className="w-4 h-4 mr-1 text-slate-500"/> Rotas por Colaborador
                                </h4>
                                {imbalancedSellersCount > 0 && (
                                    <span 
                                        className="text-[9px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800 flex items-center shadow-xs"
                                        title={`${imbalancedSellersCount} colaborador(es) com desbalanceamento quinzenal superior a 30%`}
                                    >
                                        ⚠️ {imbalancedSellersCount} com desbalanço
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                <div 
                                    className={`p-2 rounded-xl border text-xs font-bold cursor-pointer transition ${selectedPromoter === 'ALL' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-200'}`}
                                    onClick={() => setSelectedPromoter('ALL')}
                                >
                                    Todos no Escopo ({Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend))).length})
                                </div>
                                {Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend))).map(sellerId => {
                                    const colab = colaboradores.find(c => c.CodigoSetor === sellerId);
                                    const count = scopedAdjustedRoutes.filter(v => v.Cod_Vend === sellerId).length;
                                    const color = promoterColorMap.get(String(sellerId)) || '#64748b';
                                    const qStats = getSellerQuinzenaStats(sellerId, scopedAdjustedRoutes);

                                    return (
                                        <div 
                                            key={sellerId}
                                            className={`p-2 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center justify-between gap-1.5 ${selectedPromoter === String(sellerId) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : (qStats.isImbalanced ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 hover:border-amber-400' : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-200')}`}
                                            onClick={() => setSelectedPromoter(String(sellerId))}
                                        >
                                            <div className="flex items-center space-x-2 truncate min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                                                <span className="truncate" title={colab?.Nome || `Colaborador ${sellerId}`}>{colab?.Nome || `Colaborador ${sellerId}`}</span>
                                            </div>

                                            <div className="flex items-center space-x-1 shrink-0">
                                                {qStats.isImbalanced && (
                                                    <span 
                                                        className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded text-[9px] font-black flex items-center shadow-xs"
                                                        title={`⚠️ Desbalanceamento Quinzenal: ${qStats.variationPct}% de variação\n• Semanas 1 e 3: ${qStats.v13} atendimentos\n• Semanas 2 e 4: ${qStats.v24} atendimentos\nDica: Alterne clientes quinzenais na Grade de Ajuste Fino para equilibrar.`}
                                                    >
                                                        ⚠️ {qStats.variationPct}%
                                                    </span>
                                                )}
                                                <span 
                                                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px]"
                                                    title={`Total: ${count} PDVs\n• Semanas 1 e 3: ${qStats.v13}\n• Semanas 2 e 4: ${qStats.v24}`}
                                                >
                                                    {count} PDVs
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUNA DIREITA: MAPA E TABELA DE CLIENTES */}
                <div className="lg:col-span-3 flex flex-col space-y-4 min-h-0">
                    {/* MAP CONTAINER */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm h-96 relative flex flex-col transition-colors">
                        <div className="absolute top-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md z-[1000] text-xs font-bold text-slate-800 dark:text-white flex items-center">
                            <GlobeIcon className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400 animate-pulse"/> Visão Espacial do Ajuste
                        </div>

                        {/* CONTROLES FLUTUANTES DO MAPA: ALTERNADOR RÁPIDO DE QUINZENA E HEATMAP */}
                        {scopedAdjustedRoutes.length > 0 && (
                            <div className="absolute top-3 right-3 z-[1000] flex flex-wrap items-center gap-2">
                                {/* Alternador Rápido de Traçado por Quinzena */}
                                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center gap-0.5 text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedQuinzenaFilter('ALL')}
                                        className={`px-2.5 py-1 rounded-lg transition-all duration-200 ${
                                            selectedQuinzenaFilter === 'ALL'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                        title="Visualizar traçado e clientes de todas as semanas"
                                    >
                                        Todas
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedQuinzenaFilter('1_3')}
                                        className={`px-2.5 py-1 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                                            selectedQuinzenaFilter === '1_3'
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
                                        }`}
                                        title="Visualizar apenas traçados e clientes da Semana 1 e 3"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-amber-300 ring-1 ring-amber-400/50 shrink-0" />
                                        <span>Sem 1 e 3</span>
                                        {quinzenaTotals.total13 > 0 && (
                                            <span className={`text-[10px] px-1 py-0.2 rounded-full ${selectedQuinzenaFilter === '1_3' ? 'bg-amber-600 text-amber-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {quinzenaTotals.total13}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedQuinzenaFilter('2_4')}
                                        className={`px-2.5 py-1 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                                            selectedQuinzenaFilter === '2_4'
                                                ? 'bg-fuchsia-600 text-white shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-fuchsia-600'
                                        }`}
                                        title="Visualizar apenas traçados e clientes da Semana 2 e 4"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-fuchsia-300 ring-1 ring-fuchsia-400/50 shrink-0" />
                                        <span>Sem 2 e 4</span>
                                        {quinzenaTotals.total24 > 0 && (
                                            <span className={`text-[10px] px-1 py-0.2 rounded-full ${selectedQuinzenaFilter === '2_4' ? 'bg-fuchsia-700 text-fuchsia-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {quinzenaTotals.total24}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* Botão Heatmap de Concentração de Visitas */}
                                <button
                                    type="button"
                                    onClick={() => setShowHeatmap(prev => !prev)}
                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md border transition-all duration-200 ${
                                        showHeatmap 
                                            ? 'bg-gradient-to-r from-orange-500 to-rose-600 text-white border-orange-400 shadow-orange-500/30 ring-2 ring-orange-400/40' 
                                            : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-orange-400 hover:text-orange-600'
                                    }`}
                                    title={showHeatmap ? "Ocultar Mapa de Calor de Concentração" : "Exibir Mapa de Calor de Concentração de Visitas"}
                                >
                                    <span className="text-sm leading-none">🔥</span>
                                    <span>{showHeatmap ? 'Calor Ativo' : 'Mapa de Calor'}</span>
                                </button>
                            </div>
                        )}
                        {scopedAdjustedRoutes.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500">
                                <LocationMarkerIcon className="w-12 h-12 mb-2 text-slate-300"/>
                                <p className="text-sm font-semibold">Carregue ou importe um roteiro para visualizar o mapa</p>
                            </div>
                        ) : (
                            <MapContainer 
                                center={[-23.5505, -46.6333]} 
                                zoom={12} 
                                style={{ width: '100%', height: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />

                                {/* Camada de Mapa de Calor (Heatmap de Concentração de Visitas) */}
                                {showHeatmap && <HeatmapLayer points={heatmapPoints} />}
                                {/* Casas / Bases dos Colaboradores com Destaque Especial */}
                                {Array.from(new Set(scopedAdjustedRoutes.map(v => v.Cod_Vend))).map(vId => {
                                    const colab = colaboradores.find(c => c.CodigoSetor === vId);
                                    if(colab && colab.LatitudeBase && colab.LongitudeBase) {
                                        const pColor = promoterColorMap.get(String(vId)) || '#ef4444';
                                        return (
                                            <Marker 
                                                key={`base-${vId}`} 
                                                position={[colab.LatitudeBase, colab.LongitudeBase]} 
                                                icon={createHomeIcon(pColor)}
                                                zIndexOffset={1000}
                                            >
                                                <Popup>
                                                    <div className="text-xs p-1 space-y-1 font-sans">
                                                        <div className="flex items-center space-x-1.5 text-red-600 dark:text-red-400 font-black">
                                                            <span>🏠</span>
                                                            <span className="uppercase tracking-wider text-[10px]">Base / Residência</span>
                                                        </div>
                                                        <p className="text-slate-900 dark:text-slate-100 font-bold text-sm">{colab.Nome}</p>
                                                        {colab.EnderecoBase && (
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{colab.EnderecoBase}</p>
                                                        )}
                                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">Ponto de partida e retorno diário do colaborador</p>
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        );
                                    }
                                    return null;
                                })}

                                {/* Polilinhas das rotas originais (Tracejado claro se houver comparação) */}
                                {originalPolylines.map((line, idx) => (
                                    <Polyline 
                                        key={`orig-poly-${line.id || idx}`} 
                                        positions={line.points} 
                                        color={line.color} 
                                        weight={showHeatmap ? 2 : 3} 
                                        dashArray="5, 10" 
                                        opacity={showHeatmap ? 0.15 : 0.3} 
                                        pathOptions={{
                                            className: 'transition-all duration-500 ease-in-out'
                                        }}
                                    />
                                ))}

                                {/* Polilinhas das rotas otimizadas com transição visual animada */}
                                {adjustedPolylines.map((line, idx) => (
                                    <Polyline 
                                        key={`adj-poly-${line.id || idx}`} 
                                        positions={line.points} 
                                        color={line.color} 
                                        weight={showHeatmap ? 2.5 : 5} 
                                        opacity={showHeatmap ? 0.35 : 0.85} 
                                        pathOptions={{
                                            className: 'transition-all duration-500 ease-in-out'
                                        }}
                                    />
                                ))}

                                {/* Clientes Marcados (com distinção cromática por dia da semana e quinzena) */}
                                {filteredRoutes.filter(v => v.Lat && v.Long).map((v, idx) => {
                                    const pType = parsePeriodicidade(v.Periodicidade).tipo;
                                    const dayCfg = DAY_COLORS[v.Dia_Semana] || { hex: '#4f46e5', label: 'DIA' };
                                    const dayColor = dayCfg.hex;
                                    const sellerColor = promoterColorMap.get(String(v.Cod_Vend)) || '#4f46e5';
                                    const mainColor = isSingleSellerView ? dayColor : sellerColor;

                                    // Distinção visual no mapa:
                                    // Semanal: sólido com borda branca clássica (radius: 7, weight: 2)
                                    // Quinzena 1 e 3: anel com borda amarela/dourada espessa (radius: 8.5, weight: 3.5, color: '#f59e0b')
                                    // Quinzena 2 e 4: borda magenta/fúcsia tracejada (radius: 8.5, weight: 3.5, color: '#ec4899', dashArray: '3, 3')
                                    let borderColor = '#ffffff';
                                    let borderWidth = 2;
                                    let radius = 7;
                                    let dashArray: string | undefined = undefined;

                                    if (isSingleSellerView) {
                                        if (pType === 'QUINZENAL_1_3') {
                                            borderColor = '#f59e0b';
                                            borderWidth = 3.5;
                                            radius = 8.5;
                                        } else if (pType === 'QUINZENAL_2_4') {
                                            borderColor = '#ec4899';
                                            borderWidth = 3.5;
                                            radius = 8.5;
                                            dashArray = '3, 3';
                                        }
                                    }

                                    const isPdvHighlighted = v.Cod_Cliente === highlightedClientCode;

                                    return (
                                        <CircleMarker
                                            key={`marker-${v.Cod_Cliente}-${idx}`}
                                            center={[v.Lat, v.Long]}
                                            radius={showHeatmap ? Math.max(4, radius - 2) : (isPdvHighlighted ? radius + 3.5 : radius)}
                                            pathOptions={{ 
                                                fillColor: isPdvHighlighted ? '#4f46e5' : mainColor, 
                                                color: isPdvHighlighted ? '#ffffff' : borderColor, 
                                                fillOpacity: showHeatmap ? 0.45 : (isPdvHighlighted ? 1 : 0.92), 
                                                weight: isPdvHighlighted ? 4 : (showHeatmap ? 1.5 : borderWidth),
                                                dashArray: isPdvHighlighted ? undefined : dashArray,
                                                className: 'transition-all duration-300 ease-in-out cursor-pointer'
                                            }}
                                            eventHandlers={{
                                                click: () => {
                                                    handleSelectPdvFromMap(v.Cod_Cliente);
                                                }
                                            }}
                                        >
                                            <Popup>
                                                <div className="text-xs space-y-2 p-1 font-sans">
                                                    <div>
                                                        <div className="flex items-center justify-between gap-1 mb-1">
                                                            <span 
                                                                className="px-1.5 py-0.5 rounded text-[9px] font-black text-white"
                                                                style={{ backgroundColor: dayColor }}
                                                            >
                                                                {v.Dia_Semana}
                                                            </span>
                                                            {pType === 'SEMANAL' ? (
                                                                <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                                    Semanal
                                                                </span>
                                                            ) : pType === 'QUINZENAL_1_3' ? (
                                                                <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                                                                    Quinzena 1 e 3
                                                                </span>
                                                            ) : (
                                                                <span className="bg-fuchsia-100 dark:bg-fuchsia-900/60 text-fuchsia-800 dark:text-fuchsia-300 text-[9px] font-bold px-1.5 py-0.5 rounded border border-fuchsia-300">
                                                                    Quinzena 2 e 4
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="font-black text-slate-800 dark:text-slate-100">{v.Cod_Cliente} - {v.Razao_Social}</h4>
                                                        <p className="text-[10px] text-slate-400">{v.Endereco}</p>
                                                    </div>
                                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 space-y-2">
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Colaborador Atribuído</label>
                                                            {teamType === 'vendedores' ? (
                                                                <div className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                                                    <span className="truncate">{v.Nome_Vendedor}</span>
                                                                    <span className="text-[8px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold px-1 rounded ml-1 shrink-0">Carteira Fixa</span>
                                                                </div>
                                                            ) : (
                                                                <select
                                                                    value={v.Cod_Vend}
                                                                    onChange={(e) => handleManualReassign(v.Cod_Cliente, Number(e.target.value), v.Dia_Semana, v.Periodicidade)}
                                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                                                >
                                                                    {teamColaboradores.map(col => (
                                                                        <option key={col.ID_Colaborador} value={col.CodigoSetor}>{col.Nome}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <div className="flex-1">
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Dia de Visita</label>
                                                                <select
                                                                    value={v.Dia_Semana}
                                                                    onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, e.target.value, v.Periodicidade)}
                                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                                                >
                                                                    {WEEKDAYS.map(day => (
                                                                        <option key={day} value={day}>{day}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Frequência</label>
                                                                {parsePeriodicidade(v.Periodicidade).tipo === 'SEMANAL' ? (
                                                                    <div className="w-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded p-1 text-[10px] font-bold text-center">
                                                                        Semanal
                                                                    </div>
                                                                ) : (
                                                                    <select
                                                                        value={(v.Periodicidade && (v.Periodicidade.includes('2 4') || v.Periodicidade.includes('24') || v.Periodicidade.includes('2, 4'))) ? '2 4' : '1 3'}
                                                                        onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, v.Dia_Semana, e.target.value === '2 4' ? '2 4' : '1 3')}
                                                                        className="w-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded p-1 text-[10px] font-bold outline-none"
                                                                    >
                                                                        <option value="1 3">Quinzena 1 3</option>
                                                                        <option value="2 4">Quinzena 2 4</option>
                                                                    </select>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => handleExcludeVisit(v.Cod_Cliente)}
                                                                className="self-end bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded p-1"
                                                                title="Excluir Visita"
                                                            >
                                                                <TrashIcon className="w-4 h-4"/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Popup>
                                        </CircleMarker>
                                    );
                                })}
                            </MapContainer>
                        )}

                        {/* Legenda Explicativa de Rotas e Heatmap no Mapa */}
                        {scopedAdjustedRoutes.length > 0 && (isSingleSellerView || showHeatmap) && (
                            <div className="absolute bottom-2 right-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-[1000] text-[9px] space-y-1 max-w-[320px]">
                                {isSingleSellerView && (
                                    <>
                                        <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200/80 dark:border-slate-800 pb-1">
                                            <span className="flex items-center gap-1">
                                                <GlobeIcon className="w-3 h-3 text-indigo-600"/> Legenda do Roteiro
                                            </span>
                                            <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">Cores & Ciclos</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {WEEKDAYS.map(day => {
                                                const cfg = DAY_COLORS[day];
                                                if (!cfg) return null;
                                                return (
                                                    <span key={day} className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.hex }}/>
                                                        <span>{cfg.label}</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-slate-600 dark:text-slate-400 font-medium text-[8.5px]">
                                            <span className="flex items-center space-x-1">
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white shrink-0"/>
                                                <span>Semanal</span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-amber-500 shrink-0"/>
                                                <span>Quinz. 1/3</span>
                                            </span>
                                            <span className="flex items-center space-x-1">
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-fuchsia-500 border-dashed shrink-0"/>
                                                <span>Quinz. 2/4</span>
                                            </span>
                                            <span className="flex items-center space-x-1 text-red-600 font-bold">
                                                <span>🏠</span>
                                                <span>Base</span>
                                            </span>
                                        </div>
                                    </>
                                )}
                                {showHeatmap && (
                                    <div className={`flex items-center justify-between text-[8px] text-slate-600 dark:text-slate-300 font-bold ${isSingleSellerView ? 'pt-1 border-t border-slate-200/80 dark:border-slate-800' : ''}`}>
                                        <span className="flex items-center gap-1">🔥 Menor densidade</span>
                                        <div className="w-20 h-2 rounded-full bg-gradient-to-r from-blue-500 via-yellow-400 to-red-600 mx-2 shadow-xs ring-1 ring-slate-300 dark:ring-slate-700" />
                                        <span>Alta densidade</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* TABELA DE AJUSTE MANUAL E EDICAO DE ROTAS */}
                    {adjustedRoutes.length > 0 && (
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-0 shadow-sm p-4 transition-colors">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 mb-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center shrink-0">
                                        <ClipboardListIcon className="w-4 h-4 mr-1.5 text-indigo-600"/> Grade de Ajuste Fino
                                    </h3>

                                    {/* RESUMO E FILTROS INTERATIVOS DE VISITAS POR DIA DA SEMANA E QUINZENA */}
                                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                        {/* FILTRO DE DIAS DA SEMANA (CLICÁVEIS - SELEÇÃO MÚLTIPLA) */}
                                        <div className="flex flex-wrap items-center gap-1">
                                            {WEEKDAYS.map(day => {
                                                const shortName = day.split('-')[0].slice(0, 3);
                                                const count = visitsByDay[day] || 0;
                                                const isSelected = selectedDaysFilter.includes(day);
                                                const hasAnySelected = selectedDaysFilter.length > 0;
                                                const dayCfg = DAY_COLORS[day] || { hex: '#4f46e5', label: shortName, bg: 'bg-indigo-600' };

                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => handleToggleDayFilter(day)}
                                                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer border ${
                                                            isSelected 
                                                                ? `${dayCfg.bg} text-white border-transparent shadow-sm ring-2 ring-offset-1 ring-slate-400 font-black` 
                                                                : hasAnySelected
                                                                    ? 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60 hover:opacity-100 hover:text-slate-700 dark:hover:text-slate-200'
                                                                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                                                        }`}
                                                        title={`Clique para filtrar ${day}. Total: ${count} atendimentos`}
                                                    >
                                                        <span className="uppercase font-semibold">{shortName}:</span>
                                                        <span className={isSelected ? 'text-white font-black' : 'text-indigo-600 dark:text-indigo-400 font-black'}>
                                                            {count}
                                                        </span>
                                                    </button>
                                                );
                                            })}

                                            {selectedDaysFilter.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={handleClearDayFilter}
                                                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                                                    title="Limpar filtro de dias e exibir a semana completa"
                                                >
                                                    Todos
                                                </button>
                                            )}
                                        </div>

                                        {/* DIVISOR */}
                                        <div className="h-4 w-px bg-slate-300 dark:bg-slate-600 mx-0.5 hidden sm:block"/>

                                        {/* TOTALIZADORES E FILTROS POR QUINZENA (SEMANAS 1/3 E 2/4) */}
                                        <div className="flex flex-wrap items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedQuinzenaFilter(prev => prev === '1_3' ? 'ALL' : '1_3')}
                                                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95 cursor-pointer border ${
                                                    selectedQuinzenaFilter === '1_3'
                                                        ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400 ring-offset-1 font-black shadow-sm'
                                                        : selectedQuinzenaFilter !== 'ALL'
                                                            ? 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40 opacity-50 hover:opacity-100'
                                                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 font-bold'
                                                }`}
                                                title={`Semanas 1 e 3: ${quinzenaTotals.total13} atendimentos (${quinzenaTotals.semanalCount} Semanais + ${quinzenaTotals.quinzenal13Count} Quinzenais 1/3). Clique para filtrar.`}
                                            >
                                                <span className="font-semibold">Sem 1/3:</span>
                                                <span className="font-black">{quinzenaTotals.total13}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setSelectedQuinzenaFilter(prev => prev === '2_4' ? 'ALL' : '2_4')}
                                                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95 cursor-pointer border ${
                                                    selectedQuinzenaFilter === '2_4'
                                                        ? 'bg-fuchsia-600 text-white border-fuchsia-700 ring-2 ring-fuchsia-400 ring-offset-1 font-black shadow-sm'
                                                        : selectedQuinzenaFilter !== 'ALL'
                                                            ? 'bg-fuchsia-50/50 dark:bg-fuchsia-950/20 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-200/50 dark:border-fuchsia-800/40 opacity-50 hover:opacity-100'
                                                            : 'bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/60 hover:bg-fuchsia-100 font-bold'
                                                }`}
                                                title={`Semanas 2 e 4: ${quinzenaTotals.total24} atendimentos (${quinzenaTotals.semanalCount} Semanais + ${quinzenaTotals.quinzenal24Count} Quinzenais 2/4). Clique para filtrar.`}
                                            >
                                                <span className="font-semibold">Sem 2/4:</span>
                                                <span className="font-black">{quinzenaTotals.total24}</span>
                                            </button>

                                            {quinzenaTotals.isImbalanced && (
                                                <span 
                                                    className="text-[9px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5"
                                                    title={`Variação de ${quinzenaTotals.variationPct}% entre as quinzenas (Sem 1/3: ${quinzenaTotals.total13} vs Sem 2/4: ${quinzenaTotals.total24}).`}
                                                >
                                                    ⚠️ {quinzenaTotals.variationPct}% var.
                                                </span>
                                            )}

                                            {selectedQuinzenaFilter !== 'ALL' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedQuinzenaFilter('ALL')}
                                                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                                                    title="Limpar filtro de quinzena e exibir todas as semanas"
                                                >
                                                    Todas
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0">
                                    <button
                                        onClick={() => setShowCompareModal(true)}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center border border-indigo-200 dark:border-indigo-800 shadow-xs transition h-[32px]"
                                        title="Comparar a rota original com a rota ajustada antes de salvar"
                                    >
                                        <PresentationChartLineIcon className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400"/>
                                        Comparativo Antes x Depois
                                        {routeComparisonDiff.totalChanged > 0 && (
                                            <span className="ml-1.5 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                                                {routeComparisonDiff.totalChanged}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleExportExcel}
                                        className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center shadow transition h-[32px]"
                                        title="Exportar planilha Excel estruturada com abas consolidadas e por equipe/colaborador conforme o escopo selecionado"
                                    >
                                        <UploadIcon className="w-4 h-4 mr-1 rotate-180"/> Exportar Excel (em Abas)
                                    </button>
                                    <button
                                        onClick={handleSaveDatabase}
                                        disabled={saving}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center shadow transition h-[32px]"
                                    >
                                        {saving ? <SpinnerIcon className="w-4 h-4 animate-spin mr-1"/> : <CheckCircleIcon className="w-4 h-4 mr-1"/>}
                                        Salvar Simulação
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-xl">
                                <table className="w-full text-left text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 uppercase text-[9px] sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th 
                                                onClick={() => handleSort('Cod_Cliente')}
                                                className="p-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                                                title="Clique para ordenar por Código"
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Código/PDV</span>
                                                    <span className={sortField === 'Cod_Cliente' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                                                        {sortField === 'Cod_Cliente' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('Razao_Social')}
                                                className="p-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                                                title="Clique para ordenar por Razão Social"
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Razão Social</span>
                                                    <span className={sortField === 'Razao_Social' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                                                        {sortField === 'Razao_Social' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('Endereco')}
                                                className="p-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                                                title="Clique para ordenar por Endereço"
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Endereço</span>
                                                    <span className={sortField === 'Endereco' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                                                        {sortField === 'Endereco' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('Nome_Vendedor')}
                                                className="p-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                                                title="Clique para ordenar por Colaborador"
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Colaborador Atual</span>
                                                    <span className={sortField === 'Nome_Vendedor' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                                                        {sortField === 'Nome_Vendedor' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('Dia_Semana')}
                                                className="p-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                                                title="Clique para ordenar por Dia de Visita"
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Dia de Visita</span>
                                                    <span className={sortField === 'Dia_Semana' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                                                        {sortField === 'Dia_Semana' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th 
                                                onClick={() => handleSort('Periodicidade')}
                                                className="p-3 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                                                title="Clique para ordenar por Periodicidade"
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Periodicidade</span>
                                                    <span className={sortField === 'Periodicidade' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                                                        {sortField === 'Periodicidade' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="p-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                                        {sortedRoutes.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500">
                                                    <p className="font-bold text-xs">Nenhum PDV encontrado para os filtros de dia da semana ou quinzena selecionados.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedDaysFilter([]); setSelectedQuinzenaFilter('ALL'); }}
                                                        className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold underline cursor-pointer"
                                                    >
                                                        Limpar todos os filtros de dias e quinzenas
                                                    </button>
                                                </td>
                                            </tr>
                                        ) : (
                                            sortedRoutes
                                                .slice(0, visibleRoutesLimit) // Limita renderização mantendo expansão para Scroll Spy
                                                .map((v, i) => {
                                                    const dayCfg = DAY_COLORS[v.Dia_Semana] || { hex: '#4f46e5', label: 'DIA', bg: 'bg-indigo-600' };
                                                    const isHighlighted = v.Cod_Cliente === highlightedClientCode;
                                                    return (
                                                        <tr 
                                                            key={`${v.Cod_Cliente}-${i}`} 
                                                            id={`row-pdv-${v.Cod_Cliente}`}
                                                            className={`transition-all duration-300 ${
                                                                isHighlighted 
                                                                    ? 'bg-indigo-100/90 dark:bg-indigo-950/90 ring-2 ring-indigo-500 ring-inset shadow-md font-black' 
                                                                    : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
                                                            }`}
                                                        >
                                                            <td className="p-3 text-slate-900 dark:text-white font-mono">
                                                                <div className="flex items-center gap-1.5">
                                                                    {isHighlighted && (
                                                                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping shrink-0" title="PDV em foco pelo mapa" />
                                                                    )}
                                                                    <span>{v.Cod_Cliente}</span>
                                                                    {isHighlighted && (
                                                                        <span className="text-[8px] bg-indigo-600 text-white font-black px-1.5 py-0.2 rounded-full uppercase tracking-tighter shrink-0 animate-pulse">
                                                                            Foco
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 truncate max-w-[180px] text-slate-800 dark:text-slate-200" title={v.Razao_Social}>{v.Razao_Social}</td>
                                                            <td className="p-3 text-slate-400 dark:text-slate-500 truncate max-w-[220px]" title={v.Endereco}>{v.Endereco}</td>
                                                            <td className="p-3">
                                                                {teamType === 'vendedores' ? (
                                                                    <div className="flex items-center space-x-1.5">
                                                                        <span className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-[130px]" title={v.Nome_Vendedor}>{v.Nome_Vendedor}</span>
                                                                        <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-1 py-0.5 rounded shrink-0">Carteira</span>
                                                                    </div>
                                                                ) : (
                                                                    <select
                                                                        value={v.Cod_Vend}
                                                                        onChange={(e) => handleManualReassign(v.Cod_Cliente, Number(e.target.value), v.Dia_Semana, v.Periodicidade)}
                                                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
                                                                    >
                                                                        {teamColaboradores.map(col => (
                                                                            <option key={col.ID_Colaborador} value={col.CodigoSetor}>{col.Nome}</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center space-x-1.5">
                                                                    <span 
                                                                        className="w-2 h-2 rounded-full shrink-0" 
                                                                        style={{ backgroundColor: dayCfg.hex }}
                                                                        title={v.Dia_Semana}
                                                                    />
                                                                    <select
                                                                        value={v.Dia_Semana}
                                                                        onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, e.target.value, v.Periodicidade)}
                                                                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
                                                                    >
                                                                        {WEEKDAYS.map(day => (
                                                                            <option key={day} value={day}>{day}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </td>
                                                            <td className="p-3">
                                                                {parsePeriodicidade(v.Periodicidade).tipo === 'SEMANAL' ? (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                                                        Semanal
                                                                    </span>
                                                                ) : (
                                                                    <select
                                                                        value={(v.Periodicidade && (v.Periodicidade.includes('2 4') || v.Periodicidade.includes('24') || v.Periodicidade.includes('2, 4'))) ? '2 4' : '1 3'}
                                                                        onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, v.Dia_Semana, e.target.value === '2 4' ? '2 4' : '1 3')}
                                                                        className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded p-1 text-[10px] font-bold outline-none"
                                                                        title="Ajustar Quinzena (1 3 vs 2 4)"
                                                                    >
                                                                        <option value="1 3">Quinzenal (1, 3)</option>
                                                                        <option value="2 4">Quinzenal (2, 4)</option>
                                                                    </select>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <button
                                                                    onClick={() => handleExcludeVisit(v.Cod_Cliente)}
                                                                    className="text-rose-500 hover:text-rose-700 transition"
                                                                    title="Excluir Visita"
                                                                >
                                                                    <TrashIcon className="w-4.5 h-4.5"/>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                        )}
                                    </tbody>
                                </table>
                                {sortedRoutes.length > 0 && (
                                    <div className="p-2.5 text-center text-slate-400 dark:text-slate-500 text-[10px] bg-slate-50 dark:bg-slate-800/60 font-medium flex items-center justify-between px-4 border-t border-slate-100 dark:border-slate-800">
                                        <span>
                                            Exibindo {Math.min(visibleRoutesLimit, sortedRoutes.length)} de {sortedRoutes.length} PDVs filtrados
                                            {selectedDaysFilter.length > 0 || selectedQuinzenaFilter !== 'ALL' ? ' (com filtros ativos)' : ''}
                                        </span>
                                        <span className="font-bold text-slate-500 dark:text-slate-400">
                                            Total no Escopo: {scopedAdjustedRoutes.length} PDVs
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL OVERLAY DE PROGRESSO DA OTIMIZAÇÃO COM BARRA E PERCENTUAL */}
            {optimizeProgress && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                                <RefreshIcon className="w-5 h-5 animate-spin"/>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                                    Otimizando Roteiro
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Algoritmo de balanceamento e roteirização inteligente
                                </p>
                            </div>
                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                {optimizeProgress.percentage}%
                            </span>
                        </div>

                        {/* Barra de Progresso com Transição Suave */}
                        <div className="space-y-1.5">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                                <div 
                                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full rounded-full transition-all duration-150 ease-out shadow-xs"
                                    style={{ width: `${Math.min(100, Math.max(0, optimizeProgress.percentage))}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                <span className="truncate max-w-[70%]">{optimizeProgress.currentSellerName}</span>
                                <span>{optimizeProgress.current} de {optimizeProgress.total}</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                            <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                                <span className="mr-1.5">🔒</span> Carteira blindada por vendedor (sem transferências)
                            </div>
                            <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-semibold">
                                <span className="mr-1.5">⚖️</span> Equalização de quinzenas e teto diário
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL COMPLETO DE COMPARATIVO ANTES X DEPOIS */}
            {showCompareModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header do Modal */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <PresentationChartLineIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center">
                                        Auditoria da Rota: Comparativo Antes x Depois
                                        <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                            Simulação Ativa
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Confronte as alterações de dias e distribuição quinzenal antes de salvar a rota definitiva no banco.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCompareModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Corpo com Scroll */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                            {/* Cards de Métricas Comparativas */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {/* Métrica 1: Quilometragem Total */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Distância Total</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{kpis.adjusted.totalKm} KM</span>
                                        <span className="text-xs text-slate-400 line-through">{kpis.original.totalKm} KM</span>
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1 ${kpis.kmSaved >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {kpis.kmSaved >= 0 ? `▼ ${kpis.kmSaved} KM (-${kpis.percentSaved}%)` : `▲ ${Math.abs(kpis.kmSaved)} KM`}
                                    </span>
                                </div>

                                {/* Métrica 2: Média KM / Colaborador */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Média KM / Colab</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-slate-800 dark:text-white">{kpis.adjusted.avgKmPerSeller} KM</span>
                                        <span className="text-xs text-slate-400 line-through">{kpis.original.avgKmPerSeller} KM</span>
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-400">
                                        {kpis.adjusted.sellerCount} colaboradores
                                    </span>
                                </div>

                                {/* Métrica 3: Clientes Alterados */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Clientes Reordenados</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                            {routeComparisonDiff.totalChanged}
                                        </span>
                                        <span className="text-xs text-slate-400">de {routeComparisonDiff.totalClients} PDVs</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {routeComparisonDiff.totalUnchanged} clientes mantidos
                                    </span>
                                </div>

                                {/* Métrica 4: Vendedores Desbalanceados */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Desbalanço Quinzenal (&gt;30%)</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className={`text-lg font-black ${imbalancedSellersCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {imbalancedSellersCount} colab(s)
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        {imbalancedSellersCount === 0 ? '✓ Equilíbrio 100% atingido' : 'Requer atenção'}
                                    </span>
                                </div>
                            </div>

                            {/* Comparativo de Carga Diária: Antes x Depois */}
                            <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                                <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                                    Distribuição Semanal de Atendimentos: Antes vs Depois
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                    {WEEKDAYS.map(day => {
                                        const countBefore = originalVisitsByDay[day] || 0;
                                        const countAfter = visitsByDay[day] || 0;
                                        const diffDay = countAfter - countBefore;
                                        return (
                                            <div key={day} className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center shadow-2xs">
                                                <span className="text-[10px] font-black uppercase text-slate-400 block">{day.split('-')[0]}</span>
                                                <div className="flex items-center justify-center space-x-1 mt-1 text-xs font-black">
                                                    <span className="text-slate-400 line-through text-[11px]">{countBefore}</span>
                                                    <span className="text-slate-300">→</span>
                                                    <span className="text-indigo-600 dark:text-indigo-400 text-sm">{countAfter}</span>
                                                </div>
                                                <span className={`text-[9px] font-bold block mt-0.5 ${diffDay > 0 ? 'text-emerald-600' : (diffDay < 0 ? 'text-slate-400' : 'text-slate-300')}`}>
                                                    {diffDay > 0 ? `+${diffDay}` : (diffDay < 0 ? `${diffDay}` : '=')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tabela de Clientes: Diff Antes x Depois */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                                            Clientes e Roteiros Detalhados
                                        </h4>
                                        <span className="text-[11px] font-bold text-slate-400">
                                            ({routeComparisonDiff.items.filter(i => (!compareOnlyChanged || i.isChanged) && (!compareSearchFilter || i.razaoSocial.toLowerCase().includes(compareSearchFilter.toLowerCase()) || String(i.codCliente).includes(compareSearchFilter) || i.nomeVendedor.toLowerCase().includes(compareSearchFilter.toLowerCase()))).length} listados)
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Buscar PDV, Razão ou Vendedor..."
                                            value={compareSearchFilter}
                                            onChange={e => setCompareSearchFilter(e.target.value)}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1 text-xs font-medium outline-none w-56 text-slate-800 dark:text-white"
                                        />
                                        <label className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl">
                                            <input
                                                type="checkbox"
                                                checked={compareOnlyChanged}
                                                onChange={e => setCompareOnlyChanged(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>Apenas Alterados ({routeComparisonDiff.totalChanged})</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[9px] border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="p-3">Código/PDV</th>
                                                <th className="p-3">Cliente / Razão Social</th>
                                                <th className="p-3">Colaborador</th>
                                                <th className="p-3 text-center bg-slate-100/70 dark:bg-slate-800/70">Antes (Original)</th>
                                                <th className="p-3 text-center bg-indigo-50/70 dark:bg-indigo-950/40">Depois (Otimizado)</th>
                                                <th className="p-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {routeComparisonDiff.items
                                                .filter(i => {
                                                    if (compareOnlyChanged && !i.isChanged) return false;
                                                    if (compareSearchFilter) {
                                                        const term = compareSearchFilter.toLowerCase();
                                                        const matchRazao = i.razaoSocial.toLowerCase().includes(term);
                                                        const matchCod = String(i.codCliente).includes(term);
                                                        const matchColab = i.nomeVendedor.toLowerCase().includes(term);
                                                        if (!matchRazao && !matchCod && !matchColab) return false;
                                                    }
                                                    return true;
                                                })
                                                .slice(0, 150)
                                                .map(item => (
                                                    <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                                                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                                            {item.codCliente}
                                                        </td>
                                                        <td className="p-3 truncate max-w-[200px]" title={item.razaoSocial}>
                                                            {item.razaoSocial}
                                                        </td>
                                                        <td className="p-3 truncate max-w-[130px]" title={item.nomeVendedor}>
                                                            {item.nomeVendedor}
                                                        </td>
                                                        <td className="p-3 text-center bg-slate-50/40 dark:bg-slate-900/40">
                                                            <div className="inline-flex flex-col items-center">
                                                                <span className="text-slate-700 dark:text-slate-300 font-bold">{item.beforeDay}</span>
                                                                <span className="text-[9px] text-slate-400 font-medium">{item.beforePeriod}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center bg-indigo-50/30 dark:bg-indigo-950/20">
                                                            <div className="inline-flex flex-col items-center">
                                                                <span className={`font-black ${item.changedDay ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                    {item.afterDay}
                                                                </span>
                                                                <span className={`text-[9px] font-bold ${item.changedPeriod ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 font-medium'}`}>
                                                                    {item.afterPeriod}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {item.changeType === 'INALTERADO' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                                                                    Inalterado
                                                                </span>
                                                            )}
                                                            {item.changeType === 'MUDOU_DIA' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                                                                    Dia Alterado
                                                                </span>
                                                            )}
                                                            {item.changeType === 'MUDOU_QUINZENA' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                                    Quinzena Balanceada
                                                                </span>
                                                            )}
                                                            {item.changeType === 'MUDOU_AMBOS' && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                                                    Dia + Quinzena
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer de Ações do Modal */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {routeComparisonDiff.totalChanged > 0 
                                    ? `Total de ${routeComparisonDiff.totalChanged} clientes com novos roteiros prontos para aprovação.` 
                                    : 'Nenhuma alteração detectada em relação à rota original.'}
                            </span>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setShowCompareModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                                >
                                    Voltar aos Ajustes
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCompareModal(false);
                                        handleSaveDatabase();
                                    }}
                                    disabled={saving}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition flex items-center"
                                >
                                    {saving ? <SpinnerIcon className="w-4 h-4 animate-spin mr-1.5"/> : <CheckCircleIcon className="w-4 h-4 mr-1.5"/>}
                                    Aprovar e Salvar Simulação
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
