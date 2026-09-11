import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getVisitasPrevistas, geocodeAddress } from './services/apiService';
import { VisitaPrevista } from './types';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as XLSX from 'xlsx';
import {
    Search,
    MapPin,
    Navigation,
    RefreshCw,
    Play,
    Pause,
    Square,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    FileSpreadsheet,
    ExternalLink,
    Copy,
    Check,
    Filter,
    Layers,
    Eye,
    Crosshair,
    Sliders,
    Building2,
    User,
    ChevronLeft,
    ChevronRight,
    Compass,
    Database,
    HelpCircle
} from 'lucide-react';
import {
    UI_CARD_CONTAINER,
    UI_BUTTON_PRIMARY,
    UI_BUTTON_SECONDARY,
    UI_BUTTON_DANGER,
    UI_BUTTON_SUCCESS,
    UI_INPUT_BASE,
    UI_TABLE_CONTAINER,
    UI_TABLE_TH,
    UI_TABLE_TD,
    UI_BADGE_SUCCESS,
    UI_BADGE_NEUTRAL
} from '../../constants';

// --- TIPAGEM DO CLIENTE AUDITADO ---
export type StatusAuditoria = 
    | 'SEM_COORDENADAS_ERP' 
    | 'OK' 
    | 'DIVERGENCIA_LEVE' 
    | 'DIVERGENCIA_CRITICA' 
    | 'PENDENTE' 
    | 'FALHA_GEOCODE';

export interface ClienteAuditado {
    Cod_Cliente: number;
    Razao_Social: string;
    Cod_Vend: number;
    Nome_Vendedor: string;
    Cod_Supervisor: number;
    Nome_Supervisor: string;
    Endereco: string;
    Numero?: string;
    Bairro: string;
    Cidade: string;
    CEP: string;
    Canal_Remuneracao?: string;
    
    // Coordenadas cadastradas no ERP
    Lat_ERP: number;
    Long_ERP: number;
    HasValidERPCoords: boolean;

    // Coordenadas localizadas pelo Geocode
    Lat_Geocode: number | null;
    Long_Geocode: number | null;

    // Auditoria métrica
    Divergencia_Metros: number | null;
    Status: StatusAuditoria;
    GeocodedAt?: string;
}

// --- CÁLCULO DE DISTÂNCIA HAVERSINE EM METROS ---
export const calcDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2 || isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
};

// --- FUNÇÃO PARA CRIAR ÍCONES PERSONALIZADOS DO MAPA ---
const createMapPinIcon = (type: 'erp' | 'geocode') => {
    const isErp = type === 'erp';
    const bgGradient = isErp 
        ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' 
        : 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    const borderColor = isErp ? '#1e40af' : '#047857';
    const label = isErp ? 'ERP' : 'GEOCODE';
    const emoji = isErp ? '📍' : '🎯';

    return L.divIcon({
        className: `custom-pin-${type}`,
        iconSize: [40, 52],
        iconAnchor: [20, 50],
        popupAnchor: [0, -48],
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
                <div style="
                    background: ${bgGradient};
                    width: 38px;
                    height: 38px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 2.5px solid #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 0 2px ${borderColor};
                ">
                    <span style="transform: rotate(45deg); font-size: 16px;">${emoji}</span>
                </div>
                <div style="
                    background: #0f172a;
                    color: #ffffff;
                    font-size: 9px;
                    font-weight: 800;
                    padding: 1.5px 6px;
                    border-radius: 6px;
                    margin-top: 3px;
                    white-space: nowrap;
                    border: 1px solid rgba(255,255,255,0.4);
                    letter-spacing: 0.5px;
                ">
                    ${label}
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
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
                setTimeout(() => map.invalidateSize(), 250);
            } catch (e) {
                console.warn('Erro ao ajustar limites do mapa:', e);
            }
        }
    }, [bounds, map]);
    return null;
};

// --- CACHE LOCAL STORAGE KEYS ---
const GEOCODE_CACHE_STORAGE_KEY = 'fuel360_geocode_cache_v2';

