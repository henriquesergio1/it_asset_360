
import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { DataContext } from './context/DataContext';
import { getVisitasPrevistas, getCurrentMode, getOSRMData, getPromoterClients } from './services/apiService';
import { VisitaPrevista, Colaborador } from './types';
import { SYSTEM_VERSION } from './constants';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { PresentationChartLineIcon, SpinnerIcon, UploadIcon, LocationMarkerIcon, SearchIcon, ArrowRightIcon, RefreshIcon, ChevronDownIcon, CheckCircleIcon, ExclamationIcon, UserGroupIcon, EyeIcon, CogIcon, ClockIcon, GlobeIcon, ClipboardListIcon, TruckIcon } from './icons';

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

// --- ICONS ---
const pinClient = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const pinClientRoteiro = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Pin Verde para Auditados
const pinAudited = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Pin Amarelo Grande para Destaque (Hover)
const pinHighlight = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [35, 57], // Maior que o normal
    iconAnchor: [17, 57],
    popupAnchor: [1, -50],
    shadowSize: [50, 50],
    className: 'z-50' // Tenta forçar Z-index via classe se possível, mas Leaflet usa zIndexOffset
});

const pinSupervisorStart = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // User/Car Icon
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
});

// --- HELPER TYPES ---
interface ActualPoint {
    lat: number;
    lng: number;
    time: string;
    address: string;
    timestamp: number;
    id_pulsus: number;
    dateIso: string;
    km_row?: number; 
}

interface TimelineEvent {
    id: string; // Unique ID for interaction
    time: string;
    endTime?: string;
    durationMinutes?: number;
    type: 'START' | 'AUDIT' | 'END';
    description: string;
    details: string; // Vendedor / Responsável
    address?: string; // Novo: Endereço na Timeline
    subordinate?: string;
    coord?: [number, number];
    originalPoint?: VisitaPrevista;
}

// --- HELPER COMPONENT: MAP CONTROLLER (Para FlyTo e Interatividade) ---
const MapController: React.FC<{ 
    focusCoord: [number, number] | null; 
    zoom?: number;
}> = ({ focusCoord, zoom = 16 }) => {
    const map = useMap();
    useEffect(() => {
        if (focusCoord) {
            map.flyTo(focusCoord, zoom, { duration: 1.5 });
        }
    }, [focusCoord, map, zoom]);
    return null;
};

// --- HELPER GEOMETRY ---
const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Returns meters
};

const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const cleanStr = dateStr.replace(/["']/g, '').trim();
    const datePart = cleanStr.split(' ')[0];
    if (datePart.includes('/')) {
        const parts = datePart.split('/');
        if (parts.length === 3) {
            let year = parts[2];
            if (year.length === 2) year = '20' + year;
            return `${year}-${parts[1]}-${parts[0]}`;
        }
    }
    if (datePart.includes('T')) return datePart.split('T')[0];
    if (datePart.includes('-')) return datePart;
    return datePart;
};

const MapAutoFit: React.FC<{ bounds: L.LatLngBoundsExpression }> = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
    }, [bounds]);
    return null;
};

