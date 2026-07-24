







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
    getSystemConfig: (): Promise<SystemConfig> => apiRequest('/system/config'),
    updateSystemConfig: (config: SystemConfig): Promise<void> => apiRequest('/system/config', 'PUT', config),
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
    saveRotaPrevista: (payload: any): Promise<void> => apiRequest('/roteiro/historico', 'POST', payload),
    getRotaPrevistaHistory: (): Promise<RotaPrevistaSaved[]> => apiRequest('/roteiro/historico'),
    getRotaPrevistaDetails: (id: number): Promise<RotaPrevistaItem[]> => apiRequest(`/roteiro/historico/${id}`),
    deleteRotaPrevista: (id: number, reason: string): Promise<void> => apiRequest(`/roteiro/historico/${id}`, 'DELETE', { reason }),
    updateRotaPrevistaDiario: (id: number, km: number, reason: string): Promise<void> => apiRequest(`/roteiro/diario/${id}`, 'PUT', { km, reason }),

    // Gestão de Cálculos Fechados
    getCalculoHistory: (): Promise<CalculoSaved[]> => apiRequest('/calculo/historico'),
    getCalculoDetails: (id: number): Promise<CalculoItem[]> => apiRequest(`/calculo/historico/${id}`),
    updateCalculoDiario: (id: number, km: number, reason: string): Promise<void> => apiRequest(`/calculo/diario/${id}`, 'PUT', { km, reason }),

    moveColaboradoresToGroup: (ids: number[], group: string): Promise<void> => apiRequest('/colaboradores/move', 'POST', { ids, group }),
    bulkUpdateColaboradores: (ids: number[], field: string, value: any, reason: string): Promise<void> => apiRequest('/colaboradores/bulk-update', 'POST', { ids, field, value, reason }),
    corrigirAusenciasHistorico: (ids: number[]): Promise<void> => apiRequest('/relatorios/fix-conflicts', 'POST', { ids }),
    getSugestoesVinculo: (ids: number[]): Promise<any[]> => apiRequest('/colaboradores/smart-suggestions', 'POST', { ids }),
    batchUpdateColaboradoresAddress: (items: any[], reason: string): Promise<void> => apiRequest('/colaboradores/batch-address', 'POST', { items, reason }),
    geocodeAddress: (address: string): Promise<{lat: number, lon: number}> => apiRequest('/system/geocode', 'POST', { address }),
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
        
        // URL Base (Conforme solicitado, mantendo a lógica local do servidor OSRM)
        const SERVER_IP = "10.10.10.10";
        const coords = points.map(p => {
            const lat = p.Lat || p.LatitudeBase || p.latitude;
            const lon = p.Long || p.LongitudeBase || p.longitude;
            return `${lon},${lat}`;
        }).join(';');
        
        const firstPoint = points[0];
        const firstLat = firstPoint.Lat || firstPoint.LatitudeBase || firstPoint.latitude;
        const firstLon = firstPoint.Long || firstPoint.LongitudeBase || firstPoint.longitude;
        
        const url = `http://${SERVER_IP}:5000/route/v1/driving/${coords}${isRoundTrip ? ';' + firstLon + ',' + firstLat : ''}?overview=full&geometries=geojson`;

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
        await new Promise(r => setTimeout(r, 800));
        return mockApiData.getMockVisitasPrevistas();
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
    saveRotaPrevista: async () => {},
    getRotaPrevistaHistory: async () => [],
    getRotaPrevistaDetails: async () => [],
    deleteRotaPrevista: async () => {},
    updateRotaPrevistaDiario: async () => {},
    getCalculoHistory: async () => [],
    getCalculoDetails: async () => [],
    updateCalculoDiario: async () => {},
    moveColaboradoresToGroup: async () => {},
    bulkUpdateColaboradores: async () => {},
    corrigirAusenciasHistorico: async () => {},
    getSugestoesVinculo: async () => [],
    batchUpdateColaboradoresAddress: async () => {},
    geocodeAddress: async (address: string) => {
        await new Promise(r => setTimeout(r, 800));
        // Simulação de retorno baseado no endereço
        if (address.toLowerCase().includes('paulista')) return { lat: -23.5614, lon: -46.6559 };
        return { lat: -23.5505, lon: -46.6333 };
    },
    calcDistance: (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lon2 - lon1, 2)) * 111; // Simplificado para mock
    },
    getOSRMData: async (points: any[], isRoundTrip: boolean) => {
        await new Promise(r => setTimeout(r, 500));
        return { distance: 10.5, geometry: [] };
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
    saveRotaPrevista, getRotaPrevistaHistory, getRotaPrevistaDetails,
    deleteRotaPrevista, updateRotaPrevistaDiario, getCalculoHistory, getCalculoDetails, updateCalculoDiario,
    moveColaboradoresToGroup, bulkUpdateColaboradores, corrigirAusenciasHistorico, getSugestoesVinculo, batchUpdateColaboradoresAddress,
    geocodeAddress, getOSRMData, calcDistance
} = Service;