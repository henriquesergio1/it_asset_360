import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { DataContext } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import { getVisitasPrevistas, getPromoterClients, saveRotaPrevista, getOSRMData, getOSRMTable, geocodeAddress, getClienteRestricoes, saveClienteRestricoesBatch, deleteClienteRestricao, getRotaPrevistaHistory, getSimulacaoPublica, deleteRotaPrevista, getSimulacaoSugestoes, updateSugestaoStatus, aplicarSugestao, getSimulacoesPendentesCount } from './services/apiService';
import { VisitaPrevista, Colaborador, SequenceStrategy, ClienteRestricao } from './types';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';
import { ShareSimulationModal } from './ShareSimulationModal';
import { Calendar, Sun, Sunset, AlertCircle, Info, Edit3, Trash2, Plus, Check, FolderOpen, Share2, MessageSquare } from 'lucide-react';
import {
    CogIcon,
    SpinnerIcon,
    UploadIcon,
    LocationMarkerIcon,
    ArrowRightIcon,
    RefreshIcon,
    ChevronDownIcon,
    ChevronUpIcon,
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

function createHomeIcon(promoterColor?: string, isAnomalous?: boolean, anomalyBadge?: string) {
    const mainGradient = isAnomalous 
        ? 'background: linear-gradient(135deg, #ef4444 0%, #7f1d1d 100%);' 
        : 'background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);';
    const borderGlow = isAnomalous 
        ? 'box-shadow: 0 0 0 3px #fee2e2, 0 0 0 5px #ef4444, 0 0 16px rgba(239, 68, 68, 0.85); animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;' 
        : `box-shadow: 0 0 0 2px ${promoterColor || '#ef4444'};`;
    const labelBg = isAnomalous ? 'background: #991b1b; color: #fee2e2;' : 'background: #0f172a; color: #ffffff;';
    const labelText = isAnomalous ? (anomalyBadge || '⚠️ BASE ANÔMALA') : '🏠 BASE';

    return L.divIcon({
        className: 'custom-home-icon',
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
                <div style="
                    ${mainGradient}
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: 2.5px solid #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    ${borderGlow}
                ">
                    <svg style="width: 20px; height: 20px; fill: white;" viewBox="0 0 24 24">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                </div>
                <div style="
                    ${labelBg}
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
                    ${labelText}
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
    'DOMINGO':       { bg: 'bg-slate-600', text: 'text-slate-600', border: 'border-slate-500', hex: '#64748b', label: 'DOM' },
    'SEM ATENDIMENTO': { bg: 'bg-red-600', text: 'text-red-600', border: 'border-red-500', hex: '#ef4444', label: 'SEM ATEND.' }
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

// Interface de resultado da verificação de anomalia de base
export interface BaseAnomalyResult {
    isAnomalous: boolean;
    type?: 'OCEANO' | 'DISTANTE_CARTEIRA' | 'FORA_BRASIL';
    message: string;
    distKm?: number;
    badgeText: string;
}

// Detecção de área oceânica do Atlântico na costa brasileira
export const isPointInAtlanticOcean = (lat: number, lng: number): boolean => {
    // Limites aproximados do Brasil continental e costeiro
    if (lat < -35 || lat > 6 || lng < -74 || lng > -30) return false;

    // Tabela de aproximação costeira (latitude -> longitude máxima de terra firme na costa leste)
    // Coordenadas com longitude > limite (mais a leste) estão em alto mar / oceano aberto
    const coastLimits: Array<[number, number]> = [
        [5.0, -51.0],
        [3.0, -50.2],
        [1.0, -49.8],
        [0.0, -49.7],
        [-1.5, -45.0],
        [-2.5, -44.0],
        [-3.0, -40.5],
        [-3.7, -38.4],
        [-4.9, -36.5],
        [-5.5, -35.2], // Cabo de São Roque
        [-7.1, -34.75], // Ponta do Seixas (extremo oriental)
        [-8.1, -34.85],
        [-9.6, -35.6],
        [-13.0, -38.4], // Salvador
        [-15.0, -38.9],
        [-17.9, -39.1], // Abrolhos / Caravelas
        [-20.3, -40.2], // Vitória
        [-21.7, -40.9], // Campos / Cabo de São Tomé
        [-22.9, -41.9], // Cabo Frio
        [-23.0, -42.8], // Maricá
        [-23.1, -43.6], // Restinga da Marambaia
        [-23.3, -44.4], // Ilha Grande
        [-23.4, -44.7], // Paraty
        [-23.6, -45.0], // Ubatuba
        [-23.75, -45.26], // Extremo Nordeste de Ilhabela
        [-23.95, -45.27], // Extremo Sudeste de Ilhabela (Ponta do Boi)
        [-24.0, -46.1], // Guarujá
        [-24.1, -46.5], // Santos / Praia Grande
        [-24.4, -46.9], // Peruíbe
        [-25.0, -47.7], // Ilha Comprida / Cananéia
        [-25.6, -48.3], // Ilha do Mel / Paranaguá
        [-26.2, -48.5], // São Francisco do Sul
        [-27.6, -48.35], // Florianópolis (Ponta da Galheta)
        [-28.5, -48.7], // Laguna
        [-30.0, -50.1], // Tramandaí
        [-32.0, -52.0], // Rio Grande
        [-33.75, -53.3] // Chuí
    ];

    // Interpolação linear do limite costeiro para a latitude dada
    for (let i = 0; i < coastLimits.length - 1; i++) {
        const [lat1, lng1] = coastLimits[i];
        const [lat2, lng2] = coastLimits[i + 1];
        if (lat <= lat1 && lat >= lat2) {
            const ratio = (lat - lat1) / (lat2 - lat1);
            const maxLandLng = lng1 + ratio * (lng2 - lng1);
            if (lng > maxLandLng + 0.005) { // tolerância de ~500m
                return true; // Mais a leste que a terra firme = Mar aberto
            }
            break;
        }
    }

    // Detecção de canal marítimo no Litoral Norte de SP
    // Canal de São Sebastião (entre o continente e a Ilha de Ilhabela)
    // Água do canal fica entre Longitude -45.395 e -45.378 nas latitudes -23.77 a -23.86
    if (lat <= -23.77 && lat >= -23.86 && lng >= -45.395 && lng <= -45.378) {
        return true;
    }

    return false;
};

// Verificador automático de anomalia de base do colaborador
export const checkCollaboratorBaseAnomaly = (
    baseLat?: number,
    baseLng?: number,
    sellerVisits?: VisitaPrevista[]
): BaseAnomalyResult => {
    if (!baseLat || !baseLng || isNaN(baseLat) || isNaN(baseLng)) {
        return { isAnomalous: false, badgeText: '', message: '' };
    }

    // 1. Coordenadas fora do Brasil ou com sinais invertidos
    if (baseLat > 5.5 || baseLat < -34.0 || baseLng > -34.5 || baseLng < -74.0) {
        if (baseLng > -34.5 && baseLng < 0 && baseLat < 6 && baseLat > -35) {
            return {
                isAnomalous: true,
                type: 'OCEANO',
                badgeText: '🌊 Base no Mar',
                message: 'Coordenadas situadas em alto mar no Oceano Atlântico (fora do litoral).'
            };
        }
        return {
            isAnomalous: true,
            type: 'FORA_BRASIL',
            badgeText: '⚠️ GPS Inválido',
            message: 'Coordenadas fora dos limites do Brasil ou com sinais invertidos.'
        };
    }

    // 2. Coordenadas em área marítima / mar aberto / canal
    if (isPointInAtlanticOcean(baseLat, baseLng)) {
        return {
            isAnomalous: true,
            type: 'OCEANO',
            badgeText: '🌊 Base no Mar',
            message: 'Coordenadas identificadas em área marítima / mar aberto.'
        };
    }

    // 3. Distância excessiva da carteira de clientes (> 100 km)
    if (sellerVisits && sellerVisits.length > 0) {
        const validClients = sellerVisits.filter(v => v.Lat && v.Long && !isNaN(v.Lat) && !isNaN(v.Long));
        if (validClients.length > 0) {
            let minDist = Infinity;
            let sumLat = 0;
            let sumLng = 0;

            validClients.forEach(v => {
                sumLat += v.Lat;
                sumLng += v.Long;
                const d = calcDist(baseLat, baseLng, v.Lat, v.Long);
                if (d < minDist) minDist = d;
            });

            const centroidLat = sumLat / validClients.length;
            const centroidLng = sumLng / validClients.length;
            const centroidDist = calcDist(baseLat, baseLng, centroidLat, centroidLng);

            if (minDist > 100 || centroidDist > 100) {
                const roundedDist = Math.round(minDist * 10) / 10;
                return {
                    isAnomalous: true,
                    type: 'DISTANTE_CARTEIRA',
                    distKm: roundedDist,
                    badgeText: `⚠️ Base >${roundedDist}km`,
                    message: `Base a ~${roundedDist} km do cliente mais próximo da carteira (limite de alerta: 100 km).`
                };
            }
        }
    }

    return { isAnomalous: false, badgeText: '', message: '' };
};

// Helper de detecção de anomalia de coordenadas (ex: outlier a mais de 80km da base/centroide)
const checkCoordinateAnomaly = (
    client: VisitaPrevista,
    baseLat?: number,
    baseLng?: number,
    fallbackCentroid?: { lat: number; lng: number }
): { isAnomalous: boolean; distKm: number; referenceType: 'base' | 'centroid' | 'none' } => {
    if (!client.Lat || !client.Long) {
        return { isAnomalous: true, distKm: 0, referenceType: 'none' };
    }
    const refLat = baseLat || fallbackCentroid?.lat;
    const refLng = baseLng || fallbackCentroid?.lng;
    const refType = baseLat && baseLng ? 'base' : (fallbackCentroid ? 'centroid' : 'none');

    if (refLat && refLng) {
        const dist = calcDist(refLat, refLng, client.Lat, client.Long);
        // Distância superior a 80 km da base (ou centroide) é tratada como anomalia geográfica suspeita
        if (dist > 80) {
            return { isAnomalous: true, distKm: Math.round(dist * 10) / 10, referenceType: refType };
        }
        return { isAnomalous: false, distKm: Math.round(dist * 10) / 10, referenceType: refType };
    }
    return { isAnomalous: false, distKm: 0, referenceType: 'none' };
};

// Helper para aplicação de coordenadas geográficas customizadas salvas no navegador
const applyCustomCoordinates = (routes: VisitaPrevista[]): VisitaPrevista[] => {
    try {
        const raw = localStorage.getItem('FUEL360_CUSTOM_CLIENT_COORDS');
        if (!raw) return routes;
        const customMap: Record<string, { lat: number; long: number }> = JSON.parse(raw);
        return routes.map(r => {
            const custom = customMap[String(r.Cod_Cliente)];
            if (custom && typeof custom.lat === 'number' && typeof custom.long === 'number' && !isNaN(custom.lat) && !isNaN(custom.long)) {
                return {
                    ...r,
                    Lat: custom.lat,
                    Long: custom.long
                };
            }
            return r;
        });
    } catch {
        return routes;
    }
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

const calcCircuitMetrics = (
    base: { lat: number; lng: number }, 
    stops: { lat: number; lng: number }[],
    endAtLastClient: boolean = false
): CircuitMetrics => {
    if (stops.length === 0) return { totalKm: 0, travelMinutes: 0 };
    
    // Pontos do circuito diário: Base -> Paradas (-> Base se endAtLastClient for false)
    const points: { lat: number; lng: number }[] = [];
    if (base.lat && base.lng) points.push(base);
    stops.forEach(s => {
        if (s.lat && s.lng) points.push(s);
    });
    if (!endAtLastClient && base.lat && base.lng && points.length > 1) {
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

// Heurística de Roteirização TSP (Base -> Clientes -> opcional Base) com 2-Opt Local Search
function optimizeDayCircuit2Opt<T extends { lat: number; lng: number }>(
    base: { lat: number; lng: number },
    clients: T[],
    endAtLastClient: boolean = false
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

    // 2. Fase de Melhoria: Heurística 2-Opt
    // Tour: [Base, ...orderedStops, ...(endAtLastClient ? [] : [Base])]
    const fullTour: { lat: number; lng: number; isBase: boolean; item?: T }[] = [
        { lat: base.lat, lng: base.lng, isBase: true },
        ...orderedStops.map(item => ({ lat: item.lat, lng: item.lng, isBase: false, item })),
        ...(!endAtLastClient ? [{ lat: base.lat, lng: base.lng, isBase: true }] : [])
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

    return fullTour.filter(stop => !stop.isBase).map(stop => stop.item!);
}

const getStopCodCliente = (item: any): number => {
    if (!item) return 0;
    if (typeof item.Cod_Cliente === 'number') return item.Cod_Cliente;
    if (item.sampleVisit && typeof item.sampleVisit.Cod_Cliente === 'number') return item.sampleVisit.Cod_Cliente;
    if (item.visit && typeof item.visit.Cod_Cliente === 'number') return item.visit.Cod_Cliente;
    return 0;
};

// Sequenciamento Multiestratégia de Visitas Diárias (Far-to-Near, Snake/Sweep, Menor KM TSP, Near-to-Far)
function sequenceDayStops<T extends { lat: number; lng: number }>(
    base: { lat: number; lng: number },
    clients: T[],
    strategy: SequenceStrategy = 'FAR_TO_NEAR',
    restricoesMap?: Map<number, ClienteRestricao>,
    endAtLastClient: boolean = false
): T[] {
    if (clients.length <= 1) return clients;

    // Se temos restrições de turno (MANHA / TARDE), prioriza janelas operacionais
    if (restricoesMap && restricoesMap.size > 0) {
        const manha: T[] = [];
        const livre: T[] = [];
        const tarde: T[] = [];

        clients.forEach(c => {
            const cod = getStopCodCliente(c);
            const r = cod ? restricoesMap.get(cod) : null;
            if (r && r.TurnoPermitido === 'MANHA') {
                manha.push(c);
            } else if (r && r.TurnoPermitido === 'TARDE') {
                tarde.push(c);
            } else {
                livre.push(c);
            }
        });

        if (manha.length > 0 || tarde.length > 0) {
            const seqManha = manha.length > 1 ? sequenceDayStops(base, manha, strategy, restricoesMap, false) : manha;
            const refBaseForLivre = seqManha.length > 0 ? seqManha[seqManha.length - 1] : base;
            const seqLivre = livre.length > 1 ? sequenceDayStops(refBaseForLivre, livre, strategy, restricoesMap, false) : livre;
            const refBaseForTarde = seqLivre.length > 0 ? seqLivre[seqLivre.length - 1] : (seqManha.length > 0 ? seqManha[seqManha.length - 1] : base);
            const seqTarde = tarde.length > 1 ? sequenceDayStops(refBaseForTarde, tarde, strategy, restricoesMap, endAtLastClient) : tarde;

            return [...seqManha, ...seqLivre, ...seqTarde];
        }
    }

    // Se temos exatamente 2 paradas
    if (clients.length === 2) {
        const d0 = calcDist(base.lat, base.lng, clients[0].lat, clients[0].lng);
        const d1 = calcDist(base.lat, base.lng, clients[1].lat, clients[1].lng);
        if (strategy === 'FAR_TO_NEAR') {
            return d0 >= d1 ? [clients[0], clients[1]] : [clients[1], clients[0]];
        }
        if (strategy === 'NEAR_TO_FAR') {
            return d0 <= d1 ? [clients[0], clients[1]] : [clients[1], clients[0]];
        }
        return clients;
    }

    if (strategy === 'SNAKE_SWEEP') {
        // Coordenadas polares relativas à base: ângulo [-PI, PI] e distância radial
        const withPolar = clients.map(c => {
            const dy = (c.lat || 0) - (base.lat || 0);
            const dx = (c.lng || 0) - (base.lng || 0);
            const angle = Math.atan2(dy, dx);
            const dist = calcDist(base.lat, base.lng, c.lat, c.lng);
            return { client: c, angle, dist };
        });

        withPolar.sort((a, b) => a.angle - b.angle);

        // Localizar a maior lacuna angular para definir o ponto de transição suave do percurso
        let maxGap = 0;
        let cutIdx = 0;
        for (let i = 0; i < withPolar.length; i++) {
            const nextIdx = (i + 1) % withPolar.length;
            let gap = withPolar[nextIdx].angle - withPolar[i].angle;
            if (gap < 0) gap += 2 * Math.PI;
            if (gap > maxGap) {
                maxGap = gap;
                cutIdx = nextIdx;
            }
        }

        const rotated = [...withPolar.slice(cutIdx), ...withPolar.slice(0, cutIdx)].map(p => p.client);
        return optimizeDayCircuit2Opt(base, rotated, endAtLastClient);
    }

    // Para FAR_TO_NEAR, NEAR_TO_FAR e CIRCUIT_TSP:
    const closedTour = optimizeDayCircuit2Opt(base, clients, endAtLastClient);
    if (closedTour.length <= 2 || strategy === 'CIRCUIT_TSP') {
        return closedTour;
    }

    if (strategy === 'FAR_TO_NEAR') {
        // Encontra o cliente com maior distância da base para iniciar o dia
        let farthestIdx = 0;
        let maxDist = -1;
        for (let i = 0; i < closedTour.length; i++) {
            const d = calcDist(base.lat, base.lng, closedTour[i].lat, closedTour[i].lng);
            if (d > maxDist) {
                maxDist = d;
                farthestIdx = i;
            }
        }

        // Duas orientações possíveis do circuito a partir do cliente mais distante
        const opt1 = [
            ...closedTour.slice(farthestIdx),
            ...closedTour.slice(0, farthestIdx)
        ];
        const opt2 = [
            closedTour[farthestIdx],
            ...closedTour.slice(0, farthestIdx).reverse(),
            ...closedTour.slice(farthestIdx + 1).reverse()
        ];

        // Escolhe a direção cuja última parada seja a MAIS PRÓXIMA da base (para terminar o expediente perto de casa)
        const last1 = opt1[opt1.length - 1];
        const last2 = opt2[opt2.length - 1];
        const distLast1 = calcDist(base.lat, base.lng, last1.lat, last1.lng);
        const distLast2 = calcDist(base.lat, base.lng, last2.lat, last2.lng);

        return distLast1 <= distLast2 ? opt1 : opt2;
    }

    if (strategy === 'NEAR_TO_FAR') {
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < closedTour.length; i++) {
            const d = calcDist(base.lat, base.lng, closedTour[i].lat, closedTour[i].lng);
            if (d < minDist) {
                minDist = d;
                nearestIdx = i;
            }
        }

        const opt1 = [
            ...closedTour.slice(nearestIdx),
            ...closedTour.slice(0, nearestIdx)
        ];
        const opt2 = [
            closedTour[nearestIdx],
            ...closedTour.slice(0, nearestIdx).reverse(),
            ...closedTour.slice(nearestIdx + 1).reverse()
        ];

        const last1 = opt1[opt1.length - 1];
        const last2 = opt2[opt2.length - 1];
        const distLast1 = calcDist(base.lat, base.lng, last1.lat, last1.lng);
        const distLast2 = calcDist(base.lat, base.lng, last2.lat, last2.lng);

        return distLast1 >= distLast2 ? opt1 : opt2;
    }

    return closedTour;
}

// Heurística Avançada de Roteirização TSP
// Combina Inserção Mais Econômica (Cheapest Insertion) com Busca Local Híbrida 2-Opt + Or-Opt e Matriz Viária Real OSRM
async function optimizeDayCircuitWithOSRM<T extends { lat: number; lng: number }>(
    base: { lat: number; lng: number },
    clients: T[],
    strategy: SequenceStrategy = 'FAR_TO_NEAR',
    restricoesMap?: Map<number, ClienteRestricao>,
    endAtLastClient: boolean = false
): Promise<T[]> {
    if (clients.length <= 2) return sequenceDayStops(base, clients, strategy, restricoesMap, endAtLastClient);

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

    type TourNode = {
        lat: number;
        lng: number;
        origIdx: number;
        item?: T;
    };

    // 1. Fase de Construção: Inserção Mais Econômica (Cheapest Insertion)
    // Localiza o cliente mais distante da base como semente externa do circuito
    let farthestIdx = 1;
    let maxBaseDist = -1;
    for (let i = 0; i < clients.length; i++) {
        const d = getCost(0, i + 1, base, clients[i]);
        if (d > maxBaseDist) {
            maxBaseDist = d;
            farthestIdx = i + 1;
        }
    }

    const unvisited = clients
        .map((c, i) => ({ item: c, origIdx: i + 1 }))
        .filter(c => c.origIdx !== farthestIdx);

    const fullTour: TourNode[] = [
        { lat: base.lat, lng: base.lng, origIdx: 0 },
        { lat: clients[farthestIdx - 1].lat, lng: clients[farthestIdx - 1].lng, origIdx: farthestIdx, item: clients[farthestIdx - 1] },
        { lat: base.lat, lng: base.lng, origIdx: 0 }
    ];

    while (unvisited.length > 0) {
        let bestUnvisitedIdx = 0;
        let bestInsertPos = 1;
        let minCostIncrease = Infinity;

        for (let u = 0; u < unvisited.length; u++) {
            const candidate = unvisited[u];
            for (let edgeIdx = 0; edgeIdx < fullTour.length - 1; edgeIdx++) {
                const nodeA = fullTour[edgeIdx];
                const nodeB = fullTour[edgeIdx + 1];

                const currentEdgeCost = getCost(nodeA.origIdx, nodeB.origIdx, nodeA, nodeB);
                const newEdgesCost = getCost(nodeA.origIdx, candidate.origIdx, nodeA, candidate.item) +
                                     getCost(candidate.origIdx, nodeB.origIdx, candidate.item, nodeB);
                const costIncrease = newEdgesCost - currentEdgeCost;

                if (costIncrease < minCostIncrease) {
                    minCostIncrease = costIncrease;
                    bestInsertPos = edgeIdx + 1;
                    bestUnvisitedIdx = u;
                }
            }
        }

        const chosen = unvisited.splice(bestUnvisitedIdx, 1)[0];
        fullTour.splice(bestInsertPos, 0, {
            lat: chosen.item.lat,
            lng: chosen.item.lng,
            origIdx: chosen.origIdx,
            item: chosen.item
        });
    }

    // 2. Fase de Melhoria: Busca Local 2-Opt em Circuito Fechado [Base, ...clientes, Base]
    let improved2Opt = true;
    let iter2Opt = 0;
    const maxIter2Opt = 60;

    while (improved2Opt && iter2Opt < maxIter2Opt) {
        improved2Opt = false;
        iter2Opt++;

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
                    improved2Opt = true;
                    break;
                }
            }
            if (improved2Opt) break;
        }
    }

    // 3. Fase de Melhoria: Busca Local Or-Opt (Relocação de blocos contíguos de 3, 2 e 1 paradas)
    const blockSizes = [3, 2, 1];
    let improvedOrOpt = true;
    let iterOrOpt = 0;
    const maxIterOrOpt = 40;

    while (improvedOrOpt && iterOrOpt < maxIterOrOpt) {
        improvedOrOpt = false;
        iterOrOpt++;

        for (const blockSize of blockSizes) {
            if (fullTour.length - 2 <= blockSize) continue;

            for (let i = 1; i <= fullTour.length - 1 - blockSize; i++) {
                const prevNode = fullTour[i - 1];
                const firstInBlock = fullTour[i];
                const lastInBlock = fullTour[i + blockSize - 1];
                const nextNode = fullTour[i + blockSize];

                const removeOldEdges = getCost(prevNode.origIdx, firstInBlock.origIdx, prevNode, firstInBlock) +
                                       getCost(lastInBlock.origIdx, nextNode.origIdx, lastInBlock, nextNode);
                const bypassEdge = getCost(prevNode.origIdx, nextNode.origIdx, prevNode, nextNode);
                const removalSavings = removeOldEdges - bypassEdge;

                for (let j = 0; j < fullTour.length - 1; j++) {
                    // Ignora a posição de origem do bloco e suas adjacências diretas
                    if (j >= i - 1 && j <= i + blockSize - 1) continue;

                    const targetA = fullTour[j];
                    const targetB = fullTour[j + 1];

                    const oldTargetEdge = getCost(targetA.origIdx, targetB.origIdx, targetA, targetB);
                    const newTargetEdges = getCost(targetA.origIdx, firstInBlock.origIdx, targetA, firstInBlock) +
                                           getCost(lastInBlock.origIdx, targetB.origIdx, lastInBlock, targetB);
                    const insertionCost = newTargetEdges - oldTargetEdge;
                    const netGain = removalSavings - insertionCost;

                    if (netGain > 0.0005) {
                        const block = fullTour.splice(i, blockSize);
                        const insertIdx = j < i ? j + 1 : j + 1 - blockSize;
                        fullTour.splice(insertIdx, 0, ...block);
                        improvedOrOpt = true;
                        break;
                    }
                }
                if (improvedOrOpt) break;
            }
            if (improvedOrOpt) break;
        }
    }

    return sequenceDayStops(base, fullTour.slice(1, -1).map(stop => stop.item!), strategy, restricoesMap, endAtLastClient);
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
    sellers: { id: number; name: string; clientCount?: number }[];
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

    const totalScopePdvs = useMemo(() => {
        return sellers.reduce((acc, s) => acc + (s.clientCount || 0), 0);
    }, [sellers]);

    const selectedSellerObj = sellers.find(s => String(s.id) === value);
    const isAllSelected = !value || value === 'ALL';
    const displayText = selectedSellerObj
        ? (selectedSellerObj.name.startsWith(`${selectedSellerObj.id} - `)
            ? `${selectedSellerObj.name}${selectedSellerObj.clientCount !== undefined ? ` (${selectedSellerObj.clientCount} PDVs)` : ''}`
            : `${selectedSellerObj.id} - ${selectedSellerObj.name}${selectedSellerObj.clientCount !== undefined ? ` (${selectedSellerObj.clientCount} PDVs)` : ''}`)
        : `Todos os Vendedores (${sellers.length} colabs • ${totalScopePdvs} PDVs)`;

    return (
        <div className="relative inline-flex items-center space-x-1" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="flex items-center justify-between min-w-[240px] max-w-[320px] bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white shadow-sm transition outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
                <span className="truncate mr-2">
                    {displayText}
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {!isAllSelected && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange('');
                    }}
                    title="Desmarcar vendedor e exibir todos"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-xl transition cursor-pointer"
                >
                    <XCircleIcon className="w-4 h-4" />
                </button>
            )}

            {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 max-w-[90vw] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
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
                        {/* Opção Todos os Vendedores */}
                        {(!searchTerm.trim() || 'todos os vendedores'.includes(searchTerm.toLowerCase().trim())) && (
                            <button
                                type="button"
                                onClick={() => {
                                    onChange('');
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition cursor-pointer ${
                                    isAllSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-950/60 font-bold text-indigo-700 dark:text-indigo-300'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-medium'
                                }`}
                            >
                                <div className="flex items-center space-x-2 truncate">
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-[10px] text-indigo-700 dark:text-indigo-300 font-black shrink-0">
                                        TODOS
                                    </span>
                                    <span className="truncate font-bold">Todos os Vendedores ({sellers.length})</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold shrink-0">
                                        • {totalScopePdvs} PDVs
                                    </span>
                                </div>
                                {isAllSelected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ml-2" />
                                )}
                            </button>
                        )}

                        {filteredSellers.length === 0 && searchTerm.trim() && !'todos os vendedores'.includes(searchTerm.toLowerCase().trim()) ? (
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
                                        <div className="flex items-center space-x-2 truncate min-w-0">
                                            <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-bold shrink-0">
                                                {seller.id}
                                            </span>
                                            <span className="truncate font-semibold">{seller.name.replace(new RegExp(`^${seller.id}\\s*-\\s*`), '')}</span>
                                            {seller.clientCount !== undefined && (
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold shrink-0 ml-auto mr-1">
                                                    ({seller.clientCount} PDVs)
                                                </span>
                                            )}
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
        completedSummary?: {
            title: string;
            escopoDesc: string;
            totalClients: number;
            unallocatedCount?: number;
            mode?: 'simulate' | 'strict' | 'flexibilize';
            hoursLimit?: number;
        } | null;
    } | null>(null);

    // Modais de Controle Superior (Layout Full-Width)
    const [showParamsModal, setShowParamsModal] = useState(false);
    const [showSellersModal, setShowSellersModal] = useState(false);

    // Comparativo Antes x Depois
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareOnlyChanged, setCompareOnlyChanged] = useState(true);
    const [compareSearchFilter, setCompareSearchFilter] = useState('');
    const [compareSellerFilter, setCompareSellerFilter] = useState<string>('ALL');

    // Itinerário Operacional Passo a Passo com Google Maps e Waze
    const [showItineraryModal, setShowItineraryModal] = useState(false);
    const [itineraryDay, setItineraryDay] = useState<string>('SEGUNDA-FEIRA');
    const [itinerarySeller, setItinerarySeller] = useState<string>('');
    const [itineraryQuinzena, setItineraryQuinzena] = useState<'1_3' | '2_4'>('1_3');
    const [copiedItinerary, setCopiedItinerary] = useState(false);
    const [shareModalData, setShareModalData] = useState<{ isOpen: boolean; simId: number; periodo: string; totalKm?: number } | null>(null);

    // Gestão de Simulações Salvas e Carregamento Ativo
    const [loadedSimInfo, setLoadedSimInfo] = useState<{ id: number; name: string; desc?: string } | null>(null);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [simSaveName, setSimSaveName] = useState('');
    const [simSaveDesc, setSimSaveDesc] = useState('');
    const [simSaveOverwrite, setSimSaveOverwrite] = useState(false);

    const [showSavedSimulationsModal, setShowSavedSimulationsModal] = useState(false);
    const [savedSimulationsList, setSavedSimulationsList] = useState<any[]>([]);
    const [loadingSavedSimulations, setLoadingSavedSimulations] = useState(false);
    const [simSearchTerm, setSimSearchTerm] = useState('');
    const [deletingSimId, setDeletingSimId] = useState<number | null>(null);
    const [loadingSimId, setLoadingSimId] = useState<number | null>(null);

    // Modal de Diagnóstico e Reequilíbrio de Dias Sobrecarregados
    const [rebalanceDay, setRebalanceDay] = useState<string | null>(null);
    const [selectedRebalanceClients, setSelectedRebalanceClients] = useState<Set<number>>(new Set());
    const [targetRebalanceDay, setTargetRebalanceDay] = useState<string>('');
    const [rebalanceToast, setRebalanceToast] = useState<string | null>(null);

    // Parâmetros de Roteirização
    const [optMaxClients, setOptMaxClients] = useState(15);
    const [optLimitClients, setOptLimitClients] = useState(false);
    const [optMaxKm, setOptMaxKm] = useState(60);
    const [optLimitKm, setOptLimitKm] = useState(false);
    const [optMaxHours, setOptMaxHours] = useState<number>(() => {
        const saved = localStorage.getItem('fuel_opt_max_hours');
        return saved ? Number(saved) : 8;
    });
    const [optLimitHours, setOptLimitHours] = useState<boolean>(() => {
        return localStorage.getItem('fuel_opt_limit_hours') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('fuel_opt_max_hours', String(optMaxHours));
    }, [optMaxHours]);

    useEffect(() => {
        localStorage.setItem('fuel_opt_limit_hours', String(optLimitHours));
    }, [optLimitHours]);

    const [optServiceTimePerClient, setOptServiceTimePerClient] = useState(15); // min por visita
    const [optDays, setOptDays] = useState<string[]>(['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
    const [optSatHalfPeriod, setOptSatHalfPeriod] = useState(true);
    const [optBalanceWorkload, setOptBalanceWorkload] = useState(true);
    const [optAvoidFridayDistant, setOptAvoidFridayDistant] = useState<boolean>(() => {
        const saved = localStorage.getItem('fuel_opt_avoid_friday_distant');
        return saved !== null ? saved === 'true' : true;
    });

    useEffect(() => {
        localStorage.setItem('fuel_opt_avoid_friday_distant', String(optAvoidFridayDistant));
    }, [optAvoidFridayDistant]);

    const [optSequenceStrategy, setOptSequenceStrategy] = useState<SequenceStrategy>(() => {
        const saved = localStorage.getItem('fuel_opt_sequence_strategy');
        return (saved as SequenceStrategy) || 'FAR_TO_NEAR';
    });

    useEffect(() => {
        localStorage.setItem('fuel_opt_sequence_strategy', optSequenceStrategy);
    }, [optSequenceStrategy]);

    const [optEndAtLastClient, setOptEndAtLastClient] = useState<boolean>(() => {
        const saved = localStorage.getItem('fuel_opt_end_at_last_client');
        return saved !== null ? saved === 'true' : false;
    });

    useEffect(() => {
        localStorage.setItem('fuel_opt_end_at_last_client', String(optEndAtLastClient));
    }, [optEndAtLastClient]);

    // Persistência corporativa dos Parâmetros do Otimizador no SQL Server
    const [savingParamsToDb, setSavingParamsToDb] = useState(false);
    const [paramsSaveFeedback, setParamsSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const loadOptimizerParametersFromDatabase = useCallback(async () => {
        try {
            const res = await fetch('/api/fuel360/parametros-otimizacao');
            const data = await res.json();
            if (data.success && data.parametros) {
                const p = data.parametros;
                if (p.OptLimitClients !== undefined && p.OptLimitClients !== null) setOptLimitClients(Boolean(p.OptLimitClients));
                if (p.OptMaxClients !== undefined && p.OptMaxClients !== null) setOptMaxClients(Number(p.OptMaxClients));
                if (p.OptLimitKm !== undefined && p.OptLimitKm !== null) setOptLimitKm(Boolean(p.OptLimitKm));
                if (p.OptMaxKm !== undefined && p.OptMaxKm !== null) setOptMaxKm(Number(p.OptMaxKm));
                if (p.OptLimitHours !== undefined && p.OptLimitHours !== null) setOptLimitHours(Boolean(p.OptLimitHours));
                if (p.OptMaxHours !== undefined && p.OptMaxHours !== null) setOptMaxHours(Number(p.OptMaxHours));
                if (p.OptDays) {
                    const daysArr = typeof p.OptDays === 'string' ? p.OptDays.split(',').map((d: string) => d.trim()).filter(Boolean) : p.OptDays;
                    if (Array.isArray(daysArr) && daysArr.length > 0) setOptDays(daysArr);
                }
                if (p.OptSatHalfPeriod !== undefined && p.OptSatHalfPeriod !== null) setOptSatHalfPeriod(Boolean(p.OptSatHalfPeriod));
                if (p.OptBalanceWorkload !== undefined && p.OptBalanceWorkload !== null) setOptBalanceWorkload(Boolean(p.OptBalanceWorkload));
                if (p.OptAvoidFridayDistant !== undefined && p.OptAvoidFridayDistant !== null) setOptAvoidFridayDistant(Boolean(p.OptAvoidFridayDistant));
                if (p.OptSequenceStrategy) setOptSequenceStrategy(p.OptSequenceStrategy as SequenceStrategy);
                if (p.OptEndAtLastClient !== undefined && p.OptEndAtLastClient !== null) setOptEndAtLastClient(Boolean(p.OptEndAtLastClient));
            }
        } catch (e) {
            console.warn('[Fuel360] Falha ao carregar parâmetros do otimizador do banco:', e);
        }
    }, []);

    useEffect(() => {
        loadOptimizerParametersFromDatabase();
    }, [loadOptimizerParametersFromDatabase]);

    const handleSaveOptimizerParametersToDatabase = async () => {
        try {
            setSavingParamsToDb(true);
            setParamsSaveFeedback(null);
            const currentUser = authUser?.Nome || authUser?.Usuario || 'Operador Fuel';
            const payload = {
                optLimitClients,
                optMaxClients,
                optLimitKm,
                optMaxKm,
                optLimitHours,
                optMaxHours,
                optDays,
                optSatHalfPeriod,
                optBalanceWorkload,
                optAvoidFridayDistant,
                optSequenceStrategy,
                optEndAtLastClient,
                usuario: currentUser
            };

            const res = await fetch('/api/fuel360/parametros-otimizacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setParamsSaveFeedback({ type: 'success', message: 'Parâmetros gravados com sucesso no banco de dados corporativo!' });
                setTimeout(() => {
                    setParamsSaveFeedback(null);
                }, 3500);
            } else {
                setParamsSaveFeedback({ type: 'error', message: data.error || 'Erro ao salvar parâmetros no banco.' });
            }
        } catch (err: any) {
            setParamsSaveFeedback({ type: 'error', message: err.message || 'Falha de comunicação com o servidor.' });
        } finally {
            setSavingParamsToDb(false);
        }
    };

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

    // Ajuste de Coordenadas Geográficas (GPS) de Clientes
    const [coordinateModalClient, setCoordinateModalClient] = useState<VisitaPrevista | null>(null);
    const [coordModalLat, setCoordModalLat] = useState<string>('');
    const [coordModalLng, setCoordModalLng] = useState<string>('');
    const [coordNeighborSearch, setCoordNeighborSearch] = useState<string>('');
    const [isGeocodingCoord, setIsGeocodingCoord] = useState<boolean>(false);
    const [coordGeocodeFeedback, setCoordGeocodeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Tratamento de Capacidade Excedida / Tempo Limite na Otimização
    const [showCapacityModal, setShowCapacityModal] = useState(false);
    const [capacityOverflowData, setCapacityOverflowData] = useState<{
        sellers: number[];
        overflowCount: number;
        maxVisitsNeeded: number;
        totalCapacityForWeek: number;
        neededHoursPerDay: number;
        configuredHours: number;
        sellersSummary: Array<{
            sellerId: number;
            sellerName: string;
            totalClients: number;
            capacity: number;
            overflow: number;
        }>;
    } | null>(null);

    // Controle de Exibição da Grade de Ajuste Fino em Sanfona por Dia (inicia fechado por padrão)
    const [tableViewMode, setTableViewMode] = useState<'accordion' | 'flat'>('accordion');
    const [openDaysMap, setOpenDaysMap] = useState<Record<string, boolean>>({});
    const [openSellersMap, setOpenSellersMap] = useState<Record<string, boolean>>({});
    const [optimizedSellersSet, setOptimizedSellersSet] = useState<Set<number>>(new Set());

    // Seleção Múltipla e Transferência em Massa de Clientes Sem Atendimento
    const [selectedUnallocatedClients, setSelectedUnallocatedClients] = useState<Set<number>>(new Set());
    const [massTargetDay, setMassTargetDay] = useState<string>('');
    const [massTargetSellerId, setMassTargetSellerId] = useState<string>('');
    const [massTargetPeriodicidade, setMassTargetPeriodicidade] = useState<string>('');

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

        // 1. Coincidência Exata
        if (channelServiceTimes[canalNorm] !== undefined) {
            if (channelActiveStatus[canalNorm] === false) {
                return defaultMins;
            }
            return Number(channelServiceTimes[canalNorm]) || defaultMins;
        }

        // 2. Coincidência por Palavra-Chave (canal contém a chave, com chave >= 4 letras para evitar siglas ambíguas)
        for (const [key, val] of Object.entries(channelServiceTimes)) {
            if (key === 'PADRAO') continue;
            if (key.length >= 4 && canalNorm.includes(key)) {
                if (channelActiveStatus[key] === false) {
                    return defaultMins;
                }
                return Number(val) || defaultMins;
            }
        }

        // 3. Coincidência Reversa (chave contém o canal, apenas se canal >= 4 letras)
        for (const [key, val] of Object.entries(channelServiceTimes)) {
            if (key === 'PADRAO') continue;
            if (canalNorm.length >= 4 && key.includes(canalNorm)) {
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

    // Particularidades / Janelas de Atendimento de Clientes (Persistidas no Banco SQL Server)
    const [clienteRestricoes, setClienteRestricoes] = useState<ClienteRestricao[]>([]);
    const [showRestricoesModal, setShowRestricoesModal] = useState<boolean>(false);
    const [savingRestricao, setSavingRestricao] = useState<boolean>(false);
    const [restricaoSearch, setRestricaoSearch] = useState<string>('');
    const [restricaoFilterTurno, setRestricaoFilterTurno] = useState<'TODOS' | 'MANHA' | 'TARDE' | 'QUALQUER'>('TODOS');
    const [restricaoFilterOrigem, setRestricaoFilterOrigem] = useState<'TODOS' | 'SUPERVISOR' | 'MANUAL'>('TODOS');
    const [restricaoSaveFeedback, setRestricaoSaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [lastRestricaoAudit, setLastRestricaoAudit] = useState<{ usuario?: string; dataHora?: string } | null>(null);

    // Formulário de Particularidade
    const [formCodCliente, setFormCodCliente] = useState<string>('');
    const [formRazaoSocial, setFormRazaoSocial] = useState<string>('');
    const [formDiasPermitidos, setFormDiasPermitidos] = useState<string[]>([]);
    const [formTurnoPermitido, setFormTurnoPermitido] = useState<'MANHA' | 'TARDE' | 'QUALQUER'>('QUALQUER');
    const [formQuinzenaPermitida, setFormQuinzenaPermitida] = useState<'1_3' | '2_4' | 'QUALQUER'>('QUALQUER');
    const [formObservacao, setFormObservacao] = useState<string>('');
    const [editingRestricaoId, setEditingRestricaoId] = useState<number | null>(null);

    // Mapa rápido de consulta por Cod_Cliente
    const clienteRestricoesMap = useMemo(() => {
        const map = new Map<number, ClienteRestricao>();
        clienteRestricoes.forEach(r => {
            if (r.Ativo !== false && r.Cod_Cliente) {
                map.set(Number(r.Cod_Cliente), r);
            }
        });
        return map;
    }, [clienteRestricoes]);

    const loadClienteRestricoes = useCallback(async () => {
        try {
            const res = await getClienteRestricoes();
            if (res && res.success && Array.isArray(res.restricoes)) {
                setClienteRestricoes(res.restricoes);
                if (res.lastAudit) {
                    setLastRestricaoAudit(res.lastAudit);
                }
            }
        } catch (err) {
            console.warn('[Fuel360] Erro ao carregar particularidades de clientes:', err);
        }
    }, []);

    useEffect(() => {
        loadClienteRestricoes();
    }, [loadClienteRestricoes]);

    const handleOpenNewRestricaoModal = (client?: VisitaPrevista | { Cod_Cliente: number; Razao_Social?: string }) => {
        setRestricaoSaveFeedback(null);
        if (client) {
            const existing = clienteRestricoesMap.get(Number(client.Cod_Cliente));
            if (existing) {
                setEditingRestricaoId(existing.ID_Restricao || null);
                setFormCodCliente(String(existing.Cod_Cliente));
                setFormRazaoSocial(existing.Razao_Social || client.Razao_Social || '');
                setFormDiasPermitidos(existing.DiasPermitidos ? existing.DiasPermitidos.split(',').map(s => s.trim()) : []);
                setFormTurnoPermitido((existing.TurnoPermitido as any) || 'QUALQUER');
                setFormObservacao(existing.Observacao || '');
            } else {
                setEditingRestricaoId(null);
                setFormCodCliente(String(client.Cod_Cliente));
                setFormRazaoSocial(client.Razao_Social || '');
                setFormDiasPermitidos([]);
                setFormTurnoPermitido('QUALQUER');
                setFormObservacao('');
            }
        } else {
            setEditingRestricaoId(null);
            setFormCodCliente('');
            setFormRazaoSocial('');
            setFormDiasPermitidos([]);
            setFormTurnoPermitido('QUALQUER');
            setFormQuinzenaPermitida('QUALQUER');
            setFormObservacao('');
        }
        setShowRestricoesModal(true);
    };

    const handleSaveRestricao = async () => {
        const cod = parseInt(formCodCliente, 10);
        if (isNaN(cod) || cod <= 0) {
            setRestricaoSaveFeedback({ type: 'error', message: 'Informe um Código de Cliente válido.' });
            return;
        }

        setSavingRestricao(true);
        setRestricaoSaveFeedback(null);
        try {
            const itemToSave: ClienteRestricao = {
                Cod_Cliente: cod,
                Razao_Social: formRazaoSocial.trim() || undefined,
                DiasPermitidos: formDiasPermitidos.length > 0 ? formDiasPermitidos.join(',') : undefined,
                TurnoPermitido: formTurnoPermitido,
                QuinzenaPermitida: formQuinzenaPermitida,
                Observacao: formObservacao.trim() || undefined,
                Ativo: true
            };

            const res = await saveClienteRestricoesBatch([itemToSave]);
            if (res && res.success) {
                setClienteRestricoes(res.restricoes || []);
                if (res.lastAudit) setLastRestricaoAudit(res.lastAudit);
                setRestricaoSaveFeedback({ type: 'success', message: 'Particularidade salva com sucesso no SQL Server corporativo!' });
                setEditingRestricaoId(null);
                setFormCodCliente('');
                setFormRazaoSocial('');
                setFormDiasPermitidos([]);
                setFormTurnoPermitido('QUALQUER');
                setFormQuinzenaPermitida('QUALQUER');
                setFormObservacao('');
            } else {
                setRestricaoSaveFeedback({ type: 'error', message: res?.message || 'Erro ao salvar no banco.' });
            }
        } catch (err: any) {
            setRestricaoSaveFeedback({ type: 'error', message: 'Erro ao salvar: ' + (err.message || 'Erro desconhecido') });
        } finally {
            setSavingRestricao(false);
        }
    };

    const handleDeleteRestricao = async (idOrCod: number) => {
        if (!confirm('Deseja realmente remover esta particularidade? O cliente voltará ao atendimento padrão sem restrições de janela.')) {
            return;
        }
        try {
            const res = await deleteClienteRestricao(idOrCod);
            if (res && res.success) {
                setClienteRestricoes(res.restricoes || []);
                if (res.lastAudit) setLastRestricaoAudit(res.lastAudit);
                if (formCodCliente === String(idOrCod)) {
                    setEditingRestricaoId(null);
                    setFormCodCliente('');
                    setFormRazaoSocial('');
                    setFormDiasPermitidos([]);
                    setFormTurnoPermitido('QUALQUER');
                    setFormQuinzenaPermitida('QUALQUER');
                    setFormObservacao('');
                }
            }
        } catch (err: any) {
            alert('Erro ao excluir: ' + (err.message || 'Erro de conexão'));
        }
    };

    // Resumo Operacional de Rotas (KM e Tempo)
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summarySellerFilter, setSummarySellerFilter] = useState<string>('ALL');

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
    const [originalPolylines, setOriginalPolylines] = useState<{ 
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
    const [selectedTeamSellers, setSelectedTeamSellers] = useState<Set<string>>(new Set());
    const [showTeamSellerDropdown, setShowTeamSellerDropdown] = useState(false);

    // Escopo de Roteirização: 'geral' (todos), 'equipe' (supervisor) ou 'vendedor' (individual)
    const [scopeMode, setScopeMode] = useState<'geral' | 'equipe' | 'vendedor'>('geral');
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');
    const [selectedSeller, setSelectedSeller] = useState<string>('');

    // Ordenação dinâmica da Grade de Ajuste Fino
    const [sortField, setSortField] = useState<'Sequencia' | 'Cod_Cliente' | 'Razao_Social' | 'Endereco' | 'Nome_Vendedor' | 'Dia_Semana' | 'Periodicidade'>('Cod_Cliente');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Filtros Interativos da Grade de Ajuste Fino e Mapa
    const [selectedDaysFilter, setSelectedDaysFilter] = useState<string[]>([]);
    const [selectedQuinzenaFilter, setSelectedQuinzenaFilter] = useState<'ALL' | '1_3' | '2_4'>('ALL');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [sidebarActiveTab, setSidebarActiveTab] = useState<'params' | 'colabs' | 'all'>('params');
    const [collaboratorSearchQuery, setCollaboratorSearchQuery] = useState<string>('');

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

    // Formatador padronizado de vendedor/promotor com prefixo de código de setor (ex: "101 - Henrique Souza Silva")
    const formatSellerDisplayName = (sellerId?: number | string, sellerName?: string): string => {
        const sId = sellerId !== undefined && sellerId !== null ? Number(sellerId) : null;
        let name = (sellerName || '').trim();
        if (!name && sId) {
            const col = getColabBySectorOrName(sId);
            name = col?.Nome || `Colaborador ${sId}`;
        }
        if (!name) return 'Colaborador';
        // Se já possui o prefixo "101 - ...", retorna direto
        if (/^\d+\s*-\s*/.test(name)) {
            return name;
        }
        if (sId && !isNaN(sId) && sId > 0) {
            return `${sId} - ${name}`;
        }
        // Tenta buscar o código do setor caso sId não tenha sido fornecido
        const col = getColabBySectorOrName(0, name);
        if (col?.CodigoSetor) {
            return `${col.CodigoSetor} - ${name}`;
        }
        return name;
    };

    const formatSupervisorDisplayName = (supId?: string | number, supName?: string): string => {
        let name = (supName || '').trim();
        if (!name && supId && supId !== 'SEM_SUPERVISOR') {
            name = `Supervisão ${supId}`;
        }
        if (!name) return 'Equipe sem Supervisor';

        // Se já possui o prefixo numérico "10 - ...", retorna direto
        if (/^\d+\s*-\s*/.test(name)) {
            return name;
        }

        const idNum = Number(supId);
        if (supId && !isNaN(idNum) && idNum > 0) {
            return `${idNum} - ${name}`;
        }

        if (supId && supId !== 'SEM_SUPERVISOR' && !name.includes(String(supId))) {
            return `${supId} - ${name}`;
        }

        return name;
    };

    // Supervisores únicos presentes nas rotas com código prefixado
    const supervisors = useMemo(() => {
        const map = new Map<string, { id: string; name: string; cod: number }>();
        adjustedRoutes.forEach(r => {
            const supId = r.Cod_Supervisor ? String(r.Cod_Supervisor) : 'SEM_SUPERVISOR';
            const rawNome = r.Nome_Supervisor || 'Equipe sem Supervisor';
            const cod = Number(r.Cod_Supervisor) || 0;
            if (!map.has(supId)) {
                map.set(supId, {
                    id: supId,
                    name: formatSupervisorDisplayName(supId, rawNome),
                    cod
                });
            }
        });
        return Array.from(map.values())
            .sort((a, b) => {
                if (a.cod > 0 && b.cod > 0) return a.cod - b.cod;
                return a.name.localeCompare(b.name);
            });
    }, [adjustedRoutes]);

    // Vendedores disponíveis conforme escopo
    const availableSellers = useMemo(() => {
        const map = new Map<number, { id: number; name: string; supId: string; clientCount: number }>();
        const uniqueClientsMap = new Map<number, Set<number>>();
        adjustedRoutes.forEach(r => {
            const supId = r.Cod_Supervisor ? String(r.Cod_Supervisor) : 'SEM_SUPERVISOR';
            if (scopeMode === 'equipe' && selectedSupervisor && supId !== selectedSupervisor) {
                return;
            }
            if (!map.has(r.Cod_Vend)) {
                map.set(r.Cod_Vend, { id: r.Cod_Vend, name: formatSellerDisplayName(r.Cod_Vend, r.Nome_Vendedor), supId, clientCount: 0 });
                uniqueClientsMap.set(r.Cod_Vend, new Set());
            }
            if (r.Cod_Cliente) {
                uniqueClientsMap.get(r.Cod_Vend)?.add(r.Cod_Cliente);
            }
        });
        uniqueClientsMap.forEach((clients, vId) => {
            const seller = map.get(vId);
            if (seller) seller.clientCount = clients.size;
        });
        if (map.size === 0 && teamColaboradores.length > 0) {
            teamColaboradores.forEach(c => {
                map.set(c.CodigoSetor, {
                    id: c.CodigoSetor,
                    name: formatSellerDisplayName(c.CodigoSetor, c.Nome),
                    supId: 'SEM_SUPERVISOR',
                    clientCount: 0
                });
            });
        }
        return Array.from(map.values()).sort((a, b) => {
            const numA = Number(a.id);
            const numB = Number(b.id);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        });
    }, [adjustedRoutes, scopeMode, selectedSupervisor, teamColaboradores]);

    // Todos os vendedores/setores presentes na rota ajustada (para extinção e redistribuição)
    const allAdjustedSellers = useMemo(() => {
        const map = new Map<number, { id: number; name: string; clientCount: number }>();
        adjustedRoutes.forEach(r => {
            if (!map.has(r.Cod_Vend)) {
                map.set(r.Cod_Vend, { id: r.Cod_Vend, name: formatSellerDisplayName(r.Cod_Vend, r.Nome_Vendedor), clientCount: 0 });
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

    // Estado para foco isolado de um vendedor no mapa
    const [focusedMapSellerId, setFocusedMapSellerId] = useState<number | null>(null);

    // Identificar se a visão atual está focada em um vendedor individual (para ativar distinção de dias/quinzenas)
    const isSingleSellerView = useMemo(() => {
        if (focusedMapSellerId !== null) return true;
        if (scopeMode === 'vendedor' && selectedSeller) return true;
        if (selectedPromoter !== 'ALL') return true;
        if (selectedTeamSellers.size === 1) return true;
        const uniqueSellersInScope = new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend));
        return uniqueSellersInScope.size === 1;
    }, [focusedMapSellerId, scopeMode, selectedSeller, selectedPromoter, selectedTeamSellers, scopedAdjustedRoutes]);

    // Mapeamento de cores dos colaboradores
    const promoterColorMap = useMemo(() => {
        const map = new Map<string, string>();
        const uniqueIds = Array.from(new Set(originalRoutes.map(v => String(v.Cod_Vend))));
        uniqueIds.forEach((id, idx) => {
            map.set(id, PROMOTER_COLORS[idx % PROMOTER_COLORS.length]);
        });
        return map;
    }, [originalRoutes]);

    // Lista de vendedores pertencentes ao escopo atual para o filtro multi-select no Ajuste Fino
    const availableTeamSellers = useMemo(() => {
        const sellerIds = Array.from(new Set(scopedAdjustedRoutes.map(r => String(r.Cod_Vend)))).filter(Boolean);
        return sellerIds.map(sellerId => {
            const sellerVisits = scopedAdjustedRoutes.filter(v => String(v.Cod_Vend) === sellerId);
            const colab = getColabBySectorOrName(Number(sellerId), sellerVisits[0]?.Nome_Vendedor);
            const displayName = formatSellerDisplayName(Number(sellerId), colab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : `Colaborador ${sellerId}`));
            const color = promoterColorMap.get(String(sellerId)) || '#64748b';
            return {
                id: sellerId,
                name: displayName,
                color,
                count: sellerVisits.length
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [scopedAdjustedRoutes, getColabBySectorOrName, formatSellerDisplayName, promoterColorMap]);

    const handleToggleTeamSeller = (sellerId: string) => {
        setSelectedTeamSellers(prev => {
            const next = new Set(prev);
            if (next.has(sellerId)) {
                next.delete(sellerId);
            } else {
                next.add(sellerId);
            }
            if (next.size === 1) {
                setSelectedPromoter(Array.from(next)[0]);
            } else {
                setSelectedPromoter('ALL');
            }
            return next;
        });
    };

    const handleSelectOnlySeller = (sellerId: string) => {
        setSelectedTeamSellers(new Set([sellerId]));
        setSelectedPromoter(sellerId);
    };

    const handleSelectAllTeamSellers = () => {
        setSelectedTeamSellers(new Set());
        setSelectedPromoter('ALL');
    };

    // Escopo efetivo de rotas refinado pelo filtro de vendedores selecionados
    const effectiveScopedRoutes = useMemo(() => {
        if (selectedTeamSellers.size > 0) {
            return scopedAdjustedRoutes.filter(r => selectedTeamSellers.has(String(r.Cod_Vend)));
        }
        if (selectedPromoter !== 'ALL') {
            return scopedAdjustedRoutes.filter(r => String(r.Cod_Vend) === selectedPromoter);
        }
        return scopedAdjustedRoutes;
    }, [scopedAdjustedRoutes, selectedTeamSellers, selectedPromoter]);

    const effectiveSellersList = useMemo(() => {
        return Array.from(new Set(effectiveScopedRoutes.map(r => String(r.Cod_Vend))))
            .sort((a, b) => Number(a) - Number(b));
    }, [effectiveScopedRoutes]);

    const isSingleSeller = effectiveSellersList.length === 1;
    const isMultipleSellers = effectiveSellersList.length > 1;

    // Rotas ajustadas com os filtros interativos aplicados (vendedores da equipe, dias da semana e quinzenas)
    const filteredRoutes = useMemo(() => {
        return effectiveScopedRoutes.filter(v => {
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
    }, [effectiveScopedRoutes, selectedDaysFilter, selectedQuinzenaFilter]);

    // Pontos geográficos para renderização do Mapa de Calor (Heatmap)
    const heatmapPoints = useMemo(() => {
        const sourceRoutes = focusedMapSellerId ? filteredRoutes.filter(v => v.Cod_Vend === focusedMapSellerId) : filteredRoutes;
        return sourceRoutes
            .filter(v => v.Lat && v.Long)
            .map(v => ({ lat: v.Lat, lng: v.Long }));
    }, [filteredRoutes, focusedMapSellerId]);

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
            const rawNome = after?.Nome_Vendedor || before?.Nome_Vendedor || '';
            const nomeVendedor = formatSellerDisplayName(codVend, rawNome);

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

    // Lista de dias visíveis na Grade de Ajuste Fino (considerando filtros ativos e clientes sem atendimento)
    const visibleDays = useMemo(() => {
        let days = selectedDaysFilter.length > 0 ? selectedDaysFilter : [...WEEKDAYS];
        const hasUnallocated = sortedRoutes.some(r => r.Dia_Semana === 'SEM ATENDIMENTO');
        if (hasUnallocated && !days.includes('SEM ATENDIMENTO')) {
            days = [...days, 'SEM ATENDIMENTO'];
        }
        return days;
    }, [selectedDaysFilter, sortedRoutes]);

    // Funções explícitas e determinísticas para expandir e recolher todas as sanfonas da grade
    const handleExpandAllDays = () => {
        setOpenSellersMap(prev => {
            const allOpen: Record<string, boolean> = { ...prev };
            effectiveSellersList.forEach(s => { allOpen[s] = true; });
            return allOpen;
        });
        setOpenDaysMap(prev => {
            const allOpen: Record<string, boolean> = { ...prev };
            visibleDays.forEach(d => { 
                allOpen[d] = true; 
                effectiveSellersList.forEach(s => { allOpen[`${s}-${d}`] = true; });
            });
            WEEKDAYS.forEach(d => { 
                allOpen[d] = true; 
                effectiveSellersList.forEach(s => { allOpen[`${s}-${d}`] = true; });
            });
            allOpen['SEM ATENDIMENTO'] = true;
            effectiveSellersList.forEach(s => { allOpen[`${s}-SEM ATENDIMENTO`] = true; });
            return allOpen;
        });
    };

    const handleCollapseAllDays = () => {
        setOpenSellersMap({});
        setOpenDaysMap({});
    };

    // Função auxiliar para calcular o Resumo Operacional de um conjunto de visitas (KM, Tempo e Balanceamento)
    const calcOperationalSummaryForRoutes = useCallback((routesToAnalyze: VisitaPrevista[]) => {
        const uniqueClients = deduplicateVisitasPrevistas(routesToAnalyze);
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
            travelTime13: number;
            serviceTime13: number;
            pdvs24: number;
            km24: number;
            time24: number;
            travelTime24: number;
            serviceTime24: number;
            avgPdvs: number;
            maxSellerTime13?: number;
            maxSellerTime24?: number;
            anySellerOverloaded?: boolean;
        }> = [];

        const dayMap: Record<string, {
            day: string;
            pdvs13: number;
            km13: number;
            time13: number;
            travelTime13: number;
            serviceTime13: number;
            pdvs24: number;
            km24: number;
            time24: number;
            travelTime24: number;
            serviceTime24: number;
            totalKm: number;
            totalTime: number;
            totalTravelTime: number;
            totalServiceTime: number;
            maxSellerTime13?: number;
            maxSellerTime24?: number;
            anySellerOverloaded?: boolean;
        }> = {};

        let totalPdvs13 = 0;
        let totalPdvs24 = 0;
        let totalKm13 = 0;
        let totalKm24 = 0;
        let totalTime13 = 0;
        let totalTime24 = 0;
        let totalTravelTime13 = 0;
        let totalServiceTime13 = 0;
        let totalTravelTime24 = 0;
        let totalServiceTime24 = 0;

        const sellerDayMap: Record<string, {
            day: string;
            pdvs13: number;
            km13: number;
            time13: number;
            travelTime13: number;
            serviceTime13: number;
            pdvs24: number;
            km24: number;
            time24: number;
            travelTime24: number;
            serviceTime24: number;
            totalKm: number;
            totalTime: number;
            maxSellerTime13?: number;
            maxSellerTime24?: number;
            isOverloaded?: boolean;
        }> = {};

        WEEKDAYS.forEach(day => {
            const dayVisits = routesToAnalyze.filter(r => r.Dia_Semana === day);

            // Agrupar visitas por vendedor para calcular circuitos individuais a partir da base de cada um
            const sellerVisitsMap = new Map<number, VisitaPrevista[]>();
            dayVisits.forEach(v => {
                const sId = Number(v.Cod_Vend);
                if (!sellerVisitsMap.has(sId)) sellerVisitsMap.set(sId, []);
                sellerVisitsMap.get(sId)!.push(v);
            });

            let dayKm13 = 0;
            let dayTravelTime13 = 0;
            let dayServiceTime13 = 0;
            let dayPdvs13 = 0;

            let dayKm24 = 0;
            let dayTravelTime24 = 0;
            let dayServiceTime24 = 0;
            let dayPdvs24 = 0;

            let maxSellerTime13 = 0;
            let maxSellerTime24 = 0;
            let anySellerOverloaded = false;

            const dayLimitHours = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
            const dayLimitMin = dayLimitHours * 60;

            sellerVisitsMap.forEach((sellerVisits, sellerId) => {
                const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);
                const baseLat = colab?.LatitudeBase || sellerVisits.find(v => v.Lat)?.Lat || 0;
                const baseLng = colab?.LongitudeBase || sellerVisits.find(v => v.Long)?.Long || 0;
                const baseCoord = { lat: baseLat, lng: baseLng };

                // Quinzena 1/3 (Semanais + Quinzenal 1/3)
                const v13 = sellerVisits.filter(r => {
                    const p = parsePeriodicidade(r.Periodicidade).tipo;
                    return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
                });
                dayPdvs13 += v13.length;
                const srv13 = v13.reduce((sum, v) => sum + getClientServiceTime(v), 0);
                dayServiceTime13 += srv13;

                // Ordenar paradas sequencialmente para cálculo do circuito
                const stops13 = v13.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long, seq: v.Sequencia_13 }));
                const orderedStops13 = stops13.some(s => s.seq !== undefined && s.seq > 0)
                    ? [...stops13].sort((a, b) => (a.seq || 0) - (b.seq || 0))
                    : optimizeDayCircuit2Opt(baseCoord, stops13, optEndAtLastClient);

                const metrics13 = orderedStops13.length > 0 ? calcCircuitMetrics(baseCoord, orderedStops13, optEndAtLastClient) : { totalKm: 0, travelMinutes: 0 };
                dayKm13 += metrics13.totalKm;
                dayTravelTime13 += metrics13.travelMinutes;

                const sellerTotalTime13 = metrics13.travelMinutes + srv13;
                if (sellerTotalTime13 > maxSellerTime13) maxSellerTime13 = sellerTotalTime13;

                // Quinzena 2/4 (Semanais + Quinzenal 2/4)
                const v24 = sellerVisits.filter(r => {
                    const p = parsePeriodicidade(r.Periodicidade).tipo;
                    return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
                });
                dayPdvs24 += v24.length;
                const srv24 = v24.reduce((sum, v) => sum + getClientServiceTime(v), 0);
                dayServiceTime24 += srv24;

                const stops24 = v24.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long, seq: v.Sequencia_24 }));
                const orderedStops24 = stops24.some(s => s.seq !== undefined && s.seq > 0)
                    ? [...stops24].sort((a, b) => (a.seq || 0) - (b.seq || 0))
                    : optimizeDayCircuit2Opt(baseCoord, stops24, optEndAtLastClient);

                const metrics24 = orderedStops24.length > 0 ? calcCircuitMetrics(baseCoord, orderedStops24, optEndAtLastClient) : { totalKm: 0, travelMinutes: 0 };
                dayKm24 += metrics24.totalKm;
                dayTravelTime24 += metrics24.travelMinutes;

                const sellerTotalTime24 = metrics24.travelMinutes + srv24;
                if (sellerTotalTime24 > maxSellerTime24) maxSellerTime24 = sellerTotalTime24;

                const sellerMaxTime = Math.max(sellerTotalTime13, sellerTotalTime24);
                const isSellerDayOverloaded = optLimitHours ? (sellerMaxTime > dayLimitMin && (sellerMaxTime - dayLimitMin) >= 60) : false;
                if (isSellerDayOverloaded) {
                    anySellerOverloaded = true;
                }

                sellerDayMap[`${sellerId}-${day}`] = {
                    day,
                    pdvs13: v13.length,
                    km13: metrics13.totalKm,
                    time13: sellerTotalTime13,
                    travelTime13: metrics13.travelMinutes,
                    serviceTime13: srv13,
                    pdvs24: v24.length,
                    km24: metrics24.totalKm,
                    time24: sellerTotalTime24,
                    travelTime24: metrics24.travelMinutes,
                    serviceTime24: srv24,
                    totalKm: Math.round((metrics13.totalKm + metrics24.totalKm) * 10) / 10,
                    totalTime: sellerTotalTime13 + sellerTotalTime24,
                    maxSellerTime13: sellerTotalTime13,
                    maxSellerTime24: sellerTotalTime24,
                    isOverloaded: isSellerDayOverloaded
                };
            });

            dayKm13 = Math.round(dayKm13 * 10) / 10;
            dayKm24 = Math.round(dayKm24 * 10) / 10;
            const totalDayTime13 = dayTravelTime13 + dayServiceTime13;
            const totalDayTime24 = dayTravelTime24 + dayServiceTime24;

            totalPdvs13 += dayPdvs13;
            totalPdvs24 += dayPdvs24;
            totalKm13 += dayKm13;
            totalKm24 += dayKm24;
            totalTime13 += totalDayTime13;
            totalTime24 += totalDayTime24;
            totalTravelTime13 += dayTravelTime13;
            totalServiceTime13 += dayServiceTime13;
            totalTravelTime24 += dayTravelTime24;
            totalServiceTime24 += dayServiceTime24;

            const dayObj = {
                day,
                pdvs13: dayPdvs13,
                km13: dayKm13,
                time13: totalDayTime13,
                travelTime13: dayTravelTime13,
                serviceTime13: dayServiceTime13,
                pdvs24: dayPdvs24,
                km24: dayKm24,
                time24: totalDayTime24,
                travelTime24: dayTravelTime24,
                serviceTime24: dayServiceTime24,
                avgPdvs: Math.round(((dayPdvs13 + dayPdvs24) / 2) * 10) / 10,
                maxSellerTime13,
                maxSellerTime24,
                anySellerOverloaded
            };

            daysMetrics.push(dayObj);
            dayMap[day] = {
                day,
                pdvs13: dayPdvs13,
                km13: dayKm13,
                time13: totalDayTime13,
                travelTime13: dayTravelTime13,
                serviceTime13: dayServiceTime13,
                pdvs24: dayPdvs24,
                km24: dayKm24,
                time24: totalDayTime24,
                travelTime24: dayTravelTime24,
                serviceTime24: dayServiceTime24,
                totalKm: Math.round((dayKm13 + dayKm24) * 10) / 10,
                totalTime: totalDayTime13 + totalDayTime24,
                totalTravelTime: dayTravelTime13 + dayTravelTime24,
                totalServiceTime: dayServiceTime13 + dayServiceTime24,
                maxSellerTime13,
                maxSellerTime24,
                anySellerOverloaded
            };
        });

        const unallocatedVisits = routesToAnalyze.filter(r => r.Dia_Semana === 'SEM ATENDIMENTO');
        const unallocatedCount = unallocatedVisits.length;

        const diffPdvs = Math.abs(totalPdvs13 - totalPdvs24);
        const maxPdvs = Math.max(totalPdvs13, totalPdvs24);
        const imbalancePct = maxPdvs > 0 ? Math.round((diffPdvs / maxPdvs) * 100) : 0;
        const totalVisitsMonth = (totalPdvs13 * 2) + (totalPdvs24 * 2);

        return {
            uniqueClientsCount: uniqueClients.length,
            semanalCount,
            quinzenal13Count,
            quinzenal24Count,
            daysMetrics,
            dayMap,
            sellerDayMap,
            totalPdvs13,
            totalPdvs24,
            totalVisitsMonth,
            totalKm13: Math.round(totalKm13 * 10) / 10,
            totalKm24: Math.round(totalKm24 * 10) / 10,
            totalTime13,
            totalTime24,
            totalTravelTime13,
            totalServiceTime13,
            totalTravelTime24,
            totalServiceTime24,
            totalTravelTimeMonth: (totalTravelTime13 * 2) + (totalTravelTime24 * 2),
            totalServiceTimeMonth: (totalServiceTime13 * 2) + (totalServiceTime24 * 2),
            imbalancePct,
            isBalanced: imbalancePct <= 15,
            unallocatedCount
        };
    }, [colaboradores, getClientServiceTime, optLimitHours, optMaxHours, optSatHalfPeriod, optEndAtLastClient]);

    // Resumo Operacional Consolidado de KM, Tempo e Balanceamento Quinzena a Quinzena (Escopo Ativo)
    const operationalSummary = useMemo(() => {
        return calcOperationalSummaryForRoutes(effectiveScopedRoutes);
    }, [calcOperationalSummaryForRoutes, effectiveScopedRoutes]);

    // Resumo Operacional específico do Modal (suporte a análise vendedor a vendedor)
    const modalOperationalSummary = useMemo(() => {
        if (summarySellerFilter === 'ALL') return operationalSummary;
        const sellerRoutes = effectiveScopedRoutes.filter(r => String(r.Cod_Vend) === summarySellerFilter);
        return calcOperationalSummaryForRoutes(sellerRoutes);
    }, [summarySellerFilter, operationalSummary, effectiveScopedRoutes, calcOperationalSummaryForRoutes]);

    // Auto-dismiss do toast de reequilíbrio
    useEffect(() => {
        if (!rebalanceToast) return;
        const timer = setTimeout(() => setRebalanceToast(null), 5000);
        return () => clearTimeout(timer);
    }, [rebalanceToast]);

    // Lista de dias com jornada excedente / sobrecarregada (>= 60min acima da jornada configurada) ou dias inativos com clientes
    const overloadedDays = useMemo(() => {
        if (!optLimitHours) return [];
        const activeDaysSet = new Set(optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
        const routesToAnalyze = effectiveScopedRoutes;
        const isSingleSellerView = (selectedTeamSellers.size === 1) || (selectedPromoter !== 'ALL');

        return WEEKDAYS.filter(day => {
            const dayMetrics = operationalSummary.dayMap[day];
            if (!dayMetrics) return false;
            const pdvsCount = routesToAnalyze.filter(r => r.Dia_Semana === day).length;
            if (pdvsCount === 0) return false;

            const isInactiveDay = !activeDaysSet.has(day);
            if (isInactiveDay) {
                // Se é dia inativo no calendário mas tem PDVs alocados, é sobrecarga crítica (deve ser reequilibrado/evacuado)
                return true;
            }

            const dayLimitHours = (day === 'SÁBADO' && optSatHalfPeriod) 
                ? optMaxHours / 2 
                : optMaxHours;
            const dayLimitMin = dayLimitHours * 60;

            if (isSingleSellerView) {
                const maxDayTime = Math.max(dayMetrics.time13, dayMetrics.time24);
                return maxDayTime > dayLimitMin && (maxDayTime - dayLimitMin) >= 60;
            } else {
                return Boolean(dayMetrics.anySellerOverloaded);
            }
        });
    }, [operationalSummary.dayMap, optLimitHours, optMaxHours, optSatHalfPeriod, optDays, effectiveScopedRoutes, selectedTeamSellers.size, selectedPromoter]);

    // Lista de dias em atenção de jornada (< 60min acima da jornada configurada)
    const attentionDays = useMemo(() => {
        if (!optLimitHours) return [];
        const activeDaysSet = new Set(optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
        const isSingleSellerView = (selectedTeamSellers.size === 1) || (selectedPromoter !== 'ALL');
        return WEEKDAYS.filter(day => {
            if (!activeDaysSet.has(day)) return false; // Dias inativos com PDVs caem em overloadedDays
            const dayMetrics = operationalSummary.dayMap[day];
            if (!dayMetrics) return false;
            const dayLimitHours = (day === 'SÁBADO' && optSatHalfPeriod) 
                ? optMaxHours / 2 
                : optMaxHours;
            const dayLimitMin = dayLimitHours * 60;
            const maxDayTime = isSingleSellerView
                ? Math.max(dayMetrics.time13, dayMetrics.time24)
                : Math.max(dayMetrics.maxSellerTime13 || 0, dayMetrics.maxSellerTime24 || 0);
            const excess = maxDayTime - dayLimitMin;
            return excess > 0 && excess < 60;
        });
    }, [operationalSummary.dayMap, optLimitHours, optMaxHours, optSatHalfPeriod, optDays, selectedTeamSellers.size, selectedPromoter]);

    // Dados consolidados para o modal de reequilíbrio de carga
    const rebalanceData = useMemo(() => {
        if (!rebalanceDay || !optLimitHours) return null;

        const activeDays = optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA'];
        const activeDaysSet = new Set(activeDays);
        const sourceDay = rebalanceDay;
        const isSourceInactive = !activeDaysSet.has(sourceDay);
        const sourceMetrics = operationalSummary.dayMap[sourceDay];

        // Se a fonte for um dia inativo no calendário de trabalho (ex: Sábado desmarcado), seu teto é 0h e todos os minutos/clientes são excedentes
        const sourceLimitHours = isSourceInactive 
            ? 0 
            : ((sourceDay === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours);
        const sourceLimitMin = sourceLimitHours * 60;
        const sourceTime13 = sourceMetrics?.time13 || 0;
        const sourceTime24 = sourceMetrics?.time24 || 0;
        const sourceMaxTime = Math.max(sourceTime13, sourceTime24);
        const sourceExcessMin = isSourceInactive 
            ? sourceMaxTime 
            : Math.max(0, sourceMaxTime - sourceLimitMin);

        // Clientes pertencentes a este dia no escopo atual
        const routesToAnalyze = effectiveScopedRoutes;
        const clientsOnDay = routesToAnalyze.filter(r => r.Dia_Semana === sourceDay);
        const uniqueClientsMap = new Map<number, VisitaPrevista>();
        clientsOnDay.forEach(c => {
            if (!uniqueClientsMap.has(c.Cod_Cliente)) {
                uniqueClientsMap.set(c.Cod_Cliente, c);
            }
        });
        const uniqueClients = Array.from(uniqueClientsMap.values());

        // Análise dos outros dias da semana: APENAS DIAS ATIVOS NO CALENDÁRIO DE JORNADA
        const otherDays = activeDays.filter(d => d !== sourceDay).map(day => {
            const m = operationalSummary.dayMap[day];
            const limitHours = (day === 'SÁBADO' && optSatHalfPeriod) 
                ? optMaxHours / 2 
                : optMaxHours;
            const limitMin = limitHours * 60;
            const time13 = m?.time13 || 0;
            const time24 = m?.time24 || 0;
            const isSingleSellerView = (selectedTeamSellers.size === 1) || (selectedPromoter !== 'ALL');
            const maxTime = isSingleSellerView
                ? Math.max(time13, time24)
                : Math.max(m?.maxSellerTime13 || 0, m?.maxSellerTime24 || 0);
            const freeMinutes = Math.max(0, limitMin - maxTime);
            const pdvsCount = routesToAnalyze.filter(r => r.Dia_Semana === day).length;
            const dayCfg = DAY_COLORS[day] || { hex: '#4f46e5', label: day, bg: 'bg-indigo-600' };

            let status: 'high' | 'medium' | 'full';
            if (freeMinutes >= 60) status = 'high';
            else if (freeMinutes > 0) status = 'medium';
            else status = 'full';

            return {
                day,
                limitHours,
                limitMin,
                maxTime,
                freeMinutes,
                pdvsCount,
                dayCfg,
                status
            };
        });

        // Ordena dias receptores pelo maior tempo livre
        otherDays.sort((a, b) => b.freeMinutes - a.freeMinutes);
        const bestTargetDay = otherDays.length > 0 && otherDays[0].freeMinutes > 0 ? otherDays[0] : (otherDays.length > 0 ? otherDays[0] : null);

        return {
            sourceDay,
            isSourceInactive,
            sourceMetrics,
            sourceLimitHours,
            sourceLimitMin,
            sourceMaxTime,
            sourceExcessMin,
            uniqueClients,
            otherDays,
            bestTargetDay
        };
    }, [rebalanceDay, operationalSummary.dayMap, effectiveScopedRoutes, selectedTeamSellers.size, selectedPromoter, optLimitHours, optMaxHours, optSatHalfPeriod, optDays]);

    // Executar Reequilíbrio Automático em 1 Clique
    const handleAutoRebalance = () => {
        if (!rebalanceData || !rebalanceData.bestTargetDay) {
            alert("Nenhum dia ativo com capacidade ociosa encontrado para reequilíbrio automático.");
            return;
        }

        const targetDay = rebalanceData.bestTargetDay.day;
        const targetFreeMin = rebalanceData.bestTargetDay.freeMinutes;
        const isSourceInactive = rebalanceData.isSourceInactive;

        // Se o dia de origem for inativo (ex: Sábado com PDVs), transferir TODOS os clientes para desocupar o dia
        if (isSourceInactive) {
            const allClientIds = new Set(rebalanceData.uniqueClients.map(c => c.Cod_Cliente));
            setAdjustedRoutes(prev => prev.map(v => {
                if (v.Dia_Semana === rebalanceData.sourceDay && allClientIds.has(v.Cod_Cliente)) {
                    return {
                        ...v,
                        Dia_Semana: targetDay
                    };
                }
                return v;
            }));

            const count = allClientIds.size;
            setRebalanceToast(`✓ Evacuação de jornada concluída! ${count} ${count === 1 ? 'cliente transferido' : 'clientes transferidos'} de ${rebalanceData.sourceDay} (dia sem expediente) para ${targetDay}.`);
            setRebalanceDay(null);
            setSelectedRebalanceClients(new Set());
            setTargetRebalanceDay('');
            return;
        }

        let excessToCover = rebalanceData.sourceExcessMin;
        if (excessToCover <= 0) {
            excessToCover = 45;
        }

        // Ordenar clientes pelo tempo em loja + percurso médio estimado
        const clientsWithTime = rebalanceData.uniqueClients.map(c => {
            const sTime = getClientServiceTime(c) + 12;
            return { client: c, estTime: sTime };
        });

        const clientsToMove: number[] = [];
        let accumulatedTime = 0;

        for (const item of clientsWithTime) {
            if (accumulatedTime + item.estTime <= targetFreeMin + 30 || clientsToMove.length === 0) {
                clientsToMove.push(item.client.Cod_Cliente);
                accumulatedTime += item.estTime;
                if (accumulatedTime >= excessToCover) {
                    break;
                }
            }
        }

        if (clientsToMove.length === 0 && clientsWithTime.length > 0) {
            clientsToMove.push(clientsWithTime[0].client.Cod_Cliente);
        }

        const toMoveSet = new Set(clientsToMove);

        setAdjustedRoutes(prev => prev.map(v => {
            if (v.Dia_Semana === rebalanceData.sourceDay && toMoveSet.has(v.Cod_Cliente)) {
                return {
                    ...v,
                    Dia_Semana: targetDay
                };
            }
            return v;
        }));

        const count = clientsToMove.length;
        setRebalanceToast(`✓ Reequilíbrio concluído! ${count} ${count === 1 ? 'cliente transferido' : 'clientes transferidos'} de ${rebalanceData.sourceDay} para ${targetDay}.`);
        setRebalanceDay(null);
        setSelectedRebalanceClients(new Set());
        setTargetRebalanceDay('');
    };

    // Executar Transferência Manual dos Clientes Selecionados
    const handleManualRebalanceApply = () => {
        if (!rebalanceData) return;
        if (selectedRebalanceClients.size === 0) {
            alert("Selecione ao menos um cliente da lista para transferir.");
            return;
        }
        if (!targetRebalanceDay) {
            alert("Selecione o dia de destino para os clientes selecionados.");
            return;
        }

        const count = selectedRebalanceClients.size;
        setAdjustedRoutes(prev => prev.map(v => {
            if (v.Dia_Semana === rebalanceData.sourceDay && selectedRebalanceClients.has(v.Cod_Cliente)) {
                return {
                    ...v,
                    Dia_Semana: targetRebalanceDay
                };
            }
            return v;
        }));

        setRebalanceToast(`✓ Sucesso! ${count} ${count === 1 ? 'cliente transferido' : 'clientes transferidos'} de ${rebalanceData.sourceDay} para ${targetRebalanceDay}.`);
        setRebalanceDay(null);
        setSelectedRebalanceClients(new Set());
        setTargetRebalanceDay('');
    };

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

        // Se estiver em modo sanfona, garante que o dia do cliente esteja aberto
        if (targetRoute.Dia_Semana) {
            setOpenDaysMap(prev => ({ ...prev, [targetRoute.Dia_Semana]: true }));
        }

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

    // Centroides geográficos médios por colaborador (para fallback de distância na ausência de LatitudeBase)
    const sellerCentroidsMap = useMemo(() => {
        const map = new Map<number, { lat: number; lng: number }>();
        const grouped = new Map<number, { latSum: number; lngSum: number; count: number }>();
        adjustedRoutes.forEach(r => {
            if (r.Lat && r.Long) {
                const cur = grouped.get(r.Cod_Vend) || { latSum: 0, lngSum: 0, count: 0 };
                cur.latSum += r.Lat;
                cur.lngSum += r.Long;
                cur.count += 1;
                grouped.set(r.Cod_Vend, cur);
            }
        });
        grouped.forEach((val, sellerId) => {
            if (val.count > 0) {
                map.set(sellerId, { lat: val.latSum / val.count, lng: val.lngSum / val.count });
            }
        });
        return map;
    }, [adjustedRoutes]);

    // Abrir modal de ajuste de coordenadas
    const handleOpenCoordinateModal = useCallback((client: VisitaPrevista) => {
        setCoordinateModalClient(client);
        setCoordModalLat(client.Lat ? String(client.Lat) : '');
        setCoordModalLng(client.Long ? String(client.Long) : '');
        setCoordNeighborSearch('');
        setCoordGeocodeFeedback(null);
    }, []);

    // Fechar modal de ajuste de coordenadas
    const handleCloseCoordinateModal = useCallback(() => {
        setCoordinateModalClient(null);
        setCoordModalLat('');
        setCoordModalLng('');
        setCoordNeighborSearch('');
        setCoordGeocodeFeedback(null);
    }, []);

    // Salvar novas coordenadas no cliente e recalcular
    const handleSaveCoordinates = useCallback(() => {
        if (!coordinateModalClient) return;

        const cleanLat = coordModalLat.replace(',', '.').trim();
        const cleanLng = coordModalLng.replace(',', '.').trim();
        const latNum = parseFloat(cleanLat);
        const lngNum = parseFloat(cleanLng);

        if (isNaN(latNum) || isNaN(lngNum)) {
            alert("Por favor, informe valores numéricos válidos para Latitude e Longitude.");
            return;
        }

        if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
            alert("Valores de coordenadas fora dos limites geográficos válidos (Lat: -90 a 90, Long: -180 a 180).");
            return;
        }

        const codCliente = coordinateModalClient.Cod_Cliente;

        // 1. Persistir no localStorage para manter entre recargas
        try {
            const raw = localStorage.getItem('FUEL360_CUSTOM_CLIENT_COORDS');
            const customMap: Record<string, { lat: number; long: number }> = raw ? JSON.parse(raw) : {};
            customMap[String(codCliente)] = { lat: latNum, long: lngNum };
            localStorage.setItem('FUEL360_CUSTOM_CLIENT_COORDS', JSON.stringify(customMap));
        } catch (err) {
            console.error("Erro ao salvar coordenada no localStorage:", err);
        }

        // 2. Atualizar adjustedRoutes
        setAdjustedRoutes(prev => prev.map(r => {
            if (r.Cod_Cliente === codCliente) {
                return { ...r, Lat: latNum, Long: lngNum };
            }
            return r;
        }));

        // 3. Atualizar originalRoutes
        setOriginalRoutes(prev => prev.map(r => {
            if (r.Cod_Cliente === codCliente) {
                return { ...r, Lat: latNum, Long: lngNum };
            }
            return r;
        }));

        handleCloseCoordinateModal();
    }, [coordinateModalClient, coordModalLat, coordModalLng, handleCloseCoordinateModal]);

    // Buscar geocodificação do endereço do cliente
    const handleGeocodeClientAddress = useCallback(async () => {
        if (!coordinateModalClient) return;
        setIsGeocodingCoord(true);
        setCoordGeocodeFeedback(null);

        try {
            const fullAddress = [
                coordinateModalClient.Endereco,
                coordinateModalClient.Bairro,
                coordinateModalClient.Cidade,
                coordinateModalClient.CEP ? `CEP ${coordinateModalClient.CEP}` : ''
            ].filter(Boolean).join(', ');

            const res = await geocodeAddress(fullAddress);
            if (res && typeof res.lat === 'number' && typeof res.lon === 'number' && !isNaN(res.lat) && !isNaN(res.lon)) {
                setCoordModalLat(String(res.lat));
                setCoordModalLng(String(res.lon));
                setCoordGeocodeFeedback({
                    type: 'success',
                    message: `Localização encontrada: Lat ${res.lat.toFixed(6)}, Long ${res.lon.toFixed(6)}`
                });
            } else {
                setCoordGeocodeFeedback({
                    type: 'error',
                    message: "Não foi possível localizar as coordenadas para este endereço. Tente copiar de um cliente vizinho."
                });
            }
        } catch (err: any) {
            setCoordGeocodeFeedback({
                type: 'error',
                message: "Falha na geocodificação: " + (err.message || "Erro de conexão")
            });
        } finally {
            setIsGeocodingCoord(false);
        }
    }, [coordinateModalClient]);

    // Lista de clientes vizinhos elegíveis para cópia de coordenadas
    const eligibleNeighbors = useMemo(() => {
        if (!coordinateModalClient) return [];
        const currentCod = coordinateModalClient.Cod_Cliente;
        const currentStreet = (coordinateModalClient.Endereco || '').toLowerCase().split(',')[0].replace(/^(r|rua|av|avenida|trav|travessa|rod|rodovia|alameda|al)\.?\s+/i, '').trim();
        const currentBairro = (coordinateModalClient.Bairro || '').trim().toLowerCase();
        const currentCity = (coordinateModalClient.Cidade || '').trim().toLowerCase();
        const sellerId = coordinateModalClient.Cod_Vend;

        // Dedup de clientes únicos em adjustedRoutes com coordenadas válidas
        const seen = new Set<number>();
        const validClients: VisitaPrevista[] = [];
        
        adjustedRoutes.forEach(r => {
            if (r.Cod_Cliente !== currentCod && r.Lat && r.Long && !seen.has(r.Cod_Cliente)) {
                seen.add(r.Cod_Cliente);
                validClients.push(r);
            }
        });

        // Pontuar relevância de vizinhança
        const scored = validClients.map(c => {
            let score = 0;
            const cStreet = (c.Endereco || '').toLowerCase().split(',')[0].replace(/^(r|rua|av|avenida|trav|travessa|rod|rodovia|alameda|al)\.?\s+/i, '').trim();
            const cBairro = (c.Bairro || '').trim().toLowerCase();
            const cCity = (c.Cidade || '').trim().toLowerCase();

            // Mesma rua (ex: Wilson das Neves)
            if (currentStreet && cStreet && (currentStreet.includes(cStreet) || cStreet.includes(currentStreet))) {
                score += 100;
            }
            // Mesmo bairro
            if (currentBairro && cBairro && currentBairro === cBairro) {
                score += 40;
            }
            // Mesma cidade
            if (currentCity && cCity && currentCity === cCity) {
                score += 20;
            }
            // Mesmo vendedor
            if (c.Cod_Vend === sellerId) {
                score += 10;
            }

            return { client: c, score };
        });

        // Ordenar: maior pontuação primeiro
        scored.sort((a, b) => b.score - a.score);

        // Se houver busca no campo de filtro
        if (coordNeighborSearch.trim()) {
            const query = coordNeighborSearch.trim().toLowerCase();
            return scored.filter(item => 
                String(item.client.Cod_Cliente).includes(query) ||
                item.client.Razao_Social.toLowerCase().includes(query) ||
                (item.client.Endereco || '').toLowerCase().includes(query) ||
                (item.client.Bairro || '').toLowerCase().includes(query)
            ).slice(0, 20).map(s => s.client);
        }

        return scored.slice(0, 20).map(s => s.client);
    }, [coordinateModalClient, adjustedRoutes, coordNeighborSearch]);

    useEffect(() => {
        setOriginalRoutes([]);
        setAdjustedRoutes([]);
        setOriginalPolylines([]);
        setAdjustedPolylines([]);
        setOptimizedSellersSet(new Set());
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
            const dataWithCustomCoords = applyCustomCoordinates(uniqueData);

            setOriginalRoutes(dataWithCustomCoords);
            setAdjustedRoutes(JSON.parse(JSON.stringify(dataWithCustomCoords)));
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
        const dataWithCustomCoords = applyCustomCoordinates(finalData);

        setOriginalRoutes(dataWithCustomCoords);
        setAdjustedRoutes(JSON.parse(JSON.stringify(dataWithCustomCoords)));
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

    // Pré-checagem de viabilidade de capacidade e jornada semanal
    const checkCapacityFeasibility = (sellers: number[], baseRoutes: VisitaPrevista[]) => {
        if (!optLimitHours && !optLimitKm && !optLimitClients) {
            return { hasOverflow: false, totalOverflow: 0, overflowData: null };
        }

        const activeDays = optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA'];

        let totalOverflow = 0;
        let maxVisitsNeededTotal = 0;
        let totalCapacityAcrossSellers = 0;
        let maxNeededHours = 0;

        const sellersSummary: Array<{
            sellerId: number;
            sellerName: string;
            totalClients: number;
            capacity: number;
            overflow: number;
        }> = [];

        sellers.forEach(sellerId => {
            const sellerVisits = baseRoutes.filter(r => r.Cod_Vend === sellerId);
            if (sellerVisits.length === 0) return;

            const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor) || colaboradores.find(c => Number(c.CodigoSetor) === sellerId || Number(c.ID_Colaborador) === sellerId);
            const sellerName = colab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : `Colaborador ${sellerId}`);

            const uniqueClientsMap = new Map<number, VisitaPrevista>();
            sellerVisits.forEach(v => {
                if (!uniqueClientsMap.has(v.Cod_Cliente)) {
                    uniqueClientsMap.set(v.Cod_Cliente, v);
                }
            });
            const uniqueClients = Array.from(uniqueClientsMap.values());
            if (uniqueClients.length === 0) return;

            const validCoordsVisits = sellerVisits.filter(v => v.Lat && v.Long);
            let baseLat = colab?.LatitudeBase || 0;
            let baseLng = colab?.LongitudeBase || 0;
            if ((!baseLat || !baseLng) && validCoordsVisits.length > 0) {
                baseLat = validCoordsVisits.reduce((acc, v) => acc + (v.Lat || 0), 0) / validCoordsVisits.length;
                baseLng = validCoordsVisits.reduce((acc, v) => acc + (v.Long || 0), 0) / validCoordsVisits.length;
            }

            // Distância média dos clientes à base do vendedor
            let avgDistFromBaseKm = 15;
            if (validCoordsVisits.length > 0 && baseLat && baseLng) {
                const sumDist = validCoordsVisits.reduce((acc, v) => acc + calcDist(baseLat, baseLng, v.Lat!, v.Long!), 0);
                avgDistFromBaseKm = Math.max(5, sumDist / validCoordsVisits.length);
            }

            // Estimativa de deslocamento viário diário (ida e volta da base a ~50 km/h + deslocamento local médio ~12m/cliente)
            const roundTripKm = (avgDistFromBaseKm * 2) * 1.18;
            const baseRoundTripMins = Math.round((roundTripKm / 50) * 60);
            const interStopTravelMins = 12;

            let semanalCount = 0;
            let quinzenalCount = 0;
            uniqueClients.forEach(c => {
                const parsed = parsePeriodicidade(c.Periodicidade);
                if (parsed.tipo === 'SEMANAL') semanalCount++;
                else quinzenalCount++;
            });

            // Demanda de visitas em um ciclo semanal (Semanas 1/3 ou 2/4)
            const visitsPerCycle = semanalCount + Math.ceil(quinzenalCount / 2);

            // Capacidade semanal máxima do colaborador
            let sellerWeeklyCap = 0;
            activeDays.forEach(day => {
                let cap = Infinity;
                if (optLimitClients) {
                    cap = (day === 'SÁBADO' && optSatHalfPeriod) ? Math.max(1, Math.floor(optMaxClients / 2)) : optMaxClients;
                }
                if (optLimitHours) {
                    const hoursForDay = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                    const dayBudgetMins = hoursForDay * 60;
                    const availableForStopsMins = Math.max(30, dayBudgetMins - baseRoundTripMins);
                    const avgServiceMins = uniqueClients.length 
                        ? (uniqueClients.reduce((acc, c) => acc + getClientServiceTime(c), 0) / uniqueClients.length) 
                        : (channelServiceTimes['PADRAO'] || 15);
                    const timePerClientMins = Math.max(10, avgServiceMins + interStopTravelMins);
                    const maxClientsByHours = Math.max(1, Math.floor(availableForStopsMins / timePerClientMins));
                    cap = Math.min(cap, maxClientsByHours);
                }
                sellerWeeklyCap += cap;
            });

            const sellerOverflow = (optLimitClients || optLimitHours || optLimitKm) && sellerWeeklyCap !== Infinity
                ? Math.max(0, visitsPerCycle - sellerWeeklyCap)
                : 0;
            if (sellerOverflow > 0) {
                totalOverflow += sellerOverflow;
            }

            // Horas diárias necessárias para cobrir todos os clientes com deslocamento viário real
            const avgServiceMins = uniqueClients.length 
                ? (uniqueClients.reduce((acc, c) => acc + getClientServiceTime(c), 0) / uniqueClients.length) 
                : (channelServiceTimes['PADRAO'] || 15);
            const totalServiceMinsNeeded = visitsPerCycle * (avgServiceMins + interStopTravelMins);
            const effectiveDays = activeDays.reduce((acc, d) => acc + ((d === 'SÁBADO' && optSatHalfPeriod) ? 0.5 : 1), 0);
            const totalBaseTravelMinsNeeded = effectiveDays * baseRoundTripMins;
            const neededHoursForThisSeller = Math.round(((totalServiceMinsNeeded + totalBaseTravelMinsNeeded) / 60 / Math.max(1, effectiveDays)) * 10) / 10;
            if (neededHoursForThisSeller > maxNeededHours) {
                maxNeededHours = neededHoursForThisSeller;
            }

            maxVisitsNeededTotal += visitsPerCycle;
            totalCapacityAcrossSellers += (sellerWeeklyCap === Infinity ? visitsPerCycle : sellerWeeklyCap);

            sellersSummary.push({
                sellerId,
                sellerName,
                totalClients: uniqueClients.length,
                capacity: sellerWeeklyCap === Infinity ? uniqueClients.length : sellerWeeklyCap,
                overflow: sellerOverflow
            });
        });

        if (totalOverflow > 0) {
            return {
                hasOverflow: true,
                totalOverflow,
                overflowData: {
                    sellers,
                    overflowCount: totalOverflow,
                    maxVisitsNeeded: maxVisitsNeededTotal,
                    totalCapacityForWeek: totalCapacityAcrossSellers,
                    neededHoursPerDay: maxNeededHours,
                    configuredHours: optMaxHours,
                    sellersSummary
                }
            };
        }

        return { hasOverflow: false, totalOverflow: 0, overflowData: null };
    };

    // Motor de Roteirização Avançado: Clusterização Espacial por Dia + TSP Circuito Fechado 2-Opt (Base -> Clientes -> Base)
    const runOptimizationForSellers = async (
        sellers: number[], 
        baseRoutes: VisitaPrevista[], 
        allowOverflow: boolean = true,
        summaryMeta?: {
            title: string;
            escopoDesc: string;
            mode?: 'simulate' | 'strict' | 'flexibilize';
            hoursLimit?: number;
        }
    ) => {
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

            // 2. Particionamento Espacial Balanceado (K-Partições com Cota Rígida por Dia)
            const getDayWeight = (day: string) => (day === 'SÁBADO' && optSatHalfPeriod) ? 0.5 : 1.0;
            const totalWeight = activeDays.reduce((sum, d) => sum + getDayWeight(d), 0);

            // Centro geográfico da carteira de clientes
            const validCoords = uniqueClients.filter(c => c.lat && c.lng);
            const centerPortfolioLat = validCoords.length > 0 
                ? validCoords.reduce((acc, c) => acc + c.lat, 0) / validCoords.length 
                : (baseLat || -23.18);
            const centerPortfolioLng = validCoords.length > 0 
                ? validCoords.reduce((acc, c) => acc + c.lng, 0) / validCoords.length 
                : (baseLng || -45.88);

            // Garantir coordenadas válidas para clientes com lat/long zerados
            uniqueClients.forEach(c => {
                if (!c.lat || !c.lng) {
                    const cityMatch = validCoords.find(vc => 
                        (vc.sampleVisit.Cidade || '').trim().toUpperCase() === (c.sampleVisit.Cidade || '').trim().toUpperCase()
                    );
                    if (cityMatch && cityMatch.lat && cityMatch.lng) {
                        c.lat = cityMatch.lat;
                        c.lng = cityMatch.lng;
                    } else {
                        c.lat = centerPortfolioLat;
                        c.lng = centerPortfolioLng;
                    }
                    c.polarAngle = calcPolarAngle(centerPortfolioLat, centerPortfolioLng, c.lat, c.lng);
                    c.distFromBase = calcDist(baseLat, baseLng, c.lat, c.lng);
                }
            });

            // 2.1. Cálculo das Cotas Rígidas por Dia (Garantia de que NENHUM dia fique com 0 PDVs e nenhum com sobrecarga)
            const dayQuotas: number[] = [];
            let accumulatedAssigned = 0;
            let accumulatedWeight = 0;
            for (let i = 0; i < activeDays.length; i++) {
                const w = getDayWeight(activeDays[i]);
                accumulatedWeight += w;
                const isLast = (i === activeDays.length - 1);
                const targetAccumulated = isLast 
                    ? uniqueClients.length 
                    : Math.min(uniqueClients.length, Math.round(uniqueClients.length * (accumulatedWeight / totalWeight)));
                const quota = Math.max(uniqueClients.length >= activeDays.length ? 1 : 0, targetAccumulated - accumulatedAssigned);
                dayQuotas.push(quota);
                accumulatedAssigned += quota;
            }

            // Envelope de Cotas Rígidas: faixa estrita de clientes por dia ativo (tolerância máxima ±2 PDVs da cota diária)
            // Impede anomalias como esvaziamento (15 PDVs) ou inchaço (33 PDVs)
            const avgClientsPerActiveDay = uniqueClients.length / activeDays.length;
            const quotaTolerance = Math.max(1, Math.min(2, Math.round(avgClientsPerActiveDay * 0.12)));
            const minAllowedClientsPerDay = Math.max(1, Math.floor(avgClientsPerActiveDay - quotaTolerance));
            const maxAllowedClientsPerDay = Math.ceil(avgClientsPerActiveDay + quotaTolerance);

            // Distância média dos clientes à base do vendedor para estimativa viária realista
            let avgDistFromBaseKm = 15;
            if (validCoords.length > 0 && baseLat && baseLng) {
                const sumDist = validCoords.reduce((acc, c) => acc + calcDist(baseLat, baseLng, c.lat, c.lng), 0);
                avgDistFromBaseKm = Math.max(5, sumDist / validCoords.length);
            }
            const baseRoundTripMins = Math.round(((avgDistFromBaseKm * 2 * 1.18) / 50) * 60);
            const interStopTravelMins = 12;

            interface DayBucket {
                day: string;
                weight: number;
                targetQuota: number;
                maxCap: number;
                semanais: typeof uniqueClients;
                quinzenais13: typeof uniqueClients;
                quinzenais24: typeof uniqueClients;
            }

            const dayBuckets: DayBucket[] = activeDays.map((day, idx) => {
                const w = getDayWeight(day);
                let cap = Infinity;
                if (optLimitClients) {
                    cap = (day === 'SÁBADO' && optSatHalfPeriod) ? Math.max(1, Math.floor(optMaxClients / 2)) : optMaxClients;
                }
                if (optLimitHours) {
                    const hoursForDay = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                    const dayBudgetMins = hoursForDay * 60;
                    const availableForStopsMins = Math.max(30, dayBudgetMins - baseRoundTripMins);
                    const avgServiceMins = uniqueClients.length 
                        ? (uniqueClients.reduce((acc, c) => acc + getClientServiceTime(c.sampleVisit), 0) / uniqueClients.length) 
                        : (channelServiceTimes['PADRAO'] || 15);
                    const timePerClientMins = Math.max(10, avgServiceMins + interStopTravelMins);
                    const maxClientsByHours = Math.max(1, Math.floor(availableForStopsMins / timePerClientMins));
                    cap = Math.min(cap, maxClientsByHours);
                }
                return {
                    day,
                    weight: w,
                    targetQuota: dayQuotas[idx] || 0,
                    maxCap: cap,
                    semanais: [],
                    quinzenais13: [],
                    quinzenais24: []
                };
            });

            // 2.2. Agrupamento Geográfico Municipal e Setorial
            const cityGroups = new Map<string, typeof uniqueClients>();
            uniqueClients.forEach(c => {
                const rawCity = (c.sampleVisit.Cidade || '').trim().toUpperCase();
                const cityKey = rawCity || 'GERAL';
                if (!cityGroups.has(cityKey)) {
                    cityGroups.set(cityKey, []);
                }
                cityGroups.get(cityKey)!.push(c);
            });

            interface GeoCluster {
                id: string;
                cityName: string;
                isSatellite: boolean;
                clients: typeof uniqueClients;
                centerLat: number;
                centerLng: number;
                polarAngle: number;
                distFromBase: number;
                linearProj?: number;
            }

            const maxDailyTarget = Math.max(...dayQuotas, 8);
            const clusters: GeoCluster[] = [];

            cityGroups.forEach((cList, cityName) => {
                // Cidades satélites indivisíveis: se a cidade couber na cota diária, fica 100% no mesmo bloco e dia
                if (cList.length <= maxDailyTarget) {
                    const cLat = cList.reduce((s, c) => s + c.lat, 0) / cList.length;
                    const cLng = cList.reduce((s, c) => s + c.lng, 0) / cList.length;
                    const pAngle = calcPolarAngle(centerPortfolioLat, centerPortfolioLng, cLat, cLng);
                    const dBase = calcDist(baseLat, baseLng, cLat, cLng);

                    clusters.push({
                        id: `${cityName}_SATELLITE`,
                        cityName,
                        isSatellite: true,
                        clients: cList,
                        centerLat: cLat,
                        centerLng: cLng,
                        polarAngle: pAngle,
                        distFromBase: dBase
                    });
                } else {
                    // Cidades maiores: ordenação adaptativa por Projeção no Eixo Principal de Dispersão (PCA 1D)
                    // Elimina anomalias de relevos lineares/litorâneos (ex.: Ilhabela ao longo da rodovia SP-131)
                    const validCityCoords = cList.filter(c => c.lat && c.lng);
                    const avgCityLat = validCityCoords.length > 0 
                        ? validCityCoords.reduce((s, c) => s + c.lat, 0) / validCityCoords.length 
                        : centerPortfolioLat;
                    const avgCityLng = validCityCoords.length > 0 
                        ? validCityCoords.reduce((s, c) => s + c.lng, 0) / validCityCoords.length 
                        : centerPortfolioLng;

                    let varLat = 0, varLng = 0, covLatLng = 0;
                    validCityCoords.forEach(c => {
                        const dLat = (c.lat - avgCityLat) * 111.32; // km
                        const dLng = (c.lng - avgCityLng) * 111.32 * Math.cos((avgCityLat * Math.PI) / 180); // km
                        varLat += dLat * dLat;
                        varLng += dLng * dLng;
                        covLatLng += dLat * dLng;
                    });

                    // Autovetor do eixo de maior dispersão territorial (direção natural da rodovia/orla)
                    const pcaTheta = 0.5 * Math.atan2(2 * covLatLng, varLng - varLat);
                    const axisX = Math.cos(pcaTheta);
                    const axisY = Math.sin(pcaTheta);

                    const sortedCity = [...cList].sort((a, b) => {
                        const projA = (a.lng - avgCityLng) * axisX + (a.lat - avgCityLat) * axisY;
                        const projB = (b.lng - avgCityLng) * axisX + (b.lat - avgCityLat) * axisY;
                        return projA - projB;
                    });

                    const sliceSize = Math.max(4, Math.round(uniqueClients.length / activeDays.length));
                    let subIdx = 1;
                    for (let i = 0; i < sortedCity.length; i += sliceSize) {
                        const chunk = sortedCity.slice(i, i + sliceSize);
                        const cLat = chunk.reduce((s, c) => s + c.lat, 0) / chunk.length;
                        const cLng = chunk.reduce((s, c) => s + c.lng, 0) / chunk.length;
                        const pAngle = calcPolarAngle(centerPortfolioLat, centerPortfolioLng, cLat, cLng);
                        const dBase = calcDist(baseLat, baseLng, cLat, cLng);
                        const proj = (cLng - avgCityLng) * axisX + (cLat - avgCityLat) * axisY;

                        clusters.push({
                            id: `${cityName}_SUB_${subIdx++}`,
                            cityName,
                            isSatellite: false,
                            clients: chunk,
                            centerLat: cLat,
                            centerLng: cLng,
                            polarAngle: pAngle,
                            distFromBase: dBase,
                            linearProj: proj
                        });
                    }
                }
            });

            // Garantir que a quantidade de clusters seja de pelo menos o número de dias ativos
            while (clusters.length < activeDays.length && uniqueClients.length >= activeDays.length) {
                let largestIdx = -1;
                let maxLen = 1;
                clusters.forEach((cl, idx) => {
                    if (cl.clients.length > maxLen) {
                        maxLen = cl.clients.length;
                        largestIdx = idx;
                    }
                });

                if (largestIdx === -1) break;

                const toSplit = clusters[largestIdx];
                const half = Math.ceil(toSplit.clients.length / 2);
                const chunk1 = toSplit.clients.slice(0, half);
                const chunk2 = toSplit.clients.slice(half);

                const cLat1 = chunk1.reduce((s, c) => s + c.lat, 0) / chunk1.length;
                const cLng1 = chunk1.reduce((s, c) => s + c.lng, 0) / chunk1.length;
                const cLat2 = chunk2.reduce((s, c) => s + c.lat, 0) / chunk2.length;
                const cLng2 = chunk2.reduce((s, c) => s + c.lng, 0) / chunk2.length;

                clusters.splice(largestIdx, 1, 
                    {
                        id: `${toSplit.id}_A`,
                        cityName: toSplit.cityName,
                        isSatellite: false,
                        clients: chunk1,
                        centerLat: cLat1,
                        centerLng: cLng1,
                        polarAngle: calcPolarAngle(centerPortfolioLat, centerPortfolioLng, cLat1, cLng1),
                        distFromBase: calcDist(baseLat, baseLng, cLat1, cLng1),
                        linearProj: toSplit.linearProj !== undefined ? toSplit.linearProj - 0.001 : undefined
                    },
                    {
                        id: `${toSplit.id}_B`,
                        cityName: toSplit.cityName,
                        isSatellite: false,
                        clients: chunk2,
                        centerLat: cLat2,
                        centerLng: cLng2,
                        polarAngle: calcPolarAngle(centerPortfolioLat, centerPortfolioLng, cLat2, cLng2),
                        distFromBase: calcDist(baseLat, baseLng, cLat2, cLng2),
                        linearProj: toSplit.linearProj !== undefined ? toSplit.linearProj + 0.001 : undefined
                    }
                );
            }

            // 2.3. Motor Multi-Cenários de Inteligência e Balanceamento de Carga Horária Total
            const K = activeDays.length;

            const isDayAllowedForClient = (client: typeof uniqueClients[0], dayName: string) => {
                const restr = clienteRestricoesMap.get(client.sampleVisit.Cod_Cliente);
                if (!restr || !restr.DiasPermitidos || !restr.DiasPermitidos.trim()) return true;
                const allowed = restr.DiasPermitidos.split(',').map(item => normalizeDiaSemana(item.trim()));
                return allowed.includes(dayName);
            };

            const isCitySatellite = (client: typeof uniqueClients[0]) => {
                const cCity = (client.sampleVisit.Cidade || '').trim().toUpperCase();
                return clusters.some(cl => cl.isSatellite && cl.cityName === cCity);
            };

            const getClientWorkloadMins = (c: typeof uniqueClients[0]) => {
                const srv = getClientServiceTime(c.sampleVisit);
                const freqFactor = c.tipo === 'SEMANAL' ? 1.0 : 0.5;
                return (srv * freqFactor) + interStopTravelMins;
            };

            const totalPortfolioWorkloadMins = uniqueClients.reduce((acc, c) => acc + getClientWorkloadMins(c), 0);
            const targetWorkloadPerDayMins = totalPortfolioWorkloadMins / totalWeight;

            const getOrderedDayMetrics = (cList: typeof uniqueClients) => {
                if (cList.length === 0) return { travelMins: 0, serviceMins: 0, totalMins: 0, totalKm: 0 };
                const valid = cList.filter(c => c.lat && c.lng);
                if (valid.length === 0) {
                    const srv = cList.reduce((sum, c) => sum + (c.tipo === 'SEMANAL' ? getClientServiceTime(c.sampleVisit) : getClientServiceTime(c.sampleVisit) * 0.5), 0);
                    return { travelMins: 0, serviceMins: srv, totalMins: srv, totalKm: 0 };
                }
                const stops = valid.map(c => ({ lat: c.lat, lng: c.lng }));
                const orderedStops = stops.length <= 35 
                    ? optimizeDayCircuit2Opt({ lat: baseLat, lng: baseLng }, stops, optEndAtLastClient)
                    : stops;
                const circuit = calcCircuitMetrics({ lat: baseLat, lng: baseLng }, orderedStops, optEndAtLastClient);
                const serviceMins = cList.reduce((sum, c) => {
                    const srv = getClientServiceTime(c.sampleVisit);
                    return sum + (c.tipo === 'SEMANAL' ? srv : srv * 0.5);
                }, 0);
                return {
                    travelMins: circuit.travelMinutes,
                    serviceMins,
                    totalMins: circuit.travelMinutes + serviceMins,
                    totalKm: circuit.totalKm
                };
            };

            // Função de Particionamento 1D via Programação Dinâmica (DP)
            const partitionClustersDP = (
                sweep: GeoCluster[], 
                criterion: 'COUNT' | 'WORKLOAD'
            ): Array<typeof uniqueClients> => {
                const M_len = sweep.length;
                if (M_len === 0) return Array.from({ length: K }, () => []);

                const dp: number[][] = Array.from({ length: K + 1 }, () => Array(M_len + 1).fill(Infinity));
                const parent: number[][] = Array.from({ length: K + 1 }, () => Array(M_len + 1).fill(-1));
                dp[0][0] = 0;

                const clusterWeights = sweep.map(cl => 
                    criterion === 'WORKLOAD' 
                        ? cl.clients.reduce((sum, c) => sum + getClientWorkloadMins(c), 0)
                        : cl.clients.length
                );
                const prefixWeights: number[] = [0];
                for (let i = 0; i < M_len; i++) {
                    prefixWeights.push(prefixWeights[i] + clusterWeights[i]);
                }

                for (let d = 1; d <= K; d++) {
                    const targetVal = criterion === 'WORKLOAD' 
                        ? targetWorkloadPerDayMins * getDayWeight(activeDays[d - 1])
                        : dayQuotas[d - 1];

                    for (let i = d; i <= M_len; i++) {
                        for (let j = d - 1; j < i; j++) {
                            if (dp[d - 1][j] === Infinity) continue;
                            const valInDay = prefixWeights[i] - prefixWeights[j];
                            const diff = valInDay - targetVal;
                            const cost = dp[d - 1][j] + (diff * diff) + (valInDay === 0 ? 50000 : 0);
                            if (cost < dp[d][i]) {
                                dp[d][i] = cost;
                                parent[d][i] = j;
                            }
                        }
                    }
                }

                const dayPart: Array<typeof uniqueClients> = Array.from({ length: K }, () => []);
                let curI = M_len;
                for (let d = K; d >= 1; d--) {
                    const prevJ = parent[d][curI] >= 0 ? parent[d][curI] : Math.max(0, curI - 1);
                    const slice = sweep.slice(prevJ, curI);
                    slice.forEach(cl => dayPart[d - 1].push(...cl.clients));
                    curI = prevJ;
                }
                return dayPart;
            };

            // GERAÇÃO DE CENÁRIOS CONCORRENTES (8 a 16 CENÁRIOS)
            interface CandidateScenario {
                name: string;
                partition: Array<typeof uniqueClients>;
            }

            const candidateScenarios: CandidateScenario[] = [];
            const isSingleDominantCity = cityGroups.size === 1;

            if (isSingleDominantCity && clusters.every(cl => cl.linearProj !== undefined)) {
                // Cenários lineares PCA (Sul -> Norte e Norte -> Sul)
                const sweepAsc = [...clusters].sort((a, b) => (a.linearProj ?? 0) - (b.linearProj ?? 0));
                const sweepDesc = [...clusters].sort((a, b) => (b.linearProj ?? 0) - (a.linearProj ?? 0));

                candidateScenarios.push({
                    name: 'PCA Linear Ascendente (Count DP)',
                    partition: partitionClustersDP(sweepAsc, 'COUNT')
                });
                candidateScenarios.push({
                    name: 'PCA Linear Ascendente (Workload DP)',
                    partition: partitionClustersDP(sweepAsc, 'WORKLOAD')
                });
                candidateScenarios.push({
                    name: 'PCA Linear Descendente (Count DP)',
                    partition: partitionClustersDP(sweepDesc, 'COUNT')
                });
                candidateScenarios.push({
                    name: 'PCA Linear Descendente (Workload DP)',
                    partition: partitionClustersDP(sweepDesc, 'WORKLOAD')
                });
            } else {
                // Cenários angulares com múltiplos pontos de corte rotacionados
                const sortedAngular = [...clusters].sort((a, b) => a.polarAngle - b.polarAngle);
                const numAngularStarts = Math.min(sortedAngular.length, 8);

                for (let sIdx = 0; sIdx < numAngularStarts; sIdx++) {
                    const cutIdx = Math.floor((sIdx * sortedAngular.length) / numAngularStarts);
                    const rotatedSweep = [
                        ...sortedAngular.slice(cutIdx),
                        ...sortedAngular.slice(0, cutIdx)
                    ];

                    candidateScenarios.push({
                        name: `Angular Offset ${sIdx + 1} (Count DP)`,
                        partition: partitionClustersDP(rotatedSweep, 'COUNT')
                    });
                    candidateScenarios.push({
                        name: `Angular Offset ${sIdx + 1} (Workload DP)`,
                        partition: partitionClustersDP(rotatedSweep, 'WORKLOAD')
                    });
                }
            }

            // SIMULAÇÃO, REFINAMENTO E SELEÇÃO DO MELHOR CENÁRIO
            let bestScenarioPartition: Array<typeof uniqueClients> | null = null;
            let bestScenarioScore = Infinity;

            candidateScenarios.forEach((scenario) => {
                const currentPart = scenario.partition.map(cList => [...cList]);

                // 1. Respeitar hard constraints de DiasPermitidos
                if (clienteRestricoesMap.size > 0) {
                    for (let d = 0; d < K; d++) {
                        const currentDay = activeDays[d];
                        const clientsInDay = currentPart[d];

                        for (let i = clientsInDay.length - 1; i >= 0; i--) {
                            const client = clientsInDay[i];
                            const cod = client.sampleVisit.Cod_Cliente;
                            const restr = clienteRestricoesMap.get(cod);

                            if (restr && restr.DiasPermitidos && restr.DiasPermitidos.trim()) {
                                const allowedDays = restr.DiasPermitidos.split(',').map(item => normalizeDiaSemana(item.trim()));
                                if (!allowedDays.includes(currentDay)) {
                                    const targetDay = activeDays.find(ad => allowedDays.includes(ad));
                                    if (targetDay) {
                                        const targetDIdx = activeDays.indexOf(targetDay);
                                        if (targetDIdx !== -1 && targetDIdx !== d) {
                                            const [moved] = clientsInDay.splice(i, 1);
                                            currentPart[targetDIdx].push(moved);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. Refinamento de Borda Fina
                for (let pass = 0; pass < 3; pass++) {
                    for (let i = 0; i < K - 1; i++) {
                        const d1 = i;
                        const d2 = i + 1;
                        const diff1 = currentPart[d1].length - dayQuotas[d1];
                        const diff2 = currentPart[d2].length - dayQuotas[d2];

                        if (diff1 > 0 && diff2 < 0 && currentPart[d1].length > minAllowedClientsPerDay && currentPart[d2].length < maxAllowedClientsPerDay) {
                            let bestCandidateIdx = -1;
                            let minDistToD2 = Infinity;
                            const d2Lat = currentPart[d2].reduce((s, x) => s + (x.lat || 0), 0) / (currentPart[d2].length || 1);
                            const d2Lng = currentPart[d2].reduce((s, x) => s + (x.lng || 0), 0) / (currentPart[d2].length || 1);

                            for (let cIdx = 0; cIdx < currentPart[d1].length; cIdx++) {
                                const c = currentPart[d1][cIdx];
                                if (isCitySatellite(c) || !isDayAllowedForClient(c, activeDays[d2])) continue;
                                const dist = calcDist(c.lat, c.lng, d2Lat, d2Lng);
                                if (dist < minDistToD2) {
                                    minDistToD2 = dist;
                                    bestCandidateIdx = cIdx;
                                }
                            }
                            if (bestCandidateIdx >= 0) {
                                const [moved] = currentPart[d1].splice(bestCandidateIdx, 1);
                                currentPart[d2].unshift(moved);
                            }
                        }
                    }
                }

                // 3. Otimização de Sexta-feira
                if (optAvoidFridayDistant && activeDays.includes('SEXTA-FEIRA')) {
                    const fridayIdx = activeDays.indexOf('SEXTA-FEIRA');
                    const weekdayIndices = activeDays
                        .map((day, idx) => ({ day, idx }))
                        .filter(item => item.day !== 'SÁBADO');

                    if (weekdayIndices.length > 1 && fridayIdx !== -1) {
                        const getAvgDistFromBase = (clients: typeof uniqueClients) => {
                            if (!clients || clients.length === 0) return 0;
                            return clients.reduce((sum, c) => sum + (c.distFromBase || 0), 0) / clients.length;
                        };

                        const fridayDist = getAvgDistFromBase(currentPart[fridayIdx]);
                        let minWeekdayIdx = fridayIdx;
                        let minWeekdayDist = fridayDist;

                        weekdayIndices.forEach(item => {
                            const dist = getAvgDistFromBase(currentPart[item.idx]);
                            if (dist < minWeekdayDist) {
                                minWeekdayDist = dist;
                                minWeekdayIdx = item.idx;
                            }
                        });

                        if (minWeekdayIdx !== fridayIdx) {
                            const tempClients = currentPart[fridayIdx];
                            currentPart[fridayIdx] = currentPart[minWeekdayIdx];
                            currentPart[minWeekdayIdx] = tempClients;
                        }
                    }
                }

                // 4. Busca Local Iterativa de Nivelamento de Carga Horária (Workload Balancing com Swaps e Transferências)
                if (K > 1 && optBalanceWorkload) {
                    for (let wlIter = 0; wlIter < 12; wlIter++) {
                        const metricsList = currentPart.map(cList => getOrderedDayMetrics(cList));
                        let maxD = 0;
                        let minD = 0;
                        for (let d = 1; d < K; d++) {
                            if (metricsList[d].totalMins > metricsList[maxD].totalMins) maxD = d;
                            if (metricsList[d].totalMins < metricsList[minD].totalMins) minD = d;
                        }

                        const gapMins = metricsList[maxD].totalMins - metricsList[minD].totalMins;
                        if (gapMins <= 35) break;

                        const clientsHigh = currentPart[maxD];
                        const clientsLow = currentPart[minD];
                        const dayNameHigh = activeDays[maxD];
                        const dayNameLow = activeDays[minD];

                        const lowCoords = clientsLow.filter(c => c.lat && c.lng);
                        const centerLowLat = lowCoords.length > 0 ? lowCoords.reduce((s, c) => s + c.lat, 0) / lowCoords.length : baseLat;
                        const centerLowLng = lowCoords.length > 0 ? lowCoords.reduce((s, c) => s + c.lng, 0) / lowCoords.length : baseLng;

                        const highCoords = clientsHigh.filter(c => c.lat && c.lng);
                        const centerHighLat = highCoords.length > 0 ? highCoords.reduce((s, c) => s + c.lat, 0) / highCoords.length : baseLat;
                        const centerHighLng = highCoords.length > 0 ? highCoords.reduce((s, c) => s + c.lng, 0) / highCoords.length : baseLng;

                        let bestSwap: { idxHigh: number; idxLow: number; improvement: number } | null = null;
                        let bestMove: { idxHigh: number; improvement: number } | null = null;

                        // A. Permuta 1-para-1 entre dias
                        for (let iH = 0; iH < clientsHigh.length; iH++) {
                            const cH = clientsHigh[iH];
                            if (!isDayAllowedForClient(cH, dayNameLow) || isCitySatellite(cH)) continue;
                            const srvH = getClientWorkloadMins(cH);

                            const distH_to_Low = calcDist(cH.lat, cH.lng, centerLowLat, centerLowLng);
                            const distH_to_High = calcDist(cH.lat, cH.lng, centerHighLat, centerHighLng);
                            if (distH_to_Low > distH_to_High + 8.0) continue;

                            for (let iL = 0; iL < clientsLow.length; iL++) {
                                const cL = clientsLow[iL];
                                if (!isDayAllowedForClient(cL, dayNameHigh) || isCitySatellite(cL)) continue;
                                const srvL = getClientWorkloadMins(cL);

                                if (srvH > srvL) {
                                    const distL_to_High = calcDist(cL.lat, cL.lng, centerHighLat, centerHighLng);
                                    const distL_to_Low = calcDist(cL.lat, cL.lng, centerLowLat, centerLowLng);
                                    if (distL_to_High > distL_to_Low + 8.0) continue;

                                    const diff = srvH - srvL;
                                    const newHigh = metricsList[maxD].totalMins - diff;
                                    const newLow = metricsList[minD].totalMins + diff;
                                    const newGap = Math.abs(newHigh - newLow);

                                    if (newGap < gapMins - 10) {
                                        const improvement = gapMins - newGap;
                                        if (!bestSwap || improvement > bestSwap.improvement) {
                                            bestSwap = { idxHigh: iH, idxLow: iL, improvement };
                                        }
                                    }
                                }
                            }
                        }

                        // B. Transferência Direta respeitando envelope de cotas
                        if (clientsHigh.length > minAllowedClientsPerDay && clientsLow.length < maxAllowedClientsPerDay) {
                            for (let iH = clientsHigh.length - 1; iH >= 0; iH--) {
                                const cH = clientsHigh[iH];
                                if (!isDayAllowedForClient(cH, dayNameLow) || isCitySatellite(cH)) continue;

                                const distH_to_Low = calcDist(cH.lat, cH.lng, centerLowLat, centerLowLng);
                                const distH_to_High = calcDist(cH.lat, cH.lng, centerHighLat, centerHighLng);
                                if (distH_to_Low > distH_to_High + 5.0) continue;

                                const cHTime = getClientWorkloadMins(cH);
                                const newHigh = metricsList[maxD].totalMins - cHTime;
                                const newLow = metricsList[minD].totalMins + cHTime;
                                const newGap = Math.abs(newHigh - newLow);

                                if (newGap < gapMins - 10) {
                                    const improvement = gapMins - newGap;
                                    if (!bestMove || improvement > bestMove.improvement) {
                                        bestMove = { idxHigh: iH, improvement };
                                    }
                                }
                            }
                        }

                        if (bestSwap && (!bestMove || bestSwap.improvement >= bestMove.improvement)) {
                            const [movedH] = clientsHigh.splice(bestSwap.idxHigh, 1);
                            const [movedL] = clientsLow.splice(bestSwap.idxLow, 1);
                            clientsHigh.push(movedL);
                            clientsLow.push(movedH);
                        } else if (bestMove) {
                            const [movedH] = clientsHigh.splice(bestMove.idxHigh, 1);
                            clientsLow.push(movedH);
                        } else {
                            break;
                        }
                    }
                }

                // 5. Avaliação do Score Multi-Objetivo do Cenário
                const finalMetrics = currentPart.map(cList => getOrderedDayMetrics(cList));
                let scenarioOverloadMins = 0;
                let maxDayOverload = 0;
                let totalKmSum = 0;
                const times: number[] = [];

                for (let d = 0; d < K; d++) {
                    const t = finalMetrics[d].totalMins;
                    times.push(t);
                    totalKmSum += finalMetrics[d].totalKm;
                    const dayLimitHours = (activeDays[d] === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                    const dayLimitMins = dayLimitHours * 60;
                    if (optLimitHours && t > dayLimitMins) {
                        const excess = t - dayLimitMins;
                        scenarioOverloadMins += excess;
                        if (excess > maxDayOverload) maxDayOverload = excess;
                    }
                }

                const meanT = times.reduce((a, b) => a + b, 0) / (times.length || 1);
                const varianceT = times.reduce((acc, t) => acc + Math.pow(t - meanT, 2), 0) / (times.length || 1);
                const stdDevT = Math.sqrt(varianceT);

                // Score de qualidade: prioriza eliminar sobrecargas e equilibrar o tempo diário
                const score = (maxDayOverload * 1500) + (scenarioOverloadMins * 150) + (stdDevT * 35) + (totalKmSum * 1.5);

                if (score < bestScenarioScore) {
                    bestScenarioScore = score;
                    bestScenarioPartition = currentPart;
                }
            });

            const dayAssignedClients: Array<typeof uniqueClients> = bestScenarioPartition || Array.from({ length: K }, () => []);

            // 2.6. Distribuição Interna e Equalização Quinzenal Homogênea
            for (let d = 0; d < K; d++) {
                const bucket = dayBuckets[d];
                const clientsInDay = dayAssignedClients[d];

                const semanais = clientsInDay.filter(c => c.tipo === 'SEMANAL');
                const quinzenais = clientsInDay.filter(c => c.tipo !== 'SEMANAL');

                bucket.semanais.push(...semanais);

                // Separação de Quinzenais com Trava Corporativa (FuelClienteRestricoes)
                const fixed13: typeof uniqueClients = [];
                const fixed24: typeof uniqueClients = [];
                const dynamicQuinzenais: typeof uniqueClients = [];

                quinzenais.forEach(c => {
                    const restr = clienteRestricoesMap.get(c.sampleVisit.Cod_Cliente);
                    if (restr && restr.Ativo !== false && restr.QuinzenaPermitida === '1_3') {
                        c.tipo = 'QUINZENAL_1_3';
                        c.originalPeriodicidade = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (1,3)' : '1 3';
                        fixed13.push(c);
                    } else if (restr && restr.Ativo !== false && restr.QuinzenaPermitida === '2_4') {
                        c.tipo = 'QUINZENAL_2_4';
                        c.originalPeriodicidade = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (2,4)' : '2 4';
                        fixed24.push(c);
                    } else {
                        dynamicQuinzenais.push(c);
                    }
                });

                if (optBalanceWorkload) {
                    dynamicQuinzenais.sort((a, b) => a.polarAngle - b.polarAngle);

                    const q13: typeof uniqueClients = [...fixed13];
                    const q24: typeof uniqueClients = [...fixed24];

                    const satGroups = new Map<string, typeof uniqueClients>();
                    const nonSat: typeof uniqueClients = [];

                    dynamicQuinzenais.forEach(c => {
                        const cCity = (c.sampleVisit.Cidade || '').trim().toUpperCase();
                        const isSat = clusters.some(cl => cl.isSatellite && cl.cityName === cCity);
                        if (isSat) {
                            if (!satGroups.has(cCity)) satGroups.set(cCity, []);
                            satGroups.get(cCity)!.push(c);
                        } else {
                            nonSat.push(c);
                        }
                    });

                    // Cidades satélites: se a cidade for a única do dia ou contiver volume suficiente,
                    // subdivide equilibradamente para evitar que um ciclo fique zerado ou com sobrecarga
                    satGroups.forEach((sList) => {
                        const totalInDayWithoutSat = semanais.length + nonSat.length;
                        const wouldEmptyOtherCycle = (semanais.length === 0 && satGroups.size === 1);
                        const isLargeGroup = sList.length >= 4;

                        if (wouldEmptyOtherCycle || (isLargeGroup && sList.length > (totalInDayWithoutSat + 2))) {
                            // Subdivide a cidade entre os dois ciclos de forma geograficamente contígua
                            sList.sort((a, b) => a.polarAngle - b.polarAngle);
                            const half = Math.ceil(sList.length / 2);
                            const part1 = sList.slice(0, half);
                            const part2 = sList.slice(half);

                            if (q13.length <= q24.length) {
                                q13.push(...part1);
                                q24.push(...part2);
                            } else {
                                q24.push(...part1);
                                q13.push(...part2);
                            }
                        } else {
                            if (q13.length <= q24.length) {
                                q13.push(...sList);
                            } else {
                                q24.push(...sList);
                            }
                        }
                    });

                    // Clientes não-satélites dinâmicos: distribui alternadamente equilibrando as quinzenas
                    nonSat.sort((a, b) => a.polarAngle - b.polarAngle);
                    nonSat.forEach(c => {
                        if (q13.length <= q24.length) {
                            q13.push(c);
                        } else {
                            q24.push(c);
                        }
                    });

                    // Equalização fina: garante que a diferença entre q13 e q24 seja no máximo 1 cliente
                    // Salvaguarda: NUNCA move clientes com quinzena fixada (fixed13 / fixed24)!
                    let maxLoop = 15;
                    while (Math.abs(q13.length - q24.length) > 1 && maxLoop-- > 0) {
                        if (q13.length > q24.length + 1) {
                            const movableIdx = q13.findLastIndex(c => !fixed13.includes(c));
                            if (movableIdx !== -1) {
                                q24.push(q13.splice(movableIdx, 1)[0]);
                            } else {
                                break;
                            }
                        } else if (q24.length > q13.length + 1) {
                            const movableIdx = q24.findLastIndex(c => !fixed24.includes(c));
                            if (movableIdx !== -1) {
                                q13.push(q24.splice(movableIdx, 1)[0]);
                            } else {
                                break;
                            }
                        }
                    }

                    q13.forEach(c => {
                        c.tipo = 'QUINZENAL_1_3';
                        c.originalPeriodicidade = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (1,3)' : '1 3';
                    });
                    q24.forEach(c => {
                        c.tipo = 'QUINZENAL_2_4';
                        c.originalPeriodicidade = c.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (2,4)' : '2 4';
                    });

                    bucket.quinzenais13.push(...q13);
                    bucket.quinzenais24.push(...q24);
                } else {
                    quinzenais.forEach(c => {
                        const restr = clienteRestricoesMap.get(c.sampleVisit.Cod_Cliente);
                        if (restr && restr.Ativo !== false && restr.QuinzenaPermitida === '2_4') {
                            bucket.quinzenais24.push(c);
                        } else if (restr && restr.Ativo !== false && restr.QuinzenaPermitida === '1_3') {
                            bucket.quinzenais13.push(c);
                        } else if (c.tipo === 'QUINZENAL_2_4') {
                            bucket.quinzenais24.push(c);
                        } else {
                            bucket.quinzenais13.push(c);
                        }
                    });
                }

                // Salvaguarda Rígida de Não-Vacância Diária (Antivazio):
                // Só move clientes que NÃO possuem quinzena corporativa fixada!
                if (bucket.semanais.length + bucket.quinzenais13.length === 0 && bucket.quinzenais24.length >= 2) {
                    const movableCount = bucket.quinzenais24.filter(c => !fixed24.includes(c)).length;
                    if (movableCount > 0) {
                        const moveTarget = Math.min(movableCount, Math.floor(bucket.quinzenais24.length / 2));
                        let movedSoFar = 0;
                        for (let i = bucket.quinzenais24.length - 1; i >= 0 && movedSoFar < moveTarget; i--) {
                            const cand = bucket.quinzenais24[i];
                            if (!fixed24.includes(cand)) {
                                const [moved] = bucket.quinzenais24.splice(i, 1);
                                moved.tipo = 'QUINZENAL_1_3';
                                moved.originalPeriodicidade = moved.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (1,3)' : '1 3';
                                bucket.quinzenais13.push(moved);
                                movedSoFar++;
                            }
                        }
                    }
                } else if (bucket.semanais.length + bucket.quinzenais24.length === 0 && bucket.quinzenais13.length >= 2) {
                    const movableCount = bucket.quinzenais13.filter(c => !fixed13.includes(c)).length;
                    if (movableCount > 0) {
                        const moveTarget = Math.min(movableCount, Math.floor(bucket.quinzenais13.length / 2));
                        let movedSoFar = 0;
                        for (let i = bucket.quinzenais13.length - 1; i >= 0 && movedSoFar < moveTarget; i--) {
                            const cand = bucket.quinzenais13[i];
                            if (!fixed13.includes(cand)) {
                                const [moved] = bucket.quinzenais13.splice(i, 1);
                                moved.tipo = 'QUINZENAL_2_4';
                                moved.originalPeriodicidade = moved.originalPeriodicidade.toUpperCase().includes('QUINZENAL') ? 'QUINZENAL (2,4)' : '2 4';
                                bucket.quinzenais24.push(moved);
                                movedSoFar++;
                            }
                        }
                    }
                }
            }

            const unallocatedClients: typeof uniqueClients = [];

            // Em modo com teto estrito (!allowOverflow), remove excedentes
            if (!allowOverflow) {
                dayBuckets.forEach(bucket => {
                    const maxAllowed = bucket.maxCap;
                    while ((bucket.semanais.length + bucket.quinzenais13.length) > maxAllowed && bucket.quinzenais13.length > 0) {
                        unallocatedClients.push(bucket.quinzenais13.pop()!);
                    }
                    while ((bucket.semanais.length + bucket.quinzenais24.length) > maxAllowed && bucket.quinzenais24.length > 0) {
                        unallocatedClients.push(bucket.quinzenais24.pop()!);
                    }
                    while (bucket.semanais.length > maxAllowed) {
                        unallocatedClients.push(bucket.semanais.pop()!);
                    }
                });
            }

            for (const bucket of dayBuckets) {
                let rawClients13 = [...bucket.semanais, ...bucket.quinzenais13];
                let optimizedClients13 = await optimizeDayCircuitWithOSRM({ lat: baseLat, lng: baseLng }, rawClients13, optSequenceStrategy, clienteRestricoesMap, optEndAtLastClient);

                let rawClients24 = [...bucket.semanais, ...bucket.quinzenais24];
                let optimizedClients24 = await optimizeDayCircuitWithOSRM({ lat: baseLat, lng: baseLng }, rawClients24, optSequenceStrategy, clienteRestricoesMap, optEndAtLastClient);

                // Salvaguarda Estrita de Horas: Em modo não flexibilizado com limite de horas,
                // se a rota viária real + serviços exceder a jornada configurada,
                // remove as últimas paradas excedentes do dia e encaminha para unallocatedClients
                if (!allowOverflow && optLimitHours) {
                    const hoursForDay = (bucket.day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                    const maxMins = hoursForDay * 60;

                    while (optimizedClients13.length > 1) {
                        const coords = optimizedClients13.filter(c => c.lat && c.lng).map(c => ({ lat: c.lat, lng: c.lng }));
                        const metrics = calcCircuitMetrics({ lat: baseLat, lng: baseLng }, coords, optEndAtLastClient);
                        const serviceMins = optimizedClients13.reduce((acc, c) => acc + getClientServiceTime(c.sampleVisit), 0);
                        if (metrics.travelMinutes + serviceMins <= maxMins) break;
                        const removed = optimizedClients13.pop();
                        if (removed) unallocatedClients.push(removed);
                    }

                    while (optimizedClients24.length > 1) {
                        const coords = optimizedClients24.filter(c => c.lat && c.lng).map(c => ({ lat: c.lat, lng: c.lng }));
                        const metrics = calcCircuitMetrics({ lat: baseLat, lng: baseLng }, coords, optEndAtLastClient);
                        const serviceMins = optimizedClients24.reduce((acc, c) => acc + getClientServiceTime(c.sampleVisit), 0);
                        if (metrics.travelMinutes + serviceMins <= maxMins) break;
                        const removed = optimizedClients24.pop();
                        if (removed) unallocatedClients.push(removed);
                    }
                }

                const seq13Map = new Map<number, number>();
                optimizedClients13.forEach((c, idx) => seq13Map.set(c.sampleVisit.Cod_Cliente, idx + 1));

                const seq24Map = new Map<number, number>();
                optimizedClients24.forEach((c, idx) => seq24Map.set(c.sampleVisit.Cod_Cliente, idx + 1));

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
                        Data_da_Visita: c.sampleVisit.Data_da_Visita || '',
                        Sequencia_13: seq13Map.get(c.sampleVisit.Cod_Cliente),
                        Sequencia_24: seq24Map.get(c.sampleVisit.Cod_Cliente)
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
                        Data_da_Visita: c.sampleVisit.Data_da_Visita || '',
                        Sequencia_13: seq13Map.get(c.sampleVisit.Cod_Cliente),
                        Sequencia_24: seq24Map.get(c.sampleVisit.Cod_Cliente)
                    });
                });
            }

            // Salvaguarda matemática estrita: Quando allowOverflow = true, garante que nenhum cliente seja omitido
            if (allowOverflow) {
                const resultClientCodes = new Set(result.map(r => r.Cod_Cliente));
                const missingClients = uniqueClients.filter(c => !resultClientCodes.has(c.sampleVisit.Cod_Cliente));
                if (missingClients.length > 0) {
                    missingClients.forEach(c => {
                        const targetBucket = [...dayBuckets].sort((a, b) => 
                            (a.semanais.length + a.quinzenais13.length + a.quinzenais24.length) - 
                            (b.semanais.length + b.quinzenais13.length + b.quinzenais24.length)
                        )[0];
                        const isSemanal = c.tipo === 'SEMANAL';
                        const pFinal = isSemanal 
                            ? 'SEMANAL' 
                            : (c.tipo === 'QUINZENAL_1_3' ? '1 3' : '2 4');
                        result.push({
                            ...c.sampleVisit,
                            Cod_Vend: sellerId,
                            Nome_Vendedor: sellerName,
                            Dia_Semana: targetBucket ? targetBucket.day : activeDays[0],
                            Periodicidade: pFinal,
                            Data_da_Visita: c.sampleVisit.Data_da_Visita || ''
                        });
                    });
                }
            }

            // Clientes excedentes deixados sem atendimento por limite estrito de capacidade/tempo
            if (unallocatedClients.length > 0) {
                const uniqueUnallocated = new Map<number, typeof uniqueClients[0]>();
                unallocatedClients.forEach(c => {
                    if (!uniqueUnallocated.has(c.sampleVisit.Cod_Cliente)) {
                        uniqueUnallocated.set(c.sampleVisit.Cod_Cliente, c);
                    }
                });

                uniqueUnallocated.forEach(c => {
                    result.push({
                        ...c.sampleVisit,
                        Cod_Vend: sellerId,
                        Nome_Vendedor: sellerName,
                        Dia_Semana: 'SEM ATENDIMENTO',
                        Periodicidade: c.originalPeriodicidade || 'Semanal',
                        Data_da_Visita: c.sampleVisit.Data_da_Visita || ''
                    });
                });
            }
        }

        if (result.length > 0) {
            setAdjustedRoutes(prev => {
                const otherRoutes = prev.filter(r => !sellers.includes(r.Cod_Vend));
                return [...otherRoutes, ...result];
            });
        }

        setSelectedUnallocatedClients(new Set());
        setLoading(false);

        if (summaryMeta) {
            const unallocatedCount = result.filter(r => r.Dia_Semana === 'SEM ATENDIMENTO').length;
            setOptimizeProgress({
                current: sellers.length,
                total: sellers.length,
                percentage: 100,
                currentSellerName: 'Roteirização concluída com sucesso!',
                completedSummary: {
                    title: summaryMeta.title,
                    escopoDesc: summaryMeta.escopoDesc,
                    totalClients: result.length,
                    unallocatedCount,
                    mode: summaryMeta.mode,
                    hoursLimit: summaryMeta.hoursLimit
                }
            });
        } else {
            setOptimizeProgress(null);
        }
        return result;
    };

    const handleOptimizeSimulate = async () => {
        if (adjustedRoutes.length === 0) {
            alert("Nenhum dado de rota carregado para otimização.");
            return;
        }

        const sellers = Array.from(new Set(effectiveScopedRoutes.map(r => r.Cod_Vend)));
        if (sellers.length === 0) {
            alert("Nenhum vendedor encontrado no escopo selecionado.");
            return;
        }

        // Pré-checagem de viabilidade de capacidade / jornada para os vendedores em foco
        const feasibility = checkCapacityFeasibility(sellers, adjustedRoutes);
        if (feasibility.hasOverflow && feasibility.overflowData) {
            setCapacityOverflowData(feasibility.overflowData);
            setShowCapacityModal(true);
            return;
        }

        const isSingleSeller = sellers.length === 1;
        const singleColab = isSingleSeller ? getColabBySectorOrName(sellers[0], effectiveScopedRoutes[0]?.Nome_Vendedor) : null;
        const sellerNameDesc = singleColab?.Nome || effectiveScopedRoutes[0]?.Nome_Vendedor || `Vendedor ${sellers[0]}`;
        const escopoDesc = isSingleSeller
            ? `do vendedor ${sellerNameDesc}`
            : (scopeMode === 'vendedor' 
                ? 'do vendedor selecionado' 
                : (scopeMode === 'equipe' ? 'da equipe de supervisão selecionada' : 'geral'));

        const result = await runOptimizationForSellers(sellers, adjustedRoutes, true, {
            title: isSingleSeller ? `Otimização de ${sellerNameDesc} Concluída` : 'Otimização e Roteirização Concluída',
            escopoDesc: `Escopo: ${escopoDesc}`,
            mode: 'simulate'
        });
        if (result && result.length === 0) {
            alert("Aviso: Nenhuma visita pôde ser gerada para os dias ativos configurados.");
            return;
        }
        if (result && result.length > 0) {
            setOptimizedSellersSet(prev => {
                const next = new Set(prev);
                sellers.forEach(s => next.add(s));
                return next;
            });
        }
    };

    const handleOptimizeSingleSeller = async (targetSellerId: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (adjustedRoutes.length === 0) {
            alert("Nenhum dado de rota carregado para otimização.");
            return;
        }

        const sellerVisits = adjustedRoutes.filter(r => r.Cod_Vend === targetSellerId);
        if (sellerVisits.length === 0) {
            alert(`Nenhuma rota encontrada para o vendedor ID ${targetSellerId}.`);
            return;
        }

        // Pré-checagem de viabilidade de capacidade / jornada para o vendedor
        const feasibility = checkCapacityFeasibility([targetSellerId], adjustedRoutes);
        if (feasibility.hasOverflow && feasibility.overflowData) {
            setCapacityOverflowData(feasibility.overflowData);
            setShowCapacityModal(true);
            return;
        }

        const sellerColab = getColabBySectorOrName(targetSellerId, sellerVisits[0]?.Nome_Vendedor);
        const sellerNameDesc = sellerColab?.Nome || sellerVisits[0]?.Nome_Vendedor || `Vendedor ${targetSellerId}`;

        const result = await runOptimizationForSellers([targetSellerId], adjustedRoutes, true, {
            title: `Otimização de ${sellerNameDesc} Concluída`,
            escopoDesc: `Escopo: Vendedor ${sellerNameDesc} (ID ${targetSellerId})`,
            mode: 'simulate'
        });
        if (result && result.length === 0) {
            alert("Aviso: Nenhuma visita pôde ser gerada para os dias ativos configurados.");
            return;
        }
        if (result && result.length > 0) {
            setOptimizedSellersSet(prev => new Set(prev).add(targetSellerId));
        }
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
                await runOptimizationForSellers(receptors.map(r => r.id), newAdjustedRoutes, true, {
                    title: 'Redistribuição e Roteirização Concluída',
                    escopoDesc: 'Setores receptores reotimizados com sucesso',
                    mode: 'simulate'
                });
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
                    if (day === 'SEM ATENDIMENTO') continue;
                    const sortedVisits = [...visits].sort((a, b) => {
                        const seqA = (selectedQuinzenaFilter === '2_4' ? a.Sequencia_24 : a.Sequencia_13) ?? 0;
                        const seqB = (selectedQuinzenaFilter === '2_4' ? b.Sequencia_24 : b.Sequencia_13) ?? 0;
                        if (seqA && seqB) return seqA - seqB;
                        return 0;
                    });
                    const lineColor = isSingleSellerView ? (DAY_COLORS[day]?.hex || sellerBaseColor) : sellerBaseColor;
                    
                    const pointsObj: any[] = [];
                    if (colab?.LatitudeBase && colab?.LongitudeBase) {
                        pointsObj.push({ Lat: colab.LatitudeBase, Long: colab.LongitudeBase });
                    }
                    sortedVisits.forEach(v => {
                        if (v.Lat && v.Long) pointsObj.push({ Lat: v.Lat, Long: v.Long });
                    });
                    if (!optEndAtLastClient && colab?.LatitudeBase && colab?.LongitudeBase && pointsObj.length > 1) {
                        pointsObj.push({ Lat: colab.LatitudeBase, Long: colab.LongitudeBase });
                    }

                    if (pointsObj.length > 1) {
                        const hashKey = pointsObj.map(p => `${p.Lat},${p.Long}`).join('|');
                        const stopsCoords = sortedVisits.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long }));
                        const circuit = calcCircuitMetrics({ lat: colab?.LatitudeBase || 0, lng: colab?.LongitudeBase || 0 }, stopsCoords, optEndAtLastClient);
                        const lineMeta = {
                            id: `${sellerId}-${day}`,
                            color: lineColor,
                            day,
                            sellerId,
                            sellerName: formatSellerDisplayName(sellerId, colab?.Nome || visits[0]?.Nome_Vendedor),
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
    }, [filteredRoutes, scopedOriginalRoutes, selectedDaysFilter, selectedQuinzenaFilter, selectedPromoter, promoterColorMap, colaboradores, isSingleSellerView, optEndAtLastClient]);

    // Mapa da ordem/sequência de atendimento diário de cada cliente por Quinzena 1/3 e 2/4
    const visitOrderMap = useMemo(() => {
        const map = new Map<string, {
            order: number;
            total: number;
            order13?: number;
            total13?: number;
            order24?: number;
            total24?: number;
            isSemanal?: boolean;
        }>();
        const dayGroups = new Map<string, VisitaPrevista[]>();

        scopedAdjustedRoutes.forEach(v => {
            if (v.Dia_Semana === 'SEM ATENDIMENTO') return;
            const key = `${v.Cod_Vend}-${v.Dia_Semana}`;
            if (!dayGroups.has(key)) dayGroups.set(key, []);
            dayGroups.get(key)!.push(v);
        });

        dayGroups.forEach((visits, key) => {
            const [sellerIdStr] = key.split('-');
            const sellerId = Number(sellerIdStr);
            const colab = getColabBySectorOrName(sellerId, visits[0]?.Nome_Vendedor);
            const baseLat = colab?.LatitudeBase || visits.find(v => v.Lat)?.Lat || 0;
            const baseLng = colab?.LongitudeBase || visits.find(v => v.Long)?.Long || 0;
            const base = { lat: baseLat, lng: baseLng };

            // Ciclo 1/3 (Semanais + Quinzenais 1/3)
            const visits13 = visits.filter(r => {
                const p = parsePeriodicidade(r.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
            });
            const stops13 = visits13.map(v => ({ lat: v.Lat || 0, lng: v.Long || 0, visit: v }));
            const sequenced13 = sequenceDayStops(base, stops13, optSequenceStrategy, clienteRestricoesMap, optEndAtLastClient);

            // Ciclo 2/4 (Semanais + Quinzenais 2/4)
            const visits24 = visits.filter(r => {
                const p = parsePeriodicidade(r.Periodicidade).tipo;
                return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
            });
            const stops24 = visits24.map(v => ({ lat: v.Lat || 0, lng: v.Long || 0, visit: v }));
            const sequenced24 = sequenceDayStops(base, stops24, optSequenceStrategy, clienteRestricoesMap, optEndAtLastClient);

            const map13 = new Map<number, number>();
            sequenced13.forEach((s, idx) => map13.set(s.visit.Cod_Cliente, idx + 1));

            const map24 = new Map<number, number>();
            sequenced24.forEach((s, idx) => map24.set(s.visit.Cod_Cliente, idx + 1));

            visits.forEach(v => {
                const clientKey = `${v.Cod_Vend}-${v.Dia_Semana}-${v.Cod_Cliente}`;
                const pType = parsePeriodicidade(v.Periodicidade).tipo;
                const order13 = map13.get(v.Cod_Cliente);
                const order24 = map24.get(v.Cod_Cliente);
                const primaryOrder = order13 || order24 || 1;
                const primaryTotal = order13 ? visits13.length : visits24.length;

                map.set(clientKey, {
                    order: primaryOrder,
                    total: primaryTotal,
                    order13,
                    total13: visits13.length,
                    order24,
                    total24: visits24.length,
                    isSemanal: pType === 'SEMANAL'
                });
            });
        });

        return map;
    }, [scopedAdjustedRoutes, colaboradores, optSequenceStrategy, clienteRestricoesMap, optEndAtLastClient]);

    // Função auxiliar para calcular KPIs de um par de rotas (originais vs ajustadas)
    const calcKpisForRoutes = useCallback((origVisits: VisitaPrevista[], adjVisits: VisitaPrevista[]) => {
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
                    if (day === 'SEM ATENDIMENTO') return;

                    // Quinzena 1/3 (Semanais + Quinzenais 1/3)
                    const visits13 = dayVisits.filter(r => {
                        const p = parsePeriodicidade(r.Periodicidade).tipo;
                        return p === 'SEMANAL' || p === 'QUINZENAL_1_3';
                    });
                    // Quinzena 2/4 (Semanais + Quinzenais 2/4)
                    const visits24 = dayVisits.filter(r => {
                        const p = parsePeriodicidade(r.Periodicidade).tipo;
                        return p === 'SEMANAL' || p === 'QUINZENAL_2_4';
                    });

                    const stops13 = visits13.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long, seq: v.Sequencia_13 }));
                    const stops24 = visits24.filter(v => v.Lat && v.Long).map(v => ({ lat: v.Lat, lng: v.Long, seq: v.Sequencia_24 }));

                    const orderedStops13 = stops13.some(s => s.seq !== undefined && s.seq > 0)
                        ? [...stops13].sort((a, b) => (a.seq || 0) - (b.seq || 0))
                        : optimizeDayCircuit2Opt(base, stops13, optEndAtLastClient);

                    const orderedStops24 = stops24.some(s => s.seq !== undefined && s.seq > 0)
                        ? [...stops24].sort((a, b) => (a.seq || 0) - (b.seq || 0))
                        : optimizeDayCircuit2Opt(base, stops24, optEndAtLastClient);

                    const circuit13 = calcCircuitMetrics(base, orderedStops13, optEndAtLastClient);
                    const circuit24 = calcCircuitMetrics(base, orderedStops24, optEndAtLastClient);

                    // Média semanal típica de percurso do dia (duas semanas no ciclo 1/3 e duas no ciclo 2/4)
                    const dayAvgKm = (circuit13.totalKm + circuit24.totalKm) / 2;
                    const dayAvgTravelMinutes = (circuit13.travelMinutes + circuit24.travelMinutes) / 2;

                    totalKm += dayAvgKm;
                    totalTravelMinutes += dayAvgTravelMinutes;

                    const dayVisitsServiceMins13 = visits13.reduce((acc, v) => acc + getClientServiceTime(v), 0);
                    const dayVisitsServiceMins24 = visits24.reduce((acc, v) => acc + getClientServiceTime(v), 0);
                    const maxDayTotalHours = Math.max(
                        circuit13.travelMinutes + dayVisitsServiceMins13,
                        circuit24.travelMinutes + dayVisitsServiceMins24
                    ) / 60;
                    const maxDayKm = Math.max(circuit13.totalKm, circuit24.totalKm);

                    const peakVisitsInDay = Math.max(visits13.length, visits24.length);
                    const dayKey = `${sellerId}-${day}`;
                    countsPerSellerAndDay.set(dayKey, peakVisitsInDay);

                    if (optLimitKm && maxDayKm > optMaxKm) {
                        sellerHasExceededDay = true;
                    }
                    const maxDayAllowedHours = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                    if (optLimitHours && maxDayTotalHours > maxDayAllowedHours) {
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
                totalKm: Math.round(totalKm * 10) / 10,
                totalTravelMinutes: Math.round(totalTravelMinutes),
                avgKmPerSeller: sellers.length ? Math.round(totalKm / sellers.length) : 0,
                avgMinutesPerSeller: sellers.length ? Math.round(totalTravelMinutes / sellers.length) : 0,
                maxClientsOnSingleDay,
                exceededKmCount,
                exceededHoursCount,
                sellerCount: sellers.length,
                clientCount: visits.length,
                countsPerSellerAndDay
            };
        };

        const orig = getKpisForSet(origVisits);
        const adj = getKpisForSet(adjVisits);

        const kmSaved = Math.round((orig.totalKm - adj.totalKm) * 10) / 10;
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
    }, [colaboradores, optEndAtLastClient, optLimitKm, optMaxKm, optLimitHours, optMaxHours, optSatHalfPeriod, getClientServiceTime]);

    // Calcular KPIs de Comparação com Métricas Reais de Circuito Fechado (KM e Tempo de Deslocamento)
    const kpis = useMemo(() => {
        return calcKpisForRoutes(scopedOriginalRoutes, scopedAdjustedRoutes);
    }, [calcKpisForRoutes, scopedOriginalRoutes, scopedAdjustedRoutes]);

    // KPIs do modal de comparativo (suporte a filtro individual de colaborador)
    const compareKpis = useMemo(() => {
        if (compareSellerFilter === 'ALL') return kpis;
        const filteredOrig = scopedOriginalRoutes.filter(r => String(r.Cod_Vend) === compareSellerFilter);
        const filteredAdj = scopedAdjustedRoutes.filter(r => String(r.Cod_Vend) === compareSellerFilter);
        return calcKpisForRoutes(filteredOrig, filteredAdj);
    }, [compareSellerFilter, kpis, scopedOriginalRoutes, scopedAdjustedRoutes, calcKpisForRoutes]);

    // Resumo de visitas distribuídas por dia da semana no modal de comparativo
    const compareVisitsByDay = useMemo(() => {
        if (compareSellerFilter === 'ALL') return visitsByDay;
        const routes = scopedAdjustedRoutes.filter(v => {
            if (String(v.Cod_Vend) !== compareSellerFilter) return false;
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
    }, [compareSellerFilter, visitsByDay, scopedAdjustedRoutes, selectedQuinzenaFilter]);

    // Resumo de visitas distribuídas por dia da semana no modal de comparativo (Rota Original)
    const compareOriginalVisitsByDay = useMemo(() => {
        if (compareSellerFilter === 'ALL') return originalVisitsByDay;
        const routes = scopedOriginalRoutes.filter(v => {
            if (String(v.Cod_Vend) !== compareSellerFilter) return false;
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
    }, [compareSellerFilter, originalVisitsByDay, scopedOriginalRoutes, selectedQuinzenaFilter]);

    // Comparativo detalhado de clientes filtrado no modal
    const compareRouteComparisonDiff = useMemo(() => {
        if (compareSellerFilter === 'ALL') return routeComparisonDiff;
        const filteredItems = routeComparisonDiff.items.filter(i => String(i.codVend) === compareSellerFilter);
        const totalClients = filteredItems.length;
        const totalChanged = filteredItems.filter(i => i.isChanged).length;
        const totalUnchanged = totalClients - totalChanged;
        return {
            items: filteredItems,
            totalClients,
            totalChanged,
            totalUnchanged
        };
    }, [compareSellerFilter, routeComparisonDiff]);

    // Contagem de desbalanço quinzenal para o vendedor selecionado no modal
    const compareImbalancedSellersCount = useMemo(() => {
        if (compareSellerFilter === 'ALL') return imbalancedSellersCount;
        return getSellerQuinzenaStats(Number(compareSellerFilter), scopedAdjustedRoutes).isImbalanced ? 1 : 0;
    }, [compareSellerFilter, imbalancedSellersCount, scopedAdjustedRoutes]);

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

    // Alternar seleção de cliente sem atendimento
    const handleToggleSelectUnallocated = (clientCode: number) => {
        setSelectedUnallocatedClients(prev => {
            const next = new Set(prev);
            if (next.has(clientCode)) {
                next.delete(clientCode);
            } else {
                next.add(clientCode);
            }
            return next;
        });
    };

    // Selecionar todos os clientes sem atendimento da lista
    const handleSelectAllUnallocated = (unallocatedList: VisitaPrevista[]) => {
        setSelectedUnallocatedClients(new Set(unallocatedList.map(c => c.Cod_Cliente)));
    };

    // Limpar seleção de clientes sem atendimento
    const handleClearSelectionUnallocated = () => {
        setSelectedUnallocatedClients(new Set());
    };

    // Aplicar transferência em massa de clientes sem atendimento
    const handleApplyMassTransferUnallocated = () => {
        if (selectedUnallocatedClients.size === 0) {
            alert("Selecione ao menos um cliente sem atendimento para transferir.");
            return;
        }

        const hasDayChange = Boolean(massTargetDay && massTargetDay.trim());
        const hasSellerChange = Boolean(massTargetSellerId && massTargetSellerId.trim());
        const hasPeriodicidadeChange = Boolean(massTargetPeriodicidade && massTargetPeriodicidade.trim());

        if (!hasDayChange && !hasSellerChange && !hasPeriodicidadeChange) {
            alert("Selecione um novo Dia de Visita, novo Vendedor ou nova Periodicidade para aplicar a transferência em massa.");
            return;
        }

        const targetSellerNum = hasSellerChange ? Number(massTargetSellerId) : null;
        const targetColab = targetSellerNum !== null ? getColabBySectorOrName(targetSellerNum) : null;
        const count = selectedUnallocatedClients.size;

        setAdjustedRoutes(prev => prev.map(v => {
            if (selectedUnallocatedClients.has(v.Cod_Cliente)) {
                const finalSellerId = targetSellerNum !== null ? targetSellerNum : v.Cod_Vend;
                const finalSellerName = targetSellerNum !== null ? (targetColab?.Nome || v.Nome_Vendedor) : v.Nome_Vendedor;
                const finalDay = hasDayChange ? massTargetDay : v.Dia_Semana;
                const finalPeriodicidade = hasPeriodicidadeChange ? massTargetPeriodicidade : v.Periodicidade;

                return {
                    ...v,
                    Cod_Vend: finalSellerId,
                    Nome_Vendedor: finalSellerName,
                    Dia_Semana: finalDay,
                    Periodicidade: finalPeriodicidade
                };
            }
            return v;
        }));

        setSelectedUnallocatedClients(new Set());
        setMassTargetDay('');
        setMassTargetSellerId('');
        setMassTargetPeriodicidade('');

        const targetDescParts: string[] = [];
        if (hasDayChange) targetDescParts.push(`Dia: ${massTargetDay}`);
        if (hasSellerChange) targetDescParts.push(`Colaborador: ${formatSellerDisplayName(targetSellerNum!, targetColab?.Nome || '')}`);
        if (hasPeriodicidadeChange) targetDescParts.push(`Periodicidade: ${massTargetPeriodicidade}`);

        alert(`✅ Transferência em Massa Concluída com Sucesso!\n\n• Total de clientes reatribuídos: ${count}\n• Parâmetros aplicados: ${targetDescParts.join(' | ')}\n\nOs itinerários, circuitos viários OSRM e totalizadores foram recalculados instantaneamente.`);
    };

    // Barra Contextual de Transferência em Massa de Clientes Excedentes
    const renderMassTransferToolbar = (unallocatedList: VisitaPrevista[]) => {
        if (unallocatedList.length === 0) return null;
        const selectedCount = selectedUnallocatedClients.size;
        const allSelected = unallocatedList.length > 0 && unallocatedList.every(c => selectedUnallocatedClients.has(c.Cod_Cliente));

        return (
            <div className="p-3 bg-red-50/90 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl space-y-2.5 shadow-xs mb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-600 text-white text-xs font-black shadow-xs">
                            ⚡
                        </span>
                        <div>
                            <span className="text-xs font-black text-red-900 dark:text-red-200">
                                Transferência em Massa de Clientes Excedentes
                            </span>
                            <span className="ml-2 text-[11px] font-bold text-red-700 dark:text-red-300">
                                ({selectedCount} de {unallocatedList.length} selecionados)
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                if (allSelected) {
                                    handleClearSelectionUnallocated();
                                } else {
                                    handleSelectAllUnallocated(unallocatedList);
                                }
                            }}
                            className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40 transition cursor-pointer shadow-2xs"
                        >
                            {allSelected ? '⬜ Desmarcar Todos' : `☑️ Selecionar Todos (${unallocatedList.length})`}
                        </button>
                        {selectedCount > 0 && (
                            <button
                                type="button"
                                onClick={handleClearSelectionUnallocated}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                            >
                                Limpar
                            </button>
                        )}
                    </div>
                </div>

                {selectedCount > 0 && (
                    <div className="p-2.5 bg-white/90 dark:bg-slate-900/90 border border-red-200/80 dark:border-red-900/50 rounded-xl flex flex-wrap items-center gap-2.5 shadow-2xs animate-in fade-in duration-200">
                        {/* Seletor de Novo Dia */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-[170px]">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
                                Novo Dia:
                            </span>
                            <select
                                value={massTargetDay}
                                onChange={(e) => setMassTargetDay(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer focus:ring-1 focus:ring-red-500"
                            >
                                <option value="">(Manter Dia Atual)</option>
                                {WEEKDAYS.map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>

                        {/* Seletor de Novo Colaborador */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-[190px]">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
                                Novo Vendedor:
                            </span>
                            <select
                                value={massTargetSellerId}
                                onChange={(e) => setMassTargetSellerId(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer focus:ring-1 focus:ring-red-500"
                            >
                                <option value="">(Manter Vendedor Atual)</option>
                                {teamColaboradores.map(c => (
                                    <option key={c.ID_Colaborador} value={c.CodigoSetor}>
                                        {formatSellerDisplayName(c.CodigoSetor, c.Nome)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Seletor de Periodicidade */}
                        <div className="flex items-center gap-1.5 min-w-[150px]">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
                                Periodicidade:
                            </span>
                            <select
                                value={massTargetPeriodicidade}
                                onChange={(e) => setMassTargetPeriodicidade(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer focus:ring-1 focus:ring-red-500"
                            >
                                <option value="">(Manter Atual)</option>
                                <option value="Semanal">Semanal</option>
                                <option value="1 3">Quinzenal (1, 3)</option>
                                <option value="2 4">Quinzenal (2, 4)</option>
                            </select>
                        </div>

                        {/* Botão de Aplicação */}
                        <button
                            type="button"
                            onClick={handleApplyMassTransferUnallocated}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 shadow-md shadow-red-600/20 transition flex items-center space-x-1.5 cursor-pointer shrink-0"
                            title={`Transferir ${selectedCount} cliente(s) selecionado(s)`}
                        >
                            <span>🚀 Transferir Selecionados ({selectedCount})</span>
                        </button>
                    </div>
                )}
            </div>
        );
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

    // Abrir Modal de Resumo Operacional com filtro inicial coerente
    const handleOpenSummaryModal = () => {
        if (focusedMapSellerId) {
            setSummarySellerFilter(String(focusedMapSellerId));
        } else if (selectedPromoter !== 'ALL') {
            setSummarySellerFilter(selectedPromoter);
        } else if (effectiveSellersList.length === 1) {
            setSummarySellerFilter(effectiveSellersList[0]);
        } else {
            setSummarySellerFilter('ALL');
        }
        setShowSummaryModal(true);
    };

    // Abrir Modal de Comparativo Antes x Depois com filtro inicial coerente
    const handleOpenCompareModal = () => {
        if (focusedMapSellerId) {
            setCompareSellerFilter(String(focusedMapSellerId));
        } else if (selectedPromoter !== 'ALL') {
            setCompareSellerFilter(selectedPromoter);
        } else if (effectiveSellersList.length === 1) {
            setCompareSellerFilter(effectiveSellersList[0]);
        } else {
            setCompareSellerFilter('ALL');
        }
        setShowCompareModal(true);
    };

    // Abrir Modal para Salvar Rota com Nome Personalizado
    const handleOpenSaveModal = () => {
        if (effectiveScopedRoutes.length === 0) {
            alert("Sem rotas para salvar no escopo selecionado.");
            return;
        }

        const tag = teamType === 'vendedores' ? '[VENDEDOR]' : '[PROMOTOR]';
        const isSingleSeller = (selectedTeamSellers.size === 1) || (selectedPromoter !== 'ALL');
        const singleColabName = isSingleSeller
            ? (getColabBySectorOrName(Number(effectiveScopedRoutes[0]?.Cod_Vend), effectiveScopedRoutes[0]?.Nome_Vendedor)?.Nome || effectiveScopedRoutes[0]?.Nome_Vendedor)
            : null;

        const defaultName = loadedSimInfo?.name || (
            singleColabName 
                ? `${tag} ${singleColabName} - ${new Date().toLocaleDateString('pt-BR')}`
                : `${tag} ROTA AJUSTADA OTIMIZADA - ${new Date().toLocaleDateString('pt-BR')}`
        );
        setSimSaveName(defaultName);
        setSimSaveDesc(loadedSimInfo?.desc || '');
        setSimSaveOverwrite(Boolean(loadedSimInfo?.id));
        setShowSaveModal(true);
    };

    // Confirmar e Salvar no Banco (saveRotaPrevista)
    const handleConfirmSave = async () => {
        if (!simSaveName.trim()) {
            alert("Por favor, informe um nome para a simulação.");
            return;
        }

        setSaving(true);
        try {
            // Salvar estritamente as rotas do escopo filtrado ativo
            const routesToSave = effectiveScopedRoutes;
            const groups = new Map<number, VisitaPrevista[]>();
            routesToSave.forEach(v => {
                if(!groups.has(v.Cod_Vend)) groups.set(v.Cod_Vend, []);
                groups.get(v.Cod_Vend)?.push(v);
            });

            // KM Total do escopo salvo (usando a média quinzenal de KM calculada pelo operationalSummary)
            const scopeKm = (operationalSummary.totalKm13 + operationalSummary.totalKm24) > 0
                ? Math.round(((operationalSummary.totalKm13 + operationalSummary.totalKm24) / 2) * 10) / 10
                : kpis.adjusted.totalKm;

            const snapshotData = {
                teamType,
                periodo: simSaveName.trim(),
                descricao: simSaveDesc.trim(),
                totalKm: scopeKm,
                sellers: Array.from(groups.entries()).map(([vendedorId, visits]) => ({
                    id: vendedorId,
                    name: visits[0]?.Nome_Vendedor || `Vendedor ${vendedorId}`,
                    clients: visits.map(c => ({
                        Cod_Cliente: c.Cod_Cliente,
                        Razao_Social: c.Razao_Social,
                        Endereco: c.Endereco,
                        Numero: c.Numero,
                        Bairro: c.Bairro,
                        Cidade: c.Cidade,
                        CEP: c.CEP,
                        Lat: c.Lat,
                        Long: c.Long,
                        Dia_Semana: c.Dia_Semana,
                        Periodicidade: c.Periodicidade,
                        Canal_Remuneracao: c.Canal_Remuneracao,
                        Cod_Supervisor: c.Cod_Supervisor,
                        Nome_Supervisor: c.Nome_Supervisor,
                        Sequencia_13: c.Sequencia_13,
                        Sequencia_24: c.Sequencia_24
                    }))
                }))
            };

            const payload = {
                Periodo: simSaveName.trim(),
                Descricao: simSaveDesc.trim() || undefined,
                TotalKM: scopeKm,
                UsuarioSimulacao: authUser?.Nome || 'Operador',
                SnapshotData: snapshotData,
                TipoProcesso: 'AJUSTE_ROTA',
                overwriteId: (simSaveOverwrite && loadedSimInfo?.id) ? loadedSimInfo.id : undefined,
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

            const res = await saveRotaPrevista(payload);
            const savedId = res && typeof res === 'object' && res.id ? res.id : (loadedSimInfo?.id || 0);

            setLoadedSimInfo({
                id: savedId,
                name: simSaveName.trim(),
                desc: simSaveDesc.trim()
            });

            setShowSaveModal(false);

            if (savedId) {
                setShareModalData({
                    isOpen: true,
                    simId: savedId,
                    periodo: simSaveName.trim(),
                    totalKm: kpis.adjusted.totalKm
                });
            } else {
                alert("Simulação de rota salva com sucesso!");
            }
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Gestão de Críticas e Sugestões do Supervisor no Ajuste de Rota
    const [totalPendingCriticas, setTotalPendingCriticas] = useState<number>(0);
    const [viewingCriticasSim, setViewingCriticasSim] = useState<{ id: number; nome: string } | null>(null);
    const [criticasSimList, setCriticasSimList] = useState<any[]>([]);
    const [loadingCriticas, setLoadingCriticas] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [criticaToast, setCriticaToast] = useState<string | null>(null);

    useEffect(() => {
        if (!criticaToast) return;
        const timer = setTimeout(() => setCriticaToast(null), 5000);
        return () => clearTimeout(timer);
    }, [criticaToast]);

    const loadPendingCriticasCount = useCallback(async () => {
        try {
            const res = await getSimulacoesPendentesCount();
            if (res && typeof res.count === 'number') {
                setTotalPendingCriticas(res.count);
            }
        } catch (e) {
            console.error("Erro ao obter contagem de críticas:", e);
        }
    }, []);

    useEffect(() => {
        loadPendingCriticasCount();
    }, [loadPendingCriticasCount]);

    const handleOpenSimCriticas = async (simId: number, nome: string) => {
        setViewingCriticasSim({ id: simId, nome });
        setLoadingCriticas(true);
        try {
            const list = await getSimulacaoSugestoes(simId);
            setCriticasSimList(Array.isArray(list) ? list : []);
        } catch (e: any) {
            console.error("Erro ao carregar críticas da simulação:", e);
            alert("Erro ao carregar críticas: " + (e.message || e));
        } finally {
            setLoadingCriticas(false);
        }
    };

    const handleUpdateCriticaStatus = async (sugId: number, newStatus: string) => {
        setActionLoadingId(sugId);
        try {
            if (newStatus === 'APLICADO') {
                // Aplicação Automática com 1 Clique (atualiza rotas ativas/snapshot e cria restrição de janela)
                const res = await aplicarSugestao(sugId, { usuario: authUser?.Nome || 'Analista de Rotas' });
                if (res && res.success) {
                    const cod = res.codCliente ? Number(res.codCliente) : null;
                    const actionsPerformed: string[] = [];

                    // 1. Atualizar rota ativa em memória se o cliente estiver presente
                    if (cod) {
                        setAdjustedRoutes(prev => prev.map(r => {
                            if (Number(r.Cod_Cliente) === cod) {
                                return {
                                    ...r,
                                    ...(res.diaSugerido ? { Dia_Semana: res.diaSugerido } : {}),
                                    ...(res.semanaSugerida ? { Periodicidade: res.semanaSugerida } : {})
                                };
                            }
                            return r;
                        }));

                        if (res.diaSugerido) {
                            actionsPerformed.push(`Cliente #${cod} movido para ${res.diaSugerido}`);
                        }
                        if (res.semanaSugerida) {
                            actionsPerformed.push(`Periodicidade alterada para ${res.semanaSugerida}`);
                        }
                    }

                    // 2. Se criou exceção de horário/janela, recarregar restrições de clientes
                    if (res.restricaoCriada) {
                        try {
                            const restrRes = await getClienteRestricoes();
                            if (restrRes && restrRes.success && Array.isArray(restrRes.restricoes)) {
                                setClienteRestricoes(restrRes.restricoes);
                            }
                        } catch (e) {
                            console.warn("Aviso ao recarregar restrições de clientes:", e);
                        }
                        actionsPerformed.push(`Exceção de horário cadastrada nos parâmetros de janela`);
                    }

                    // 3. Atualizar status e contadores na interface
                    setCriticasSimList(prev => prev.map(s => s.ID_Sugestao === sugId ? { ...s, Status: 'APLICADO' } : s));
                    setSavedSimulationsList(prev => prev.map(s => {
                        if (s.ID_RotaHist === viewingCriticasSim?.id) {
                            const currentPending = Number(s.SugestoesPendentes) || 0;
                            return {
                                ...s,
                                SugestoesPendentes: Math.max(0, currentPending - 1)
                            };
                        }
                        return s;
                    }));
                    loadPendingCriticasCount();

                    // 4. Feedback elegante via Toast
                    const feedbackMsg = actionsPerformed.length > 0
                        ? `✓ Sucesso com 1 clique! ${actionsPerformed.join(' • ')}.`
                        : `✓ Sugestão #${sugId} aplicada com sucesso!`;
                    setCriticaToast(feedbackMsg);
                } else {
                    alert(res?.error || res?.message || 'Erro ao aplicar sugestão.');
                }
            } else {
                // Rejeitar ou alterar status simples
                const res = await updateSugestaoStatus(sugId, newStatus);
                if (res && res.success) {
                    setCriticasSimList(prev => prev.map(s => s.ID_Sugestao === sugId ? { ...s, Status: newStatus } : s));
                    setSavedSimulationsList(prev => prev.map(s => {
                        if (s.ID_RotaHist === viewingCriticasSim?.id) {
                            const currentPending = Number(s.SugestoesPendentes) || 0;
                            return {
                                ...s,
                                SugestoesPendentes: Math.max(0, currentPending - 1)
                            };
                        }
                        return s;
                    }));
                    loadPendingCriticasCount();
                    setCriticaToast(`✓ Status da sugestão atualizado para ${newStatus}.`);
                }
            }
        } catch (e: any) {
            console.error("Erro ao atualizar/aplicar status da crítica:", e);
            alert("Erro ao processar crítica: " + (e.message || e));
        } finally {
            setActionLoadingId(null);
        }
    };

    // Gestão de Simulações Salvas (Listar, Carregar, Excluir) - Estritamente do Ajuste de Rota
    const handleOpenSavedSimulationsModal = async () => {
        setShowSavedSimulationsModal(true);
        setLoadingSavedSimulations(true);
        loadPendingCriticasCount();
        try {
            const list = await getRotaPrevistaHistory('AJUSTE_ROTA');
            setSavedSimulationsList(Array.isArray(list) ? list : []);
        } catch (e: any) {
            console.error("Erro ao carregar simulações:", e);
            alert("Erro ao carregar simulações salvas: " + (e.message || e));
        } finally {
            setLoadingSavedSimulations(false);
        }
    };

    const handleLoadSimulation = async (simId: number) => {
        setLoadingSimId(simId);
        try {
            const data = await getSimulacaoPublica(simId);
            if (!data || !data.snapshot) {
                alert("Simulação não encontrada ou sem snapshot válido.");
                return;
            }

            const snapshot = data.snapshot;
            const restoredVisits: VisitaPrevista[] = [];

            if (Array.isArray(snapshot.sellers)) {
                snapshot.sellers.forEach((s: any) => {
                    const sellerId = Number(s.id || s.Cod_Vend) || 0;
                    const sellerName = s.name || s.Nome_Vendedor || `Colaborador ${sellerId}`;
                    const clients = s.clients || s.visitas || [];
                    clients.forEach((c: any) => {
                        restoredVisits.push({
                            Cod_Vend: sellerId,
                            Nome_Vendedor: sellerName,
                            Cod_Supervisor: Number(c.Cod_Supervisor) || 0,
                            Nome_Supervisor: c.Nome_Supervisor || '',
                            Cod_Cliente: Number(c.Cod_Cliente) || 0,
                            Razao_Social: c.Razao_Social || `Cliente ${c.Cod_Cliente}`,
                            Dia_Semana: c.Dia_Semana || 'SEGUNDA-FEIRA',
                            Periodicidade: c.Periodicidade || 'Semanal',
                            Data_da_Visita: c.Data_da_Visita || new Date().toISOString().split('T')[0],
                            Endereco: c.Endereco || '',
                            Numero: c.Numero || '',
                            Bairro: c.Bairro || '',
                            Cidade: c.Cidade || '',
                            CEP: c.CEP || '',
                            Lat: Number(c.Lat) || 0,
                            Long: Number(c.Long) || 0,
                            Canal_Remuneracao: c.Canal_Remuneracao || '',
                            Sequencia_13: c.Sequencia_13 !== undefined ? Number(c.Sequencia_13) : undefined,
                            Sequencia_24: c.Sequencia_24 !== undefined ? Number(c.Sequencia_24) : undefined
                        });
                    });
                });
            } else if (Array.isArray(snapshot.visitas)) {
                snapshot.visitas.forEach((v: any) => {
                    restoredVisits.push({
                        ...v,
                        Lat: Number(v.Lat) || 0,
                        Long: Number(v.Long) || 0
                    });
                });
            }

            if (restoredVisits.length === 0) {
                alert("Nenhum cliente ou visita encontrado nos dados desta simulação.");
                return;
            }

            if (snapshot.teamType === 'promotores' || snapshot.teamType === 'vendedores') {
                setTeamType(snapshot.teamType);
            } else if (data.periodo && data.periodo.includes('[PROMOTOR]')) {
                setTeamType('promotores');
            } else {
                setTeamType('vendedores');
            }

            setAdjustedRoutes(restoredVisits);
            setOriginalRoutes(restoredVisits);
            setScopeMode('geral');
            setSelectedSeller('');
            setSelectedSupervisor('');

            const firstValidVisit = restoredVisits.find(v => v.Lat && v.Long && v.Lat !== 0 && v.Long !== 0);
            if (firstValidVisit) {
                setMapFlyToTarget({
                    lat: firstValidVisit.Lat,
                    lng: firstValidVisit.Long,
                    codCliente: firstValidVisit.Cod_Cliente,
                    timestamp: Date.now()
                });
            }

            setLoadedSimInfo({
                id: data.id,
                name: data.periodo || `Simulação #${data.id}`,
                desc: data.descricao || ''
            });

            setShowSavedSimulationsModal(false);
        } catch (e: any) {
            console.error("Erro ao carregar simulação:", e);
            alert("Erro ao carregar simulação: " + (e.message || e));
        } finally {
            setLoadingSimId(null);
        }
    };

    const handleDeleteSavedSimulation = async (simId: number, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir permanentemente a simulação "${name}"?\nEsta ação removerá o registro e os detalhes de cálculo associados.`)) {
            return;
        }

        setDeletingSimId(simId);
        try {
            await deleteRotaPrevista(simId, 'Excluído pelo usuário no Ajuste de Rota');
            const list = await getRotaPrevistaHistory('AJUSTE_ROTA');
            setSavedSimulationsList(Array.isArray(list) ? list : []);
            if (loadedSimInfo?.id === simId) {
                setLoadedSimInfo(null);
            }
            loadPendingCriticasCount();
        } catch (e: any) {
            alert("Erro ao excluir simulação: " + (e.message || e));
        } finally {
            setDeletingSimId(null);
        }
    };

    const filteredSimulations = useMemo(() => {
        if (!simSearchTerm.trim()) return savedSimulationsList;
        const q = simSearchTerm.toLowerCase();
        return savedSimulationsList.filter((s: any) => {
            const periodo = (s.Periodo || '').toLowerCase();
            const desc = (s.Descricao || '').toLowerCase();
            const user = (s.UsuarioSimulacao || '').toLowerCase();
            const data = (s.DataSimulacao || '').toLowerCase();
            return periodo.includes(q) || desc.includes(q) || user.includes(q) || data.includes(q);
        });
    }, [savedSimulationsList, simSearchTerm]);

    // Efeito para carregar simulação se vier via parâmetro de URL (?simId=...)
    useEffect(() => {
        try {
            const hash = window.location.hash || '';
            const search = window.location.search || '';
            const queryStr = hash.includes('?') ? hash.split('?')[1] : search;
            const params = new URLSearchParams(queryStr);
            const simIdParam = params.get('simId');
            if (simIdParam && !isNaN(Number(simIdParam))) {
                handleLoadSimulation(Number(simIdParam));
            }
        } catch (e) {
            console.error("Erro ao verificar parâmetro de rota:", e);
        }
    }, []);

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
        let totalTravelMinutes = 0;
        let totalServiceMinutes = 0;
        let prevLat = baseLat;
        let prevLng = baseLng;

        const calcLegMinutes = (roadKm: number) => {
            if (roadKm <= 0) return 0;
            let speed = 30; // km/h
            if (roadKm < 2.5) speed = 22;
            else if (roadKm >= 15) speed = 55;
            return Math.max(1, Math.round((roadKm / speed) * 60));
        };

        const stopsWithKm = dayVisits.map((v, idx) => {
            const curLat = v.Lat || 0;
            const curLng = v.Long || 0;
            const legKm = (prevLat && prevLng && curLat && curLng) ? Math.round(calcDist(prevLat, prevLng, curLat, curLng) * 1.18 * 10) / 10 : 0;
            const legTravelTime = calcLegMinutes(legKm);
            const serviceTime = getClientServiceTime(v);

            totalKm += legKm;
            totalTravelMinutes += legTravelTime;
            totalServiceMinutes += serviceTime;

            if (curLat && curLng) {
                prevLat = curLat;
                prevLng = curLng;
            }
            return {
                ...v,
                stopOrder: idx + 1,
                legKm,
                legTravelTime,
                serviceTime,
                legTotalTime: legTravelTime + serviceTime,
                cumKm: Math.round(totalKm * 10) / 10,
                cumMinutes: Math.round(totalTravelMinutes + totalServiceMinutes)
            };
        });

        const returnLegKm = (!optEndAtLastClient && prevLat && prevLng && baseLat && baseLng && dayVisits.length > 0)
            ? Math.round(calcDist(prevLat, prevLng, baseLat, baseLng) * 1.18 * 10) / 10
            : 0;
        const returnTravelTime = !optEndAtLastClient ? calcLegMinutes(returnLegKm) : 0;
        totalKm += returnLegKm;
        totalTravelMinutes += returnTravelTime;

        return {
            sellerId: activeSellerId,
            sellerName: formatSellerDisplayName(activeSellerId, colab?.Nome || sellerVisits[0]?.Nome_Vendedor),
            colab,
            day: itineraryDay,
            quinzena: itineraryQuinzena,
            baseLat,
            baseLng,
            baseAddress,
            stops: stopsWithKm,
            totalStops: stopsWithKm.length,
            totalKm: Math.round(totalKm * 10) / 10,
            returnLegKm,
            returnTravelTime,
            totalTravelMinutes: Math.round(totalTravelMinutes),
            totalServiceMinutes: Math.round(totalServiceMinutes),
            totalDurationMinutes: Math.round(totalTravelMinutes + totalServiceMinutes)
        };
    }, [showItineraryModal, scopedAdjustedRoutes, itinerarySeller, itineraryDay, itineraryQuinzena, availableSellers, colaboradores, getClientServiceTime, optEndAtLastClient]);

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
        const destination = (!optEndAtLastClient && baseLat && baseLng) ? `${baseLat},${baseLng}` : `${validStops[validStops.length - 1].Lat},${validStops[validStops.length - 1].Long}`;
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
        text += `⏱️ Trânsito: *${formatDuration(currentItineraryData.totalTravelMinutes)}* | Atendimento: *${formatDuration(currentItineraryData.totalServiceMinutes)}* | Total: *${formatDuration(currentItineraryData.totalDurationMinutes)}*\n`;
        text += `----------------------------------------\n`;
        text += `🏠 *Partida:* ${baseAddress}\n\n`;

        stops.forEach(s => {
            text += `*#${s.stopOrder}* [${s.Cod_Cliente}] ${s.Razao_Social}\n`;
            text += `   📍 ${s.Endereco}\n`;
            text += `   🚗 Trânsito: +${s.legKm} KM (~${s.legTravelTime} min) | 🏢 Atendimento: ${s.serviceTime} min\n\n`;
        });

        text += optEndAtLastClient 
            ? `🏁 *Encerramento:* No último cliente (#${totalStops}) sem retorno à base\n`
            : `🏁 *Retorno:* ${baseAddress} (+${returnLegKm} KM ~${currentItineraryData.returnTravelTime} min)\n`;
        text += `----------------------------------------\n`;
        text += `Gerado automaticamente pelo Fuel360`;

        navigator.clipboard.writeText(text);
        setCopiedItinerary(true);
        setTimeout(() => setCopiedItinerary(false), 3000);
    };

    const renderTableHeaders = () => (
        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[9px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
            <tr className="bg-slate-100 dark:bg-slate-800">
                <th 
                    onClick={() => handleSort('Cod_Cliente')}
                    className="p-3 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition"
                    title="Clique para ordenar por Código"
                >
                    <div className="flex items-center space-x-1">
                        <span>Código/PDV</span>
                        <span className={sortField === 'Cod_Cliente' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                            {sortField === 'Cod_Cliente' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                    </div>
                </th>
                <th 
                    onClick={() => handleSort('Razao_Social')}
                    className="p-3 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition"
                    title="Clique para ordenar por Razão Social"
                >
                    <div className="flex items-center space-x-1">
                        <span>Razão Social</span>
                        <span className={sortField === 'Razao_Social' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                            {sortField === 'Razao_Social' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                    </div>
                </th>
                <th 
                    onClick={() => handleSort('Endereco')}
                    className="p-3 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition"
                    title="Clique para ordenar por Endereço"
                >
                    <div className="flex items-center space-x-1">
                        <span>Endereço / Cidade</span>
                        <span className={sortField === 'Endereco' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                            {sortField === 'Endereco' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                    </div>
                </th>
                <th 
                    onClick={() => handleSort('Nome_Vendedor')}
                    className="p-3 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition"
                    title="Clique para ordenar por Colaborador"
                >
                    <div className="flex items-center space-x-1">
                        <span>Colaborador Atual</span>
                        <span className={sortField === 'Nome_Vendedor' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                            {sortField === 'Nome_Vendedor' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                    </div>
                </th>
                <th 
                    onClick={() => handleSort('Dia_Semana')}
                    className="p-3 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition"
                    title="Clique para ordenar por Dia de Visita"
                >
                    <div className="flex items-center space-x-1">
                        <span>Dia de Visita</span>
                        <span className={sortField === 'Dia_Semana' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                            {sortField === 'Dia_Semana' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                    </div>
                </th>
                <th 
                    onClick={() => handleSort('Periodicidade')}
                    className="p-3 cursor-pointer select-none bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition"
                    title="Clique para ordenar por Periodicidade"
                >
                    <div className="flex items-center space-x-1">
                        <span>Periodicidade</span>
                        <span className={sortField === 'Periodicidade' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 dark:text-slate-500'}>
                            {sortField === 'Periodicidade' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                    </div>
                </th>
                <th className="p-3 text-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200" title="Tempo estimado de permanência no PDV conforme canal de remuneração">
                    Atendimento
                </th>
                <th className="p-3 text-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">Ações</th>
            </tr>
        </thead>
    );

    const renderRouteRow = (v: VisitaPrevista, i: number) => {
        const dayCfg = DAY_COLORS[v.Dia_Semana] || { hex: '#4f46e5', label: 'DIA', bg: 'bg-indigo-600' };
        const isHighlighted = v.Cod_Cliente === highlightedClientCode;
        const visitSeq = visitOrderMap.get(`${v.Cod_Vend}-${v.Dia_Semana}-${v.Cod_Cliente}`);
        const isUnallocated = v.Dia_Semana === 'SEM ATENDIMENTO';

        return (
            <tr 
                key={`${v.Cod_Cliente}-${i}`} 
                id={`row-pdv-${v.Cod_Cliente}`}
                onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('select') || target.closest('button') || target.closest('input')) {
                        return;
                    }
                    if (isUnallocated) {
                        handleToggleSelectUnallocated(v.Cod_Cliente);
                    }
                    handleFocusClientOnMap(v);
                }}
                title={isUnallocated ? "Clique na linha para selecionar/desmarcar ou focar no mapa" : "Clique na linha para focar este cliente no mapa"}
                className={`transition-all duration-300 cursor-pointer ${
                    isHighlighted 
                        ? 'bg-indigo-100/90 dark:bg-indigo-950/90 ring-2 ring-indigo-500 ring-inset shadow-md font-black' 
                        : isUnallocated
                            ? (selectedUnallocatedClients.has(v.Cod_Cliente)
                                ? 'bg-red-100/90 dark:bg-red-950/90 ring-2 ring-red-500 ring-inset shadow-xs font-black'
                                : 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-100/60 dark:hover:bg-red-900/30')
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/60'
                }`}
            >
                <td className="p-3 text-slate-900 dark:text-white font-mono">
                    <div className="flex items-center gap-1.5">
                        {isUnallocated && (
                            <input
                                type="checkbox"
                                checked={selectedUnallocatedClients.has(v.Cod_Cliente)}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelectUnallocated(v.Cod_Cliente);
                                }}
                                title={selectedUnallocatedClients.has(v.Cod_Cliente) ? "Desmarcar cliente" : "Selecionar cliente para transferência em massa"}
                                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 border-red-300 dark:border-red-700 cursor-pointer shrink-0"
                            />
                        )}
                        {visitSeq && !isUnallocated && (
                            (() => {
                                if (selectedQuinzenaFilter === '1_3' && visitSeq.order13) {
                                    return (
                                        <span 
                                            className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0" 
                                            title={`Ordem da Parada (Semana 1/3): ${visitSeq.order13}ª parada de ${visitSeq.total13} no roteiro de ${v.Dia_Semana}`}
                                        >
                                            #{visitSeq.order13}
                                        </span>
                                    );
                                }
                                if (selectedQuinzenaFilter === '2_4' && visitSeq.order24) {
                                    return (
                                        <span 
                                            className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-fuchsia-50 dark:bg-fuchsia-950/70 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800 shrink-0" 
                                            title={`Ordem da Parada (Semana 2/4): ${visitSeq.order24}ª parada de ${visitSeq.total24} no roteiro de ${v.Dia_Semana}`}
                                        >
                                            #{visitSeq.order24}
                                        </span>
                                    );
                                }
                                // Modo ALL (Todas as Semanas)
                                const pType = parsePeriodicidade(v.Periodicidade).tipo;
                                if (pType === 'SEMANAL') {
                                    if (visitSeq.order13 && visitSeq.order24 && visitSeq.order13 === visitSeq.order24) {
                                        return (
                                            <span 
                                                className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0" 
                                                title={`Parada #${visitSeq.order13} tanto na Semana 1/3 quanto na 2/4 (${v.Dia_Semana})`}
                                            >
                                                #{visitSeq.order13}
                                            </span>
                                        );
                                    }
                                    return (
                                        <div className="flex items-center gap-0.5 shrink-0" title={`Ordem no itinerário diário:\n• Semanas 1 e 3: ${visitSeq.order13}ª parada\n• Semanas 2 e 4: ${visitSeq.order24}ª parada`}>
                                            {visitSeq.order13 && (
                                                <span className="text-[8.5px] font-mono font-black px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                                    1/3:#{visitSeq.order13}
                                                </span>
                                            )}
                                            {visitSeq.order24 && (
                                                <span className="text-[8.5px] font-mono font-black px-1 py-0.2 rounded bg-fuchsia-50 dark:bg-fuchsia-950/70 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200/80 dark:border-fuchsia-800">
                                                    2/4:#{visitSeq.order24}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }
                                if (pType === 'QUINZENAL_1_3' && visitSeq.order13) {
                                    return (
                                        <span 
                                            className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0" 
                                            title={`Semana 1/3: ${visitSeq.order13}ª parada de ${visitSeq.total13} no roteiro de ${v.Dia_Semana}`}
                                        >
                                            1/3:#{visitSeq.order13}
                                        </span>
                                    );
                                }
                                if (pType === 'QUINZENAL_2_4' && visitSeq.order24) {
                                    return (
                                        <span 
                                            className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-fuchsia-50 dark:bg-fuchsia-950/70 text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800 shrink-0" 
                                            title={`Semana 2/4: ${visitSeq.order24}ª parada de ${visitSeq.total24} no roteiro de ${v.Dia_Semana}`}
                                        >
                                            2/4:#{visitSeq.order24}
                                        </span>
                                    );
                                }
                                return (
                                    <span 
                                        className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0" 
                                        title={`Ordem da Parada: ${visitSeq.order}ª parada`}
                                    >
                                        #{visitSeq.order}
                                    </span>
                                );
                            })()
                        )}
                        {isUnallocated && (
                            <span 
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 shrink-0"
                                title="Cliente sem atendimento por exceder o limite de horas/capacidade da jornada"
                            >
                                ⚠️ Fora
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
                <td className="p-3 text-slate-800 dark:text-slate-200">
                    <div className="truncate max-w-[180px] font-bold" title={v.Razao_Social}>{v.Razao_Social}</div>
                    {clienteRestricoesMap.has(v.Cod_Cliente) && (() => {
                        const r = clienteRestricoesMap.get(v.Cod_Cliente)!;
                        return (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {r.TurnoPermitido === 'MANHA' && (
                                    <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                        <Sun className="w-2.5 h-2.5" /> Manhã
                                    </span>
                                )}
                                {r.TurnoPermitido === 'TARDE' && (
                                    <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black px-1.5 py-0.2 rounded bg-orange-50 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                        <Sunset className="w-2.5 h-2.5" /> Tarde
                                    </span>
                                )}
                                {r.DiasPermitidos && (
                                    <span className="inline-flex items-center gap-0.5 text-[8.5px] font-black px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" title={`Dias permitidos: ${r.DiasPermitidos}`}>
                                        <Calendar className="w-2.5 h-2.5" />
                                        {r.DiasPermitidos.split(',').map(d => d.trim().slice(0, 3).toUpperCase()).join('/')}
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                </td>
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
                    {(() => {
                        const rColab = getColabBySectorOrName(v.Cod_Vend, v.Nome_Vendedor);
                        const rCentroid = sellerCentroidsMap.get(v.Cod_Vend);
                        const rAnom = checkCoordinateAnomaly(v, rColab?.LatitudeBase, rColab?.LongitudeBase, rCentroid);
                        if (rAnom.isAnomalous && rAnom.distKm > 80) {
                            return (
                                <div className="mt-1">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleOpenCoordinateModal(v); }}
                                        className="inline-flex items-center gap-1 text-[9px] font-black bg-red-100 hover:bg-red-200 dark:bg-red-900/60 dark:hover:bg-red-900 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 px-2 py-0.5 rounded-full cursor-pointer transition shadow-2xs"
                                        title={`Coordenadas suspeitas (~${rAnom.distKm} km da base). Clique para ajustar.`}
                                    >
                                        <span>⚠️ GPS Distante (~{rAnom.distKm} km)</span>
                                        <span className="underline ml-0.5">Corrigir</span>
                                    </button>
                                </div>
                            );
                        }
                        return null;
                    })()}
                </td>
                <td className="p-3">
                    {teamType === 'vendedores' ? (
                        <div className="flex items-center space-x-1.5">
                            <span className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-[160px]" title={formatSellerDisplayName(v.Cod_Vend, v.Nome_Vendedor)}>{formatSellerDisplayName(v.Cod_Vend, v.Nome_Vendedor)}</span>
                            <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-1 py-0.5 rounded shrink-0">Carteira</span>
                        </div>
                    ) : (
                        <select
                            value={v.Cod_Vend}
                            onChange={(e) => handleManualReassign(v.Cod_Cliente, Number(e.target.value), v.Dia_Semana, v.Periodicidade)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
                        >
                            {teamColaboradores.map(col => (
                                <option key={col.ID_Colaborador} value={col.CodigoSetor}>{formatSellerDisplayName(col.CodigoSetor, col.Nome)}</option>
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
                            className={`border rounded p-1 text-[10px] font-bold outline-none w-full ${
                                isUnallocated 
                                    ? 'bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300' 
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            {WEEKDAYS.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                            <option value="SEM ATENDIMENTO">⚠️ SEM ATENDIMENTO</option>
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
                <td className="p-3 text-center whitespace-nowrap">
                    {(() => {
                        const srvMins = getClientServiceTime(v);
                        const canalName = v.Canal_Remuneracao ? v.Canal_Remuneracao.trim().toUpperCase() : '';
                        return (
                            <div className="inline-flex flex-col items-center">
                                <span 
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800 shadow-2xs cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/80 transition"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowChannelTimesModal(true);
                                    }}
                                    title={`Tempo de Permanência: ${srvMins} minutos\nCanal: ${canalName || 'PADRÃO'}\nClique para abrir configuração de tempos de canais`}
                                >
                                    <span>🏢</span>
                                    <span>{srvMins} min</span>
                                </span>
                                {canalName ? (
                                    <span className="text-[8.5px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[85px] mt-0.5" title={`Canal de Remuneração: ${canalName}`}>
                                        {canalName}
                                    </span>
                                ) : (
                                    <span className="text-[8px] font-normal text-slate-400 dark:text-slate-500 italic mt-0.5">
                                        Padrão
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                </td>
                <td className="p-3 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenNewRestricaoModal(v);
                            }}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                                clienteRestricoesMap.has(v.Cod_Cliente)
                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100'
                                    : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={
                                clienteRestricoesMap.has(v.Cod_Cliente)
                                    ? `Particularidade Ativa: ${clienteRestricoesMap.get(v.Cod_Cliente)?.DiasPermitidos ? `Dias: ${clienteRestricoesMap.get(v.Cod_Cliente)?.DiasPermitidos}` : ''} ${clienteRestricoesMap.get(v.Cod_Cliente)?.TurnoPermitido !== 'QUALQUER' ? `Turno: ${clienteRestricoesMap.get(v.Cod_Cliente)?.TurnoPermitido}` : ''}. Clique para editar.`
                                    : 'Configurar particularidade/janela para este cliente'
                            }
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCoordinateModal(v);
                            }}
                            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition p-1 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg cursor-pointer"
                            title="Ajustar coordenadas GPS do cliente"
                        >
                            <LocationMarkerIcon className="w-4 h-4"/>
                        </button>
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
            {/* BARRA DE COMANDO UNIFICADA: EQUIPE, ESCOPO, SELETORES E AÇÕES DE CARGA */}
            <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3 transition-colors">
                {/* LADO ESQUERDO: TÍTULO, SELETOR DE EQUIPE E SELETOR DE ESCOPO */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2.5 mr-1">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                            <CogIcon className="w-5 h-5 animate-spin-slow"/>
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-white leading-tight">
                                Ajuste & Otimização de Rotas
                            </h2>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                                Simulação, balanceamento e sequenciamento viário
                            </p>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-slate-200 dark:border-slate-800 hidden md:block" />

                    {/* Alternador Vendas / Promotores */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setTeamType('vendedores')}
                            className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${teamType === 'vendedores' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <LocationMarkerIcon className="w-3.5 h-3.5 mr-1.5"/> Vendas
                        </button>
                        <button
                            onClick={() => setTeamType('promotores')}
                            className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${teamType === 'promotores' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <UsersIcon className="w-3.5 h-3.5 mr-1.5"/> Promotores
                        </button>
                    </div>

                    {/* BOTÃO MODAL DE PARÂMETROS DO OTIMIZADOR (SEMPRE VISÍVEL JUNTO AO SELETOR) */}
                    <button
                        type="button"
                        onClick={() => setShowParamsModal(true)}
                        className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-2xs transition cursor-pointer h-[34px]"
                        title="Abrir configurações e parâmetros do otimizador de rotas"
                    >
                        <CogIcon className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Parâmetros</span>
                        <span className="ml-1.5 px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-black border border-indigo-200/60 dark:border-indigo-800">
                            {optLimitClients ? `Máx ${optMaxClients}` : 'Livre'}
                            {optLimitKm ? ` • ${optMaxKm}km` : ''}
                            {optLimitHours ? ` • ${optMaxHours}h` : ''}
                        </span>
                    </button>

                    <div className="h-6 w-px bg-slate-200 dark:border-slate-800 hidden md:block" />

                    {/* SELEÇÃO DE ESCOPO (SEMPRE VISÍVEL) */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => {
                                setScopeMode('geral');
                                setSelectedPromoter('ALL');
                                setSelectedTeamSellers(new Set());
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${scopeMode === 'geral' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            🌐 Visão Geral ({adjustedRoutes.length > 0 ? Array.from(new Set(adjustedRoutes.map(r => r.Cod_Vend))).length : teamColaboradores.length})
                        </button>
                        <button
                            onClick={() => {
                                setScopeMode('equipe');
                                setSelectedPromoter('ALL');
                                setSelectedTeamSellers(new Set());
                                if (!selectedSupervisor && supervisors.length > 0) {
                                    setSelectedSupervisor(supervisors[0].id);
                                }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${scopeMode === 'equipe' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            👥 Por Equipe
                        </button>
                        <button
                            onClick={() => {
                                setScopeMode('vendedor');
                                setSelectedPromoter('ALL');
                                setSelectedTeamSellers(new Set());
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${scopeMode === 'vendedor' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            👤 Por Vendedor
                        </button>
                    </div>

                    {/* Seletores Dinâmicos de Supervisor ou Vendedor */}
                    {scopeMode === 'equipe' && (
                        <div className="flex items-center space-x-1.5">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Supervisor:</label>
                            <select
                                value={selectedSupervisor}
                                onChange={(e) => {
                                    setSelectedSupervisor(e.target.value);
                                    setSelectedPromoter('ALL');
                                    setSelectedTeamSellers(new Set());
                                }}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                            >
                                <option value="">{supervisors.length > 0 ? "Selecione uma Supervisão..." : "Supervisões disponíveis após carregar rota"}</option>
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
                </div>

                {/* LADO DIREITO: STATUS DO FOCO, REDISTRIBUIR E CARGA */}
                <div className="flex flex-wrap items-center gap-2">
                    {adjustedRoutes.length > 0 && (
                        <>
                            <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/60 flex items-center shadow-2xs h-[34px]">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                                {Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend))).length} Colab • {scopedAdjustedRoutes.length} PDVs em foco
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setSourceSectorToExtinguish('');
                                    setTargetSectorsSelected([]);
                                    setShowExtinguishModal(true);
                                }}
                                disabled={loading || adjustedRoutes.length === 0}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-2xs transition cursor-pointer disabled:opacity-50 h-[34px]"
                                title="Simular a extinção de um setor e redistribuir sua carteira para os demais setores selecionados com balanceamento equilibrado"
                            >
                                <UserGroupIcon className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400"/>
                                Redistribuir Setor
                            </button>
                            {backupRoutesBeforeExtinguish && (
                                <button
                                    type="button"
                                    onClick={handleUndoExtinguish}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center shadow-2xs transition cursor-pointer h-[34px]"
                                    title="Restaurar a carteira do setor extinto de volta ao estado original"
                                >
                                    ↩️ Desfazer
                                </button>
                            )}
                        </>
                    )}

                    {/* Botão de Abertura de Simulações Salvas (com Badge de Críticas) */}
                    <button
                        type="button"
                        onClick={handleOpenSavedSimulationsModal}
                        className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center shadow-xs h-[34px] cursor-pointer relative transition"
                        title="Abrir simulações salvas e histórico de ajustes de rota"
                    >
                        <FolderOpen className="w-4 h-4 mr-1.5 text-amber-500" />
                        Simulações Salvas
                        {totalPendingCriticas > 0 && (
                            <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-xs flex items-center">
                                {totalPendingCriticas}
                            </span>
                        )}
                    </button>

                    {teamType === 'vendedores' ? (
                        <button
                            onClick={handleLoadCurrentRoutes}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition flex items-center h-[34px] cursor-pointer"
                            title="Carregar carteira de clientes integral de cada vendedor"
                        >
                            {loading ? <SpinnerIcon className="w-4 h-4 animate-spin mr-1.5"/> : <RefreshIcon className="w-4 h-4 mr-1.5"/>}
                            {adjustedRoutes.length > 0 ? 'Recarregar Rotas' : 'Carregar Rota Atual'}
                        </button>
                    ) : (
                        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center transition shadow-sm h-[34px]">
                            <UploadIcon className="w-4 h-4 mr-1.5"/> Carregar Planilha (.xlsx)
                            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} disabled={loading} className="hidden" />
                        </label>
                    )}
                </div>
            </div>

            {/* BANNER DE ALERTA DE CRÍTICAS PENDENTES DE SUPERVISORES */}
            {totalPendingCriticas > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                Críticas de Supervisores Aguardando Análise!
                                <span className="bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                    {totalPendingCriticas} pendência{totalPendingCriticas > 1 ? 's' : ''}
                                </span>
                            </h4>
                            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                                Supervisores registraram sugestões e apontamentos de alterações em simulações salvas.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleOpenSavedSimulationsModal}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                        <FolderOpen className="w-4 h-4" />
                        Ver Simulações com Críticas
                    </button>
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

            {/* ABAIXO: MAPA E GRADE DE AJUSTE FINO (LARGURA TOTAL 100% - FULL-WIDTH) */}
            <div className="flex flex-col space-y-4 w-full min-h-0">
                {/* BLOCO SUPERIOR: MAPA 100% LARGURA */}
                <div 
                    id="roteiro-map-container"
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-300 flex flex-col w-full ${
                    isMapFullscreen 
                        ? 'fixed inset-0 z-[1100] w-screen h-screen rounded-none' 
                        : 'relative isolate rounded-2xl h-[420px] z-10'
                }`}>
                        {/* CONTROLES FLUTUANTES DO MAPA: SELETOR DE VENDEDOR, ALTERNADOR RÁPIDO DE QUINZENA, HEATMAP E TELA CHEIA */}
                        <div className="absolute top-3 right-3 z-[1000] flex flex-wrap items-center gap-2">
                            {scopedAdjustedRoutes.length > 0 && (
                                <>
                                    {/* Seletor Rápido de Vendedor no Mapa (Foco Individual) */}
                                    {isMultipleSellers && (
                                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center gap-1 text-xs">
                                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1.5 hidden sm:inline">
                                                Vendedor:
                                            </span>
                                            <select
                                                value={focusedMapSellerId !== null ? String(focusedMapSellerId) : 'ALL'}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === 'ALL') {
                                                        setFocusedMapSellerId(null);
                                                    } else {
                                                        const selId = Number(val);
                                                        setFocusedMapSellerId(selId);
                                                        const sVisits = scopedAdjustedRoutes.filter(v => v.Cod_Vend === selId && v.Lat && v.Long);
                                                        if (sVisits.length > 0) {
                                                            setMapFlyToTarget({
                                                                lat: sVisits[0].Lat!,
                                                                lng: sVisits[0].Long!,
                                                                codCliente: sVisits[0].Cod_Cliente,
                                                                timestamp: Date.now()
                                                            });
                                                        } else {
                                                            const colab = getColabBySectorOrName(selId);
                                                            if (colab?.LatitudeBase && colab?.LongitudeBase) {
                                                                setMapFlyToTarget({
                                                                    lat: colab.LatitudeBase,
                                                                    lng: colab.LongitudeBase,
                                                                    codCliente: 0,
                                                                    timestamp: Date.now()
                                                                });
                                                            }
                                                        }
                                                    }
                                                }}
                                                className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500 max-w-[170px] truncate"
                                                title="Filtrar visualização no mapa para apenas um vendedor específico"
                                            >
                                                <option value="ALL">Todos os Vendedores ({effectiveSellersList.length})</option>
                                                {effectiveSellersList.map(sId => {
                                                    const numId = Number(sId);
                                                    const sVisits = scopedAdjustedRoutes.filter(v => v.Cod_Vend === numId);
                                                    const colab = getColabBySectorOrName(numId, sVisits[0]?.Nome_Vendedor);
                                                    const name = colab?.Nome || sVisits[0]?.Nome_Vendedor || `Vendedor ${sId}`;
                                                    return (
                                                        <option key={sId} value={sId}>
                                                            {formatSellerDisplayName(numId, name)} ({sVisits.length} PDVs)
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            {focusedMapSellerId !== null && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFocusedMapSellerId(null)}
                                                    className="px-1.5 py-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition cursor-pointer font-black text-xs"
                                                    title="Limpar filtro e exibir todos os vendedores no mapa"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    )}

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

                        {/* Pill de status quando um vendedor específico está focado no mapa */}
                        {focusedMapSellerId !== null && (() => {
                            const fVisits = scopedAdjustedRoutes.filter(v => v.Cod_Vend === focusedMapSellerId);
                            const colab = getColabBySectorOrName(focusedMapSellerId, fVisits[0]?.Nome_Vendedor);
                            const fName = formatSellerDisplayName(focusedMapSellerId, colab?.Nome || fVisits[0]?.Nome_Vendedor || `Vendedor ${focusedMapSellerId}`);
                            const fColor = promoterColorMap.get(String(focusedMapSellerId)) || '#4f46e5';
                            return (
                                <div className="absolute top-3 left-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-md flex items-center gap-2 text-xs animate-in fade-in">
                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fColor }} />
                                    <span className="font-bold text-slate-600 dark:text-slate-300">Foco no Mapa:</span>
                                    <span className="font-black text-indigo-700 dark:text-indigo-300 truncate max-w-[180px]">{fName}</span>
                                    <button
                                        type="button"
                                        onClick={() => setFocusedMapSellerId(null)}
                                        className="ml-1 px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950 dark:hover:text-rose-300 text-[10px] font-black transition cursor-pointer"
                                        title="Restaurar visualização de todos os vendedores no mapa"
                                    >
                                        Ver Todos
                                    </button>
                                </div>
                            );
                        })()}

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
                                {Array.from(new Set((focusedMapSellerId ? scopedAdjustedRoutes.filter(v => v.Cod_Vend === focusedMapSellerId) : scopedAdjustedRoutes).map(v => v.Cod_Vend))).map(vId => {
                                    const vVisits = scopedAdjustedRoutes.filter(v => v.Cod_Vend === vId);
                                    const colab = getColabBySectorOrName(vId, vVisits[0]?.Nome_Vendedor);
                                    if(colab && colab.LatitudeBase && colab.LongitudeBase) {
                                        const pColor = promoterColorMap.get(String(vId)) || '#ef4444';
                                        const baseAnomaly = checkCollaboratorBaseAnomaly(colab.LatitudeBase, colab.LongitudeBase, vVisits);
                                        return (
                                            <Marker 
                                                key={`base-${vId}`} 
                                                position={[colab.LatitudeBase, colab.LongitudeBase]} 
                                                icon={createHomeIcon(pColor, baseAnomaly.isAnomalous, baseAnomaly.badgeText)}
                                                zIndexOffset={1000}
                                            >
                                                <Popup>
                                                    <div className="text-xs p-1 space-y-1 font-sans min-w-[200px]">
                                                        <div className="flex items-center space-x-1.5 text-red-600 dark:text-red-400 font-black">
                                                            <span>🏠</span>
                                                            <span className="uppercase tracking-wider text-[10px]">Base / Residência</span>
                                                            {baseAnomaly.isAnomalous && (
                                                                <span className="ml-auto bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs">
                                                                    {baseAnomaly.badgeText}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-slate-900 dark:text-slate-100 font-bold text-sm">{formatSellerDisplayName(colab.CodigoSetor || vId, colab.Nome)}</p>
                                                        {colab.EnderecoBase && (
                                                             <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{colab.EnderecoBase}</p>
                                                        )}
                                                        {baseAnomaly.isAnomalous ? (
                                                            <div className="bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 rounded-lg p-2 mt-1.5 text-rose-800 dark:text-rose-200">
                                                                <div className="flex items-center gap-1 font-black text-[11px] text-rose-700 dark:text-rose-300">
                                                                    <span>🚨</span>
                                                                    <span>ALERTA DE COORDENADA DA BASE</span>
                                                                </div>
                                                                <p className="text-[10px] mt-0.5 font-bold">{baseAnomaly.message}</p>
                                                                <p className="text-[9px] mt-1 opacity-80 italic">Ponto de partida incorreto distorce a quilometragem e o tempo em trânsito.</p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">Ponto de partida e retorno diário do colaborador</p>
                                                        )}
                                                    </div>
                                                </Popup>
                                            </Marker>
                                        );
                                    }
                                    return null;
                                })}

                                {/* Polilinhas das rotas originais (Tracejado claro se houver comparação) */}
                                {(focusedMapSellerId ? originalPolylines.filter((line: any) => line.sellerId === focusedMapSellerId) : originalPolylines).map((line, idx) => {
                                    const polyColor = ((isSingleSellerView || focusedMapSellerId !== null) && line.day && DAY_COLORS[line.day]) ? DAY_COLORS[line.day].hex : line.color;
                                    return (
                                        <Polyline 
                                            key={`orig-poly-${line.id || idx}`} 
                                            positions={line.points} 
                                            color={polyColor} 
                                            weight={showHeatmap ? 2 : 3} 
                                            dashArray="5, 10" 
                                            opacity={showHeatmap ? 0.15 : 0.3} 
                                            pathOptions={{
                                                className: 'transition-all duration-500 ease-in-out'
                                            }}
                                        />
                                    );
                                })}

                                {/* Polilinhas das rotas otimizadas com transição visual animada e Popup Interativo */}
                                {(focusedMapSellerId ? adjustedPolylines.filter((line: any) => line.sellerId === focusedMapSellerId) : adjustedPolylines).map((line: any, idx) => {
                                    const polyColor = ((isSingleSellerView || focusedMapSellerId !== null) && line.day && DAY_COLORS[line.day]) ? DAY_COLORS[line.day].hex : line.color;
                                    return (
                                        <Polyline 
                                            key={`adj-poly-${line.id || idx}`} 
                                            positions={line.points} 
                                            color={polyColor} 
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
                                                            style={{ backgroundColor: polyColor }}
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
                                    );
                                })}

                                {/* Clientes Marcados (com distinção cromática por dia da semana e quinzena) */}
                                {(focusedMapSellerId ? filteredRoutes.filter(v => v.Cod_Vend === focusedMapSellerId) : filteredRoutes).filter(v => v.Lat && v.Long).map((v, idx) => {
                                    const pType = parsePeriodicidade(v.Periodicidade).tipo;
                                    const dayCfg = DAY_COLORS[v.Dia_Semana] || { hex: '#4f46e5', label: 'DIA' };
                                    const dayColor = dayCfg.hex;
                                    const sellerColor = promoterColorMap.get(String(v.Cod_Vend)) || '#4f46e5';
                                    const isSingleView = isSingleSellerView || focusedMapSellerId !== null;
                                    const mainColor = isSingleView ? dayColor : sellerColor;

                                    // Distinção visual no mapa:
                                    // Semanal: sólido com borda branca clássica (radius: 7, weight: 2)
                                    // Quinzena 1 e 3: anel com borda amarela/dourada espessa (radius: 8.5, weight: 3.5, color: '#f59e0b')
                                    // Quinzena 2 e 4: borda magenta/fúcsia tracejada (radius: 8.5, weight: 3.5, color: '#ec4899', dashArray: '3, 3')
                                    let borderColor = '#ffffff';
                                    let borderWidth = 2;
                                    let radius = 7;
                                    let dashArray: string | undefined = undefined;

                                    if (isSingleView) {
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

                                    const colab = getColabBySectorOrName(v.Cod_Vend, v.Nome_Vendedor);
                                    const baseLat = colab?.LatitudeBase;
                                    const baseLng = colab?.LongitudeBase;
                                    const fallbackCentroid = sellerCentroidsMap.get(v.Cod_Vend);
                                    const anomaly = checkCoordinateAnomaly(v, baseLat, baseLng, fallbackCentroid);

                                    const isPdvHighlighted = v.Cod_Cliente === highlightedClientCode;
                                    const isAnomalousPdv = anomaly.isAnomalous && anomaly.distKm > 80;

                                    const restricaoCliente = clienteRestricoesMap.get(Number(v.Cod_Cliente));
                                    const hasParticularidade = Boolean(restricaoCliente && restricaoCliente.Ativo !== false);
                                    const isSupervisorRestricao = Boolean(
                                        hasParticularidade && (
                                            restricaoCliente?.Observacao?.includes('[Exceção via Crítica Supervisor]') ||
                                            (restricaoCliente?.UsuarioAtualizacao && restricaoCliente.UsuarioAtualizacao.toLowerCase().includes('supervisor'))
                                        )
                                    );
                                    const particularidadeColor = isSupervisorRestricao ? '#9333ea' : '#f59e0b';

                                    const markerFillColor = isPdvHighlighted ? '#4f46e5' : (isAnomalousPdv ? '#ef4444' : mainColor);
                                    const markerBorderColor = isPdvHighlighted ? '#ffffff' : (isAnomalousPdv ? '#991b1b' : (hasParticularidade ? particularidadeColor : borderColor));
                                    const markerWeight = isPdvHighlighted ? 4 : (isAnomalousPdv ? 3.5 : (hasParticularidade ? 3 : (showHeatmap ? 1.5 : borderWidth)));
                                    const markerRadius = showHeatmap ? Math.max(4, radius - 2) : (isPdvHighlighted ? radius + 3.5 : (isAnomalousPdv ? radius + 2 : radius));

                                    return (
                                        <React.Fragment key={`marker-fragment-${v.Cod_Cliente}-${idx}`}>
                                            {/* Halo Orbital Concêntrico para clientes com Particularidades / Restrições */}
                                            {hasParticularidade && (
                                                <CircleMarker
                                                    key={`halo-${v.Cod_Cliente}-${idx}`}
                                                    center={[v.Lat, v.Long]}
                                                    radius={markerRadius + 4.5}
                                                    pathOptions={{
                                                        color: particularidadeColor,
                                                        fillColor: particularidadeColor,
                                                        fillOpacity: 0.15,
                                                        weight: 2,
                                                        dashArray: '3, 3',
                                                        interactive: false
                                                    }}
                                                />
                                            )}
                                            <CircleMarker
                                                key={`marker-${v.Cod_Cliente}-${idx}`}
                                                ref={(el) => {
                                                    if (el) {
                                                        markerRefs.current[v.Cod_Cliente] = el;
                                                    }
                                                }}
                                                center={[v.Lat, v.Long]}
                                                radius={markerRadius}
                                                pathOptions={{ 
                                                    fillColor: markerFillColor, 
                                                    color: markerBorderColor, 
                                                    fillOpacity: showHeatmap ? 0.45 : (isPdvHighlighted ? 1 : (isAnomalousPdv ? 1 : 0.92)), 
                                                    weight: markerWeight,
                                                    dashArray: isPdvHighlighted ? undefined : dashArray,
                                                    className: 'transition-all duration-300 ease-in-out cursor-pointer'
                                                }}
                                                eventHandlers={{
                                                    click: () => {
                                                        handleSelectPdvFromMap(v.Cod_Cliente);
                                                    }
                                                }}
                                            >
                                                {/* Tooltip flutuante com indicador de particularidade */}
                                                {hasParticularidade && (
                                                    <Tooltip direction="top" offset={[0, -markerRadius - 2]} opacity={0.95}>
                                                        <div className="text-[10px] font-bold flex items-center gap-1">
                                                            <span>{isSupervisorRestricao ? '🛡️ [Supervisor]' : '⚡ [Particularidade]'}</span>
                                                            <span>{v.Cod_Cliente} - {v.Razao_Social}</span>
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 font-medium">
                                                            {[
                                                                restricaoCliente?.TurnoPermitido && restricaoCliente.TurnoPermitido !== 'QUALQUER' ? `Turno: ${restricaoCliente.TurnoPermitido}` : null,
                                                                restricaoCliente?.QuinzenaPermitida && restricaoCliente.QuinzenaPermitida !== 'QUALQUER' ? `Quinzena: ${restricaoCliente.QuinzenaPermitida.replace('_', ' ')}` : null,
                                                                restricaoCliente?.DiasPermitidos ? `Dias: ${restricaoCliente.DiasPermitidos}` : null
                                                            ].filter(Boolean).join(' • ') || 'Particularidade ativa'}
                                                        </div>
                                                    </Tooltip>
                                                )}
                                                <Popup>
                                                    <div className="text-xs space-y-2 p-1 font-sans">
                                                        {/* Banner de Alerta de Particularidade Cadastrada */}
                                                        {hasParticularidade && (
                                                            <div className={`border rounded-xl p-2 shadow-2xs space-y-1.5 ${
                                                                isSupervisorRestricao
                                                                    ? 'bg-purple-50/90 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200'
                                                                    : 'bg-amber-50/90 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                                                            }`}>
                                                                <div className="flex items-center justify-between gap-1">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black text-white flex items-center gap-1 ${
                                                                        isSupervisorRestricao ? 'bg-purple-600' : 'bg-amber-600'
                                                                    }`}>
                                                                        <span>{isSupervisorRestricao ? '🛡️ Exceção Supervisor' : '⚡ Particularidade'}</span>
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenNewRestricaoModal(v)}
                                                                        className="text-[9px] font-bold underline hover:opacity-80 cursor-pointer"
                                                                        title="Editar particularidades deste cliente"
                                                                    >
                                                                        Editar Particularidade
                                                                    </button>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1 text-[9px] font-bold">
                                                                    {restricaoCliente?.TurnoPermitido && restricaoCliente.TurnoPermitido !== 'QUALQUER' && (
                                                                        <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                                                            Turno: {restricaoCliente.TurnoPermitido}
                                                                        </span>
                                                                    )}
                                                                    {restricaoCliente?.QuinzenaPermitida && restricaoCliente.QuinzenaPermitida !== 'QUALQUER' && (
                                                                        <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                                                            Quinzena: {restricaoCliente.QuinzenaPermitida.replace('_', ' ')}
                                                                        </span>
                                                                    )}
                                                                    {restricaoCliente?.DiasPermitidos && (
                                                                        <span className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                                                            Dias: {restricaoCliente.DiasPermitidos}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {restricaoCliente?.Observacao && (
                                                                    <p className="text-[9.5px] italic text-slate-600 dark:text-slate-300 leading-tight">
                                                                        "{restricaoCliente.Observacao}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Banner de Alerta de Anomalia de Coordenadas */}
                                                        {isAnomalousPdv && (
                                                            <div className="bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-800 rounded-xl p-2 text-red-700 dark:text-red-300 shadow-xs">
                                                                <div className="flex items-center gap-1.5 font-black text-[11px]">
                                                                    <span className="text-sm">⚠️</span>
                                                                    <span>GPS Distante (~{anomaly.distKm} km {anomaly.referenceType === 'base' ? 'da base' : 'do grupo'})</span>
                                                                </div>
                                                                <p className="text-[10px] mt-0.5 text-red-600 dark:text-red-400 font-medium">
                                                                    Localização pode estar incorreta no ERP. Ajuste as coordenadas para recalcular a rota viária correta.
                                                                </p>
                                                            </div>
                                                        )}
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
                                                                        <span className="truncate">{formatSellerDisplayName(v.Cod_Vend, v.Nome_Vendedor)}</span>
                                                                        <span className="text-[8px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold px-1 rounded ml-1 shrink-0">Carteira Fixa</span>
                                                                    </div>
                                                                ) : (
                                                                    <select
                                                                        value={v.Cod_Vend}
                                                                        onChange={(e) => handleManualReassign(v.Cod_Cliente, Number(e.target.value), v.Dia_Semana, v.Periodicidade)}
                                                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                                                    >
                                                                        {teamColaboradores.map(col => (
                                                                            <option key={col.ID_Colaborador} value={col.CodigoSetor}>{formatSellerDisplayName(col.CodigoSetor, col.Nome)}</option>
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
                                                                    className="self-end bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/80 rounded p-1 transition cursor-pointer"
                                                                    title="Excluir Visita"
                                                                >
                                                                    <TrashIcon className="w-4 h-4"/>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Botão para navegar até o cliente na Grade de Ajuste Fino ou Ajustar GPS */}
                                                        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenCoordinateModal(v)}
                                                                className={`w-full py-1.5 px-3 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                                                                    isAnomalousPdv
                                                                        ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                                                        : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/80'
                                                                }`}
                                                                title="Ajustar ou corrigir coordenadas de Latitude e Longitude deste cliente"
                                                            >
                                                                <LocationMarkerIcon className="w-3.5 h-3.5" />
                                                                <span>{isAnomalousPdv ? '⚠️ Corrigir Coordenadas GPS' : 'Ajustar Coordenadas GPS'}</span>
                                                            </button>
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
                                        </React.Fragment>
                                    );
                                })}
                            </MapContainer>
                        )}

                        {/* Legenda Explicativa de Rotas e Heatmap no Mapa */}
                        {scopedAdjustedRoutes.length > 0 && (isSingleSellerView || showHeatmap) && (
                            <div className="absolute bottom-2 right-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-[1000] text-[9px] space-y-1 max-w-[340px]">
                                {isSingleSellerView && (
                                    <>
                                        <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200/80 dark:border-slate-800 pb-1">
                                            <span className="flex items-center gap-1">
                                                <GlobeIcon className="w-3 h-3 text-indigo-600"/> Legenda do Roteiro
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[8px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase">Filtrar</span>
                                                {(selectedDaysFilter.length > 0 || selectedQuinzenaFilter !== 'ALL') && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDaysFilter([]);
                                                            setSelectedQuinzenaFilter('ALL');
                                                        }}
                                                        className="text-[8px] font-black text-red-600 dark:text-red-400 hover:underline cursor-pointer flex items-center gap-0.5 ml-0.5"
                                                        title="Limpar todos os filtros da legenda"
                                                    >
                                                        ✕ Limpar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {WEEKDAYS.map(day => {
                                                const cfg = DAY_COLORS[day];
                                                if (!cfg) return null;
                                                const isSelected = selectedDaysFilter.includes(day);
                                                const hasAnySelected = selectedDaysFilter.length > 0;
                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleDayFilter(day);
                                                        }}
                                                        className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold transition-all cursor-pointer select-none active:scale-95 border ${
                                                            isSelected 
                                                                ? `${cfg.bg} text-white border-transparent shadow-2xs ring-1 ring-offset-1 ring-slate-400 font-black` 
                                                                : hasAnySelected
                                                                    ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 text-slate-400 opacity-50 hover:opacity-100 hover:text-slate-700 dark:hover:text-slate-200'
                                                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                        }`}
                                                        title={`Clique para filtrar rotas de ${day}`}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white' : ''}`} style={{ backgroundColor: isSelected ? undefined : cfg.hex }}/>
                                                        <span>{cfg.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-slate-600 dark:text-slate-400 font-medium text-[8.5px]">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedQuinzenaFilter('ALL');
                                                }}
                                                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition-all cursor-pointer active:scale-95 border ${
                                                    selectedQuinzenaFilter === 'ALL'
                                                        ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white font-bold ring-1 ring-slate-400/50'
                                                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 opacity-70 hover:opacity-100'
                                                }`}
                                                title="Exibir todas as periodicidades (Semanais e Quinzenais)"
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white shrink-0"/>
                                                <span>Semanal</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedQuinzenaFilter(prev => prev === '1_3' ? 'ALL' : '1_3');
                                                }}
                                                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition-all cursor-pointer active:scale-95 border ${
                                                    selectedQuinzenaFilter === '1_3'
                                                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 font-black border-amber-400 dark:border-amber-700 shadow-2xs ring-1 ring-amber-400'
                                                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 opacity-70 hover:opacity-100'
                                                }`}
                                                title="Filtrar rotas atendidas nas Semanas 1 e 3"
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-amber-500 shrink-0"/>
                                                <span>Quinz. 1/3</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedQuinzenaFilter(prev => prev === '2_4' ? 'ALL' : '2_4');
                                                }}
                                                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded transition-all cursor-pointer active:scale-95 border ${
                                                    selectedQuinzenaFilter === '2_4'
                                                        ? 'bg-fuchsia-100 dark:bg-fuchsia-950/80 text-fuchsia-900 dark:text-fuchsia-200 font-black border-fuchsia-400 dark:border-fuchsia-700 shadow-2xs ring-1 ring-fuchsia-400'
                                                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 opacity-70 hover:opacity-100'
                                                }`}
                                                title="Filtrar rotas atendidas nas Semanas 2 e 4"
                                            >
                                                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-fuchsia-500 border-dashed shrink-0"/>
                                                <span>Quinz. 2/4</span>
                                            </button>

                                            <span className="flex items-center space-x-1 text-red-600 font-bold px-1 py-0.5" title="Base de Origem e Destino do Roteiro">
                                                <span>🏠</span>
                                                <span>Base</span>
                                            </span>

                                            <span className="flex items-center space-x-1 text-purple-700 dark:text-purple-300 font-bold px-1 py-0.5" title="Cliente com Particularidade ou Restrição Cadastrada">
                                                <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-purple-600 border-dashed bg-purple-100 dark:bg-purple-900/50 shrink-0"/>
                                                <span>Particularidade</span>
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
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center shrink-0">
                                                <ClipboardListIcon className="w-4 h-4 mr-1.5 text-indigo-600"/> Grade de Ajuste Fino
                                            </h3>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span 
                                                    className="text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800 cursor-help"
                                                    title={`Carteira de clientes físicos ativos no escopo selecionado: ${effectiveScopedRoutes.length} PDVs únicos cadastrados.`}
                                                >
                                                    {effectiveScopedRoutes.length} {effectiveScopedRoutes.length === 1 ? 'PDV' : 'PDVs'} (Carteira)
                                                </span>
                                                <span 
                                                    className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 cursor-help"
                                                    title={`Demanda real de visitas: ~${operationalSummary.totalVisitsMonth} atendimentos/mês estimados com base na periodicidade (Semanais: 4x/mês, Quinzenais: 2x/mês).\n• Semanas 1 e 3: ${operationalSummary.totalPdvs13} visitas/sem\n• Semanas 2 e 4: ${operationalSummary.totalPdvs24} visitas/sem`}
                                                >
                                                    ~{operationalSummary.totalVisitsMonth} visitas/mês <span className="text-[9px] text-slate-400 font-normal">({operationalSummary.totalPdvs13} sem 1/3 • {operationalSummary.totalPdvs24} sem 2/4)</span>
                                                </span>
                                                {loadedSimInfo && (
                                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                        <span className="truncate max-w-[220px]" title={loadedSimInfo.name}>Simulação: <strong>{loadedSimInfo.name}</strong></span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setLoadedSimInfo(null)}
                                                            className="text-emerald-700 dark:text-emerald-300 hover:text-red-500 dark:hover:text-red-400 font-black ml-1 text-[11px] cursor-pointer"
                                                            title="Desvincular (salvar como novo roteiro)"
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Alternador de Modo de Visualização (Sanfona por Dia vs Lista Contínua) */}
                                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={() => setTableViewMode('accordion')}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    tableViewMode === 'accordion'
                                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-black'
                                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                                title="Visualizar agrupado por dia em formato de sanfona com resumos de tempo, km e paradas"
                                            >
                                                <span>📂</span>
                                                <span>Sanfona por Dia</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTableViewMode('flat')}
                                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    tableViewMode === 'flat'
                                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-black'
                                                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                                title="Visualizar em tabela contínua tradicional"
                                            >
                                                <span>📋</span>
                                                <span>Lista Contínua</span>
                                            </button>
                                        </div>

                                        {/* FILTRO DE VENDEDORES DA EQUIPE (SELEÇÃO ÚNICA OU MÚLTIPLA) */}
                                        {availableTeamSellers.length > 1 && (
                                            <div className="relative">
                                                {showTeamSellerDropdown && (
                                                    <div 
                                                        className="fixed inset-0 z-40 cursor-default" 
                                                        onClick={() => setShowTeamSellerDropdown(false)} 
                                                    />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTeamSellerDropdown(prev => !prev)}
                                                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
                                                        selectedTeamSellers.size > 0
                                                            ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-black'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                                                    }`}
                                                    title="Filtrar colaboradores da equipe (selecione um ou vários marcando-os)"
                                                >
                                                    <UserGroupIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                                    <span>
                                                        {selectedTeamSellers.size === 0
                                                            ? `Vendedores (${availableTeamSellers.length})`
                                                            : selectedTeamSellers.size === 1
                                                                ? `${availableTeamSellers.find(s => selectedTeamSellers.has(s.id))?.name || '1 Vendedor'}`
                                                                : `${selectedTeamSellers.size} de ${availableTeamSellers.length} Vendedores`
                                                        }
                                                    </span>
                                                    <ChevronDownIcon className={`w-3 h-3 transition-transform ${showTeamSellerDropdown ? 'rotate-180' : ''}`} />
                                                </button>

                                                {showTeamSellerDropdown && (
                                                    <div className="absolute top-full left-0 mt-1.5 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-2.5 space-y-2 animate-in fade-in zoom-in-95">
                                                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                                                Vendedores da Equipe
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedTeamSellers(new Set())}
                                                                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
                                                                >
                                                                    Marcar Todos
                                                                </button>
                                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedTeamSellers(new Set())}
                                                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                                                >
                                                                    Resetar
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                                            {availableTeamSellers.map(seller => {
                                                                const isChecked = selectedTeamSellers.size === 0 || selectedTeamSellers.has(seller.id);
                                                                return (
                                                                    <div
                                                                        key={seller.id}
                                                                        className={`flex items-center justify-between p-1.5 rounded-xl transition text-xs select-none ${
                                                                            selectedTeamSellers.has(seller.id)
                                                                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold'
                                                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                                                        }`}
                                                                    >
                                                                        <label className="flex items-center gap-2 truncate min-w-0 cursor-pointer flex-1">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={() => {
                                                                                    if (selectedTeamSellers.size === 0) {
                                                                                        const allExceptThis = new Set(availableTeamSellers.map(s => s.id).filter(id => id !== seller.id));
                                                                                        setSelectedTeamSellers(allExceptThis);
                                                                                    } else {
                                                                                        handleToggleTeamSeller(seller.id);
                                                                                    }
                                                                                }}
                                                                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                                                            />
                                                                            <span
                                                                                className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white dark:ring-slate-800"
                                                                                style={{ backgroundColor: seller.color }}
                                                                            />
                                                                            <span className="truncate text-[11px]" title={seller.name}>
                                                                                {seller.name}
                                                                            </span>
                                                                        </label>
                                                                        <div className="flex items-center gap-1 shrink-0 ml-1">
                                                                            <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md font-mono">
                                                                                {seller.count}
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    handleSelectOnlySeller(seller.id);
                                                                                }}
                                                                                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline px-1 py-0.5 rounded cursor-pointer"
                                                                                title="Exibir apenas este vendedor"
                                                                            >
                                                                                apenas
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {tableViewMode === 'accordion' && (
                                            <div className="flex items-center gap-1 text-[10px]">
                                                <button
                                                    type="button"
                                                    onClick={handleExpandAllDays}
                                                    className="font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
                                                    title="Expandir todas as sanfonas de dias da semana"
                                                >
                                                    Expandir Todos
                                                </button>
                                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                                <button
                                                    type="button"
                                                    onClick={handleCollapseAllDays}
                                                    className="font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 px-2 py-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer active:scale-95"
                                                    title="Recolher todas as sanfonas de dias da semana"
                                                >
                                                    Recolher Todos
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* BOTÕES DE AÇÃO COM WRAP SUAVE E ALINHAMENTO IMPECÁVEL */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={handleOpenSummaryModal}
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
                                            onClick={handleOpenCompareModal}
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
                                            type="button"
                                            onClick={handleExportExcel}
                                            className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-2xs transition h-[32px]"
                                            title="Exportar planilha Excel estruturada com abas consolidadas e por equipe/colaborador conforme o escopo selecionado"
                                        >
                                            <UploadIcon className="w-3.5 h-3.5 mr-1.5 rotate-180"/> Exportar Excel (em Abas)
                                        </button>

                                        {/* GRUPO DE AÇÕES: OTIMIZAÇÃO E SIMULAÇÕES SALVAS */}
                                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                                            <button
                                                type="button"
                                                onClick={handleOptimizeSimulate}
                                                disabled={loading || effectiveScopedRoutes.length === 0}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 h-[32px]"
                                                title={isSingleSeller
                                                    ? `Executar algoritmo de otimização de rotas apenas para o vendedor selecionado (${effectiveScopedRoutes.length} PDVs)`
                                                    : `Executar algoritmo de otimização de rotas para ${effectiveSellersList.length > 1 ? `${effectiveSellersList.length} vendedores selecionados` : 'os vendedores do escopo'} (${effectiveScopedRoutes.length} PDVs)`
                                                }
                                            >
                                                <RefreshIcon className="w-3.5 h-3.5 mr-1.5" />
                                                <span>{isSingleSeller ? 'Otimizar Vendedor' : (effectiveSellersList.length > 1 ? `Otimizar ${effectiveSellersList.length} Vendedores` : 'Otimizar Rotas')}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleOpenSavedSimulationsModal}
                                                className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-2xs transition h-[32px] cursor-pointer"
                                                title="Visualizar, abrir no mapa, editar, excluir ou compartilhar simulações salvas"
                                            >
                                                <FolderOpen className="w-3.5 h-3.5 mr-1.5"/> Simulações Salvas
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleOpenSaveModal}
                                                disabled={saving || effectiveScopedRoutes.length === 0}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-1.5 rounded-xl text-xs flex items-center shadow-md hover:shadow-lg transition h-[32px] disabled:opacity-50 cursor-pointer"
                                                title={isSingleSeller
                                                    ? `Salvar simulação contendo apenas o vendedor selecionado (${effectiveScopedRoutes.length} PDVs)`
                                                    : `Salvar simulação contendo os ${effectiveScopedRoutes.length} PDVs dos ${effectiveSellersList.length > 1 ? `${effectiveSellersList.length} vendedores selecionados` : 'vendedores da equipe'}`
                                                }
                                            >
                                                {saving ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5"/>}
                                                <span>{isSingleSeller ? 'Salvar Simulação (Vendedor)' : (effectiveSellersList.length > 1 ? `Salvar Simulação (${effectiveSellersList.length} Vendedores)` : 'Salvar Simulação')}</span>
                                            </button>
                                        </div>
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
                                                    : (dayMetrics ? Math.round(((dayMetrics.km13 + dayMetrics.km24) / 2) * 10) / 10 : 0));

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
                                                    title={`Clique para filtrar ${day}. ${selectedQuinzenaFilter === 'ALL' ? `${count} PDVs cadastrados` : `${count} visitas no ciclo ${selectedQuinzenaFilter === '1_3' ? '1/3' : '2/4'}`}${displayKm ? ` • ~${displayKm} km estimados` : ''}`}
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

                                        {operationalSummary.unallocatedCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleToggleDayFilter('SEM ATENDIMENTO')}
                                                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer border ${
                                                    selectedDaysFilter.includes('SEM ATENDIMENTO')
                                                        ? 'bg-red-600 text-white border-transparent shadow-sm ring-2 ring-offset-1 ring-red-400 font-black animate-pulse'
                                                        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100'
                                                }`}
                                                title={`Clientes que excederam o limite diário configurado (${operationalSummary.unallocatedCount} PDVs sem atendimento).`}
                                            >
                                                <span>⚠️ Sem Atend:</span>
                                                <span className="font-black">{operationalSummary.unallocatedCount}</span>
                                            </button>
                                        )}

                                        {/* FILTRO RÁPIDO PARA DIAS SOBRECARREGADOS (CONDICIONADO A LIMITAR HORAS / DIA) */}
                                        {optLimitHours && (
                                            overloadedDays.length > 0 ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const isFilterActive = overloadedDays.every(d => selectedDaysFilter.includes(d)) && selectedDaysFilter.length === overloadedDays.length;
                                                        if (isFilterActive) {
                                                            setSelectedDaysFilter([]);
                                                        } else {
                                                            setSelectedDaysFilter(overloadedDays);
                                                        }
                                                    }}
                                                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer border ${
                                                        overloadedDays.every(d => selectedDaysFilter.includes(d)) && selectedDaysFilter.length === overloadedDays.length
                                                            ? 'bg-red-600 text-white border-transparent shadow-sm ring-2 ring-offset-1 ring-red-400 font-black animate-pulse'
                                                            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
                                                    }`}
                                                    title={`Isolar com 1 clique apenas os dias com sobrecarga de jornada (${overloadedDays.join(', ')}).`}
                                                >
                                                    <span>🚨 Sobrecarga:</span>
                                                    <span className="font-black">{overloadedDays.length}</span>
                                                </button>
                                            ) : (
                                                attentionDays.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const isFilterActive = attentionDays.every(d => selectedDaysFilter.includes(d)) && selectedDaysFilter.length === attentionDays.length;
                                                            if (isFilterActive) {
                                                                setSelectedDaysFilter([]);
                                                            } else {
                                                                setSelectedDaysFilter(attentionDays);
                                                            }
                                                        }}
                                                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-2xs transition-all active:scale-95 cursor-pointer border ${
                                                            attentionDays.every(d => selectedDaysFilter.includes(d)) && selectedDaysFilter.length === attentionDays.length
                                                                ? 'bg-amber-600 text-white border-transparent shadow-sm ring-2 ring-offset-1 ring-amber-400 font-black'
                                                                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                                                        }`}
                                                        title={`Isolar com 1 clique os dias em atenção de jornada (${attentionDays.join(', ')}).`}
                                                    >
                                                        <span>⚠️ Atenção:</span>
                                                        <span className="font-black">{attentionDays.length}</span>
                                                    </button>
                                                )
                                            )
                                        )}

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

                            {tableViewMode === 'accordion' ? (
                                /* VISÃO AGRUPADA POR DIA EM SANFONA (COM SUPORTE A MÚLTIPLOS VENDEDORES) */
                                (() => {
                                    const renderDayAccordionCard = (day: string, dayRoutes: VisitaPrevista[], sellerId?: string) => {
                                        const isOpen = sellerId ? Boolean(openDaysMap[`${sellerId}-${day}`]) : Boolean(openDaysMap[day]);
                                        const dayCfg = DAY_COLORS[day] || { hex: '#4f46e5', label: day, bg: 'bg-indigo-600' };
                                        const dayMetrics = sellerId ? operationalSummary.sellerDayMap?.[`${sellerId}-${day}`] : operationalSummary.dayMap[day];
                                        const isUnallocated = day === 'SEM ATENDIMENTO';
                                        const dayOverload = (!isUnallocated && dayMetrics && optLimitHours) ? (() => {
                                            const activeDaysSet = new Set(optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
                                            const isInactiveDay = !activeDaysSet.has(day);
                                            const isSingleSellerView = sellerId !== undefined || (selectedTeamSellers.size === 1) || (selectedPromoter !== 'ALL');
                                            const maxDayTime = isSingleSellerView
                                                ? Math.max(dayMetrics.time13, dayMetrics.time24)
                                                : Math.max(dayMetrics.maxSellerTime13 || 0, dayMetrics.maxSellerTime24 || 0);
                                            const dayClientsCount = dayRoutes.length;

                                            if (isInactiveDay) {
                                                if (dayClientsCount === 0 && maxDayTime === 0) return null;
                                                const excessMin = maxDayTime > 0 ? maxDayTime : (dayClientsCount * 25);
                                                const excessH = Math.floor(excessMin / 60);
                                                const remM = Math.round(excessMin % 60);
                                                return {
                                                    excessMin,
                                                    excessH,
                                                    remM,
                                                    dayLimitHours: 0,
                                                    maxDayTime,
                                                    isSevere: true,
                                                    isInactiveDay: true
                                                };
                                            }

                                            const dayLimitHours = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                                            const dayLimitMin = dayLimitHours * 60;
                                            const excessMin = maxDayTime - dayLimitMin;
                                            if (excessMin <= 0) return null;
                                            const excessH = Math.floor(excessMin / 60);
                                            const remM = Math.round(excessMin % 60);
                                            return {
                                                excessMin,
                                                excessH,
                                                remM,
                                                dayLimitHours,
                                                maxDayTime,
                                                isSevere: excessMin >= 60,
                                                isInactiveDay: false
                                            };
                                        })() : null;

                                        const toggleOpen = () => {
                                            if (sellerId) {
                                                setOpenDaysMap(prev => ({ ...prev, [`${sellerId}-${day}`]: !Boolean(prev[`${sellerId}-${day}`]) }));
                                            } else {
                                                setOpenDaysMap(prev => ({ ...prev, [day]: !Boolean(prev[day]) }));
                                            }
                                        };

                                        return (
                                            <div 
                                                key={sellerId ? `${sellerId}-${day}` : day} 
                                                className={`border rounded-2xl overflow-hidden shadow-2xs transition-all ${
                                                    isUnallocated 
                                                        ? 'border-red-300 dark:border-red-800/80 bg-red-50/20 dark:bg-red-950/10' 
                                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                                }`}
                                            >
                                                {/* Cabeçalho da Sanfona do Dia */}
                                                <div 
                                                    onClick={toggleOpen}
                                                    className={`flex items-center justify-between gap-2.5 sm:gap-4 p-2.5 sm:p-3 cursor-pointer transition-all select-none overflow-x-auto custom-scrollbar ${
                                                        isOpen 
                                                            ? (isUnallocated 
                                                                ? 'bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/60' 
                                                                : 'bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80')
                                                            : (isUnallocated 
                                                                ? 'bg-red-50/40 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/40' 
                                                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50')
                                                    }`}
                                                >
                                                    {/* Lado Esquerdo: Chevron, Nome do Dia, Quantidade e Ciclos */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <div className={`p-1 rounded-lg transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                                                            <ChevronDownIcon className="w-4 h-4" />
                                                        </div>
                                                        <span 
                                                            className="px-2 py-0.5 rounded-lg text-xs font-black text-white shadow-2xs tracking-wide uppercase shrink-0"
                                                            style={{ backgroundColor: dayCfg.hex }}
                                                        >
                                                            {day}
                                                        </span>
                                                        <span 
                                                            className={`text-xs font-black shrink-0 ${isUnallocated ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-200'}`}
                                                            title={isUnallocated ? `${dayRoutes.length} PDVs excedentes sem atendimento` : `Carteira: ${dayRoutes.length} PDVs cadastrados para ${day}`}
                                                        >
                                                            {isUnallocated 
                                                                ? `${dayRoutes.length} ${dayRoutes.length === 1 ? 'PDV excedente' : 'PDVs excedentes'}`
                                                                : `${dayRoutes.length} ${dayRoutes.length === 1 ? 'PDV' : 'PDVs'}`
                                                            }
                                                        </span>
                                                        {!isUnallocated && dayRoutes.length > 0 && (
                                                            <span 
                                                                className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700 shadow-2xs shrink-0 whitespace-nowrap"
                                                                title={`Atendimentos reais por ciclo semanal neste dia:\n• Semanas 1 e 3: ${dayMetrics?.pdvs13 ?? 0} visitas\n• Semanas 2 e 4: ${dayMetrics?.pdvs24 ?? 0} visitas`}
                                                            >
                                                                Sem 1/3: <strong className="text-amber-700 dark:text-amber-400 font-black">{dayMetrics?.pdvs13 ?? 0} vis</strong> • Sem 2/4: <strong className="text-fuchsia-700 dark:text-fuchsia-400 font-black">{dayMetrics?.pdvs24 ?? 0} vis</strong>
                                                            </span>
                                                        )}
                                                        {dayOverload && (
                                                            <span 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRebalanceDay(day);
                                                                    setSelectedRebalanceClients(new Set());
                                                                    setTargetRebalanceDay('');
                                                                }}
                                                                className={`text-[10px] font-black px-2 py-0.5 rounded-md border shadow-2xs shrink-0 whitespace-nowrap inline-flex items-center gap-1 cursor-pointer transition hover:scale-105 active:scale-95 select-none ${
                                                                    dayOverload.isInactiveDay
                                                                        ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950/80 dark:hover:bg-rose-900/90 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                                                        : (dayOverload.isSevere 
                                                                            ? 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-950/80 dark:hover:bg-red-900/90 dark:text-red-300 border-red-300 dark:border-red-800' 
                                                                            : 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/80 dark:hover:bg-amber-900/90 dark:text-amber-300 border-amber-300 dark:border-amber-800')
                                                                }`}
                                                                title={dayOverload.isInactiveDay 
                                                                    ? `Colaborador não trabalha em ${day} (${dayRoutes.length} PDVs alocados). Clique para evacuar e transferir clientes para a jornada ativa.`
                                                                    : `Clique para diagnosticar e reequilibrar a jornada de ${day} (excesso de +${dayOverload.excessH > 0 ? `${dayOverload.excessH}h ` : ''}${dayOverload.remM}m).`
                                                                }
                                                            >
                                                                <span>{dayOverload.isInactiveDay ? '🚨' : (dayOverload.isSevere ? '🚨' : '⚠️')}</span>
                                                                <span>{dayOverload.isInactiveDay ? 'Fora da Jornada' : (dayOverload.isSevere ? 'Sobrecarga' : 'Atenção')}</span>
                                                                <span className="text-[9px] font-bold opacity-75 underline ml-0.5">{dayOverload.isInactiveDay ? 'Evacuar' : 'Reequilibrar'}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Lado Direito: Resumo Agrupado e Compacto de Tempos, KM e Sequência */}
                                                    <div className="flex items-center gap-2 sm:gap-2.5 text-[10px] shrink-0">
                                                        {!isUnallocated && dayMetrics ? (
                                                            <>
                                                                {/* CARD 1: TEMPOS OPERACIONAIS (PERCURSO + ATENDIMENTO EMPILHADOS) */}
                                                                <div className="flex flex-col justify-center px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 leading-tight shrink-0 shadow-2xs">
                                                                    <div 
                                                                        className="flex items-center gap-1 text-slate-600 dark:text-slate-400 whitespace-nowrap"
                                                                        title={`🚗 Tempo em trânsito / percurso viário OSRM (Base ↔ PDVs ↔ Base):\n• Semanas 1 e 3: ${formatDuration(dayMetrics.travelTime13)}\n• Semanas 2 e 4: ${formatDuration(dayMetrics.travelTime24)}`}
                                                                    >
                                                                        <span className="text-[11px]">🚗</span>
                                                                        <span className="text-slate-400 dark:text-slate-500 font-normal">Percurso:</span>
                                                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                            {dayMetrics.travelTime13 === dayMetrics.travelTime24 
                                                                                ? formatDuration(dayMetrics.travelTime13) 
                                                                                : `${formatDuration(dayMetrics.travelTime13)} (1/3) • ${formatDuration(dayMetrics.travelTime24)} (2/4)`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div 
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setShowChannelTimesModal(true);
                                                                        }}
                                                                        className="flex items-center gap-1 text-slate-600 dark:text-slate-400 whitespace-nowrap hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition mt-0.5" 
                                                                        title={`🏢 Tempo presencial de atendimento em loja (conforme canais de remuneração):\n• Semanas 1 e 3: ${formatDuration(dayMetrics.serviceTime13)}\n• Semanas 2 e 4: ${formatDuration(dayMetrics.serviceTime24)}\nClique para configurar os tempos por canal no SQL Server`}
                                                                    >
                                                                        <span className="text-[11px]">🏢</span>
                                                                        <span className="text-slate-400 dark:text-slate-500 font-normal">Atend:</span>
                                                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                                                            {dayMetrics.serviceTime13 === dayMetrics.serviceTime24 
                                                                                ? formatDuration(dayMetrics.serviceTime13) 
                                                                                : `${formatDuration(dayMetrics.serviceTime13)} (1/3) • ${formatDuration(dayMetrics.serviceTime24)} (2/4)`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* CARD 2: JORNADA TOTAL & SOBRECARGA EMPILHADOS */}
                                                                <div className="flex flex-col justify-center px-2.5 py-1 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/50 leading-tight shrink-0 shadow-2xs">
                                                                    <div 
                                                                        className="flex items-center gap-1 text-slate-800 dark:text-slate-200 whitespace-nowrap"
                                                                        title={`⏱️ Tempo Total da Jornada Diária (Percurso + Atendimento):\n• Semanas 1 e 3: ${formatDuration(dayMetrics.travelTime13)} percurso + ${formatDuration(dayMetrics.serviceTime13)} atend = ${formatDuration(dayMetrics.time13)}\n• Semanas 2 e 4: ${formatDuration(dayMetrics.travelTime24)} percurso + ${formatDuration(dayMetrics.serviceTime24)} atend = ${formatDuration(dayMetrics.time24)}`}
                                                                    >
                                                                        <ClockIcon className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                                                        <span className="text-indigo-600/80 dark:text-indigo-400 font-normal">Total:</span>
                                                                        <span className="font-black text-indigo-900 dark:text-indigo-200">
                                                                            {dayMetrics.time13 === dayMetrics.time24 
                                                                                ? formatDuration(dayMetrics.time13) 
                                                                                : `${formatDuration(dayMetrics.time13)} (1/3) • ${formatDuration(dayMetrics.time24)} (2/4)`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    {dayOverload ? (
                                                                        <div 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setRebalanceDay(day);
                                                                                setSelectedRebalanceClients(new Set());
                                                                                setTargetRebalanceDay('');
                                                                            }}
                                                                            className="flex items-center gap-0.5 mt-0.5 cursor-pointer hover:underline text-[9px] font-black text-rose-600 dark:text-rose-400"
                                                                            title={dayOverload.isInactiveDay 
                                                                                ? `🚨 Dia fora da jornada: ${dayRoutes.length} PDVs alocados em dia sem expediente (${formatDuration(dayOverload.maxDayTime)}). Clique para evacuar.`
                                                                                : `🚨 Sobrecarga: ultrapassa o limite de ${dayOverload.dayLimitHours}h em +${dayOverload.excessH}h${dayOverload.remM > 0 ? ` ${dayOverload.remM}m` : ''}. Clique para reequilibrar.`
                                                                            }
                                                                        >
                                                                            <span>🚨</span>
                                                                            <span>{dayOverload.isInactiveDay ? 'Fora da Jornada' : `+${dayOverload.excessH}h${dayOverload.remM > 0 ? ` ${dayOverload.remM}m` : ''}`}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-0.5">
                                                                            <span>✓</span>
                                                                            <span>Dentro da Jornada</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* CARD 3: CIRCUITO VIÁRIO (KM + SEQUÊNCIA EMPILHADOS) */}
                                                                <div className="flex flex-col justify-center px-2.5 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 leading-tight shrink-0 shadow-2xs">
                                                                    <div 
                                                                        className="flex items-center gap-1 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                                                                        title="KM estimado do circuito (ida da base, visitas sequenciadas e retorno)"
                                                                    >
                                                                        <LocationMarkerIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                                        <span className="text-slate-400 dark:text-slate-500 font-normal">KM:</span>
                                                                        <span className="font-black text-slate-800 dark:text-slate-200">
                                                                            {dayMetrics.km13 === dayMetrics.km24 
                                                                                ? `${dayMetrics.km13.toFixed(1)} km` 
                                                                                : `${dayMetrics.km13.toFixed(1)} km (1/3) • ${dayMetrics.km24.toFixed(1)} km (2/4)`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    {dayRoutes.length > 0 && (
                                                                        <div 
                                                                            className="flex items-center gap-1 text-slate-700 dark:text-slate-300 whitespace-nowrap mt-0.5"
                                                                            title={`Ordem de visitação diária sequenciada: ${
                                                                                optSequenceStrategy === 'FAR_TO_NEAR' ? 'Mais Distante 1º' :
                                                                                optSequenceStrategy === 'SNAKE_SWEEP' ? 'Serpente' :
                                                                                optSequenceStrategy === 'CIRCUIT_TSP' ? 'Menor KM TSP' : 'Mais Próximo 1º'
                                                                            }`}
                                                                        >
                                                                            <span className="text-slate-400 dark:text-slate-500 font-normal">Seq:</span>
                                                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                                                {dayMetrics?.pdvs13 === dayMetrics?.pdvs24 ? (
                                                                                    `#1 a #${dayMetrics?.pdvs13 ?? dayRoutes.length}`
                                                                                ) : (
                                                                                    `1/3: #${dayMetrics?.pdvs13 ?? 0} • 2/4: #${dayMetrics?.pdvs24 ?? 0}`
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        ) : isUnallocated ? (
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-100/80 dark:bg-red-950/70 px-2 py-0.5 rounded border border-red-300 dark:border-red-800">
                                                                    ⚠️ Excedente de Capacidade / Jornada — Necessita Reatribuição Manual
                                                                </span>
                                                                {dayRoutes.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (dayRoutes.every(c => selectedUnallocatedClients.has(c.Cod_Cliente))) {
                                                                                handleClearSelectionUnallocated();
                                                                            } else {
                                                                                handleSelectAllUnallocated(dayRoutes);
                                                                            }
                                                                        }}
                                                                        className="px-2 py-0.5 text-[9px] font-black rounded bg-red-600 hover:bg-red-700 text-white transition cursor-pointer shadow-2xs"
                                                                    >
                                                                        {dayRoutes.every(c => selectedUnallocatedClients.has(c.Cod_Cliente)) ? 'Desmarcar Todos' : `Selecionar Todos (${dayRoutes.length})`}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>

                                                {/* Conteúdo Expansível da Sanfona */}
                                                {isOpen && (
                                                    <div className="overflow-x-auto p-1">
                                                        {isUnallocated && renderMassTransferToolbar(dayRoutes)}
                                                        {dayRoutes.length === 0 ? (
                                                            <div className="p-5 text-center text-slate-400 dark:text-slate-500 text-xs italic bg-slate-50/40 dark:bg-slate-800/20">
                                                                Nenhuma visita agendada para {day}.
                                                            </div>
                                                        ) : (
                                                            <table className="w-full text-left text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                                                {renderTableHeaders()}
                                                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                                                                    {dayRoutes.map((v, i) => renderRouteRow(v, i))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="flex-1 overflow-auto custom-scrollbar space-y-3 pr-1">
                                            {isMultipleSellers ? (
                                                /* MÚLTIPLOS VENDEDORES: AGRUPADOS EM SANFONAS INDIVIDUAIS POR VENDEDOR */
                                                effectiveSellersList.map(sellerId => {
                                                    const sellerVisits = sortedRoutes.filter(r => String(r.Cod_Vend) === sellerId);
                                                    const sellerColab = getColabBySectorOrName(Number(sellerId), sellerVisits[0]?.Nome_Vendedor);
                                                    const sellerDisplayName = formatSellerDisplayName(Number(sellerId), sellerColab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : `Colaborador ${sellerId}`));
                                                    const sellerColor = promoterColorMap.get(String(sellerId)) || '#4f46e5';
                                                    const isSellerOpen = Boolean(openSellersMap[sellerId]);
                                                    const isSellerOptimized = optimizedSellersSet.has(Number(sellerId));
                                                    const sellerTotalKm = visibleDays.reduce((sum, d) => sum + (operationalSummary.sellerDayMap?.[`${sellerId}-${d}`]?.totalKm || 0), 0);

                                                    // Resumo de Pontos de Atenção do Vendedor
                                                    const activeDaysSet = new Set(optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA']);
                                                    const sellerAttentionItems: Array<{
                                                        day: string;
                                                        shortDay: string;
                                                        excessText: string;
                                                        isSevere: boolean;
                                                        isInactiveDay: boolean;
                                                        pdvsCount: number;
                                                    }> = [];

                                                    const sellerUnallocatedVisits = sellerVisits.filter(r => r.Dia_Semana === 'SEM ATENDIMENTO');

                                                    visibleDays.forEach(day => {
                                                        if (day === 'SEM ATENDIMENTO') return;
                                                        const dayMetrics = operationalSummary.sellerDayMap?.[`${sellerId}-${day}`];
                                                        const dayVisits = sellerVisits.filter(r => r.Dia_Semana === day);
                                                        const isInactiveDay = !activeDaysSet.has(day);
                                                        const maxDayTime = dayMetrics ? Math.max(dayMetrics.time13, dayMetrics.time24) : 0;
                                                        const dayClientsCount = dayVisits.length;

                                                        const shortDay = day === 'SEGUNDA-FEIRA' ? 'Seg' :
                                                                         day === 'TERÇA-FEIRA' ? 'Ter' :
                                                                         day === 'QUARTA-FEIRA' ? 'Qua' :
                                                                         day === 'QUINTA-FEIRA' ? 'Qui' :
                                                                         day === 'SEXTA-FEIRA' ? 'Sex' :
                                                                         day === 'SÁBADO' ? 'Sáb' : day.slice(0, 3);

                                                        if (isInactiveDay) {
                                                            if (dayClientsCount > 0 || maxDayTime > 0) {
                                                                sellerAttentionItems.push({
                                                                    day,
                                                                    shortDay,
                                                                    excessText: `${dayClientsCount} PDVs fora da jornada`,
                                                                    isSevere: true,
                                                                    isInactiveDay: true,
                                                                    pdvsCount: dayClientsCount
                                                                });
                                                            }
                                                            return;
                                                        }

                                                        if (optLimitHours && dayMetrics) {
                                                            const dayLimitHours = (day === 'SÁBADO' && optSatHalfPeriod) ? optMaxHours / 2 : optMaxHours;
                                                            const dayLimitMin = dayLimitHours * 60;
                                                            const excessMin = maxDayTime - dayLimitMin;
                                                            if (excessMin > 0) {
                                                                const excessH = Math.floor(excessMin / 60);
                                                                const remM = Math.round(excessMin % 60);
                                                                const excessText = excessH > 0 ? `+${excessH}h${remM > 0 ? ` ${remM}m` : ''}` : `+${remM}m`;
                                                                sellerAttentionItems.push({
                                                                    day,
                                                                    shortDay,
                                                                    excessText,
                                                                    isSevere: excessMin >= 60,
                                                                    isInactiveDay: false,
                                                                    pdvsCount: dayClientsCount
                                                                });
                                                            }
                                                        }
                                                    });

                                                    return (
                                                        <div 
                                                            key={sellerId} 
                                                            className="border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xs transition-all"
                                                        >
                                                            {/* Cabeçalho do Vendedor na Sanfona */}
                                                            <div 
                                                                onClick={() => setOpenSellersMap(prev => ({ ...prev, [sellerId]: !Boolean(prev[sellerId]) }))}
                                                                className={`flex items-center justify-between gap-3 p-3 sm:p-3.5 cursor-pointer transition-all select-none ${
                                                                    isSellerOpen 
                                                                        ? 'bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80' 
                                                                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3 shrink-0">
                                                                    <div className={`p-1.5 rounded-xl transition-transform duration-200 ${isSellerOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                                                                        <ChevronDownIcon className="w-4 h-4" />
                                                                    </div>
                                                                    <div 
                                                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-xs shrink-0"
                                                                        style={{ backgroundColor: sellerColor }}
                                                                    >
                                                                        {sellerDisplayName.slice(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-black text-slate-800 dark:text-white">
                                                                                {sellerDisplayName}
                                                                            </span>
                                                                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded font-bold">
                                                                                ID {sellerId}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                                                            {sellerVisits.length} PDVs no escopo
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Métricas e Ações do Vendedor */}
                                                                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                                                    {/* TAG DE ROTA OTIMIZADA */}
                                                                    {isSellerOptimized && (
                                                                        <span 
                                                                            className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/90 text-emerald-800 dark:text-emerald-200 font-black px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 shadow-2xs select-none"
                                                                            title="Este vendedor já teve sua rota otimizada e balanceada pelo algoritmo nesta sessão."
                                                                        >
                                                                            <span>✨</span>
                                                                            <span>Rota Otimizada</span>
                                                                        </span>
                                                                    )}

                                                                    {/* Resumo de Pontos de Atenção */}
                                                                    {sellerAttentionItems.length > 0 || sellerUnallocatedVisits.length > 0 ? (
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            {sellerAttentionItems.map((item, idx) => (
                                                                                <span
                                                                                    key={idx}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setOpenSellersMap(prev => ({ ...prev, [sellerId]: true }));
                                                                                        setOpenDaysMap(prev => ({ ...prev, [`${sellerId}-${item.day}`]: true }));
                                                                                    }}
                                                                                    className={`font-black px-2 py-0.5 rounded-lg border flex items-center gap-1 transition hover:scale-105 active:scale-95 cursor-pointer shadow-2xs select-none ${
                                                                                        item.isSevere
                                                                                            ? 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/80 dark:hover:bg-rose-900/90 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800 animate-pulse'
                                                                                            : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900/90 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                                                                    }`}
                                                                                    title={item.isInactiveDay 
                                                                                        ? `${item.day}: Colaborador não trabalha neste dia (${item.pdvsCount} PDVs alocados). Clique para abrir e visualizar o dia.`
                                                                                        : `${item.day}: Jornada diária excede o limite estipulado em ${item.excessText}. Clique para abrir e visualizar o dia.`
                                                                                    }
                                                                                >
                                                                                    <span>{item.isSevere ? '🚨' : '⚠️'}</span>
                                                                                    <span>{item.shortDay}: {item.excessText}</span>
                                                                                </span>
                                                                            ))}
                                                                            {sellerUnallocatedVisits.length > 0 && (
                                                                                <span
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setOpenSellersMap(prev => ({ ...prev, [sellerId]: true }));
                                                                                        setOpenDaysMap(prev => ({ ...prev, [`${sellerId}-SEM ATENDIMENTO`]: true }));
                                                                                    }}
                                                                                    className="bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900/90 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800 font-black px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition hover:scale-105 active:scale-95 shadow-2xs select-none"
                                                                                    title={`${sellerUnallocatedVisits.length} clientes na pasta SEM ATENDIMENTO. Clique para visualizar.`}
                                                                                >
                                                                                    <span>⚠️</span>
                                                                                    <span>{sellerUnallocatedVisits.length} sem atend.</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <span 
                                                                            className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-lg border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-1 select-none"
                                                                            title="Todas as rotas do vendedor estão dentro do limite diário de jornada e sem pendências."
                                                                        >
                                                                            <span>✓</span>
                                                                            <span>Jornada OK</span>
                                                                        </span>
                                                                    )}

                                                                    {/* KM Total */}
                                                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                                                                        🛣️ {Math.round(sellerTotalKm * 10) / 10} KM total
                                                                    </span>

                                                                    {/* Total de PDVs */}
                                                                    <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-black px-2.5 py-1 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
                                                                        📍 {sellerVisits.length} PDVs
                                                                    </span>

                                                                    {/* BOTÃO FOCAR / ISOLAR NO MAPA */}
                                                                    {isMultipleSellers && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (focusedMapSellerId === Number(sellerId)) {
                                                                                    setFocusedMapSellerId(null);
                                                                                } else {
                                                                                    const sId = Number(sellerId);
                                                                                    setFocusedMapSellerId(sId);
                                                                                    // Centraliza câmera no vendedor
                                                                                    const validV = sellerVisits.find(v => v.Lat && v.Long);
                                                                                    if (validV) {
                                                                                        setMapFlyToTarget({
                                                                                            lat: validV.Lat!,
                                                                                            lng: validV.Long!,
                                                                                            codCliente: validV.Cod_Cliente,
                                                                                            timestamp: Date.now()
                                                                                        });
                                                                                    } else {
                                                                                        const colab = getColabBySectorOrName(sId);
                                                                                        if (colab?.LatitudeBase && colab?.LongitudeBase) {
                                                                                            setMapFlyToTarget({
                                                                                                lat: colab.LatitudeBase,
                                                                                                lng: colab.LongitudeBase,
                                                                                                codCliente: 0,
                                                                                                timestamp: Date.now()
                                                                                            });
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className={`px-2.5 py-1 rounded-xl font-black text-[10px] flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
                                                                                focusedMapSellerId === Number(sellerId)
                                                                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30 ring-2 ring-indigo-400/40'
                                                                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                                            }`}
                                                                            title={focusedMapSellerId === Number(sellerId)
                                                                                ? `Mapa está isolado no Vendedor ${sellerDisplayName}. Clique para voltar a exibir todos os vendedores.`
                                                                                : `Isolar e visualizar exclusivamente as rotas e clientes do Vendedor ${sellerDisplayName} no mapa.`
                                                                            }
                                                                        >
                                                                            <LocationMarkerIcon className="w-3.5 h-3.5" />
                                                                            <span>{focusedMapSellerId === Number(sellerId) ? 'Focado no Mapa' : 'Ver no Mapa'}</span>
                                                                        </button>
                                                                    )}

                                                                    {/* BOTÃO OTIMIZAR VENDEDOR INDIVIDUAL */}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleOptimizeSingleSeller(Number(sellerId), e)}
                                                                        disabled={loading || sellerVisits.length === 0}
                                                                        className={`disabled:opacity-50 text-white font-black px-2.5 py-1 rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer border ${
                                                                            isSellerOptimized
                                                                                ? 'bg-slate-700 hover:bg-slate-800 border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'
                                                                                : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500/50'
                                                                        }`}
                                                                        title={isSellerOptimized
                                                                            ? `Reotimizar e recalcular rotas para o Vendedor ${sellerDisplayName}`
                                                                            : `Executar algoritmo de otimização de rotas e balanceamento exclusivamente para o Vendedor ${sellerDisplayName} (${sellerVisits.length} PDVs)`
                                                                        }
                                                                    >
                                                                        <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                                                        <span>{isSellerOptimized ? 'Reotimizar' : 'Otimizar Rota'}</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Dias da Semana do Vendedor (Sanfona Aninhada) */}
                                                            {isSellerOpen && (
                                                                <div className="p-3 bg-slate-50/40 dark:bg-slate-900/40 space-y-2.5">
                                                                    {visibleDays.map(day => {
                                                                        const rawDayRoutes = sellerVisits.filter(r => r.Dia_Semana === day);
                                                                        const dayRoutes = (day !== 'SEM ATENDIMENTO' && (sortField === 'Cod_Cliente' || sortField === 'Sequencia'))
                                                                            ? [...rawDayRoutes].sort((a, b) => {
                                                                                const seqA = visitOrderMap.get(`${a.Cod_Vend}-${a.Dia_Semana}-${a.Cod_Cliente}`);
                                                                                const seqB = visitOrderMap.get(`${b.Cod_Vend}-${b.Dia_Semana}-${b.Cod_Cliente}`);
                                                                                const orderA = selectedQuinzenaFilter === '2_4' ? (seqA?.order24 ?? 999) : (seqA?.order13 ?? seqA?.order24 ?? 999);
                                                                                const orderB = selectedQuinzenaFilter === '2_4' ? (seqB?.order24 ?? 999) : (seqB?.order13 ?? seqB?.order24 ?? 999);
                                                                                if (orderA !== orderB) return sortDirection === 'asc' ? (orderA - orderB) : (orderB - orderA);
                                                                                return Number(a.Cod_Cliente) - Number(b.Cod_Cliente);
                                                                            })
                                                                            : rawDayRoutes;
                                                                        return renderDayAccordionCard(day, dayRoutes, sellerId);
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                /* VENDEDOR ÚNICO: RENDERIZA DIRETAMENTE OS DIAS DA SEMANA */
                                                visibleDays.map(day => {
                                                    const rawDayRoutes = sortedRoutes.filter(r => r.Dia_Semana === day);
                                                    const dayRoutes = (day !== 'SEM ATENDIMENTO' && (sortField === 'Cod_Cliente' || sortField === 'Sequencia'))
                                                        ? [...rawDayRoutes].sort((a, b) => {
                                                            const seqA = visitOrderMap.get(`${a.Cod_Vend}-${a.Dia_Semana}-${a.Cod_Cliente}`);
                                                            const seqB = visitOrderMap.get(`${b.Cod_Vend}-${b.Dia_Semana}-${b.Cod_Cliente}`);
                                                            const orderA = selectedQuinzenaFilter === '2_4' ? (seqA?.order24 ?? 999) : (seqA?.order13 ?? seqA?.order24 ?? 999);
                                                            const orderB = selectedQuinzenaFilter === '2_4' ? (seqB?.order24 ?? 999) : (seqB?.order13 ?? seqB?.order24 ?? 999);
                                                            if (orderA !== orderB) return sortDirection === 'asc' ? (orderA - orderB) : (orderB - orderA);
                                                            return Number(a.Cod_Cliente) - Number(b.Cod_Cliente);
                                                        })
                                                        : rawDayRoutes;
                                                    return renderDayAccordionCard(day, dayRoutes);
                                                })
                                            )}
                                            {sortedRoutes.length > 0 && (
                                                <div className="p-2.5 text-center text-slate-400 dark:text-slate-500 text-[10px] bg-slate-50 dark:bg-slate-800/60 font-medium flex items-center justify-between px-4 border border-slate-100 dark:border-slate-800 rounded-xl">
                                                    <span>
                                                        Exibindo {sortedRoutes.length} PDVs organizados por dia
                                                        {selectedDaysFilter.length > 0 || selectedQuinzenaFilter !== 'ALL' ? ' (com filtros ativos)' : ''}
                                                    </span>
                                                    <span className="font-bold text-slate-500 dark:text-slate-400">
                                                        Total no Escopo: {effectiveScopedRoutes.length} PDVs (~{operationalSummary.totalVisitsMonth} visitas/mês)
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            ) : (
                                /* VISÃO EM LISTA CONTÍNUA TRADICIONAL */
                                <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-xl">
                                    {sortedRoutes.some(r => r.Dia_Semana === 'SEM ATENDIMENTO') && (
                                        <div className="p-2 pb-0">
                                            {renderMassTransferToolbar(sortedRoutes.filter(r => r.Dia_Semana === 'SEM ATENDIMENTO'))}
                                        </div>
                                    )}
                                    <table className="w-full text-left text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                        {renderTableHeaders()}
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                                            {sortedRoutes.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="p-8 text-center text-slate-400 dark:text-slate-500">
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
                                                    .slice(0, visibleRoutesLimit)
                                                    .map((v, i) => renderRouteRow(v, i))
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
                                                Total no Escopo: {effectiveScopedRoutes.length} PDVs (~{operationalSummary.totalVisitsMonth} visitas/mês)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            {/* MODAL DE PARÂMETROS DO OTIMIZADOR (POPUP MODERNO E ESPAÇOSO) */}
            {showParamsModal && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                                    <CogIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Parâmetros do Otimizador de Rotas
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Defina limites diários, tempos de atendimento por canal e regras de sequenciamento viário.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowParamsModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Conteúdo com Scroll Suave */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                            {/* BLINDAGEM DE CARTEIRA */}
                            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-3.5 text-xs text-indigo-700 dark:text-indigo-300 flex items-start space-x-2.5 shadow-2xs">
                                <CheckCircleIcon className="w-4 h-4 mt-0.5 text-indigo-600 dark:text-indigo-400 shrink-0"/>
                                <div>
                                    <span className="font-black block text-sm">Carteira Blindada por Vendedor</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                                        Clientes pertencem exclusivamente ao vendedor alocado. Periodicidades (semanal e quinzenal) são preservadas e respeitadas na roteirização.
                                    </span>
                                </div>
                            </div>

                            {/* GRID COM 2 COLUNAS: LIMITES DIÁRIOS & CALENDÁRIO OPERACIONAL */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* GRUPO 1: LIMITES DIÁRIOS */}
                                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block flex items-center gap-1.5">
                                        <span>⏱️</span> Limites Diários por Rota
                                    </span>

                                    {/* Clientes Máximo / Dia */}
                                    <div className="flex items-center justify-between pt-1">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={optLimitClients} 
                                                onChange={(e) => setOptLimitClients(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Limitar Clientes / Dia:
                                            </span>
                                        </label>
                                        <div className="flex items-center space-x-1.5">
                                            <input 
                                                type="number" 
                                                value={optMaxClients} 
                                                disabled={!optLimitClients}
                                                onChange={(e) => setOptMaxClients(Math.max(1, Number(e.target.value)))}
                                                className={`w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-black text-right outline-none text-slate-800 dark:text-white transition-opacity ${!optLimitClients ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            />
                                            <span className="text-xs font-bold text-slate-400">PDVs</span>
                                        </div>
                                    </div>

                                    {/* KM Máximo / Dia */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={optLimitKm} 
                                                onChange={(e) => setOptLimitKm(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Limitar KM / Dia:
                                            </span>
                                        </label>
                                        <div className="flex items-center space-x-1.5">
                                            <input 
                                                type="number" 
                                                value={optMaxKm} 
                                                disabled={!optLimitKm}
                                                onChange={(e) => setOptMaxKm(Number(e.target.value))}
                                                className={`w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-black text-right outline-none text-slate-800 dark:text-white transition-opacity ${!optLimitKm ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            />
                                            <span className="text-xs font-bold text-slate-400">km</span>
                                        </div>
                                    </div>

                                    {/* Horas Máximas / Dia */}
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={optLimitHours} 
                                                onChange={(e) => setOptLimitHours(e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                Limitar Horas / Dia:
                                            </span>
                                        </label>
                                        <div className="flex items-center space-x-1.5">
                                            <input 
                                                type="number" 
                                                value={optMaxHours} 
                                                disabled={!optLimitHours}
                                                step={0.5}
                                                min={1}
                                                max={24}
                                                onChange={(e) => setOptMaxHours(Number(e.target.value))}
                                                className={`w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 px-2.5 text-xs font-black text-right outline-none text-slate-800 dark:text-white transition-opacity ${!optLimitHours ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            />
                                            <span className="text-xs font-bold text-slate-400">h</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                                        Tempo total = percurso viário OSRM + permanência calculada em cada cliente.
                                    </span>

                                    {/* Atalhos para Canais e Janelas */}
                                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowChannelTimesModal(true)}
                                            className={`w-full flex items-center justify-between py-2 px-3 rounded-xl border text-xs font-black transition cursor-pointer shadow-2xs ${
                                                channelsInUseWithAlerts.length > 0
                                                    ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                                                    : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300'
                                            }`}
                                            title="Configurar permanência em minutos por Canal de Remuneração (salvo no SQL Server corporativo)"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <ClockIcon className={`w-4 h-4 ${channelsInUseWithAlerts.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                                                <span>Tempos por Canal ({allDisplayChannels.length})</span>
                                            </div>
                                            {channelsInUseWithAlerts.length > 0 && (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-200/80 dark:bg-amber-900/80 px-2 py-0.5 rounded-full border border-amber-300 animate-pulse">
                                                    <ExclamationIcon className="w-3 h-3 text-amber-600" />
                                                    {channelsInUseWithAlerts.length} pendente{channelsInUseWithAlerts.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenNewRestricaoModal()}
                                            className="w-full flex items-center justify-between py-2 px-3 rounded-xl border text-xs font-black transition cursor-pointer shadow-2xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300"
                                            title="Configurar restrições operacionais e janelas de atendimento por cliente (ex.: dias fixos, manhã, tarde)"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                <span>Janelas de Clientes ({clienteRestricoes.length})</span>
                                            </div>
                                            {clienteRestricoes.length > 0 && (
                                                <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 bg-blue-200/80 dark:bg-blue-900/80 px-2 py-0.5 rounded-full">
                                                    {clienteRestricoes.length} ativa{clienteRestricoes.length > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* GRUPO 2: CALENDÁRIO OPERACIONAL */}
                                <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
                                    <div className="space-y-3">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block flex items-center gap-1.5">
                                            <span>📅</span> Calendário & Jornada
                                        </span>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                                                Dias de Atendimento Ativos:
                                            </label>
                                            <div className="grid grid-cols-3 gap-1.5">
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
                                                            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer border ${
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

                                        <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    Sábado Meio-Período
                                                </span>
                                                <input 
                                                    type="checkbox" 
                                                    checked={optSatHalfPeriod} 
                                                    onChange={(e) => setOptSatHalfPeriod(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                            </label>

                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                                                        Equilibrar Quinzenas
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block">
                                                        Equaliza semanas 1/3 e 2/4
                                                    </span>
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    checked={optBalanceWorkload} 
                                                    onChange={(e) => setOptBalanceWorkload(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                            </label>

                                            <label className="flex items-center justify-between cursor-pointer pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                                                <div className="pr-2">
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                                                        Evitar Rotas Distantes na Sexta
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block">
                                                        Prioriza rotas longas de Seg a Qui (evita tráfego rodoviário de sexta)
                                                    </span>
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    checked={optAvoidFridayDistant} 
                                                    onChange={(e) => setOptAvoidFridayDistant(e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* GRUPO 3: ESTRATÉGIA DE SEQUENCIAMENTO DAS VISITAS */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🎯</span> Estratégia de Sequenciamento das Visitas
                                    </span>
                                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                        {optSequenceStrategy === 'FAR_TO_NEAR' ? 'Mais Distante 1º' :
                                         optSequenceStrategy === 'SNAKE_SWEEP' ? 'Serpente' :
                                         optSequenceStrategy === 'CIRCUIT_TSP' ? 'Menor KM' : 'Mais Próximo 1º'}
                                    </span>
                                </div>
                                <select
                                    value={optSequenceStrategy}
                                    onChange={(e) => setOptSequenceStrategy(e.target.value as SequenceStrategy)}
                                    className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer shadow-2xs"
                                >
                                    <option value="FAR_TO_NEAR">🎯 Mais Distante 1º (Começar longe e vir voltando em direção à base)</option>
                                    <option value="SNAKE_SWEEP">🐍 Serpente / Varredura Contínua (Sem cruzamentos de trajeto)</option>
                                    <option value="CIRCUIT_TSP">⚡ Menor Quilometragem (Circuito TSP OSRM Viário)</option>
                                    <option value="NEAR_TO_FAR">📍 Mais Próximo 1º (Começar perto da base)</option>
                                </select>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                                    {optSequenceStrategy === 'FAR_TO_NEAR' && 'Inicia no PDV mais distante e regressa atendendo em direção à base residencial (fim do dia mais perto de casa).'}
                                    {optSequenceStrategy === 'SNAKE_SWEEP' && 'Varre o setor em arco contínuo tipo serpente eliminando cruzamentos e retornos repetidos.'}
                                    {optSequenceStrategy === 'CIRCUIT_TSP' && 'Otimiza o circuito fechado para a menor distância total viária em quilômetros.'}
                                    {optSequenceStrategy === 'NEAR_TO_FAR' && 'Inicia pelos clientes vizinhos à base e afasta-se até o ponto final.'}
                                </p>
                            </div>

                            {/* GRUPO 4: ENCERRAMENTO DA JORNADA DIÁRIA */}
                            <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-2">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="space-y-0.5 pr-4">
                                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                                            <span>🏁</span> Encerrar Rota no Último Cliente
                                        </span>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            Não calcula o trecho de retorno da última visita até a residência/base do colaborador. Ideal para equipes de vendas cujo expediente encerra no último atendimento, reduzindo quilometragem e tempo em trânsito.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={optEndAtLastClient}
                                        onChange={(e) => setOptEndAtLastClient(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5 cursor-pointer shrink-0"
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Rodapé com Ações */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900/70">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowParamsModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                                >
                                    Fechar
                                </button>
                                {paramsSaveFeedback && (
                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl animate-in fade-in ${
                                        paramsSaveFeedback.type === 'success'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                    }`}>
                                        {paramsSaveFeedback.type === 'success' ? '✅ ' : '❌ '}
                                        {paramsSaveFeedback.message}
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveOptimizerParametersToDatabase}
                                disabled={savingParamsToDb}
                                className="px-5 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                                title="Gravar parâmetros permanentemente no SQL Server corporativo"
                            >
                                {savingParamsToDb ? (
                                    <>
                                        <SpinnerIcon className="w-4 h-4 animate-spin mr-1.5" />
                                        <span>Gravando no Banco...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>💾</span>
                                        <span>Salvar Parâmetros no Banco</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE VENDEDORES / COLABORADORES (POPUP MODERNO) */}
            {showSellersModal && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs shrink-0">
                                    <UserGroupIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Gestão de Vendedores & Colaboradores
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                            {Array.from(new Set((scopeMode === 'vendedor' && selectedSeller ? adjustedRoutes : scopedAdjustedRoutes).map(r => r.Cod_Vend))).length} no Escopo
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Selecione um vendedor para focar ou visualize desbalanceamentos quinzenais e anomalias de rota.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSellersModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Conteúdo com Scroll */}
                        <div className="p-5 overflow-y-auto custom-scrollbar space-y-3 flex-1">
                            {/* CAMPO DE BUSCA RÁPIDA DE COLABORADOR */}
                            <div className="relative">
                                <SearchIcon className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="text"
                                    value={collaboratorSearchQuery}
                                    onChange={(e) => setCollaboratorSearchQuery(e.target.value)}
                                    placeholder="Buscar vendedor por código ou nome..."
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {collaboratorSearchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setCollaboratorSearchQuery('')}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer p-0.5"
                                        title="Limpar busca"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Alerta se houver vendedores desbalanceados */}
                            {imbalancedSellersCount > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                                    <span className="font-bold flex items-center gap-1.5">
                                        <span>⚠️</span>
                                        <span>{imbalancedSellersCount} colaborador(es) com desbalanceamento quinzenal superior a 30%</span>
                                    </span>
                                    <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Equalize alternando Sem 1/3 e Sem 2/4</span>
                                </div>
                            )}

                            {/* Lista de Vendedores */}
                            <div className="space-y-1.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                                <div 
                                    className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center justify-between ${selectedPromoter === 'ALL' && (!selectedSeller || selectedSeller === 'ALL') ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs' : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-200'}`}
                                    onClick={() => {
                                        setSelectedPromoter('ALL');
                                        if (scopeMode === 'vendedor') {
                                            setSelectedSeller('');
                                        }
                                        setShowSellersModal(false);
                                    }}
                                >
                                    <span>🌐 Todos no Escopo Geral</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {Array.from(new Set((scopeMode === 'vendedor' && selectedSeller ? adjustedRoutes : scopedAdjustedRoutes).map(r => r.Cod_Vend))).length} Vendedores
                                    </span>
                                </div>

                                {Array.from(new Set((scopeMode === 'vendedor' && selectedSeller ? adjustedRoutes : scopedAdjustedRoutes).map(r => r.Cod_Vend)))
                                    .filter(sellerId => {
                                        if (!collaboratorSearchQuery.trim()) return true;
                                        const q = collaboratorSearchQuery.toLowerCase().trim();
                                        const sellerVisits = (scopeMode === 'vendedor' && selectedSeller ? adjustedRoutes : scopedAdjustedRoutes).filter(v => v.Cod_Vend === sellerId);
                                        const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);
                                        const displayName = (colab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : '')).toLowerCase();
                                        return String(sellerId).includes(q) || displayName.includes(q);
                                    })
                                    .map(sellerId => {
                                        const sellerVisits = (scopeMode === 'vendedor' && selectedSeller ? adjustedRoutes : scopedAdjustedRoutes).filter(v => v.Cod_Vend === sellerId);
                                        const colab = getColabBySectorOrName(sellerId, sellerVisits[0]?.Nome_Vendedor);
                                        const count = sellerVisits.length;
                                        const color = promoterColorMap.get(String(sellerId)) || '#64748b';
                                        const qStats = getSellerQuinzenaStats(sellerId, (scopeMode === 'vendedor' && selectedSeller ? adjustedRoutes : scopedAdjustedRoutes));
                                        const baseAnomaly = checkCollaboratorBaseAnomaly(colab?.LatitudeBase, colab?.LongitudeBase, sellerVisits);
                                        const displayName = formatSellerDisplayName(sellerId, colab?.Nome || (sellerVisits.length > 0 ? sellerVisits[0].Nome_Vendedor : `Colaborador ${sellerId}`));
                                        const isItemActive = selectedPromoter === String(sellerId) || (scopeMode === 'vendedor' && selectedSeller === String(sellerId));

                                        return (
                                            <div 
                                                key={sellerId}
                                                className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center justify-between gap-2 ${isItemActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 shadow-2xs' : (baseAnomaly.isAnomalous ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 hover:border-rose-400' : (qStats.isImbalanced ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 hover:border-amber-400' : 'border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-200'))}`}
                                                onClick={() => {
                                                    setSelectedPromoter(String(sellerId));
                                                    if (scopeMode === 'vendedor') {
                                                        setSelectedSeller(String(sellerId));
                                                    }
                                                    setShowSellersModal(false);
                                                }}
                                            >
                                                <div className="flex items-center space-x-2.5 truncate min-w-0">
                                                    <span className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-800" style={{ backgroundColor: color }}></span>
                                                    <span className="truncate text-xs" title={displayName}>{displayName}</span>
                                                </div>

                                                <div className="flex items-center space-x-1.5 shrink-0">
                                                    {baseAnomaly.isAnomalous && (
                                                        <span 
                                                            className="bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center shadow-xs"
                                                            title={`🚨 ${baseAnomaly.message}`}
                                                        >
                                                            {baseAnomaly.badgeText}
                                                        </span>
                                                    )}
                                                    {qStats.isImbalanced && !baseAnomaly.isAnomalous && (
                                                        <span 
                                                            className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-full text-[9px] font-black flex items-center shadow-xs"
                                                            title={`⚠️ Desbalanceamento Quinzenal: ${qStats.variationPct}% de variação\n• Semanas 1 e 3: ${qStats.v13} atendimentos\n• Semanas 2 e 4: ${qStats.v24} atendimentos\nDica: Alterne clientes quinzenais na Grade de Ajuste Fino para equilibrar.`}
                                                        >
                                                            ⚠️ {qStats.variationPct}%
                                                        </span>
                                                    )}
                                                    <span 
                                                        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg text-[10.5px] font-black"
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

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50/70 dark:bg-slate-900/70">
                            <button
                                type="button"
                                onClick={() => setShowSellersModal(false)}
                                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL OVERLAY DE PROGRESSO DA OTIMIZAÇÃO COM BARRA E PERCENTUAL */}
            {/* MODAL OVERLAY DE PROGRESSO DA OTIMIZAÇÃO COM BARRA E RESUMO ELEGANTE */}
            {optimizeProgress && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
                        {optimizeProgress.completedSummary ? (
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black shadow-xs shrink-0">
                                            <CheckCircleIcon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900 dark:text-white">
                                                {optimizeProgress.completedSummary.title}
                                            </h3>
                                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                {optimizeProgress.completedSummary.escopoDesc}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setOptimizeProgress(null)}
                                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                        title="Fechar"
                                    >
                                        <span className="text-base font-bold">✕</span>
                                    </button>
                                </div>

                                {/* Cards de Indicadores Rápidos */}
                                <div className="grid grid-cols-2 gap-2.5">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Total de PDVs</div>
                                        <div className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                            {optimizeProgress.completedSummary.totalClients} PDVs
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                                        <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Status da Alocação</div>
                                        <div className="text-xl font-black mt-0.5">
                                            {optimizeProgress.completedSummary.unallocatedCount && optimizeProgress.completedSummary.unallocatedCount > 0 ? (
                                                <span className="text-red-600 dark:text-red-400 text-sm flex items-center gap-1 font-bold">
                                                    {optimizeProgress.completedSummary.unallocatedCount} Excedentes
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1 font-bold">
                                                    100% Cobertos
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Destaques das Regras e Algoritmo */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">📍</span>
                                        <span><strong>Circuito Fechado Diário:</strong> Base ➜ Clientes ➜ Retorno à Base.</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">⚡</span>
                                        <span><strong>Algoritmo TSP 2-Opt:</strong> Eliminação de cruzamentos viários e menor percurso.</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">🗺️</span>
                                        <span><strong>Zoneamento Contíguo:</strong> Microrregiões agrupadas com densidade geográfica.</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0">🔒</span>
                                        <span><strong>Carteiras Blindadas:</strong> 100% de integridade por colaborador.</span>
                                    </div>

                                    {optimizeProgress.completedSummary.mode === 'flexibilize' && (
                                        <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-medium">
                                            <span className="shrink-0">⚠️</span>
                                            <span><strong>Jornada Flexibilizada:</strong> Dias com carga acima de {optimizeProgress.completedSummary.hoursLimit || optMaxHours}h possuem tags coloridas de sobrecarga para fácil visualização na grade.</span>
                                        </div>
                                    )}

                                    {optimizeProgress.completedSummary.unallocatedCount && optimizeProgress.completedSummary.unallocatedCount > 0 ? (
                                        <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center space-x-2 text-red-600 dark:text-red-400 font-medium">
                                            <span className="shrink-0">🚫</span>
                                            <span><strong>{optimizeProgress.completedSummary.unallocatedCount} PDVs Excedentes:</strong> Estão destacados na sanfona &quot;SEM ATENDIMENTO&quot; para reatribuição manual.</span>
                                        </div>
                                    ) : null}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setOptimizeProgress(null)}
                                    className="w-full py-2.5 rounded-2xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-600/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                                >
                                    <span>Concluir e Ver Grade de Rotas</span>
                                    <span>➔</span>
                                </button>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
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
                            <div className="flex items-center space-x-3">
                                {availableTeamSellers.length > 1 && (
                                    <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-2xs">
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Colaborador:</span>
                                        <select
                                            value={compareSellerFilter}
                                            onChange={e => setCompareSellerFilter(e.target.value)}
                                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                                        >
                                            <option value="ALL" className="text-slate-800 dark:text-slate-900 font-bold">
                                                Todos os Colaboradores ({availableTeamSellers.length})
                                            </option>
                                            {availableTeamSellers.map(s => (
                                                <option key={s.id} value={s.id} className="text-slate-800 dark:text-slate-900 font-medium">
                                                    {s.name} ({s.count} PDVs)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowCompareModal(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Corpo com Scroll */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
                            {/* Cards de Métricas Comparativas */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {/* Métrica 1: Quilometragem Total */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Distância Total</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{compareKpis.adjusted.totalKm} KM</span>
                                        <span className="text-xs text-slate-400 line-through">{compareKpis.original.totalKm} KM</span>
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1 ${compareKpis.kmSaved >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {compareKpis.kmSaved >= 0 ? `▼ ${compareKpis.kmSaved} KM (-${compareKpis.percentSaved}%)` : `▲ ${Math.abs(compareKpis.kmSaved)} KM`}
                                    </span>
                                </div>

                                {/* Métrica 2: Tempo Total em Deslocamento */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Tempo em Trânsito</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{formatDuration(compareKpis.adjusted.totalTravelMinutes)}</span>
                                        <span className="text-xs text-slate-400 line-through">{formatDuration(compareKpis.original.totalTravelMinutes)}</span>
                                    </div>
                                    <span className={`text-[10px] font-bold mt-1 ${compareKpis.timeSavedMinutes >= 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                                        {compareKpis.timeSavedMinutes > 0 ? `⚡ -${formatDuration(compareKpis.timeSavedMinutes)} (-${compareKpis.percentTimeSaved}%)` : 'Otimizado em circuito'}
                                    </span>
                                </div>

                                {/* Métrica 3: Média KM / Colaborador */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Média KM / Colab</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-slate-800 dark:text-white">{compareKpis.adjusted.avgKmPerSeller} KM</span>
                                        <span className="text-xs text-slate-400 line-through">{compareKpis.original.avgKmPerSeller} KM</span>
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-400">
                                        {compareKpis.adjusted.sellerCount} {compareKpis.adjusted.sellerCount === 1 ? 'colaborador' : 'colaboradores'}
                                    </span>
                                </div>

                                {/* Métrica 4: Clientes Alterados */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Clientes Reordenados</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                            {compareRouteComparisonDiff.totalChanged}
                                        </span>
                                        <span className="text-xs text-slate-400">de {compareRouteComparisonDiff.totalClients} PDVs</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {compareRouteComparisonDiff.totalUnchanged} clientes mantidos
                                    </span>
                                </div>

                                {/* Métrica 5: Vendedores Desbalanceados */}
                                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl flex flex-col justify-between">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Desbalanço Quinzenal (&gt;30%)</span>
                                    <div className="mt-1 flex items-baseline space-x-2">
                                        <span className={`text-lg font-black ${compareImbalancedSellersCount === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {compareImbalancedSellersCount} colab(s)
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        {compareImbalancedSellersCount === 0 ? '✓ Equilíbrio 100% atingido' : 'Requer atenção'}
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
                                        const countBefore = compareOriginalVisitsByDay[day] || 0;
                                        const countAfter = compareVisitsByDay[day] || 0;
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
                                            ({compareRouteComparisonDiff.items.filter(i => (!compareOnlyChanged || i.isChanged) && (!compareSearchFilter || i.razaoSocial.toLowerCase().includes(compareSearchFilter.toLowerCase()) || String(i.codCliente).includes(compareSearchFilter) || i.nomeVendedor.toLowerCase().includes(compareSearchFilter.toLowerCase()))).length} listados)
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
                                            <span>Apenas Alterados ({compareRouteComparisonDiff.totalChanged})</span>
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
                                            {compareRouteComparisonDiff.items
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
                                {compareRouteComparisonDiff.totalChanged > 0 
                                    ? `Total de ${compareRouteComparisonDiff.totalChanged} clientes com novos roteiros prontos para aprovação.` 
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
                                        handleOpenSaveModal();
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
                                                <option key={s.id} value={s.id}>{s.name}</option>
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

                            {/* Resumo de KM, Percurso, Atendimento e Total */}
                            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 text-xs">
                                <span className="font-bold text-slate-500 dark:text-slate-400">
                                    {currentItineraryData.totalStops} PDVs
                                </span>
                                <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black px-2.5 py-0.5 rounded-full text-xs shadow-2xs">
                                    🛣️ ~{currentItineraryData.totalKm} KM
                                </span>
                                <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-sky-300 font-black px-2.5 py-0.5 rounded-full text-xs shadow-2xs" title="Tempo total estimado em trânsito viário (Base -> PDVs -> Retorno)">
                                    🚗 {formatDuration(currentItineraryData.totalTravelMinutes)} percurso
                                </span>
                                <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-black px-2.5 py-0.5 rounded-full text-xs shadow-2xs" title="Tempo total estimado de permanência nos PDVs">
                                    🏢 {formatDuration(currentItineraryData.totalServiceMinutes)} atend.
                                </span>
                                <span className="bg-indigo-100 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200 font-black px-2.5 py-0.5 rounded-full text-xs border border-indigo-200 dark:border-indigo-800 shadow-2xs" title="Jornada diária total prevista (Trânsito + Atendimentos)">
                                    ⏱️ {formatDuration(currentItineraryData.totalDurationMinutes)} total
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
                                                        {clienteRestricoesMap.has(stop.Cod_Cliente) && (() => {
                                                            const r = clienteRestricoesMap.get(stop.Cod_Cliente)!;
                                                            return (
                                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 flex items-center gap-1" title={r.Observacao || 'Cliente com janela de atendimento definida'}>
                                                                    {r.TurnoPermitido === 'MANHA' ? '🌅 Manhã' : r.TurnoPermitido === 'TARDE' ? '🌇 Tarde' : '📅 Janela'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex items-center space-x-1.5 shrink-0">
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400" title="Distância e tempo estimado em trânsito desde o ponto anterior">
                                                            +{stop.legKm} KM (~{stop.legTravelTime} min)
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
                                                {/* Detalhamento de Percurso e Atendimento */}
                                                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 font-bold px-2 py-0.5 rounded border border-blue-200/80 dark:border-blue-800" title="Tempo estimado em trânsito viário até este cliente">
                                                            <span>🚗</span>
                                                            <span>Deslocamento: <b>~{stop.legTravelTime} min</b> ({stop.legKm} km)</span>
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-200/80 dark:border-amber-800" title={`Permanência estimada no PDV conforme canal de remuneração (${stop.Canal_Remuneracao || 'PADRÃO'})`}>
                                                            <span>🏢</span>
                                                            <span>Atendimento: <b>{stop.serviceTime} min</b></span>
                                                            {stop.Canal_Remuneracao && <span className="opacity-75 font-normal">({stop.Canal_Remuneracao})</span>}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 ml-auto text-slate-500 dark:text-slate-400 font-bold">
                                                        <span className="text-slate-400 dark:text-slate-500 font-normal">Subtotal Trecho:</span>
                                                        <span className="text-indigo-600 dark:text-indigo-400 font-black">{stop.legTravelTime + stop.serviceTime} min</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* PONTO FINAL: RETORNO À BASE OU ENCERRAMENTO NO ÚLTIMO CLIENTE */}
                                    <div className="relative">
                                        <div className="absolute -left-[33px] top-0 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-md">
                                            🏁
                                        </div>
                                        <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                                    {optEndAtLastClient ? 'Término da Rota' : 'Retorno à Origem'}
                                                </span>
                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                                    {optEndAtLastClient 
                                                        ? `Último Cliente • Total: ${currentItineraryData.totalKm} KM`
                                                        : `+${currentItineraryData.returnLegKm} KM (~${currentItineraryData.returnTravelTime} min) • Total: ${currentItineraryData.totalKm} KM`}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                                {optEndAtLastClient 
                                                    ? 'Encerramento no Último Cliente (Sem Retorno à Base)' 
                                                    : 'Retorno à Base / Residência'}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                {optEndAtLastClient 
                                                    ? 'Expediente concluído na última visita da sequência.' 
                                                    : currentItineraryData.baseAddress}
                                            </p>
                                            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                                                <span>🏁 Encerramento da jornada diária</span>
                                                <span className="font-bold">
                                                    {optEndAtLastClient 
                                                        ? 'Sem deslocamento de retorno' 
                                                        : `Deslocamento final: ~${currentItineraryData.returnTravelTime} min viário`}
                                                </span>
                                            </div>
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
                            <div className="flex items-center space-x-3">
                                {availableTeamSellers.length > 1 && (
                                    <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-2xs">
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Colaborador:</span>
                                        <select
                                            value={summarySellerFilter}
                                            onChange={e => setSummarySellerFilter(e.target.value)}
                                            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
                                        >
                                            <option value="ALL" className="text-slate-800 dark:text-slate-900 font-bold">
                                                Todos os Colaboradores ({availableTeamSellers.length})
                                            </option>
                                            {availableTeamSellers.map(s => (
                                                <option key={s.id} value={s.id} className="text-slate-800 dark:text-slate-900 font-medium">
                                                    {s.name} ({s.count} PDVs)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <button
                                    onClick={() => setShowSummaryModal(false)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* KPIs Rápidos */}
                        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Carteira Ativa</span>
                                <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                    {modalOperationalSummary.uniqueClientsCount} <span className="text-xs font-normal text-slate-500">PDVs</span>
                                </div>
                                <span className="text-[9px] text-slate-500">
                                    {modalOperationalSummary.semanalCount} Sem. • {modalOperationalSummary.quinzenal13Count + modalOperationalSummary.quinzenal24Count} Quinz. • ~{modalOperationalSummary.totalVisitsMonth} vis/mês
                                </span>
                            </div>

                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Semanas 1 e 3</span>
                                    <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1 rounded">1/3</span>
                                </div>
                                <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                    {modalOperationalSummary.totalPdvs13} <span className="text-xs font-normal text-slate-500">visitas</span>
                                </div>
                                <div className="text-[9px] font-bold text-slate-500 flex flex-col gap-0.5 mt-0.5">
                                    <span>~{modalOperationalSummary.totalKm13} km • ⏱️ {Math.floor(modalOperationalSummary.totalTime13 / 60)}h {modalOperationalSummary.totalTime13 % 60}m Total</span>
                                    <span className="text-[8.5px] font-normal text-slate-400">
                                        🚗 {Math.floor(modalOperationalSummary.totalTravelTime13 / 60)}h {modalOperationalSummary.totalTravelTime13 % 60}m • 🏢 {Math.floor(modalOperationalSummary.totalServiceTime13 / 60)}h {modalOperationalSummary.totalServiceTime13 % 60}m
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-fuchsia-200 dark:border-fuchsia-800/50 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-fuchsia-600 dark:text-fuchsia-400">Semanas 2 e 4</span>
                                    <span className="text-[9px] font-black bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 px-1 rounded">2/4</span>
                                </div>
                                <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                    {modalOperationalSummary.totalPdvs24} <span className="text-xs font-normal text-slate-500">visitas</span>
                                </div>
                                <div className="text-[9px] font-bold text-slate-500 flex flex-col gap-0.5 mt-0.5">
                                    <span>~{modalOperationalSummary.totalKm24} km • ⏱️ {Math.floor(modalOperationalSummary.totalTime24 / 60)}h {modalOperationalSummary.totalTime24 % 60}m Total</span>
                                    <span className="text-[8.5px] font-normal text-slate-400">
                                        🚗 {Math.floor(modalOperationalSummary.totalTravelTime24 / 60)}h {modalOperationalSummary.totalTravelTime24 % 60}m • 🏢 {Math.floor(modalOperationalSummary.totalServiceTime24 / 60)}h {modalOperationalSummary.totalServiceTime24 % 60}m
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                                <span className="text-[10px] font-bold uppercase text-slate-400">Balanceamento</span>
                                <div className="flex items-center space-x-1 mt-0.5">
                                    <span className={`text-lg font-black ${modalOperationalSummary.isBalanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {modalOperationalSummary.imbalancePct}%
                                    </span>
                                    <span className="text-xs font-bold text-slate-400">var.</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-500">
                                    {modalOperationalSummary.isBalanced ? '✅ Carga Equalizada' : '⚠️ Variação acima de 15%'}
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
                                    {modalOperationalSummary.daysMetrics.map(item => {
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
                                                    {item.time13 > 0 ? (
                                                        <div className="flex flex-col items-center leading-tight">
                                                            <span className="font-bold text-amber-900 dark:text-amber-200">
                                                                {Math.floor(item.time13 / 60)}h {item.time13 % 60}m
                                                            </span>
                                                            <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5" title={`🚗 Percurso: ${formatDuration(item.travelTime13)} | 🏢 Atendimento: ${formatDuration(item.serviceTime13)}`}>
                                                                🚗 {formatDuration(item.travelTime13)} • 🏢 {formatDuration(item.serviceTime13)}
                                                            </span>
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className="py-3 text-center font-black text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-50/30 dark:bg-fuchsia-950/10">
                                                    {item.pdvs24}
                                                </td>
                                                <td className="py-3 text-center text-slate-600 dark:text-slate-300 bg-fuchsia-50/30 dark:bg-fuchsia-950/10 font-bold">
                                                    {item.km24 > 0 ? `${item.km24} km` : '—'}
                                                </td>
                                                <td className="py-3 text-center text-slate-500 dark:text-slate-400 bg-fuchsia-50/30 dark:bg-fuchsia-950/10 font-medium">
                                                    {item.time24 > 0 ? (
                                                        <div className="flex flex-col items-center leading-tight">
                                                            <span className="font-bold text-fuchsia-900 dark:text-fuchsia-200">
                                                                {Math.floor(item.time24 / 60)}h {item.time24 % 60}m
                                                            </span>
                                                            <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5" title={`🚗 Percurso: ${formatDuration(item.travelTime24)} | 🏢 Atendimento: ${formatDuration(item.serviceTime24)}`}>
                                                                🚗 {formatDuration(item.travelTime24)} • 🏢 {formatDuration(item.serviceTime24)}
                                                            </span>
                                                        </div>
                                                    ) : '—'}
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
                                            {modalOperationalSummary.totalPdvs13} PDVs
                                        </td>
                                        <td className="py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/40">
                                            {modalOperationalSummary.totalKm13} km
                                        </td>
                                        <td className="py-3 text-center text-amber-700 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-950/40">
                                            <div className="flex flex-col items-center leading-tight">
                                                <span>{Math.floor(modalOperationalSummary.totalTime13 / 60)}h {modalOperationalSummary.totalTime13 % 60}m</span>
                                                <span className="text-[9px] font-normal text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                                                    🚗 {Math.floor(modalOperationalSummary.totalTravelTime13 / 60)}h {modalOperationalSummary.totalTravelTime13 % 60}m • 🏢 {Math.floor(modalOperationalSummary.totalServiceTime13 / 60)}h {modalOperationalSummary.totalServiceTime13 % 60}m
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/50 dark:bg-fuchsia-950/40">
                                            {modalOperationalSummary.totalPdvs24} PDVs
                                        </td>
                                        <td className="py-3 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/50 dark:bg-fuchsia-950/40">
                                            {modalOperationalSummary.totalKm24} km
                                        </td>
                                        <td className="py-3 text-center text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-100/50 dark:bg-fuchsia-950/40">
                                            <div className="flex flex-col items-center leading-tight">
                                                <span>{Math.floor(modalOperationalSummary.totalTime24 / 60)}h {modalOperationalSummary.totalTime24 % 60}m</span>
                                                <span className="text-[9px] font-normal text-fuchsia-800/80 dark:text-fuchsia-300/80 mt-0.5">
                                                    🚗 {Math.floor(modalOperationalSummary.totalTravelTime24 / 60)}h {modalOperationalSummary.totalTravelTime24 % 60}m • 🏢 {Math.floor(modalOperationalSummary.totalServiceTime24 / 60)}h {modalOperationalSummary.totalServiceTime24 % 60}m
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center text-indigo-600 dark:text-indigo-400 font-black">
                                            {Math.round(((modalOperationalSummary.totalPdvs13 + modalOperationalSummary.totalPdvs24) / 2) * 10) / 10} / sem
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
                                            {s.name} ({s.clientCount} clientes)
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
                                                                {s.name}
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

            {/* MODAL DE PARTICULARIDADES E JANELAS DE ATENDIMENTO DE CLIENTES */}
            {showRestricoesModal && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs shrink-0">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Janelas e Particularidades de Clientes
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                            {clienteRestricoes.length} {clienteRestricoes.length === 1 ? 'regra ativa' : 'regras ativas'}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Defina restrições de dias da semana e turnos (manhã/tarde) que guiam o roteirizador no particionamento e ordem de atendimento.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRestricoesModal(false);
                                    setRestricaoSaveFeedback(null);
                                    setEditingRestricaoId(null);
                                }}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Conteúdo com Scroll: Formulário de Cadastro/Edição + Tabela com Filtros */}
                        <div className="p-5 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                            {/* Card de Formulário (Cadastrar / Editar Particularidade) */}
                            <div className="bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <span>{editingRestricaoId ? '✏️' : '➕'}</span>
                                        <span>{editingRestricaoId ? 'Editar Particularidade de Cliente' : 'Cadastrar Nova Particularidade'}</span>
                                    </h4>
                                    {editingRestricaoId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingRestricaoId(null);
                                                setFormCodCliente('');
                                                setFormRazaoSocial('');
                                                setFormDiasPermitidos([]);
                                                setFormTurnoPermitido('QUALQUER');
                                                setFormObservacao('');
                                                setRestricaoSaveFeedback(null);
                                            }}
                                            className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer"
                                        >
                                            Cancelar Edição
                                        </button>
                                    )}
                                </div>

                                {restricaoSaveFeedback && (
                                    <div className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                                        restricaoSaveFeedback.type === 'success'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                                    }`}>
                                        <span>{restricaoSaveFeedback.type === 'success' ? '✅' : '❌'}</span>
                                        <span>{restricaoSaveFeedback.message}</span>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {/* Código do Cliente (SOLD) */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                            Código do Cliente / SOLD <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={formCodCliente}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormCodCliente(val);
                                                const num = parseInt(val, 10);
                                                if (!isNaN(num)) {
                                                    const match = scopedAdjustedRoutes.find(r => r.Cod_Cliente === num) || scopedOriginalRoutes.find(r => r.Cod_Cliente === num);
                                                    if (match && match.Razao_Social && !formRazaoSocial) {
                                                        setFormRazaoSocial(match.Razao_Social);
                                                    }
                                                }
                                            }}
                                            placeholder="Ex: 104523"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* Razão Social / Nome Fantasia */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                            Razão Social / Nome do Estabelecimento
                                        </label>
                                        <input
                                            type="text"
                                            value={formRazaoSocial}
                                            onChange={(e) => setFormRazaoSocial(e.target.value)}
                                            placeholder="Ex: SUPERMERCADO BOM PREÇO LTDA"
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                    {/* Dias Permitidos (Multiselect) */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                            Dias Permitidos de Atendimento:
                                        </label>
                                        <div className="grid grid-cols-3 gap-1">
                                            {WEEKDAYS.map(day => {
                                                const isSel = formDiasPermitidos.includes(day);
                                                const short = day.split('-')[0].slice(0, 3).toUpperCase();
                                                return (
                                                    <button
                                                        key={day}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSel) {
                                                                setFormDiasPermitidos(prev => prev.filter(d => d !== day));
                                                            } else {
                                                                setFormDiasPermitidos(prev => [...prev, day]);
                                                            }
                                                        }}
                                                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition cursor-pointer border ${
                                                            isSel
                                                                ? 'bg-blue-600 text-white border-blue-700 shadow-2xs font-black'
                                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                                        }`}
                                                    >
                                                        {short}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block">
                                            {formDiasPermitidos.length === 0 
                                                ? 'Nenhum dia restrito: Cliente pode ser atendido em qualquer dia útil.' 
                                                : `Atendimento restrito exclusivamente para: ${formDiasPermitidos.map(d => d.split('-')[0]).join(', ')}.`}
                                        </span>
                                    </div>

                                    {/* Turno Permitido */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                            Turno de Atendimento Preferencial:
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setFormTurnoPermitido('MANHA')}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                                                    formTurnoPermitido === 'MANHA'
                                                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs font-black ring-2 ring-amber-400/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Sun className="w-4 h-4" />
                                                <span>🌅 Manhã</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormTurnoPermitido('TARDE')}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                                                    formTurnoPermitido === 'TARDE'
                                                        ? 'bg-orange-500 text-white border-orange-600 shadow-xs font-black ring-2 ring-orange-400/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Sunset className="w-4 h-4" />
                                                <span>🌇 Tarde</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormTurnoPermitido('QUALQUER')}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                                                    formTurnoPermitido === 'QUALQUER'
                                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-black ring-2 ring-indigo-400/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <ClockIcon className="w-4 h-4" />
                                                <span>⏰ Qualquer</span>
                                            </button>
                                        </div>
                                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block">
                                            {formTurnoPermitido === 'MANHA' && 'Otimizador aloca o cliente nas primeiras paradas da rota do dia.'}
                                            {formTurnoPermitido === 'TARDE' && 'Otimizador aloca o cliente nas paradas finais da rota do dia.'}
                                            {formTurnoPermitido === 'QUALQUER' && 'Sem restrição horária: segue o circuito de menor quilometragem.'}
                                        </span>
                                    </div>

                                    {/* Quinzena Permitida / Trava Corporativa de Ciclo */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                            Quinzena Permitida (Trava Corporativa):
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setFormQuinzenaPermitida('1_3')}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                                                    formQuinzenaPermitida === '1_3'
                                                        ? 'bg-purple-600 text-white border-purple-700 shadow-xs font-black ring-2 ring-purple-400/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Calendar className="w-4 h-4" />
                                                <span>📅 1 e 3 (Ímpares)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormQuinzenaPermitida('2_4')}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                                                    formQuinzenaPermitida === '2_4'
                                                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-black ring-2 ring-indigo-400/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <Calendar className="w-4 h-4" />
                                                <span>📅 2 e 4 (Pares)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setFormQuinzenaPermitida('QUALQUER')}
                                                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 border cursor-pointer ${
                                                    formQuinzenaPermitida === 'QUALQUER'
                                                        ? 'bg-slate-700 text-white border-slate-800 shadow-xs font-black ring-2 ring-slate-400/40'
                                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                <ClockIcon className="w-4 h-4" />
                                                <span>🔄 Qualquer / Livre</span>
                                            </button>
                                        </div>
                                        <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-1 block">
                                            {formQuinzenaPermitida === '1_3' && 'Fixa o cliente nas Semanas 1 e 3. O algoritmo de balanceamento não poderá movê-lo.'}
                                            {formQuinzenaPermitida === '2_4' && 'Fixa o cliente nas Semanas 2 e 4. O algoritmo de balanceamento não poderá movê-lo.'}
                                            {formQuinzenaPermitida === 'QUALQUER' && 'Ciclo livre: o balanceador aloca dinamicamente entre 1/3 ou 2/4 para otimizar o peso diário.'}
                                        </span>
                                    </div>
                                </div>

                                {/* Observação Operacional */}
                                <div>
                                    <label className="block text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                                        Observação / Restrição Operacional
                                    </label>
                                    <input
                                        type="text"
                                        value={formObservacao}
                                        onChange={(e) => setFormObservacao(e.target.value)}
                                        placeholder="Ex: Recebimento das 08h às 11h. Falar com o encarregado do depósito."
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Botão de Salvar no SQL Server */}
                                <div className="flex justify-end pt-1">
                                    <button
                                        type="button"
                                        onClick={handleSaveRestricao}
                                        disabled={savingRestricao || !formCodCliente}
                                        className="px-4 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        {savingRestricao ? (
                                            <>
                                                <SpinnerIcon className="w-4 h-4 animate-spin" />
                                                <span>Gravando no SQL Server...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>💾 {editingRestricaoId ? 'Atualizar Particularidade' : 'Gravar Particularidade'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Tabela de Particularidades Cadastradas */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                                            Particularidades Cadastradas
                                        </h4>
                                        <span className="text-[11px] font-bold text-slate-400">
                                            ({clienteRestricoes.length} total)
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Filtrar por código ou cliente..."
                                            value={restricaoSearch}
                                            onChange={(e) => setRestricaoSearch(e.target.value)}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1 text-xs font-medium outline-none w-52 text-slate-800 dark:text-white"
                                        />
                                        <select
                                            value={restricaoFilterTurno}
                                            onChange={(e) => setRestricaoFilterTurno(e.target.value as any)}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                                        >
                                            <option value="TODOS">Todos os Turnos</option>
                                            <option value="MANHA">🌅 Manhã</option>
                                            <option value="TARDE">🌇 Tarde</option>
                                            <option value="QUALQUER">⏰ Qualquer</option>
                                        </select>
                                        <select
                                            value={restricaoFilterOrigem}
                                            onChange={(e) => setRestricaoFilterOrigem(e.target.value as any)}
                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                                        >
                                            <option value="TODOS">Todas as Origens</option>
                                            <option value="SUPERVISOR">⚡ Críticas de Supervisores</option>
                                            <option value="MANUAL">✏️ Inserções Manuais</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                                    <table className="w-full text-left text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[9px] border-b border-slate-200 dark:border-slate-700">
                                            <tr>
                                                <th className="p-3">Código/SOLD</th>
                                                <th className="p-3">Cliente / Razão Social</th>
                                                <th className="p-3 text-center">Dias Permitidos</th>
                                                <th className="p-3 text-center">Turno</th>
                                                <th className="p-3 text-center">Quinzena</th>
                                                <th className="p-3">Observação & Auditoria</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {clienteRestricoes
                                                .filter(r => {
                                                    if (restricaoFilterTurno !== 'TODOS' && r.TurnoPermitido !== restricaoFilterTurno) return false;
                                                    const isSupervisorOrigem = (r.Observacao || '').includes('[Exceção via Crítica Supervisor]');
                                                    if (restricaoFilterOrigem === 'SUPERVISOR' && !isSupervisorOrigem) return false;
                                                    if (restricaoFilterOrigem === 'MANUAL' && isSupervisorOrigem) return false;
                                                    if (restricaoSearch) {
                                                        const term = restricaoSearch.toLowerCase();
                                                        const mCod = String(r.Cod_Cliente).includes(term);
                                                        const mRazao = (r.Razao_Social || '').toLowerCase().includes(term);
                                                        const mObs = (r.Observacao || '').toLowerCase().includes(term);
                                                        const mUser = (r.UsuarioAtualizacao || '').toLowerCase().includes(term);
                                                        if (!mCod && !mRazao && !mObs && !mUser) return false;
                                                    }
                                                    return true;
                                                })
                                                .map(r => {
                                                    const isSupervisorOrigem = (r.Observacao || '').includes('[Exceção via Crítica Supervisor]');
                                                    const cleanObs = (r.Observacao || '').replace('[Exceção via Crítica Supervisor]', '').trim();

                                                    return (
                                                        <tr key={r.ID_Restricao || r.Cod_Cliente} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                                                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span>#{r.Cod_Cliente}</span>
                                                                    {isSupervisorOrigem && (
                                                                        <span
                                                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8.5px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-800 uppercase tracking-tight shadow-xs cursor-help"
                                                                            title={`Origem: Crítica do Supervisor\nAprovada por: ${r.UsuarioAtualizacao || 'Analista'}${r.DataAtualizacao ? ` em ${new Date(r.DataAtualizacao).toLocaleString('pt-BR')}` : ''}`}
                                                                        >
                                                                            <span className="text-[10px]">⚡</span> Supervisor
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3 truncate max-w-[200px]" title={r.Razao_Social}>
                                                                {r.Razao_Social || '-'}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {r.DiasPermitidos ? (
                                                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                                                        {r.DiasPermitidos.split(',').map(d => (
                                                                            <span key={d} className="px-1.5 py-0.2 text-[9px] font-black rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                                                                                {d.trim().slice(0, 3).toUpperCase()}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 font-normal italic">Livre (todos os dias)</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {r.TurnoPermitido === 'MANHA' && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                                                        <Sun className="w-3 h-3" /> Manhã
                                                                    </span>
                                                                )}
                                                                {r.TurnoPermitido === 'TARDE' && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border border-orange-300">
                                                                        <Sunset className="w-3 h-3" /> Tarde
                                                                    </span>
                                                                )}
                                                                {(!r.TurnoPermitido || r.TurnoPermitido === 'QUALQUER') && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                        Qualquer
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {r.QuinzenaPermitida === '1_3' && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300">
                                                                        📅 1 e 3
                                                                    </span>
                                                                )}
                                                                {r.QuinzenaPermitida === '2_4' && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300">
                                                                        📅 2 e 4
                                                                    </span>
                                                                )}
                                                                {(!r.QuinzenaPermitida || r.QuinzenaPermitida === 'QUALQUER') && (
                                                                    <span className="text-[10px] text-slate-400 font-normal italic">
                                                                        Livre
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-[10px] text-slate-500 dark:text-slate-400">
                                                                <div className="truncate max-w-[220px]" title={cleanObs || r.Observacao || '-'}>
                                                                    {cleanObs || r.Observacao || '-'}
                                                                </div>
                                                                {isSupervisorOrigem && (
                                                                    <div className="text-[9px] text-purple-700 dark:text-purple-400 font-semibold mt-0.5 flex items-center gap-1">
                                                                        <span>Aprovado por: <strong>{r.UsuarioAtualizacao || 'Analista'}</strong></span>
                                                                        {r.DataAtualizacao && (
                                                                            <span className="text-slate-400 font-normal">
                                                                                ({new Date(r.DataAtualizacao).toLocaleDateString('pt-BR')})
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex items-center justify-center space-x-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingRestricaoId(r.ID_Restricao || r.Cod_Cliente);
                                                                        setFormCodCliente(String(r.Cod_Cliente));
                                                                        setFormRazaoSocial(r.Razao_Social || '');
                                                                        setFormDiasPermitidos(r.DiasPermitidos ? r.DiasPermitidos.split(',').map(s => s.trim()) : []);
                                                                        setFormTurnoPermitido((r.TurnoPermitido as any) || 'QUALQUER');
                                                                        setFormQuinzenaPermitida((r.QuinzenaPermitida as any) || 'QUALQUER');
                                                                        setFormObservacao(r.Observacao || '');
                                                                        setRestricaoSaveFeedback(null);
                                                                    }}
                                                                    className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-lg transition cursor-pointer"
                                                                    title="Editar Particularidade"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteRestricao(r.ID_Restricao || r.Cod_Cliente)}
                                                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                                                                    title="Excluir Particularidade"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {clienteRestricoes.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500">
                                                        <p className="font-bold text-xs">Nenhuma particularidade cadastrada ainda.</p>
                                                        <p className="text-[11px] mt-1">Utilize o formulário acima para cadastrar restrições de dias ou turnos por cliente.</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Faixa de Auditoria SQL Server */}
                        <div className="px-5 py-2.5 bg-slate-100/80 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center space-x-1.5">
                                <ClockIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>
                                    <strong className="font-bold text-slate-700 dark:text-slate-300">Auditoria no Banco:</strong>{' '}
                                    {lastRestricaoAudit?.usuario ? (
                                        <span>
                                            atualizado por <strong className="text-blue-600 dark:text-blue-400 font-bold">{lastRestricaoAudit.usuario}</strong> em{' '}
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                {lastRestricaoAudit.dataHora ? new Date(lastRestricaoAudit.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '-'}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="italic text-slate-400">Tabela FuelClienteRestricoes sincronizada</span>
                                    )}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                SQL Server Integrado
                            </span>
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                As janelas cadastradas são aplicadas automaticamente no cálculo e sequenciamento da rota.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRestricoesModal(false);
                                    setRestricaoSaveFeedback(null);
                                    setEditingRestricaoId(null);
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE AJUSTE DE COORDENADAS GPS */}
            {coordinateModalClient && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <LocationMarkerIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center">
                                        Ajustar Coordenadas GPS
                                        <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                            #{coordinateModalClient.Cod_Cliente}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Correção de Latitude e Longitude com recálculo instantâneo das rotas viárias OSRM.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseCoordinateModal}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Conteúdo do Modal com Scroll */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
                            {/* Cartão de Identificação do Cliente */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                                        {coordinateModalClient.Cod_Cliente} - {coordinateModalClient.Razao_Social}
                                    </h4>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                                        {formatSellerDisplayName(coordinateModalClient.Cod_Vend, coordinateModalClient.Nome_Vendedor)}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
                                    <p>📍 <strong className="font-semibold">Endereço:</strong> {coordinateModalClient.Endereco || 'Não informado'}</p>
                                    <p className="text-slate-500 dark:text-slate-400">
                                        {coordinateModalClient.Bairro ? `Bairro: ${coordinateModalClient.Bairro} • ` : ''}
                                        {coordinateModalClient.Cidade ? `Cidade: ${coordinateModalClient.Cidade} • ` : ''}
                                        {coordinateModalClient.CEP ? `CEP: ${coordinateModalClient.CEP}` : ''}
                                    </p>
                                </div>

                                {/* Alerta de Anomalia se houver */}
                                {(() => {
                                    const mColab = getColabBySectorOrName(coordinateModalClient.Cod_Vend, coordinateModalClient.Nome_Vendedor);
                                    const mCentroid = sellerCentroidsMap.get(coordinateModalClient.Cod_Vend);
                                    const mAnom = checkCoordinateAnomaly(coordinateModalClient, mColab?.LatitudeBase, mColab?.LongitudeBase, mCentroid);
                                    if (mAnom.isAnomalous && mAnom.distKm > 80) {
                                        return (
                                            <div className="mt-2 p-2.5 bg-red-100/80 dark:bg-red-950/80 border border-red-300 dark:border-red-700 rounded-xl text-red-800 dark:text-red-200 text-xs">
                                                <div className="font-black flex items-center gap-1.5">
                                                    <span>⚠️</span>
                                                    <span>Anomalia Geográfica Detectada: ~{mAnom.distKm} KM {mAnom.referenceType === 'base' ? 'da base residencial' : 'do centróide da rota'}!</span>
                                                </div>
                                                <p className="text-[11px] mt-0.5 opacity-90">
                                                    As coordenadas atuais no ERP apontam para uma região muito distante da área de atendimento. Insira as coordenadas corretas abaixo ou copie de um cliente vizinho.
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            {/* Campos de Latitude e Longitude com Botão de Geocodificação Automática */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <span>🌐</span>
                                        <span>Coordenadas Geográficas (GPS)</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGeocodeClientAddress}
                                        disabled={isGeocodingCoord}
                                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                    >
                                        {isGeocodingCoord ? (
                                            <>
                                                <SpinnerIcon className="w-3.5 h-3.5 animate-spin"/>
                                                <span>Buscando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <SearchIcon className="w-3.5 h-3.5"/>
                                                <span>Buscar por Endereço (Google/CEP)</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {coordGeocodeFeedback && (
                                    <div className={`p-2.5 rounded-xl text-xs font-medium border ${
                                        coordGeocodeFeedback.type === 'success'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                                    }`}>
                                        {coordGeocodeFeedback.message}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Latitude</span>
                                        <input
                                            type="text"
                                            value={coordModalLat}
                                            onChange={e => setCoordModalLat(e.target.value)}
                                            placeholder="-23.853215"
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                    <div>
                                        <span className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Longitude</span>
                                        <input
                                            type="text"
                                            value={coordModalLng}
                                            onChange={e => setCoordModalLng(e.target.value)}
                                            placeholder="-46.141528"
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Seção de Cópia de Vizinho */}
                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                        <span>🏘️</span>
                                        <span>Copiar Coordenadas de Cliente Vizinho</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {eligibleNeighbors.length} vizinhos sugeridos
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Selecione um cliente da mesma rua, bairro ou região para herdar instantaneamente a localização válida.
                                </p>

                                {/* Filtro de busca na lista de vizinhos */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={coordNeighborSearch}
                                        onChange={e => setCoordNeighborSearch(e.target.value)}
                                        placeholder="Filtrar por nome, rua, código ou bairro..."
                                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none pl-8"
                                    />
                                    <SearchIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5"/>
                                </div>

                                {/* Lista com scroll de vizinhos */}
                                <div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                                    {eligibleNeighbors.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-400">
                                            Nenhum cliente vizinho encontrado com coordenadas válidas.
                                        </div>
                                    ) : (
                                        eligibleNeighbors.map(n => {
                                            const isCurrentSelected = coordModalLat === String(n.Lat) && coordModalLng === String(n.Long);
                                            return (
                                                <div
                                                    key={`neighbor-${n.Cod_Cliente}`}
                                                    className="p-2.5 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800 transition text-xs"
                                                >
                                                    <div className="min-w-0 flex-1 pr-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-slate-800 dark:text-slate-100 truncate">
                                                                #{n.Cod_Cliente} - {n.Razao_Social}
                                                            </span>
                                                            {n.Endereco && coordinateModalClient.Endereco && n.Endereco.toLowerCase().split(' ')[0] === coordinateModalClient.Endereco.toLowerCase().split(' ')[0] && (
                                                                <span className="text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded shrink-0">
                                                                    Mesma Rua
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                            {n.Endereco}{n.Bairro ? ` • ${n.Bairro}` : ''}{n.Cidade ? ` • ${n.Cidade}` : ''}
                                                        </p>
                                                        <p className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                                            Lat: {n.Lat} | Long: {n.Long}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCoordModalLat(String(n.Lat));
                                                            setCoordModalLng(String(n.Long));
                                                            setCoordGeocodeFeedback({
                                                                type: 'success',
                                                                message: `Coordenadas copiadas do cliente #${n.Cod_Cliente} (${n.Razao_Social})`
                                                            });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
                                                            isCurrentSelected
                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                                        }`}
                                                    >
                                                        {isCurrentSelected ? '✓ Coordenadas Aplicadas' : 'Copiar Coordenadas'}
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                O recálculo de itinerário e circuito OSRM é instantâneo ao salvar.
                            </span>
                            <div className="flex items-center space-x-2 self-end">
                                <button
                                    type="button"
                                    onClick={handleCloseCoordinateModal}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCoordinates}
                                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                                >
                                    <span>💾 Salvar e Recalcular Rota</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE TRATAMENTO DE CAPACIDADE EXCEDIDA / TEMPO LIMITE NA OTIMIZAÇÃO */}
            {showCapacityModal && capacityOverflowData && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 lg:p-6 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-5 border-b border-amber-100 dark:border-amber-950/40 flex items-center justify-between bg-amber-50/60 dark:bg-amber-950/30">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                                    <ExclamationIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Atenção: Capacidade de Atendimento Excedida
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        A demanda de visitas supera os parâmetros de jornada e limite diário configurados.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCapacityModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Conteúdo */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1 text-slate-700 dark:text-slate-300">
                            {/* Card de Métricas de Estouro */}
                            <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-xs">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Jornada Configurada</div>
                                        <div className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                            {capacityOverflowData.configuredHours}h <span className="text-xs font-normal text-slate-400">/ dia</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-amber-100 dark:border-amber-900/30 shadow-xs">
                                        <div className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Jornada Necessária</div>
                                        <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                                            ~{capacityOverflowData.neededHoursPerDay.toFixed(1)}h <span className="text-xs font-normal text-slate-400">/ dia</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-red-100 dark:border-red-900/30 shadow-xs">
                                        <div className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">Clientes Excedentes</div>
                                        <div className="text-lg font-black text-red-600 dark:text-red-400 mt-0.5">
                                            {capacityOverflowData.overflowCount} PDVs
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detalhamento por Vendedor / Setor */}
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                    Vendedores com Demanda Superior à Capacidade:
                                </div>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    {capacityOverflowData.sellersSummary.map(s => (
                                        <div key={s.sellerId} className="p-2.5 px-3 flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-800/30">
                                            <div>
                                                <span className="font-bold text-slate-800 dark:text-white">{s.sellerName}</span>
                                                <span className="text-slate-400 ml-1.5">(#{s.sellerId})</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-500 dark:text-slate-400">
                                                    Total: <strong>{s.totalClients}</strong> clientes | Capacidade: <strong>{s.capacity}</strong>
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                    +{s.overflow} excedentes
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Explicação da Escolha */}
                            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs leading-relaxed space-y-1">
                                <p className="font-bold text-slate-800 dark:text-slate-200">
                                    Como deseja proceder com a roteirização?
                                </p>
                                <p className="text-slate-600 dark:text-slate-400">
                                    • <strong className="text-indigo-600 dark:text-indigo-400">Flexibilizar Tempo:</strong> Otimiza a carteira completa acomodando 100% dos clientes nos dias disponíveis, mantendo microrregiões contíguas e aumentando suavemente a jornada.
                                </p>
                                <p className="text-slate-600 dark:text-slate-400">
                                    • <strong className="text-red-600 dark:text-red-400">Respeitar Limite Estrito:</strong> Preenche cada dia estritamente até a capacidade máxima de {capacityOverflowData.configuredHours}h. Os clientes que excederem o limite ficarão com status <strong>"SEM ATENDIMENTO"</strong> agrupados para tratamento manual posterior.
                                </p>
                            </div>
                        </div>

                        {/* Footer de Ações */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setShowCapacityModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer order-last sm:order-first"
                            >
                                Cancelar
                            </button>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const sellers = capacityOverflowData.sellers;
                                        setShowCapacityModal(false);
                                        await runOptimizationForSellers(sellers, adjustedRoutes, false, {
                                            title: 'Otimização Concluída com Limite Estrito',
                                            escopoDesc: `Limite rigoroso de ${capacityOverflowData.configuredHours}h respeitado`,
                                            mode: 'strict',
                                            hoursLimit: capacityOverflowData.configuredHours
                                        });
                                    }}
                                    className="px-4 py-2.5 rounded-xl text-xs font-black text-red-700 dark:text-red-300 bg-red-100 hover:bg-red-200 dark:bg-red-950/70 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-800 transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                                >
                                    <span>🚫 Respeitar Limite Estrito (Deixar Excedentes)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={async () => {
                                        const sellers = capacityOverflowData.sellers;
                                        setShowCapacityModal(false);
                                        await runOptimizationForSellers(sellers, adjustedRoutes, true, {
                                            title: 'Otimização Concluída Flexibilizando Tempo',
                                            escopoDesc: 'Todos os clientes atendidos com flexibilização de jornada',
                                            mode: 'flexibilize',
                                            hoursLimit: capacityOverflowData.configuredHours
                                        });
                                    }}
                                    className="px-4 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                                >
                                    <span>⏰ Flexibilizar Tempo (Atender Todos)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE SUGESTÃO AUTOMÁTICA DE TROCA DE DIA E REEQUILÍBRIO DE CARGA */}
            {rebalanceDay && rebalanceData && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in zoom-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <ClockIcon className="w-5 h-5"/>
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Reequilíbrio de Carga: {rebalanceData.sourceDay}
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                            rebalanceData.isSourceInactive
                                                ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                                : (rebalanceData.sourceExcessMin >= 60 
                                                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' 
                                                    : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800')
                                        }`}>
                                            {rebalanceData.isSourceInactive ? '🚨 Dia Fora da Jornada' : (rebalanceData.sourceExcessMin >= 60 ? '🚨 Sobrecarga' : '⚠️ Atenção')}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {rebalanceData.isSourceInactive 
                                            ? `O colaborador não trabalha em ${rebalanceData.sourceDay}. Realize a evacuação de clientes para os dias úteis ativos.`
                                            : 'Diagnóstico de jornada e remanejamento inteligente entre dias da semana.'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setRebalanceDay(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Corpo do Modal com Scroll */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-5 text-slate-700 dark:text-slate-300">
                            {/* 1. Diagnóstico do Dia */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                                    <div className="text-[10px] font-black uppercase text-slate-400">Jornada Estimada</div>
                                    <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                        {formatDuration(rebalanceData.sourceMaxTime)}
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                                    <div className="text-[10px] font-black uppercase text-slate-400">Teto Configurado</div>
                                    <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                        {rebalanceData.isSourceInactive ? '0h (Sem Expediente)' : `${rebalanceData.sourceLimitHours}h / dia`}
                                    </div>
                                </div>
                                <div className="p-3 bg-red-50/80 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-800/50">
                                    <div className="text-[10px] font-black uppercase text-red-500">
                                        {rebalanceData.isSourceInactive ? 'Carga a Evacuar' : 'Excesso de Carga'}
                                    </div>
                                    <div className="text-base font-black text-red-600 dark:text-red-400 mt-0.5">
                                        +{Math.floor(rebalanceData.sourceExcessMin / 60)}h {Math.round(rebalanceData.sourceExcessMin % 60)}m
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                                    <div className="text-[10px] font-black uppercase text-slate-400">PDVs no Dia</div>
                                    <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-0.5">
                                        {rebalanceData.uniqueClients.length} clientes
                                    </div>
                                </div>
                            </div>

                            {/* 2. Análise de Ociosidade dos Dias Receptores */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Dias da Semana com Capacidade Ociosa:
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        Selecione um dia receptor para remanejamento
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {rebalanceData.otherDays.map(d => {
                                        const isSelected = targetRebalanceDay === d.day;
                                        const isBest = rebalanceData.bestTargetDay?.day === d.day;

                                        return (
                                            <div 
                                                key={d.day}
                                                onClick={() => setTargetRebalanceDay(d.day)}
                                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                                                    isSelected 
                                                        ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs' 
                                                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
                                                }`}
                                            >
                                                <div className="flex items-center space-x-2.5 min-w-0">
                                                    <span 
                                                        className="px-2 py-0.5 rounded-lg text-[10px] font-black text-white shrink-0 uppercase"
                                                        style={{ backgroundColor: d.dayCfg.hex }}
                                                    >
                                                        {d.day.split('-')[0]}
                                                    </span>
                                                    <div className="truncate">
                                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                                                            <span>{d.day}</span>
                                                            {isBest && (
                                                                <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
                                                                    Mais Ocioso
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                                            Carga: {formatDuration(d.maxTime)} • {d.pdvsCount} PDVs
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    {d.status === 'high' ? (
                                                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                                                            +{Math.floor(d.freeMinutes / 60)}h{d.freeMinutes % 60 > 0 ? ` ${d.freeMinutes % 60}m` : ''} livres
                                                        </span>
                                                    ) : d.status === 'medium' ? (
                                                        <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                                            +{d.freeMinutes}m livres
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                                            Sem folga
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 3. Ação Principal: Reequilíbrio Automático (1 Clique) */}
                            {rebalanceData.bestTargetDay && (
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/50 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                                                <span>⚡</span> {rebalanceData.isSourceInactive ? 'Evacuação Automática para Dia Útil' : 'Sugestão de Reequilíbrio Automático'}
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                                {rebalanceData.isSourceInactive 
                                                    ? <>Transfere todos os clientes de <strong>{rebalanceData.sourceDay}</strong> (dia sem expediente) para o dia útil ativo com maior folga (<strong>{rebalanceData.bestTargetDay.day}</strong>, com +{Math.floor(rebalanceData.bestTargetDay.freeMinutes / 60)}h {rebalanceData.bestTargetDay.freeMinutes % 60}m disponíveis), liberando o dia de folga do colaborador.</>
                                                    : <>Transfere automaticamente clientes excedentes de <strong>{rebalanceData.sourceDay}</strong> para o dia com maior folga (<strong>{rebalanceData.bestTargetDay.day}</strong>, com +{Math.floor(rebalanceData.bestTargetDay.freeMinutes / 60)}h {rebalanceData.bestTargetDay.freeMinutes % 60}m disponíveis), ajustando a jornada para a meta legal.</>
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAutoRebalance}
                                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] shadow-md shadow-indigo-600/20 transition flex items-center justify-center space-x-2 cursor-pointer"
                                    >
                                        <span>{rebalanceData.isSourceInactive ? '⚡ Evacuar Dia Inativo com 1 Clique' : '⚡ Reequilibrar Automaticamente com 1 Clique'}</span>
                                        <span>➔</span>
                                    </button>
                                </div>
                            )}

                            {/* 4. Remanejamento Manual: Seleção de Clientes */}
                            <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        Ou Selecione Manualmente os Clientes a Mover:
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedRebalanceClients.size === rebalanceData.uniqueClients.length) {
                                                    setSelectedRebalanceClients(new Set());
                                                } else {
                                                    setSelectedRebalanceClients(new Set(rebalanceData.uniqueClients.map(c => c.Cod_Cliente)));
                                                }
                                            }}
                                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                        >
                                            {selectedRebalanceClients.size === rebalanceData.uniqueClients.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                        </button>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            ({selectedRebalanceClients.size} selecionados)
                                        </span>
                                    </div>
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {rebalanceData.uniqueClients.map(client => {
                                        const isChecked = selectedRebalanceClients.has(client.Cod_Cliente);
                                        const estService = getClientServiceTime(client);

                                        return (
                                            <div 
                                                key={client.Cod_Cliente}
                                                onClick={() => {
                                                    setSelectedRebalanceClients(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(client.Cod_Cliente)) next.delete(client.Cod_Cliente);
                                                        else next.add(client.Cod_Cliente);
                                                        return next;
                                                    });
                                                }}
                                                className={`p-2.5 flex items-center justify-between gap-3 text-xs transition cursor-pointer select-none ${
                                                    isChecked ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                }`}
                                            >
                                                <div className="flex items-center space-x-2.5 min-w-0">
                                                    <input 
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}} // handled by row
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                                                    />
                                                    <div className="min-w-0 truncate">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                                                            <span className="font-mono text-slate-400 text-[10px]">#{client.Cod_Cliente}</span>
                                                            <span className="truncate">{client.Razao_Social}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate">
                                                            {client.Bairro ? `${client.Bairro}` : ''}{client.Cidade ? ` • ${client.Cidade}` : ''} ({client.Periodicidade || 'Semanal'})
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        ~{estService}m em loja
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {selectedRebalanceClients.size > 0 && (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Destino selecionado: <strong>{targetRebalanceDay || 'Nenhum dia escolhido acima'}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            disabled={!targetRebalanceDay}
                                            onClick={handleManualRebalanceApply}
                                            className={`px-4 py-2 rounded-xl text-xs font-black text-white transition flex items-center justify-center space-x-1.5 ${
                                                targetRebalanceDay 
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95' 
                                                    : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-60'
                                            }`}
                                        >
                                            <span>Mover {selectedRebalanceClients.size} {selectedRebalanceClients.size === 1 ? 'Cliente' : 'Clientes'} para {targetRebalanceDay || '...'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Ao mover clientes, os circuitos viários e tempos OSRM são recalculados instantaneamente.
                            </span>
                            <button
                                type="button"
                                onClick={() => setRebalanceDay(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST FLOATING FEEDBACK DE REEQUILÍBRIO */}
            {rebalanceToast && (
                <div className="fixed bottom-6 right-6 z-[3000] bg-emerald-600 text-white font-bold px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500 flex items-center space-x-2 animate-in slide-in-from-bottom-5 duration-300 max-w-md">
                    <CheckCircleIcon className="w-5 h-5 text-white shrink-0" />
                    <span className="text-xs">{rebalanceToast}</span>
                    <button 
                        type="button" 
                        onClick={() => setRebalanceToast(null)} 
                        className="ml-2 text-white/80 hover:text-white font-black p-1"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* MODAL DE COMPARTILHAMENTO DE LINK COM SUPERVISOR */}
            {shareModalData && (
                <ShareSimulationModal
                    isOpen={shareModalData.isOpen}
                    onClose={() => setShareModalData(null)}
                    simId={shareModalData.simId}
                    periodo={shareModalData.periodo}
                    totalKm={shareModalData.totalKm}
                />
            )}

            {/* MODAL PARA SALVAR SIMULAÇÃO COM NOME PERSONALIZADO */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                    <CheckCircleIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                                        Salvar Simulação de Rota
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Defina um nome e detalhes para identificação
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSaveModal(false)}
                                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                            >
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-center">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">KM Total</span>
                                    <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                        {Math.round((operationalSummary.totalKm13 + operationalSummary.totalKm24) > 0 ? ((operationalSummary.totalKm13 + operationalSummary.totalKm24) / 2) : kpis.adjusted.totalKm).toLocaleString('pt-BR')} km
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Visitas no Escopo</span>
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                        {effectiveScopedRoutes.length}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Equipe</span>
                                    <p className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase mt-0.5">
                                        {teamType}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Nome da Simulação <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={simSaveName}
                                    onChange={(e) => setSimSaveName(e.target.value)}
                                    placeholder="Ex: Rota Vale do Paraíba - Quinzena 1"
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                    autoFocus
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Utilize um nome descritivo para facilitar buscas futuras e identificação pela supervisão.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Descrição / Observações (Opcional)
                                </label>
                                <textarea
                                    value={simSaveDesc}
                                    onChange={(e) => setSimSaveDesc(e.target.value)}
                                    placeholder="Ex: Reajustada sequência de quarta-feira e realocados clientes periféricos."
                                    rows={3}
                                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition resize-none"
                                />
                            </div>

                            {loadedSimInfo && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between">
                                    <div className="text-xs text-amber-800 dark:text-amber-200">
                                        <span className="font-bold">Substituir Simulação Atual?</span>
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                            Atualizará o registro #{loadedSimInfo.id} ({loadedSimInfo.name}) em vez de criar um novo.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer ml-3">
                                        <input
                                            type="checkbox"
                                            checked={simSaveOverwrite}
                                            onChange={(e) => setSimSaveOverwrite(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3 bg-slate-50/50 dark:bg-slate-800/30">
                            <button
                                type="button"
                                onClick={() => setShowSaveModal(false)}
                                disabled={saving}
                                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSave}
                                disabled={saving || !simSaveName.trim()}
                                className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer"
                            >
                                {saving ? (
                                    <>
                                        <SpinnerIcon className="w-4 h-4 animate-spin mr-1.5" />
                                        <span>Salvando Simulação...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-1.5" />
                                        <span>{simSaveOverwrite && loadedSimInfo ? 'Atualizar Simulação' : 'Salvar Simulação'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE GESTÃO DE SIMULAÇÕES SALVAS */}
            {showSavedSimulationsModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9990] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in-50 zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <FolderOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        Simulações de Ajuste de Rota Salvas
                                        <span className="text-xs font-normal text-slate-500 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                            {savedSimulationsList.length}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Visualize no mapa, reabra na grade, exclua ou gere links de conferência de rotas
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSavedSimulationsModal(false)}
                                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                            >
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 shrink-0">
                            <div className="relative">
                                <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={simSearchTerm}
                                    onChange={(e) => setSimSearchTerm(e.target.value)}
                                    placeholder="Buscar por nome da simulação, descrição, usuário ou data..."
                                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {loadingSavedSimulations ? (
                                <div className="py-20 text-center text-slate-400">
                                    <SpinnerIcon className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-600" />
                                    <p className="text-xs font-bold">Carregando simulações salvas...</p>
                                </div>
                            ) : filteredSimulations.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                                    <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm font-bold">Nenhuma simulação encontrada.</p>
                                    <p className="text-xs mt-1">Gere um ajuste de rota e clique em "Salvar Simulação" para cadastrar.</p>
                                </div>
                            ) : (
                                filteredSimulations.map((sim: any) => {
                                    const isCurrent = loadedSimInfo?.id === sim.ID_RotaHist;
                                    const isVendedor = sim.Periodo?.includes('[VENDEDOR]');
                                    const isPromotor = sim.Periodo?.includes('[PROMOTOR]');
                                    const cleanName = sim.Periodo ? sim.Periodo.replace('[VENDEDOR]', '').replace('[PROMOTOR]', '').trim() : `Simulação #${sim.ID_RotaHist}`;
                                    const isLoadingThis = loadingSimId === sim.ID_RotaHist;
                                    const isDeletingThis = deletingSimId === sim.ID_RotaHist;

                                    return (
                                        <div
                                            key={sim.ID_RotaHist}
                                            className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                                isCurrent
                                                    ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 shadow-xs'
                                                    : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {isVendedor && (
                                                        <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                                                            Vendedor
                                                        </span>
                                                    )}
                                                    {isPromotor && (
                                                        <span className="bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-black px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 uppercase tracking-wider">
                                                            Promotor
                                                        </span>
                                                    )}
                                                    {isCurrent && (
                                                        <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                                                            Ativa no Mapa
                                                        </span>
                                                    )}
                                                    {Number(sim.SugestoesPendentes) > 0 && (
                                                        <span className="bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700 uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                                            ⚠️ {sim.SugestoesPendentes} crítica{Number(sim.SugestoesPendentes) > 1 ? 's' : ''} pendente{Number(sim.SugestoesPendentes) > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                                        {cleanName}
                                                    </h4>
                                                </div>

                                                {sim.Descricao && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                                                        "{sim.Descricao}"
                                                    </p>
                                                )}

                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-medium">
                                                    <span>📅 {sim.DataSimulacao ? new Date(sim.DataSimulacao).toLocaleString('pt-BR') : '-'}</span>
                                                    <span>👤 {sim.UsuarioSimulacao || 'Operador'}</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                        🚗 {Math.round(Number(sim.TotalKM) || 0).toLocaleString('pt-BR')} km
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {Number(sim.TotalSugestoes) > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenSimCriticas(sim.ID_RotaHist, cleanName)}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center transition cursor-pointer ${
                                                            Number(sim.SugestoesPendentes) > 0
                                                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs animate-pulse'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200'
                                                        }`}
                                                        title="Visualizar críticas e sugestões enviadas pelo supervisor para esta rota"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                                                        Críticas
                                                        {Number(sim.SugestoesPendentes) > 0 && (
                                                            <span className="ml-1.5 bg-white text-amber-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                                                {sim.SugestoesPendentes}
                                                            </span>
                                                        )}
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => handleLoadSimulation(sim.ID_RotaHist)}
                                                    disabled={isLoadingThis}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center shadow-xs transition disabled:opacity-50 cursor-pointer"
                                                    title="Carregar roteiro completo no mapa e na grade para visualização e edição"
                                                >
                                                    {isLoadingThis ? (
                                                        <SpinnerIcon className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                                    ) : (
                                                        <LocationMarkerIcon className="w-3.5 h-3.5 mr-1.5" />
                                                    )}
                                                    Abrir no Mapa / Editar
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShareModalData({
                                                            isOpen: true,
                                                            simId: sim.ID_RotaHist,
                                                            periodo: sim.Periodo,
                                                            totalKm: Number(sim.TotalKM) || 0
                                                        });
                                                    }}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold p-2 rounded-xl text-xs flex items-center transition cursor-pointer"
                                                    title="Copiar Link de Conferência para o Supervisor ou Enviar por WhatsApp"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSavedSimulation(sim.ID_RotaHist, sim.Periodo || `Simulação #${sim.ID_RotaHist}`)}
                                                    disabled={isDeletingThis || sim.JaCalculado}
                                                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition disabled:opacity-30 cursor-pointer"
                                                    title={sim.JaCalculado ? "Bloqueado: já vinculado a cálculo fechado" : "Excluir simulação permanentemente"}
                                                >
                                                    {isDeletingThis ? (
                                                        <SpinnerIcon className="w-4 h-4 animate-spin text-red-600" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 shrink-0">
                            <span>Total de {filteredSimulations.length} simulações</span>
                            <button
                                type="button"
                                onClick={() => setShowSavedSimulationsModal(false)}
                                className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Críticas e Sugestões do Supervisor no Ajuste de Rota */}
            {viewingCriticasSim && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9995] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 rounded-t-2xl">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                                    Críticas e Sugestões do Supervisor
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Simulação #{viewingCriticasSim.id} &bull; {viewingCriticasSim.nome}
                                </p>
                            </div>
                            <button 
                                onClick={() => setViewingCriticasSim(null)} 
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            >
                                <XCircleIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-4 flex-1">
                            {loadingCriticas ? (
                                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                                    <SpinnerIcon className="w-8 h-8 mx-auto mb-2 text-indigo-500 animate-spin" />
                                    Carregando críticas dos supervisores...
                                </div>
                            ) : criticasSimList.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-medium text-sm">Nenhum apontamento ou sugestão registrada para esta simulação.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {criticasSimList.map((sug: any) => {
                                        const isPendente = (sug.Status || 'PENDENTE') === 'PENDENTE';
                                        const isAplicado = sug.Status === 'APLICADO';
                                        const isRejeitado = sug.Status === 'REJEITADO';

                                        return (
                                            <div 
                                                key={sug.ID_Sugestao} 
                                                className={`p-4 rounded-2xl border transition-all ${
                                                    isAplicado ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 shadow-xs' :
                                                    isRejeitado ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 opacity-60' :
                                                    'bg-slate-50/70 dark:bg-slate-800/90 border-amber-300 dark:border-amber-700/80 shadow-sm ring-1 ring-amber-400/20'
                                                }`}
                                            >
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/80 dark:border-slate-700/80">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                                                            {sug.SupervisorNome || 'Supervisor'}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            ({sug.DataSugestao ? new Date(sug.DataSugestao).toLocaleString('pt-BR') : '-'})
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                            isAplicado ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' :
                                                            isRejeitado ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400' :
                                                            'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 animate-pulse'
                                                        }`}>
                                                            {sug.Status || 'PENDENTE'}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            disabled={actionLoadingId === sug.ID_Sugestao}
                                                            onClick={() => handleUpdateCriticaStatus(sug.ID_Sugestao, 'APLICADO')}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                isAplicado 
                                                                    ? 'bg-emerald-600 text-white shadow-xs' 
                                                                    : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                                            }`}
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                            {isAplicado ? 'Aplicado' : 'Marcar Aplicado'}
                                                        </button>
                                                        <button
                                                            disabled={actionLoadingId === sug.ID_Sugestao}
                                                            onClick={() => handleUpdateCriticaStatus(sug.ID_Sugestao, 'REJEITADO')}
                                                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                                                isRejeitado 
                                                                    ? 'bg-slate-600 text-white shadow-xs' 
                                                                    : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            ✕ {isRejeitado ? 'Rejeitado' : 'Rejeitar'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-2">
                                                    <div>
                                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Cliente: </span>
                                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                                            {sug.Cod_Cliente ? `#${sug.Cod_Cliente} - ` : ''}{sug.ClienteNome || 'Geral do Setor'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-500 dark:text-slate-400 font-medium">Vendedor: </span>
                                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                            {sug.VendedorNome || '-'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {(sug.DiaAtual || sug.DiaSugerido || sug.SemanaAtual || sug.SemanaSugerida) && (
                                                    <div className="flex items-center gap-3 text-xs bg-white dark:bg-slate-900/80 p-2.5 rounded-xl mb-2 border border-slate-200 dark:border-slate-700/70 text-slate-800 dark:text-slate-200">
                                                        {sug.DiaSugerido && (
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">Dia: </span>
                                                                <span className="line-through text-slate-400 mr-1">{sug.DiaAtual || 'Não inf.'}</span>
                                                                <span className="font-bold text-blue-600 dark:text-blue-400">&rarr; {sug.DiaSugerido}</span>
                                                            </div>
                                                        )}
                                                        {sug.SemanaSugerida && (
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">Semana: </span>
                                                                <span className="line-through text-slate-400 mr-1">{sug.SemanaAtual || 'Não inf.'}</span>
                                                                <span className="font-bold text-purple-600 dark:text-purple-400">&rarr; {sug.SemanaSugerida}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="text-xs text-slate-800 dark:text-slate-100 bg-amber-50/80 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
                                                    <p className="font-medium leading-relaxed">{sug.Observacao}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
                            <button
                                onClick={() => setViewingCriticasSim(null)}
                                className="px-5 py-2 font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer text-xs"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {criticaToast && (
                <div className="fixed bottom-6 right-6 z-[99999] max-w-md bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/30 animate-in fade-in slide-in-from-bottom-5 duration-300">
                    <span className="text-xl">⚡</span>
                    <span className="text-sm font-semibold tracking-wide leading-snug">{criticaToast}</span>
                    <button
                        onClick={() => setCriticaToast(null)}
                        className="ml-auto text-emerald-200 hover:text-white p-1 rounded-lg transition text-xs font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
};