// --- OSRM API HELPER (Simplificado para Trajeto Real) ---
const fetchRouteGeometry = async (points: ActualPoint[]): Promise<[number, number][] | null> => {
    if (points.length < 2) return null;

    // Amostragem inteligente: OSRM aceita ~100 pontos na URL.
    // O CSV pode ter 1000. Vamos pegar pontos a cada X metros ou limitar a ~100 waypoints distribuídos.
    const step = Math.ceil(points.length / 100); // AUMENTADO PARA 100 POIS O SERVIDOR É LOCAL
    const sampledPoints = points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0);

    const SERVER_IP = "10.10.10.10";
    const coordsString = sampledPoints.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `http://${SERVER_IP}:5000/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            // OSRM retorna [lng, lat], Leaflet precisa de [lat, lng]
            return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);
        }
    } catch (e) {
        console.warn("Falha ao calcular rota real OSRM:", e);
    }
    return null;
};

// --- CUSTOM SEARCHABLE SELECT ---
const SearchableSelect: React.FC<{
    options: { id: string, label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}> = ({ options, value, onChange, placeholder = "Selecione...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    useEffect(() => { if (isOpen) setSearchTerm(''); }, [isOpen]);

    const filteredOptions = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(lower) || o.id.includes(lower));
    }, [options, searchTerm]);

    const selectedLabel = options.find(o => o.id === value)?.label || placeholder;

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                className={`w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="truncate font-bold text-slate-700">{value ? selectedLabel : <span className="text-slate-400 font-normal">{placeholder}</span>}</span>
                <ChevronDownIcon className="w-4 h-4 text-slate-400 ml-2"/>
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                        <div className="relative">
                            <SearchIcon className="absolute left-2.5 top-2.5 w-3 h-3 text-slate-400"/>
                            <input 
                                type="text" 
                                autoFocus
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded pl-8 pr-2 py-1 text-xs outline-none focus:border-blue-500"
                                placeholder="Filtrar..."
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">Sem resultados</div>
                        ) : (
                            filteredOptions.map(opt => (
                                <div 
                                    key={opt.id} 
                                    onClick={() => { onChange(opt.id); setIsOpen(false); }}
                                    className={`p-2 text-xs cursor-pointer hover:bg-blue-50 border-b border-slate-50 last:border-0 ${value === opt.id ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-600'}`}
                                >
                                    {opt.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const PrevistoVsRealizado: React.FC = () => {
    const { colaboradores } = useContext(DataContext);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Dados Brutos da API (Todos os roteiros do dia)
    const [allPlannedData, setAllPlannedData] = useState<VisitaPrevista[]>([]);
    
    // Dados Brutos do CSV (Rastro do Supervisor)
    const [fullCsvData, setFullCsvData] = useState<ActualPoint[]>([]);
    
    // Filtro: Supervisor Selecionado (ID do ERP/Roteirizador)
    const [selectedSupervisorCode, setSelectedSupervisorCode] = useState<string>('');
    
    // Configurações de Auditoria
    const [auditRadius, setAuditRadius] = useState<number>(100); // Default 100m
    const [minStayTime, setMinStayTime] = useState<number>(5); // Default 5 min
    const [useRealRoute, setUseRealRoute] = useState(true); // Toggle para API OSRM
    const [showNonVisited, setShowNonVisited] = useState(true); // Toggle Clientes Não Visitados
    
    // Dados Processados para Exibição
    const [teamVisits, setTeamVisits] = useState<VisitaPrevista[]>([]);
    const [supervisorRoute, setSupervisorRoute] = useState<ActualPoint[]>([]);
    const [osrmGeometry, setOsrmGeometry] = useState<[number, number][] | null>(null);
    
    // Interatividade
    const [focusedCoord, setFocusedCoord] = useState<[number, number] | null>(null);
    const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
    
    // KPIs
    const [kmAudited, setKmAudited] = useState(0);
    const [clientsAudited, setClientsAudited] = useState(0);
    
    // NOVO: Navegação por abas
    const [activeTab, setActiveTab] = useState<'auditoria' | 'roteirizador'>('auditoria');
    
    // NOVO: Estados para Roteirização em Massa
    const [roteiroManualData, setRoteiroManualData] = useState<VisitaPrevista[]>([]);
    const [bulkRoutes, setBulkRoutes] = useState<{ id: string, color: string, points: [number, number][], distance?: number }[]>([]);
    const [selectedPromoterForRoute, setSelectedPromoterForRoute] = useState<string>('ALL');
    const [promoterSearchTerm, setPromoterSearchTerm] = useState('');
    const [promoterTeamFilter, setPromoterTeamFilter] = useState<'ALL' | '100' | '200'>('ALL');
    
    // NOVO: Mapping manual
    const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
    const [nameMappings, setNameMappings] = useState<Record<string, number>>({});
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [pendingParsedData, setPendingParsedData] = useState<VisitaPrevista[]>([]);
    
    // NOVO: Optimizer
    const [isOptimizerModalOpen, setIsOptimizerModalOpen] = useState(false);
    const [optMaxClients, setOptMaxClients] = useState(15);
    const [optMaxKm, setOptMaxKm] = useState(50);
    const [optDays, setOptDays] = useState<string[]>(['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO']);
    
    const [loading, setLoading] = useState(false);
    const [calculatingRoute, setCalculatingRoute] = useState(false);
    const [insights, setInsights] = useState<TimelineEvent[]>([]);
    const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
    const isMock = getCurrentMode() === 'MOCK';

    // 1. Carregar Roteiros do Dia
    const loadAllPlanned = async () => {
        setLoading(true);
        try {
            const data = await getVisitasPrevistas(date, date);
            setAllPlannedData(data);
            
            // Reset states
            setSelectedSupervisorCode('');
            setSupervisorRoute([]);
            setInsights([]);
            setKmAudited(0);
            setClientsAudited(0);
            setOsrmGeometry(null);
        } catch (e) {
            console.error(e);
            alert("Erro ao carregar roteiros da equipe.");
        } finally {
            setLoading(false);
        }
    };

    // 2. Extrair Supervisores Disponíveis no Dia
    const supervisorOptions = useMemo(() => {
        const map = new Map<string, string>();
        allPlannedData.forEach(v => {
            // Verifica se tem supervisor vinculado
            if (v.Cod_Supervisor && v.Nome_Supervisor) {
                map.set(String(v.Cod_Supervisor), v.Nome_Supervisor);
            }
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, label: `${id} - ${name}` }))
            .sort((a,b) => a.label.localeCompare(b.label));
    }, [allPlannedData]);

    // 3. EFEITO CENTRAL: Filtrar e Cruzar Dados
    useEffect(() => {
        if (!selectedSupervisorCode) {
            setTeamVisits([]);
            setSupervisorRoute([]);
            setInsights([]);
            setOsrmGeometry(null);
            return;
        }

        // A. Identificar Clientes da Equipe (Subordinados)
        const subordinateVisits = allPlannedData.filter(v => String(v.Cod_Supervisor) === selectedSupervisorCode);
        setTeamVisits(subordinateVisits);

        // B. Encontrar o ID Pulsus do Supervisor Selecionado
        let supervisorCadastro = colaboradores.find(c => String(c.CodigoSetor) === selectedSupervisorCode && c.Grupo === 'Supervisor');
        if (!supervisorCadastro) {
            // Fallback apenas se não houver um com grupo Supervisor explicitamente
            supervisorCadastro = colaboradores.find(c => String(c.CodigoSetor) === selectedSupervisorCode);
        }
        let supervisorPulsusId = 0;
        
        if (supervisorCadastro) {
            supervisorPulsusId = supervisorCadastro.ID_Pulsus;
        } else {
            const supervisorName = allPlannedData.find(v => String(v.Cod_Supervisor) === selectedSupervisorCode)?.Nome_Supervisor;
            if (supervisorName) {
                const match = colaboradores.find(c => c.Nome.includes(supervisorName.split(' ')[0])); // Match simples
                if (match) supervisorPulsusId = match.ID_Pulsus;
            }
        }

        // C. Filtrar Rota do Supervisor no CSV
        if (fullCsvData.length > 0 && supervisorPulsusId) {
            const routePoints = fullCsvData.filter(p => 
                p.id_pulsus === supervisorPulsusId && 
                p.dateIso === date
            ).sort((a,b) => a.timestamp - b.timestamp);

            setSupervisorRoute(routePoints);

            // Calcular KM Auditado (Linear)
            const hasGeo = routePoints.some(p => p.lat !== 0 && p.lng !== 0);
            if (hasGeo) {
                let total = 0;
                for (let i = 0; i < routePoints.length - 1; i++) {
                    total += calcDist(routePoints[i].lat, routePoints[i].lng, routePoints[i+1].lat, routePoints[i+1].lng);
                }
                setKmAudited(total / 1000);
                
                // --- CALCULAR ROTA REAL (OSRM) ---
                if (useRealRoute) {
                    setCalculatingRoute(true);
                    fetchRouteGeometry(routePoints)
                        .then(geo => {
                            if (geo) setOsrmGeometry(geo);
                            else setOsrmGeometry(null);
                        })
                        .finally(() => setCalculatingRoute(false));
                } else {
                    setOsrmGeometry(null);
                }

            } else {
                setKmAudited(routePoints.reduce((acc, curr) => acc + (curr.km_row || 0), 0));
                setOsrmGeometry(null);
            }

            // Gerar Auditoria (Timeline) - Recalcula sempre que rota, visitas, raio ou tempo mudar
            generateAuditTimeline(routePoints, subordinateVisits, hasGeo);

        } else {
            setSupervisorRoute([]);
            setKmAudited(0);
            setClientsAudited(0);
            setInsights([]);
            setOsrmGeometry(null);
        }

    }, [selectedSupervisorCode, date, allPlannedData, fullCsvData, colaboradores, auditRadius, minStayTime, useRealRoute]);

    // 4. Lógica de Auditoria - COM PERMANÊNCIA
    const generateAuditTimeline = (route: ActualPoint[], targets: VisitaPrevista[], hasGeo: boolean) => {
        const events: TimelineEvent[] = [];
        
        if (!hasGeo || route.length === 0) {
            setInsights([]);
            return;
        }

        // Evento Início
        events.push({
            id: 'START',
            time: route[0].time,
            type: 'START',
            description: 'Início da Supervisão',
            details: route[0].address,
            address: route[0].address,
            coord: [route[0].lat, route[0].lng]
        });

        const auditedClients = new Set<number>();
        
        // Estado para rastrear visita atual
        let currentVisitCandidate: { 
            client: VisitaPrevista; 
            startTime: number; 
            startTimeStr: string;
            startPoint: ActualPoint; 
            lastTime: number;
            lastTimeStr: string;
        } | null = null;

        // Percorre a rota do supervisor
        for (let i = 0; i < route.length; i++) {
            const point = route[i];
            
            // 1. Encontrar o cliente mais próximo neste ponto
            let bestMatch: { target: VisitaPrevista, dist: number } | null = null;
            let minDist = Infinity;

            for (const target of targets) {
                if (target.Lat && target.Long) {
                    const dist = calcDist(point.lat, point.lng, target.Lat, target.Long);
                    if (dist <= auditRadius && dist < minDist) {
                        minDist = dist;
                        bestMatch = { target, dist };
                    }
                }
            }

            // 2. Lógica de Continuidade (Permanência)
            if (currentVisitCandidate) {
                // Se ainda está no mesmo cliente (Best Match é o mesmo)
                if (bestMatch && (bestMatch as { target: VisitaPrevista }).target.Cod_Cliente === currentVisitCandidate.client.Cod_Cliente) {
                    // Atualiza o tempo final da visita candidata
                    currentVisitCandidate.lastTime = point.timestamp;
                    currentVisitCandidate.lastTimeStr = point.time;
                } else {
                    // Mudou de cliente ou saiu do raio -> FINALIZAR CANDIDATO ATUAL
                    const durationMs = currentVisitCandidate.lastTime - currentVisitCandidate.startTime;
                    const durationMin = durationMs / (1000 * 60);

                    if (durationMin >= minStayTime && !auditedClients.has(currentVisitCandidate.client.Cod_Cliente)) {
                        // Formatar endereço completo
                        const c = currentVisitCandidate.client;
                        const fullAddr = `${c.Endereco}${c.Bairro ? `, ${c.Bairro}` : ''}${c.Cidade ? ` - ${c.Cidade}` : ''}`;

                        // CONFIRMA VISITA
                        events.push({
                            id: `AUDIT-${c.Cod_Cliente}`,
                            time: currentVisitCandidate.startTimeStr,
                            endTime: currentVisitCandidate.lastTimeStr,
                            durationMinutes: Math.round(durationMin),
                            type: 'AUDIT',
                            description: `${c.Razao_Social}`,
                            details: `Vendedor: ${c.Cod_Vend} - ${c.Nome_Vendedor} | Duração: ${Math.round(durationMin)} min`,
                            address: fullAddr,
                            subordinate: `${c.Cod_Vend} - ${c.Nome_Vendedor} (${colaboradores.find(col => String(col.CodigoSetor) === String(c.Cod_Vend))?.Grupo || 'Vendedor'})`,
                            coord: [c.Lat, c.Long],
                            originalPoint: c
                        });
                        auditedClients.add(c.Cod_Cliente);
                    }

                    // Inicia novo candidato se houver match atual (que não seja repetido)
                    if (bestMatch && !auditedClients.has((bestMatch as { target: VisitaPrevista }).target.Cod_Cliente)) {
                        currentVisitCandidate = {
                            client: (bestMatch as { target: VisitaPrevista }).target,
                            startTime: point.timestamp,
                            startTimeStr: point.time,
                            startPoint: point,
                            lastTime: point.timestamp,
                            lastTimeStr: point.time
                        };
                    } else {
                        currentVisitCandidate = null;
                    }
                }
            } else {
                // Não há candidato atual, inicia um se houver match
                if (bestMatch && !auditedClients.has((bestMatch as { target: VisitaPrevista }).target.Cod_Cliente)) {
                    currentVisitCandidate = {
                        client: (bestMatch as { target: VisitaPrevista }).target,
                        startTime: point.timestamp,
                        startTimeStr: point.time,
                        startPoint: point,
                        lastTime: point.timestamp,
                        lastTimeStr: point.time
                    };
                }
            }
        }

        // Check final loop candidate
        if (currentVisitCandidate) {
            const durationMs = currentVisitCandidate.lastTime - currentVisitCandidate.startTime;
            const durationMin = durationMs / (1000 * 60);
            if (durationMin >= minStayTime && !auditedClients.has(currentVisitCandidate.client.Cod_Cliente)) {
                const c = currentVisitCandidate.client;
                const fullAddr = `${c.Endereco}${c.Bairro ? `, ${c.Bairro}` : ''}${c.Cidade ? ` - ${c.Cidade}` : ''}`;
                
                events.push({
                    id: `AUDIT-${c.Cod_Cliente}`,
                    time: currentVisitCandidate.startTimeStr,
                    endTime: currentVisitCandidate.lastTimeStr,
                    durationMinutes: Math.round(durationMin),
                    type: 'AUDIT',
                    description: `${c.Razao_Social}`,
                    details: `Vendedor: ${c.Cod_Vend} - ${c.Nome_Vendedor} | Duração: ${Math.round(durationMin)} min`,
                    address: fullAddr,
                    subordinate: `${c.Cod_Vend} - ${c.Nome_Vendedor}`,
                    coord: [c.Lat, c.Long],
                    originalPoint: c
                });
                auditedClients.add(c.Cod_Cliente);
            }
        }

        setClientsAudited(auditedClients.size);

        // Evento Fim
        const last = route[route.length - 1];
        events.push({
            id: 'END',
            time: last.time,
            type: 'END',
            description: 'Fim do Expediente',
            details: last.address,
            address: last.address,
            coord: [last.lat, last.lng]
        });

        // Sort events by time
        events.sort((a,b) => a.time.localeCompare(b.time));

        setInsights(events);
    };

    // 5. CSV Parsing (Expandido para Roteiro e Rastro)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);

        const onDataLoaded = (rows: any[]) => {
            if (activeTab === 'auditoria') {
                processRastroCsv(rows);
            } else {
                processRoteiroCsv(rows);
            }
        };

        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                onDataLoaded(data);
            };
            reader.readAsBinaryString(file);
        } else {
            Papa.parse(file, {
                header: true,
                delimiter: ";",
                skipEmptyLines: true,
                complete: (results: Papa.ParseResult<any>) => {
                    onDataLoaded(results.data);
                },
                error: (err: Error) => { alert("Erro CSV: " + err.message); setLoading(false); }
            });
        }
    };

    const levenshteinDistance = (a: string, b: string): number => {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
        for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
                }
            }
        }
        return matrix[b.length][a.length];
    };

    const processRoteiroParsedData = (parsedData: VisitaPrevista[], mappings: Record<string, number>) => {
        const finalData = parsedData.map(v => {
            const mappedId = mappings[v.Nome_Vendedor];
            if (mappedId) {
                v.Cod_Vend = Number(mappedId);
                const colab = colaboradores.find(c => c.CodigoSetor === v.Cod_Vend && c.Ativo);
                if (colab) v.Nome_Vendedor = colab.Nome;
            }
            return v;
        }).filter(v => v.Cod_Vend && v.Cod_Vend > 0);

        if (finalData.length === 0) {
            alert("Nenhum dado válido restou após o mapeamento de promotores.");
            setLoading(false);
            return;
        }

        setRoteiroManualData(finalData);
        setLoading(false);
        alert(`Roteiro Importado! ${finalData.length} clientes com coordenadas válidas identificados para roteirização.`);
    };

    const processRoteiroCsv = async (rows: any[]) => {
        const clients = await getPromoterClients();
        const clientMap = new Map();
        clients.forEach(c => clientMap.set(String(c.Cod_Cliente), c));

        const newRoteiro: VisitaPrevista[] = [];
        const uniqueNames = new Set<string>();

        rows.forEach(row => {
            const nome = row['NOME DO COLABORADOR'] || row['Nome'] || row['Colaborador'];
            const codPdv = row['CODIGO PDV'] || row['Cod_Cliente'] || row['Codigo'] || row['Cod. Cliente'] || row['Cliente'];
            
            if (nome && codPdv) {
                uniqueNames.add(nome);
                const clientData = clientMap.get(String(codPdv));
                newRoteiro.push({
                    Cod_Vend: 0, // Inicia zerado, vamos cruzar pelo nome
                    Nome_Vendedor: nome,
                    Cod_Supervisor: parseInt(row['Cod. Supervisor'] || '0'),
                    Nome_Supervisor: row['Nome Supervisor'] || 'Equipe Merchandising',
                    Cod_Cliente: codPdv,
                    Razao_Social: clientData ? clientData.Razao_Social : row['Razão Social'] || row['Fantasia'] || `Cliente ${codPdv}`,
                    Dia_Semana: (() => {
                        const val = String(row['SEMANA'] || row['NOME DIA'] || row['DIA SEMANA'] || row['DIA SEN'] || row['Dia da Semana'] || row['Dia'] || row['Data'] || '').trim().toUpperCase();
                        if (val === '1' || val.includes('SEGUNDA')) return 'SEGUNDA-FEIRA';
                        if (val === '2' || val.includes('TERCA') || val.includes('TERÇA')) return 'TERÇA-FEIRA';
                        if (val === '3' || val.includes('QUARTA')) return 'QUARTA-FEIRA';
                        if (val === '4' || val.includes('QUINTA')) return 'QUINTA-FEIRA';
                        if (val === '5' || val.includes('SEXTA')) return 'SEXTA-FEIRA';
                        if (val === '6' || val.includes('SABADO') || val.includes('SÁBADO')) return 'SÁBADO';
                        if (val === '7' || val.includes('DOMINGO')) return 'DOMINGO';
                        return val;
                    })(),
                    Periodicidade: row['FREQUENCIA'] || row['FREQUÊNCIA'] || row['Frequencia'] || row['Frequência'] || row['FREQUENCI'] || '',
                    Data_da_Visita: '',
                    Endereco: clientData ? clientData.Endereco : row['Endereço'] || row['Logradouro'] || '',
                    Bairro: clientData ? clientData.Bairro : row['Bairro'] || '',
                    Cidade: clientData ? clientData.Cidade : row['Cidade'] || '',
                    CEP: clientData ? clientData.CEP : row['CEP'] || '',
                    Lat: clientData ? Number(clientData.Lat) : parseFloat(String(row['Lat'] || row['lat'] || '0').replace(',', '.')),
                    Long: clientData ? Number(clientData.Long) : parseFloat(String(row['Long'] || row['lng'] || row['Lon'] || row['lon'] || '0').replace(',', '.'))
                });
            }
        });

        // Filtrar clientes com latitude e longitude zeradas
        const roterioFiltrado = newRoteiro.filter(c => c.Lat !== 0 && c.Long !== 0);

        if (roterioFiltrado.length === 0) {
            alert("Nenhum dado válido encontrado após remoção de coordenadas zeradas.");
            setLoading(false);
            return;
        }

        const newMappings: Record<string, number> = { ...nameMappings };
        const unmatched: string[] = [];

        uniqueNames.forEach(nome => {
            if (newMappings[nome]) return;

            const upperNome = nome.trim().toUpperCase();
            
            let colab = colaboradores.find(col => 
                col.Nome.trim().toUpperCase() === upperNome && 
                col.Ativo && 
                (String(col.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(col.Grupo).trim().toUpperCase() === 'PROMOTORES')
            );
            
            if (colab) {
                newMappings[nome] = colab.CodigoSetor;
            } else {
                unmatched.push(nome);
            }
        });

        setNameMappings(newMappings);

        if (unmatched.length > 0) {
            setUnmatchedNames(unmatched);
            setPendingParsedData(roterioFiltrado);
            setShowMappingModal(true);
            setLoading(false);
        } else {
            processRoteiroParsedData(roterioFiltrado, newMappings);
        }
    };

    const processRastroCsv = (rows: any[]) => {
        const allPoints: ActualPoint[] = [];
        const loadedIds = new Set<number>();

        rows.forEach((row: any) => {
            const latStr = String(row['Latitude'] || row['lat'] || '0');
            const lngStr = String(row['Longitude'] || row['lng'] || '0');
            const lat = parseFloat(latStr.replace(',', '.'));
            const lng = parseFloat(lngStr.replace(',', '.'));
            
            const kmStr = String(row['Estimativa de distância percorrida (KM)'] || row['km'] || '0');
            const kmRow = parseFloat(kmStr.replace(',', '.'));

            let timeStr = row['Hora'] || row['Data/Hora'] || row['Hora inicial'] || '';
            const fullDateStr = row['Data'] || row['date'] || '';
            
            if (!timeStr && fullDateStr.includes(' ')) {
                const parts = fullDateStr.split(' ');
                if (parts.length >= 2) timeStr = parts[1];
            }
            if (timeStr.length > 5) timeStr = timeStr.substring(0, 5);

            const address = row['Endereco'] || row['address'] || (lat !== 0 ? 'Rastreamento GPS' : 'Local não informado');
            const idRow = parseInt(row['ID Pulsus'] || row['id_pulsus'] || row['ID_Pulsus']);
            const isValidRow = !isNaN(idRow) && ((lat !== 0 && lng !== 0) || kmRow >= 0);

            if (isValidRow) {
                const isoDate = normalizeDate(fullDateStr);
                loadedIds.add(idRow);

                allPoints.push({
                    lat: lat || 0, 
                    lng: lng || 0,
                    time: timeStr || '12:00',
                    address,
                    timestamp: new Date(`${isoDate}T${timeStr || '12:00'}`).getTime() || 0,
                    id_pulsus: idRow,
                    dateIso: isoDate,
                    km_row: kmRow || 0
                });
            }
        });
        
        setFullCsvData(allPoints);
        setLoading(false);
        alert(`Rastro Supervisor Importado! ${allPoints.length} pontos de rastreamento carregados.\nIdentificados ${loadedIds.size} colaboradores únicos.`);
    };

    const promoterColorMap = useMemo(() => {
        const map = new Map<string, string>();
        const uniqueIds = Array.from(new Set(roteiroManualData.map(v => String(v.Cod_Vend))));
        uniqueIds.forEach((id, idx) => {
            map.set(id, PROMOTER_COLORS[idx % PROMOTER_COLORS.length]);
        });
        return map;
    }, [roteiroManualData]);

    const exportRoteiroToExcel = () => {
        if (roteiroManualData.length === 0) {
            alert("Nenhum dado para exportar.");
            return;
        }

        // Preparar dados para exportação (formato Roteirizador Padrão)
        const exportData = roteiroManualData.map((v, i) => ({
            'CARGO': 'PROMOTOR',
            'CODIGO': v.Cod_Vend,
            'NOME DO COLABORADOR': v.Nome_Vendedor,
            'FREQUENCIA': v.Periodicidade || 'SEMANAL',
            'SEMANA': 1,
            'DIA SEMANA': v.Dia_Semana,
            'NOME DIA': v.Dia_Semana,
            'ENTRADA': '',
            'SAIDA': '',
            'OBSERVACAO': '',
            'ORDEM VISITA': i + 1, // Ordem global ou agrupada
            'COMERCIAL': 'GAROTO',
            'CODIGO PDV': v.Cod_Cliente,
            'RAZAO SOCIAL': v.Razao_Social,
            'FANTASIA': v.Razao_Social,
            'CNPJ': '',
            'CEP': v.CEP,
            'ENDERECO': v.Endereco,
            'BAIRRO': v.Bairro,
            'CIDADE': v.Cidade,
            'ESTADO': 'SP'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Roteiro Otimizado");
        XLSX.writeFile(wb, `Roteiro_Promotores_Otimizado_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleOptimizeRoutes = () => {
        if (roteiroManualData.length === 0) return;
        setLoading(true);

        setTimeout(() => {
            const groups = new Map<number, VisitaPrevista[]>();
            roteiroManualData.forEach(v => {
                if(!groups.has(v.Cod_Vend)) groups.set(v.Cod_Vend, []);
                groups.get(v.Cod_Vend)?.push(v);
            });

            const otimizados: VisitaPrevista[] = [];

            // Algoritmo Simples de Clusterização (K-Means espacial simplificado + TSP Guloso)
            Array.from(groups.entries()).forEach(([vendedorId, visits]) => {
                // Distribuir visitas nos dias disponíveis
                const availableDays = optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA'];
                
                // Em um cenário real de mercado (VRP), usaríamos matriz de distâncias + restrições de capacidade.
                // Aqui faremos um "clustering" ingênuo sequencial ordenando pela proximidade com a base ou ponto anterior.
                const colab = colaboradores.find(c => c.CodigoSetor === vendedorId && c.Ativo);
                const startLat = colab?.LatitudeBase || visits[0].Lat;
                const startLng = colab?.LongitudeBase || visits[0].Long;
                
                let unassigned = [...visits];
                
                // TSP Guloso a partir da base
                const orderedVisits: VisitaPrevista[] = [];
                let currentLat = startLat;
                let currentLng = startLng;

                while (unassigned.length > 0) {
                    let nearestIdx = 0;
                    let minDist = Infinity;
                    for (let i = 0; i < unassigned.length; i++) {
                        const dist = calcDist(currentLat, currentLng, unassigned[i].Lat, unassigned[i].Long);
                        if (dist < minDist) {
                            minDist = dist;
                            nearestIdx = i;
                        }
                    }
                    const nearest = unassigned.splice(nearestIdx, 1)[0];
                    orderedVisits.push(nearest);
                    currentLat = nearest.Lat;
                    currentLng = nearest.Long;
                }

                // Agora distribui os pontos ordenados para os dias da semana respeitando maxClientes por dia
                let dayIndex = 0;
                let countInDay = 0;
                
                orderedVisits.forEach((v, index) => {
                    const currentDay = availableDays[dayIndex % availableDays.length];
                    
                    // Se for sabado e optamos por meio periodo, digamos que maximo é 1 ou max/2
                    const maxForCurrentDay = currentDay === 'SÁBADO' ? Math.max(1, Math.floor(optMaxClients / 2)) : optMaxClients;

                    if (countInDay >= maxForCurrentDay) {
                        dayIndex++;
                        countInDay = 0;
                    }

                    otimizados.push({
                        ...v,
                        Dia_Semana: availableDays[dayIndex % availableDays.length],
                        Periodicidade: 'SEMANAL' // Pode ser atualizado depois
                    });
                    countInDay++;
                });
            });

            setRoteiroManualData(otimizados);
            setLoading(false);
            setIsOptimizerModalOpen(false);
            alert("Roteiro otimizado com sucesso! Clique em Roteirizar para traçar no mapa ou Exportar para Excel.");
        }, 500);
    };

    const handleBulkRouting = async () => {
        if (roteiroManualData.length === 0) {
            alert("Carregue primeiro um arquivo de roteiro (CSV/XLSX Promotores).");
            return;
        }

        setLoading(true);
        const groups = new Map<number, VisitaPrevista[]>();
        roteiroManualData.forEach(v => {
            if(!groups.has(v.Cod_Vend)) groups.set(v.Cod_Vend, []);
            groups.get(v.Cod_Vend)?.push(v);
        });

        const newBulkRoutes: any[] = [];

        for (const [vendedorId, visits] of Array.from(groups.entries())) {
            const colab = colaboradores.find(c => c.CodigoSetor === vendedorId && c.Ativo);
            const startLat = colab?.LatitudeBase || visits[0].Lat;
            const startLng = colab?.LongitudeBase || visits[0].Long;

            const routePoints = [
                { Lat: startLat, Long: startLng },
                ...visits.map(v => ({ Lat: v.Lat, Long: v.Long }))
            ];
            
            try {
                const osrm = await getOSRMData(routePoints, false);
                if (osrm && osrm.geometry && osrm.geometry.length > 0) {
                    newBulkRoutes.push({
                        id: String(vendedorId),
                        color: promoterColorMap.get(String(vendedorId)) || PROMOTER_COLORS[0],
                        points: osrm.geometry,
                        distance: osrm.distance || 0
                    });
                } else {
                    const straightCoords = routePoints.map(p => [p.Lat, p.Long] as [number, number]);
                    newBulkRoutes.push({
                        id: String(vendedorId),
                        color: promoterColorMap.get(String(vendedorId)) || PROMOTER_COLORS[0],
                        points: straightCoords,
                        distance: 0
                    });
                }
            } catch (e) {
                const straightCoords = routePoints.map(p => [p.Lat, p.Long] as [number, number]);
                newBulkRoutes.push({
                    id: String(vendedorId),
                    color: promoterColorMap.get(String(vendedorId)) || PROMOTER_COLORS[0],
                    points: straightCoords,
                    distance: 0
                });
            }
        }

        setBulkRoutes(newBulkRoutes);
        setLoading(false);
        alert(`Roteirização concluída! ${newBulkRoutes.length} rotas traçadas.`);
    };

    const promoterOptionsForRoute = useMemo(() => {
        const map = new Map<string, string>();
        roteiroManualData.forEach(v => {
            map.set(String(v.Cod_Vend), v.Nome_Vendedor);
        });
        const opts = Array.from(map.entries())
            .map(([id, name]) => ({ id, label: `${id} - ${name}` }))
            .sort((a,b) => a.label.localeCompare(b.label));
        return [{ id: 'ALL', label: 'Todos os Promotores' }, ...opts];
    }, [roteiroManualData]);

    const filteredBulkRoutes = useMemo(() => {
        if (selectedPromoterForRoute === 'ALL') return bulkRoutes;
        return bulkRoutes.filter(r => r.id === selectedPromoterForRoute);
    }, [bulkRoutes, selectedPromoterForRoute]);

    const filteredPromotersList = useMemo(() => {
        const uniqueIds = Array.from(new Set(roteiroManualData.map(v => v.Cod_Vend)));
        
        let list = uniqueIds.map(id => {
            const visits = roteiroManualData.filter(v => v.Cod_Vend === id);
            const uniqueClients = new Set(visits.map(v => v.Cod_Cliente)).size;
            const colab = colaboradores.find(c => c.CodigoSetor === id);
            return {
                id: String(id),
                nome: colab ? colab.Nome : (visits[0]?.Nome_Vendedor || 'Desconhecido'),
                visitsCount: visits.length,
                uniqueClientsCount: uniqueClients,
                ativo: colab ? colab.Ativo : true // Assume true if not found (e.g., fictional team)
            };
        }).filter(p => p.ativo);

        if (promoterTeamFilter !== 'ALL') {
            list = list.filter(p => {
                if (p.id.startsWith('-')) return false; // Omit unregistered if filtering by team
                if (promoterTeamFilter === '100') return p.id.startsWith('1');
                if (promoterTeamFilter === '200') return p.id.startsWith('2');
                return true;
            });
        }

        if (promoterSearchTerm.trim() !== '') {
            const term = promoterSearchTerm.toLowerCase();
            list = list.filter(p => 
                p.nome.toLowerCase().includes(term) || 
                p.id.includes(term)
            );
        }

        list.sort((a, b) => a.nome.localeCompare(b.nome));

        return list;
    }, [roteiroManualData, promoterTeamFilter, promoterSearchTerm]);

    const filteredRoteiroPoints = useMemo(() => {
        const allowedIds = new Set(filteredPromotersList.map(p => Number(p.id)));
        return roteiroManualData.filter(v => allowedIds.has(v.Cod_Vend));
    }, [roteiroManualData, filteredPromotersList]);

    const uniqueClientMarkers = useMemo(() => {
        const clientsMap = new Map<number, { point: VisitaPrevista, visits: VisitaPrevista[] }>();
        filteredRoteiroPoints.forEach(v => {
            if (!clientsMap.has(v.Cod_Cliente)) {
                clientsMap.set(v.Cod_Cliente, { point: v, visits: [] });
            }
            clientsMap.get(v.Cod_Cliente)!.visits.push(v);
        });
        return Array.from(clientsMap.values());
    }, [filteredRoteiroPoints]);

    const promoterMetrics = useMemo(() => {
        if (selectedPromoterForRoute === 'ALL') return null;
        
        const visits = roteiroManualData.filter(v => String(v.Cod_Vend) === selectedPromoterForRoute);
        const colab = colaboradores.find(c => String(c.CodigoSetor) === selectedPromoterForRoute && c.Ativo);
        let distKm = 0;
        
        if (colab && visits.length > 0) {
            const rt = bulkRoutes.find(r => r.id === selectedPromoterForRoute);
            if (rt && rt.distance) {
                distKm = rt.distance / 1000;
            } else if (colab.LatitudeBase && colab.LongitudeBase) {
                let currLat = colab.LatitudeBase;
                let currLng = colab.LongitudeBase;
                let remaining = [...visits];
                let calcTotal = 0;
                while (remaining.length > 0) {
                    let minDist = 9999999;
                    let closestIdx = 0;
                    remaining.forEach((m, idx) => {
                        const d = calcDist(currLat, currLng, m.Lat, m.Long);
                        if(d < minDist) { minDist = d; closestIdx = idx; }
                    });
                    calcTotal += minDist;
                    currLat = remaining[closestIdx].Lat;
                    currLng = remaining[closestIdx].Long;
                    remaining.splice(closestIdx, 1);
                }
                calcTotal += calcDist(currLat, currLng, colab.LatitudeBase, colab.LongitudeBase);
                distKm = calcTotal / 1000;
            }
        }
        
        return {
            clientes: visits.length,
            km: distKm.toFixed(1)
        };
    }, [selectedPromoterForRoute, roteiroManualData, colaboradores, bulkRoutes]);

    // Export Timeline Text
    const handleExportTimeline = () => {
        if (insights.length === 0) return;
        
        let text = `📋 *Auditoria Fuel360* - ${new Date(date).toLocaleDateString('pt-BR')}\n`;
        const supName = supervisorOptions.find(s => s.id === selectedSupervisorCode)?.label || selectedSupervisorCode;
        text += `👤 Supervisor: ${supName}\n\n`;

        insights.forEach(ev => {
            if (ev.type === 'START') text += `🟢 *${ev.time}* - INÍCIO\n📍 ${ev.address}\n\n`;
            else if (ev.type === 'END') text += `🏁 *${ev.time}* - FIM\n📍 ${ev.address}\n`;
            else {
                text += `✅ *${ev.time}* - ${ev.description}\n`;
                text += `   👤 ${ev.subordinate} | ⏱ ${ev.durationMinutes} min\n`;
                if(ev.address) text += `   📍 ${ev.address}\n`;
                text += '\n';
            }
        });

        text += `\n📊 *Resumo:*\n`;
        text += `Equipe: ${teamVisits.length} clientes\n`;
        text += `Auditados: ${clientsAudited} clientes (${teamVisits.length > 0 ? ((clientsAudited/teamVisits.length)*100).toFixed(0) : 0}%)\n`;
        text += `KM Rodado: ${kmAudited.toFixed(1)} km\n`;

        // Função de Fallback para copiar texto (funciona em contextos não seguros ou browsers antigos)
        const copyFallback = (str: string) => {
            const textArea = document.createElement("textarea");
            textArea.value = str;
            
            // Garante que o textarea esteja no DOM mas invisível
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            
            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                if(successful) alert("Resumo copiado para a área de transferência!");
                else alert("Falha ao copiar texto. Permissão negada?");
            } catch (err) {
                alert("Erro ao copiar texto: " + err);
            }
            
            document.body.removeChild(textArea);
        };

        // Tenta usar a API moderna, se falhar ou não existir, usa fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => alert("Resumo copiado para a área de transferência!"))
                .catch(err => {
                    console.warn("Clipboard API falhou, tentando fallback...", err);
                    copyFallback(text);
                });
        } else {
            copyFallback(text);
        }
    };

    // Calculate Map Bounds
    useEffect(() => {
        const lats: number[] = [];
        const lngs: number[] = [];

        if (activeTab === 'auditoria') {
            supervisorRoute.forEach(p => { if(p.lat && p.lng) { lats.push(p.lat); lngs.push(p.lng); } });
            teamVisits.forEach(v => { if(v.Lat && v.Long) { lats.push(v.Lat); lngs.push(v.Long); } });
        } else {
            const pointsToConsider = selectedPromoterForRoute !== 'ALL' 
                ? filteredRoteiroPoints.filter(v => String(v.Cod_Vend) === selectedPromoterForRoute)
                : filteredRoteiroPoints;

            pointsToConsider.forEach(v => { if(v.Lat && v.Long) { lats.push(v.Lat); lngs.push(v.Long); } });
            // Adicionar bases
            Array.from(new Set(pointsToConsider.map(v => v.Cod_Vend))).forEach(vId => {
                let colab = colaboradores.find(c => c.CodigoSetor === vId && c.Ativo && (String(c.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(c.Grupo).trim().toUpperCase() === 'PROMOTORES'));
                if (!colab) colab = colaboradores.find(c => c.CodigoSetor === vId && c.Ativo);
                if(colab && colab.LatitudeBase && colab.LongitudeBase) {
                    lats.push(colab.LatitudeBase);
                    lngs.push(colab.LongitudeBase);
                }
            });
        }

        if (lats.length > 0) {
            setMapBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]);
        }
    }, [teamVisits, supervisorRoute, filteredRoteiroPoints, activeTab, colaboradores, selectedPromoterForRoute]);

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
            {showMappingModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Vincular Promotores</h3>
                                <p className="text-sm text-slate-500 mt-1">Alguns nomes do Excel não foram encontrados no sistema.</p>
                            </div>
                            <button onClick={() => setShowMappingModal(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="w-6 h-6 flex items-center justify-center font-bold text-xl">&times;</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {unmatchedNames.map(nome => (
                                <div key={nome} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div className="flex-1 font-bold text-slate-700">{nome}</div>
                                    <div className="flex-1">
                                        <select 
                                            className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNameMappings(prev => ({...prev, [nome]: Number(val)}));
                                            }}
                                            value={nameMappings[nome] || ''}
                                        >
                                            <option value="">Ignorar este promotor</option>
                                            {colaboradores
                                                .filter(c => c.Ativo && (String(c.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(c.Grupo).trim().toUpperCase() === 'PROMOTORES'))
                                                .map(c => (
                                                <option key={c.CodigoSetor} value={c.CodigoSetor}>{c.Nome} ({c.Grupo})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setShowMappingModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">Cancelar</button>
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
            
            {/* TABS SELECTOR */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
                <button 
                    onClick={() => setActiveTab('auditoria')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'auditoria' ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Auditoria de Supervisão
                </button>
                <button 
                    onClick={() => setActiveTab('roteirizador')}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'roteirizador' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Roteirizador Promotores
                </button>
            </div>

            {/* TOP BAR */}
            <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center">
                        {activeTab === 'auditoria' ? (
                            <>
                                <EyeIcon className="w-6 h-6 mr-2 text-indigo-600"/>
                                Auditoria de Supervisão
                            </>
                        ) : (
                            <>
                                <TruckIcon className="w-6 h-6 mr-2 text-emerald-600"/>
                                Roteirizador Promotores
                            </>
                        )}
                    </h2>
                    <p className="text-slate-500 text-[10px] font-bold uppercase ml-8 tracking-wider opacity-70">
                        Versão {SYSTEM_VERSION} • {activeTab === 'auditoria' ? 'Auditoria de Equipe' : 'Configuração de Rotas'}
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                    
                    {activeTab === 'auditoria' ? (
                        <>
                            {/* CONTROLES AUDITORIA */}
                            <div className="w-24 px-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between">Raio: {auditRadius}m</label>
                                <input type="range" min="30" max="500" step="10" value={auditRadius} onChange={(e) => setAuditRadius(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                            </div>
                            <div className="w-24 px-2 border-l border-slate-100">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex justify-between">Tempo: {minStayTime}m</label>
                                <input type="range" min="1" max="60" step="1" value={minStayTime} onChange={(e) => setMinStayTime(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"/>
                            </div>
                            <div className="flex items-center px-2 bg-slate-50 rounded-lg border border-slate-200 h-[34px]">
                                <input type="checkbox" id="useRealRoute" checked={useRealRoute} onChange={e => setUseRealRoute(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded border-gray-300"/>
                                <label htmlFor="useRealRoute" className="ml-2 text-[10px] font-bold text-slate-500 uppercase cursor-pointer">Vias</label>
                            </div>
                            <button onClick={() => setShowNonVisited(!showNonVisited)} className={`h-[34px] px-3 rounded-lg border flex items-center transition-all ${showNonVisited ? 'bg-white border-slate-200 text-slate-600 shadow-sm' : 'bg-slate-100 border-slate-300 text-slate-400'}`}>
                                <EyeIcon className="w-4 h-4"/>
                            </button>
                            <div className="w-32 border-l border-slate-100 pl-3">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data</label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none"/>
                            </div>
                            <button onClick={loadAllPlanned} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-lg text-xs flex items-center shadow-md transition disabled:opacity-50 h-[34px]">
                                {loading ? <SpinnerIcon className="w-4 h-4 animate-spin"/> : <RefreshIcon className="w-4 h-4 mr-1"/>} Equipe
                            </button>
                            <div className="w-48">
                                <SearchableSelect options={supervisorOptions} value={selectedSupervisorCode} onChange={setSelectedSupervisorCode} placeholder="Supervisor..." disabled={allPlannedData.length === 0}/>
                            </div>
                            <label className={`cursor-pointer bg-slate-800 hover:bg-black text-white font-bold px-3 rounded-lg text-xs flex items-center transition shadow-md h-[34px] ${loading ? 'opacity-50' : ''}`}>
                                <UploadIcon className="w-4 h-4 mr-2"/> Rastro CSV
                                <input type="file" accept=".csv" onChange={handleFileUpload} disabled={loading} className="hidden" />
                            </label>
                        </>
                    ) : (
                        <>
                            {/* CONTROLES ROTEIRIZADOR */}
                            <div className="w-48">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filtrar Promotor</label>
                                <SearchableSelect 
                                    options={promoterOptionsForRoute} 
                                    value={selectedPromoterForRoute} 
                                    onChange={setSelectedPromoterForRoute} 
                                    placeholder="Promotor..."
                                    disabled={roteiroManualData.length === 0}
                                />
                            </div>
                            <button 
                                onClick={handleBulkRouting} 
                                disabled={loading || roteiroManualData.length === 0} 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 rounded-lg text-xs flex items-center shadow-md transition disabled:opacity-50 h-[34px]"
                            >
                                {loading ? <SpinnerIcon className="w-4 h-4 animate-spin"/> : <PresentationChartLineIcon className="w-4 h-4 mr-1"/>} Roteirizar
                            </button>
                            <button
                                onClick={() => setIsOptimizerModalOpen(true)}
                                disabled={loading || roteiroManualData.length === 0}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 rounded-lg text-xs flex items-center shadow-md transition disabled:opacity-50 h-[34px]"
                                title="Configurar e Otimizar Rota"
                            >
                                <CogIcon className="w-4 h-4 mr-1"/> Otimizar
                            </button>
                            <button
                                onClick={exportRoteiroToExcel}
                                disabled={loading || roteiroManualData.length === 0}
                                className="bg-slate-700 hover:bg-slate-800 text-white font-bold px-3 rounded-lg text-xs flex items-center shadow-md transition disabled:opacity-50 h-[34px]"
                                title="Exportar Roteiro Otimizado"
                            >
                                <UploadIcon className="w-4 h-4 mr-1 rotate-180"/> Exportar
                            </button>
                            <label className={`cursor-pointer bg-slate-800 hover:bg-black text-white font-bold px-3 rounded-lg text-xs flex items-center transition shadow-md h-[34px] ${loading ? 'opacity-50' : ''}`}>
                                <UploadIcon className="w-4 h-4 mr-2"/> Roteiro (.xlsx)
                                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} disabled={loading} className="hidden" />
                            </label>
                        </>
                    )}
                </div>
            </div>

            {/* KPI STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {activeTab === 'auditoria' ? (
                    <>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
                            <div className="p-2 bg-indigo-50 rounded-lg mr-3 text-indigo-600"><UserGroupIcon className="w-5 h-5"/></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Equipe</p><p className="text-lg font-black text-slate-800">{teamVisits.length}</p></div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
                            <div className="p-2 bg-emerald-50 rounded-lg mr-3 text-emerald-600"><CheckCircleIcon className="w-5 h-5"/></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Auditados</p><p className="text-lg font-black text-emerald-600">{clientsAudited}</p></div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
                            <div className="p-2 bg-indigo-50 rounded-lg mr-3 text-indigo-600"><LocationMarkerIcon className="w-5 h-5"/></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">KM Supervisor</p><p className="text-lg font-black text-indigo-600">{kmAudited.toFixed(1)}</p></div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
                            <div className="p-2 bg-amber-50 rounded-lg mr-3 text-amber-600"><EyeIcon className="w-5 h-5"/></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Cobertura</p><p className="text-lg font-black text-amber-600">{teamVisits.length > 0 ? ((clientsAudited/teamVisits.length)*100).toFixed(0) : 0}%</p></div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex items-center bg-emerald-50/20">
                            <div className="p-2 bg-emerald-100 rounded-lg mr-3 text-emerald-600"><UserGroupIcon className="w-5 h-5"/></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Clientes</p><p className="text-lg font-black text-emerald-800">{roteiroManualData.length}</p></div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex items-center bg-emerald-50/20">
                            <div className="p-2 bg-emerald-100 rounded-lg mr-3 text-emerald-600"><TruckIcon className="w-5 h-5"/></div>
                            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Rotas</p><p className="text-lg font-black text-emerald-800">{bulkRoutes.length}</p></div>
                        </div>
                        {promoterMetrics && (
                            <>
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
                                    <div className="p-2 bg-indigo-50 rounded-lg mr-3 text-indigo-600"><UserGroupIcon className="w-5 h-5"/></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">Clientes Selecionado</p><p className="text-lg font-black text-indigo-600">{promoterMetrics.clientes}</p></div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center">
                                    <div className="p-2 bg-amber-50 rounded-lg mr-3 text-amber-600"><LocationMarkerIcon className="w-5 h-5"/></div>
                                    <div><p className="text-[10px] text-slate-400 font-bold uppercase">KM Selecionado</p><p className="text-lg font-black text-amber-600">{promoterMetrics.km} km</p></div>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                {/* MAPA */}
                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative z-0">
                    <MapContainer center={[-23.5505, -46.6333]} zoom={10} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        {mapBounds && <MapAutoFit bounds={mapBounds} />}
                        <MapController focusCoord={focusedCoord} />

                        {activeTab === 'auditoria' ? (
                            <>
                                {supervisorRoute.length > 1 && (
                                    <>
                                        {osrmGeometry ? (
                                            <Polyline positions={osrmGeometry} color="#4f46e5" weight={5} opacity={0.8} />
                                        ) : (
                                            <Polyline positions={supervisorRoute.map(p => [p.lat, p.lng])} color="#4f46e5" weight={4} opacity={0.5} dashArray="5, 10" />
                                        )}
                                        <Marker position={[supervisorRoute[0].lat, supervisorRoute[0].lng]} icon={pinSupervisorStart}><Popup>InícioSupervisor</Popup></Marker>
                                    </>
                                )}
                                {teamVisits.map((v, i) => {
                                    const event = insights.find(ev => ev.id === `AUDIT-${v.Cod_Cliente}`);
                                    if (!v.Lat || !v.Long) return null;
                                    if (!showNonVisited && !event) return null;
                                    const isHovered = event && event.id === hoveredEventId;
                                    return (
                                        <Marker key={i} position={[v.Lat, v.Long]} icon={isHovered ? pinHighlight : (event ? pinAudited : pinClient)} zIndexOffset={isHovered ? 1000 : 0}>
                                            <Popup>
                                                <div className="text-xs">
                                                    <strong className="block mb-1">{v.Razao_Social}</strong>
                                                    <p>{v.Nome_Vendedor}</p>
                                                    {event && <p className="text-emerald-600 font-bold mt-1">Auditado: {event.durationMinutes}m</p>}
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}
                            </>
                        ) : (
                            <>
                                {filteredBulkRoutes.map((rt, idx) => (
                                    <Polyline key={idx} positions={rt.points} color={rt.color} weight={5} opacity={0.7}><Popup>Vendedor: {rt.id}</Popup></Polyline>
                                ))}
                                {uniqueClientMarkers.map((clientData, i) => {
                                    const v = clientData.point;
                                    const pColor = promoterColorMap.get(String(v.Cod_Vend)) || '#94a3b8';
                                    return (
                                        <CircleMarker 
                                            key={`client-${v.Cod_Cliente}-${i}`} 
                                            center={[v.Lat, v.Long]} 
                                            radius={6}
                                            pathOptions={{ color: '#ffffff', fillColor: pColor, fillOpacity: 1, weight: 1.5 }}
                                        >
                                            <Popup>
                                                <div className="text-xs">
                                                    <div className="font-black text-slate-800">{v.Cod_Cliente} - {v.Razao_Social}</div>
                                                    <div className="text-[10px] text-slate-500 mb-2"><span className="font-bold">Colaborador:</span> {v.Nome_Vendedor}</div>
                                                    
                                                    <div className="bg-slate-50 border border-slate-100 rounded p-1.5 mb-2">
                                                        <div className="font-bold text-[10px] text-slate-600 border-b border-slate-200 pb-1 mb-1">Agenda de Visitas ({clientData.visits.length})</div>
                                                        <ul className="space-y-1">
                                                            {clientData.visits.map((visit, idx) => (
                                                                <li key={idx} className="flex justify-between items-center text-[9px]">
                                                                    <span className="font-bold text-slate-700">{visit.Dia_Semana || 'Dia Indefinido'}</span>
                                                                    <span className="text-slate-500 bg-white px-1 py-0.5 rounded shadow-sm border border-slate-100">{visit.Periodicidade || 'Frequência Indefinida'}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="text-[10px] text-slate-500 leading-tight">
                                                        {v.Endereco}{v.Bairro ? `, ${v.Bairro}` : ''}{v.Cidade ? ` - ${v.Cidade}` : ''}
                                                    </div>
                                                </div>
                                            </Popup>
                                        </CircleMarker>
                                    );
                                })}
                                {Array.from(new Set(filteredRoteiroPoints.map(v => v.Cod_Vend))).map(vId => {
                                    let colab = colaboradores.find(c => c.CodigoSetor === vId && c.Ativo && (String(c.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(c.Grupo).trim().toUpperCase() === 'PROMOTORES'));
                                    if (!colab) colab = colaboradores.find(c => c.CodigoSetor === vId && c.Ativo);
                                    if(colab && colab.LatitudeBase && colab.LongitudeBase) {
                                        const pColor = promoterColorMap.get(String(vId)) || '#94a3b8';
                                        return (
                                            <Marker 
                                                eventHandlers={{ click: () => setSelectedPromoterForRoute(selectedPromoterForRoute === String(vId) ? 'ALL' : String(vId)) }}
                                                key={`base-${vId}`} 
                                                position={[colab.LatitudeBase, colab.LongitudeBase]} 
                                                icon={createBaseIcon(pColor)}
                                            >
                                                <Popup>Base: {colab.Nome}</Popup>
                                            </Marker>
                                        );
                                    }
                                    return null;
                                })}
                                {/* Raios Visuais (Spider Web) ao selecionar um promotor */}
                                {selectedPromoterForRoute !== 'ALL' && filteredRoteiroPoints.filter(v => String(v.Cod_Vend) === selectedPromoterForRoute).map((v, i) => {
                                    let colab = colaboradores.find(c => c.CodigoSetor === v.Cod_Vend && c.Ativo && (String(c.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(c.Grupo).trim().toUpperCase() === 'PROMOTORES'));
                                    if (!colab) colab = colaboradores.find(c => c.CodigoSetor === v.Cod_Vend && c.Ativo);
                                    if(colab && colab.LatitudeBase && colab.LongitudeBase) {
                                        const pColor = promoterColorMap.get(String(v.Cod_Vend)) || '#94a3b8';
                                        return (
                                            <Polyline 
                                                key={`ray-${i}`} 
                                                positions={[[colab.LatitudeBase, colab.LongitudeBase], [v.Lat, v.Long]]} 
                                                pathOptions={{ color: pColor, weight: 2, dashArray: '5,5', opacity: 0.6 }} 
                                            />
                                        );
                                    }
                                    return null;
                                })}
                            </>
                        )}
                    </MapContainer>
                </div>

                {/* SIDEBAR */}
                <div className="w-80 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden shrink-0">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest leading-none">
                            {activeTab === 'auditoria' ? 'Timeline Auditoria' : 'Relação de Promotores'}
                        </h3>
                        {activeTab === 'auditoria' && insights.length > 0 && (
                            <button onClick={handleExportTimeline} className="text-indigo-600 hover:bg-white p-1 rounded transition border border-transparent hover:border-slate-200 shadow-sm"><ClipboardListIcon className="w-4 h-4"/></button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {activeTab === 'auditoria' ? (
                            insights.length === 0 ? (
                                <div className="text-center text-slate-400 mt-10 text-[10px] italic">Aguardando dados...</div>
                            ) : (
                                <div className="relative border-l-2 border-slate-100 ml-2 space-y-4">
                                    {insights.map((ev, idx) => (
                                        <div key={idx} className="relative pl-5 cursor-pointer hover:bg-slate-50 transition p-1 rounded" onClick={() => ev.coord && setFocusedCoord(ev.coord)} onMouseEnter={() => setHoveredEventId(ev.id)} onMouseLeave={() => setHoveredEventId(null)}>
                                            <div className={`absolute -left-[9px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${ev.type === 'AUDIT' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                                            <div className="text-[10px] font-bold text-slate-400">{ev.time}</div>
                                            <div className="text-xs font-black text-slate-700 leading-tight">{ev.description}</div>
                                            <div className="text-[9px] text-slate-500 line-clamp-1">{ev.details}</div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            roteiroManualData.length === 0 ? (
                                <div className="text-center text-slate-400 mt-10 text-[10px] italic">Importe o roteiro para visualizar.</div>
                            ) : (
                                <div className="space-y-3 flex flex-col h-full">
                                    <div className="space-y-2 shrink-0">
                                        <input
                                            type="text"
                                            placeholder="Buscar promotor ou setor..."
                                            className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                                            value={promoterSearchTerm}
                                            onChange={(e) => setPromoterSearchTerm(e.target.value)}
                                        />
                                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                                            <button onClick={() => setPromoterTeamFilter('ALL')} className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${promoterTeamFilter === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Todos</button>
                                            <button onClick={() => setPromoterTeamFilter('100')} className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${promoterTeamFilter === '100' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Equipe 100</button>
                                            <button onClick={() => setPromoterTeamFilter('200')} className={`flex-1 text-[10px] font-bold py-1 rounded transition-colors ${promoterTeamFilter === '200' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>Equipe 200</button>
                                        </div>
                                    </div>
                                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pb-2">
                                        {filteredPromotersList.map(p => {
                                            const isFictional = p.id.startsWith('-');
                                            const displayId = isFictional ? 'N/C' : p.id;
                                            return (
                                                <div key={p.id} className={`p-2 border rounded-xl transition-all cursor-pointer ${selectedPromoterForRoute === p.id ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 hover:border-indigo-200'}`} onClick={() => setSelectedPromoterForRoute(selectedPromoterForRoute === p.id ? 'ALL' : p.id)}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-black text-slate-700 truncate mr-2" title={p.nome}>{p.nome}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-1.5">
                                                        <div className="text-[9px] font-bold text-slate-400 uppercase">Setor: {displayId}</div>
                                                        <div className="flex gap-1">
                                                            <span className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm flex items-center" title="Clientes Únicos"><UserGroupIcon className="w-2.5 h-2.5 mr-1 text-slate-400"/>{p.uniqueClientsCount}</span>
                                                            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded shadow-sm flex items-center" title="Total de Visitas na Semana"><ClipboardListIcon className="w-2.5 h-2.5 mr-1 text-indigo-400"/>{p.visitsCount}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {filteredPromotersList.length === 0 && (
                                            <div className="text-center text-slate-400 text-[10px] italic mt-4">Nenhum promotor encontrado.</div>
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL DE OTIMIZAÇÃO DE ROTAS */}
            {isOptimizerModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-full">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 flex items-center">
                                <CogIcon className="w-5 h-5 mr-2 text-indigo-600"/> Configuração de Roteirização
                            </h3>
                            <button onClick={() => setIsOptimizerModalOpen(false)} className="text-slate-400 hover:text-red-500 transition">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-5 flex-1 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1">Máximo de Clientes por Dia</label>
                                <input 
                                    type="number" 
                                    value={optMaxClients} 
                                    onChange={(e) => setOptMaxClients(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                                />
                                <p className="text-[9px] text-slate-400 mt-1">Sábado (se selecionado) calculará metade deste valor.</p>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-1">Máximo de KM por Rota (Dia)</label>
                                <input 
                                    type="number" 
                                    value={optMaxKm} 
                                    onChange={(e) => setOptMaxKm(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-2">Dias da Semana Permitidos</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'].map(day => (
                                        <label key={day} className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={optDays.includes(day)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setOptDays([...optDays, day]);
                                                    } else {
                                                        setOptDays(optDays.filter(d => d !== day));
                                                    }
                                                }}
                                                className="rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>{day.split('-')[0]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-2">
                            <button 
                                onClick={() => setIsOptimizerModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleOptimizeRoutes}
                                disabled={loading}
                                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition disabled:opacity-50 flex items-center"
                            >
                                {loading ? <SpinnerIcon className="w-4 h-4 animate-spin"/> : 'Gerar Roteiro Otimizado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
