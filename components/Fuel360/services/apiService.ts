







import {
    Colaborador,
    ConfigReembolso,
    SystemConfig,
    Ausencia,
    Usuario,
    AuthResponse,
    LogSistema,
    ItemRelatorio,
    ItemRelatorioAnalitico,
    DiffItem,
    SyncResponse,
    SalvarCalculoPayload,
    VisitaPrevista,
    LicenseStatus,
    IntegrationConfig,
    ImportPreviewResult,
    DbConnectionConfig,
    Grupo,
    RotaPrevistaSaved,
    RotaPrevistaItem,
    CalculoSaved,
    CalculoItem
} from '../types';
import * as mockApiData from '../api/mockData';

const getBaseUrl = () => {
    return '/api/fuel360';
};

const API_BASE_URL = getBaseUrl();
const MODE_KEY = 'FUEL360_API_MODE';

export const getCurrentMode = (): 'MOCK' | 'API' => {
    // Prioridade total para o modo MOCK se definido explicitamente ou for a primeira vez local
    if ((window as any).__FUEL360_MODO_MOCK__ === true) return 'MOCK';
    return (localStorage.getItem(MODE_KEY) as 'MOCK' | 'API') || 'API';
};

export const toggleMode = (mode: 'MOCK' | 'API') => {
    localStorage.setItem(MODE_KEY, mode);
    (window as any).__FUEL360_MODO_MOCK__ = undefined;
    window.location.reload();
};

const USE_MOCK = getCurrentMode() === 'MOCK';

