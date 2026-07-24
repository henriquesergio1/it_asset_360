
import React, { useState, useMemo, useEffect, useContext } from 'react';
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { DataContext } from './context/DataContext';
import { getPromoterClients, saveRotaPrevista, getOSRMData } from './services/apiService';
import { VisitaPrevista, Colaborador } from './types';
import { LocationMarkerIcon, SpinnerIcon, CalculatorIcon, ChevronRightIcon, ChevronDownIcon, ArrowLeftIcon, GlobeIcon, RefreshIcon, UsersIcon, ExclamationIcon, CheckCircleIcon, TrashIcon, CalendarIcon, PlusCircleIcon, XCircleIcon, UserGroupIcon } from './icons';
import L from 'leaflet';

// --- CONFIGURAÇÃO DE ÍCONES ---
const houseIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/619/619153.png',
    iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38]
});

const centroidIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149060.png', // Ícone de Pin/Target para centroide
    iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
});

const createNumberedIcon = (number: number) => {
    return L.divIcon({
        className: 'numbered-marker-wrapper',
        html: `<div style="background-color:#2563eb; color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:2px solid white; font-weight:bold; font-size:13px; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">${number}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14]
    });
};

const ignoredIcon = L.divIcon({
    className: 'ignored-marker-wrapper',
    html: `<div style="background-color:#94a3b8; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); opacity: 0.8;"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10]
});

// --- HELPERS GEOGRÁFICOS ---
const calcDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

// Helper para delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatDate = (iso: string) => {
    if(!iso) return '';
    try { const parts = iso.split('T')[0].split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; } catch(e) { return iso; }
};

// Identificador único para exclusão
const getPointId = (v: VisitaPrevista) => `${v.Cod_Cliente}-${v.Data_da_Visita}`;

const optimizeRoute = (points: VisitaPrevista[], colab?: Colaborador): VisitaPrevista[] => {
    const validPoints = points.filter(p => p.Lat && p.Long && p.Lat !== 0);
    
    // Se não tem pontos válidos e nem casa cadastrada, retorna vazio
    if (validPoints.length === 0 && (!colab || !colab.LatitudeBase)) return [];

    let startLat = 0;
    let startLong = 0;
    let startLabel = "";
    let startAddress = "";
    let isCentroid = false;

    if (colab?.LatitudeBase && colab?.LongitudeBase) {
        // Caso 1: Tem endereço base cadastrado
        startLat = Number(colab.LatitudeBase);
        startLong = Number(colab.LongitudeBase);
        startLabel = "PONTO DE PARTIDA (CASA)";
        startAddress = colab.EnderecoBase || "Endereço Base Cadastrado";
    } else {
        // Caso 2: Não tem endereço -> Calcula CENTROIDE (Média das coordenadas)
        isCentroid = true;
        if (validPoints.length > 0) {
            const totalLat = validPoints.reduce((sum, p) => sum + p.Lat, 0);
            const totalLong = validPoints.reduce((sum, p) => sum + p.Long, 0);
            startLat = totalLat / validPoints.length;
            startLong = totalLong / validPoints.length;
            startLabel = "PONTO DE PARTIDA (CENTROIDE)";
            startAddress = "Ponto médio calculado (Sem endereço base)";
        } else {
            return []; // Sem casa e sem pontos, impossível traçar
        }
    }

    // Define o ponto de partida (Nó 0)
    let startNode: VisitaPrevista = {
        Cod_Vend: colab?.CodigoSetor || 0, 
        Nome_Vendedor: colab?.Nome || "Sistema", 
        Cod_Supervisor: 0, Nome_Supervisor: "", Cod_Cliente: 0,
        Razao_Social: startLabel, 
        Dia_Semana: "", Periodicidade: "", Data_da_Visita: "",
        Endereco: startAddress, 
        Bairro: "", Cidade: "", CEP: "",
        Lat: startLat, 
        Long: startLong
    };

    // Algoritmo Vizinho Mais Próximo
    const sortedPath: VisitaPrevista[] = [startNode];
    const remaining = [...validPoints];
    let current = startNode;

    while (remaining.length > 0) {
        let nearestIdx = -1; let minDist = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const d = calcDistance(current.Lat, current.Long, remaining[i].Lat, remaining[i].Long);
            if (d < minDist) { minDist = d; nearestIdx = i; }
        }
        if (nearestIdx !== -1) { 
            current = remaining[nearestIdx]; 
            sortedPath.push(current); 
            remaining.splice(nearestIdx, 1); 
        }
        else break;
    }
    
    // Adiciona flag visual para saber se é centroide
    (sortedPath[0] as any).isCentroid = isCentroid;

    return sortedPath;
};

