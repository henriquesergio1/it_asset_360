import React, { useState, useContext, useEffect, useMemo, useRef } from 'react';
import { DataContext } from './context/DataContext';
import { useAuth } from './context/AuthContext';
import { getVisitasPrevistas, getPromoterClients, saveRotaPrevista, getOSRMData } from './services/apiService';
import { VisitaPrevista, Colaborador } from './types';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
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
    UsersIcon
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
        if (d === '2' || d.includes('SEG')) return 'SEGUNDA-FEIRA';
        if (d === '3' || d.includes('TER')) return 'TERÇA-FEIRA';
        if (d === '4' || d.includes('QUA')) return 'QUARTA-FEIRA';
        if (d === '5' || d.includes('QUI')) return 'QUINTA-FEIRA';
        if (d === '6' || d.includes('SEX')) return 'SEXTA-FEIRA';
        if (d === '7' || d.includes('SAB') || d.includes('SÁB')) return 'SÁBADO';
        if (d === '1' || d.includes('DOM')) return 'SEGUNDA-FEIRA';
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
    const handleOptimizeSimulate = () => {
        if (adjustedRoutes.length === 0) {
            alert("Nenhum dado de rota carregado para otimização.");
            return;
        }

        setLoading(true);
        setTimeout(() => {
            // A carteira é do vendedor: isolamento total por Cod_Vend (otimiza estritamente os vendedores do escopo selecionado)
            const sellers = Array.from(new Set(scopedAdjustedRoutes.map(r => r.Cod_Vend)));
            const result: VisitaPrevista[] = [];

            // Gerar lista de datas do intervalo se o período contiver mais de um dia
            const datesInRange: string[] = [];
            if (startDate && endDate) {
                const start = new Date(startDate + 'T00:00:00');
                const end = new Date(endDate + 'T00:00:00');
                if (start <= end) {
                    const curr = new Date(start);
                    while (curr <= end) {
                        datesInRange.push(curr.toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                    }
                }
            }

            sellers.forEach(sellerId => {
                const sellerVisits = adjustedRoutes.filter(r => r.Cod_Vend === sellerId);
                if (sellerVisits.length === 0) return;

                const colab = colaboradores.find(c => c.CodigoSetor === sellerId);
                const sellerName = colab?.Nome || sellerVisits[0].Nome_Vendedor;

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
                if (uniqueClients.length === 0) return;

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
                const activeDays = optDays.length > 0 ? optDays : ['SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA'];

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

                // 5. Gerar visitas expandidas para o calendário mantendo rigorosamente a carteira
                if (datesInRange.length > 1) {
                    datesInRange.forEach(dateStr => {
                        const dateWeekday = getWeekdayNameFromDate(dateStr);
                        const weekNum = getWeekNumberInMonth(dateStr);
                        const isWeekImpar = weekNum % 2 !== 0;

                        const plansForDay = clientPlans.filter(p => p.diaSemana === dateWeekday);

                        plansForDay.forEach(p => {
                            let shouldInclude = false;
                            if (p.tipo === 'SEMANAL') {
                                shouldInclude = true;
                            } else if (p.tipo === 'QUINZENAL_1_3' && isWeekImpar) {
                                shouldInclude = true;
                            } else if (p.tipo === 'QUINZENAL_2_4' && !isWeekImpar) {
                                shouldInclude = true;
                            }

                            if (shouldInclude) {
                                result.push({
                                    ...p.client.sampleVisit,
                                    Cod_Vend: sellerId,
                                    Nome_Vendedor: sellerName,
                                    Dia_Semana: p.diaSemana,
                                    Periodicidade: p.periodicidade,
                                    Data_da_Visita: dateStr
                                });
                            }
                        });
                    });
                } else {
                    clientPlans.forEach(p => {
                        result.push({
                            ...p.client.sampleVisit,
                            Cod_Vend: sellerId,
                            Nome_Vendedor: sellerName,
                            Dia_Semana: p.diaSemana,
                            Periodicidade: p.periodicidade,
                            Data_da_Visita: startDate || p.client.sampleVisit.Data_da_Visita
                        });
                    });
                }
            });

            if (result.length === 0) {
                alert("Aviso: Nenhuma visita pôde ser gerada para os dias ativos no período selecionado.");
                setLoading(false);
                return;
            }

            setAdjustedRoutes(prev => {
                const otherRoutes = prev.filter(r => !sellers.includes(r.Cod_Vend));
                return [...otherRoutes, ...result];
            });
            setLoading(false);
            const escopoDesc = scopeMode === 'vendedor' 
                ? 'do vendedor selecionado' 
                : (scopeMode === 'equipe' ? 'da equipe de supervisão selecionada' : 'geral');
            alert(`Otimização concluída (${escopoDesc})!\n\n• Carteiras mantidas 100% exclusivas por vendedor (zero transferência).\n• Clientes semanais preservados semanalmente.\n• Clientes quinzenais balanceados entre as semanas 1 3 e 2 4.`);
        }, 300);
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
                const color = promoterColorMap.get(String(sellerId)) || '#64748b';

                // Separar por dia da semana
                const groupedByDay = new Map<string, VisitaPrevista[]>();
                sellerVisits.forEach(v => {
                    if (!groupedByDay.has(v.Dia_Semana)) groupedByDay.set(v.Dia_Semana, []);
                    groupedByDay.get(v.Dia_Semana)!.push(v);
                });

                for (const [day, visits] of groupedByDay.entries()) {
                    const sortedVisits = visits; // Sem sorting complexo, manter ordem do planner
                    
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
                            lines.push({ id: `${sellerId}-${day}`, color, points: osrmCacheRef.current.get(hashKey)! });
                        } else {
                            try {
                                const osrm = await getOSRMData(pointsObj, false);
                                if (osrm && osrm.geometry && osrm.geometry.length > 0) {
                                    osrmCacheRef.current.set(hashKey, osrm.geometry);
                                    lines.push({ id: `${sellerId}-${day}`, color, points: osrm.geometry });
                                } else {
                                    const straightCoords = pointsObj.map(c => [c.Lat, c.Long] as [number, number]);
                                    osrmCacheRef.current.set(hashKey, straightCoords);
                                    lines.push({ id: `${sellerId}-${day}`, color, points: straightCoords });
                                }
                            } catch (e) {
                                const straightCoords = pointsObj.map(c => [c.Lat, c.Long] as [number, number]);
                                lines.push({ id: `${sellerId}-${day}`, color, points: straightCoords });
                            }
                        }
                    }
                }
            }
            return lines;
        };

        let isMounted = true;
        
        const updateLines = async () => {
            if (scopedOriginalRoutes.length > 0) {
                const orig = await traceAsync(scopedOriginalRoutes);
                if (isMounted) setOriginalPolylines(orig);
            } else {
                if (isMounted) setOriginalPolylines([]);
            }
            if (scopedAdjustedRoutes.length > 0) {
                const adj = await traceAsync(scopedAdjustedRoutes);
                if (isMounted) setAdjustedPolylines(adj);
            } else {
                if (isMounted) setAdjustedPolylines([]);
            }
        };

        updateLines();
        
        return () => { isMounted = false; };
    }, [scopedOriginalRoutes, scopedAdjustedRoutes, selectedPromoter, promoterColorMap, colaboradores]);

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
                                            <option value="">Ignorar este colaborador</option>
                                            {teamColaboradores.map(c => (
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
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Distância Total Estimada</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800">{kpis.adjusted.totalKm} KM</span>
                                <span className="text-xs text-slate-400 line-through">{kpis.original.totalKm} KM</span>
                            </div>
                        </div>
                        {kpis.kmSaved > 0 && (
                            <div className="mt-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                <CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> Economia de {kpis.kmSaved} KM ({kpis.percentSaved}%)
                            </div>
                        )}
                    </div>

                    {/* KPI 2: Média KM por Colaborador */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Média de Deslocamento</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800">{kpis.adjusted.avgKmPerSeller} KM</span>
                                <span className="text-xs text-slate-400">/ colab</span>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-400 font-medium">Distribuído entre {kpis.adjusted.sellerCount} colaboradores ativos.</p>
                    </div>

                    {/* KPI 3: Carga de Clientes (Equilíbrio) */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pico de Clientes / Dia</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className="text-xl font-black text-slate-800">{kpis.adjusted.maxClientsOnSingleDay} PDVs</span>
                                <span className="text-xs text-slate-400">Máx Config: {optMaxClients}</span>
                            </div>
                        </div>
                        <div className="flex items-center space-x-1">
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div 
                                    className="bg-indigo-600 h-1.5 rounded-full" 
                                    style={{ width: `${Math.min(100, (kpis.adjusted.maxClientsOnSingleDay / optMaxClients) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* KPI 4: Alertas de Distância */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                        <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Colaboradores com Alta KM</span>
                            <div className="flex items-baseline space-x-2 mt-1">
                                <span className={`text-xl font-black ${kpis.adjusted.exceededKmCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {kpis.adjusted.exceededKmCount} / {kpis.adjusted.sellerCount}
                                </span>
                                <span className="text-xs text-slate-400">teto {optMaxKm} KM</span>
                            </div>
                        </div>
                        {kpis.adjusted.exceededKmCount > 0 ? (
                            <div className="mt-2 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
                                <ExclamationIcon className="w-3.5 h-3.5 mr-1"/> Necessita Ajuste Manual
                            </div>
                        ) : (
                            <div className="mt-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2 py-1 text-[10px] font-bold w-fit flex items-center">
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
                                    className={`p-2 rounded-xl border text-xs font-bold cursor-pointer transition ${selectedPromoter === 'ALL' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200'}`}
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
                                            className={`p-2 rounded-xl border text-xs font-bold cursor-pointer transition flex items-center justify-between gap-1.5 ${selectedPromoter === String(sellerId) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : (qStats.isImbalanced ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200')}`}
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
                                {/* Casas / Bases dos Colaboradores */}
                                {Array.from(new Set(scopedAdjustedRoutes.map(v => v.Cod_Vend))).map(vId => {
                                    const colab = colaboradores.find(c => c.CodigoSetor === vId);
                                    if(colab && colab.LatitudeBase && colab.LongitudeBase) {
                                        const pColor = promoterColorMap.get(String(vId)) || '#94a3b8';
                                        return (
                                            <Marker 
                                                key={`base-${vId}`} 
                                                position={[colab.LatitudeBase, colab.LongitudeBase]} 
                                                icon={createBaseIcon(pColor)}
                                            >
                                                <Popup>
                                                    <div className="text-xs font-bold">
                                                        <p className="text-slate-800">{colab.Nome}</p>
                                                        <p className="text-slate-400 font-normal">Base / Casa</p>
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
                                        key={`orig-poly-${idx}`} 
                                        positions={line.points} 
                                        color={line.color} 
                                        weight={3} 
                                        dashArray="5, 10" 
                                        opacity={0.3} 
                                    />
                                ))}

                                {/* Polilinhas das rotas otimizadas */}
                                {adjustedPolylines.map((line, idx) => (
                                    <Polyline 
                                        key={`adj-poly-${idx}`} 
                                        positions={line.points} 
                                        color={line.color} 
                                        weight={5} 
                                        opacity={0.8} 
                                    />
                                ))}

                                {/* Clientes Marcados */}
                                {scopedAdjustedRoutes.filter(v => v.Lat && v.Long).map((v, idx) => {
                                    const color = promoterColorMap.get(String(v.Cod_Vend)) || '#4f46e5';
                                    return (
                                        <CircleMarker
                                            key={`marker-${v.Cod_Cliente}-${idx}`}
                                            center={[v.Lat, v.Long]}
                                            radius={7}
                                            pathOptions={{ fillColor: color, color: '#ffffff', fillOpacity: 0.9, weight: 2 }}
                                        >
                                            <Popup>
                                                <div className="text-xs space-y-2 p-1">
                                                    <div>
                                                        <h4 className="font-black text-slate-800">{v.Cod_Cliente} - {v.Razao_Social}</h4>
                                                        <p className="text-[10px] text-slate-400">{v.Endereco}</p>
                                                    </div>
                                                    <div className="border-t border-slate-100 pt-1.5 space-y-2">
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
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold text-slate-700"
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
                                                                    className="w-full bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold text-slate-700"
                                                                >
                                                                    {WEEKDAYS.map(day => (
                                                                        <option key={day} value={day}>{day}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Frequência</label>
                                                                {parsePeriodicidade(v.Periodicidade).tipo === 'SEMANAL' ? (
                                                                    <div className="w-full bg-blue-50 text-blue-700 border border-blue-200 rounded p-1 text-[10px] font-bold text-center">
                                                                        Semanal
                                                                    </div>
                                                                ) : (
                                                                    <select
                                                                        value={(v.Periodicidade && (v.Periodicidade.includes('2 4') || v.Periodicidade.includes('24') || v.Periodicidade.includes('2, 4'))) ? '2 4' : '1 3'}
                                                                        onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, v.Dia_Semana, e.target.value === '2 4' ? '2 4' : '1 3')}
                                                                        className="w-full bg-amber-50 text-amber-800 border border-amber-200 rounded p-1 text-[10px] font-bold outline-none"
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
                    </div>

                    {/* TABELA DE AJUSTE MANUAL E EDICAO DE ROTAS */}
                    {adjustedRoutes.length > 0 && (
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-0 shadow-sm p-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center">
                                    <ClipboardListIcon className="w-4 h-4 mr-1.5 text-indigo-600"/> Grade de Ajuste Fino
                                </h3>
                                <div className="flex items-center space-x-2">
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

                            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-xl">
                                <table className="w-full text-left text-[11px] font-bold text-slate-700">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] sticky top-0 z-10 border-b border-slate-100">
                                        <tr>
                                            <th className="p-3">Código/PDV</th>
                                            <th className="p-3">Razão Social</th>
                                            <th className="p-3">Endereço</th>
                                            <th className="p-3">Colaborador Atual</th>
                                            <th className="p-3">Dia de Visita</th>
                                            <th className="p-3">Periodicidade</th>
                                            <th className="p-3 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {scopedAdjustedRoutes
                                            .filter(v => selectedPromoter === 'ALL' || String(v.Cod_Vend) === selectedPromoter)
                                            .slice(0, 100) // Limita renderização para manter ultra-fluidez
                                            .map((v, i) => (
                                                <tr key={`${v.Cod_Cliente}-${i}`} className="hover:bg-slate-50/50 transition">
                                                    <td className="p-3 text-slate-900">{v.Cod_Cliente}</td>
                                                    <td className="p-3 truncate max-w-[180px]" title={v.Razao_Social}>{v.Razao_Social}</td>
                                                    <td className="p-3 text-slate-400 truncate max-w-[220px]" title={v.Endereco}>{v.Endereco}</td>
                                                    <td className="p-3">
                                                        {teamType === 'vendedores' ? (
                                                            <div className="flex items-center space-x-1.5">
                                                                <span className="text-slate-800 dark:text-slate-200 font-bold truncate max-w-[130px]" title={v.Nome_Vendedor}>{v.Nome_Vendedor}</span>
                                                                <span className="text-[8px] bg-slate-100 text-slate-500 font-semibold px-1 py-0.5 rounded shrink-0">Carteira</span>
                                                            </div>
                                                        ) : (
                                                            <select
                                                                value={v.Cod_Vend}
                                                                onChange={(e) => handleManualReassign(v.Cod_Cliente, Number(e.target.value), v.Dia_Semana, v.Periodicidade)}
                                                                className="bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold text-slate-700 outline-none w-full"
                                                            >
                                                                {teamColaboradores.map(col => (
                                                                    <option key={col.ID_Colaborador} value={col.CodigoSetor}>{col.Nome}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <select
                                                            value={v.Dia_Semana}
                                                            onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, e.target.value, v.Periodicidade)}
                                                            className="bg-slate-50 border border-slate-200 rounded p-1 text-[10px] font-bold text-slate-700 outline-none w-full"
                                                        >
                                                            {WEEKDAYS.map(day => (
                                                                <option key={day} value={day}>{day}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="p-3">
                                                        {parsePeriodicidade(v.Periodicidade).tipo === 'SEMANAL' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                Semanal
                                                            </span>
                                                        ) : (
                                                            <select
                                                                value={(v.Periodicidade && (v.Periodicidade.includes('2 4') || v.Periodicidade.includes('24') || v.Periodicidade.includes('2, 4'))) ? '2 4' : '1 3'}
                                                                onChange={(e) => handleManualReassign(v.Cod_Cliente, v.Cod_Vend, v.Dia_Semana, e.target.value === '2 4' ? '2 4' : '1 3')}
                                                                className="bg-amber-50 text-amber-800 border border-amber-200 rounded p-1 text-[10px] font-bold outline-none"
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
                                            ))}
                                    </tbody>
                                </table>
                                {scopedAdjustedRoutes.filter(v => selectedPromoter === 'ALL' || String(v.Cod_Vend) === selectedPromoter).length > 100 && (
                                    <div className="p-3 text-center text-slate-400 text-[10px] bg-slate-50 font-medium">
                                        Exibindo os primeiros 100 PDVs de {scopedAdjustedRoutes.filter(v => selectedPromoter === 'ALL' || String(v.Cod_Vend) === selectedPromoter).length}. Use filtros de colaborador para refinar a busca.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
