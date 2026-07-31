
import React, { useState, useMemo, useEffect, useRef, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { DataContext } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import { getVisitasPrevistas, saveRotaPrevista, checkRotaPrevistaExists, getOSRMData } from './services/apiService';
import { VisitaPrevista, Colaborador } from './types';
import { LocationMarkerIcon, SpinnerIcon, CalculatorIcon, ChevronRightIcon, ChevronDownIcon, ArrowLeftIcon, GlobeIcon, RefreshIcon, UsersIcon, ExclamationIcon, CheckCircleIcon, TrashIcon, CalendarIcon, PlusCircleIcon, XCircleIcon, UserGroupIcon } from './icons';
import L from 'leaflet';

// --- CONFIGURAÇÃO DE ÍCONES NATIVOS EM SVG (ISENTO DE MIXED CONTENT E ERROS DE REDE) ---
const houseIcon = L.divIcon({
    className: 'house-marker-wrapper',
    html: `<div style="background-color:#16a34a; color:white; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
    iconSize: [34, 34], iconAnchor: [17, 17]
});

const centroidIcon = L.divIcon({
    className: 'centroid-marker-wrapper',
    html: `<div style="background-color:#ea580c; color:white; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg></div>`,
    iconSize: [30, 30], iconAnchor: [15, 15]
});
const SaveSimulationModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (descricao: string) => void;
    periodo: string;
    totalKm: number;
    totalColabs: number;
    isOverwrite: boolean;
    existingDescricao?: string;
    isSaving: boolean;
    groupType: string;
}> = ({ isOpen, onClose, onConfirm, periodo, totalKm, totalColabs, isOverwrite, existingDescricao, isSaving, groupType }) => {
    const [descricao, setDescricao] = useState('');

    useEffect(() => {
        if (isOpen) setDescricao('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transition-all">
                {/* Header */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <CheckCircleIcon className="w-6 h-6"/>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">Salvar Simulação de Rota</h3>
                            <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wider">{groupType}</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={isSaving} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl transition">
                        <XCircleIcon className="w-6 h-6"/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Sumário */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Período:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{periodo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-400 uppercase">Colaboradores:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{totalColabs} selecionados</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700/60">
                            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Total KM Calculado:</span>
                            <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{totalKm.toFixed(2)} km</span>
                        </div>
                    </div>

                    {/* Alerta de Sobrescrita */}
                    {isOverwrite && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200">
                            <ExclamationIcon className="w-6 h-6 text-amber-500 shrink-0 mt-0.5"/>
                            <div className="text-xs space-y-1">
                                <p className="font-bold text-amber-800 dark:text-amber-300">Simulação pré-existente encontrada!</p>
                                <p>Já existe uma simulação salva para o mesmo período e com o mesmo KM Total (<b>{totalKm.toFixed(2)} km</b>).</p>
                                {existingDescricao && <p className="italic font-semibold text-amber-700 dark:text-amber-400">"{existingDescricao}"</p>}
                                <p className="font-bold pt-1 text-amber-900 dark:text-amber-200">Ao prosseguir, a simulação existente será SOBRESCRITA.</p>
                            </div>
                        </div>
                    )}

                    {/* Input de Descrição */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Descrição / Identificador da Simulação <span className="text-slate-400 font-normal">(Opcional)</span>
                        </label>
                        <input
                            type="text"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            placeholder="Ex: Ajuste Fator 1.3, Rota Especial Jean, etc."
                            disabled={isSaving}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-sm font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(descricao)}
                        disabled={isSaving}
                        className={`px-6 py-3 rounded-2xl text-xs font-black text-white shadow-lg flex items-center transition-all ${
                            isOverwrite 
                                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' 
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <SpinnerIcon className="w-4 h-4 mr-2 animate-spin"/> Salvando...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon className="w-4 h-4 mr-2"/>
                                {isOverwrite ? 'Sobrescrever e Salvar' : 'Salvar Simulação'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

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

    // Extrai o supervisor do primeiro ponto válido da rota
    const firstSupervisor = validPoints.length > 0 ? (validPoints[0].Nome_Supervisor || '') : '';

    // Define o ponto de partida (Nó 0)
    let startNode: VisitaPrevista & { Foto?: string; Grupo?: string; NomeSupervisor?: string } = {
        Cod_Vend: colab?.CodigoSetor || 0, 
        Nome_Vendedor: colab?.Nome || "Sistema", 
        Foto: (colab as any)?.Foto,
        Grupo: colab?.Grupo || '',
        NomeSupervisor: firstSupervisor,
        Cod_Supervisor: 0, Nome_Supervisor: firstSupervisor, Cod_Cliente: 0,
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
        const validCoords = (points || [])
            .map(p => [p[0] !== undefined ? p[0] : p.Lat, p[1] !== undefined ? p[1] : p.Long])
            .filter(c => typeof c[0] === 'number' && typeof c[1] === 'number' && !isNaN(c[0]) && !isNaN(c[1]) && (c[0] !== 0 || c[1] !== 0));

        const fit = () => {
            map.invalidateSize();
            if (validCoords.length > 0) {
                try {
                    const bounds = L.latLngBounds(validCoords as [number, number][]);
                    map.fitBounds(bounds, { padding: [50, 50] });
                } catch(e) {}
            }
        };

        fit();
        const t1 = setTimeout(fit, 100);
        const t2 = setTimeout(fit, 400);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [map, points]);
    return null;
};

const MapModal: React.FC<{ route: any; onCalculated: (km: number) => void; onTogglePoint: (point: VisitaPrevista) => void; onClose: () => void }> = ({ route, onCalculated, onTogglePoint, onClose }) => {
    const [idaCoords, setIdaCoords] = useState<any[]>([]);
    const [retornoCoords, setRetornoCoords] = useState<any[]>([]);
    const [kmRealLocal, setKmRealLocal] = useState<number | null>(route.kmReal || null);
    const [loadingMap, setLoadingMap] = useState(true);
    const fetchedHashRef = useRef<string>('');

    // Cria um hash único das coordenadas e parametros para evitar re-renderizações infinitas
    const pointsHash = useMemo(() => {
        const coords = (route.validPoints || []).map((p: any) => `${p.Lat.toFixed(5)},${p.Long.toFixed(5)}`).join('|');
        return `${coords}_RT:${route.isRoundTrip}_IN:${route.isInactive}`;
    }, [route.validPoints, route.isRoundTrip, route.isInactive]);

    useEffect(() => {
        // Se já foi buscado para este hash exato nesta montagem, ignora
        if (fetchedHashRef.current === pointsHash) {
            return;
        }

        // Se a rota for de um inativo, não calcula nada
        if (route.isInactive) {
            setKmRealLocal(0);
            setLoadingMap(false);
            fetchedHashRef.current = pointsHash;
            return;
        }

        const loadGeometry = async () => {
            fetchedHashRef.current = pointsHash;
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full h-[85vh] max-h-[850px] max-w-6xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="p-6 shrink-0 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-20 shadow-sm relative">
                    <div className="flex items-center">
                        <button onClick={onClose} className="mr-5 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-100 dark:border-slate-800"><ArrowLeftIcon className="w-6 h-6"/></button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                                {route.sellerId} - {route.sellerName} | {formatDate(route.date)}
                                <span className="ml-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-sky-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800 uppercase font-black">{route.dayName}</span>
                                {route.isInactive && <span className="ml-3 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 text-[10px] px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800 uppercase font-black">INATIVO</span>}
                            </h2>
                            <div className="flex items-center gap-4 mt-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Estimado: <span className="text-slate-600 dark:text-slate-300 font-black">{route.km.toFixed(1)} km</span></p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Real (Vias): <span className="text-emerald-600 dark:text-emerald-400 font-black">{kmRealLocal !== null ? kmRealLocal.toFixed(1) + ' km' : 'Traçando...'}</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                         <div className="hidden md:flex gap-4">
                            <div className="flex items-center text-[10px] font-black text-blue-600 dark:text-sky-400 uppercase"><span className="w-3 h-1 bg-blue-600 dark:bg-sky-400 mr-2 rounded-full"></span> Trajeto Ida</div>
                            <div className="flex items-center text-[10px] font-black text-orange-500 dark:text-orange-400 uppercase"><span className="w-3 h-1 bg-orange-500 dark:bg-orange-400 mr-2 rounded-full"></span> Retorno Casa</div>
                        </div>
                        <button onClick={onClose} className="px-8 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95">FECHAR</button>
                    </div>
                </div>
                <div className="flex-1 w-full relative min-h-[500px] overflow-hidden">
                    {loadingMap && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-50/80 dark:bg-slate-900/80">
                            <SpinnerIcon className="w-12 h-12 text-blue-600 animate-spin mb-4"/>
                            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Calculando rota terrestre segura...</p>
                        </div>
                    )}
                    <MapContainer 
                        center={[
                            (route.validPoints[0]?.Lat && !isNaN(route.validPoints[0]?.Lat)) ? route.validPoints[0].Lat : -23.55052, 
                            (route.validPoints[0]?.Long && !isNaN(route.validPoints[0]?.Long)) ? route.validPoints[0].Long : -46.633308
                        ]} 
                        zoom={13} 
                        style={{ height: '100%', width: '100%', minHeight: '500px', zIndex: 0 }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                        <MapAutoFit points={route.allPoints} />
                        
                        {/* Linhas de Rota (Apenas para pontos válidos e se não for inativo) */}
                        {!route.isInactive && (
                            <>
                                <Polyline positions={idaCoords} color="#2563eb" weight={7} opacity={0.7} lineJoin="round" />
                                {retornoCoords.length > 0 && <Polyline positions={retornoCoords} color="#f97316" weight={7} opacity={0.8} dashArray="10, 10" />}
                            </>
                        )}
                        
                        {/* Marcadores defensivos (Apenas coordenadas numericas validas) */}
                        {route.allPoints
                            .filter((p: any) => p && typeof p.Lat === 'number' && typeof p.Long === 'number' && !isNaN(p.Lat) && !isNaN(p.Long) && (p.Lat !== 0 || p.Long !== 0))
                            .map((p: any, idx: number) => (
                            <Marker key={p.Cod_Cliente || idx} position={[p.Lat, p.Long]} icon={getIcon(p)} opacity={p.isExcluded ? 0.6 : 1}>
                                <Popup>
                                    <div className="p-1 min-w-[260px]">
                                        <div className="mb-3 border-b border-slate-100 pb-2">
                                            {p.mapIndex === 0 && !p.isExcluded && (
                                                <div className="flex items-center gap-3 mb-2">
                                                    {p.Foto ? (
                                                        <img src={p.Foto} alt={p.Nome_Vendedor} className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow shrink-0" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-base border border-blue-300 shrink-0">
                                                            {(p.Nome_Vendedor || 'V')[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-black text-[10px] uppercase text-blue-600">PARTIDA/RETORNO (CASA)</p>
                                                        <p className="text-sm font-black text-slate-800 leading-tight">{p.Nome_Vendedor}</p>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {(p as any).Grupo && (
                                                                <span className="inline-block bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">{(p as any).Grupo}</span>
                                                            )}
                                                            {p.Cod_Vend > 0 && (
                                                                <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">Setor {p.Cod_Vend}</span>
                                                            )}
                                                        </div>
                                                        {(p.Nome_Supervisor || (p as any).NomeSupervisor) && (
                                                            <p className="text-[10px] text-slate-500 mt-0.5"><span className="font-bold">Sup:</span> {p.Nome_Supervisor || (p as any).NomeSupervisor}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {p.mapIndex !== 0 && (
                                                <>
                                                    <p className={`font-black text-[10px] uppercase mb-1 ${p.isExcluded ? 'text-slate-400' : 'text-blue-600'}`}>
                                                        {p.isExcluded ? "PONTO IGNORADO (FORA DA ROTA)" : `SEQUÊNCIA DA VISITA #${p.mapIndex}`}
                                                    </p>
                                                    <p className="text-sm font-black text-slate-800 leading-tight">
                                                        {`${p.Cod_Cliente} - ${p.Razao_Social}`}
                                                    </p>
                                                </>
                                            )}
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

export const RoteirizadorVendedores: React.FC = () => {
    const { colaboradores, systemConfig } = useContext(DataContext);
    const { user: authUser } = useAuth();
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
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

    const handleCalculate = async () => {
        setLoading(true); setRawData([]); setRealDistances(new Map()); setExcludedIds(new Set()); setSelectedSupervisor(''); setSelectedSellerIds(new Set());
        try { 
            const data = await getVisitasPrevistas(startDate, endDate); 
            setRawData(data); 
            // Inicializa seleção com todos os IDs encontrados
            const allIds = new Set(data.map(d => d.Cod_Vend));
            setSelectedSellerIds(allIds);
            
            // AUTOMAÇÃO: Ativa a flag para o useEffect disparar o cálculo
            setShouldAutoCalculate(true);
        } 
        catch (e: any) { alert(e.message); } finally { setLoading(false); }
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
        const sellerMap = new Map<number, any>();
        
        rawData.forEach(v => {
            // Filtro de Supervisor
            if (selectedSupervisor && String(v.Cod_Supervisor) !== selectedSupervisor) return;

            // v1.16.7: LÓGICA DE MATCH BLINDADA (Prioridade ao grupo Vendedor)
            let colab = colaboradores.find(c => 
                Number(c.CodigoSetor) === Number(v.Cod_Vend) && 
                String(c.Grupo).trim().toUpperCase() === 'VENDEDOR'
            );
            if (!colab) {
                // Se não houver match exato por grupo, pegamos o primeiro match por setor (fallback)
                colab = colaboradores.find(c => Number(c.CodigoSetor) === Number(v.Cod_Vend));
            }
            
            // FILTRO CRÍTICO: Se o colaborador existir no banco e estiver inativo, ignoramos ele completamente neste roteirizador
            if (colab && colab.Ativo === false) return;

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
            return { ...seller, totalKm, totalKmReal, days: daysArr.sort((a,b) => (a.date || '').localeCompare(b.date || '')), hasAlert: sellerHasAlert };
        }).sort((a,b) => a.id - b.id);
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

    const [saveModalData, setSaveModalData] = useState<{
        isOpen: boolean;
        periodo: string;
        totalKm: number;
        totalColabs: number;
        isOverwrite: boolean;
        overwriteId?: number;
        existingDescricao?: string;
    } | null>(null);

    const handleOpenSaveModal = async () => {
        const sellersToSave = groupedData.filter(s => selectedSellerIds.has(s.id));
        
        if (sellersToSave.length === 0) {
            alert("Nenhum vendedor selecionado para salvar.");
            return;
        }

        const totalKmCalculado = sellersToSave.reduce((acc, curr) => acc + (curr.totalKmReal || curr.totalKm), 0);
        
        const supervisorTag = selectedSupervisor 
            ? ` - Equipe ${supervisors.find(s => s.id === selectedSupervisor)?.name.split(' ')[0]}` 
            : '';
        const formattedPeriod = `[VENDEDOR] ${formatDate(startDate)} a ${formatDate(endDate)}${supervisorTag}`;

        setSaving(true);
        try {
            const checkRes = await checkRotaPrevistaExists(formattedPeriod, totalKmCalculado);
            setSaveModalData({
                isOpen: true,
                periodo: formattedPeriod,
                totalKm: totalKmCalculado,
                totalColabs: sellersToSave.length,
                isOverwrite: checkRes.exists,
                overwriteId: checkRes.id,
                existingDescricao: checkRes.descricao
            });
        } catch (e: any) {
            alert("Erro ao verificar duplicidade: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmSaveSimulation = async (userDesc: string) => {
        if (!saveModalData) return;
        const sellersToSave = groupedData.filter(s => selectedSellerIds.has(s.id));
        setSaving(true);
        try {
            const payload = {
                Periodo: saveModalData.periodo,
                TotalKM: saveModalData.totalKm,
                Descricao: userDesc.trim() || undefined,
                overwriteId: saveModalData.overwriteId,
                UsuarioSimulacao: authUser?.Nome || 'Operador',
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
            setSaveModalData(null);
            alert("Simulação salva com sucesso!");
        } catch (e: any) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {viewingRoute && (
                <MapModal 
                    route={viewingRoute} 
                    onCalculated={(km) => setRealDistances(p => { const n = new Map(p); n.set(`${viewingRoute.sellerId}-${viewingRoute.date}`, km); return n; })} 
                    onTogglePoint={handleTogglePoint}
                    onClose={() => setViewingRoute(null)} 
                />
            )}
            
            {saveModalData && (
                <SaveSimulationModal
                    isOpen={saveModalData.isOpen}
                    onClose={() => setSaveModalData(null)}
                    onConfirm={handleConfirmSaveSimulation}
                    periodo={saveModalData.periodo}
                    totalKm={saveModalData.totalKm}
                    totalColabs={saveModalData.totalColabs}
                    isOverwrite={saveModalData.isOverwrite}
                    existingDescricao={saveModalData.existingDescricao}
                    isSaving={saving}
                    groupType="EQUIPE DE VENDAS"
                />
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Roteirizador Previsto</h2><p className="text-slate-500 dark:text-slate-400 font-medium">Controle e validação terrestre para a equipe de <b>Vendas</b>.</p></div>
                <div className="flex gap-3">
                    {rawData.length > 0 && (
                        <button onClick={handleOpenSaveModal} disabled={saving || calculatingReal} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-2xl shadow-xl flex items-center transition-all disabled:opacity-50">
                            {saving ? <SpinnerIcon className="w-5 h-5 mr-3 animate-spin"/> : <CheckCircleIcon className="w-5 h-5 mr-3"/>}
                            SALVAR SIMULAÇÃO
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-7 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap gap-5 items-end transition-colors">
                <div className="w-44"><label className="block text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase mb-2 ml-1">Data Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                <div className="w-44"><label className="block text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase mb-2 ml-1">Data Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                
                <div className="w-24"><label className="block text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase mb-2 ml-1">Fator Tort.</label><input type="number" step="0.1" value={tortuosity} onChange={e => setTortuosity(parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-sm text-center font-black text-blue-600 dark:text-sky-400"/></div>
                <div className="w-24"><label className="block text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase mb-2 ml-1">Adic. KM %</label><input type="number" step="1" value={realKmAdjustment} onChange={e => setRealKmAdjustment(parseFloat(e.target.value))} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-sm text-center font-black text-emerald-600 dark:text-emerald-400"/></div>
                
                {/* FILTRO DE SUPERVISOR */}
                {supervisors.length > 0 && (
                    <div className="w-56">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">Equipe Supervisor</label>
                        <div className="relative">
                            <UserGroupIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400"/>
                            <select 
                                value={selectedSupervisor} 
                                onChange={e => setSelectedSupervisor(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 pl-9 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-white appearance-none"
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

                <button onClick={() => setIsRoundTrip(!isRoundTrip)} className={`h-[54px] px-6 rounded-2xl border-2 font-black text-[10px] uppercase transition-all flex items-center ${isRoundTrip ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-sky-300 border-blue-200 dark:border-blue-800 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}><RefreshIcon className="w-4 h-4 mr-2"/> {isRoundTrip ? 'Calcular Ida e Volta' : 'Apenas Ida'}</button>
                <button 
                    onClick={handleCalculate} 
                    disabled={loading || calculatingReal} 
                    className="h-[54px] bg-blue-600 hover:bg-blue-700 text-white font-black px-10 rounded-2xl shadow-xl flex items-center transition-all min-w-[240px]"
                >
                    {loading ? (
                        <><SpinnerIcon className="w-5 h-5 mr-3 animate-spin"/> BUSCANDO...</>
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
                        <><CalculatorIcon className="w-5 h-5 mr-3"/> CALCULAR KM REAL</>
                    )}
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-300 font-black text-[10px] uppercase tracking-[0.1em] border-b border-slate-200 dark:border-slate-800">
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
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {groupedData.length === 0 ? (
                            <tr><td colSpan={8} className="p-20 text-center text-slate-300 dark:text-slate-500 font-bold uppercase text-xs tracking-widest">{loading ? "Processando roteiros..." : "Nenhum resultado encontrado."}</td></tr>
                        ) : (
                            groupedData.map(seller => {
                                const isExp = expandedSellers.has(seller.id);
                                const isUnregistered = seller.colabRef.Grupo === 'NÃO CADASTRADO';
                                const hasAddress = !!seller.colabRef.EnderecoBase;
                                const isSelected = selectedSellerIds.has(seller.id);

                                return (
                                    <React.Fragment key={seller.id}>
                                        <tr onClick={() => { const s = new Set(expandedSellers); isExp ? s.delete(seller.id) : s.add(seller.id); setExpandedSellers(s); }} className={`cursor-pointer transition-all ${isExp ? 'bg-blue-50/20 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'} ${!isSelected ? 'opacity-50 grayscale' : ''}`}>
                                            <td className="p-6 text-center">{isExp ? <ChevronDownIcon className="w-5 h-5 text-blue-600 dark:text-sky-400"/> : <ChevronRightIcon className="w-5 h-5 text-slate-200 dark:text-slate-600"/>}</td>
                                            <td className="p-6 font-black text-slate-800 dark:text-white text-base flex items-center">
                                                {seller.id} - {seller.name}
                                                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded border uppercase ${isUnregistered ? 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                                                    {seller.colabRef.Grupo}
                                                </span>
                                                {hasAddress && <img src="https://cdn-icons-png.flaticon.com/512/619/619153.png" className="w-5 h-5 ml-2" title="Endereço de partida cadastrado" alt="Casa" />}
                                                {seller.isInactive && (
                                                    <span className="ml-2 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 text-[9px] font-bold px-2 py-0.5 rounded border border-red-200 dark:border-red-800 uppercase">
                                                        INATIVO
                                                    </span>
                                                )}
                                                {seller.hasAlert && (
                                                    <span className="ml-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 uppercase flex items-center">
                                                        <ExclamationIcon className="w-3 h-3 mr-1"/> ALERTA DE ROTA
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-6 text-slate-400 dark:text-slate-400 font-semibold text-xs uppercase">{seller.supervisor}</td>
                                            <td className="p-6 text-center font-mono font-bold text-slate-300 dark:text-slate-400">{seller.days.length}</td>
                                            <td className="p-6 text-right font-bold text-slate-400 dark:text-slate-400">{seller.totalKm.toFixed(1)} km</td>
                                            <td className="p-6 text-right font-black text-emerald-600 dark:text-emerald-400 text-lg">{seller.totalKmReal > 0 ? seller.totalKmReal.toFixed(1) + ' km' : '-'}</td>
                                            <td className="p-6 text-center">
                                                <button onClick={(e) => { e.stopPropagation(); handleCalculateSellerReal(seller); }} disabled={calculatingReal} className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-800 transition-all shadow-sm" title="Calcular Real Individual"><GlobeIcon className="w-5 h-5"/></button>
                                            </td>
                                            <td className="p-6 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    onChange={() => toggleSelectOne(seller.id)} 
                                                    className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                        {isExp && (
                                            <tr>
                                                <td colSpan={8} className="p-6 bg-slate-50/40 dark:bg-slate-800/20">
                                                    {isUnregistered && (
                                                        <div className="mx-8 mb-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-lg flex items-center text-amber-800 dark:text-amber-300 text-xs font-bold">
                                                            <ExclamationIcon className="w-4 h-4 mr-2"/>
                                                            Atenção: Este colaborador não possui endereço base cadastrado. O roteiro iniciará em um ponto central calculated (Centroide).
                                                        </div>
                                                    )}
                                                    <div className="mx-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-300 font-black uppercase border-b border-slate-100 dark:border-slate-800">
                                                                <tr><th className="p-4 text-left">Data Programada</th><th className="p-4 text-center">Qtd Visitas (Ativas)</th><th className="p-4 text-right">KM Est.</th><th className="p-4 text-right">KM Real (OSRM)</th><th className="p-4 text-center">Ações</th></tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                                {seller.days.map((d: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-blue-50/20 dark:hover:bg-slate-800/40 transition-colors">
                                                                        <td className="p-4 font-mono font-black text-slate-600 dark:text-slate-300">
                                                                            {formatDate(d.date)} 
                                                                            <span className="ml-2 text-[9px] text-slate-400 dark:text-slate-400 uppercase font-black tracking-widest">{d.dayName}</span>
                                                                            {d.periodicity && (
                                                                                <span className="ml-2 text-[9px] text-indigo-500 dark:text-indigo-400 uppercase font-bold tracking-widest">{d.periodicity}</span>
                                                                            )}
                                                                            {d.alert && (
                                                                                <div className="mt-1 flex items-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded w-fit border border-amber-100 dark:border-amber-800" title={d.alert}>
                                                                                    <ExclamationIcon className="w-3 h-3 mr-1.5"/>
                                                                                    <span className="text-[9px] uppercase font-bold">{d.alert}</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-4 text-center font-black text-blue-600 dark:text-sky-400 bg-blue-50/30 dark:bg-blue-950/30">{d.visitCount}</td>
                                                                        <td className={`p-4 text-right font-bold ${d.km > MAX_DAILY_KM ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-400'}`}>{d.km.toFixed(1)}</td>
                                                                        <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">{d.kmReal > 0 ? d.kmReal.toFixed(1) : '-'}</td>
                                                                        <td className="p-4 text-center">
                                                                            <button onClick={() => setViewingRoute(d)} className="text-blue-600 dark:text-sky-400 hover:text-blue-800 dark:hover:text-sky-200 font-black text-[10px] uppercase flex items-center justify-center mx-auto bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-4 py-2 rounded-xl transition-all shadow-sm">
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