const MapAutoFit: React.FC<{ points: any[] }> = ({ points }) => {
    const map = useMap();
    useEffect(() => {
        if (points?.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p[0] || p.Lat, p[1] || p.Long]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [map, points]);
    return null;
};

const MapModal: React.FC<{ route: any; onCalculated: (km: number) => void; onTogglePoint: (point: VisitaPrevista) => void; onClose: () => void }> = ({ route, onCalculated, onTogglePoint, onClose }) => {
    const [idaCoords, setIdaCoords] = useState<any[]>([]);
    const [retornoCoords, setRetornoCoords] = useState<any[]>([]);
    const [kmRealLocal, setKmRealLocal] = useState<number | null>(route.kmReal || null);
    const [loadingMap, setLoadingMap] = useState(true);

    // Cria um hash das coordenadas para evitar re-renderizações infinitas
    const pointsHash = useMemo(() => {
        return JSON.stringify(route.validPoints.map((p: any) => `${p.Lat.toFixed(5)},${p.Long.toFixed(5)}`));
    }, [route.validPoints]);

    useEffect(() => {
        // Se a rota for de um inativo, não calcula nada
        if (route.isInactive) {
            setKmRealLocal(0);
            setLoadingMap(false);
            return;
        }

        const loadGeometry = async () => {
            setLoadingMap(true);
            const data = await getOSRMData(route.validPoints, route.isRoundTrip);
            if (data) {
                const geom = data.geometry;
                if (route.isRoundTrip && route.validPoints.length > 1) {
                    // Encontrar o índice da coordenada que representa o último cliente na geometria
                    // Percorremos os pontos da rota em ordem para garantir que pegamos o índice correto da "ida"
                    let currentSearchIdx = 0;
                    for (let pIdx = 0; pIdx < route.validPoints.length; pIdx++) {
                        const target = route.validPoints[pIdx];
                        let bestIdxForThisPoint = currentSearchIdx;
                        let bestDistForThisPoint = Infinity;
                        
                        for (let i = currentSearchIdx; i < geom.length; i++) {
                            const d = calcDistance(geom[i][0], geom[i][1], target.Lat, target.Long);
                            if (d < bestDistForThisPoint) {
                                bestDistForThisPoint = d;
                                bestIdxForThisPoint = i;
                            }
                            if (d < 0.03) break; // Se estiver a menos de 30m, considera que achou o ponto
                        }
                        currentSearchIdx = bestIdxForThisPoint;
                    }
                    const splitIdx = currentSearchIdx;

                    setIdaCoords(geom.slice(0, splitIdx + 1));
                    setRetornoCoords(geom.slice(splitIdx));
                } else {
                    setIdaCoords(geom);
                }
                setKmRealLocal(data.distance);
                
                if (Math.abs((route.kmReal || 0) - data.distance) > 0.01) {
                    onCalculated(data.distance);
                }
            } else {
                setIdaCoords([]);
                setRetornoCoords([]);
                setKmRealLocal(0);
                if (route.kmReal !== 0) onCalculated(0);
            }
            setLoadingMap(false);
        };
        loadGeometry();
    }, [pointsHash, route.isRoundTrip, route.isInactive]);

    const getIcon = (point: any) => {
        if (point.isExcluded) return ignoredIcon;
        // O index está na propriedade mapIndex que calculamos no pai
        if (point.mapIndex === 0) {
            return point.isCentroid ? centroidIcon : houseIcon;
        }
        return createNumberedIcon(point.mapIndex);
    };

    return (
        <div className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden border border-white/20">
                <div className="p-6 border-b flex justify-between items-center bg-white z-10 shadow-sm">
                    <div className="flex items-center">
                        <button onClick={onClose} className="mr-5 p-2.5 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-600 border border-slate-100"><ArrowLeftIcon className="w-6 h-6"/></button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center">
                                {route.sellerId} - {route.sellerName} | {formatDate(route.date)}
                                <span className="ml-3 bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 uppercase font-black">{route.dayName}</span>
                                {route.isInactive && <span className="ml-3 bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full border border-red-200 uppercase font-black">INATIVO</span>}
                            </h2>
                            <div className="flex items-center gap-4 mt-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Estimado: <span className="text-slate-600 font-black">{route.km.toFixed(1)} km</span></p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Real (Vias): <span className="text-emerald-600 font-black">{kmRealLocal !== null ? kmRealLocal.toFixed(1) + ' km' : 'Traçando...'}</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                         <div className="hidden md:flex gap-4">
                            <div className="flex items-center text-[10px] font-black text-blue-600 uppercase"><span className="w-3 h-1 bg-blue-600 mr-2 rounded-full"></span> Trajeto Ida</div>
                            <div className="flex items-center text-[10px] font-black text-orange-500 uppercase"><span className="w-3 h-1 bg-orange-500 mr-2 rounded-full"></span> Retorno Casa</div>
                        </div>
                        <button onClick={onClose} className="px-8 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95">FECHAR</button>
                    </div>
                </div>
                <div className="flex-1 relative">
                    {loadingMap && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-50/80">
                            <SpinnerIcon className="w-12 h-12 text-blue-600 animate-spin mb-4"/>
                            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Calculando rota terrestre segura...</p>
                        </div>
                    )}
                    <MapContainer center={[route.validPoints[0]?.Lat || 0, route.validPoints[0]?.Long || 0]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <MapAutoFit points={route.allPoints} />
                        
                        {/* Linhas de Rota (Apenas para pontos válidos e se não for inativo) */}
                        {!route.isInactive && (
                            <>
                                <Polyline positions={idaCoords} color="#2563eb" weight={7} opacity={0.7} lineJoin="round" />
                                {retornoCoords.length > 0 && <Polyline positions={retornoCoords} color="#f97316" weight={7} opacity={0.8} dashArray="10, 10" />}
                            </>
                        )}
                        
                        {/* Marcadores (Para todos os pontos, inclusive excluídos) */}
                        {route.allPoints.map((p: any, idx: number) => (
                            <Marker key={idx} position={[p.Lat, p.Long]} icon={getIcon(p)} opacity={p.isExcluded ? 0.6 : 1}>
                                <Popup>
                                    <div className="p-1 min-w-[260px]">
                                        <div className="mb-3 border-b border-slate-100 pb-2">
                                            <p className={`font-black text-[10px] uppercase mb-1 ${p.isExcluded ? 'text-slate-400' : 'text-blue-600'}`}>
                                                {p.isExcluded 
                                                    ? "PONTO IGNORADO (FORA DA ROTA)" 
                                                    : (p.mapIndex === 0 
                                                        ? (p.isCentroid ? "PONTO MÉDIO CALCULADO (CENTROIDE)" : "PARTIDA/RETORNO (CASA)") 
                                                        : `SEQUÊNCIA DA VISITA #${p.mapIndex}`
                                                    )
                                                }
                                            </p>
                                            <p className="text-sm font-black text-slate-800 leading-tight">
                                                {p.mapIndex === 0 && !p.isExcluded ? p.Nome_Vendedor : `${p.Cod_Cliente} - ${p.Razao_Social}`}
                                            </p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Localização:</p>
                                                <p className="text-[11px] text-slate-600 font-medium leading-snug">
                                                    {p.Endereco}{p.Cidade ? `, ${p.Cidade}` : ''}
                                                </p>
                                            </div>
                                            
                                            {p.mapIndex !== 0 && (
                                                <div className="flex gap-4">
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Visita:</p>
                                                        <p className="text-[10px] font-bold text-slate-700">{p.Dia_Semana || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Periodicidade:</p>
                                                        <p className="text-[10px] font-bold text-slate-700">{p.Periodicidade || '-'}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {p.mapIndex !== 0 && (
                                            <div className="mt-4 pt-2 border-t border-slate-100 flex justify-end">
                                                {p.isExcluded ? (
                                                    <button 
                                                        onClick={() => onTogglePoint(p)}
                                                        className="flex items-center text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition-colors"
                                                    >
                                                        <PlusCircleIcon className="w-3 h-3 mr-1.5"/>
                                                        Adicionar ao Cálculo
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => onTogglePoint(p)}
                                                        className="flex items-center text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded transition-colors"
                                                    >
                                                        <XCircleIcon className="w-3 h-3 mr-1.5"/>
                                                        Remover do Cálculo
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};


function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
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
}

export const RoteirizadorPromotores: React.FC = () => {
    const { colaboradores, systemConfig } = useContext(DataContext);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [file, setFile] = useState<File | null>(null);
    const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
    const [nameMappings, setNameMappings] = useState<Record<string, number>>({});
    const [showMappingModal, setShowMappingModal] = useState(false);
    const [pendingParsedData, setPendingParsedData] = useState<VisitaPrevista[]>([]);

    const [tortuosity, setTortuosity] = useState(1.3);
    const [isRoundTrip, setIsRoundTrip] = useState(true);
    const [loading, setLoading] = useState(false);
    const [calculatingReal, setCalculatingReal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rawData, setRawData] = useState<VisitaPrevista[]>([]);
    const [realDistances, setRealDistances] = useState<Map<string, number>>(new Map());
    const [expandedSellers, setExpandedSellers] = useState<Set<number>>(new Set());
    const [viewingRoute, setViewingRoute] = useState<any | null>(null);
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>(''); // Filtro Supervisor
    
    // CHECKBOX SELECTION STATE (NOVO)
    const [selectedSellerIds, setSelectedSellerIds] = useState<Set<number>>(new Set());
    
    // STATUS DE PROGRESSO
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const [realKmAdjustment, setRealKmAdjustment] = useState(10);
    const [shouldAutoCalculate, setShouldAutoCalculate] = useState(false);
    
    // Obter parâmetros de alerta da configuração global
    const MAX_DAILY_KM = systemConfig.alertMaxDailyKM || 400;
    const MAX_CLIENT_DIST = systemConfig.alertMaxClientDist || 100;

    
    const processParsedData = (parsedData: VisitaPrevista[], mappings: Record<string, number>) => {
        const finalData = parsedData.map(v => {
            const mappedId = mappings[v.Nome_Vendedor];
            if (mappedId) {
                v.Cod_Vend = Number(mappedId);
            }
            return v;
        }).filter(v => v.Cod_Vend && v.Cod_Vend !== 0); // Remove os que não foram mapeados ou IDs inválidos

        if (finalData.length === 0) {
            alert("Nenhum dado válido restou após o mapeamento de promotores.");
            setLoading(false);
            return;
        }

        setRawData(finalData); 
        const allIds = new Set(finalData.map(d => d.Cod_Vend));
        setSelectedSellerIds(allIds);
        setShouldAutoCalculate(true);
        setLoading(false);
    };

    const getDatesInRange = (start: string, end: string, dayOfWeekOrDate: any): string[] => {
        if (dayOfWeekOrDate === undefined || dayOfWeekOrDate === null || dayOfWeekOrDate === '') return [];
        
        const dates: string[] = [];
        const sDate = new Date(start + 'T00:00:00');
        const eDate = new Date(end + 'T00:00:00');

        if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) return [];

        const dayMap: Record<string, number> = {
            'DOMINGO': 0, 'DOM': 0, '7': 0,
            'SEGUNDA': 1, 'SEG': 1, 'SEGUNDA-FEIRA': 1, 'SEGUNDA FEIRA': 1, '1': 1, '2A': 1, '2A FEIRA': 1, '2ª': 1, '2ª FEIRA': 1,
            'TERCA': 2, 'TER': 2, 'TERCA-FEIRA': 2, 'TERCA FEIRA': 2, '2': 2, '3A': 2, '3A FEIRA': 2, '3ª': 2, '3ª FEIRA': 2,
            'QUARTA': 3, 'QUA': 3, 'QUARTA-FEIRA': 3, 'QUARTA FEIRA': 3, '3': 3, '4A': 3, '4A FEIRA': 3, '4ª': 3, '4ª FEIRA': 3,
            'QUINTA': 4, 'QUI': 4, 'QUINTA-FEIRA': 4, 'QUINTA FEIRA': 4, '4': 4, '5A': 4, '5A FEIRA': 4, '5ª': 4, '5ª FEIRA': 4,
            'SEXTA': 5, 'SEX': 5, 'SEXTA-FEIRA': 5, 'SEXTA FEIRA': 5, '5': 5, '6A': 5, '6A FEIRA': 5, '6ª': 5, '6ª FEIRA': 5,
            'SABADO': 6, 'SAB': 6, 'SABADO-FEIRA': 6, 'SABADO FEIRA': 6, '6': 6, '7A': 6, '7A FEIRA': 6, '7ª': 6, '7ª FEIRA': 6
        };

        // Tratar se for um objeto Date do Excel ou número de série
        let value = dayOfWeekOrDate;
        if (typeof value === 'number' && value > 40000) {
            // Converter serial do Excel para data JS
            value = new Date((value - 25569) * 86400 * 1000);
        }

        if (value instanceof Date && !isNaN(value.getTime())) {
            const iso = value.toISOString().split('T')[0];
            if (iso >= start && iso <= end) return [iso];
            return [];
        }

        const strValue = String(value).toUpperCase().trim();
        const cleanDay = strValue.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Tentar match direto ou normalizado
        const targetDay = dayMap[cleanDay] !== undefined ? dayMap[cleanDay] : dayMap[strValue];

        if (targetDay === undefined) {
            let specificDate: Date | null = null;
            if (strValue.includes('/')) {
                const parts = strValue.split('/');
                if (parts.length === 3) {
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    specificDate = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T00:00:00`);
                }
            } else if (strValue.includes('-')) {
                specificDate = new Date(strValue + (strValue.includes('T') ? '' : 'T00:00:00'));
            }

            if (specificDate && !isNaN(specificDate.getTime())) {
                const iso = specificDate.toISOString().split('T')[0];
                if (iso >= start && iso <= end) return [iso];
            }
            return [];
        }

        let current = new Date(sDate);
        while (current <= eDate) {
            if (current.getDay() === targetDay) {
                dates.push(current.toISOString().split('T')[0]);
            }
            current.setDate(current.getDate() + 1);
            if (dates.length > 100) break; 
        }
        return dates;
    };

    const handleCalculate = async () => {
        if (!file) {
            alert("Por favor, selecione um arquivo Excel (.xlsx ou .csv).");
            return;
        }
        setLoading(true); setRawData([]); setRealDistances(new Map()); setExcludedIds(new Set()); setSelectedSupervisor(''); setSelectedSellerIds(new Set());
        try { 
            const clients = await getPromoterClients();
            const clientMap = new Map();
            clients.forEach(c => clientMap.set(String(c.Cod_Cliente), c));

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);

                    const parsedData: VisitaPrevista[] = [];
                    const uniqueNames = new Set<string>();

                    json.forEach((row: any) => {
                        const nome = row['NOME DO COLABORADOR'] || row['Nome'] || row['Colaborador'];
                        const diaSemana = row['SEMANA'] || row['DIA SEMANA'] || row['Dia'] || row['Data'];
                        const codPdv = row['CODIGO PDV'] || row['Cod_Cliente'] || row['Codigo'];

                        if (nome && codPdv) {
                            const targetDates = getDatesInRange(startDate, endDate, diaSemana);
                            
                            if (targetDates.length > 0) {
                                uniqueNames.add(nome);
                                const clientData = clientMap.get(String(codPdv));
                                targetDates.forEach(date => {
                                    parsedData.push({
                                        Cod_Vend: 0, 
                                        Nome_Vendedor: nome,
                                        Cod_Supervisor: 0,
                                        Nome_Supervisor: 'Equipe Merchandising',
                                        Cod_Cliente: codPdv,
                                        Razao_Social: clientData ? clientData.Razao_Social : `Cliente ${codPdv}`,
                                        Dia_Semana: diaSemana || '',
                                        Periodicidade: '',
                                        Data_da_Visita: date,
                                        Endereco: clientData ? clientData.Endereco : '',
                                        Bairro: clientData ? clientData.Bairro : '',
                                        Cidade: clientData ? clientData.Cidade : '',
                                        CEP: clientData ? clientData.CEP : '',
                                        Lat: clientData ? Number(clientData.Lat) : 0,
                                        Long: clientData ? Number(clientData.Long) : 0
                                    });
                                });
                            }
                        }
                    });

                    if (parsedData.length === 0) {
                        alert("Nenhuma visita encontrada para o período selecionado. Verifique se o arquivo contém os dias da semana corretos para o intervalo escolhido.");
                        setLoading(false);
                        return;
                    }

                    // Lógica de Match
                    const newMappings: Record<string, number> = { ...nameMappings };
                    const unmatched: string[] = [];

                    uniqueNames.forEach(nome => {
                        if (newMappings[nome]) return; // Já mapeado

                        const upperNome = nome.toUpperCase();
                        // Busca blindada por Nome e Grupo (Promotor)
                        let colab = colaboradores.find(c => 
                            c.Nome.trim().toUpperCase() === upperNome.trim() && 
                            c.Ativo && 
                            (String(c.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(c.Grupo).trim().toUpperCase() === 'PROMOTORES')
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
                        setPendingParsedData(parsedData);
                        setShowMappingModal(true);
                        setLoading(false);
                    } else {
                        processParsedData(parsedData, newMappings);
                    }

                } catch (err: any) {
                    alert("Erro ao processar arquivo: " + err.message);
                    setLoading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } 
        catch (e: any) { alert(e.message); setLoading(false); }
    };


    // Efeito para disparar o cálculo automático após carregar os dados
    useEffect(() => {
        if (shouldAutoCalculate && rawData.length > 0 && !loading) {
            setShouldAutoCalculate(false);
            // Pequeno delay para garantir que o useMemo do groupedData processe os novos rawData
            setTimeout(() => {
                handleCalculateAllReal(true);
            }, 300);
        }
    }, [rawData, loading, shouldAutoCalculate]);

    // Extrair lista única de supervisores - AGORA ORDENADO POR CÓDIGO
    const supervisors = useMemo(() => {
        const map = new Map<string, string>();
        rawData.forEach(r => {
            if (r.Cod_Supervisor && r.Nome_Supervisor) {
                map.set(String(r.Cod_Supervisor), r.Nome_Supervisor);
            }
        });
        return Array.from(map.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a,b) => Number(a.id) - Number(b.id)); // Ordenação Numérica pelo ID
    }, [rawData]);

    const groupedData = useMemo(() => {
        try {
            const sellerMap = new Map<number, any>();
            
            rawData.forEach(v => {
                if (!v.Cod_Vend) return;
                // Filtro de Supervisor
                if (selectedSupervisor && String(v.Cod_Supervisor) !== selectedSupervisor) return;

                // Primeiro, tenta encontrar o colaborador na base de dados ignorando o status ativo para poder barrar se estiver inativo
                let rawColab = colaboradores.find(c => Number(c.CodigoSetor) === Number(v.Cod_Vend));
                
                if (rawColab && !rawColab.Ativo) {
                    // FILTRO CRÍTICO: Colaborador existe e está inativo -> IGNORAR COMPLETAMENTE
                    return;
                }

                // LÓGICA DE MATCH BLINDADA (Prioridade absoluta ao grupo Promotor)
                let colab = colaboradores.find(c => 
                    Number(c.CodigoSetor) === Number(v.Cod_Vend) && 
                    c.Ativo && 
                    (String(c.Grupo).trim().toUpperCase() === 'PROMOTOR' || String(c.Grupo).trim().toUpperCase() === 'PROMOTORES')
                );
                
                // Se não achou como promotor, busca qualquer match ativo
                if (!colab) {
                    colab = colaboradores.find(c => Number(c.CodigoSetor) === Number(v.Cod_Vend) && c.Ativo);
                }
                
                const colabRef = colab || {
                    ID_Colaborador: 0,
                    ID_Pulsus: 0,
                    CodigoSetor: v.Cod_Vend,
                    Nome: v.Nome_Vendedor,
                    Grupo: 'NÃO CADASTRADO',
                    TipoVeiculo: 'Carro',
                    Ativo: true,
                    LatitudeBase: 0,
                    LongitudeBase: 0,
                    EnderecoBase: ''
                };

                // Flag de Inativo - Crucial
                const isInactive = !colabRef.Ativo && colabRef.Grupo !== 'NÃO CADASTRADO';

                if (!sellerMap.has(v.Cod_Vend)) {
                    sellerMap.set(v.Cod_Vend, { 
                        id: v.Cod_Vend, 
                        name: v.Nome_Vendedor, 
                        supervisor: v.Nome_Supervisor, 
                        colabRef: colabRef, 
                        isInactive: isInactive, // Propaga flag
                        days: new Map<string, any>(),
                        hasAlert: false // Flag para alerta no vendedor
                    });
                }
                const dKey = v.Data_da_Visita?.substring(0, 10) || "Sem Data";
                if (!sellerMap.get(v.Cod_Vend).days.has(dKey)) sellerMap.get(v.Cod_Vend).days.set(dKey, []);
                sellerMap.get(v.Cod_Vend).days.get(dKey).push(v);
            });

            return Array.from(sellerMap.values()).map(seller => {
                const daysArr = []; let totalKm = 0; let totalKmReal = 0;
                let sellerHasAlert = false;

                for (const [date, rawVisits] of seller.days.entries()) {
                    // Separa ativos de excluídos
                    const activeVisits: VisitaPrevista[] = [];
                    const excludedVisits: VisitaPrevista[] = [];

                    rawVisits.forEach((v: VisitaPrevista) => {
                        if (excludedIds.has(getPointId(v))) {
                            excludedVisits.push({ ...v, isExcluded: true } as any);
                        } else {
                            activeVisits.push(v);
                        }
                    });

                    // Se o colaborador for inativo, FORÇA rota vazia e KM 0, mas mantém os pontos para visualização
                    let optPoints: VisitaPrevista[] = [];
                    if (seller.isInactive) {
                        optPoints = []; // Não otimiza rota
                        const dummyStart = optimizeRoute(activeVisits, seller.colabRef); 
                        optPoints = dummyStart;
                    } else {
                        optPoints = optimizeRoute(activeVisits, seller.colabRef);
                    }
                    
                    // Adiciona index para o mapa (apenas para os ativos)
                    const validPointsWithIndex = optPoints.map((p, i) => ({ ...p, mapIndex: i, isExcluded: false }));
                    
                    // Junta tudo para exibir no mapa (ativos + excluídos)
                    const allPoints = [...validPointsWithIndex, ...excludedVisits];

                    let kmReta = 0;
                    
                    // Só calcula distância se NÃO for inativo
                    if (!seller.isInactive) {
                        // Distância total da rota (apenas pontos válidos)
                        for (let i = 0; i < optPoints.length - 1; i++) kmReta += calcDistance(optPoints[i].Lat, optPoints[i].Long, optPoints[i+1].Lat, optPoints[i+1].Long);
                        if (isRoundTrip && optPoints.length > 1) kmReta += calcDistance(optPoints[optPoints.length-1].Lat, optPoints[optPoints.length-1].Long, optPoints[0].Lat, optPoints[0].Long);
                    }

                    const kmEstBase = kmReta * tortuosity;
                    const kmEst = kmEstBase > 0 ? kmEstBase * (1 + realKmAdjustment / 100) : 0;
                    const kmRealBase = seller.isInactive ? 0 : (realDistances.get(`${seller.id}-${date}`) || 0);
                    const kmReal = kmRealBase > 0 ? kmRealBase * (1 + realKmAdjustment / 100) : 0;
                    
                    totalKm += kmEst; totalKmReal += kmReal;

                    // Análise de Rota Suspeita (Parametrizada) - Apenas nos ativos e se não for inativo
                    let alert = null;
                    if (!seller.isInactive) {
                        if (kmEst > MAX_DAILY_KM) {
                            alert = `KM Diário Excessivo (>${MAX_DAILY_KM}km)`;
                            sellerHasAlert = true;
                        } else if (optPoints.length > 1) {
                            const startP = optPoints[0];
                            for (let i = 1; i < optPoints.length; i++) {
                                const distFromStart = calcDistance(startP.Lat, startP.Long, optPoints[i].Lat, optPoints[i].Long);
                                if (distFromStart > MAX_CLIENT_DIST) {
                                    alert = `Cliente muito distante (>${MAX_CLIENT_DIST}km)`;
                                    sellerHasAlert = true;
                                    break;
                                }
                            }
                        }
                    }

                    // Filtragem da Periodicidade: Ignorar "1234"
                    const rawPeriodicity = rawVisits[0].Periodicidade;
                    const displayPeriodicity = rawPeriodicity === '1234' ? '' : rawPeriodicity;

                    daysArr.push({ 
                        date, 
                        dayName: rawVisits[0].Dia_Semana, 
                        periodicity: displayPeriodicity, // Valor filtrado
                        km: kmEst, 
                        kmReal: kmReal, 
                        validPoints: optPoints, // Usado para cálculo e linha
                        allPoints: allPoints,   // Usado para renderizar marcadores (com fantasmas)
                        isRoundTrip, 
                        sellerId: seller.id, 
                        sellerName: seller.name, 
                        visitCount: activeVisits.length, // Conta apenas ativos
                        alert,
                        isInactive: seller.isInactive // Passa para o dia
                    });
                }
                return { ...seller, totalKm, totalKmReal, days: daysArr.sort((a,b) => a.date.localeCompare(b.date)), hasAlert: sellerHasAlert };
            }).sort((a,b) => (Number(a.id) || 0) - (Number(b.id) || 0));
        } catch (e) {
            console.error("Erro ao agrupar dados:", e);
            return [];
        }
    }, [rawData, tortuosity, isRoundTrip, colaboradores, realDistances, excludedIds, selectedSupervisor, MAX_DAILY_KM, MAX_CLIENT_DIST]);

    // Sincroniza o modal aberto com os novos dados calculados (caso um ponto seja removido/adicionado)
    useEffect(() => {
        if (viewingRoute) {
            const updatedSeller = groupedData.find(s => s.id === viewingRoute.sellerId);
            if (updatedSeller) {
                const updatedDay = updatedSeller.days.find((d: any) => d.date === viewingRoute.date);
                if (updatedDay) {
                    setViewingRoute(updatedDay);
                }
            }
        }
    }, [groupedData]);

    // --- SELECTION HELPERS ---
    const toggleSelectAll = (checked: boolean) => {
        if (checked) {
            // Seleciona todos os VISÍVEIS (baseado no filtro atual)
            const visibleIds = groupedData.map(s => s.id);
            // Mantém os que já estavam selecionados e adiciona os visíveis
            setSelectedSellerIds(prev => {
                const next = new Set<number>(prev);
                visibleIds.forEach(id => next.add(id));
                return next;
            });
        } else {
            // Remove apenas os VISÍVEIS da seleção
            const visibleIds = new Set(groupedData.map(s => s.id));
            setSelectedSellerIds(prev => {
                const next = new Set<number>();
                prev.forEach(id => {
                    if (!visibleIds.has(id)) next.add(id); // Mantém os que não estão visíveis
                });
                return next;
            });
        }
    };

    const toggleSelectOne = (id: number) => {
        const newSet = new Set(selectedSellerIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSellerIds(newSet);
    };

    const isAllVisibleSelected = groupedData.length > 0 && groupedData.every(s => selectedSellerIds.has(s.id));

    const handleTogglePoint = (point: VisitaPrevista) => {
        const id = getPointId(point);
        const newSet = new Set(excludedIds);
        if (newSet.has(id)) {
            newSet.delete(id); // Re-adicionar
        } else {
            newSet.add(id); // Remover
        }
        setExcludedIds(newSet);
    };

    const handleCalculateSellerReal = async (seller: any) => {
        if (seller.isInactive) return; // Segurança extra
        setCalculatingReal(true);
        const newMap = new Map(realDistances);
        try {
            for (const day of seller.days) {
                const key = `${seller.id}-${day.date}`;
                // Recalcula se não tiver ou para garantir atualização após remoção de ponto
                const data = await getOSRMData(day.validPoints, isRoundTrip);
                if (data) newMap.set(key, data.distance);
                else newMap.set(key, 0); // Zera se não houver rota válida
            }
            setRealDistances(newMap);
        } catch (e) {
            console.error("Erro na API OSRM.");
        } finally {
            setCalculatingReal(false);
        }
    };

    const handleCalculateAllReal = async (isInitialAuto = false) => {
        // FILTRAGEM: Apenas os selecionados
        const sellersToProcess = groupedData.filter(s => selectedSellerIds.has(s.id) && !s.isInactive);
        
        if (sellersToProcess.length === 0) {
            if (!isInitialAuto) alert("Nenhum vendedor selecionado (ou todos selecionados são inativos).");
            return;
        }

        if (!isInitialAuto && !confirm(`Isso iniciará o processamento em ALTA VELOCIDADE de ${sellersToProcess.length} roteiros selecionados. Continuar?`)) return;
        
        setCalculatingReal(true);
        // Não clonamos o map inteiro aqui para state, vamos atualizar progressivamente.
        // Apenas para verificação interna usamos um map auxiliar se necessário, mas o principal é o state.
        
        // 1. Identificar tarefas pendentes (Flatten)
        const tasks: { key: string, points: VisitaPrevista[] }[] = [];
        sellersToProcess.forEach(seller => {
            seller.days.forEach((day: any) => {
                const key = `${seller.id}-${day.date}`;
                // Recalcula se não tiver ou para garantir (pode ser otimizado para !realDistances.has(key))
                // mas user pode querer forçar recalculo. Vamos manter comportamento de recalcular.
                if (day.validPoints.length >= 2) {
                    tasks.push({ key, points: day.validPoints });
                }
            });
        });

        const totalToProcess = tasks.length;
        if (totalToProcess === 0) {
            setProgress({ current: 1, total: 1 });
            setCalculatingReal(false);
            return;
        }

        setProgress({ current: 0, total: totalToProcess });
        let processedCount = 0;

        // 2. Worker Function
        const processTask = async (task: { key: string, points: VisitaPrevista[] }) => {
            try {
                const data = await getOSRMData(task.points, isRoundTrip);
                const dist = data ? data.distance : 0;
                
                // ATUALIZAÇÃO PROGRESSIVA DO ESTADO (Para feedback visual imediato)
                setRealDistances(prev => {
                    const next = new Map(prev);
                    next.set(task.key, dist);
                    return next;
                });

            } catch (e) {
                console.warn("Falha persistente no cálculo da rota terrestre:", task.key);
                // Fallback já está implícito: se dist é 0 ou não setado, a UI usa o km estimado (tortuosidade)
                setRealDistances(prev => {
                    const next = new Map(prev);
                    next.set(task.key, 0);
                    return next;
                });
            } finally {
                processedCount++;
                // Atualiza barra de progresso (menos frequente para não travar render, ex: a cada 1 ou 5)
                // Como queremos visual, a cada 1 é ok se a lista não for gigante.
                setProgress({ current: processedCount, total: totalToProcess });
                await sleep(10); // REDUZIDO PARA 10ms POIS O SERVIDOR É LOCAL
            }
        };

        // 3. Concurrency Pool
        // AUMENTADO PARA 10 POIS O SERVIDOR É LOCAL (8GB RAM)
        const CONCURRENCY_LIMIT = 10; 
        const activePromises: Set<Promise<void>> = new Set();

        for (const task of tasks) {
            if (activePromises.size >= CONCURRENCY_LIMIT) {
                await Promise.race(activePromises);
            }
            const p = processTask(task);
            activePromises.add(p);
            p.then(() => activePromises.delete(p));
        }

        await Promise.all(activePromises);
        
        setCalculatingReal(false);
        setProgress({ current: 0, total: 0 });
    };

    const handleSaveForecast = async () => {
        // FILTRAGEM: Apenas os selecionados
        const sellersToSave = groupedData.filter(s => selectedSellerIds.has(s.id));
        
        if (sellersToSave.length === 0) {
            alert("Nenhum vendedor selecionado para salvar.");
            return;
        }

        const totalKmCalculado = sellersToSave.reduce((acc, curr) => acc + (curr.totalKmReal || curr.totalKm), 0);
        
        const supervisorTag = selectedSupervisor 
            ? ` - Equipe ${supervisors.find(s => s.id === selectedSupervisor)?.name.split(' ')[0]}` 
            : '';
        const formattedPeriod = `[PROMOTOR] Importação Excel - ${new Date().toLocaleDateString()}${supervisorTag}`;
        
        if (!confirm(`Deseja salvar a simulação para ${sellersToSave.length} PROMOTORES selecionados?\nPeríodo: ${formattedPeriod}`)) return;

        setSaving(true);
        try {
            // Prepara o payload
            const payload = {
                Periodo: formattedPeriod,
                TotalKM: totalKmCalculado,
                Itens: sellersToSave.map(seller => ({
                    ID_Pulsus: seller.colabRef.ID_Pulsus || seller.id,
                    Nome: seller.name,
                    Grupo: seller.colabRef.Grupo,
                    TotalKM: seller.totalKmReal || seller.totalKm,
                    Dias: seller.days.map((d: any) => ({
                        Data: d.date,
                        KM: d.kmReal || d.km,
                        KMEstimado: d.km
                    }))
                })).filter(i => i.TotalKM > 0)
            };

            await saveRotaPrevista(payload);
            alert("Simulação salva com sucesso!");
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">

            {showMappingModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Vincular Promotores</h3>
                                <p className="text-sm text-slate-500 mt-1">Alguns nomes do Excel não foram encontrados no sistema.</p>
                            </div>
                            <button onClick={() => setShowMappingModal(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircleIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {unmatchedNames.map(nome => (
                                <div key={nome} className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <div className="flex-1 font-bold text-slate-700">{nome}</div>
                                    <div className="flex-1">
                                        <select 
                                            className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
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
                                    processParsedData(pendingParsedData, nameMappings);
                                }} 
                                className="px-6 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all"
                            >
                                Confirmar Vínculos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingRoute && (
                <MapModal 
                    route={viewingRoute} 
                    onCalculated={(km) => setRealDistances(p => { const n = new Map(p); n.set(`${viewingRoute.sellerId}-${viewingRoute.date}`, km); return n; })} 
                    onTogglePoint={handleTogglePoint}
                    onClose={() => setViewingRoute(null)} 
                />
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h2 className="text-3xl font-black text-slate-800 tracking-tight">Roteirizador Promotores</h2><p className="text-slate-500 font-medium">Controle e validação terrestre para a equipe de <b>Merchandising</b> via Excel.</p></div>
                <div className="flex gap-3">
                    {rawData.length > 0 && (
                        <button onClick={handleSaveForecast} disabled={saving || calculatingReal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-xl flex items-center transition-all disabled:opacity-50">
                            {saving ? <SpinnerIcon className="w-5 h-5 mr-3 animate-spin"/> : <CheckCircleIcon className="w-5 h-5 mr-3"/>}
                            SALVAR SIMULAÇÃO
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white p-7 rounded-3xl shadow-sm border border-slate-200 flex flex-wrap gap-5 items-end">
                <div className="w-64">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Arquivo Excel (.xlsx)</label>
                    <input type="file" accept=".xlsx, .xls, .csv" onChange={e => setFile(e.target.files ? e.target.files[0] : null)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                </div>

                <div className="w-44">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Data Início</label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-9 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"/>
                    </div>
                </div>

                <div className="w-44">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Data Fim</label>
                    <div className="relative">
                        <CalendarIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-9 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"/>
                    </div>
                </div>
                
                <div className="w-24"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Fator Tort.</label><input type="number" step="0.1" value={tortuosity} onChange={e => setTortuosity(parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm text-center font-black text-blue-600"/></div>
                <div className="w-24"><label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Adic. KM %</label><input type="number" step="1" value={realKmAdjustment} onChange={e => setRealKmAdjustment(parseFloat(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm text-center font-black text-emerald-600"/></div>
                
                {/* FILTRO DE SUPERVISOR */}
                {supervisors.length > 0 && (
                    <div className="w-56">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Equipe Supervisor</label>
                        <div className="relative">
                            <UserGroupIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                            <select 
                                value={selectedSupervisor} 
                                onChange={e => setSelectedSupervisor(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 pl-9 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 appearance-none"
                            >
                                <option value="">Todos os Supervisores</option>
                                {supervisors.map(sup => (
                                    <option key={sup.id} value={sup.id}>{sup.id} - {sup.name}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-4 w-4 h-4 text-slate-400 pointer-events-none"/>
                        </div>
                    </div>
                )}

                <button onClick={() => setIsRoundTrip(!isRoundTrip)} className={`h-[54px] px-6 rounded-2xl border-2 font-black text-[10px] uppercase transition-all flex items-center ${isRoundTrip ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm' : 'bg-white text-slate-300 border-slate-200'}`}><RefreshIcon className="w-4 h-4 mr-2"/> {isRoundTrip ? 'Calcular Ida e Volta' : 'Apenas Ida'}</button>
                <button 
                    onClick={handleCalculate} 
                    disabled={loading || calculatingReal || !file} 
                    className="h-[54px] bg-blue-600 hover:bg-blue-700 text-white font-black px-10 rounded-2xl shadow-xl flex items-center transition-all min-w-[240px]"
                >
                    {loading ? (
                        <><SpinnerIcon className="w-5 h-5 mr-3 animate-spin"/> PROCESSANDO...</>
                    ) : calculatingReal ? (
                        <div className="flex flex-col items-center justify-center w-full">
                            <div className="flex items-center mb-1">
                                <SpinnerIcon className="w-4 h-4 mr-2 animate-spin text-white"/>
                                <span className="text-[10px] font-bold uppercase">Calculando KM Real {progress.current}/{progress.total}</span>
                            </div>
                            <div className="w-full h-1.5 bg-blue-900/20 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-white transition-all duration-300 ease-out" 
                                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <><GlobeIcon className="w-5 h-5 mr-3"/> PROCESSAR ARQUIVO</>
                    )}
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-[0.1em] border-b border-slate-200">
                        <tr>
                            <th className="p-6 w-16 text-center"></th>
                            <th className="p-6">Vendedor (Cód - Nome)</th>
                            <th className="p-6">Supervisor</th>
                            <th className="p-6 text-center">Dias</th>
                            <th className="p-6 text-right">KM Estimado</th>
                            <th className="p-6 text-right">KM Real (OSRM)</th>
                            <th className="p-6 text-center">Vias</th>
                            <th className="p-6 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={(e) => toggleSelectAll(e.target.checked)} 
                                    checked={isAllVisibleSelected}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {groupedData.length === 0 ? (
                            <tr><td colSpan={8} className="p-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">{loading ? "Processando roteiros..." : "Nenhum resultado encontrado."}</td></tr>
                        ) : (
                            groupedData.map(seller => {
                                const isExp = expandedSellers.has(seller.id);
                                const isUnregistered = seller.colabRef.Grupo === 'NÃO CADASTRADO';
                                const hasAddress = !!seller.colabRef.EnderecoBase;
                                const isSelected = selectedSellerIds.has(seller.id);

                                return (
                                    <React.Fragment key={seller.id}>
                                        <tr onClick={() => { const s = new Set(expandedSellers); isExp ? s.delete(seller.id) : s.add(seller.id); setExpandedSellers(s); }} className={`cursor-pointer transition-all ${isExp ? 'bg-blue-50/20' : 'hover:bg-slate-50'} ${!isSelected ? 'opacity-50 grayscale' : ''}`}>
                                            <td className="p-6 text-center">{isExp ? <ChevronDownIcon className="w-5 h-5 text-blue-600"/> : <ChevronRightIcon className="w-5 h-5 text-slate-200"/>}</td>
                                            <td className="p-6 font-black text-slate-800 text-base flex items-center">
                                                {seller.id} - {seller.name}
                                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded border uppercase ${isUnregistered ? 'bg-red-50 text-red-500 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    {seller.colabRef.Grupo}
                                                </span>
                                                {hasAddress && <img src="https://cdn-icons-png.flaticon.com/512/619/619153.png" className="w-5 h-5 ml-2" title="Endereço de partida cadastrado" alt="Casa" />}
                                                {seller.isInactive && (
                                                    <span className="ml-2 bg-red-100 text-red-600 text-[9px] font-bold px-2 py-0.5 rounded border border-red-200 uppercase">
                                                        INATIVO
                                                    </span>
                                                )}
                                                {seller.hasAlert && (
                                                    <span className="ml-2 bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-200 uppercase flex items-center">
                                                        <ExclamationIcon className="w-3 h-3 mr-1"/> ALERTA DE ROTA
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-slate-400 font-semibold text-xs uppercase">{seller.supervisor}</td>
                                            <td className="p-6 text-center font-mono font-bold text-slate-300">{seller.days.length}</td>
                                            <td className="p-6 text-right font-bold text-slate-400">{seller.totalKm.toFixed(1)} km</td>
                                            <td className="p-6 text-right font-black text-emerald-600 text-lg">{seller.totalKmReal > 0 ? seller.totalKmReal.toFixed(1) + ' km' : '-'}</td>
                                            <td className="p-6 text-center">
                                                <button onClick={(e) => { e.stopPropagation(); handleCalculateSellerReal(seller); }} disabled={calculatingReal} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl border border-emerald-100 transition-all shadow-sm" title="Calcular Real Individual"><GlobeIcon className="w-5 h-5"/></button>
                                            </td>
                                            <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={() => toggleSelectOne(seller.id)} 
                                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                        {isExp && (
                                            <tr>
                                                <td colSpan={8} className="p-6 bg-slate-50/40">
                                                    {isUnregistered && (
                                                        <div className="mx-8 mb-4 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center text-amber-800 text-xs font-bold">
                                                            <ExclamationIcon className="w-4 h-4 mr-2"/>
                                                            Atenção: Este colaborador não possui endereço base cadastrado. O roteiro iniciará em um ponto central calculado (Centroide).
                                                        </div>
                                                    )}
                                                    <div className="mx-8 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-50 text-slate-400 font-black uppercase border-b border-slate-100">
                                                                <tr><th className="p-4 text-left">Data Programada</th><th className="p-4 text-center">Qtd Visitas (Ativas)</th><th className="p-4 text-right">KM Est.</th><th className="p-4 text-right">KM Real (OSRM)</th><th className="p-4 text-center">Ações</th></tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {seller.days.map((d: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-blue-50/20 transition-colors">
                                                                        <td className="p-4 font-mono font-black text-slate-600">
                                                                            {formatDate(d.date)} 
                                                                            <span className="ml-2 text-[9px] text-slate-400 uppercase font-black tracking-widest">{d.dayName}</span>
                                                                            {d.periodicity && (
                                                                                <span className="ml-2 text-[9px] text-indigo-500 uppercase font-bold tracking-widest">{d.periodicity}</span>
                                                                            )}
                                                                            {d.alert && (
                                                                                <div className="mt-1 flex items-center text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-100" title={d.alert}>
                                                                                    <ExclamationIcon className="w-3 h-3 mr-1.5"/>
                                                                                    <span className="text-[9px] uppercase font-bold">{d.alert}</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-4 text-center font-black text-blue-600 bg-blue-50/30">{d.visitCount}</td>
                                                                        <td className={`p-4 text-right font-bold ${d.km > MAX_DAILY_KM ? 'text-red-500' : 'text-slate-400'}`}>{d.km.toFixed(1)}</td>
                                                                        <td className="p-4 text-right font-black text-emerald-600 text-sm">{d.kmReal > 0 ? d.kmReal.toFixed(1) : '-'}</td>
                                                                        <td className="p-4 text-center">
                                                                            <button onClick={() => setViewingRoute(d)} className="text-blue-600 hover:text-blue-800 font-black text-[10px] uppercase flex items-center justify-center mx-auto bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all shadow-sm">
                                                                                <LocationMarkerIcon className="w-3.5 h-3.5 mr-2"/> VER MAPA
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
    );
};