async function apiRequest<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
    const token = localStorage.getItem('AUTH_TOKEN');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config: RequestInit = { method, headers, body: body ? JSON.stringify(body) : undefined };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        // Em produção, 401 sempre significa sessão expirada/inválida
        if (response.status === 401 && endpoint !== '/login') {
            window.dispatchEvent(new Event('FUEL360_UNAUTHORIZED'));
            throw new Error('Sessão expirada');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Erro API: ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

const RealService = {
    login: (usuario: string, senha: string): Promise<AuthResponse> => apiRequest('/login', 'POST', { usuario, senha }),
    getSystemStatus: (): Promise<LicenseStatus> => apiRequest('/system/status'),
    updateLicense: (key: string): Promise<{message: string}> => apiRequest('/system/license', 'POST', { key }),
    getSystemConfig: async (): Promise<SystemConfig> => {
        try {
            const res = await fetch('/api/bootstrap');
            if (res.ok) {
                const data = await res.json();
                if (data.settings) {
                    return {
                        companyName: data.settings.appName || 'Empresa',
                        logoUrl: data.settings.logoUrl || '',
                        headquartersAddress: data.settings.headquartersAddress || '',
                        headquartersLat: data.settings.headquartersLat,
                        headquartersLong: data.settings.headquartersLong,
                        cnpj: data.settings.cnpj,
                        razaoSocial: data.settings.appName
                    };
                }
            }
        } catch (e) {}
        return apiRequest('/system/config');
    },
    updateSystemConfig: async (config: SystemConfig): Promise<void> => {
        try {
            await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appName: config.companyName,
                    logoUrl: config.logoUrl,
                    cnpj: config.cnpj,
                    headquartersAddress: config.headquartersAddress,
                    headquartersLat: config.headquartersLat,
                    headquartersLong: config.headquartersLong
                })
            });
        } catch (e) {}
        return apiRequest('/system/config', 'PUT', config);
    },
    getIntegrationConfig: (): Promise<IntegrationConfig> => apiRequest('/system/integration'),
    updateIntegrationConfig: (config: IntegrationConfig): Promise<void> => apiRequest('/system/integration', 'PUT', config),
    testDbConnection: (config: DbConnectionConfig): Promise<{success: boolean, message: string}> => apiRequest('/system/test-connection', 'POST', { config }),
    getUsuarios: (): Promise<Usuario[]> => apiRequest('/usuarios'),
    createUsuario: (usuario: Usuario): Promise<void> => apiRequest('/usuarios', 'POST', usuario),
    updateUsuario: (id: number, usuario: Usuario): Promise<void> => apiRequest(`/usuarios/${id}`, 'PUT', usuario),
    getGrupos: (): Promise<Grupo[]> => apiRequest('/grupos'),
    createGrupo: (nome: string): Promise<Grupo> => apiRequest('/grupos', 'POST', { nome }),
    deleteGrupo: (id: number): Promise<void> => apiRequest(`/grupos/${id}`, 'DELETE'),
    getColaboradores: (): Promise<Colaborador[]> => apiRequest('/colaboradores'),
    createColaborador: (colaborador: Colaborador): Promise<Colaborador> => apiRequest('/colaboradores', 'POST', colaborador),
    updateColaborador: (id: number, colaborador: Colaborador): Promise<Colaborador> => apiRequest(`/colaboradores/${id}`, 'PUT', colaborador),
    deleteColaborador: (id: number): Promise<void> => apiRequest(`/colaboradores/${id}`, 'DELETE'),
    getImportPreview: (): Promise<ImportPreviewResult> => apiRequest('/colaboradores/import-preview'),
    syncColaboradores: (items: DiffItem[]): Promise<SyncResponse> => apiRequest('/colaboradores/sync', 'POST', { items }),
    getFuelConfig: (): Promise<ConfigReembolso> => apiRequest('/config/fuel'),
    updateFuelConfig: (config: ConfigReembolso): Promise<void> => apiRequest('/config/fuel', 'PUT', config),
    getFuelConfigHistory: (): Promise<LogSistema[]> => apiRequest('/config/fuel/history'),
    getAusencias: (): Promise<Ausencia[]> => apiRequest('/ausencias'),
    createAusencia: (ausencia: any): Promise<Ausencia> => apiRequest('/ausencias', 'POST', ausencia),
    deleteAusencia: (id: number, reason: string): Promise<void> => apiRequest(`/ausencias/${id}`, 'DELETE', { reason }),
    saveCalculo: (payload: SalvarCalculoPayload): Promise<void> => apiRequest('/calculo', 'POST', payload),
    checkCalculoExists: (periodo: string): Promise<boolean> => apiRequest(`/calculo/exists?periodo=${encodeURIComponent(periodo)}`),
    getRelatorioReembolso: (startDate: string, endDate: string, colab?: string, group?: string): Promise<ItemRelatorio[]> => {
        const q = new URLSearchParams({ startDate, endDate });
        if(colab) q.append('colab', colab);
        if(group) q.append('group', group);
        return apiRequest(`/relatorios/reembolso?${q.toString()}`);
    },
    getRelatorioAnalitico: (startDate: string, endDate: string, colab?: string, group?: string): Promise<ItemRelatorioAnalitico[]> => {
        const q = new URLSearchParams({ startDate, endDate });
        if(colab) q.append('colab', colab);
        if(group) q.append('group', group);
        return apiRequest(`/relatorios/analitico?${q.toString()}`);
    },
    logAction: (acao: string, detalhes: string): Promise<void> => apiRequest('/logs', 'POST', { acao, detalhes }),
    // NEW: Get System Logs
    getSystemLogs: (filters: { startDate?: string, endDate?: string, user?: string, search?: string }): Promise<LogSistema[]> => {
        const q = new URLSearchParams();
        if(filters.startDate) q.append('startDate', filters.startDate);
        if(filters.endDate) q.append('endDate', filters.endDate);
        if(filters.user) q.append('user', filters.user);
        if(filters.search) q.append('search', filters.search);
        return apiRequest(`/system/logs?${q.toString()}`);
    },
    getVisitasPrevistas: (startDate?: string, endDate?: string): Promise<VisitaPrevista[]> => {
        let query = '/roteiro/previsao';
        if (startDate && endDate) query += `?startDate=${startDate}&endDate=${endDate}`;
        return apiRequest(query);
    },
    getPromoterClients: (): Promise<any[]> => apiRequest('/roteiro/promotores/clientes'),
    // Rota Prevista (Simulações)
    checkRotaPrevistaExists: (periodo: string, totalKm: number): Promise<{ exists: boolean; id?: number; periodo?: string; totalKm?: number; descricao?: string }> => 
        apiRequest(`/roteiro/exists?periodo=${encodeURIComponent(periodo)}&totalKm=${totalKm}`),
    saveRotaPrevista: (payload: any): Promise<{ success: boolean; id?: number }> => apiRequest('/roteiro/historico', 'POST', payload),
    getRotaPrevistaHistory: (): Promise<RotaPrevistaSaved[]> => apiRequest('/roteiro/historico'),
    getRotaPrevistaDetails: (id: number): Promise<RotaPrevistaItem[]> => apiRequest(`/roteiro/historico/${id}`),
    deleteRotaPrevista: (id: number, reason: string): Promise<void> => apiRequest(`/roteiro/historico/${id}`, 'DELETE', { reason }),
    updateRotaPrevistaDiario: (id: number, km: number, reason: string): Promise<void> => apiRequest(`/roteiro/diario/${id}`, 'PUT', { km, reason }),
    getSimulacaoPublica: (id: number): Promise<any> => apiRequest(`/roteiro/simulacao/${id}/public`),
    getSimulacaoSugestoes: (id: number): Promise<any[]> => apiRequest(`/roteiro/simulacao/${id}/sugestoes`),
    saveSimulacaoSugestao: (id: number, payload: any): Promise<{ success: boolean; id: number }> => apiRequest(`/roteiro/simulacao/${id}/sugestoes`, 'POST', payload),
    updateSugestaoStatus: (id: number, status: string): Promise<{ success: boolean }> => apiRequest(`/roteiro/sugestoes/${id}/status`, 'PUT', { status }),

    // Gestão de Cálculos Fechados
    getCalculoHistory: (): Promise<CalculoSaved[]> => apiRequest('/calculo/historico'),
    getCalculoDetails: (id: number): Promise<CalculoItem[]> => apiRequest(`/calculo/historico/${id}`),
    updateCalculoDiario: (id: number, km: number, reason: string): Promise<void> => apiRequest(`/calculo/diario/${id}`, 'PUT', { km, reason }),

    moveColaboradoresToGroup: (ids: number[], group: string): Promise<void> => apiRequest('/colaboradores/move', 'POST', { ids, group }),
    bulkUpdateColaboradores: (ids: number[], field: string, value: any, reason: string): Promise<void> => apiRequest('/colaboradores/bulk-update', 'POST', { ids, field, value, reason }),
    corrigirAusenciasHistorico: (ids: number[]): Promise<void> => apiRequest('/relatorios/fix-conflicts', 'POST', { ids }),
    getSugestoesVinculo: (ids: number[]): Promise<any[]> => apiRequest('/colaboradores/smart-suggestions', 'POST', { ids }),
    batchUpdateColaboradoresAddress: (items: any[], reason: string): Promise<void> => apiRequest('/colaboradores/batch-address', 'POST', { items, reason }),
    geocodeAddress: async (input: string | { address?: string; street?: string; number?: string; neighborhood?: string; city?: string; state?: string; cep?: string; forceCepOnly?: boolean }): Promise<{lat: number, lon: number}> => {
        let street = '';
        let num = '';
        let neighborhood = '';
        let city = '';
        let state = '';
        let zip = '';
        let overrideAddress = '';
        let rawStr = '';
        let forceCep = false;

        if (typeof input === 'string') {
            rawStr = (input || '').trim();
            overrideAddress = rawStr;
        } else if (input && typeof input === 'object') {
            street = (input.street || '').trim();
            num = (input.number || '').trim();
            neighborhood = (input.neighborhood || '').trim();
            city = (input.city || '').trim();
            state = (input.state || '').trim();
            zip = (input.cep || '').replace(/\D/g, '');
            overrideAddress = (input.address || '').trim();
            forceCep = Boolean(input.forceCepOnly);
            rawStr = overrideAddress || (street && city ? `${street}${num ? `, ${num}` : ''}${neighborhood ? ` - ${neighborhood}` : ''}, ${city}${state ? ` - ${state}` : ''}` : '');
        }

        // Extração auxiliar de número predial caso não tenha vindo em campo específico
        if (!num && rawStr) {
            const numMatch = rawStr.match(/(?:,|\b)\s*(?:nº|n°|num|número)?\s*(\d{1,6})\s*(?:,|\b|$)/i);
            if (numMatch) {
                num = numMatch[1];
            }
        }

        // Extração auxiliar de CEP caso não tenha vindo em campo específico
        if (!zip && rawStr) {
            const cepMatch = rawStr.match(/(?:CEP\s*[:\-]?\s*|\b)(\d{5})[\s\-]?(\d{3})\b/i);
            if (cepMatch) {
                zip = `${cepMatch[1]}${cepMatch[2]}`;
            }
        }

        const cleanZip = zip.replace(/\D/g, '');

        // Função interna para resolver coordenadas pelo CEP (AwesomeAPI -> Google Maps CEP -> Nominatim)
        const resolveCoordsByCep = async (targetCep: string): Promise<{ lat: number; lon: number } | null> => {
            if (!targetCep || targetCep.length !== 8) return null;

            // 1. AwesomeAPI
            try {
                const resCep = await fetch(`https://cep.awesomeapi.com.br/json/${targetCep}`);
                if (resCep.ok) {
                    const cData = await resCep.json();
                    if (cData && cData.lat && cData.lng) {
                        const lat = parseFloat(cData.lat);
                        const lon = parseFloat(cData.lng);
                        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
                    }
                }
            } catch (eCep) {
                console.warn('[Fuel360] Fallback AwesomeAPI falhou:', eCep);
            }

            // 2. Google Maps com o CEP formatado
            try {
                const formattedCep = `${targetCep.substring(0, 5)}-${targetCep.substring(5)}`;
                const gCepRes = await fetch('/api/geocode', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address: `${formattedCep}, Brasil` })
                });
                if (gCepRes.ok) {
                    const gData = await gCepRes.json();
                    if (gData && gData.success && gData.lat && gData.lon) {
                        const lat = Number(gData.lat);
                        const lon = Number(gData.lon);
                        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
                    }
                }
            } catch (eGCep) {
                console.warn('[Fuel360] Fallback Google Maps CEP falhou:', eGCep);
            }

            // 3. Nominatim por Postalcode
            try {
                const urlZipNom = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${targetCep}&country=Brazil&limit=1`;
                const resNomZip = await fetch(urlZipNom, { headers: { 'User-Agent': 'ITAsset360App/1.0' } });
                if (resNomZip.ok) {
                    const nomZipData = await resNomZip.json();
                    if (nomZipData && nomZipData.length > 0) {
                        const lat = parseFloat(nomZipData[0].lat);
                        const lon = parseFloat(nomZipData[0].lon);
                        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
                    }
                }
            } catch (eNomZip) {
                console.warn('[Fuel360] Fallback Nominatim CEP falhou:', eNomZip);
            }

            return null;
        };

        // Se o usuário solicitou especificamente a geocodificação por CEP
        if (forceCep && cleanZip.length === 8) {
            const cepResult = await resolveCoordsByCep(cleanZip);
            if (cepResult) return cepResult;
        }

        // Montagem da query completa de alta precisão (Logradouro, Número, Bairro, Cidade, CEP)
        let fullQuery = overrideAddress?.trim() || (street && city ? `${street}${num ? `, ${num}` : ''}${neighborhood ? ` - ${neighborhood}` : ''}, ${city}${state ? ` - ${state}` : ''}` : '');
        if (!fullQuery) fullQuery = rawStr;

        // Se o número existir e ainda não estiver na query, incorpora para precisão máxima
        if (num && !fullQuery.match(new RegExp(`(?:^|\\D)${num}(?:$|\\D)`))) {
            fullQuery = `${fullQuery}, ${num}`;
        }

        // 1ª Prioridade Absoluta: Google Maps Engine via Backend Proxy (/api/fuel360/geocode ou /api/geocode)
        if (fullQuery) {
            try {
                let gRes: { success: boolean; lat: number; lon: number } | null = null;
                try {
                    gRes = await apiRequest<{ success: boolean; lat: number; lon: number }>('/geocode', 'POST', { address: fullQuery });
                } catch (eRel) {
                    // Fallback para rota direta no proxy caso o endpoint com prefixo não responda
                    const fallbackRes = await fetch('/api/geocode', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: fullQuery })
                    });
                    if (fallbackRes.ok) {
                        gRes = await fallbackRes.json();
                    }
                }

                if (gRes && gRes.success && gRes.lat && gRes.lon) {
                    const lat = Number(gRes.lat);
                    const lon = Number(gRes.lon);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        // Guarda de consistência geográfica para rodovias interestaduais/estaduais
                        const isHighway = /rodovia|rod\.|sp\s*-?\s*\d+|br\s*-?\s*\d+|km\s*\d+/i.test(fullQuery);
                        if (isHighway && cleanZip.length === 8 && city) {
                            const cepPoint = await resolveCoordsByCep(cleanZip);
                            if (cepPoint) {
                                const distFromCep = RealService.calcDistance(lat, lon, cepPoint.lat, cepPoint.lon);
                                // Se a busca genérica por rodovia colocou o pino em outro município (> 10 km do CEP oficial da rodovia)
                                if (distFromCep > 10) {
                                    console.warn(`[Fuel360] Ponto do Google Maps divergiu ${distFromCep.toFixed(1)}km do CEP setorial de ${city} (típico em rodovias interestaduais). Adotando coordenada de alta precisão do CEP do município.`);
                                    return cepPoint;
                                }
                            }
                        }

                        return { lat, lon };
                    }
                }
            } catch (eGoogle) {
                console.warn('[Fuel360] Geocodificação Google Maps falhou, iniciando contingência por camadas:', eGoogle);
            }
        }

        // 2ª Prioridade (Contingência Inteligente): OpenStreetMap/Nominatim em tentativas hierárquicas (Padrão UserManager)
        const attempts: Array<{ label: string; query: string }> = [];

        if (street && city) {
            const addrNum = num ? `${street}, ${num}` : street;
            if (neighborhood) {
                attempts.push({ label: 'Logradouro, Número e Bairro', query: `${addrNum}, ${neighborhood}, ${city}${state ? ` - ${state}` : ''}, Brasil` });
            }
            attempts.push({ label: 'Logradouro e Número', query: `${addrNum}, ${city}${state ? ` - ${state}` : ''}, Brasil` });
            attempts.push({ label: 'Logradouro', query: `${street}, ${city}${state ? ` - ${state}` : ''}, Brasil` });
        }

        if (fullQuery && !attempts.some(a => a.query === fullQuery)) {
            attempts.unshift({ label: 'Endereço Completo', query: fullQuery });
        }

        const numVal = parseInt(num, 10);
        const zipPrefix = cleanZip.length >= 5 ? cleanZip.substring(0, 5) : '';

        for (const attempt of attempts) {
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(attempt.query)}&limit=10&addressdetails=1`;
                const res = await fetch(url, { headers: { 'User-Agent': 'ITAsset360App/1.0' } });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        // Filtra por cidade para evitar divergências com municípios homônimos
                        let filtered = data;
                        if (city) {
                            const targetCity = city.toLowerCase();
                            const cityMatches = data.filter((d: any) => {
                                const displayName = (d.display_name || '').toLowerCase();
                                return displayName.includes(targetCity);
                            });
                            if (cityMatches.length > 0) filtered = cityMatches;
                        }

                        // Seleção inteligente do segmento de logradouro mais preciso baseado no CEP
                        let bestMatch = filtered[0];
                        if (zipPrefix.length === 5) {
                            const zipMatch = filtered.find((d: any) => {
                                const pc = (d.address && d.address.postcode ? d.address.postcode : '').replace(/\D/g, '');
                                return pc.startsWith(zipPrefix);
                            });
                            if (zipMatch) bestMatch = zipMatch;
                        }

                        let lat = parseFloat(bestMatch.lat);
                        let lon = parseFloat(bestMatch.lon);

                        // Interpolação predial métrica por BoundingBox se houver numeração da fachada
                        if (!isNaN(numVal) && numVal > 0 && bestMatch.boundingbox && bestMatch.boundingbox.length === 4) {
                            const bMinLat = parseFloat(bestMatch.boundingbox[0]);
                            const bMaxLat = parseFloat(bestMatch.boundingbox[1]);
                            const bMinLon = parseFloat(bestMatch.boundingbox[2]);
                            const bMaxLon = parseFloat(bestMatch.boundingbox[3]);

                            if (!isNaN(bMinLat) && !isNaN(bMaxLat) && !isNaN(bMinLon) && !isNaN(bMaxLon)) {
                                const latSpanMeters = Math.abs(bMaxLat - bMinLat) * 111000;
                                const lonSpanMeters = Math.abs(bMaxLon - bMinLon) * 111000;
                                const totalSpanMeters = Math.sqrt(latSpanMeters * latSpanMeters + lonSpanMeters * lonSpanMeters);

                                if (totalSpanMeters > 50 && totalSpanMeters < 5000) {
                                    const estimatedMaxNum = Math.max(Math.round(totalSpanMeters * 0.85), 100);
                                    const fraction = Math.min(numVal / estimatedMaxNum, 1.0);
                                    lat = parseFloat((bMaxLat - (fraction * (bMaxLat - bMinLat))).toFixed(6));
                                    lon = parseFloat((bMaxLon - (fraction * (bMaxLon - bMinLon))).toFixed(6));
                                }
                            }
                        }

                        if (!isNaN(lat) && !isNaN(lon)) {
                            return { lat, lon };
                        }
                    }
                }
            } catch (eNom) {
                console.warn(`[Fuel360] Tentativa de geocodificação Nominatim (${attempt.label}) falhou:`, eNom);
            }
        }

        // 3ª Prioridade (Fallback de Último Recurso): CEP (Apenas se logradouro e número falharem)
        if (cleanZip.length === 8) {
            const cepFallback = await resolveCoordsByCep(cleanZip);
            if (cepFallback) return cepFallback;
        }

        throw new Error('Endereço ou CEP não localizado no mapa. Verifique se o logradouro, número e cidade estão corretos.');
    },
    calcDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },
    getOSRMData: async (points: any[], isRoundTrip: boolean, attempt = 1): Promise<any> => {
        if (points.length < 2) return null;
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        const coordsStr = points.map(p => {
            const lat = p.Lat || p.LatitudeBase || p.latitude;
            const lon = p.Long || p.LongitudeBase || p.longitude;
            return `${lon},${lat}`;
        }).join(';');
        
        const firstPoint = points[0];
        const firstLat = firstPoint.Lat || firstPoint.LatitudeBase || firstPoint.latitude;
        const firstLon = firstPoint.Long || firstPoint.LongitudeBase || firstPoint.longitude;
        const finalCoordsStr = coordsStr + (isRoundTrip ? ';' + firstLon + ',' + firstLat : '');

        // Utiliza o proxy HTTPS seguro em /api/fuel360/osrm para evitar Mixed Content (HTTP x HTTPS)
        const url = `${API_BASE_URL}/osrm?coords=${encodeURIComponent(finalCoordsStr)}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.status === 429) {
                if (attempt <= 3) {
                    const waitTime = attempt * 2000;
                    await sleep(waitTime);
                    return RealService.getOSRMData(points, isRoundTrip, attempt + 1);
                }
                return null;
            }

            if (!resp.ok) return null;

            const data = await resp.json();
            if (data.code === 'Ok' && data.routes?.[0]) {
                return {
                    distance: data.routes[0].distance / 1000,
                    geometry: data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]])
                };
            }
            return null;
        } catch (e) {
            if (attempt <= 2) {
                await sleep(1000);
                return RealService.getOSRMData(points, isRoundTrip, attempt + 1);
            }
            return null; 
        }
    },
    getOSRMTable: async (points: { lat: number; lng: number }[]): Promise<{ distances: number[][]; durations: number[][] } | null> => {
        if (points.length < 2) return null;
        const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `${API_BASE_URL}/osrm-table?coords=${encodeURIComponent(coordsStr)}`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!resp.ok) return null;
            const data = await resp.json();
            if (data.code === 'Ok' && data.distances) {
                const kmDistances = data.distances.map((row: number[]) => 
                    row.map((d: number) => (d !== null && d !== undefined) ? d / 1000 : 0)
                );
                return {
                    distances: kmDistances,
                    durations: data.durations || []
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    }
};

let mockFuelConfig: ConfigReembolso = { PrecoCombustivel: 5.89, KmL_Carro: 10, KmL_Moto: 35 };
let mockFuelHistory: LogSistema[] = [];

const MockService = {
    login: async (usuario: string, senha: string): Promise<AuthResponse> => {
        await new Promise(r => setTimeout(r, 600));
        if (usuario.toLowerCase() === 'admin' && senha.toLowerCase() === 'admin') {
            return { token: 'mock-token', user: { ID_Usuario: 1, Nome: 'Administrador (MOCK)', Usuario: 'admin', Perfil: 'Admin', Ativo: true } };
        }
        throw new Error('Usuário ou senha inválidos no modo simulado.');
    },
    getSystemStatus: async (): Promise<LicenseStatus> => ({ status: 'ACTIVE', client: 'Fuel360 Demo', expiresAt: '2099-12-31' }),
    updateLicense: async () => ({ message: 'Licença simulada atualizada.' }),
    getSystemConfig: async (): Promise<SystemConfig> => ({ companyName: 'Fuel360', logoUrl: '' }),
    updateSystemConfig: async () => {},
    getIntegrationConfig: async (): Promise<IntegrationConfig> => ({ 
        colab: { host: '127.0.0.1', port: 3306, user: 'root', pass: '', database: 'pulsus', query: '', type: 'MARIADB' },
        route: { host: '127.0.0.1', port: 1433, user: 'sa', pass: '', database: 'flexx', query: '', type: 'MSSQL' },
        promoter: { host: '127.0.0.1', port: 1433, user: 'sa', pass: '', database: 'flexx', query: '', type: 'MSSQL' }
    }),
    updateIntegrationConfig: async () => {},
    testDbConnection: async () => ({ success: true, message: 'Simulação de conexão OK!' }),
    getUsuarios: async (): Promise<Usuario[]> => ([{ ID_Usuario: 1, Nome: 'Administrador (MOCK)', Usuario: 'admin', Perfil: 'Admin', Ativo: true }]),
    createUsuario: async () => {},
    updateUsuario: async () => {},
    getGrupos: async (): Promise<Grupo[]> => ([{ ID_Grupo: 1, Nome: 'Vendedor' }, { ID_Grupo: 2, Nome: 'Promotor' }, { ID_Grupo: 3, Nome: 'Supervisor' }]),
    createGrupo: async (nome: string) => ({ ID_Grupo: Math.random(), Nome: nome }),
    deleteGrupo: async () => {},
    getColaboradores: async (): Promise<Colaborador[]> => ([
        { ID_Colaborador: 1, ID_Pulsus: 100, CodigoSetor: 101, Nome: 'ALEXANDRE SILVA', Grupo: 'Vendedor', TipoVeiculo: 'Carro', Ativo: true, LatitudeBase: -23.55052, LongitudeBase: -46.633308, EnderecoBase: 'Av Paulista' },
        { ID_Colaborador: 2, ID_Pulsus: 101, CodigoSetor: 102, Nome: 'MARCOS OLIVEIRA', Grupo: 'Vendedor', TipoVeiculo: 'Moto', Ativo: true },
        { ID_Colaborador: 3, ID_Pulsus: 102, CodigoSetor: 103, Nome: 'BEATRIZ SANTOS', Grupo: 'Vendedor', TipoVeiculo: 'Carro', Ativo: true }
    ]),
    createColaborador: async (c: Colaborador) => ({ ...c, ID_Colaborador: Math.random() }),
    updateColaborador: async (id: number, c: Colaborador) => c,
    deleteColaborador: async () => {},
    getImportPreview: async (): Promise<ImportPreviewResult> => ({ novos: [], alterados: [], conflitos: [], invalidos: [], iguais: [], iguaisCount: 0, totalExternal: 0, inativar: [] }),
    syncColaboradores: async (): Promise<SyncResponse> => ({ success: true, count: 0, errors: [] }),
    getFuelConfig: async (): Promise<ConfigReembolso> => mockFuelConfig,
    updateFuelConfig: async (config: ConfigReembolso) => {
        mockFuelConfig = { ...mockFuelConfig, ...config };
        const detalhes = `Ajuste Parâmetros: Preço R$ ${config.PrecoCombustivel}, Carro ${config.KmL_Carro} KM/L, Moto ${config.KmL_Moto} KM/L.${config.MotivoAlteracao ? ' Motivo: ' + config.MotivoAlteracao : ''}`;
        mockFuelHistory.unshift({
            ID_Log: Math.floor(Math.random() * 100000),
            DataHora: new Date().toISOString(),
            Usuario: 'Administrador (MOCK)',
            Acao: 'ALTERAR_CONFIG_COMBUSTIVEL',
            Detalhes: detalhes
        });
    },
    getFuelConfigHistory: async () => mockFuelHistory,
    getAusencias: async (): Promise<Ausencia[]> => [],
    createAusencia: async (a: any) => ({ ...a, ID_Ausencia: Math.random(), NomeColaborador: 'Mocked', ID_Pulsus: 123, DataInicio: a.DataInicio || '', DataFim: a.DataFim || '', Motivo: a.Motivo || '' }),
    deleteAusencia: async () => {},
    saveCalculo: async () => {},
    checkCalculoExists: async () => false,
    getRelatorioReembolso: async () => [],
    getRelatorioAnalitico: async () => [],
    logAction: async () => {},
    getSystemLogs: async () => [
        { ID_Log: 1, DataHora: new Date().toISOString(), Usuario: 'Administrador (MOCK)', Acao: 'LOGIN', Detalhes: 'Acesso ao sistema' },
        { ID_Log: 2, DataHora: new Date(Date.now() - 3600000).toISOString(), Usuario: 'Administrador (MOCK)', Acao: 'IMPORTACAO_CSV', Detalhes: 'Upload: dados_vendas.csv. Linhas: 150' },
        { ID_Log: 3, DataHora: new Date(Date.now() - 86400000).toISOString(), Usuario: 'Administrador (MOCK)', Acao: 'EDIT_COLAB', Detalhes: 'Editou colaborador ID 100 (Alexandre). Motivo: Mudança de endereço' },
    ],
    getVisitasPrevistas: async (startDate?: string, endDate?: string): Promise<VisitaPrevista[]> => {
        return RealService.getVisitasPrevistas(startDate, endDate);
    },
    getPromoterClients: async (): Promise<any[]> => {
        await new Promise(r => setTimeout(r, 800));
        return [
            { Cod_Cliente: 2790697, Razao_Social: 'Supermercado Rossi New Ltda', Lat: -23.55052, Long: -46.633308 },
            { Cod_Cliente: 3387217, Razao_Social: 'Supermercado Rossi New Ltda', Lat: -23.55152, Long: -46.634308 },
            { Cod_Cliente: 1658167, Razao_Social: 'J G G Supermercados Ltda', Lat: -23.55252, Long: -46.635308 },
            { Cod_Cliente: 5883176, Razao_Social: 'Comercial Villa Simpatia Ltda', Lat: -23.55352, Long: -46.636308 },
            { Cod_Cliente: 6933603, Razao_Social: 'Supermercado Rossi New Ltda', Lat: -23.55452, Long: -46.637308 },
        ];
    },
    checkRotaPrevistaExists: async (): Promise<{ exists: boolean; id?: number; periodo?: string; totalKm?: number; descricao?: string }> => ({ exists: false }),
    saveRotaPrevista: async (): Promise<{ success: boolean; id?: number }> => ({ success: true, id: 1 }),
    getRotaPrevistaHistory: async () => [],
    getRotaPrevistaDetails: async () => [],
    deleteRotaPrevista: async () => {},
    updateRotaPrevistaDiario: async () => {},
    getSimulacaoPublica: async (id: number) => null,
    getSimulacaoSugestoes: async (id: number) => [],
    saveSimulacaoSugestao: async () => ({ success: true, id: 1 }),
    updateSugestaoStatus: async () => ({ success: true }),
    getCalculoHistory: async () => [],
    getCalculoDetails: async () => [],
    updateCalculoDiario: async () => {},
    moveColaboradoresToGroup: async () => {},
    bulkUpdateColaboradores: async () => {},
    corrigirAusenciasHistorico: async () => {},
    getSugestoesVinculo: async () => [],
    batchUpdateColaboradoresAddress: async () => {},
    geocodeAddress: async (address: string | any) => {
        await new Promise(r => setTimeout(r, 800));
        const addrStr = typeof address === 'string' ? address : (address?.address || address?.street || '');
        // Simulação de retorno baseado no endereço
        if (addrStr.toLowerCase().includes('paulista')) return { lat: -23.5614, lon: -46.6559 };
        return { lat: -23.5505, lon: -46.6333 };
    },
    calcDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)) * 111; // Simplificado para mock
    },
    getOSRMData: async (points: any[], isRoundTrip: boolean) => {
        await new Promise(r => setTimeout(r, 500));
        return { distance: 10.5, geometry: [] };
    },
    getOSRMTable: async (points: { lat: number; lng: number }[]) => {
        await new Promise(r => setTimeout(r, 200));
        return null;
    }
};

const Service = USE_MOCK ? MockService : RealService;

export const {
    login, getSystemStatus, updateLicense, getSystemConfig, updateSystemConfig,
    getIntegrationConfig, updateIntegrationConfig, testDbConnection,
    getUsuarios, createUsuario, updateUsuario, getGrupos, createGrupo, deleteGrupo,
    getColaboradores, createColaborador, updateColaborador, deleteColaborador, 
    getImportPreview, syncColaboradores, getFuelConfig, updateFuelConfig, getFuelConfigHistory,
    getAusencias, createAusencia, deleteAusencia, saveCalculo, checkCalculoExists,
    getRelatorioReembolso, getRelatorioAnalitico, logAction, getSystemLogs, getVisitasPrevistas, getPromoterClients,
    saveRotaPrevista, checkRotaPrevistaExists, getRotaPrevistaHistory, getRotaPrevistaDetails,
    deleteRotaPrevista, updateRotaPrevistaDiario, getCalculoHistory, getCalculoDetails, updateCalculoDiario,
    getSimulacaoPublica, getSimulacaoSugestoes, saveSimulacaoSugestao, updateSugestaoStatus,
    moveColaboradoresToGroup, bulkUpdateColaboradores, corrigirAusenciasHistorico, getSugestoesVinculo, batchUpdateColaboradoresAddress,
    geocodeAddress, getOSRMData, getOSRMTable, calcDistance
} = Service;