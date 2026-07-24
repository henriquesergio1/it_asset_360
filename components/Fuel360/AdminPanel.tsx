
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { DataContext } from './context/DataContext';
import { GestaoUsuarios } from './GestaoUsuarios';
import { CogIcon, UserGroupIcon, PhotographIcon, CheckCircleIcon, DocumentReportIcon, SpinnerIcon, ExclamationIcon, UploadIcon, UsersIcon, LocationMarkerIcon, ChartBarIcon, ClipboardListIcon, SearchIcon } from './icons';
import { getCurrentMode, toggleMode, getSystemStatus, updateLicense, getIntegrationConfig, updateIntegrationConfig, testDbConnection, getSystemLogs, geocodeAddress } from './services/apiService';
import { LicenseStatus, IntegrationConfig, DbConnectionConfig, LogSistema } from './types';
import L from 'leaflet';
// @ts-ignore
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Fix for Leaflet default icon issues
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const MapUpdater: React.FC<{ center: [number, number] }> = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 16);
    }, [center, map]);
    return null;
}

const LicenseControl: React.FC = () => {
    const [status, setStatus] = useState<LicenseStatus | null>(null);
    const [inputKey, setInputKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => { loadStatus(); }, []);
    const loadStatus = async () => { try { const s = await getSystemStatus(); setStatus(s); } catch (e) {} };

    const handleActivate = async () => {
        if (!inputKey.trim()) return;
        setLoading(true); setMessage(null);
        try { const res = await updateLicense(inputKey); setMessage({ type: 'success', text: res.message }); setInputKey(''); loadStatus(); }
        catch (err: any) { setMessage({ type: 'error', text: err.message || 'Erro ao ativar.' }); }
        finally { setLoading(false); }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><DocumentReportIcon className="w-6 h-6 mr-2 text-blue-600"/> Status da Licença</h3>
                    {!status ? <p className="text-slate-500">Carregando...</p> : (
                        <div className={`p-6 rounded-xl border ${status.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="mb-3"><span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Situação</span><p className={`font-bold text-xl ${status.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>{status.status === 'ACTIVE' ? 'ATIVA' : (status.status === 'EXPIRED' ? 'EXPIRADA' : 'INVÁLIDA')}</p></div>
                            {status.client && <div className="mb-3"><span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Cliente</span><p className="text-slate-800">{status.client}</p></div>}
                            {status.expiresAt && <div><span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Vencimento</span><p className="text-slate-800">{new Date(status.expiresAt).toLocaleDateString('pt-BR')}</p></div>}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-2">Ativar Licença</h4>
                    <textarea value={inputKey} onChange={(e) => setInputKey(e.target.value)} className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-4 text-xs font-mono h-32 focus:ring-2 focus:ring-blue-600 focus:border-transparent mb-4 shadow-sm" placeholder="Cole a chave aqui..." />
                    <button onClick={handleActivate} disabled={loading || !inputKey} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center transition shadow-md">{loading ? <SpinnerIcon className="w-5 h-5 mr-2"/> : 'Validar'}</button>
                    {message && <div className={`mt-4 p-3 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{message.text}</div>}
                </div>
            </div>
        </div>
    );
};

// Componente Genérico de Formulário de Banco
const DbForm: React.FC<{ 
    config: DbConnectionConfig; 
    onChange: (newConfig: DbConnectionConfig) => void;
    label: string;
    description: string;
    icon: React.ReactNode;
    queryPlaceholder?: string;
    allowTypeChange?: boolean;
}> = ({ config, onChange, label, description, icon, queryPlaceholder, allowTypeChange = false }) => {
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await testDbConnection(config);
            setTestResult(res);
        } catch (e: any) {
            setTestResult({ success: false, message: e.message });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div>
            <div className="flex items-center mb-4">
                <div className="p-2 bg-blue-50 rounded-lg mr-3 border border-blue-100">{icon}</div>
                <div>
                    <h4 className="font-bold text-slate-800">{label}</h4>
                    <p className="text-xs text-slate-500">{description}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                {allowTypeChange && (
                    <div className="col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Tecnologia do Banco</label>
                        <select 
                            value={config.type} 
                            onChange={e => onChange({...config, type: e.target.value})}
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="MARIADB">MariaDB / MySQL</option>
                            <option value="MSSQL">Microsoft SQL Server</option>
                        </select>
                    </div>
                )}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Host / IP</label>
                    <input type="text" value={config.host} onChange={e => onChange({...config, host: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="192.168.1.50"/>
                </div>
                <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">Porta</label>
                     <input type="number" value={config.port} onChange={e => onChange({...config, port: Number(e.target.value)})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder={config.type === 'MSSQL' ? '1433' : '3306'}/>
                </div>
                <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">Usuário</label>
                     <input type="text" value={config.user} onChange={e => onChange({...config, user: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition-colors"/>
                </div>
                <div className="space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
                     <input type="password" value={config.pass} onChange={e => onChange({...config, pass: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="********"/>
                </div>
                <div className="col-span-2 space-y-1">
                     <label className="text-xs font-bold text-slate-500 uppercase">Nome do Banco</label>
                     <input type="text" value={config.database} onChange={e => onChange({...config, database: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 transition-colors"/>
                </div>
            </div>

            <div className="space-y-1 mb-4">
                <label className="block text-xs font-bold text-slate-500 uppercase">Query de Seleção</label>
                <textarea 
                    value={config.query} 
                    onChange={e => onChange({...config, query: e.target.value})}
                    className="w-full h-32 bg-slate-800 text-green-400 border border-slate-700 rounded-lg p-3 font-mono text-xs outline-none focus:ring-1 focus:ring-green-500"
                    placeholder={queryPlaceholder || "SELECT ..."}
                />
            </div>

            <div className="flex items-center justify-between">
                 <button 
                    onClick={handleTest} 
                    disabled={testing}
                    className="text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                    {testing ? <SpinnerIcon className="w-4 h-4 mr-2"/> : null}
                    Testar Conexão
                </button>
                {testResult && (
                    <span className={`text-sm font-bold ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                        {testResult.success ? <CheckCircleIcon className="w-5 h-5 inline mr-1"/> : <ExclamationIcon className="w-5 h-5 inline mr-1"/>}
                        {testResult.message}
                    </span>
                )}
            </div>
        </div>
    );
};

const IntegrationSettings: React.FC = () => {
    const [config, setConfig] = useState<IntegrationConfig | null>(null);
    const [activeTab, setActiveTab] = useState<'colab' | 'route' | 'promoter'>('colab');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => { loadConfig(); }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const data = await getIntegrationConfig();
            if (!data.colab) data.colab = { host: '', port: 3306, user: '', pass: '', database: '', query: '', type: 'MARIADB' };
            if (!data.route) data.route = { host: '', port: 1433, user: '', pass: '', database: '', query: '', type: 'MSSQL' };
            if (!data.promoter) data.promoter = { host: '', port: 1433, user: '', pass: '', database: '', query: '', type: 'MSSQL' };
            setConfig(data);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        setMessage('');
        try {
            await updateIntegrationConfig(config);
            setMessage('Configuração salva com sucesso!');
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleColabChange = (newConf: DbConnectionConfig) => {
        if (config) setConfig({ ...config, colab: newConf });
    };

    const handleRouteChange = (newConf: DbConnectionConfig) => {
        if (config) setConfig({ ...config, route: newConf });
    };

    const handlePromoterChange = (newConf: DbConnectionConfig) => {
        if (config) setConfig({ ...config, promoter: newConf });
    };

    if (loading) return <div className="p-8 text-center text-slate-500"><SpinnerIcon className="w-8 h-8 mx-auto"/> Carregando...</div>;
    if (!config) return <div className="p-8 text-center text-red-500">Erro ao carregar configurações.</div>;

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center"><UploadIcon className="w-6 h-6 mr-2 text-blue-600"/> Integração de Dados</h3>
                <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('colab')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'colab' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Colaboradores (Externo)
                    </button>
                    <button 
                        onClick={() => setActiveTab('route')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'route' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Roteirizador (SQL Server)
                    </button>
                    <button 
                        onClick={() => setActiveTab('promoter')} 
                        className={`px-4 py-2 text-sm font-bold rounded-md transition ${activeTab === 'promoter' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Clientes Promotores (SQL Server)
                    </button>
                </div>
            </div>
            
            <div className="animate-fade-in">
                {activeTab === 'colab' && (
                    <DbForm 
                        config={config.colab} 
                        onChange={handleColabChange} 
                        label="Importação de Colaboradores"
                        description="Conexão com banco externo (MariaDB ou SQL Server) para sincronização de cadastro."
                        icon={<UsersIcon className="w-6 h-6 text-blue-500"/>}
                        allowTypeChange={true}
                        queryPlaceholder="SELECT PulsusId as id_pulsus, FullName as nome, InternalCode as codigo_setor, SectorName as grupo FROM ..."
                    />
                )}

                {activeTab === 'route' && (
                    <DbForm 
                        config={config.route} 
                        onChange={handleRouteChange} 
                        label="Previsão de Roteiro"
                        description="Conexão com ERP/SQL Server para buscar visitas previstas."
                        icon={<LocationMarkerIcon className="w-6 h-6 text-blue-500"/>}
                        queryPlaceholder="SELECT ... FROM IBETVSTCET WHERE DataVisita BETWEEN @pStartDate AND @pEndDate"
                    />
                )}

                {activeTab === 'promoter' && (
                    <DbForm 
                        config={config.promoter} 
                        onChange={handlePromoterChange} 
                        label="Clientes Promotores"
                        description="Conexão com ERP/SQL Server para buscar Lat/Long dos clientes de promotores."
                        icon={<LocationMarkerIcon className="w-6 h-6 text-blue-500"/>}
                        queryPlaceholder="SELECT CodigoCliente as Cod_Cliente, RazaoSocial as Razao_Social, Lat, Long FROM Clientes"
                    />
                )}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center">
                <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center shadow-lg shadow-blue-600/20">
                    {saving ? <SpinnerIcon className="w-5 h-5 mr-2"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>} Salvar Todas as Configurações
                </button>
                {message && <span className="ml-4 text-emerald-600 font-bold text-sm animate-pulse">{message}</span>}
            </div>
        </div>
    );
};

const RouteParamsSettings: React.FC = () => {
    const { systemConfig, updateSystemConfig } = useContext(DataContext);
    const [alertMaxDailyKM, setAlertMaxDailyKM] = useState(systemConfig.alertMaxDailyKM || 400);
    const [alertMaxClientDist, setAlertMaxClientDist] = useState(systemConfig.alertMaxClientDist || 100);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        setAlertMaxDailyKM(systemConfig.alertMaxDailyKM || 400);
        setAlertMaxClientDist(systemConfig.alertMaxClientDist || 100);
    }, [systemConfig]);

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');
        try {
            await updateSystemConfig({ 
                ...systemConfig, 
                alertMaxDailyKM, 
                alertMaxClientDist 
            });
            setMessage('Parâmetros atualizados com sucesso!');
        } catch (e: any) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center"><ChartBarIcon className="w-6 h-6 mr-2 text-blue-600"/> Parâmetros de Alerta de Rota</h3>
            <p className="text-sm text-slate-500 mb-6">Defina os limites para exibição de alertas no Roteirizador.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="p-6 bg-red-50 border border-red-100 rounded-xl">
                    <label className="block text-xs font-bold text-red-700 uppercase mb-2">Limite de KM Diário (Alerta)</label>
                    <div className="flex items-center">
                        <input 
                            type="number" 
                            value={alertMaxDailyKM} 
                            onChange={(e) => setAlertMaxDailyKM(Number(e.target.value))}
                            className="w-full bg-white text-slate-900 border border-red-200 rounded-xl p-3 focus:ring-2 focus:ring-red-500 font-bold text-lg outline-none"
                        />
                        <span className="ml-3 font-bold text-red-400">km</span>
                    </div>
                    <p className="text-[10px] text-red-600 mt-2">Dias com quilometragem acima deste valor serão marcados como suspeitos.</p>
                </div>

                <div className="p-6 bg-amber-50 border border-amber-100 rounded-xl">
                    <label className="block text-xs font-bold text-amber-700 uppercase mb-2">Raio Máximo do Cliente (Alerta)</label>
                    <div className="flex items-center">
                        <input 
                            type="number" 
                            value={alertMaxClientDist} 
                            onChange={(e) => setAlertMaxClientDist(Number(e.target.value))}
                            className="w-full bg-white text-slate-900 border border-amber-200 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 font-bold text-lg outline-none"
                        />
                        <span className="ml-3 font-bold text-amber-400">km</span>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-2">Clientes distantes do ponto de partida acima deste valor gerarão alerta.</p>
                </div>
            </div>

            <div className="flex items-center">
                <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center shadow-lg shadow-blue-600/20 transition disabled:opacity-50">
                    {isSaving ? <SpinnerIcon className="w-5 h-5 mr-2 animate-spin"/> : <CheckCircleIcon className="w-5 h-5 mr-2"/>} 
                    Salvar Parâmetros
                </button>
                {message && <span className="ml-4 text-emerald-600 font-bold text-sm animate-pulse">{message}</span>}
            </div>
        </div>
    );
};

const SystemBranding: React.FC = () => {
    const { systemConfig, updateSystemConfig } = useContext(DataContext);
    const [name, setName] = useState(systemConfig.companyName);
    const [logo, setLogo] = useState(systemConfig.logoUrl);
    const [address, setAddress] = useState(systemConfig.headquartersAddress || '');
    const [lat, setLat] = useState(systemConfig.headquartersLat?.toString() || '');
    const [lon, setLon] = useState(systemConfig.headquartersLong?.toString() || '');
    const [isSaving, setIsSaving] = useState(false);
    const [geocoding, setGeocoding] = useState(false);

    // Coordenadas para o mapa
    const mapCenter: [number, number] = useMemo(() => {
        const l = parseFloat(lat);
        const n = parseFloat(lon);
        if (!isNaN(l) && !isNaN(n) && l !== 0 && n !== 0) return [l, n];
        return [-23.55052, -46.633308]; // Default SP
    }, [lat, lon]);

    useEffect(() => { 
        setName(systemConfig.companyName); 
        setLogo(systemConfig.logoUrl); 
        setAddress(systemConfig.headquartersAddress || '');
        setLat(systemConfig.headquartersLat?.toString() || '');
        setLon(systemConfig.headquartersLong?.toString() || '');
    }, [systemConfig]);

    const handleSave = async () => { 
        setIsSaving(true); 
        try { 
            await updateSystemConfig({ 
                ...systemConfig, 
                companyName: name, 
                logoUrl: logo,
                headquartersAddress: address,
                headquartersLat: lat ? parseFloat(lat) : undefined,
                headquartersLong: lon ? parseFloat(lon) : undefined
            }); 
            alert("Configurações da empresa salvas com sucesso!");
        } finally { 
            setIsSaving(false); 
        } 
    };

    const handleGeocode = async () => {
        if (!address.trim()) return alert("Digite o endereço para buscar as coordenadas.");
        setGeocoding(true);
        try {
            const res = await geocodeAddress(address);
            setLat(res.lat.toString());
            setLon(res.lon.toString());
        } catch (e: any) {
            alert("Erro ao buscar coordenadas: " + e.message);
        } finally {
            setGeocoding(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                <PhotographIcon className="w-6 h-6 mr-2 text-blue-600"/> Dados da Empresa
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome da Empresa</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm outline-none text-slate-700 font-medium" 
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">URL do Logo</label>
                            <input 
                                type="text" 
                                value={logo} 
                                onChange={(e) => setLogo(e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm outline-none text-slate-700 font-medium font-mono text-xs" 
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 ml-1">Endereço da Sede (Para Reuniões de Ciclo)</label>
                        <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={address} 
                                onChange={(e) => setAddress(e.target.value)} 
                                placeholder="Rua, Número, Bairro, Cidade - UF"
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm outline-none text-slate-700 font-medium" 
                            />
                            <button 
                                onClick={handleGeocode}
                                disabled={geocoding}
                                className="bg-slate-900 text-white p-3.5 rounded-xl hover:bg-slate-800 transition shadow-md disabled:opacity-50"
                                title="Buscar Coordenadas"
                            >
                                {geocoding ? <SpinnerIcon className="w-5 h-5"/> : <SearchIcon className="w-5 h-5"/>}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Latitude</label>
                                <input 
                                    type="text" 
                                    value={lat} 
                                    onChange={(e) => setLat(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm outline-none text-slate-700 font-mono text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Longitude</label>
                                <input 
                                    type="text" 
                                    value={lon} 
                                    onChange={(e) => setLon(e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all shadow-sm outline-none text-slate-700 font-mono text-sm" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button 
                            onClick={handleSave} 
                            disabled={isSaving} 
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 w-full"
                        >
                            {isSaving ? <SpinnerIcon className="w-5 h-5 mr-3"/> : <CheckCircleIcon className="w-5 h-5 mr-3"/>}
                            Salvar Configurações da Empresa
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center">
                        <LocationMarkerIcon className="w-3 h-3 mr-1 text-blue-500"/> Localização no Mapa
                        <span className="ml-2 text-[8px] bg-blue-100 text-blue-600 px-1 rounded">Arraste o marcador para ajustar</span>
                    </label>
                    <div className="h-[380px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner z-0 relative">
                        <MapContainer center={mapCenter} zoom={16} className="h-full w-full">
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker 
                                position={mapCenter} 
                                draggable={true}
                                eventHandlers={{
                                    dragend: (e) => {
                                        const marker = e.target;
                                        const position = marker.getLatLng();
                                        setLat(position.lat.toFixed(7));
                                        setLon(position.lng.toFixed(7));
                                    },
                                }}
                            />
                            <MapUpdater center={mapCenter} />
                        </MapContainer>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-start">
                        <ExclamationIcon className="w-4 h-4 text-blue-500 mr-2 mt-0.5 shrink-0"/>
                        <p className="text-[10px] text-blue-700 leading-relaxed">
                            A geolocalização da sede é utilizada como ponto de referência para os cálculos de <b>Reembolso de Reunião de Ciclo</b>. 
                            Certifique-se de que o marcador está exatamente sobre o prédio da empresa.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SystemControl: React.FC = () => {
    const isMock = getCurrentMode() === 'MOCK';
    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 p-6 rounded-xl border border-slate-200">
                <div><p className="text-sm text-slate-500">Modo Atual</p><p className={`text-2xl font-bold ${isMock ? 'text-yellow-600' : 'text-emerald-600'}`}>{isMock ? 'MOCK (Simulado)' : 'PRODUÇÃO (API Real)'}</p></div>
                <div className="flex gap-3">
                    <button onClick={() => toggleMode('API')} disabled={!isMock} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${!isMock ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}>API Real</button>
                    <button onClick={() => toggleMode('MOCK')} disabled={isMock} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${isMock ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' : 'bg-yellow-600 text-white hover:bg-yellow-500'}`}>Mock</button>
                </div>
            </div>
        </div>
    );
};

// --- NOVO COMPONENTE: LOGS DE SISTEMA ---
const SystemLogs: React.FC = () => {
    const [logs, setLogs] = useState<LogSistema[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', user: '', search: '' });

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getSystemLogs(filters);
            setLogs(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);

    return (
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><ClipboardListIcon className="w-6 h-6 mr-2 text-blue-600"/> Logs de Auditoria</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 items-end">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Início</label><input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fim</label><input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuário</label><input type="text" value={filters.user} onChange={e => setFilters({...filters, user: e.target.value})} placeholder="Todos..." className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Detalhes / Ação</label><input type="text" value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="Buscar..." className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"/></div>
                <button onClick={fetchLogs} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-sm flex items-center justify-center transition shadow-md">{loading ? <SpinnerIcon className="w-5 h-5"/> : <><SearchIcon className="w-4 h-4 mr-2"/> Filtrar</>}</button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
                        <tr>
                            <th className="p-4 w-40">Data/Hora</th>
                            <th className="p-4 w-48">Usuário</th>
                            <th className="p-4 w-48">Ação</th>
                            <th className="p-4">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {logs.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhum log encontrado para os filtros.</td></tr>
                        ) : (
                            logs.map(log => (
                                <tr key={log.ID_Log} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-4 font-mono text-xs">{new Date(log.DataHora).toLocaleString('pt-BR')}</td>
                                    <td className="p-4 font-bold text-slate-800">{log.Usuario}</td>
                                    <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">{log.Acao}</span></td>
                                    <td className="p-4 text-slate-600">{log.Detalhes}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'users' | 'branding' | 'integration' | 'route_params' | 'system' | 'license' | 'logs'>('users');
    return (
        <div className="space-y-8">
            <div><h2 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Administração</h2><p className="text-slate-500">Controle total do sistema.</p></div>
            <div className="flex space-x-2 border-b border-slate-200 pb-1 overflow-x-auto">
                {[
                    { id: 'users', label: 'Usuários', icon: UserGroupIcon },
                    { id: 'integration', label: 'Integração DB', icon: UploadIcon },
                    { id: 'route_params', label: 'Parâmetros de Rota', icon: ChartBarIcon }, 
                    { id: 'logs', label: 'Logs de Auditoria', icon: ClipboardListIcon }, 
                    { id: 'license', label: 'Licença', icon: DocumentReportIcon },
                    { id: 'branding', label: 'Empresa', icon: PhotographIcon },
                    { id: 'system', label: 'Sistema', icon: CogIcon }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center border whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-transparent text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-100'}`}>
                        <tab.icon className={`w-4 h-4 mr-2 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`}/> {tab.label}
                    </button>
                ))}
            </div>
            <div>
                {activeTab === 'users' && <GestaoUsuarios embedded={true} />}
                {activeTab === 'integration' && <IntegrationSettings />}
                {activeTab === 'route_params' && <RouteParamsSettings />}
                {activeTab === 'logs' && <SystemLogs />}
                {activeTab === 'license' && <LicenseControl />}
                {activeTab === 'branding' && <SystemBranding />}
                {activeTab === 'system' && <SystemControl />}
            </div>
        </div>
    );
};
