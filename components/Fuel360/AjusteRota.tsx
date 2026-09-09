import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { DataContext } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import { getVisitasPrevistas, getPromoterClients, saveRotaPrevista, getOSRMData, getOSRMTable } from './services/apiService';
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
    EyeIcon,
    ArrowsExpandIcon,
    ArrowsCompressIcon,
    SearchIcon,
    XCircleIcon,
    ChartBarIcon
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

// Componente para redimensionamento dinâmico dos azulejos do mapa (Leaflet)
const MapResizeHandler: React.FC<{ isFullscreen: boolean }> = ({ isFullscreen }) => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 150);
        return () => clearTimeout(timer);
    }, [isFullscreen, map]);
    return null;
};

interface MapFlyToTarget {
    lat: number;
    lng: number;
    codCliente: number;
    timestamp: number;
}

// Componente para navegação suave (flyTo) e abertura do popup ao clicar na grade de clientes
const MapFlyToHandler: React.FC<{ 
    target: MapFlyToTarget | null;
    markerRefs: React.MutableRefObject<{ [cod: number]: L.CircleMarker | null }>;
}> = ({ target, markerRefs }) => {
    const map = useMap();
    useEffect(() => {
        if (!target || !target.lat || !target.lng) return;
        map.flyTo([target.lat, target.lng], 16, {
            animate: true,
            duration: 1.0
        });
        const timer = setTimeout(() => {
            const marker = markerRefs.current[target.codCliente];
            if (marker) {
                marker.openPopup();
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [target, map, markerRefs]);
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

// Helper de ângulo polar geográfico normalizado [0, 2*PI) em relação à base
const calcPolarAngle = (baseLat: number, baseLng: number, targetLat: number, targetLng: number): number => {
    const dLat = (targetLat - baseLat) * (Math.PI / 180);
    const dLng = (targetLng - baseLng) * (Math.PI / 180) * Math.cos((baseLat * Math.PI) / 180);
    let angle = Math.atan2(dLat, dLng);
    if (angle < 0) angle += 2 * Math.PI;
    return angle;
};

// Métricas reais de circuito diário (KM e tempo de deslocamento em trânsito)
interface CircuitMetrics {
    totalKm: number;
    travelMinutes: number;
}

const calcCircuitMetrics = (base: { lat: number; lng: number }, stops: { lat: number; lng: number }[]): CircuitMetrics => {
    if (stops.length === 0) return { totalKm: 0, travelMinutes: 0 };
    
    // Pontos do circuito diário fechado: Base -> Paradas -> Base
    const points: { lat: number; lng: number }[] = [];
    if (base.lat && base.lng) points.push(base);
    stops.forEach(s => {
        if (s.lat && s.lng) points.push(s);
    });
    if (base.lat && base.lng && points.length > 1) {
        points.push(base);
    }

    if (points.length < 2) return { totalKm: 0, travelMinutes: 0 };

    let totalKm = 0;
    let totalMinutes = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const geoKm = calcDist(p1.lat, p1.lng, p2.lat, p2.lng);
        // Fator de sinuosidade viária urbana/regional (1.18x)
        const roadKm = geoKm * 1.18;
        totalKm += roadKm;

        // Velocidade média calibrada pelo tipo de trecho
        let speed = 30; // km/h urbano padrão
        if (roadKm < 2.5) speed = 22; // tráfego urbano denso
        else if (roadKm >= 15) speed = 55; // vias expressas e rodovias

        totalMinutes += (roadKm / speed) * 60;
    }

    return {
        totalKm: Math.round(totalKm * 10) / 10,
        travelMinutes: Math.round(totalMinutes)
    };
};

const formatDuration = (minutes: number): string => {
    if (minutes <= 0) return '0 min';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
};

// Heurística de Roteirização TSP Circuito Fechado (Base -> Clientes -> Base) com 2-Opt Local Search
function optimizeDayCircuit2Opt<T extends { lat: number; lng: number }>(
    base: { lat: number; lng: number },
    clients: T[]
): T[] {
    if (clients.length <= 2) return clients;

    // 1. Fase de Construção: Vizinho Mais Próximo (Nearest Neighbor) a partir da Base
    const unvisited = [...clients];
    const orderedStops: T[] = [];
    let curLat = base.lat || unvisited[0].lat;
    let curLng = base.lng || unvisited[0].lng;

    while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < unvisited.length; i++) {
            const d = calcDist(curLat, curLng, unvisited[i].lat, unvisited[i].lng);
            if (d < minDist) {
                minDist = d;
                nearestIdx = i;
            }
        }
        const next = unvisited.splice(nearestIdx, 1)[0];
        orderedStops.push(next);
        curLat = next.lat;
        curLng = next.lng;
    }

    // 2. Fase de Melhoria: Heurística 2-Opt em Circuito Fechado
    // Tour fechado: [Base, ...orderedStops, Base]
    const fullTour: { lat: number; lng: number; isBase: boolean; item?: T }[] = [
        { lat: base.lat, lng: base.lng, isBase: true },
        ...orderedStops.map(item => ({ lat: item.lat, lng: item.lng, isBase: false, item })),
        { lat: base.lat, lng: base.lng, isBase: true }
    ];

    let improved = true;
    let iterations = 0;
    const maxIterations = 80;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 1; i < fullTour.length - 2; i++) {
            for (let k = i + 1; k < fullTour.length - 1; k++) {
                const pA = fullTour[i - 1];
                const pB = fullTour[i];
                const pC = fullTour[k];
                const pD = fullTour[k + 1];

                const currentDist = calcDist(pA.lat, pA.lng, pB.lat, pB.lng) + calcDist(pC.lat, pC.lng, pD.lat, pD.lng);
                const newDist = calcDist(pA.lat, pA.lng, pC.lat, pC.lng) + calcDist(pB.lat, pB.lng, pD.lat, pD.lng);

                if (newDist < currentDist - 0.0001) {
                    const segment = fullTour.slice(i, k + 1).reverse();
                    fullTour.splice(i, segment.length, ...segment);
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }
    }

    return fullTour.slice(1, -1).map(stop => stop.item!);
}

// Heurística de Roteirização TSP Circuito Fechado (Base -> Clientes -> Base) com Matriz Viária Real OSRM e 2-Opt Local Search
async function optimizeDayCircuitWithOSRM<T extends { lat: number; lng: number }>(
    base: { lat: number; lng: number },
    clients: T[]
): Promise<T[]> {
    if (clients.length <= 2) return clients;

    // Monta todos os pontos do dia incluindo a base no índice 0
    const allPoints = [{ lat: base.lat, lng: base.lng }, ...clients.map(c => ({ lat: c.lat, lng: c.lng }))];

    let osrmMatrix: number[][] | null = null;

    // Se houver base e clientes válidos (até 80 clientes por dia), consulta a Matriz Viária Real do OSRM
    if (base.lat && base.lng && clients.length > 0 && clients.length <= 80) {
        try {
            const tableRes = await getOSRMTable(allPoints);
            if (tableRes && tableRes.distances && tableRes.distances.length === allPoints.length) {
                osrmMatrix = tableRes.distances;
            }
        } catch (e) {
            osrmMatrix = null;
        }
    }

    // Função de custo entre nós (0 = Base, 1..N = clientes)
    const getCost = (idxA: number, idxB: number, pA: { lat: number; lng: number }, pB: { lat: number; lng: number }): number => {
        if (osrmMatrix && osrmMatrix[idxA] && osrmMatrix[idxA][idxB] !== undefined && osrmMatrix[idxA][idxB] !== null && osrmMatrix[idxA][idxB] > 0) {
            return osrmMatrix[idxA][idxB];
        }
        return calcDist(pA.lat, pA.lng, pB.lat, pB.lng) * 1.18;
    };

    // 1. Fase de Construção: Vizinho Mais Próximo (Nearest Neighbor) a partir da Base (índice 0)
    const unvisited = clients.map((c, i) => ({ item: c, origIdx: i + 1 }));
    const orderedStops: { item: T; origIdx: number }[] = [];
    let curIdx = 0;
    let curPoint = { lat: base.lat, lng: base.lng };

    while (unvisited.length > 0) {
        let nearestPos = 0;
        let minCost = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const cost = getCost(curIdx, unvisited[i].origIdx, curPoint, unvisited[i].item);
            if (cost < minCost) {
                minCost = cost;
                nearestPos = i;
            }
        }

        const next = unvisited.splice(nearestPos, 1)[0];
        orderedStops.push(next);
        curIdx = next.origIdx;
        curPoint = { lat: next.item.lat, lng: next.item.lng };
    }

    // 2. Fase de Melhoria: Busca Local 2-Opt em Circuito Fechado [Base, ...orderedStops, Base]
    const fullTour: { lat: number; lng: number; isBase: boolean; origIdx: number; item?: T }[] = [
        { lat: base.lat, lng: base.lng, isBase: true, origIdx: 0 },
        ...orderedStops.map(s => ({ lat: s.item.lat, lng: s.item.lng, isBase: false, origIdx: s.origIdx, item: s.item })),
        { lat: base.lat, lng: base.lng, isBase: true, origIdx: 0 }
    ];

    let improved = true;
    let iterations = 0;
    const maxIterations = 80;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 1; i < fullTour.length - 2; i++) {
            for (let k = i + 1; k < fullTour.length - 1; k++) {
                const pA = fullTour[i - 1];
                const pB = fullTour[i];
                const pC = fullTour[k];
                const pD = fullTour[k + 1];

                const currentCost = getCost(pA.origIdx, pB.origIdx, pA, pB) + getCost(pC.origIdx, pD.origIdx, pC, pD);
                const newCost = getCost(pA.origIdx, pC.origIdx, pA, pC) + getCost(pB.origIdx, pD.origIdx, pB, pD);

                if (newCost < currentCost - 0.0001) {
                    const segment = fullTour.slice(i, k + 1).reverse();
                    fullTour.splice(i, segment.length, ...segment);
                    improved = true;
                    break;
                }
            }
            if (improved) break;
        }
    }

    return fullTour.slice(1, -1).map(stop => stop.item!);
}

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

// Helper para consolidar visitas por cliente e colaborador único, eliminando duplicidades/quadruplicações mensais na interface
const consolidateUniqueClients = (visits: VisitaPrevista[]): VisitaPrevista[] => {
    const clientMap = new Map<string, VisitaPrevista>();
    const clientWeeksMap = new Map<string, Set<number>>();

    visits.forEach(v => {
        const key = `${v.Cod_Vend}-${v.Cod_Cliente}`;
        if (v.Data_da_Visita) {
            const weekNum = getWeekNumberInMonth(v.Data_da_Visita);
            if (!clientWeeksMap.has(key)) clientWeeksMap.set(key, new Set());
            clientWeeksMap.get(key)!.add(weekNum);
        }

        if (!clientMap.has(key)) {
            clientMap.set(key, { ...v });
        } else {
            const existing = clientMap.get(key)!;
            // Preserva coordenadas válidas se o registro existente não tiver
            if ((!existing.Lat || !existing.Long) && v.Lat && v.Long) {
                existing.Lat = v.Lat;
                existing.Long = v.Long;
            }
            // Se o registro existente tem periodicidade genérica/vazia e o novo registro tiver informação quinzenal mais explícita
            const pExisting = parsePeriodicidade(existing.Periodicidade).tipo;
            const pNew = parsePeriodicidade(v.Periodicidade).tipo;
            if (pExisting === 'SEMANAL' && pNew !== 'SEMANAL') {
                existing.Periodicidade = v.Periodicidade;
            }
        }
    });

    // Se a periodicidade do PDV estiver vazia ou indefinida, deduz através da distribuição de semanas do mês
    clientMap.forEach((v, key) => {
        const weeks = clientWeeksMap.get(key);
        if (weeks && (!v.Periodicidade || v.Periodicidade.trim() === '')) {
            const has1or3 = weeks.has(1) || weeks.has(3) || weeks.has(5);
            const has2or4 = weeks.has(2) || weeks.has(4);
            if (has1or3 && !has2or4) {
                v.Periodicidade = '1 3';
            } else if (has2or4 && !has1or3) {
                v.Periodicidade = '2 4';
            } else {
                v.Periodicidade = 'SEMANAL';
            }
        }
    });

    return Array.from(clientMap.values());
};