export const GeolocalizadorERP: React.FC = () => {
    // --- ESTADOS DE CARGA E DADOS ---
    const [clientes, setClientes] = useState<ClienteAuditado[]>([]);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
    const [startDate, setStartDate] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    });

    // --- FILTROS DE VISUALIZAÇÃO ---
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>('ALL');
    const [selectedVendedor, setSelectedVendedor] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [toleranciaCriticaMetros, setToleranciaCriticaMetros] = useState<number>(500); // Acima de 500m é divergência crítica
    const toleranciaOkMetros = 150; // Até 150m é considerado OK (concordante)

    // --- ESTADOS DO MOTOR DE GEOCODIFICAÇÃO EM LOTE ---
    const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
    const [isPausedBatch, setIsPausedBatch] = useState<boolean>(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; success: number; failed: number }>({
        current: 0,
        total: 0,
        success: 0,
        failed: 0
    });
    const [batchScope, setBatchScope] = useState<'ALL' | 'SUPERVISOR' | 'VENDEDOR' | 'PENDING' | 'DIVERGENT'>('ALL');
    const isPausedRef = useRef<boolean>(false);
    const isCancelledRef = useRef<boolean>(false);

    // --- ESTADO DO MODAL DE MAPA ---
    const [selectedClientModal, setSelectedClientModal] = useState<ClienteAuditado | null>(null);
    const [copiedCoord, setCopiedCoord] = useState<boolean>(false);

    // --- PAGINAÇÃO DA TABELA ---
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(25);

    // --- CARREGAR CACHE LOCAL ---
    const getLocalCache = useCallback((): Record<number, { lat: number; lon: number; at: string }> => {
        try {
            const raw = localStorage.getItem(GEOCODE_CACHE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }, []);

    const saveToLocalCache = useCallback((codCliente: number, lat: number, lon: number) => {
        try {
            const current = getLocalCache();
            current[codCliente] = { lat, lon, at: new Date().toISOString() };
            localStorage.setItem(GEOCODE_CACHE_STORAGE_KEY, JSON.stringify(current));
        } catch (e) {
            console.warn('Erro ao salvar cache de geocode:', e);
        }
    }, [getLocalCache]);

    // --- CARREGAR CLIENTES DO ERP ---
    const handleLoadClientes = async () => {
        setIsLoadingData(true);
        try {
            const visitas: VisitaPrevista[] = await getVisitasPrevistas(startDate, endDate);
            if (!visitas || visitas.length === 0) {
                alert('Nenhuma visita encontrada no período selecionado.');
                setIsLoadingData(false);
                return;
            }

            const cache = getLocalCache();
            const clientMap = new Map<number, ClienteAuditado>();

            visitas.forEach(v => {
                if (!v.Cod_Cliente) return;
                if (!clientMap.has(v.Cod_Cliente)) {
                    const latErp = Number(v.Lat || 0);
                    const longErp = Number(v.Long || 0);
                    const hasValidErp = !isNaN(latErp) && !isNaN(longErp) && (Math.abs(latErp) > 0.001 || Math.abs(longErp) > 0.001);

                    const cached = cache[v.Cod_Cliente];
                    let latGeo: number | null = null;
                    let longGeo: number | null = null;
                    let divergencia: number | null = null;
                    let status: StatusAuditoria = 'PENDENTE';

                    if (!hasValidErp) {
                        status = 'SEM_COORDENADAS_ERP';
                    }

                    if (cached && !isNaN(cached.lat) && !isNaN(cached.lon)) {
                        latGeo = cached.lat;
                        longGeo = cached.lon;
                        if (hasValidErp) {
                            divergencia = calcDistanceMeters(latErp, longErp, latGeo, longGeo);
                            if (divergencia <= toleranciaOkMetros) {
                                status = 'OK';
                            } else if (divergencia <= toleranciaCriticaMetros) {
                                status = 'DIVERGENCIA_LEVE';
                            } else {
                                status = 'DIVERGENCIA_CRITICA';
                            }
                        } else {
                            status = 'SEM_COORDENADAS_ERP';
                        }
                    }

                    clientMap.set(v.Cod_Cliente, {
                        Cod_Cliente: v.Cod_Cliente,
                        Razao_Social: String(v.Razao_Social || `Cliente ${v.Cod_Cliente}`).trim(),
                        Cod_Vend: v.Cod_Vend || 0,
                        Nome_Vendedor: String(v.Nome_Vendedor || 'Vendedor Não Informado').trim(),
                        Cod_Supervisor: v.Cod_Supervisor || 0,
                        Nome_Supervisor: String(v.Nome_Supervisor || 'Supervisor Não Informado').trim(),
                        Endereco: String(v.Endereco || '').trim(),
                        Numero: String(v.Numero || '').trim() || undefined,
                        Bairro: String(v.Bairro || '').trim(),
                        Cidade: String(v.Cidade || '').trim(),
                        CEP: String(v.CEP || '').trim(),
                        Canal_Remuneracao: v.Canal_Remuneracao,
                        Lat_ERP: latErp,
                        Long_ERP: longErp,
                        HasValidERPCoords: hasValidErp,
                        Lat_Geocode: latGeo,
                        Long_Geocode: longGeo,
                        Divergencia_Metros: divergencia,
                        Status: status,
                        GeocodedAt: cached?.at
                    });
                }
            });

            const loadedList = Array.from(clientMap.values());
            setClientes(loadedList);
            setCurrentPage(1);
        } catch (error: any) {
            console.error('Erro ao carregar clientes do ERP:', error);
            alert(`Erro ao conectar ao ERP: ${error.message || 'Falha na comunicação'}`);
        } finally {
            setIsLoadingData(false);
        }
    };

    // --- RECALCULAR STATUS QUANDO MUDA A TOLERÂNCIA CRÍTICA ---
    useEffect(() => {
        setClientes(prev => prev.map(c => {
            if (!c.HasValidERPCoords) {
                return { ...c, Status: 'SEM_COORDENADAS_ERP' };
            }
            if (c.Lat_Geocode !== null && c.Long_Geocode !== null) {
                const dist = calcDistanceMeters(c.Lat_ERP, c.Long_ERP, c.Lat_Geocode, c.Long_Geocode);
                let st: StatusAuditoria = 'OK';
                if (dist <= toleranciaOkMetros) {
                    st = 'OK';
                } else if (dist <= toleranciaCriticaMetros) {
                    st = 'DIVERGENCIA_LEVE';
                } else {
                    st = 'DIVERGENCIA_CRITICA';
                }
                return { ...c, Divergencia_Metros: dist, Status: st };
            }
            return c;
        }));
    }, [toleranciaCriticaMetros]);

    // --- FORMATAR ENDEREÇO PARA GEOCODING (LOGRADOURO, NÚMERO, BAIRRO, CIDADE, CEP) ---
    const buildSearchAddress = (c: ClienteAuditado): string => {
        let addr = c.Endereco ? c.Endereco.trim() : '';
        if (c.Numero && c.Numero.trim() !== '' && !addr.includes(c.Numero.trim())) {
            addr = addr ? `${addr}, ${c.Numero.trim()}` : c.Numero.trim();
        }
        const parts: string[] = [];
        if (addr) parts.push(addr);
        if (c.Bairro && !addr.toLowerCase().includes(c.Bairro.toLowerCase())) parts.push(c.Bairro);
        if (c.Cidade && !addr.toLowerCase().includes(c.Cidade.toLowerCase())) parts.push(c.Cidade);
        if (c.CEP && String(c.CEP).trim() !== '') parts.push(`CEP ${String(c.CEP).trim()}`);
        return parts.join(', ');
    };

    // --- GEOCODIFICAR CLIENTE INDIVIDUAL ---
    const geocodeSingleClient = async (client: ClienteAuditado): Promise<ClienteAuditado> => {
        const fullAddr = buildSearchAddress(client);
        try {
            const res = await geocodeAddress({
                address: fullAddr,
                street: client.Endereco,
                number: client.Numero,
                neighborhood: client.Bairro,
                city: client.Cidade,
                cep: client.CEP
            });
            if (res && res.lat && res.lon && !isNaN(res.lat) && !isNaN(res.lon)) {
                saveToLocalCache(client.Cod_Cliente, res.lat, res.lon);
                let divergencia: number | null = null;
                let status: StatusAuditoria = 'SEM_COORDENADAS_ERP';

                if (client.HasValidERPCoords) {
                    divergencia = calcDistanceMeters(client.Lat_ERP, client.Long_ERP, res.lat, res.lon);
                    if (divergencia <= toleranciaOkMetros) {
                        status = 'OK';
                    } else if (divergencia <= toleranciaCriticaMetros) {
                        status = 'DIVERGENCIA_LEVE';
                    } else {
                        status = 'DIVERGENCIA_CRITICA';
                    }
                }

                return {
                    ...client,
                    Lat_Geocode: res.lat,
                    Long_Geocode: res.lon,
                    Divergencia_Metros: divergencia,
                    Status: status,
                    GeocodedAt: new Date().toISOString()
                };
            } else {
                return {
                    ...client,
                    Status: 'FALHA_GEOCODE'
                };
            }
        } catch (e) {
            return {
                ...client,
                Status: 'FALHA_GEOCODE'
            };
        }
    };

    const handleGeocodeIndividual = async (client: ClienteAuditado) => {
        const updated = await geocodeSingleClient(client);
        setClientes(prev => prev.map(c => c.Cod_Cliente === updated.Cod_Cliente ? updated : c));
        if (selectedClientModal && selectedClientModal.Cod_Cliente === updated.Cod_Cliente) {
            setSelectedClientModal(updated);
        }
    };

    // --- APROVAR COORDENADA DO ERP COMO CORRETA ---
    const handleApproveErpCoord = (client: ClienteAuditado) => {
        if (!client.HasValidERPCoords) return;
        saveToLocalCache(client.Cod_Cliente, client.Lat_ERP, client.Long_ERP);
        const updated: ClienteAuditado = {
            ...client,
            Lat_Geocode: client.Lat_ERP,
            Long_Geocode: client.Long_ERP,
            Divergencia_Metros: 0,
            Status: 'OK',
            GeocodedAt: new Date().toISOString()
        };
        setClientes(prev => prev.map(c => c.Cod_Cliente === updated.Cod_Cliente ? updated : c));
        if (selectedClientModal && selectedClientModal.Cod_Cliente === updated.Cod_Cliente) {
            setSelectedClientModal(updated);
        }
    };

    // --- FORÇAR GEOCODIFICAÇÃO POR CEP ---
    const handleGeocodeByCep = async (client: ClienteAuditado) => {
        if (!client.CEP || String(client.CEP).trim() === '') {
            alert('Este cliente não possui CEP cadastrado.');
            return;
        }
        try {
            const res = await geocodeAddress({
                address: client.CEP,
                street: client.Endereco,
                number: client.Numero,
                neighborhood: client.Bairro,
                city: client.Cidade,
                cep: client.CEP,
                forceCepOnly: true
            });
            if (res && res.lat && res.lon && !isNaN(res.lat) && !isNaN(res.lon)) {
                saveToLocalCache(client.Cod_Cliente, res.lat, res.lon);
                let divergencia: number | null = null;
                let status: StatusAuditoria = 'SEM_COORDENADAS_ERP';

                if (client.HasValidERPCoords) {
                    divergencia = calcDistanceMeters(client.Lat_ERP, client.Long_ERP, res.lat, res.lon);
                    if (divergencia <= toleranciaOkMetros) {
                        status = 'OK';
                    } else if (divergencia <= toleranciaCriticaMetros) {
                        status = 'DIVERGENCIA_LEVE';
                    } else {
                        status = 'DIVERGENCIA_CRITICA';
                    }
                }

                const updated: ClienteAuditado = {
                    ...client,
                    Lat_Geocode: res.lat,
                    Long_Geocode: res.lon,
                    Divergencia_Metros: divergencia,
                    Status: status,
                    GeocodedAt: new Date().toISOString()
                };
                setClientes(prev => prev.map(c => c.Cod_Cliente === updated.Cod_Cliente ? updated : c));
                if (selectedClientModal && selectedClientModal.Cod_Cliente === updated.Cod_Cliente) {
                    setSelectedClientModal(updated);
                }
            } else {
                alert('Não foi possível obter localização para o CEP deste cliente.');
            }
        } catch (e: any) {
            alert(`Erro ao geocodificar por CEP: ${e.message}`);
        }
    };

    // --- MOTOR DE PROCESSAMENTO EM LOTE (MASSA) ---
    const handleStartBatch = async () => {
        if (clientes.length === 0) {
            alert('Carregue os clientes primeiro.');
            return;
        }

        // Determinar lista a ser processada de acordo com o escopo
        let queue = [...clientes];
        if (batchScope === 'SUPERVISOR') {
            if (selectedSupervisor === 'ALL') {
                alert('Selecione um supervisor específico no filtro para usar este escopo.');
                return;
            }
            queue = queue.filter(c => String(c.Cod_Supervisor) === selectedSupervisor || c.Nome_Supervisor === selectedSupervisor);
        } else if (batchScope === 'VENDEDOR') {
            if (selectedVendedor === 'ALL') {
                alert('Selecione um vendedor específico no filtro para usar este escopo.');
                return;
            }
            queue = queue.filter(c => String(c.Cod_Vend) === selectedVendedor || c.Nome_Vendedor === selectedVendedor);
        } else if (batchScope === 'PENDING') {
            queue = queue.filter(c => c.Lat_Geocode === null);
        } else if (batchScope === 'DIVERGENT') {
            queue = queue.filter(c => c.Status === 'DIVERGENCIA_CRITICA' || c.Status === 'SEM_COORDENADAS_ERP');
        }

        if (queue.length === 0) {
            alert('Nenhum cliente elegível para processamento com os critérios selecionados.');
            return;
        }

        setIsProcessingBatch(true);
        setIsPausedBatch(false);
        isPausedRef.current = false;
        isCancelledRef.current = false;

        setBatchProgress({
            current: 0,
            total: queue.length,
            success: 0,
            failed: 0
        });

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < queue.length; i++) {
            // Verificar cancelamento
            if (isCancelledRef.current) {
                break;
            }

            // Verificar pausa
            while (isPausedRef.current) {
                await new Promise(r => setTimeout(r, 400));
                if (isCancelledRef.current) break;
            }
            if (isCancelledRef.current) break;

            const client = queue[i];
            const updated = await geocodeSingleClient(client);

            if (updated.Lat_Geocode !== null) {
                successCount++;
            } else {
                failedCount++;
            }

            // Atualizar cliente no estado principal
            setClientes(prev => prev.map(c => c.Cod_Cliente === updated.Cod_Cliente ? updated : c));

            // Atualizar progresso
            setBatchProgress({
                current: i + 1,
                total: queue.length,
                success: successCount,
                failed: failedCount
            });

            // Delay de segurança entre requisições para evitar Rate Limit (429) das APIs de mapas
            await new Promise(r => setTimeout(r, 180));
        }

        setIsProcessingBatch(false);
        setIsPausedBatch(false);
    };

    const handlePauseBatch = () => {
        isPausedRef.current = !isPausedRef.current;
        setIsPausedBatch(isPausedRef.current);
    };

    const handleCancelBatch = () => {
        isCancelledRef.current = true;
        isPausedRef.current = false;
        setIsPausedBatch(false);
        setIsProcessingBatch(false);
    };

    // --- LISTAS PARA FILTROS DINÂMICOS ---
    const supervisorsList = useMemo(() => {
        const setMap = new Map<string, string>();
        clientes.forEach(c => {
            const key = String(c.Cod_Supervisor || c.Nome_Supervisor);
            if (key && key !== '0') {
                setMap.set(key, c.Nome_Supervisor || `Supervisor ${c.Cod_Supervisor}`);
            }
        });
        return Array.from(setMap.entries()).map(([key, name]) => ({ key, name }));
    }, [clientes]);

    const sellersList = useMemo(() => {
        const setMap = new Map<string, string>();
        clientes.forEach(c => {
            if (selectedSupervisor !== 'ALL') {
                const matchSup = String(c.Cod_Supervisor) === selectedSupervisor || c.Nome_Supervisor === selectedSupervisor;
                if (!matchSup) return;
            }
            const key = String(c.Cod_Vend || c.Nome_Vendedor);
            if (key && key !== '0') {
                setMap.set(key, c.Nome_Vendedor || `Vendedor ${c.Cod_Vend}`);
            }
        });
        return Array.from(setMap.entries()).map(([key, name]) => ({ key, name }));
    }, [clientes, selectedSupervisor]);

    // --- FILTRAGEM FINAL DOS CLIENTES ---
    const filteredClientes = useMemo(() => {
        return clientes.filter(c => {
            // Filtro Supervisor
            if (selectedSupervisor !== 'ALL') {
                const matchSup = String(c.Cod_Supervisor) === selectedSupervisor || c.Nome_Supervisor === selectedSupervisor;
                if (!matchSup) return false;
            }
            // Filtro Vendedor
            if (selectedVendedor !== 'ALL') {
                const matchVend = String(c.Cod_Vend) === selectedVendedor || c.Nome_Vendedor === selectedVendedor;
                if (!matchVend) return false;
            }
            // Filtro Status
            if (selectedStatus !== 'ALL') {
                if (c.Status !== selectedStatus) return false;
            }
            // Busca textual
            if (searchTerm.trim() !== '') {
                const term = searchTerm.toLowerCase();
                const match = 
                    c.Razao_Social.toLowerCase().includes(term) ||
                    String(c.Cod_Cliente).includes(term) ||
                    c.Endereco.toLowerCase().includes(term) ||
                    c.Bairro.toLowerCase().includes(term) ||
                    c.Cidade.toLowerCase().includes(term) ||
                    String(c.CEP || '').toLowerCase().includes(term) ||
                    c.Nome_Vendedor.toLowerCase().includes(term) ||
                    c.Nome_Supervisor.toLowerCase().includes(term);
                if (!match) return false;
            }
            return true;
        });
    }, [clientes, selectedSupervisor, selectedVendedor, selectedStatus, searchTerm]);

    // --- ESTATÍSTICAS E CARDS SUPERIORES ---
    const stats = useMemo(() => {
        const total = clientes.length;
        let geocoded = 0;
        let semCoordsErp = 0;
        let divergenciaCritica = 0;
        let divergenciaLeve = 0;
        let ok = 0;
        let pendentes = 0;
        let falhas = 0;

        clientes.forEach(c => {
            if (c.Lat_Geocode !== null && c.Long_Geocode !== null) {
                geocoded++;
            }
            if (!c.HasValidERPCoords) {
                semCoordsErp++;
            }
            if (c.Status === 'DIVERGENCIA_CRITICA') divergenciaCritica++;
            else if (c.Status === 'DIVERGENCIA_LEVE') divergenciaLeve++;
            else if (c.Status === 'OK') ok++;
            else if (c.Status === 'PENDENTE') pendentes++;
            else if (c.Status === 'FALHA_GEOCODE') falhas++;
        });

        return {
            total,
            geocoded,
            semCoordsErp,
            divergenciaCritica,
            divergenciaLeve,
            ok,
            pendentes,
            falhas,
            percentGeocoded: total > 0 ? Math.round((geocoded / total) * 100) : 0
        };
    }, [clientes]);

    // --- CLIENTES PAGINADOS ---
    const totalPages = Math.max(1, Math.ceil(filteredClientes.length / itemsPerPage));
    const paginatedClientes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredClientes.slice(start, start + itemsPerPage);
    }, [filteredClientes, currentPage, itemsPerPage]);

    // --- EXPORTAR EXCEL ---
    const handleExportExcel = () => {
        if (filteredClientes.length === 0) {
            alert('Nenhum dado filtrado para exportar.');
            return;
        }

        const dataToExport = filteredClientes.map(c => ({
            'Cód. PDV': c.Cod_Cliente,
            'Razão Social': c.Razao_Social,
            'Vendedor': `${c.Cod_Vend} - ${c.Nome_Vendedor}`,
            'Supervisor': `${c.Cod_Supervisor} - ${c.Nome_Supervisor}`,
            'Endereço': c.Endereco,
            'Bairro': c.Bairro,
            'Cidade': c.Cidade,
            'CEP': c.CEP,
            'Lat ERP': c.Lat_ERP || '',
            'Long ERP': c.Long_ERP || '',
            'Lat Geocode': c.Lat_Geocode || '',
            'Long Geocode': c.Long_Geocode || '',
            'Divergência (Metros)': c.Divergencia_Metros !== null ? c.Divergencia_Metros : '',
            'Divergência (Km)': c.Divergencia_Metros !== null ? (c.Divergencia_Metros / 1000).toFixed(2) : '',
            'Status Auditoria': 
                c.Status === 'OK' ? 'Concordante (OK)' :
                c.Status === 'DIVERGENCIA_LEVE' ? 'Divergência Leve' :
                c.Status === 'DIVERGENCIA_CRITICA' ? 'Divergência Crítica (> Limiar)' :
                c.Status === 'SEM_COORDENADAS_ERP' ? 'Sem Coordenadas no ERP' :
                c.Status === 'PENDENTE' ? 'Pendente de Geocoding' : 'Falha ao Localizar',
            'Ação Recomendada': 
                !c.HasValidERPCoords && c.Lat_Geocode ? 'Cadastrar Lat/Long no ERP via Geocode' :
                c.Status === 'DIVERGENCIA_CRITICA' ? 'Corrigir Coordenadas no ERP' :
                c.Status === 'DIVERGENCIA_LEVE' ? 'Auditar Endereço e CEP' : 'Manter'
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Auditoria_Geolocalizacao');
        const filename = `Auditoria_Geolocalizador_ERP_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // --- COPIAR COORDENADAS PARA O CLIPBOARD ---
    const handleCopyCoords = (lat: number | null, lon: number | null) => {
        if (lat === null || lon === null) return;
        const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        navigator.clipboard.writeText(text);
        setCopiedCoord(true);
        setTimeout(() => setCopiedCoord(false), 2000);
    };

    // --- LIMITES DO MAPA PARA O MODAL ---
    const modalMapBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
        if (!selectedClientModal) return null;
        const points: [number, number][] = [];
        if (selectedClientModal.HasValidERPCoords) {
            points.push([selectedClientModal.Lat_ERP, selectedClientModal.Long_ERP]);
        }
        if (selectedClientModal.Lat_Geocode !== null && selectedClientModal.Long_Geocode !== null) {
            points.push([selectedClientModal.Lat_Geocode, selectedClientModal.Long_Geocode]);
        }
        if (points.length === 0) return null;
        if (points.length === 1) {
            const p = points[0];
            return [
                [p[0] - 0.005, p[1] - 0.005],
                [p[0] + 0.005, p[1] + 0.005]
            ];
        }
        return points as L.LatLngBoundsExpression;
    }, [selectedClientModal]);

    return (
        <div className="space-y-6">
            {/* CABEÇALHO DO MÓDULO */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                        <Crosshair size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                            Geolocalizador & Auditor ERP
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Fuel360
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                            Conferência e auditoria métrica de latitude/longitude cadastrada no ERP vs geocodificação real dos endereços.
                        </p>
                    </div>
                </div>

                {/* CONTROLES DE CARGA ERP */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex flex-col px-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Período De</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                            />
                        </div>
                        <span className="text-slate-400 text-xs font-bold">até</span>
                        <div className="flex flex-col px-2">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Até</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleLoadClientes}
                        disabled={isLoadingData || isProcessingBatch}
                        className={`${UI_BUTTON_PRIMARY} flex items-center gap-2 text-xs py-2.5 shadow-md`}
                    >
                        <RefreshCw size={14} className={isLoadingData ? 'animate-spin' : ''} />
                        {isLoadingData ? 'Carregando ERP...' : 'Carregar Base ERP'}
                    </button>

                    {clientes.length > 0 && (
                        <button
                            onClick={handleExportExcel}
                            className={`${UI_BUTTON_SECONDARY} flex items-center gap-2 text-xs py-2.5`}
                            title="Exportar dados filtrados para planilha Excel"
                        >
                            <FileSpreadsheet size={14} className="text-emerald-600" />
                            Exportar Excel
                        </button>
                    )}
                </div>
            </div>

            {/* CARDS DE INDICADORES (MÉTRICAS) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">Total Clientes</span>
                        <Database size={16} className="text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1">PDVs únicos na base</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">Geocodificados</span>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.geocoded}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1">{stats.percentGeocoded}% auditados</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">Concordantes</span>
                        <Check size={16} className="text-teal-500" />
                    </div>
                    <div className="text-2xl font-black text-teal-600 dark:text-teal-400">{stats.ok}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1">Divergência &le; {toleranciaOkMetros}m</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">Divergência Leve</span>
                        <AlertTriangle size={16} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.divergenciaLeve}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1">{toleranciaOkMetros}m a {toleranciaCriticaMetros}m</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">Diverg. Crítica</span>
                        <XCircle size={16} className="text-red-500" />
                    </div>
                    <div className="text-2xl font-black text-red-600 dark:text-red-400">{stats.divergenciaCritica}</div>
                    <div className="text-[10px] text-red-500 font-bold mt-1">&gt; {toleranciaCriticaMetros} metros</div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider">ERP Zerado/Nulo</span>
                        <HelpCircle size={16} className="text-purple-500" />
                    </div>
                    <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.semCoordsErp}</div>
                    <div className="text-[10px] text-slate-500 font-medium mt-1">Sem Lat/Long no ERP</div>
                </div>
            </div>

            {/* BARRA DE PROCESSAMENTO EM MASSA (GEOCODIFICAÇÃO EM LOTE) */}
            <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            <Navigation size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                                Motor de Geocodificação em Massa
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Dispare a localização automática dos endereços com taxa de requisição controlada e cache local.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Seletor de Escopo de Processamento */}
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">Escopo:</span>
                            <select
                                value={batchScope}
                                onChange={e => setBatchScope(e.target.value as any)}
                                disabled={isProcessingBatch}
                                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                            >
                                <option value="ALL">Toda a Base ({clientes.length})</option>
                                <option value="SUPERVISOR">Apenas Equipe Filtrada</option>
                                <option value="VENDEDOR">Apenas Vendedor Filtrado</option>
                                <option value="PENDING">Apenas Pendentes ({stats.pendentes})</option>
                                <option value="DIVERGENT">Apenas Divergentes/Sem Coords ({stats.divergenciaCritica + stats.semCoordsErp})</option>
                            </select>
                        </div>

                        {/* Botões de Ação do Batch */}
                        {!isProcessingBatch ? (
                            <button
                                onClick={handleStartBatch}
                                disabled={clientes.length === 0}
                                className={`${UI_BUTTON_SUCCESS} flex items-center gap-2 text-xs py-2 px-4`}
                            >
                                <Play size={13} />
                                Iniciar Geocode em Massa
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePauseBatch}
                                    className={`${UI_BUTTON_SECONDARY} flex items-center gap-2 text-xs py-2 px-3`}
                                >
                                    {isPausedBatch ? <Play size={13} className="text-emerald-500" /> : <Pause size={13} className="text-amber-500" />}
                                    {isPausedBatch ? 'Retomar' : 'Pausar'}
                                </button>
                                <button
                                    onClick={handleCancelBatch}
                                    className={`${UI_BUTTON_DANGER} flex items-center gap-2 text-xs py-2 px-3`}
                                >
                                    <Square size={13} />
                                    Interromper
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Barra de Progresso Visual */}
                {isProcessingBatch && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <RefreshCw size={12} className="animate-spin text-blue-500" />
                                {isPausedBatch ? 'Processamento Pausado' : 'Processando Geocodificação...'}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                                {batchProgress.current} de {batchProgress.total} clientes ({batchProgress.total > 0 ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0}%)
                            </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                                style={{
                                    width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                                <Check size={12} /> {batchProgress.success} localizados
                            </span>
                            <span className="flex items-center gap-1 text-red-500 font-bold">
                                <XCircle size={12} /> {batchProgress.failed} falhas
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ÁREA DE FILTROS E PESQUISA */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Busca Textual */}
                    <div className="lg:col-span-2">
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Buscar PDV, Nome, Endereço ou Cidade
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Digite para buscar..."
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className={`${UI_INPUT_BASE} pl-9 text-xs py-2`}
                            />
                            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                        </div>
                    </div>

                    {/* Filtro Equipe / Supervisor */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Equipe / Supervisor
                        </label>
                        <select
                            value={selectedSupervisor}
                            onChange={e => { setSelectedSupervisor(e.target.value); setSelectedVendedor('ALL'); setCurrentPage(1); }}
                            className={`${UI_INPUT_BASE} text-xs py-2 cursor-pointer`}
                        >
                            <option value="ALL">Todos os Supervisores</option>
                            {supervisorsList.map(s => (
                                <option key={s.key} value={s.key}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Vendedor */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Vendedor
                        </label>
                        <select
                            value={selectedVendedor}
                            onChange={e => { setSelectedVendedor(e.target.value); setCurrentPage(1); }}
                            className={`${UI_INPUT_BASE} text-xs py-2 cursor-pointer`}
                        >
                            <option value="ALL">Todos os Vendedores</option>
                            {sellersList.map(v => (
                                <option key={v.key} value={v.key}>{v.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro Status da Auditoria */}
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400">
                            Status Auditoria
                        </label>
                        <select
                            value={selectedStatus}
                            onChange={e => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                            className={`${UI_INPUT_BASE} text-xs py-2 cursor-pointer`}
                        >
                            <option value="ALL">Todos os Status</option>
                            <option value="DIVERGENCIA_CRITICA">🚨 Divergência Crítica (&gt; {toleranciaCriticaMetros}m)</option>
                            <option value="DIVERGENCIA_LEVE">⚠️ Divergência Leve</option>
                            <option value="SEM_COORDENADAS_ERP">🟣 ERP Sem Coordenadas</option>
                            <option value="OK">✅ Concordante (OK)</option>
                            <option value="PENDENTE">⏳ Pendente de Geocoding</option>
                            <option value="FALHA_GEOCODE">❌ Falha na Localização</option>
                        </select>
                    </div>
                </div>

                {/* Régua de Tolerância e Resumo de Filtrados */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Sliders size={13} />
                            Limiar de Divergência Crítica:
                        </span>
                        <div className="flex items-center gap-1">
                            {[300, 500, 1000, 2000, 5000].map(val => (
                                <button
                                    key={val}
                                    onClick={() => setToleranciaCriticaMetros(val)}
                                    className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                        toleranciaCriticaMetros === val
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {val >= 1000 ? `${val / 1000}km` : `${val}m`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="text-slate-500 dark:text-slate-400 font-medium">
                        Exibindo <strong className="text-slate-900 dark:text-white">{filteredClientes.length}</strong> de <strong>{clientes.length}</strong> clientes
                    </div>
                </div>
            </div>

            {/* TABELA DE AUDITORIA COMPARATIVA */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
                {clientes.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto">
                            <Database size={32} />
                        </div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            Nenhum cliente carregado na auditoria
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                            Selecione o período acima e clique no botão <strong>"Carregar Base ERP"</strong> para importar os clientes com as coordenadas cadastradas no ERP.
                        </p>
                        <button
                            onClick={handleLoadClientes}
                            disabled={isLoadingData}
                            className={`${UI_BUTTON_PRIMARY} text-xs mt-2 py-2 px-6`}
                        >
                            Carregar Clientes Agora
                        </button>
                    </div>
                ) : filteredClientes.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <Filter size={32} className="text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum cliente com os filtros aplicados</h4>
                        <p className="text-xs text-slate-500">Tente limpar a busca ou selecionar outro status/supervisor.</p>
                    </div>
                ) : (
                    <>
                        <div className={UI_TABLE_CONTAINER}>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className={UI_TABLE_TH}>PDV / Razão Social</th>
                                        <th className={UI_TABLE_TH}>Vendedor / Equipe</th>
                                        <th className={UI_TABLE_TH}>Endereço Completo</th>
                                        <th className={UI_TABLE_TH}>Coordenadas ERP</th>
                                        <th className={UI_TABLE_TH}>Coordenadas Geocode</th>
                                        <th className={UI_TABLE_TH}>Divergência</th>
                                        <th className={UI_TABLE_TH}>Status</th>
                                        <th className={`${UI_TABLE_TH} text-center`}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {paginatedClientes.map(client => {
                                        const hasGeo = client.Lat_Geocode !== null && client.Long_Geocode !== null;
                                        return (
                                            <tr 
                                                key={client.Cod_Cliente}
                                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                            >
                                                {/* PDV / Razão Social */}
                                                <td className={UI_TABLE_TD}>
                                                    <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                                        {client.Razao_Social}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono font-bold">
                                                        Cód: {client.Cod_Cliente}
                                                    </div>
                                                </td>

                                                {/* Vendedor / Equipe */}
                                                <td className={UI_TABLE_TD}>
                                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                        {client.Nome_Vendedor}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        Sup: {client.Nome_Supervisor}
                                                    </div>
                                                </td>

                                                {/* Endereço */}
                                                <td className={`${UI_TABLE_TD} max-w-[280px]`}>
                                                    <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate" title={client.Endereco}>
                                                        {client.Endereco || 'Endereço não cadastrado'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {client.Bairro} - {client.Cidade} {client.CEP ? `(${client.CEP})` : ''}
                                                    </div>
                                                </td>

                                                {/* Coordenadas ERP */}
                                                <td className={UI_TABLE_TD}>
                                                    {client.HasValidERPCoords ? (
                                                        <div className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                                                            <div>{client.Lat_ERP.toFixed(6)}</div>
                                                            <div>{client.Long_ERP.toFixed(6)}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                                                            Sem Coordenadas
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Coordenadas Geocode */}
                                                <td className={UI_TABLE_TD}>
                                                    {hasGeo ? (
                                                        <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                            <div>{client.Lat_Geocode!.toFixed(6)}</div>
                                                            <div>{client.Long_Geocode!.toFixed(6)}</div>
                                                        </div>
                                                    ) : client.Status === 'FALHA_GEOCODE' ? (
                                                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                                                            Não Localizado
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 italic">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Divergência em Metros */}
                                                <td className={UI_TABLE_TD}>
                                                    {client.Divergencia_Metros !== null ? (
                                                        <div>
                                                            <div className={`text-xs font-black ${
                                                                client.Divergencia_Metros > toleranciaCriticaMetros ? 'text-red-600 dark:text-red-400' :
                                                                client.Divergencia_Metros > toleranciaOkMetros ? 'text-amber-600 dark:text-amber-400' :
                                                                'text-emerald-600 dark:text-emerald-400'
                                                            }`}>
                                                                {client.Divergencia_Metros.toLocaleString()} metros
                                                            </div>
                                                            {client.Divergencia_Metros >= 1000 && (
                                                                <div className="text-[10px] text-slate-500 font-medium">
                                                                    ({(client.Divergencia_Metros / 1000).toFixed(2)} km)
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : !client.HasValidERPCoords && hasGeo ? (
                                                        <span className="text-[10px] font-bold text-purple-600">Localizado</span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">-</span>
                                                    )}
                                                </td>

                                                {/* Badge de Status */}
                                                <td className={UI_TABLE_TD}>
                                                    {client.Status === 'OK' && (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 uppercase">
                                                            <Check size={11} /> OK (&le; {toleranciaOkMetros}m)
                                                        </span>
                                                    )}
                                                    {client.Status === 'DIVERGENCIA_LEVE' && (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 uppercase">
                                                            <AlertTriangle size={11} /> Leve (&le; {toleranciaCriticaMetros}m)
                                                        </span>
                                                    )}
                                                    {client.Status === 'DIVERGENCIA_CRITICA' && (
                                                        <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 uppercase animate-pulse">
                                                            <XCircle size={11} /> Crítica (&gt; {toleranciaCriticaMetros}m)
                                                        </span>
                                                    )}
                                                    {client.Status === 'SEM_COORDENADAS_ERP' && (
                                                        <span className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 uppercase">
                                                            <HelpCircle size={11} /> ERP Zerado
                                                        </span>
                                                    )}
                                                    {client.Status === 'PENDENTE' && (
                                                        <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 uppercase">
                                                            Pendente
                                                        </span>
                                                    )}
                                                    {client.Status === 'FALHA_GEOCODE' && (
                                                        <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 uppercase">
                                                            Falha Geocode
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className={`${UI_TABLE_TD} text-center`}>
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {/* Botão Ver no Mapa */}
                                                        <button
                                                            onClick={() => setSelectedClientModal(client)}
                                                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                                            title="Visualizar divergência no Mapa"
                                                        >
                                                            <MapPin size={15} />
                                                        </button>

                                                        {/* Botão Geocodificar Individual */}
                                                        <button
                                                            onClick={() => handleGeocodeIndividual(client)}
                                                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                                                            title="Geocodificar este cliente agora"
                                                        >
                                                            <RefreshCw size={15} />
                                                        </button>

                                                        {/* Copiar Coordenadas Geocodificadas */}
                                                        {hasGeo && (
                                                            <button
                                                                onClick={() => handleCopyCoords(client.Lat_Geocode, client.Long_Geocode)}
                                                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                                title="Copiar Lat/Long Geocodificada para a área de transferência"
                                                            >
                                                                <Copy size={15} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* CONTROLES DE PAGINAÇÃO */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-500 font-medium">Itens por página:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold text-slate-800 dark:text-slate-200 outline-none"
                                >
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="px-3 font-bold text-slate-800 dark:text-slate-200">
                                    Página {currentPage} de {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* MODAL DE MAPA COMPARATIVO */}
            {selectedClientModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                        {/* Header Modal */}
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    Auditoria de Localização • PDV {selectedClientModal.Cod_Cliente}
                                </span>
                                <h3 className="text-base font-black text-slate-900 dark:text-white">
                                    {selectedClientModal.Razao_Social}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {selectedClientModal.Endereco} • {selectedClientModal.Bairro}, {selectedClientModal.Cidade} - CEP {selectedClientModal.CEP}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedClientModal(null)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 cursor-pointer transition-colors"
                            >
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Banner Comparativo de Divergência */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                                    Coordenadas ERP
                                </div>
                                <div className="text-xs font-mono font-bold mt-1 text-slate-800 dark:text-slate-200">
                                    {selectedClientModal.HasValidERPCoords 
                                        ? `${selectedClientModal.Lat_ERP.toFixed(6)}, ${selectedClientModal.Long_ERP.toFixed(6)}`
                                        : 'Não Cadastrada / Zerada no ERP'}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                                    Coordenadas Geocode
                                </div>
                                <div className="text-xs font-mono font-bold mt-1 text-slate-800 dark:text-slate-200">
                                    {selectedClientModal.Lat_Geocode !== null && selectedClientModal.Long_Geocode !== null
                                        ? `${selectedClientModal.Lat_Geocode.toFixed(6)}, ${selectedClientModal.Long_Geocode.toFixed(6)}`
                                        : 'Ainda Não Geocodificado'}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Divergência Métrica
                                </div>
                                <div className="text-sm font-black mt-0.5">
                                    {selectedClientModal.Divergencia_Metros !== null ? (
                                        <span className={
                                            selectedClientModal.Divergencia_Metros > toleranciaCriticaMetros ? 'text-red-600' :
                                            selectedClientModal.Divergencia_Metros > toleranciaOkMetros ? 'text-amber-600' :
                                            'text-emerald-600'
                                        }>
                                            {selectedClientModal.Divergencia_Metros.toLocaleString()} metros
                                            {selectedClientModal.Divergencia_Metros >= 1000 && ` (${(selectedClientModal.Divergencia_Metros / 1000).toFixed(2)} km)`}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">Sem comparação direta</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Corpo do Modal - Mapa Leaflet */}
                        <div className="flex-1 min-h-[420px] relative bg-slate-100 dark:bg-slate-950">
                            {modalMapBounds ? (
                                <MapContainer
                                    style={{ width: '100%', height: '100%', minHeight: '420px' }}
                                    zoom={14}
                                    center={[-23.5505, -46.6333]}
                                >
                                    <MapFitBounds bounds={modalMapBounds} />
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; OpenStreetMap contributors'
                                    />

                                    {/* Marcador ERP (Azul) */}
                                    {selectedClientModal.HasValidERPCoords && (
                                        <Marker
                                            position={[selectedClientModal.Lat_ERP, selectedClientModal.Long_ERP]}
                                            icon={createMapPinIcon('erp')}
                                        >
                                            <Popup>
                                                <div className="text-xs p-1 space-y-1 font-sans">
                                                    <span className="font-bold text-blue-600 uppercase text-[10px]">📍 Posição ERP</span>
                                                    <p className="font-extrabold">{selectedClientModal.Razao_Social}</p>
                                                    <p className="font-mono text-[10px] text-slate-500">
                                                        Lat: {selectedClientModal.Lat_ERP.toFixed(6)}<br/>
                                                        Long: {selectedClientModal.Long_ERP.toFixed(6)}
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}

                                    {/* Marcador Geocode (Verde) */}
                                    {selectedClientModal.Lat_Geocode !== null && selectedClientModal.Long_Geocode !== null && (
                                        <Marker
                                            position={[selectedClientModal.Lat_Geocode, selectedClientModal.Long_Geocode]}
                                            icon={createMapPinIcon('geocode')}
                                        >
                                            <Popup>
                                                <div className="text-xs p-1 space-y-1 font-sans">
                                                    <span className="font-bold text-emerald-600 uppercase text-[10px]">🎯 Posição Geocodificada</span>
                                                    <p className="font-extrabold">{selectedClientModal.Razao_Social}</p>
                                                    <p className="text-[10px] text-slate-600">{selectedClientModal.Endereco}</p>
                                                    <p className="font-mono text-[10px] text-slate-500">
                                                        Lat: {selectedClientModal.Lat_Geocode.toFixed(6)}<br/>
                                                        Long: {selectedClientModal.Long_Geocode.toFixed(6)}
                                                    </p>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    )}

                                    {/* Linha Vermelha de Divergência */}
                                    {selectedClientModal.HasValidERPCoords && 
                                     selectedClientModal.Lat_Geocode !== null && 
                                     selectedClientModal.Long_Geocode !== null && (
                                        <Polyline
                                            positions={[
                                                [selectedClientModal.Lat_ERP, selectedClientModal.Long_ERP],
                                                [selectedClientModal.Lat_Geocode, selectedClientModal.Long_Geocode]
                                            ]}
                                            pathOptions={{
                                                color: '#ef4444',
                                                weight: 3.5,
                                                dashArray: '8, 8',
                                                opacity: 0.85
                                            }}
                                        />
                                    )}
                                </MapContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 p-8">
                                    <MapPin size={40} className="text-slate-300 animate-pulse" />
                                    <p className="text-sm font-bold">Cliente sem coordenadas ERP e ainda não geocodificado</p>
                                    <button
                                        onClick={() => handleGeocodeIndividual(selectedClientModal)}
                                        className={`${UI_BUTTON_PRIMARY} text-xs py-2 px-4`}
                                    >
                                        Geocodificar Agora
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                {selectedClientModal.Lat_Geocode !== null && selectedClientModal.Long_Geocode !== null && (
                                    <>
                                        <button
                                            onClick={() => handleCopyCoords(selectedClientModal.Lat_Geocode, selectedClientModal.Long_Geocode)}
                                            className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-3 flex items-center gap-1.5`}
                                        >
                                            {copiedCoord ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                            {copiedCoord ? 'Coordenadas Copiadas!' : 'Copiar Lat/Long Geocodificada'}
                                        </button>

                                        <a
                                            href={`https://www.google.com/maps?q=${selectedClientModal.Lat_Geocode},${selectedClientModal.Long_Geocode}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-3 flex items-center gap-1.5`}
                                        >
                                            <ExternalLink size={14} />
                                            Abrir no Google Maps
                                        </a>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Aprovar Posição do ERP */}
                                {selectedClientModal.HasValidERPCoords && (
                                    <button
                                        onClick={() => handleApproveErpCoord(selectedClientModal)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider transition-all active:scale-95 text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-900/20"
                                        title="Aprovar e adotar a coordenada do ERP como a localização correta deste cliente"
                                    >
                                        <Check size={14} />
                                        Aprovar Posição ERP
                                    </button>
                                )}

                                {/* Geocodificar por CEP */}
                                {selectedClientModal.CEP && (
                                    <button
                                        onClick={() => handleGeocodeByCep(selectedClientModal)}
                                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase tracking-wider transition-all active:scale-95 text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm shadow-purple-900/20"
                                        title="Forçar localização utilizando estritamente o CEP municipal"
                                    >
                                        <Compass size={14} />
                                        Geocodificar por CEP
                                    </button>
                                )}

                                <button
                                    onClick={() => handleGeocodeIndividual(selectedClientModal)}
                                    className={`${UI_BUTTON_PRIMARY} text-xs py-2 px-4 flex items-center gap-1.5`}
                                    title="Reprocessar busca completa do endereço"
                                >
                                    <RefreshCw size={13} />
                                    Reprocessar Completo
                                </button>
                                <button
                                    onClick={() => setSelectedClientModal(null)}
                                    className={`${UI_BUTTON_SECONDARY} text-xs py-2 px-4`}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