// Helper para deduplicar e obter uma lista de clientes únicos por Cod_Cliente
const deduplicateVisitasPrevistas = (visits: VisitaPrevista[]): VisitaPrevista[] => {
    const map = new Map<number, VisitaPrevista>();
    visits.forEach(v => {
        if (!map.has(v.Cod_Cliente)) {
            map.set(v.Cod_Cliente, v);
        }
    });
    return Array.from(map.values());
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

// Seletor de Colaborador com Busca em Tempo Real e Ordenação por Setor
const SearchableSellerSelect: React.FC<{
    sellers: { id: number; name: string }[];
    value: string;
    onChange: (sellerId: string) => void;
}> = ({ sellers, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fechar ao clicar fora ou ao pressionar Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Focar no campo de busca automaticamente ao abrir
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Filtro por nome ou código do setor
    const filteredSellers = useMemo(() => {
        if (!searchTerm.trim()) return sellers;
        const term = searchTerm.toLowerCase().trim();
        return sellers.filter(s =>
            String(s.id).toLowerCase().includes(term) ||
            s.name.toLowerCase().includes(term)
        );
    }, [sellers, searchTerm]);

    const selectedSellerObj = sellers.find(s => String(s.id) === value);
    const displayText = selectedSellerObj
        ? `${selectedSellerObj.id} - ${selectedSellerObj.name}`
        : 'Selecione um Vendedor...';

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="flex items-center justify-between min-w-[220px] max-w-[280px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white shadow-sm transition outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
                <span className="truncate mr-2">
                    {displayText}
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute left-0 mt-1.5 w-72 max-w-[90vw] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    {/* Campo de Busca */}
                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60">
                        <div className="relative flex items-center">
                            <SearchIcon className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por código ou nome..."
                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                >
                                    <XCircleIcon className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lista de Colaboradores */}
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredSellers.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                                Nenhum colaborador encontrado para "{searchTerm}"
                            </div>
                        ) : (
                            filteredSellers.map(seller => {
                                const isSelected = String(seller.id) === value;
                                return (
                                    <button
                                        key={seller.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(String(seller.id));
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                                            isSelected
                                                ? 'bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-700 dark:text-indigo-300'
                                                : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200'
                                        }`}
                                    >
                                        <div className="flex items-center space-x-2 truncate">
                                            <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-bold shrink-0">
                                                {seller.id}
                                            </span>
                                            <span className="truncate">{seller.name}</span>
                                        </div>
                                        {isSelected && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ml-2" />
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
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

    // Itinerário Operacional Passo a Passo com Google Maps e Waze
    const [showItineraryModal, setShowItineraryModal] = useState(false);
    const [itineraryDay, setItineraryDay] = useState<string>('SEGUNDA-FEIRA');
    const [itinerarySeller, setItinerarySeller] = useState<string>('');
    const [itineraryQuinzena, setItineraryQuinzena] = useState<'1_3' | '2_4'>('1_3');
    const [copiedItinerary, setCopiedItinerary] = useState(false);

    // Parâmetros de Roteirização
    const [optMaxClients, setOptMaxClients] = useState(15);
    const [optMaxKm, setOptMaxKm] = useState(60);
    const [optLimitKm, setOptLimitKm] = useState(false);
    const [optMaxHours, setOptMaxHours] = useState(8);
    const [optLimitHours, setOptLimitHours] = useState(false);
    const [optServiceTimePerClient, setOptServiceTimePerClient] = useState(15); // min por visita
    const [optDays, setOptDays] = useState<string[]>(['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
    const [optSatHalfPeriod, setOptSatHalfPeriod] = useState(true);
    const [optBalanceWorkload, setOptBalanceWorkload] = useState(true);

    // Tempos de Atendimento por Canal de Remuneração (Persistidos no Banco SQL Server)
    const [channelServiceTimes, setChannelServiceTimes] = useState<Record<string, number>>({
        'PADRAO': 15,
        'VAREJO': 15,
        'SUPERMERCADO': 30,
        'HIPERMERCADO': 45,
        'ATACADO': 35,
        'FARMA': 15,
        'KEY ACCOUNT': 45
    });
    const [channelActiveStatus, setChannelActiveStatus] = useState<Record<string, boolean>>({
        'PADRAO': true,
        'VAREJO': true,
        'SUPERMERCADO': true,
        'HIPERMERCADO': true,
        'ATACADO': true,
        'FARMA': true,
        'KEY ACCOUNT': true
    });
    const [dbChannelRecords, setDbChannelRecords] = useState<Array<{ ID_Canal: number; Canal: string; TempoMinutos: number; Ativo?: boolean; DataAtualizacao?: string }>>([]);
    const [showChannelTimesModal, setShowChannelTimesModal] = useState(false);
    const [savingChannelTimes, setSavingChannelTimes] = useState(false);
    const [channelSaveFeedback, setChannelSaveFeedback] = useState<string | null>(null);
    const [newCustomChannelName, setNewCustomChannelName] = useState('');
    const [newCustomChannelTime, setNewCustomChannelTime] = useState(15);
    const [lastAuditInfo, setLastAuditInfo] = useState<{ usuario?: string; dataHora?: string } | null>(null);

    // Carregar canais de atendimento gravados no banco de dados corporativo
    const loadChannelServiceTimes = useCallback(async () => {
        try {
            const res = await fetch('/api/fuel360/canais-atendimento');
            const data = await res.json();
            if (data.success) {
                if (data.lastAudit) {
                    setLastAuditInfo(data.lastAudit);
                }
                if (Array.isArray(data.canais) && data.canais.length > 0) {
                    setDbChannelRecords(data.canais);
                    const timeMap: Record<string, number> = {};
                    const activeMap: Record<string, boolean> = {};
                    data.canais.forEach((item: any) => {
                        if (item.Canal) {
                            const cName = String(item.Canal).trim().toUpperCase();
                            if (item.TempoMinutos) {
                                timeMap[cName] = Number(item.TempoMinutos);
                            }
                            activeMap[cName] = item.Ativo !== false && item.Ativo !== 0;
                        }
                    });
                    setChannelServiceTimes(prev => ({ ...prev, ...timeMap }));
                    setChannelActiveStatus(prev => ({ ...prev, ...activeMap }));
                }
            }
        } catch (e) {
            console.warn('[Fuel360] Erro ao carregar canais do banco:', e);
        }
    }, []);

    useEffect(() => {
        loadChannelServiceTimes();
    }, [loadChannelServiceTimes]);

    // Resolução do tempo em minutos de atendimento por cliente
    const getClientServiceTime = useCallback((client?: { Canal_Remuneracao?: string }) => {
        const defaultMins = channelServiceTimes['PADRAO'] || optServiceTimePerClient || 15;
        if (!client?.Canal_Remuneracao || !client.Canal_Remuneracao.trim()) {
            return defaultMins;
        }
        const canalNorm = client.Canal_Remuneracao.trim().toUpperCase();
        if (channelServiceTimes[canalNorm] !== undefined) {
            if (channelActiveStatus[canalNorm] === false) {
                return defaultMins;
            }
            return Number(channelServiceTimes[canalNorm]) || defaultMins;
        }
        for (const [key, val] of Object.entries(channelServiceTimes)) {
            if (canalNorm.includes(key) || key.includes(canalNorm)) {
                if (channelActiveStatus[key] === false) {
                    return defaultMins;
                }
                return Number(val) || defaultMins;
            }
        }
        return defaultMins;
    }, [channelServiceTimes, channelActiveStatus, optServiceTimePerClient]);

    // Canais detectados na carteira atual de clientes carregada
    const detectedChannelsFromRoutes = useMemo(() => {
        const set = new Set<string>();
        adjustedRoutes.forEach(r => {
            if (r.Canal_Remuneracao && r.Canal_Remuneracao.trim()) {
                set.add(r.Canal_Remuneracao.trim().toUpperCase());
            }
        });
        return Array.from(set).sort();
    }, [adjustedRoutes]);

    // Contagem de clientes por canal na carteira atual
    const clientCountByChannel = useMemo(() => {
        const counts: Record<string, number> = {};
        adjustedRoutes.forEach(r => {
            const c = (r.Canal_Remuneracao && r.Canal_Remuneracao.trim().toUpperCase()) || 'SEM CANAL';
            counts[c] = (counts[c] || 0) + 1;
        });
        return counts;
    }, [adjustedRoutes]);

    // Alertas de canais em uso com pendências (sem tempo cadastrado, tempo zero ou inativo)
    const channelsInUseWithAlerts = useMemo(() => {
        const alerts: Array<{ canal: string; clientCount: number; reason: 'sem_tempo' | 'inativo' | 'nao_cadastrado'; label: string }> = [];
        detectedChannelsFromRoutes.forEach(canal => {
            const count = clientCountByChannel[canal] || 0;
            if (count > 0) {
                const isRegistered = channelServiceTimes[canal] !== undefined;
                const isInactive = channelActiveStatus[canal] === false;
                const mins = Number(channelServiceTimes[canal]) || 0;
                if (!isRegistered) {
                    alerts.push({ canal, clientCount: count, reason: 'nao_cadastrado', label: 'Não cadastrado' });
                } else if (isInactive) {
                    alerts.push({ canal, clientCount: count, reason: 'inativo', label: 'Inativo no sistema' });
                } else if (mins <= 0) {
                    alerts.push({ canal, clientCount: count, reason: 'sem_tempo', label: 'Sem tempo definido' });
                }
            }
        });
        return alerts;
    }, [detectedChannelsFromRoutes, clientCountByChannel, channelServiceTimes, channelActiveStatus]);

    // Lista consolidada de canais para exibição no modal
    const allDisplayChannels = useMemo(() => {
        const set = new Set<string>(['PADRAO', ...Object.keys(channelServiceTimes), ...detectedChannelsFromRoutes]);
        return Array.from(set).filter(Boolean).sort();
    }, [channelServiceTimes, detectedChannelsFromRoutes]);

    // Exclusão de canal corporativo não utilizado
    const handleDeleteChannel = async (canalName: string) => {
        const dbRecord = dbChannelRecords.find(r => r.Canal?.toUpperCase() === canalName.toUpperCase());
        if (dbRecord?.ID_Canal) {
            try {
                const res = await fetch(`/api/fuel360/canais-atendimento/${dbRecord.ID_Canal}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario: authUser?.Nome || authUser?.Usuario || 'Operador Fuel' })
                });
                const data = await res.json();
                if (data.success && data.lastAudit) {
                    setLastAuditInfo(data.lastAudit);
                }
            } catch (e) {
                console.error('[Fuel360] Erro ao excluir canal do banco:', e);
            }
        }
        setChannelServiceTimes(prev => {
            const copy = { ...prev };
            delete copy[canalName];
            return copy;
        });
        setChannelActiveStatus(prev => {
            const copy = { ...prev };
            delete copy[canalName];
            return copy;
        });
        setDbChannelRecords(prev => prev.filter(r => r.Canal?.toUpperCase() !== canalName.toUpperCase()));
    };

    // Salvar tempos de atendimento no Banco de Dados SQL Server
    const handleSaveChannelTimesToDatabase = async () => {
        if (channelsInUseWithAlerts.length > 0) {
            const listMsg = channelsInUseWithAlerts
                .map(a => `• ${a.canal} (${a.clientCount} cliente${a.clientCount > 1 ? 's' : ''}): ${a.label}`)
                .join('\n');
            const confirmSave = window.confirm(
                `⚠️ ATENÇÃO: Existem canais com clientes na rota atual que possuem pendências:\n\n${listMsg}\n\nEles utilizarão temporariamente o tempo padrão de contingência (${channelServiceTimes['PADRAO'] || 15} min).\n\nDeseja salvar as configurações mesmo assim?`
            );
            if (!confirmSave) {
                return;
            }
        }

        setSavingChannelTimes(true);
        setChannelSaveFeedback(null);
        try {
            const listToSave = allDisplayChannels.map(canal => ({
                Canal: canal.trim().toUpperCase(),
                TempoMinutos: Number(channelServiceTimes[canal]) || channelServiceTimes['PADRAO'] || 15,
                Ativo: channelActiveStatus[canal] !== false
            }));

            const res = await fetch('/api/fuel360/canais-atendimento/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    canais: listToSave,
                    usuario: authUser?.Nome || authUser?.Usuario || 'Operador Fuel'
                })
            });
            const data = await res.json();
            if (data.success) {
                if (data.lastAudit) {
                    setLastAuditInfo(data.lastAudit);
                }
                setChannelSaveFeedback('✅ Tempos e status gravados com sucesso no banco de dados corporativo!');
                await loadChannelServiceTimes();
                setTimeout(() => {
                    setChannelSaveFeedback(null);
                    setShowChannelTimesModal(false);
                }, 1200);
            } else {
                setChannelSaveFeedback('❌ Erro ao salvar: ' + (data.error || data.message));
            }
        } catch (err: any) {
            setChannelSaveFeedback('❌ Erro de conexão ao salvar no banco: ' + err.message);
        } finally {
            setSavingChannelTimes(false);
        }
    };

    // Resumo Operacional de Rotas (KM e Tempo)
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // Simulação de Extinção e Redistribuição de Setores
    const [showExtinguishModal, setShowExtinguishModal] = useState(false);
    const [sourceSectorToExtinguish, setSourceSectorToExtinguish] = useState<string>('');
    const [targetSectorsSelected, setTargetSectorsSelected] = useState<number[]>([]);
    const [balanceLoadEqually, setBalanceLoadEqually] = useState(true);
    const [autoOptimizeAfterDistribute, setAutoOptimizeAfterDistribute] = useState(true);
    const [backupRoutesBeforeExtinguish, setBackupRoutesBeforeExtinguish] = useState<VisitaPrevista[] | null>(null);
    const [extinguishFeedback, setExtinguishFeedback] = useState<{
        sourceName: string;
        sourceId: number;
        totalMoved: number;
        breakdown: { targetId: number; targetName: string; count: number }[];
    } | null>(null);

    // Map polylines
    const [originalPolylines, setOriginalPolylines] = useState<{ id: string, color: string, points: [number, number][] }[]>([]);
    const [adjustedPolylines, setAdjustedPolylines] = useState<{ 
        id: string; 
        color: string; 
        points: [number, number][];
        day?: string;
        quinzena?: string;
        sellerId?: number;
        sellerName?: string;
        stopsCount?: number;
        distKm?: number;
        durationMin?: number;
    }[]>([]);
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
    const [mapFlyToTarget, setMapFlyToTarget] = useState<MapFlyToTarget | null>(null);
    const markerRefs = useRef<{ [cod: number]: L.CircleMarker | null }>({});

    // Modo Tela Cheia no Mapa
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);

    // Fechar tela cheia ao pressionar a tecla ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isMapFullscreen) {
                setIsMapFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isMapFullscreen]);

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
            const grupo = String(c.Grupo || '').trim().toUpperCase();
            if (teamType === 'vendedores') {
                return c.Ativo && (grupo === 'VENDEDOR' || grupo === 'VENDEDORES' || grupo === 'VENDAS');
            }
            return c.Ativo && (grupo === 'PROMOTOR' || grupo === 'PROMOTORES' || grupo === 'PROMOÇÃO' || grupo === 'PROMOCAO');
        });
    }, [colaboradores, teamType]);

    // Localizador resiliente de colaborador por código de setor e/ou nome, blindando contra colisões entre Vendedores e Promotores
    const getColabBySectorOrName = (sellerId: number, sellerName?: string): Colaborador | undefined => {
        const sId = Number(sellerId);
        const sNameNorm = sellerName ? sellerName.trim().toUpperCase() : '';

        // 1. Filtrar lista estrita da equipe ativa (vendedores ou promotores)
        const teamPool = colaboradores.filter(c => {
            const g = String(c.Grupo || '').trim().toUpperCase();
            if (teamType === 'vendedores') {
                return g === 'VENDEDOR' || g === 'VENDEDORES' || g === 'VENDAS';
            }
            return g === 'PROMOTOR' || g === 'PROMOTORES' || g === 'PROMOÇÃO' || g === 'PROMOCAO';
        });

        // 1.1 Match exato de Código E Nome no time ativo (máxima precisão de desempate)
        if (sNameNorm) {
            const exact = teamPool.find(c => Number(c.CodigoSetor) === sId && c.Nome.trim().toUpperCase() === sNameNorm);
            if (exact) return exact;

            // 1.2 Match por Código E semelhança de Nome no time ativo
            const byCodeAndNameLike = teamPool.find(c => {
                if (Number(c.CodigoSetor) !== sId) return false;
                const cName = c.Nome.trim().toUpperCase();
                return cName.includes(sNameNorm) || sNameNorm.includes(cName);
            });
            if (byCodeAndNameLike) return byCodeAndNameLike;
        }

        // 1.3 Match apenas por Código no time ativo (priorizando colaboradores ativos)
        const byCodeActive = teamPool.find(c => c.Ativo && Number(c.CodigoSetor) === sId);
        if (byCodeActive) return byCodeActive;

        const byCodeAny = teamPool.find(c => Number(c.CodigoSetor) === sId);
        if (byCodeAny) return byCodeAny;

        // 2. Se fornecido Nome, busca pelo Nome em todo o cadastro
        if (sNameNorm) {
            const byName = colaboradores.find(c => {
                const cName = c.Nome.trim().toUpperCase();
                return cName === sNameNorm;
            });
            if (byName) return byName;
        }

        // 3. Fallback: teamColaboradores
        const inTeamColabs = teamColaboradores.find(c => Number(c.CodigoSetor) === sId);
        if (inTeamColabs) return inTeamColabs;

        // 4. Último recurso
        return colaboradores.find(c => Number(c.CodigoSetor) === sId);
    };

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
        return Array.from(map.values()).sort((a, b) => {
            const numA = Number(a.id);
            const numB = Number(b.id);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });
    }, [adjustedRoutes, scopeMode, selectedSupervisor]);

    // Todos os vendedores/setores presentes na rota ajustada (para extinção e redistribuição)
    const allAdjustedSellers = useMemo(() => {
        const map = new Map<number, { id: number; name: string; clientCount: number }>();
        adjustedRoutes.forEach(r => {
            if (!map.has(r.Cod_Vend)) {
                map.set(r.Cod_Vend, { id: r.Cod_Vend, name: r.Nome_Vendedor, clientCount: 0 });
            }
        });
        const uniqueSet = new Set<string>();
        adjustedRoutes.forEach(r => {
            const key = `${r.Cod_Vend}-${r.Cod_Cliente}`;
            if (!uniqueSet.has(key)) {
                uniqueSet.add(key);
                const s = map.get(r.Cod_Vend);
                if (s) s.clientCount++;
            }
        });
        return Array.from(map.values()).sort((a, b) => {
            const numA = Number(a.id);
            const numB = Number(b.id);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });
    }, [adjustedRoutes]);

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

    // Resumo Operacional Consolidado de KM, Tempo e Balanceamento Quinzena a Quinzena
    const operationalSummary = useMemo(() => {
        // Base de colaboradores do escopo
        const activeSellers = Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend)));
        const primarySellerId = activeSellers.length === 1 ? activeSellers[0] : (selectedPromoter !== 'ALL' ? Number(selectedPromoter) : activeSellers[0]);
        const primarySellerColab = colaboradores.find(c => c.CodigoSetor === primarySellerId || c.ID_Colaborador === primarySellerId);
        const baseCoord = {
            lat: primarySellerColab?.LatitudeBase || 0,
            lng: primarySellerColab?.LongitudeBase || 0
        };

        const uniqueClients = deduplicateVisitasPrevistas(scopedAdjustedRoutes);
        let semanalCount = 0;
        let quinzenal13Count = 0;
        let quinzenal24Count = 0;

        uniqueClients.forEach(c => {
            const p = parsePeriodicidade(c.Periodicidade).tipo;
            if (p === 'SEMANAL') semanalCount++;
            else if (p === 'QUINZENAL_1_3') quinzenal13Count++;
            else if (p === 'QUINZENAL_2_4') quinzenal24Count++;
        });

        // Métricas por Dia da Semana
        const daysMetrics: Array<{
            day: string;
            pdvs13: number;
            km13: number;
            time13: number;
            pdvs24: number;
            km24: number;
            time24: number;
            avgPdvs: number;
        }> = [];

        const dayMap: Record<string, {
            day: string;
            pdvs13: number;
            km13: number;
            time13: number;
            pdvs24: number;
            km24: number;
            time24: number;
            totalKm: number;
            totalTime: number;
        }> = {};

        let totalPdvs13 = 0;
        let totalPdvs24 = 0;
        let totalKm13 = 0;
        let totalKm24 = 0;
        let totalTime13 = 0;
        let totalTime24 = 0;

        WEEKDAYS.forEach(day => {
            const dayVisits = scopedAdjustedRoutes.filter(r => r.Dia_Semana === day);
            
            // Quinzena 1/3: Semanais + Quinzenal 1/3
            const visits13 = dayVisits.filter(r => {
                const p = parsePeriodicidade(r.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
            });
            const pdvs13 = visits13.length;
            const coords13 = visits13.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long }));
            const metrics13 = coords13.length > 0 ? calcCircuitMetrics(baseCoord, coords13) : { totalKm: 0, travelMinutes: 0 };
            const serviceMins13 = visits13.reduce((sum, v) => sum + getClientServiceTime(v), 0);
            const totalDayTime13 = metrics13.travelMinutes + serviceMins13;

            // Quinzena 2/4: Semanais + Quinzenal 2/4
            const visits24 = dayVisits.filter(r => {
                const p = parsePeriodicidade(r.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
            });
            const pdvs24 = visits24.length;
            const coords24 = visits24.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long }));
            const metrics24 = coords24.length > 0 ? calcCircuitMetrics(baseCoord, coords24) : { totalKm: 0, travelMinutes: 0 };
            const serviceMins24 = visits24.reduce((sum, v) => sum + getClientServiceTime(v), 0);
            const totalDayTime24 = metrics24.travelMinutes + serviceMins24;

            totalPdvs13 += pdvs13;
            totalPdvs24 += pdvs24;
            totalKm13 += metrics13.totalKm;
            totalKm24 += metrics24.totalKm;
            totalTime13 += totalDayTime13;
            totalTime24 += totalDayTime24;

            const dayObj = {
                day,
                pdvs13,
                km13: metrics13.totalKm,
                time13: totalDayTime13,
                pdvs24,
                km24: metrics24.totalKm,
                time24: totalDayTime24,
                avgPdvs: Math.round(((pdvs13 + pdvs24) / 2) * 10) / 10
            };

            daysMetrics.push(dayObj);
            dayMap[day] = {
                day,
                pdvs13,
                km13: metrics13.totalKm,
                time13: totalDayTime13,
                pdvs24,
                km24: metrics24.totalKm,
                time24: totalDayTime24,
                totalKm: metrics13.totalKm + metrics24.totalKm,
                totalTime: totalDayTime13 + totalDayTime24
            };
        });

        const diffPdvs = Math.abs(totalPdvs13 - totalPdvs24);
        const maxPdvs = Math.max(totalPdvs13, totalPdvs24);
        const imbalancePct = maxPdvs > 0 ? Math.round((diffPdvs / maxPdvs) * 100) : 0;

        return {
            uniqueClientsCount: uniqueClients.length,
            semanalCount,
            quinzenal13Count,
            quinzenal24Count,
            daysMetrics,
            dayMap,
            totalPdvs13,
            totalPdvs24,
            totalKm13: Math.round(totalKm13 * 10) / 10,
            totalKm24: Math.round(totalKm24 * 10) / 10,
            totalTime13,
            totalTime24,
            imbalancePct,
            isBalanced: imbalancePct <= 15
        };
    }, [scopedAdjustedRoutes, selectedPromoter, colaboradores, getClientServiceTime]);

    // Limite dinâmico de renderização da tabela para Scroll Spy
    const visibleRoutesLimit = useMemo(() => {
        if (!highlightedClientCode) return 100;
        const targetIndex = sortedRoutes.findIndex(r => r.Cod_Cliente === highlightedClientCode);
        return targetIndex >= 100 ? Math.min(sortedRoutes.length, targetIndex + 15) : 100;
    }, [sortedRoutes, highlightedClientCode]);

    // Destaque visual do cliente clicado no mapa (sem rolar a tela, abrindo apenas os detalhes no mapa)
    const handleSelectPdvFromMap = (codCliente: number) => {
        setHighlightedClientCode(codCliente);

        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = setTimeout(() => {
            setHighlightedClientCode(null);
        }, 4500);
    };

    // Navegação sob demanda do Mapa para a Grade de Ajuste Fino (acionado pelo botão 'Ver na Tabela' do Popup)
    const handleScrollToPdvInTable = (codCliente: number) => {
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
        }, 5000);

        setTimeout(() => {
            const rowElem = document.getElementById(`row-pdv-${codCliente}`);
            if (rowElem) {
                rowElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    };

    // Scroll Spy Bidirecional: Focar cliente clicado na Grade de Ajuste Fino diretamente no Mapa (flyTo + popup)
    const handleFocusClientOnMap = (v: VisitaPrevista) => {
        if (!v.Lat || !v.Long || (v.Lat === 0 && v.Long === 0)) {
            alert(`O cliente ${v.Cod_Cliente} (${v.Razao_Social}) não possui coordenadas geográficas cadastradas para exibição no mapa.`);
            return;
        }

        // Se houver filtro de colaborador ativo divergente, expande para todos para que o marcador esteja presente no mapa
        if (selectedPromoter !== 'ALL' && String(v.Cod_Vend) !== selectedPromoter) {
            setSelectedPromoter('ALL');
        }

        // Se houver filtro de dia da semana ativo que exclua este cliente, inclui o dia no filtro
        if (selectedDaysFilter.length > 0 && !selectedDaysFilter.includes(v.Dia_Semana)) {
            setSelectedDaysFilter(prev => [...prev, v.Dia_Semana]);
        }

        // Se houver filtro de quinzena ativo que exclua este cliente, abre para 'ALL'
        if (selectedQuinzenaFilter !== 'ALL') {
            const pType = parsePeriodicidade(v.Periodicidade).tipo;
            if (selectedQuinzenaFilter === '1_3' && pType === 'QUINZENAL_2_4') {
                setSelectedQuinzenaFilter('ALL');
            } else if (selectedQuinzenaFilter === '2_4' && pType === 'QUINZENAL_1_3') {
                setSelectedQuinzenaFilter('ALL');
            }
        }

        setHighlightedClientCode(v.Cod_Cliente);

        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = setTimeout(() => {
            setHighlightedClientCode(null);
        }, 5000);

        setMapFlyToTarget({
            lat: v.Lat,
            lng: v.Long,
            codCliente: v.Cod_Cliente,
            timestamp: Date.now()
        });

        // Rola suavemente até o container do mapa se estiver fora do campo de visão da janela
        const mapElem = document.getElementById('roteiro-map-container');
        if (mapElem) {
            const rect = mapElem.getBoundingClientRect();
            if (rect.top < 0 || rect.bottom < 150) {
                mapElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
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
            
            // Consolidar carteira de clientes únicos por vendedor, eliminando repetições mensais (semanais 4x e quinzenais 2x)
            const uniqueData = consolidateUniqueClients(filteredData);

            setOriginalRoutes(uniqueData);
            setAdjustedRoutes(JSON.parse(JSON.stringify(uniqueData)));
        } catch (e: any) {
            alert("Erro ao carregar rotas: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const processRoteiroParsedData = (parsedData: VisitaPrevista[], mappings: Record<string, number>) => {
        const mappedData = parsedData.map(v => {
            const mappedId = mappings[v.Nome_Vendedor];
            if (mappedId) {
                v.Cod_Vend = Number(mappedId);
                const colab = teamColaboradores.find(c => c.CodigoSetor === v.Cod_Vend);
                if (colab) v.Nome_Vendedor = colab.Nome;
            }
            return v;
        }).filter(v => v.Cod_Vend && v.Cod_Vend > 0);

        if (mappedData.length === 0) {
            alert("Nenhum dado válido restou após o mapeamento de promotores.");
            setLoading(false);
            return;
        }

        // Consolidar clientes únicos da planilha por colaborador
        const finalData = consolidateUniqueClients(mappedData);

        setOriginalRoutes(finalData);
        setAdjustedRoutes(JSON.parse(JSON.stringify(finalData)));
        setLoading(false);
        alert(`Sucesso! ${finalData.length} clientes únicos carregados da planilha.`);
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

    // Motor de Roteirização Avançado: Clusterização Espacial por Dia + TSP Circuito Fechado 2-Opt (Base -> Clientes -> Base)
    const runOptimizationForSellers = async (sellers: number[], baseRoutes: VisitaPrevista[]) => {
        if (sellers.length === 0) return [];

        setLoading(true);
        setOptimizeProgress({
            current: 0,
            total: sellers.length,
            percentage: 0,
            currentSellerName: 'Iniciando motor de roteirização...'
        });

        await new Promise(r => setTimeout(r, 60));

        const result: VisitaPrevista[] = [];
        const activeDays = optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA'];

        for (let sIdx = 0; sIdx < sellers.length; sIdx++) {
            const sellerId = sellers[sIdx];
            const sellerVisits = baseRoutes.filter(r => r.Cod_Vend === sellerId);
            const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);
            const sellerName = colab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : `Colaborador ${sellerId}`);

            const currentPct = Math.round(((sIdx) / sellers.length) * 100);
            setOptimizeProgress({
                current: sIdx + 1,
                total: sellers.length,
                percentage: currentPct,
                currentSellerName: `${sellerName} (${sIdx + 1}/${sellers.length})`
            });

            await new Promise(r => setTimeout(r, 25));

            if (sellerVisits.length === 0) continue;

            const uniqueClientsMap = new Map<number, {
                sampleVisit: VisitaPrevista;
                tipo: PeriodicidadeTipo;
                originalPeriodicidade: string;
                lat: number;
                lng: number;
                polarAngle: number;
                distFromBase: number;
            }>();

            const validCoordsVisits = sellerVisits.filter(v => v.Lat && v.Long);
            let baseLat = colab?.LatitudeBase || 0;
            let baseLng = colab?.LongitudeBase || 0;

            if ((!baseLat || !baseLng) && validCoordsVisits.length > 0) {
                baseLat = validCoordsVisits.reduce((acc, v) => acc + (v.Lat || 0), 0) / validCoordsVisits.length;
                baseLng = validCoordsVisits.reduce((acc, v) => acc + (v.Long || 0), 0) / validCoordsVisits.length;
            }

            sellerVisits.forEach(v => {
                if (!uniqueClientsMap.has(v.Cod_Cliente)) {
                    const parsedP = parsePeriodicidade(v.Periodicidade);
                    const clientLat = v.Lat || 0;
                    const clientLng = v.Long || 0;
                    const polarAngle = (clientLat && clientLng) 
                        ? calcPolarAngle(baseLat, baseLng, clientLat, clientLng)
                        : 0;
                    const distFromBase = (clientLat && clientLng)
                        ? calcDist(baseLat, baseLng, clientLat, clientLng)
                        : 9999;

                    uniqueClientsMap.set(v.Cod_Cliente, {
                        sampleVisit: v,
                        tipo: parsedP.tipo,
                        originalPeriodicidade: v.Periodicidade || 'Semanal',
                        lat: clientLat,
                        lng: clientLng,
                        polarAngle,
                        distFromBase
                    });
                }
            });

            const uniqueClients = Array.from(uniqueClientsMap.values());
            if (uniqueClients.length === 0) continue;

            // 2. Clusterização Angular Contígua
            const getDayWeight = (day: string) => (day === 'SÁBADO' && optSatHalfPeriod) ? 0.5 : 1.0;
            const totalWeight = activeDays.reduce((sum, d) => sum + getDayWeight(d), 0);

            const validCoords = uniqueClients.filter(c => c.lat && c.lng);
            const centerPortfolioLat = validCoords.length > 0 
                ? validCoords.reduce((acc, c) => acc + c.lat, 0) / validCoords.length 
                : baseLat;
            const centerPortfolioLng = validCoords.length > 0 
                ? validCoords.reduce((acc, c) => acc + c.lng, 0) / validCoords.length 
                : baseLng;

            const sortedSpatially = [...uniqueClients].sort((a, b) => {
                const angleA = (a.lat && a.lng) ? calcPolarAngle(centerPortfolioLat, centerPortfolioLng, a.lat, a.lng) : a.polarAngle;
                const angleB = (b.lat && b.lng) ? calcPolarAngle(centerPortfolioLat, centerPortfolioLng, b.lat, b.lng) : b.polarAngle;
                const diffAngle = angleA - angleB;
                if (Math.abs(diffAngle) > 0.05) return diffAngle;
                return a.distFromBase - b.distFromBase;
            });

            const allSemanais = sortedSpatially.filter(c => c.tipo === 'SEMANAL');
            let poolQuinzenais13 = sortedSpatially.filter(c => c.tipo === 'QUINZENAL_1_3');
            let poolQuinzenais24 = sortedSpatially.filter(c => c.tipo === 'QUINZENAL_2_4');

            if (optBalanceWorkload) {
                const allQuinzenais = [...poolQuinzenais13, ...poolQuinzenais24];
                const targetQ13 = Math.floor(allQuinzenais.length / 2);

                if (poolQuinzenais13.length > targetQ13) {
                    const excess = poolQuinzenais13.length - targetQ13;
                    const toMove = poolQuinzenais13.splice(poolQuinzenais13.length - excess, excess);
                    toMove.forEach(c => {
                        c.tipo = 'QUINZENAL_2_4';
                        c.originalPeriodicidade = '2 4';
                    });
                    poolQuinzenais24.push(...toMove);
                } else if (poolQuinzenais13.length < targetQ13) {
                    const deficit = targetQ13 - poolQuinzenais13.length;
                    const toMove = poolQuinzenais24.splice(0, deficit);
                    toMove.forEach(c => {
                        c.tipo = 'QUINZENAL_1_3';
                        c.originalPeriodicidade = '1 3';
                    });
                    poolQuinzenais13.push(...toMove);
                }
            }

            interface DayBucket {
                day: string;
                weight: number;
                maxCap: number;
                semanais: typeof uniqueClients;
                quinzenais13: typeof uniqueClients;
                quinzenais24: typeof uniqueClients;
            }

            const dayBuckets: DayBucket[] = activeDays.map(day => {
                const w = getDayWeight(day);
                let cap = (day === 'SÁBADO' && optSatHalfPeriod) ? Math.max(1, Math.floor(optMaxClients / 2)) : optMaxClients;
                if (optLimitHours) {
                    const hoursForDay = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                    const estimatedTravelMins = 60;
                    const availableMins = Math.max(30, (hoursForDay * 60) - estimatedTravelMins);
                    const avgServiceMins = uniqueClients.length 
                        ? (uniqueClients.reduce((acc, c) => acc + getClientServiceTime(c.sampleVisit), 0) / uniqueClients.length) 
                        : (channelServiceTimes['PADRAO'] || 15);
                    const maxClientsByHours = Math.max(1, Math.floor(availableMins / Math.max(5, avgServiceMins)));
                    cap = Math.min(cap, maxClientsByHours);
                }
                return {
                    day,
                    weight: w,
                    maxCap: cap,
                    semanais: [],
                    quinzenais13: [],
                    quinzenais24: []
                };
            });

            let remSemanais = [...allSemanais];
            let accSemanais = 0;
            let cumWeightSemanais = 0;
            dayBuckets.forEach((bucket, idx) => {
                cumWeightSemanais += bucket.weight;
                const isLast = idx === dayBuckets.length - 1;
                const cumTarget = isLast ? allSemanais.length : Math.round(allSemanais.length * (cumWeightSemanais / totalWeight));
                const quota = Math.max(0, Math.min(remSemanais.length, cumTarget - accSemanais));
                bucket.semanais = remSemanais.splice(0, quota);
                accSemanais += bucket.semanais.length;
            });

            const totalTargetVisits13 = allSemanais.length + poolQuinzenais13.length;
            let remQ13 = [...poolQuinzenais13];
            let accVisits13 = 0;
            let cumWeight13 = 0;
            dayBuckets.forEach((bucket, idx) => {
                cumWeight13 += bucket.weight;
                const isLast = idx === dayBuckets.length - 1;
                const cumTarget = isLast ? totalTargetVisits13 : Math.round(totalTargetVisits13 * (cumWeight13 / totalWeight));
                const targetForThisBucket = Math.max(0, cumTarget - accVisits13);
                const neededQ13 = Math.max(0, targetForThisBucket - bucket.semanais.length);
                const maxAllowed = optLimitKm ? Math.max(0, bucket.maxCap - bucket.semanais.length) : Infinity;
                const quota = isLast ? remQ13.length : Math.max(0, Math.min(remQ13.length, Math.min(maxAllowed, neededQ13)));
                bucket.quinzenais13 = remQ13.splice(0, quota);
                accVisits13 += (bucket.semanais.length + bucket.quinzenais13.length);
            });
            while (remQ13.length > 0) {
                const c = remQ13.shift()!;
                const bestBucket = [...dayBuckets].sort((a, b) => 
                    (a.semanais.length + a.quinzenais13.length) - (b.semanais.length + b.quinzenais13.length)
                )[0];
                bestBucket.quinzenais13.push(c);
            }

            const totalTargetVisits24 = allSemanais.length + poolQuinzenais24.length;
            let remQ24 = [...poolQuinzenais24];
            let accVisits24 = 0;
            let cumWeight24 = 0;
            dayBuckets.forEach((bucket, idx) => {
                cumWeight24 += bucket.weight;
                const isLast = idx === dayBuckets.length - 1;
                const cumTarget = isLast ? totalTargetVisits24 : Math.round(totalTargetVisits24 * (cumWeight24 / totalWeight));
                const targetForThisBucket = Math.max(0, cumTarget - accVisits24);
                const neededQ24 = Math.max(0, targetForThisBucket - bucket.semanais.length);
                const maxAllowed = optLimitKm ? Math.max(0, bucket.maxCap - bucket.semanais.length) : Infinity;
                const quota = isLast ? remQ24.length : Math.max(0, Math.min(remQ24.length, Math.min(maxAllowed, neededQ24)));
                bucket.quinzenais24 = remQ24.splice(0, quota);
                accVisits24 += (bucket.semanais.length + bucket.quinzenais24.length);
            });
            while (remQ24.length > 0) {
                const c = remQ24.shift()!;
                const bestBucket = [...dayBuckets].sort((a, b) => 
                    (a.semanais.length + a.quinzenais24.length) - (b.semanais.length + b.quinzenais24.length)
                )[0];
                bestBucket.quinzenais24.push(c);
            }

            const calcDayCentroid = (bucket: DayBucket) => {
                const stops = [...bucket.semanais, ...bucket.quinzenais13, ...bucket.quinzenais24].filter(c => c.lat && c.lng);
                if (stops.length > 0) {
                    return {
                        lat: stops.reduce((s, c) => s + c.lat, 0) / stops.length,
                        lng: stops.reduce((s, c) => s + c.lng, 0) / stops.length
                    };
                }
                return { lat: baseLat, lng: baseLng };
            };

            let dayCentroids = dayBuckets.map(calcDayCentroid);

            for (let pass = 0; pass < 6; pass++) {
                dayCentroids = dayBuckets.map(calcDayCentroid);

                for (let i = 0; i < dayBuckets.length; i++) {
                    for (let j = i + 1; j < dayBuckets.length; j++) {
                        const b1 = dayBuckets[i];
                        const b2 = dayBuckets[j];
                        const c1 = dayCentroids[i];
                        const c2 = dayCentroids[j];

                        for (let k1 = 0; k1 < b1.quinzenais13.length; k1++) {
                            const cli1 = b1.quinzenais13[k1];
                            if (!cli1.lat || !cli1.lng) continue;

                            for (let k2 = 0; k2 < b2.quinzenais13.length; k2++) {
                                const cli2 = b2.quinzenais13[k2];
                                if (!cli2.lat || !cli2.lng) continue;

                                const currentDist = calcDist(cli1.lat, cli1.lng, c1.lat, c1.lng) + calcDist(cli2.lat, cli2.lng, c2.lat, c2.lng);
                                const swappedDist = calcDist(cli1.lat, cli1.lng, c2.lat, c2.lng) + calcDist(cli2.lat, cli2.lng, c1.lat, c1.lng);

                                if (swappedDist < currentDist - 0.5) {
                                    b1.quinzenais13[k1] = cli2;
                                    b2.quinzenais13[k2] = cli1;
                                }
                            }
                        }
                    }
                }

                for (let i = 0; i < dayBuckets.length; i++) {
                    for (let j = i + 1; j < dayBuckets.length; j++) {
                        const b1 = dayBuckets[i];
                        const b2 = dayBuckets[j];
                        const c1 = dayCentroids[i];
                        const c2 = dayCentroids[j];

                        for (let k1 = 0; k1 < b1.quinzenais24.length; k1++) {
                            const cli1 = b1.quinzenais24[k1];
                            if (!cli1.lat || !cli1.lng) continue;

                            for (let k2 = 0; k2 < b2.quinzenais24.length; k2++) {
                                const cli2 = b2.quinzenais24[k2];
                                if (!cli2.lat || !cli2.lng) continue;

                                const currentDist = calcDist(cli1.lat, cli1.lng, c1.lat, c1.lng) + calcDist(cli2.lat, cli2.lng, c2.lat, c2.lng);
                                const swappedDist = calcDist(cli1.lat, cli1.lng, c2.lat, c2.lng) + calcDist(cli2.lat, cli2.lng, c1.lat, c1.lng);

                                if (swappedDist < currentDist - 0.5) {
                                    b1.quinzenais24[k1] = cli2;
                                    b2.quinzenais24[k2] = cli1;
                                }
                            }
                        }
                    }
                }
            }

            for (const bucket of dayBuckets) {
                const rawClients13 = [...bucket.semanais, ...bucket.quinzenais13];
                const optimizedClients13 = await optimizeDayCircuitWithOSRM({ lat: baseLat, lng: baseLng }, rawClients13);

                const rawClients24 = [...bucket.semanais, ...bucket.quinzenais24];
                const optimizedClients24 = await optimizeDayCircuitWithOSRM({ lat: baseLat, lng: baseLng }, rawClients24);

                const addedInDay = new Set<number>();

                optimizedClients13.forEach(c => {
                    if (addedInDay.has(c.sampleVisit.Cod_Cliente)) return;
                    addedInDay.add(c.sampleVisit.Cod_Cliente);

                    const isSemanal = c.tipo === 'SEMANAL';
                    const periodicidadeFinal = isSemanal 
                        ? 'SEMANAL' 
                        : (c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (1,3)' : '1 3');

                    result.push({
                        ...c.sampleVisit,
                        Cod_Vend: sellerId,
                        Nome_Vendedor: sellerName,
                        Dia_Semana: bucket.day,
                        Periodicidade: periodicidadeFinal,
                        Data_da_Visita: c.sampleVisit.Data_da_Visita || ''
                    });
                });

                optimizedClients24.forEach(c => {
                    if (addedInDay.has(c.sampleVisit.Cod_Cliente)) return;
                    addedInDay.add(c.sampleVisit.Cod_Cliente);

                    const periodicidadeFinal = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (2,4)' : '2 4';

                    result.push({
                        ...c.sampleVisit,
                        Cod_Vend: sellerId,
                        Nome_Vendedor: sellerName,
                        Dia_Semana: bucket.day,
                        Periodicidade: periodicidadeFinal,
                        Data_da_Visita: c.sampleVisit.Data_da_Visita || ''
                    });
                });
            }
        }

        setOptimizeProgress({
            current: sellers.length,
            total: sellers.length,
            percentage: 100,
            currentSellerName: 'Roteirização concluída com sucesso!'
        });
        await new Promise(r => setTimeout(r, 100));

        if (result.length > 0) {
            setAdjustedRoutes(prev => {
                const otherRoutes = prev.filter(r => !sellers.includes(r.Cod_Vend));
                return [...otherRoutes, ...result];
            });
        }

        setLoading(false);
        setOptimizeProgress(null);
        return result;
    };

    const handleOptimizeSimulate = async () => {
        if (adjustedRoutes.length === 0) {
            alert("Nenhum dado de rota carregado para otimização.");
            return;
        }

        const sellers = Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend)));
        if (sellers.length === 0) {
            alert("Nenhum vendedor encontrado no escopo selecionado.");
            return;
        }

        const result = await runOptimizationForSellers(sellers, adjustedRoutes);
        if (result && result.length === 0) {
            alert("Aviso: Nenhuma visita pôde ser gerada para os dias ativos configurados.");
            return;
        }

        const escopoDesc = scopeMode === 'vendedor' 
            ? 'do vendedor selecionado' 
            : (scopeMode === 'equipe' ? 'da equipe de supervisão selecionada' : 'geral');
        alert(`Otimização e Roteirização Concluída (${escopoDesc})!\n\n• Circuito fechado diário: Base ➜ Clientes ➜ Retorno à Base.\n• Algoritmo TSP 2-Opt aplicado: eliminação de cruzamentos e menor percurso.\n• Zoneamento por microrregiões contíguas preservado.\n• Carteiras mantidas 100% blindadas por colaborador.\n• Total de visitas sequenciadas: ${result ? result.length : 0}`);
    };

    // SIMULAÇÃO DE EXTINÇÃO E REDISTRIBUIÇÃO DE SETORES COM BALANCEAMENTO EQUILIBRADO
    const handleExtinguishAndDistributeSector = async () => {
        if (!sourceSectorToExtinguish) {
            alert("Selecione o setor/vendedor que será extinto.");
            return;
        }
        const sourceId = Number(sourceSectorToExtinguish);
        if (targetSectorsSelected.length === 0) {
            alert("Selecione ao menos um setor receptor para absorver os clientes.");
            return;
        }
        if (targetSectorsSelected.includes(sourceId)) {
            alert("O setor a ser extinto não pode estar entre os setores receptores de destino.");
            return;
        }

        const sourceVisits = adjustedRoutes.filter(r => r.Cod_Vend === sourceId);
        if (sourceVisits.length === 0) {
            alert("O setor selecionado não possui clientes cadastrados na rota ativa.");
            return;
        }

        // Salva backup para permitir desfazer
        setBackupRoutesBeforeExtinguish([...adjustedRoutes]);

        // Clientes únicos do setor extinto
        const uniqueClientsToMove = deduplicateVisitasPrevistas(sourceVisits);
        const sourceColab = getColabBySectorOrName(sourceId, sourceVisits[0]?.Nome_Vendedor);
        const sourceName = sourceColab?.Nome || sourceVisits[0]?.Nome_Vendedor || `Setor ${sourceId}`;

        // Caracterização geográfica e de carga dos setores receptores
        interface TargetReceptorInfo {
            id: number;
            name: string;
            baseLat: number;
            baseLng: number;
            centroidLat: number;
            centroidLng: number;
            initialCount: number;
            quota: number;
            assignedClients: VisitaPrevista[];
        }

        const receptors: TargetReceptorInfo[] = targetSectorsSelected.map(tId => {
            const tVisits = adjustedRoutes.filter(r => r.Cod_Vend === tId);
            const tColab = getColabBySectorOrName(tId, tVisits[0]?.Nome_Vendedor);
            const tName = tColab?.Nome || (tVisits.length > 0 ? tVisits[0].Nome_Vendedor : `Setor ${tId}`);
            const baseLat = tColab?.LatitudeBase || 0;
            const baseLng = tColab?.LongitudeBase || 0;

            const validCoords = tVisits.filter(v => v.Lat && v.Long);
            const centroidLat = validCoords.length > 0
                ? validCoords.reduce((acc, v) => acc + v.Lat!, 0) / validCoords.length
                : baseLat;
            const centroidLng = validCoords.length > 0
                ? validCoords.reduce((acc, v) => acc + v.Long!, 0) / validCoords.length
                : baseLng;

            const tUnique = deduplicateVisitasPrevistas(tVisits);

            return {
                id: tId,
                name: tName,
                baseLat,
                baseLng,
                centroidLat,
                centroidLng,
                initialCount: tUnique.length,
                quota: 0,
                assignedClients: []
            };
        });

        const totalToDistribute = uniqueClientsToMove.length;

        // Cota de distribuição: quando balanceLoadEqually estiver ativo, reparte em parcelas balanceadas
        if (balanceLoadEqually && receptors.length > 1) {
            const baseQuota = Math.floor(totalToDistribute / receptors.length);
            const remainder = totalToDistribute % receptors.length;
            receptors.forEach((r, idx) => {
                r.quota = baseQuota + (idx < remainder ? 1 : 0);
            });
        } else {
            receptors.forEach(r => { r.quota = totalToDistribute; });
        }

        // Ordenação espacial dos clientes do setor extinto para agrupamento de proximidade
        const refLat = receptors[0].centroidLat || receptors[0].baseLat;
        const refLng = receptors[0].centroidLng || receptors[0].baseLng;

        const sortedClients = [...uniqueClientsToMove].sort((a, b) => {
            const distA = (a.Lat && a.Long) ? calcDist(a.Lat, a.Long, refLat, refLng) : 9999;
            const distB = (b.Lat && b.Long) ? calcDist(b.Lat, b.Long, refLat, refLng) : 9999;
            return distA - distB;
        });

        // Atribuição de cada cliente ao setor receptor geograficamente mais favorável respeitando a cota
        const clientAssignment = new Map<number, TargetReceptorInfo>();

        sortedClients.forEach(client => {
            const cLat = client.Lat || 0;
            const cLng = client.Long || 0;

            // Filtra os receptores que ainda têm cota disponível
            const availableReceptors = receptors.filter(r => r.assignedClients.length < r.quota);
            const candidateList = availableReceptors.length > 0 ? availableReceptors : receptors;

            candidateList.sort((r1, r2) => {
                const d1 = (cLat && cLng && r1.centroidLat && r1.centroidLng)
                    ? calcDist(cLat, cLng, r1.centroidLat, r1.centroidLng)
                    : (cLat && cLng && r1.baseLat && r1.baseLng ? calcDist(cLat, cLng, r1.baseLat, r1.baseLng) : 9999);
                const d2 = (cLat && cLng && r2.centroidLat && r2.centroidLng)
                    ? calcDist(cLat, cLng, r2.centroidLat, r2.centroidLng)
                    : (cLat && cLng && r2.baseLat && r2.baseLng ? calcDist(cLat, cLng, r2.baseLat, r2.baseLng) : 9999);
                return d1 - d2;
            });

            const chosen = candidateList[0];
            chosen.assignedClients.push(client);
            clientAssignment.set(client.Cod_Cliente, chosen);
        });

        // Atualização de todas as visitas dos clientes do setor extinto com os dados do novo setor receptor
        const updatedSourceVisits = sourceVisits.map(v => {
            const receptor = clientAssignment.get(v.Cod_Cliente);
            if (!receptor) return v;
            return {
                ...v,
                Cod_Vend: receptor.id,
                Nome_Vendedor: receptor.name
            };
        });

        // Novo array de rotas ajustadas: remove o setor extinto e adiciona as visitas reatribuídas
        const otherRoutes = adjustedRoutes.filter(r => r.Cod_Vend !== sourceId);
        const newAdjustedRoutes = [...otherRoutes, ...updatedSourceVisits];

        if (scopeMode === 'vendedor' && selectedSeller === String(sourceId)) {
            setSelectedSeller(String(receptors[0].id));
        }

        setAdjustedRoutes(newAdjustedRoutes);

        const breakdown = receptors.map(r => ({
            targetId: r.id,
            targetName: r.name,
            count: r.assignedClients.length
        }));

        setExtinguishFeedback({
            sourceName,
            sourceId,
            totalMoved: totalToDistribute,
            breakdown
        });

        setShowExtinguishModal(false);

        // Se autoOptimizeAfterDistribute estiver ativo, reotimiza os setores receptores com a nova carga
        if (autoOptimizeAfterDistribute) {
            setTimeout(async () => {
                await runOptimizationForSellers(receptors.map(r => r.id), newAdjustedRoutes);
            }, 100);
        }
    };

    // Desfazer a extinção/redistribuição e restaurar a carteira do setor anterior
    const handleUndoExtinguish = () => {
        if (!backupRoutesBeforeExtinguish) return;
        if (!confirm("Deseja restaurar as rotas para o estado anterior à redistribuição do setor?")) return;
        setAdjustedRoutes(backupRoutesBeforeExtinguish);
        setBackupRoutesBeforeExtinguish(null);
        setExtinguishFeedback(null);
        alert("Redistribuição desfeita com sucesso! O setor e todas as suas visitas foram restaurados.");
    };

    const osrmCacheRef = useRef<Map<string, [number, number][]>>(new Map());

    // Traçar polilinhas baseadas na ordem geográfica das visitas no mapa
    useEffect(() => {
        const traceAsync = async (routes: VisitaPrevista[]) => {
            const sellers = Array.from(new Set(routes.map(r => r.Cod_Vend)));
            const lines: { id: string, color: string, points: [number, number][] }[] = [];

            for (const sellerId of sellers) {
                if (selectedPromoter !== 'ALL' && String(sellerId) !== selectedPromoter) continue;

                const sellerVisits = routes.filter(r => r.Cod_Vend === sellerId);
                const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);
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
                        const stopsCoords = sortedVisits.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long }));
                        const circuit = calcCircuitMetrics({ lat: colab?.LatitudeBase || 0, lng: colab?.LongitudeBase || 0 }, stopsCoords);
                        const lineMeta = {
                            id: `${sellerId}-${day}`,
                            color: lineColor,
                            day,
                            sellerId,
                            sellerName: colab?.Nome || visits[0]?.Nome_Vendedor || `Colaborador ${sellerId}`,
                            stopsCount: sortedVisits.length,
                            distKm: circuit.totalKm,
                            durationMin: circuit.travelMinutes
                        };
                        
                        if (osrmCacheRef.current.has(hashKey)) {
                            lines.push({ ...lineMeta, points: osrmCacheRef.current.get(hashKey)! });
                        } else {
                            try {
                                const osrm = await getOSRMData(pointsObj, false);
                                if (osrm && osrm.geometry && osrm.geometry.length > 0) {
                                    osrmCacheRef.current.set(hashKey, osrm.geometry);
                                    lines.push({ ...lineMeta, points: osrm.geometry });
                                } else {
                                    const straightCoords = pointsObj.map(c => [c.Lat, c.Long] as [number, number]);
                                    osrmCacheRef.current.set(hashKey, straightCoords);
                                    lines.push({ ...lineMeta, points: straightCoords });
                                }
                            } catch (e) {
                                const straightCoords = pointsObj.map(c => [c.Lat, c.Long] as [number, number]);
                                lines.push({ ...lineMeta, points: straightCoords });
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

    // Mapa da ordem/sequência de atendimento diário de cada cliente (1ª parada, 2ª parada...)
    const visitOrderMap = useMemo(() => {
        const map = new Map<string, { order: number; total: number }>();
        const dayGroups = new Map<string, VisitaPrevista[]>();

        scopedAdjustedRoutes.forEach(v => {
            const key = `${v.Cod_Vend}-${v.Dia_Semana}`;
            if (!dayGroups.has(key)) dayGroups.set(key, []);
            dayGroups.get(key)!.push(v);
        });

        dayGroups.forEach(visits => {
            visits.forEach((v, index) => {
                const clientKey = `${v.Cod_Vend}-${v.Dia_Semana}-${v.Cod_Cliente}`;
                map.set(clientKey, { order: index + 1, total: visits.length });
            });
        });

        return map;
    }, [scopedAdjustedRoutes]);

    // Calcular KPIs de Comparação com Métricas Reais de Circuito Fechado (KM e Tempo de Deslocamento)
    const kpis = useMemo(() => {
        const getKpisForSet = (visits: VisitaPrevista[]) => {
            let totalKm = 0;
            let totalTravelMinutes = 0;
            const sellers = Array.from(new Set(visits.map(r => r.Cod_Vend)));
            const countsPerSellerAndDay = new Map<string, number>();
            let exceededKmCount = 0;
            let exceededHoursCount = 0;

            sellers.forEach(sellerId => {
                const sellerVisits = visits.filter(r => r.Cod_Vend === sellerId);
                const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);

                // Base do colaborador (com fallback para primeiro cliente válido)
                const baseLat = colab?.LatitudeBase || sellerVisits.find(v => v.Lat)?.Lat || 0;
                const baseLng = colab?.LongitudeBase || sellerVisits.find(v => v.Long)?.Long || 0;
                const base = { lat: baseLat, lng: baseLng };

                // Agrupar visitas por dia da semana
                const dayMap = new Map<string, VisitaPrevista[]>();
                sellerVisits.forEach(v => {
                    if (!dayMap.has(v.Dia_Semana)) dayMap.set(v.Dia_Semana, []);
                    dayMap.get(v.Dia_Semana)!.push(v);
                });

                let sellerHasExceededDay = false;
                let sellerHasExceededHours = false;

                dayMap.forEach((dayVisits, day) => {
                    const dayKey = `${sellerId}-${day}`;
                    countsPerSellerAndDay.set(dayKey, dayVisits.length);

                    const stops = dayVisits.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long }));
                    const circuit = calcCircuitMetrics(base, stops);

                    totalKm += circuit.totalKm;
                    totalTravelMinutes += circuit.travelMinutes;

                    const dayVisitsServiceMins = dayVisits.reduce((acc, v) => acc + getClientServiceTime(v), 0);
                    const dayEstimatedTotalHours = (circuit.travelMinutes + dayVisitsServiceMins) / 60;

                    if (optLimitKm && circuit.totalKm > optMaxKm) {
                        sellerHasExceededDay = true;
                    }
                    if (optLimitHours && dayEstimatedTotalHours > optMaxHours) {
                        sellerHasExceededHours = true;
                    }
                });

                if (sellerHasExceededDay) {
                    exceededKmCount++;
                }
                if (sellerHasExceededHours) {
                    exceededHoursCount++;
                }
            });

            const maxClientsOnSingleDay = Math.max(...Array.from(countsPerSellerAndDay.values()), 0);

            return {
                totalKm: Math.round(totalKm),
                totalTravelMinutes: Math.round(totalTravelMinutes),
                avgKmPerSeller: sellers.length ? Math.round(totalKm / sellers.length) : 0,
                avgMinutesPerSeller: sellers.length ? Math.round(totalTravelMinutes / sellers.length) : 0,
                maxClientsOnSingleDay,
                exceededKmCount,
                exceededHoursCount,
                sellerCount: sellers.length,
                clientCount: visits.length
            };
        };

        const orig = getKpisForSet(scopedOriginalRoutes);
        const adj = getKpisForSet(scopedAdjustedRoutes);

        const kmSaved = orig.totalKm - adj.totalKm;
        const percentSaved = orig.totalKm ? Math.round((kmSaved / orig.totalKm) * 100) : 0;

        const timeSavedMinutes = orig.totalTravelMinutes - adj.totalTravelMinutes;
        const percentTimeSaved = orig.totalTravelMinutes ? Math.round((timeSavedMinutes / orig.totalTravelMinutes) * 100) : 0;

        return {
            original: orig,
            adjusted: adj,
            kmSaved,
            percentSaved,
            timeSavedMinutes,
            percentTimeSaved
        };
    }, [scopedOriginalRoutes, scopedAdjustedRoutes, colaboradores, optMaxKm, optLimitKm, optMaxHours, optLimitHours, getClientServiceTime, channelServiceTimes]);

    // Reatribuir vendedor, dia de visita ou quinzena manualmente
    const handleManualReassign = (clientCode: number, targetSellerId: number, targetDay: string, targetPeriodicidade?: string) => {
        const targetColab = getColabBySectorOrName(targetSellerId);
        
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
                    const colab = getColabBySectorOrName(vendedorId, visits[0]?.Nome_Vendedor);
                    
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

    // Dados calculados do Itinerário Operacional do Dia Selecionado
    const currentItineraryData = useMemo(() => {
        if (!showItineraryModal) return null;

        const sellerList = availableSellers;
        const activeSellerId = itinerarySeller 
            ? Number(itinerarySeller) 
            : (sellerList.length > 0 ? sellerList[0].id : (scopedAdjustedRoutes[0]?.Cod_Vend || 0));
        const sellerVisits = scopedAdjustedRoutes.filter(r => r.Cod_Vend === activeSellerId);
        const colab = getColabBySectorOrName(activeSellerId, sellerVisits[0]?.Nome_Vendedor);

        // Filtra pelo dia e quinzena
        const dayVisits = sellerVisits.filter(v => {
            if (v.Dia_Semana !== itineraryDay) return false;
            const p = parsePeriodicidade(v.Periodicidade).tipo;
            if (itineraryQuinzena === '1_3') return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
            if (itineraryQuinzena === '2_4') return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
            return true;
        });

        const baseLat = colab?.LatitudeBase || sellerVisits.find(v => v.Lat)?.Lat || 0;
        const baseLng = colab?.LongitudeBase || sellerVisits.find(v => v.Long)?.Long || 0;
        const baseAddress = colab?.EnderecoBase || ((colab as any)?.Endereco ? `${(colab as any).Endereco}, ${(colab as any).Bairro || ''} - ${(colab as any).Cidade || ''}` : 'Base / Residência do Colaborador');

        let totalKm = 0;
        let prevLat = baseLat;
        let prevLng = baseLng;

        const stopsWithKm = dayVisits.map((v, idx) => {
            const curLat = v.Lat || 0;
            const curLng = v.Long || 0;
            const legKm = (prevLat && prevLng && curLat && curLng) ? Math.round(calcDist(prevLat, prevLng, curLat, curLng) * 1.18 * 10) / 10 : 0;
            totalKm += legKm;
            if (curLat && curLng) {
                prevLat = curLat;
                prevLng = curLng;
            }
            return {
                ...v,
                stopOrder: idx + 1,
                legKm,
                cumKm: Math.round(totalKm * 10) / 10
            };
        });

        const returnLegKm = (prevLat && prevLng && baseLat && baseLng && dayVisits.length > 0)
            ? Math.round(calcDist(prevLat, prevLng, baseLat, baseLng) * 1.18 * 10) / 10
            : 0;
        totalKm += returnLegKm;

        return {
            sellerId: activeSellerId,
            sellerName: colab?.Nome || sellerVisits[0]?.Nome_Vendedor || 'Colaborador',
            colab,
            day: itineraryDay,
            quinzena: itineraryQuinzena,
            baseLat,
            baseLng,
            baseAddress,
            stops: stopsWithKm,
            totalStops: stopsWithKm.length,
            totalKm: Math.round(totalKm * 10) / 10,
            returnLegKm
        };
    }, [showItineraryModal, scopedAdjustedRoutes, itinerarySeller, itineraryDay, itineraryQuinzena, availableSellers, colaboradores]);

    // Disparo para o Google Maps
    const handleOpenGoogleMaps = () => {
        if (!currentItineraryData || currentItineraryData.stops.length === 0) {
            alert("Sem paradas válidas no itinerário para traçar a rota.");
            return;
        }
        const { baseLat, baseLng, stops } = currentItineraryData;
        const validStops = stops.filter(s => s.Lat && s.Long);
        if (validStops.length === 0) {
            alert("Nenhuma coordenada geográfica válida encontrada para navegação.");
            return;
        }

        const origin = (baseLat && baseLng) ? `${baseLat},${baseLng}` : `${validStops[0].Lat},${validStops[0].Long}`;
        const destination = (baseLat && baseLng) ? `${baseLat},${baseLng}` : `${validStops[validStops.length - 1].Lat},${validStops[validStops.length - 1].Long}`;
        const waypoints = validStops.slice(0, 8).map(s => `${s.Lat},${s.Long}`).join('|');

        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Disparo para o Waze (primeira parada do roteiro ou parada selecionada)
    const handleOpenWaze = (stopLat?: number, stopLng?: number) => {
        const lat = stopLat || currentItineraryData?.stops[0]?.Lat;
        const lng = stopLng || currentItineraryData?.stops[0]?.Long;
        if (!lat || !lng) {
            alert("Coordenada não disponível para abrir no Waze.");
            return;
        }
        const url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Copiar itinerário textual formatado para WhatsApp
    const handleCopyItinerary = () => {
        if (!currentItineraryData) return;
        const { sellerName, day, quinzena, totalStops, totalKm, baseAddress, stops, returnLegKm } = currentItineraryData;

        let text = `🚗 *ROTEIRO DE VISITAS - ${sellerName.toUpperCase()}*\n`;
        text += `📅 *${day}* (${quinzena === '1_3' ? 'Semanas 1 e 3' : 'Semanas 2 e 4'})\n`;
        text += `📍 *${totalStops} Paradas* | Estimativa Total: *${totalKm} KM*\n`;
        text += `----------------------------------------\n`;
        text += `🏠 *Partida:* ${baseAddress}\n\n`;

        stops.forEach(s => {
            text += `*#${s.stopOrder}* [${s.Cod_Cliente}] ${s.Razao_Social}\n`;
            text += `   📍 ${s.Endereco}\n`;
            text += `   📏 +${s.legKm} KM (Acumulado: ${s.cumKm} KM)\n\n`;
        });

        text += `🏁 *Retorno:* ${baseAddress} (+${returnLegKm} KM)\n`;
        text += `----------------------------------------\n`;
        text += `Gerado automaticamente pelo Fuel360`;

        navigator.clipboard.writeText(text);
        setCopiedItinerary(true);
        setTimeout(() => setCopiedItinerary(false), 3000);
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
                                <SearchableSellerSelect
                                    sellers={availableSellers}
                                    value={selectedSeller}
                                    onChange={(val) => {
                                        setSelectedSeller(val);
                                        setSelectedPromoter('ALL');
                                    }}
                                />
                            </div>
                        )}

                        <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/60 flex items-center">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                            {Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend))).length} Colaborador(es) • {scopedAdjustedRoutes.length} PDVs em foco
                        </div>

                        <div className="flex items-center space-x-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setSourceSectorToExtinguish('');
                                    setTargetSectorsSelected([]);
                                    setShowExtinguishModal(true);
                                }}
                                disabled={loading || adjustedRoutes.length === 0}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-xs transition cursor-pointer disabled:opacity-50"
                                title="Simular a extinção de um setor e redistribuir sua carteira para os demais setores selecionados com balanceamento equilibrado"
                            >
                                <UserGroupIcon className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400"/>
                                Redistribuir Setor Extinto
                            </button>
                            {backupRoutesBeforeExtinguish && (
                                <button
                                    type="button"
                                    onClick={handleUndoExtinguish}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center shadow-xs transition cursor-pointer"
                                    title="Restaurar a carteira do setor extinto de volta ao estado original"
                                >
                                    ↩️ Desfazer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* BANNER DE FEEDBACK DE REDISTRIBUIÇÃO DE SETOR */}
            {extinguishFeedback && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center space-x-3">
                        <span className="text-xl">⚡</span>
                        <div>
                            <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                Setor {extinguishFeedback.sourceId} ({extinguishFeedback.sourceName}) Extinto e Redistribuído!
                                <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                    {extinguishFeedback.totalMoved} clientes transferidos
                                </span>
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                                {extinguishFeedback.breakdown.map(b => (
                                    <span key={b.targetId} className="bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md font-semibold border border-amber-200 dark:border-amber-800/50">
                                        Setor {b.targetId} ({b.targetName}): <b className="text-indigo-600 dark:text-indigo-400">+{b.count} clientes</b>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleUndoExtinguish}
                            className="bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-200 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer shadow-2xs"
                        >
                            ↩️ Desfazer Redistribuição
                        </button>
                        <button
                            type="button"
                            onClick={() => setExtinguishFeedback(null)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg text-xs cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* PAINEL CENTRAL: KPIS E COMPARATIVO COM TEMPO DE DESLOCAMENTO */}
            {adjustedRoutes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

                    {/* KPI 2: Tempo Total em Deslocamento */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider flex items-center">
                                <ClockIcon className="w-3.5 h-3.5 mr-1 text-indigo-500"/> Tempo em Trânsito
                            </span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{formatDuration(kpis.adjusted.totalTravelMinutes)}</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{formatDuration(kpis.original.totalTravelMinutes)}</span>
                            </div>
                        </div>
                        {kpis.timeSavedMinutes > 0 ? (
                            <div className="mt-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                ⚡ -{formatDuration(kpis.timeSavedMinutes)} ({kpis.percentTimeSaved}%)
                            </div>
                        ) : (
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-2">Circuito base-clientes-base calibrado.</p>
                        )}
                    </div>

                    {/* KPI 3: Média KM / Colaborador */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Média / Colaborador</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{kpis.adjusted.avgKmPerSeller} KM</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">~{formatDuration(kpis.adjusted.avgMinutesPerSeller)}</span>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Distribuído entre {kpis.adjusted.sellerCount} colaboradores ativos.</p>
                    </div>

                    {/* KPI 4: Carga de Clientes (Equilíbrio) */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">Pico de Clientes / Dia</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800 dark:text-white">{kpis.adjusted.maxClientsOnSingleDay} PDVs</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">Máx: {optMaxClients}</span>
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

                    {/* KPI 5: Alertas de Distância e Jornada */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between transition-colors">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-400 tracking-wider">
                                {optLimitKm || optLimitHours ? 'Limites de Rota' : 'Limite Diário'}
                            </span>
                            <div className="flex flex-col space-y-1 mt-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-500 dark:text-slate-400">KM:</span>
                                    {optLimitKm ? (
                                        <span className={`font-black ${kpis.adjusted.exceededKmCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {kpis.adjusted.exceededKmCount > 0 ? `${kpis.adjusted.exceededKmCount} > ${optMaxKm}km` : `Máx ${optMaxKm}km (OK)`}
                                        </span>
                                    ) : (
                                        <span className="font-bold text-slate-400">Livre</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-slate-500 dark:text-slate-400">Jornada:</span>
                                    {optLimitHours ? (
                                        <span className={`font-black ${kpis.adjusted.exceededHoursCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                            {kpis.adjusted.exceededHoursCount > 0 ? `${kpis.adjusted.exceededHoursCount} > ${optMaxHours}h` : `Máx ${optMaxHours}h (OK)`}
                                        </span>
                                    ) : (
                                        <span className="font-bold text-slate-400">Livre</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="mt-2">
                            {(!optLimitKm && !optLimitHours) ? (
                                <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                    <CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> Otimização Livre
                                </div>
                            ) : (kpis.adjusted.exceededKmCount > 0 || kpis.adjusted.exceededHoursCount > 0) ? (
                                <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                    <ExclamationIcon className="w-3.5 h-3.5 mr-1"/> Necessita Ajuste
                                </div>
                            ) : (
                                <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/60 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                    <CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> Carga Equilibrada
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ABAIXO: MAPA E SIDEBAR DE AJUSTES */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
                {/* COLUNA ESQUERDA: PARÂMETROS E LISTA DE AJUSTES */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col space-y-4 overflow-y-auto custom-scrollbar shadow-sm transition-colors">
                    {/* PARÂMETROS DO ROTEIRIZADOR (AGRUPADOS E ORGANIZADOS) */}
                    <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center">
                                <CogIcon className="w-4 h-4 mr-1 text-indigo-600"/> Parâmetros do Otimizador
                            </h4>
                        </div>
                        
                        {/* BLINDAGEM DE CARTEIRA (COMPACTO) */}
                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl p-2 text-[10px] text-indigo-700 dark:text-indigo-300 flex items-start space-x-1.5">
                            <CheckCircleIcon className="w-3.5 h-3.5 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0"/>
                            <div>
                                <span className="font-black block">Carteira Blindada por Vendedor</span>
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight block">
                                    Clientes pertencem exclusivamente ao vendedor. Periodicidades preservadas.
                                </span>
                            </div>
                        </div>

                        {/* GRUPO 1: LIMITES DIÁRIOS (CLIENTES, KM E HORAS) */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 space-y-2.5">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                ⏱️ Limites Diários por Rota
                            </span>

                            {/* Clientes Máximo / Dia */}
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                    Clientes Máx. / Dia:
                                </label>
                                <input 
                                    type="number" 
                                    value={optMaxClients} 
                                    onChange={(e) => setOptMaxClients(Math.max(1, Number(e.target.value)))}
                                    className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-xs font-black text-right outline-none text-slate-800 dark:text-white"
                                />
                            </div>

                            {/* KM Máximo Rota / Dia com Liga/Desliga */}
                            <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center space-x-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={optLimitKm} 
                                            onChange={(e) => setOptLimitKm(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                            Limitar KM / Dia:
                                        </span>
                                    </label>
                                    <div className="flex items-center space-x-1">
                                        <input 
                                            type="number" 
                                            value={optMaxKm} 
                                            disabled={!optLimitKm}
                                            onChange={(e) => setOptMaxKm(Number(e.target.value))}
                                            className={`w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-xs font-black text-right outline-none text-slate-800 dark:text-white transition-opacity ${!optLimitKm ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        />
                                        <span className="text-[10px] font-bold text-slate-400">km</span>
                                    </div>
                                </div>
                            </div>

                            {/* NOVO: Horas Máximas da Rota / Dia com Liga/Desliga */}
                            <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center space-x-1.5 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={optLimitHours} 
                                            onChange={(e) => setOptLimitHours(e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                            Limitar Horas / Dia:
                                        </span>
                                    </label>
                                    <div className="flex items-center space-x-1">
                                        <input 
                                            type="number" 
                                            value={optMaxHours} 
                                            disabled={!optLimitHours}
                                            step={0.5}
                                            min={1}
                                            max={24}
                                            onChange={(e) => setOptMaxHours(Number(e.target.value))}
                                            className={`w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-xs font-black text-right outline-none text-slate-800 dark:text-white transition-opacity ${!optLimitHours ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        />
                                        <span className="text-[10px] font-bold text-slate-400">h</span>
                                    </div>
                                </div>
                                <span className="text-[8.5px] text-slate-400 dark:text-slate-500 block">
                                    Inclui deslocamento viário + atendimento médio nos clientes
                                </span>

                                {/* Configuração de Tempos por Canal no Banco de Dados */}
                                <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                    <button
                                        type="button"
                                        onClick={() => setShowChannelTimesModal(true)}
                                        className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg border text-[10px] font-black transition cursor-pointer shadow-2xs ${
                                            channelsInUseWithAlerts.length > 0
                                                ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                                                : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300'
                                        }`}
                                        title={channelsInUseWithAlerts.length > 0 ? `Atenção: ${channelsInUseWithAlerts.length} canal(is) em uso na rota possuem pendências!` : 'Configurar permanência em minutos por Canal de Remuneração (salvo no SQL Server corporativo)'}
                                    >
                                        <div className="flex items-center space-x-1.5">
                                            <ClockIcon className={`w-3.5 h-3.5 ${channelsInUseWithAlerts.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                                            <span>Tempos por Canal ({allDisplayChannels.length})</span>
                                        </div>
                                        {channelsInUseWithAlerts.length > 0 && (
                                            <span className="flex items-center gap-1 text-[8.5px] font-black text-amber-700 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/80 px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 animate-pulse">
                                                <ExclamationIcon className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                                {channelsInUseWithAlerts.length} pendente{channelsInUseWithAlerts.length > 1 ? 's' : ''}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* GRUPO 2: CALENDÁRIO OPERACIONAL E DIAS ATIVOS */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-2.5 space-y-2">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                📅 Calendário & Jornada
                            </span>

                            {/* Dias Ativos em Chips Elegantes */}
                            <div>
                                <label className="block text-[9.5px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                                    Dias de Atendimento Ativos:
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                    {WEEKDAYS.map(day => {
                                        const shortName = day.split('-')[0].slice(0, 3);
                                        const isActive = optDays.includes(day);
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => {
                                                    if (isActive) {
                                                        if (optDays.length > 1) setOptDays(optDays.filter(d => d !== day));
                                                    } else {
                                                        setOptDays([...optDays, day]);
                                                    }
                                                }}
                                                className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all text-center cursor-pointer border ${
                                                    isActive
                                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs font-black'
                                                        : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                {shortName}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Toggles Rápidos */}
                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                        Sábado Meio-Período
                                    </span>
                                    <input 
                                        type="checkbox" 
                                        checked={optSatHalfPeriod} 
                                        onChange={(e) => setOptSatHalfPeriod(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 block">
                                            Equilibrar Quinzenas
                                        </span>
                                        <span className="text-[8px] text-slate-400 block">
                                            Equaliza Sem 1/3 e Sem 2/4
                                        </span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={optBalanceWorkload} 
                                        onChange={(e) => setOptBalanceWorkload(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* BOTÕES DE AÇÃO */}
                        <div className="pt-1 space-y-1.5">
                            <button
                                onClick={handleOptimizeSimulate}
                                disabled={loading || adjustedRoutes.length === 0}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black p-2.5 rounded-xl text-xs flex items-center justify-center shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                            >
                                <RefreshIcon className="w-4 h-4 mr-1.5"/> Otimizar Rotas
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setSourceSectorToExtinguish('');
                                    setTargetSectorsSelected([]);
                                    setShowExtinguishModal(true);
                                }}
                                disabled={loading || adjustedRoutes.length === 0}
                                className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold p-2 rounded-xl text-xs flex items-center justify-center shadow-2xs transition cursor-pointer disabled:opacity-50"
                                title="Simular a extinção de um setor e redistribuir sua carteira para os demais setores selecionados com balanceamento equilibrado"
                            >
                                <UserGroupIcon className="w-4 h-4 mr-1.5 text-amber-600 dark:text-amber-400"/>
                                Redistribuir Setor Extinto
                            </button>
                        </div>
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
                                    const sellerVisits = scopedAdjustedRoutes.filter(v => v.Cod_Vend === sellerId);
                                    const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);
                                    const count = sellerVisits.length;
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
                    <div 
                        id="roteiro-map-container"
                        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-300 flex flex-col ${
                        isMapFullscreen 
                            ? 'fixed inset-0 z-[1100] w-screen h-screen rounded-none' 
                            : 'relative isolate rounded-2xl h-96 z-10'
                    }`}>
                        <div className="absolute top-3 left-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md z-[1000] text-xs font-bold text-slate-800 dark:text-white flex items-center">
                            <GlobeIcon className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400 animate-pulse"/> Visão Espacial do Ajuste
                        </div>

                        {/* CONTROLES FLUTUANTES DO MAPA: ALTERNADOR RÁPIDO DE QUINZENA, HEATMAP E TELA CHEIA */}
                        <div className="absolute top-3 right-3 z-[1000] flex flex-wrap items-center gap-2">
                            {scopedAdjustedRoutes.length > 0 && (
                                <>
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
                                </>
                            )}

                            {/* Botão Maximizar / Tela Cheia */}
                            <button
                                type="button"
                                onClick={() => setIsMapFullscreen(prev => !prev)}
                                className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md border transition-all duration-200 bg-white/95 dark:bg-slate-900/95 backdrop-blur text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                title={isMapFullscreen ? "Recolher Mapa em Tela Cheia (ESC)" : "Expandir Mapa em Tela Cheia"}
                            >
                                {isMapFullscreen ? (
                                    <>
                                        <ArrowsCompressIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        <span>Recolher</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowsExpandIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                        <span>Tela Cheia</span>
                                    </>
                                )}
                            </button>
                        </div>
                        {scopedAdjustedRoutes.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500">
                                <LocationMarkerIcon className="w-12 h-12 mb-2 text-slate-300"/>
                                <p className="text-sm font-semibold">Carregue ou importe um roteiro para visualizar o mapa</p>
                            </div>
                        ) : (
                            <MapContainer 
                                center={[-23.5505, -46.6333]} 
                                zoom={12} 
                                style={{ width: '100%', height: '100%', zIndex: 0 }}
                            >
                                <MapResizeHandler isFullscreen={isMapFullscreen} />
                                <MapFlyToHandler target={mapFlyToTarget} markerRefs={markerRefs} />
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; OpenStreetMap contributors'
                                />

                                {/* Camada de Mapa de Calor (Heatmap de Concentração de Visitas) */}
                                {showHeatmap && <HeatmapLayer points={heatmapPoints} />}
                                {/* Casas / Bases dos Colaboradores com Destaque Especial */}
                                {Array.from(new Set(scopedAdjustedRoutes.map(v => v.Cod_Vend))).map(vId => {
                                    const vVisits = scopedAdjustedRoutes.filter(v => v.Cod_Vend === vId);
                                    const colab = getColabBySectorOrName(vId, vVisits[0]?.Nome_Vendedor);
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

                                {/* Polilinhas das rotas otimizadas com transição visual animada e Popup Interativo */}
                                {adjustedPolylines.map((line: any, idx) => (
                                    <Polyline 
                                        key={`adj-poly-${line.id || idx}`} 
                                        positions={line.points} 
                                        color={line.color} 
                                        weight={showHeatmap ? 2.5 : 5} 
                                        opacity={showHeatmap ? 0.35 : 0.85} 
                                        pathOptions={{
                                            className: 'transition-all duration-500 ease-in-out cursor-pointer'
                                        }}
                                    >
                                        <Popup>
                                            <div className="p-2 min-w-[210px] text-xs font-sans">
                                                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                                                    <span 
                                                        className="px-2 py-0.5 rounded text-[10px] font-black text-white" 
                                                        style={{ backgroundColor: line.color }}
                                                    >
                                                        {line.day || 'ROTA'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-500">
                                                        {selectedQuinzenaFilter === 'ALL' ? 'Todas as Semanas' : (selectedQuinzenaFilter === '1_3' ? 'Sem 1 e 3' : 'Sem 2 e 4')}
                                                    </span>
                                                </div>
                                                <div className="text-slate-800 font-bold mb-2 truncate">
                                                    {line.sellerName}
                                                </div>
                                                <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg text-center mb-2">
                                                    <div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase">PDVs</div>
                                                        <div className="font-black text-indigo-600 text-xs">{line.stopsCount || 0}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase">Distância</div>
                                                        <div className="font-black text-slate-700 text-xs">{line.distKm || 0} km</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase">Tempo</div>
                                                        <div className="font-black text-slate-700 text-xs">
                                                            {Math.floor((line.durationMin || 0) / 60)}h {(line.durationMin || 0) % 60}m
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (line.day) setItineraryDay(line.day);
                                                        if (line.sellerId) setItinerarySeller(String(line.sellerId));
                                                        setShowItineraryModal(true);
                                                    }}
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-2 rounded-lg text-[10px] flex items-center justify-center transition cursor-pointer"
                                                >
                                                    <ClipboardListIcon className="w-3.5 h-3.5 mr-1" /> Ver Itinerário Detalhado
                                                </button>
                                            </div>
                                        </Popup>
                                    </Polyline>
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
                                            ref={(el) => {
                                                if (el) {
                                                    markerRefs.current[v.Cod_Cliente] = el;
                                                }
                                            }}
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
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            {v.Endereco}{v.Cidade ? ` • ${v.Cidade}` : ''}
                                                        </p>
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

                                                    {/* Botão para navegar até o cliente na Grade de Ajuste Fino sob demanda */}
                                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleScrollToPdvInTable(v.Cod_Cliente)}
                                                            className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/90 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                                            title="Localizar e rolar até este cliente na Grade de Ajuste Fino"
                                                        >
                                                            <ClipboardListIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                                            <span>Ver na Tabela</span>
                                                        </button>
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
                            {/* CABEÇALHO DA GRADE: DUAS FAIXAS BEM DEFINIDAS */}
                            <div className="space-y-2.5 mb-3">
                                {/* FAIXA 1: TÍTULO E AÇÕES PRINCIPAIS */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center space-x-2">
                                        <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center shrink-0">
                                            <ClipboardListIcon className="w-4 h-4 mr-1.5 text-indigo-600"/> Grade de Ajuste Fino
                                        </h3>
                                        <span className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800">
                                            {scopedAdjustedRoutes.length} visitas
                                        </span>
                                    </div>

                                    {/* BOTÕES DE AÇÃO COM WRAP SUAVE E ALINHAMENTO IMPECÁVEL */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => setShowSummaryModal(true)}
                                            disabled={scopedAdjustedRoutes.length === 0}
                                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 dark:text-blue-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center border border-blue-200 dark:border-blue-800 shadow-2xs transition h-[32px] disabled:opacity-50 cursor-pointer"
                                            title="Visualizar o resumo operacional consolidado de KM, tempo em trânsito e balanceamento diário e quinzenal"
                                        >
                                            <ChartBarIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400"/>
                                            Resumo KM & Tempo
                                        </button>
                                        <button
                                            onClick={() => setShowItineraryModal(true)}
                                            disabled={scopedAdjustedRoutes.length === 0}
                                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center border border-emerald-200 dark:border-emerald-800 shadow-2xs transition h-[32px] disabled:opacity-50 cursor-pointer"
                                            title="Visualizar a sequência cronológica da rota do dia com links de navegação para Google Maps e Waze"
                                        >
                                            <LocationMarkerIcon className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400"/>
                                            Itinerário do Dia
                                        </button>
                                        <button
                                            onClick={() => setShowCompareModal(true)}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center border border-indigo-200 dark:border-indigo-800 shadow-2xs transition h-[32px]"
                                            title="Comparar a rota original com a rota ajustada antes de salvar"
                                        >
                                            <PresentationChartLineIcon className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400"/>
                                            Comparativo
                                            {routeComparisonDiff.totalChanged > 0 && (
                                                <span className="ml-1.5 bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                                                    {routeComparisonDiff.totalChanged}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            onClick={handleExportExcel}
                                            className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-2xs transition h-[32px]"
                                            title="Exportar planilha Excel estruturada com abas consolidadas e por equipe/colaborador conforme o escopo selecionado"
                                        >
                                            <UploadIcon className="w-3.5 h-3.5 mr-1.5 rotate-180"/> Exportar Excel (em Abas)
                                        </button>
                                        <button
                                            onClick={handleSaveDatabase}
                                            disabled={saving}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-1.5 rounded-xl text-xs flex items-center shadow-md hover:shadow-lg transition h-[32px] disabled:opacity-50 cursor-pointer"
                                        >
                                            {saving ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5"/>}
                                            Salvar Simulação
                                        </button>
                                    </div>
                                </div>

                                {/* FAIXA 2: BARRA DE FILTROS E NAVEGAÇÃO RÁPIDA (DIAS DA SEMANA E QUINZENA) */}
                                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 dark:bg-slate-800/40 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                                    {/* FILTRO DE DIAS DA SEMANA */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 flex items-center">
                                            Dias:
                                        </span>
                                        {WEEKDAYS.map(day => {
                                            const shortName = day.split('-')[0].slice(0, 3);
                                            const count = visitsByDay[day] || 0;
                                            const isSelected = selectedDaysFilter.includes(day);
                                            const hasAnySelected = selectedDaysFilter.length > 0;
                                            const dayCfg = DAY_COLORS[day] || { hex: '#4f46e5', label: shortName, bg: 'bg-indigo-600' };
                                            const dayMetrics = operationalSummary.dayMap[day];
                                            const displayKm = selectedQuinzenaFilter === '1_3' 
                                                ? dayMetrics?.km13 
                                                : (selectedQuinzenaFilter === '2_4' 
                                                    ? dayMetrics?.km24 
                                                    : (dayMetrics?.km13 || dayMetrics?.km24 || 0));

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
                                                    title={`Clique para filtrar ${day}. Total: ${count} atendimentos${displayKm ? ` • ~${displayKm} km estimados` : ''}`}
                                                >
                                                    <span className="uppercase font-semibold">{shortName}:</span>
                                                    <span className={isSelected ? 'text-white font-black' : 'text-indigo-600 dark:text-indigo-400 font-black'}>
                                                        {count}
                                                    </span>
                                                    {Boolean(displayKm && displayKm > 0) && (
                                                        <span className={`text-[9px] font-semibold ml-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'}`}>
                                                            • {displayKm}km
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}

                                        {selectedDaysFilter.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleClearDayFilter}
                                                className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-2xs"
                                                title="Limpar filtro de dias e exibir a semana completa"
                                            >
                                                Todos os Dias
                                            </button>
                                        )}
                                    </div>

                                    {/* TOTALIZADORES E FILTROS POR QUINZENA (SEMANAS 1/3 E 2/4) */}
                                    <div className="flex flex-wrap items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-1.5 sm:pt-0 sm:pl-2">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1">
                                            Ciclo:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedQuinzenaFilter('ALL')}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                                                selectedQuinzenaFilter === 'ALL'
                                                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-2xs font-black'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            Todas ({quinzenaTotals.semanalCount + quinzenaTotals.quinzenal13Count + quinzenaTotals.quinzenal24Count})
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setSelectedQuinzenaFilter(prev => prev === '1_3' ? 'ALL' : '1_3')}
                                            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all active:scale-95 cursor-pointer border ${
                                                selectedQuinzenaFilter === '1_3'
                                                    ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-400 ring-offset-1 font-black shadow-sm'
                                                    : selectedQuinzenaFilter !== 'ALL'
                                                        ? 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40 opacity-50 hover:opacity-100'
                                                        : 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 font-bold'
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
                                                        : 'bg-white dark:bg-slate-900 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/60 hover:bg-fuchsia-50 font-bold'
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
                                    </div>
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
                                                    <span>Endereço / Cidade</span>
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
                                                    const visitSeq = visitOrderMap.get(`${v.Cod_Vend}-${v.Dia_Semana}-${v.Cod_Cliente}`);
                                                    return (
                                                        <tr 
                                                            key={`${v.Cod_Cliente}-${i}`} 
                                                            id={`row-pdv-${v.Cod_Cliente}`}
                                                            onClick={(e) => {
                                                                const target = e.target as HTMLElement;
                                                                if (target.closest('select') || target.closest('button') || target.closest('input')) {
                                                                    return;
                                                                }
                                                                handleFocusClientOnMap(v);
                                                            }}
                                                            title="Clique na linha para focar este cliente no mapa"
                                                            className={`transition-all duration-300 cursor-pointer ${
                                                                isHighlighted 
                                                                    ? 'bg-indigo-100/90 dark:bg-indigo-950/90 ring-2 ring-indigo-500 ring-inset shadow-md font-black' 
                                                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                                                            }`}
                                                        >
                                                            <td className="p-3 text-slate-900 dark:text-white font-mono">
                                                                <div className="flex items-center gap-1.5">
                                                                    {visitSeq && (
                                                                        <span 
                                                                            className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0" 
                                                                            title={`Ordem da Parada: ${visitSeq.order}ª parada de ${visitSeq.total} no roteiro de ${v.Dia_Semana}`}
                                                                        >
                                                                            #{visitSeq.order}
                                                                        </span>
                                                                    )}
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
                                                            <td 
                                                                className="p-3 text-slate-500 dark:text-slate-400 max-w-[240px]" 
                                                                title={`${v.Endereco || ''}${v.Bairro ? `, ${v.Bairro}` : ''}${v.Cidade ? ` - ${v.Cidade}` : ''}`}
                                                            >
                                                                <div className="truncate text-slate-700 dark:text-slate-200 font-medium">{v.Endereco || '-'}</div>
                                                                {v.Cidade && (
                                                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1 font-normal mt-0.5">
                                                                        <span className="text-[11px] text-indigo-500 shrink-0">📍</span>
                                                                        <span className="truncate">{v.Bairro ? `${v.Bairro} • ` : ''}{v.Cidade}</span>
                                                                    </div>
                                                                )}
                                                            </td>
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
                                                                <div className="flex items-center justify-center space-x-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleFocusClientOnMap(v);
                                                                        }}
                                                                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg cursor-pointer"
                                                                        title="Focar e abrir cliente no mapa"
                                                                    >
                                                                        <LocationMarkerIcon className="w-4 h-4"/>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleExcludeVisit(v.Cod_Cliente);
                                                                        }}
                                                                        className="text-rose-500 hover:text-rose-700 transition p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                                                                        title="Excluir Visita"
                                                                    >
                                                                        <TrashIcon className="w-4.5 h-4.5"/>
                                                                    </button>
                                                                </div>
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
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
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
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
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
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
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

                                {/* Métrica 2: Tempo Total em Deslocamento */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Tempo em Trânsito</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatDuration(kpis.adjusted.totalTravelMinutes)}</span>
                                        <span className="text-xs text-slate-400 line-through">{formatDuration(kpis.original.totalTravelMinutes)}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1 ${kpis.timeSavedMinutes >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                        {kpis.timeSavedMinutes > 0 ? `⚡ -${formatDuration(kpis.timeSavedMinutes)} (-${kpis.percentTimeSaved}%)` : 'Otimizado em circuito'}
                                    </span>
                                </div>

                                {/* Métrica 3: Média KM / Colaborador */}
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

                                {/* Métrica 4: Clientes Alterados */}
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

                                {/* Métrica 5: Vendedores Desbalanceados */}
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

            {/* MODAL DE ITINERÁRIO OPERACIONAL PASSO A PASSO COM GOOGLE MAPS E WAZE */}
            {showItineraryModal && currentItineraryData && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header do Modal */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                    <LocationMarkerIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center">
                                        Itinerário Operacional do Dia
                                        <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                            Circuito Otimizado
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Sequência cronológica de atendimento partindo da base residencial com links de navegação em tempo real.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowItineraryModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Filtros Rápidos no Topo do Modal */}
                        <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Seletor de Colaborador */}
                                {availableSellers.length > 1 && (
                                    <div className="flex items-center space-x-1.5">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Colaborador:</span>
                                        <select
                                            value={currentItineraryData.sellerId}
                                            onChange={e => setItinerarySeller(e.target.value)}
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                                        >
                                            {availableSellers.map(s => (
                                                <option key={s.id} value={s.id}>{s.id} - {s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Seletor de Dia da Semana */}
                                <div className="flex items-center space-x-1">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Dia:</span>
                                    {WEEKDAYS.map(day => {
                                        const isSelected = day === itineraryDay;
                                        const shortName = day.split('-')[0].slice(0, 3);
                                        return (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => setItineraryDay(day)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {shortName}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Seletor de Quinzena */}
                                <div className="flex items-center space-x-1">
                                    <button
                                        type="button"
                                        onClick={() => setItineraryQuinzena('1_3')}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                            itineraryQuinzena === '1_3'
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300'
                                        }`}
                                    >
                                        Sem 1/3
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setItineraryQuinzena('2_4')}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                            itineraryQuinzena === '2_4'
                                                ? 'bg-fuchsia-600 text-white'
                                                : 'bg-white dark:bg-slate-800 text-fuchsia-800 dark:text-fuchsia-300'
                                        }`}
                                    >
                                        Sem 2/4
                                    </button>
                                </div>
                            </div>

                            {/* Resumo de KM e Paradas */}
                            <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-500">
                                    {currentItineraryData.totalStops} clientes no roteiro
                                </span>
                                <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black px-2.5 py-0.5 rounded-full text-xs">
                                    ~{currentItineraryData.totalKm} KM Total
                                </span>
                            </div>
                        </div>

                        {/* Corpo com Scroll: Timeline das Paradas */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                            {currentItineraryData.stops.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <p className="font-bold text-sm">Nenhum cliente agendado para {itineraryDay} nesta quinzena.</p>
                                    <p className="text-xs mt-1">Selecione outro dia da semana ou quinzena acima.</p>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
                                    {/* PONTO 0: SAÍDA DA BASE */}
                                    <div className="relative">
                                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shadow-md">
                                            🏠
                                        </div>
                                        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-3.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">
                                                    Partida (Circuito Fechado)
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400">0.0 KM</span>
                                            </div>
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                                Base Residencial do Colaborador ({currentItineraryData.sellerName})
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {currentItineraryData.baseAddress}
                                            </p>
                                        </div>
                                    </div>

                                    {/* PARADAS DO ITINERÁRIO */}
                                    {currentItineraryData.stops.map(stop => (
                                        <div key={stop.Cod_Cliente} className="relative">
                                            <div className="absolute -left-[33px] top-1.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-black shadow-md">
                                                {stop.stopOrder}
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 hover:border-emerald-400 transition">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                            #{stop.stopOrder} • PDV {stop.Cod_Cliente}
                                                        </span>
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                            {stop.Periodicidade}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center space-x-1.5 shrink-0">
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                            +{stop.legKm} KM
                                                        </span>
                                                        <button
                                                            onClick={() => handleOpenWaze(stop.Lat, stop.Long)}
                                                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 transition cursor-pointer"
                                                            title="Abrir este destino no Waze"
                                                        >
                                                            Waze
                                                        </button>
                                                    </div>
                                                </div>
                                                <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1">
                                                    {stop.Razao_Social}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                    {stop.Endereco}
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* PONTO FINAL: RETORNO À BASE */}
                                    <div className="relative">
                                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-md">
                                            🏁
                                        </div>
                                        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                                    Retorno à Origem
                                                </span>
                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                                    +{currentItineraryData.returnLegKm} KM (Total: {currentItineraryData.totalKm} KM)
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                                Retorno à Base / Residência
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {currentItineraryData.baseAddress}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer de Ações do Itinerário */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                {currentItineraryData.totalStops > 0 
                                    ? `Roteiro sequenciado com menor deslocamento viário real.` 
                                    : 'Sem paradas para exibir.'}
                            </span>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleCopyItinerary}
                                    disabled={currentItineraryData.stops.length === 0}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center"
                                    title="Copiar itinerário formatado em texto para colar no WhatsApp"
                                >
                                    {copiedItinerary ? '✅ Itinerário Copiado!' : '📋 Copiar p/ WhatsApp'}
                                </button>
                                <button
                                    onClick={() => handleOpenWaze()}
                                    disabled={currentItineraryData.stops.length === 0}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center"
                                    title="Abrir navegação no Waze"
                                >
                                    Abrir no Waze
                                </button>
                                <button
                                    onClick={handleOpenGoogleMaps}
                                    disabled={currentItineraryData.stops.length === 0}
                                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition cursor-pointer disabled:opacity-50 flex items-center"
                                    title="Abrir rota completa com waypoints ordenados no Google Maps"
                                >
                                    🗺️ Navegar no Google Maps
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE RESUMO OPERACIONAL DE ROTAS (KM, TEMPO E BALANCEAMENTO) */}
            {showSummaryModal && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                    <ChartBarIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Resumo Operacional de Rotas
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                            Consolidado KM & Tempo
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Detalhamento diário e quinzenal com projeção de quilometragem e tempo em trânsito (Base ↔ PDVs ↔ Base).
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* KPIs Rápidos */}
                        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Carteira Ativa</span>
                                <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                    {operationalSummary.uniqueClientsCount} <span className="text-xs font-normal text-slate-500">PDVs</span>
                                </div>
                                <span className="text-[9px] text-slate-500">
                                    {operationalSummary.semanalCount} Sem. • {operationalSummary.quinzenal13Count + operationalSummary.quinzenal24Count} Quinz.
                                </span>
                            </div>

                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Semanas 1 e 3</span>
                                    <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1 rounded">1/3</span>
                                </div>
                                <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                    {operationalSummary.totalPdvs13} <span className="text-xs font-normal text-slate-500">visitas</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-500">
                                    ~{operationalSummary.totalKm13} km • {Math.floor(operationalSummary.totalTime13 / 60)}h {operationalSummary.totalTime13 % 60}m
                                </span>
                            </div>

                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-fuchsia-200 dark:border-fuchsia-800/50 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-fuchsia-600 dark:text-fuchsia-400">Semanas 2 e 4</span>
                                    <span className="text-[9px] font-black bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 px-1 rounded">2/4</span>
                                </div>
                                <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                    {operationalSummary.totalPdvs24} <span className="text-xs font-normal text-slate-500">visitas</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-500">
                                    ~{operationalSummary.totalKm24} km • {Math.floor(operationalSummary.totalTime24 / 60)}h {operationalSummary.totalTime24 % 60}m
                                </span>
                            </div>

                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Balanceamento</span>
                                <div className="flex items-center space-x-1 mt-0.5">
                                    <span className={`text-lg font-black ${operationalSummary.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {operationalSummary.imbalancePct}%
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">var.</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-500">
                                    {operationalSummary.isBalanced ? '✅ Carga Equalizada' : '⚠️ Variação acima de 15%'}
                                </span>
                            </div>
                        </div>

                        {/* Corpo com Tabela Detalhada */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <th className="pb-2.5">Dia da Semana</th>
                                        <th className="pb-2.5 text-center text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 rounded-t">Sem 1/3 (PDVs)</th>
                                        <th className="pb-2.5 text-center text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2">Sem 1/3 (KM)</th>
                                        <th className="pb-2.5 text-center text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 rounded-t">Sem 1/3 (Tempo)</th>
                                        <th className="pb-2.5 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 px-2 rounded-t">Sem 2/4 (PDVs)</th>
                                        <th className="pb-2.5 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 px-2">Sem 2/4 (KM)</th>
                                        <th className="pb-2.5 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50/50 dark:bg-fuchsia-950/20 px-2 rounded-t">Sem 2/4 (Tempo)</th>
                                        <th className="pb-2.5 text-center">Média Diária</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {operationalSummary.daysMetrics.map(item => {
                                        const cfg = DAY_COLORS[item.day] || { hex: '#4f46e5', label: item.day, bg: 'bg-indigo-600' };
                                        return (
                                            <tr key={item.day} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                <td className="py-3 font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.hex }}/>
                                                    <span>{item.day}</span>
                                                </td>
                                                <td className="py-3 text-center font-black text-amber-700 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-950/10">
                                                    {item.pdvs13}
                                                </td>
                                                <td className="py-3 text-center text-slate-600 dark:text-slate-300 bg-amber-50/30 dark:bg-amber-950/10 font-bold">
                                                    {item.km13 > 0 ? `${item.km13} km` : '—'}
                                                </td>
                                                <td className="py-3 text-center text-slate-500 dark:text-slate-400 bg-amber-50/30 dark:bg-amber-950/10 font-medium">
                                                    {item.time13 > 0 ? `${Math.floor(item.time13 / 60)}h ${item.time13 % 60}m` : '—'}
                                                </td>
                                                <td className="py-3 text-center font-black text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50/30 dark:bg-fuchsia-950/10">
                                                    {item.pdvs24}
                                                </td>
                                                <td className="py-3 text-center text-slate-600 dark:text-slate-300 bg-fuchsia-50/30 dark:bg-fuchsia-950/10 font-bold">
                                                    {item.km24 > 0 ? `${item.km24} km` : '—'}
                                                </td>
                                                <td className="py-3 text-center text-slate-500 dark:text-slate-400 bg-fuchsia-50/30 dark:bg-fuchsia-950/10 font-medium">
                                                    {item.time24 > 0 ? `${Math.floor(item.time24 / 60)}h ${item.time24 % 60}m` : '—'}
                                                </td>
                                                <td className="py-3 text-center font-black text-indigo-600 dark:text-indigo-400">
                                                    {item.avgPdvs} PDVs
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/80">
                                        <td className="py-3 uppercase text-[11px] tracking-wider">Total Consolidado</td>
                                        <td className="py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/40">
                                            {operationalSummary.totalPdvs13} PDVs
                                        </td>
                                        <td className="py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/40">
                                            {operationalSummary.totalKm13} km
                                        </td>
                                        <td className="py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/40">
                                            {Math.floor(operationalSummary.totalTime13 / 60)}h {operationalSummary.totalTime13 % 60}m
                                        </td>
                                        <td className="py-3 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/50 dark:bg-fuchsia-950/40">
                                            {operationalSummary.totalPdvs24} PDVs
                                        </td>
                                        <td className="py-3 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/50 dark:bg-fuchsia-950/40">
                                            {operationalSummary.totalKm24} km
                                        </td>
                                        <td className="py-3 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/50 dark:bg-fuchsia-950/40">
                                            {Math.floor(operationalSummary.totalTime24 / 60)}h {operationalSummary.totalTime24 % 60}m
                                        </td>
                                        <td className="py-3 text-center text-indigo-600 dark:text-indigo-400 font-black">
                                            {Math.round(((operationalSummary.totalPdvs13 + operationalSummary.totalPdvs24) / 2) * 10) / 10} / sem
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                💡 Cálculo viário baseado em matriz de distâncias e circuito fechado saindo e retornando à residência cadastrada.
                            </span>
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-xs"
                            >
                                Fechar Resumo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE SIMULAÇÃO DE EXTINÇÃO E REDISTRIBUIÇÃO DE SETOR */}
            {showExtinguishModal && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                                    <UserGroupIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Simular Extinção & Redistribuição de Setor
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            Fusão de Carteiras
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Descontinue um setor e redistribua seus clientes para um ou mais setores receptores selecionados, com balanceamento equilibrado.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowExtinguishModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Corpo com Scroll */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                            {/* PASSO 1: SETOR A SER EXTINTO */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                                        Setor que será Extinto (Origem / Doador):
                                    </label>
                                    {sourceSectorToExtinguish && (
                                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                                            {allAdjustedSellers.find(s => String(s.id) === sourceSectorToExtinguish)?.clientCount || 0} clientes na carteira
                                        </span>
                                    )}
                                </div>

                                <select
                                    value={sourceSectorToExtinguish}
                                    onChange={(e) => {
                                        const newSource = e.target.value;
                                        setSourceSectorToExtinguish(newSource);
                                        setTargetSectorsSelected(prev => prev.filter(id => String(id) !== newSource));
                                    }}
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                                >
                                    <option value="">Selecione o setor que será descontinuado...</option>
                                    {allAdjustedSellers.map(s => (
                                        <option key={s.id} value={s.id}>
                                            Setor {s.id} - {s.name} ({s.clientCount} clientes)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* PASSO 2: SETORES RECEPTORES */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                                        Setores que irão Absorver a Carteira (Destino):
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const candidates = allAdjustedSellers
                                                    .filter(s => String(s.id) !== sourceSectorToExtinguish)
                                                    .map(s => s.id);
                                                setTargetSectorsSelected(candidates);
                                            }}
                                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                        >
                                            Selecionar Todos
                                        </button>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <button
                                            type="button"
                                            onClick={() => setTargetSectorsSelected([])}
                                            className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                                        >
                                            Limpar
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                    {allAdjustedSellers
                                        .filter(s => String(s.id) !== sourceSectorToExtinguish)
                                        .map(s => {
                                            const isSelected = targetSectorsSelected.includes(s.id);
                                            const sourceCount = allAdjustedSellers.find(x => String(x.id) === sourceSectorToExtinguish)?.clientCount || 0;
                                            const quotaPrevista = targetSectorsSelected.length > 0 
                                                ? Math.floor(sourceCount / targetSectorsSelected.length)
                                                : 0;

                                            return (
                                                <div
                                                    key={s.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setTargetSectorsSelected(prev => prev.filter(x => x !== s.id));
                                                        } else {
                                                            setTargetSectorsSelected(prev => [...prev, s.id]);
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-600 shadow-2xs'
                                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center space-x-2.5 truncate">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                        />
                                                        <div className="truncate">
                                                            <div className="text-xs font-black text-slate-800 dark:text-white truncate">
                                                                {s.id} - {s.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-medium">
                                                                Carteira atual: {s.clientCount} clientes
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {isSelected && sourceCount > 0 && (
                                                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded shrink-0 ml-1">
                                                            ~+{quotaPrevista}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* PASSO 3: PARÂMETROS DE EQUILÍBRIO */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                                <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">3</span>
                                    Regras de Equilíbrio e Otimização:
                                </label>

                                <div className="space-y-2.5">
                                    <label className="flex items-start space-x-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={balanceLoadEqually}
                                            onChange={(e) => setBalanceLoadEqually(e.target.checked)}
                                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                                Respeitar equilíbrio e balanceamento de carga entre os setores receptores
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                                Distribui os clientes do setor extinto em cotas iguais e homogêneas entre os setores selecionados, combinando menor distância geográfica e equilíbrio de esforço.
                                            </span>
                                        </div>
                                    </label>

                                    <label className="flex items-start space-x-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoOptimizeAfterDistribute}
                                            onChange={(e) => setAutoOptimizeAfterDistribute(e.target.checked)}
                                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                                                Reotimizar automaticamente os circuitos viários e dias da semana dos setores receptores
                                            </span>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                                Após a transferência, recalcula o sequenciamento TSP e o balanceamento diário (Segunda a Sexta) dos setores que receberam novos clientes.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* PREVIEW DA OPERAÇÃO */}
                            {sourceSectorToExtinguish && targetSectorsSelected.length > 0 && (
                                <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <span>📊</span>
                                        <span>Resumo da Simulação:</span>
                                    </div>
                                    <p className="mt-1 text-[11px] leading-relaxed">
                                        O <b>Setor {sourceSectorToExtinguish}</b> terá seus <b>{allAdjustedSellers.find(s => String(s.id) === sourceSectorToExtinguish)?.clientCount || 0} clientes</b> transferidos para <b>{targetSectorsSelected.length} setor(es) receptor(es)</b>.
                                        {targetSectorsSelected.length > 1 && balanceLoadEqually && (
                                            <span> Cada setor receptor receberá uma cota balanceada de aproximadamente <b>~{Math.round((allAdjustedSellers.find(s => String(s.id) === sourceSectorToExtinguish)?.clientCount || 0) / targetSectorsSelected.length)} clientes</b> baseada na maior proximidade geográfica.</span>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
                            <button
                                type="button"
                                onClick={() => setShowExtinguishModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleExtinguishAndDistributeSector}
                                disabled={!sourceSectorToExtinguish || targetSectorsSelected.length === 0 || loading}
                                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                            >
                                <UserGroupIcon className="w-4 h-4"/>
                                <span>Executar Redistribuição do Setor</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE TEMPOS DE ATENDIMENTO POR CANAL DE REMUNERAÇÃO (BANCO DE DADOS CORPORATIVO) */}
            {showChannelTimesModal && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <ClockIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Tempos de Atendimento por Canal
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                            SQL Server
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Minutos médios de permanência por Canal de Remuneração (salvos centralizadamente no banco para todos os operadores).
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowChannelTimesModal(false);
                                    setChannelSaveFeedback(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Feedback Toast */}
                        {channelSaveFeedback && (
                            <div className={`p-3 text-xs font-bold text-center ${
                                channelSaveFeedback.includes('✅') 
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800' 
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-b border-rose-200 dark:border-rose-800'
                            }`}>
                                {channelSaveFeedback}
                            </div>
                        )}

                        {/* Corpo com Scroll */}
                        <div className="p-4 overflow-y-auto space-y-4 flex-1">
                            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 rounded-xl p-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                                💡 <strong>Cálculo no Otimizador e Relatórios:</strong> O tempo total diário da jornada resulta do somatório do <em>tempo de trânsito viário</em> (circuito OSRM) mais a <em>permanência média em cada PDV</em> conforme seu Canal de Remuneração.
                            </div>

                            {/* Alerta de Canais em Uso com Pendências */}
                            {channelsInUseWithAlerts.length > 0 && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-pulse">
                                    <ExclamationIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <div className="font-bold flex items-center gap-1.5">
                                            <span>Atenção: Existem canais com clientes na rota com pendências!</span>
                                            <span className="text-[10px] bg-amber-200 dark:bg-amber-900 px-1.5 py-0.2 rounded font-black">
                                                {channelsInUseWithAlerts.length} pendência{channelsInUseWithAlerts.length > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                                            Os seguintes canais possuem clientes na rota mas estão inativos ou sem tempo cadastrado:{' '}
                                            <strong>
                                                {channelsInUseWithAlerts.map(a => `${a.canal} (${a.label})`).join(', ')}
                                            </strong>.
                                            Até serem regularizados, seus clientes utilizarão o tempo padrão de contingência de {channelServiceTimes['PADRAO'] || 15} min.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Lista de Canais */}
                            <div className="space-y-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                    Canais no Banco de Dados Corporativo:
                                </span>

                                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                                    {allDisplayChannels.map(canalName => {
                                        const count = clientCountByChannel[canalName] || 0;
                                        const mins = channelServiceTimes[canalName] ?? 15;
                                        const isDetected = detectedChannelsFromRoutes.includes(canalName);
                                        const isActive = channelActiveStatus[canalName] !== false;
                                        const channelAlert = channelsInUseWithAlerts.find(a => a.canal === canalName);

                                        return (
                                            <div 
                                                key={canalName}
                                                className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                                                    channelAlert
                                                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20'
                                                        : isActive
                                                            ? 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800'
                                                            : 'border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 opacity-75'
                                                }`}
                                            >
                                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                    <span className={`text-xs font-black uppercase ${
                                                        !isActive 
                                                            ? 'text-slate-400 dark:text-slate-500 line-through' 
                                                            : 'text-slate-800 dark:text-slate-200'
                                                    }`}>
                                                        {canalName}
                                                    </span>
                                                    {count > 0 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                            {count} cliente{count > 1 ? 's' : ''} na rota
                                                        </span>
                                                    )}
                                                    {isDetected && count === 0 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                            Detectado no ERP
                                                        </span>
                                                    )}
                                                    {count === 0 && !isDetected && (
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                            Sem clientes na rota
                                                        </span>
                                                    )}
                                                    {channelAlert && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                                                            <ExclamationIcon className="w-2.5 h-2.5 text-amber-600" />
                                                            {channelAlert.label}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center space-x-2 shrink-0 ml-2">
                                                    {/* Toggle Ativo/Inativo */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setChannelActiveStatus(prev => ({
                                                                ...prev,
                                                                [canalName]: !isActive
                                                            }));
                                                        }}
                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer border flex items-center space-x-1 ${
                                                            isActive
                                                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400 dark:border-slate-700'
                                                        }`}
                                                        title={isActive ? 'Canal Ativo. Clique para inativar.' : 'Canal Inativo. Clique para ativar.'}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                        <span>{isActive ? 'Ativo' : 'Inativo'}</span>
                                                    </button>

                                                    {/* Minutos */}
                                                    <div className="flex items-center space-x-1">
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={300}
                                                            value={mins}
                                                            disabled={!isActive}
                                                            onChange={(e) => {
                                                                const val = Math.max(1, Number(e.target.value) || 1);
                                                                setChannelServiceTimes(prev => ({
                                                                    ...prev,
                                                                    [canalName]: val
                                                                }));
                                                            }}
                                                            className={`w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg py-1 px-2 text-xs font-black text-right outline-none text-slate-900 dark:text-white focus:border-indigo-500 ${!isActive ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                                        />
                                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5">min</span>
                                                    </div>

                                                    {/* Botão Excluir Canal não utilizado */}
                                                    {count === 0 && canalName !== 'PADRAO' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm(`Deseja realmente remover o canal '${canalName}'? Ele será excluído do banco corporativo.`)) {
                                                                    handleDeleteChannel(canalName);
                                                                }
                                                            }}
                                                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition cursor-pointer"
                                                            title={`Remover canal '${canalName}'`}
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <div className="w-6"></div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Adicionar Canal Personalizado */}
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                    Adicionar Outro Canal:
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ex: CONVENIÊNCIA, DISTRIBUIDOR..."
                                        value={newCustomChannelName}
                                        onChange={(e) => setNewCustomChannelName(e.target.value)}
                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl py-1.5 px-3 text-xs font-bold uppercase text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                                    />
                                    <div className="flex items-center space-x-1">
                                        <input
                                            type="number"
                                            min={1}
                                            max={300}
                                            value={newCustomChannelTime}
                                            onChange={(e) => setNewCustomChannelTime(Math.max(1, Number(e.target.value) || 1))}
                                            className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl py-1.5 px-2 text-xs font-black text-right outline-none text-slate-900 dark:text-white focus:border-indigo-500"
                                        />
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">min</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const name = newCustomChannelName.trim().toUpperCase();
                                            if (name) {
                                                setChannelServiceTimes(prev => ({
                                                    ...prev,
                                                    [name]: newCustomChannelTime
                                                }));
                                                setChannelActiveStatus(prev => ({
                                                    ...prev,
                                                    [name]: true
                                                }));
                                                setNewCustomChannelName('');
                                                setNewCustomChannelTime(15);
                                            }
                                        }}
                                        disabled={!newCustomChannelName.trim()}
                                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
                                    >
                                        + Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Faixa de Auditoria do Banco de Dados */}
                        <div className="px-4 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center space-x-1.5">
                                <ClockIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span>
                                    <strong className="font-bold text-slate-700 dark:text-slate-300">Última alteração no banco:</strong>{' '}
                                    {lastAuditInfo?.usuario ? (
                                        <span>
                                            por <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{lastAuditInfo.usuario}</strong> em{' '}
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                {lastAuditInfo.dataHora ? new Date(lastAuditInfo.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '-'}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="italic text-slate-400">Padrão inicial do sistema</span>
                                    )}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Auditoria SQL Server Ativa
                            </span>
                        </div>

                        {/* Rodapé com Ações (Sem o botão Restaurar Padrões) */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end space-x-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowChannelTimesModal(false);
                                    setChannelSaveFeedback(null);
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveChannelTimesToDatabase}
                                disabled={savingChannelTimes}
                                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {savingChannelTimes ? (
                                    <>
                                        <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                                        <span>Salvando no Banco...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>💾 Gravar no Banco de Dados</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
