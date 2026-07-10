
import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SystemUser, SystemRole, ActionType, AuditLog, SystemSettings, Perfil } from '../types';
import { hasPermission, resolveUserPermissions } from '../utils/rbac';
import { Shield, Settings, Activity, Trash2, Plus, X, Edit2, Save, Database, Server, FileCode, FileText, Bold, Italic, Heading1, List, Eye, ArrowLeftRight, UploadCloud, Info, AlertTriangle, RotateCcw, ChevronRight, Search, Loader2, Mail, Lock, UserCheck, Layout, Globe, Zap, ShieldCheck, Monitor } from 'lucide-react';
import DataImporter from './DataImporter';
import { normalizeString } from '../utils/stringUtils';
import { UI_LABEL_SMALL, UI_ICON_SIZE_SMALL, UI_ICON_SIZE_BASE, UI_BUTTON_PRIMARY, UI_BUTTON_SECONDARY, UI_BUTTON_SUCCESS, UI_BUTTON_DANGER } from '../constants';

const FIELD_LABELS: Record<string, string> = {
 sectorId: 'Setor/Cargo',
 linkedSimId: 'Chip Vinculado',
 currentUserId: 'Responsável Atual',
 userId: 'Colaborador',
 modelId: 'Modelo do Ativo',
 purchaseDate: 'Data de Compra',
 purchaseCost: 'Custo de Aquisição',
 invoiceNumber: 'Número da Nota',
 internalCode: 'Código Interno',
 pulsusId: 'ID MDM Pulsus',
 serialNumber: 'Nº Série',
 assetTag: 'Patrimônio',
 customData: 'Dados Extras',
 fullName: 'Nome Completo',
 email: 'E-mail',
 active: 'Status Ativo',
 address: 'Endereço Residencial',
 phoneNumber: 'Linha Telefônica',
 operator: 'Operadora',
 iccid: 'ICCID',
 planDetails: 'Plano',
 status: 'Estado Global',
 id: 'ID Sistema'
};

const AuditDetailModal = ({ logId, onClose }: { logId: string, onClose: () => void }) => {
 const { getLogDetail, sectors, sims, users, models, customFields } = useData();
 const { showToast } = useToast();
 const [log, setLog] = useState<AuditLog | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const load = async () => {
 try {
 const detail = await getLogDetail(logId);
 setLog(detail);
 } catch (e) { showToast("Erro ao carregar detalhes do log.","error"); onClose(); }
 finally { setLoading(false); }
 };
 load();
 }, [logId, getLogDetail, onClose, showToast]);

 const resolveFriendlyValue = (key: string, val: any): any => {
 if (val === null || val === undefined || val === '---' || val === '') return <span className="text-slate-700 dark:text-slate-300 italic text-[11px]">vazio</span>;
 
 if (key.toLowerCase().includes('date') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
 try { return new Date(val).toLocaleDateString('pt-BR'); } catch (e) { return val; }
 }

 if (key === 'purchaseCost') {
 return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
 }

 if (key === 'sectorId') return sectors.find(s => s.id === val)?.name || val;
 if (key === 'linkedSimId') return sims.find(s => s.id === val)?.phoneNumber || val;
 if (key === 'currentUserId' || key === 'userId') return users.find(u => u.id === val)?.fullName || val;
 if (key === 'modelId') return models.find(m => m.id === val)?.name || val;
 if (key === 'active') return val ? 'Ativo' : 'Inativo';

 if (key === 'customData') {
 try {
 const data = typeof val === 'string' ? JSON.parse(val) : val;
 return (
 <div className="flex flex-col gap-1">
 {Object.entries(data).map(([fieldId, fieldVal]: [string, any]) => {
 const fieldName = customFields.find(f => f.id === fieldId)?.name || fieldId;
 return <div key={fieldId} className="text-[11px]"><span className="font-bold opacity-60">{fieldName}:</span> {String(fieldVal || 'vazio')}</div>;
 })}
 </div>
 );
 } catch (e) { return <span className="text-[11px] font-mono break-all">{JSON.stringify(val)}</span>; }
 }

 if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
 if (typeof val === 'object') return <span className="text-[11px] font-mono break-all">{JSON.stringify(val)}</span>;
 
 return String(val);
 };

 if (loading) return (
 <div className="fixed inset-0 bg-white dark:bg-slate-800/60 z-[200] flex items-center justify-center backdrop-blur-md">
 <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl flex flex-col items-center gap-4">
 <Loader2 size={40} className="animate-spin"/>
 <p className="text-xs font-black uppercase tracking-widest">Carregando Auditoria...</p>
 </div>
 </div>
 );

 if (!log) return null;

 let diffs: { field: string, rawKey: string, old: any, new: any }[] = [];
 try {
 const prev = log.previousData ? JSON.parse(log.previousData) : null;
 const next = log.newData ? JSON.parse(log.newData) : null;
 if (prev && next) {
 const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
 allKeys.forEach(key => {
 if (key.startsWith('_')) return;
 if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
 diffs.push({ field: FIELD_LABELS[key] || key, rawKey: key, old: prev[key], new: next[key] });
 }
 });
 }
 } catch (e) {}

 return (
 <div className="fixed inset-0 bg-white dark:bg-slate-800/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
 <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-700">
 <div className="bg-white dark:bg-slate-800 bg-black px-8 py-5 flex justify-between items-center shrink-0">
 <div>
 <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Detalhes da Auditoria</h3>
 <p className="text-[11px] font-bold uppercase tracking-widest">{log.action} em {new Date(log.timestamp).toLocaleString()}</p>
 </div>
 <button onClick={onClose} className="hover:text-slate-900 dark:text-white transition-colors"><X size={24}/></button>
 </div>
 <div className="p-8 overflow-y-auto bg-white dark:bg-slate-800">
 <div className="mb-6 grid grid-cols-2 gap-4">
 <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-600">
 <span className="block text-[11px] font-bold uppercase mb-1">Realizado por</span>
 <span className="font-bold text-slate-900 dark:text-white text-sm">{log.adminUser}</span>
 </div>
 <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-300 dark:border-slate-600">
 <span className="block text-[11px] font-bold uppercase mb-1">Item Afetado</span>
 <span className="font-bold text-slate-900 dark:text-white text-sm">[{log.assetType}] {log.targetName}</span>
 </div>
 </div>
 {diffs.length > 0 ? (
 <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-inner">
 <table className="w-full text-xs text-left">
 <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] uppercase font-bold border-b border-slate-300 dark:border-slate-600">
 <tr><th className="px-4 py-3">Campo</th><th className="px-4 py-3">Valor Anterior</th><th className="px-4 py-3">Novo Valor</th></tr>
 </thead>
 <tbody className="divide-y divide-slate-800">
 {diffs.map((d, i) => (
 <tr key={i} className="border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:border-l-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700/60 bg-white dark:bg-slate-800">
 <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{d.field}</td>
 <td className="px-4 py-3 text-red-400 bg-red-50/30 bg-red-900/10 line-through decoration-red-300 decoration-red-700">{resolveFriendlyValue(d.rawKey, d.old)}</td>
 <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 bg-emerald-900/10 font-bold">{resolveFriendlyValue(d.rawKey, d.new)}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
 <Info size={32} className="mx-auto text-slate-700 dark:text-slate-300 mb-2"/>
 <p className="text-xs font-bold uppercase tracking-widest italic">Nenhuma mudança de valor detectada nos campos principais.</p>
 {log.notes && <p className="mt-4 text-xs font-medium whitespace-pre-wrap">Observação: {log.notes}</p>}
 </div>
 )}
 </div>
 <div className="bg-slate-50 dark:bg-slate-900 px-8 py-5 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0 transition-colors">
 <button onClick={onClose} className="px-8 py-3 bg-slate-100 dark:bg-slate-800 bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold uppercase text-[11px] tracking-wider hover:bg-black hover:bg-slate-600 transition-all">Fechar</button>
 </div>
 </div>
 </div>
 );
};

const AdminPanel = () => {
 const { user: currentUser } = useAuth();
 const { showToast } = useToast();
 
 const [activeTab, setActiveTab] = useState<'USERS' | 'SETTINGS' | 'LOGS' | 'TEMPLATE' | 'IMPORT' | 'ERP' | 'LICENSE'>('USERS');
 const [acessoSubTab, setAcessoSubTab] = useState<'OPERADORES' | 'PERFIS'>('OPERADORES');
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [userForm, setUserForm] = useState<Partial<SystemUser>>({ role: SystemRole.OPERATOR });
 
 const [profiles, setProfiles] = useState<Perfil[]>(() => {
   const saved = localStorage.getItem('rbac_profiles');
   if (saved) {
     try {
       return JSON.parse(saved);
     } catch (e) {}
   }
   return [
     {
       ID_Perfil: 1,
       Nome: 'Administrador TI',
       Ativo: true,
       Permissoes: { admin: true }
     },
     {
       ID_Perfil: 2,
       Nome: 'Operador Suporte',
       Ativo: true,
       Permissoes: {
         dispositivos_leitura: true,
         dispositivos_escrita: true,
         colaboradores_leitura: true,
         colaboradores_escrita: true,
         ativos_leitura: true,
         ativos_escrita: false,
         financeiro_leitura: true
       }
     },
     {
       ID_Perfil: 3,
       Nome: 'Financeiro e Compras',
       Ativo: true,
       Permissoes: {
         financeiro_leitura: true,
         financeiro_escrita: true,
         faturamento_leitura: true,
         faturamento_escrita: true
       }
     }
   ];
 });

 useEffect(() => {
   localStorage.setItem('rbac_profiles', JSON.stringify(profiles));
 }, [profiles]);

 const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
 const [editingProfile, setEditingProfile] = useState<Perfil | null>(null);
 const [profileForm, setProfileForm] = useState<{
   ID_Perfil?: number;
   Nome: string;
   Ativo: boolean;
   Permissoes: Record<string, boolean>;
 }>({
   Nome: '',
   Ativo: true,
   Permissoes: {}
 });

 const handleOpenProfileModal = (profile?: Perfil) => {
   if (profile) {
     setEditingProfile(profile);
     setProfileForm({
       ID_Perfil: profile.ID_Perfil,
       Nome: profile.Nome,
       Ativo: profile.Ativo,
       Permissoes: { ...profile.Permissoes }
     });
   } else {
     setEditingProfile(null);
     setProfileForm({
       Nome: '',
       Ativo: true,
       Permissoes: {
         dispositivos_leitura: false,
         dispositivos_escrita: false,
         colaboradores_leitura: false,
         colaboradores_escrita: false,
         financeiro_leitura: false,
         financeiro_escrita: false,
         faturamento_leitura: false,
         faturamento_escrita: false,
         sistema_leitura: false,
         sistema_escrita: false
       }
     });
   }
   setIsProfileModalOpen(true);
 };

 const handleProfileSubmit = (e: React.FormEvent) => {
   e.preventDefault();
   if (!profileForm.Nome.trim()) {
     showToast("Insira o nome do perfil", "error");
     return;
   }

   try {
     if (editingProfile) {
       const updated = profiles.map(p => p.ID_Perfil === editingProfile.ID_Perfil ? { ...p, Nome: profileForm.Nome, Ativo: profileForm.Ativo, Permissoes: profileForm.Permissoes } : p);
       setProfiles(updated);
       showToast("Perfil atualizado com sucesso!", "success");

       if (currentUser && (currentUser.ID_Perfil === editingProfile.ID_Perfil || currentUser.idPerfil === editingProfile.ID_Perfil)) {
         const updatedUser = {
           ...currentUser,
           Permissoes: profileForm.Permissoes,
           permissoes: profileForm.Permissoes,
           Nome_Perfil: profileForm.Nome
         };
         localStorage.setItem('it_asset_user', JSON.stringify(updatedUser));
       }
     } else {
       const newId = profiles.length > 0 ? Math.max(...profiles.map(p => p.ID_Perfil || 0)) + 1 : 1;
       const newProfile: Perfil = {
         ID_Perfil: newId,
         Nome: profileForm.Nome,
         Ativo: profileForm.Ativo,
         Permissoes: profileForm.Permissoes
       };
       setProfiles([...profiles, newProfile]);
       showToast("Perfil criado com sucesso!", "success");
     }
     setIsProfileModalOpen(false);
   } catch (err) {
     showToast("Erro ao salvar perfil", "error");
   }
 };

 const handleDeleteProfile = (profileId: number) => {
   if (profileId === 1) {
     showToast("O perfil de Administrador TI não pode ser excluído.", "error");
     return;
   }
   if (window.confirm("Deseja realmente excluir este perfil de acesso?")) {
     setProfiles(profiles.filter(p => p.ID_Perfil !== profileId));
     showToast("Perfil excluído com sucesso!", "success");
   }
 };
 const [logSearch, setLogSearch] = useState('');
 const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

 const [termConfig, setTermConfig] = useState({
 delivery: { declaration: '', clauses: '' },
 return: { declaration: '', clauses: '' }
 });

 const { 
 systemUsers, addSystemUser, updateSystemUser, deleteSystemUser, settings, updateSettings,
 clearLogs, restoreItem, 
 externalDbConfig, updateExternalDbConfig, testExternalDbConnection, fetchData,
 getLicenseStatus, updateLicense
 } = useData();
 const [licenseStatus, setLicenseStatus] = useState<{ status: string; client: string; expiresAt: string | null } | null>(null);
 const [licenseKeyInput, setLicenseKeyInput] = useState('');
 const [isValidatingLicense, setIsValidatingLicense] = useState(false);

 useEffect(() => {
 if (activeTab === 'LICENSE') {
 getLicenseStatus().then(setLicenseStatus);
 }
 }, [activeTab, getLicenseStatus]);

 const handleLicenseSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!licenseKeyInput.trim()) return;
 setIsValidatingLicense(true);
 try {
 const res = await updateLicense(licenseKeyInput);
 if (res.success) {
 showToast("Licença ativada com sucesso!", "success");
 const status = await getLicenseStatus();
 setLicenseStatus(status);
 setLicenseKeyInput('');
 } else {
 showToast(res.error || "Erro ao validar licença", "error");
 }
 } catch (err) {
 showToast("Erro de conexão", "error");
 } finally {
 setIsValidatingLicense(false);
 }
 };
 const [settingsForm, setSettingsForm] = useState<SystemSettings>(settings);
 const [erpForm, setErpForm] = useState({
 technology: 'SQL Server',
 host: '',
 port: 1433,
 username: '',
 password: '',
 databaseName: '',
 selectionQuery: ''
 });
 const [isTestingConnection, setIsTestingConnection] = useState(false);
 const [isPasswordModified, setIsPasswordModified] = useState(false);

 useEffect(() => {
 setSettingsForm(settings);
 try {
 if (settings.termTemplate && settings.termTemplate.trim().startsWith('{')) {
 setTermConfig(JSON.parse(settings.termTemplate));
 }
 } catch (e) {}
 }, [settings]);

 useEffect(() => {
 if (externalDbConfig) {
 setErpForm({
 technology: externalDbConfig.technology || 'SQL Server',
 host: externalDbConfig.host || '',
 port: externalDbConfig.port || 1433,
 username: externalDbConfig.username || '',
 password: externalDbConfig.password || '',
 databaseName: externalDbConfig.databaseName || '',
 selectionQuery: externalDbConfig.selectionQuery || ''
 });
 setIsPasswordModified(false);
 }
 }, [externalDbConfig]);

 useEffect(() => {
 if (activeTab === 'ERP' && !externalDbConfig) {
 fetchData(); // Força atualização para garantir que temos a config
 }
 }, [activeTab, externalDbConfig]);

 const handleOpenModal = (user?: SystemUser) => {
   if (user) { 
     const uProfileId = user.ID_Perfil || user.idPerfil || (user.role && !isNaN(Number(user.role)) ? Number(user.role) : undefined);
     setEditingId(user.id); 
     setUserForm({ ...user, ID_Perfil: uProfileId }); 
   } 
   else { 
     setEditingId(null); 
     setUserForm({ role: SystemRole.OPERATOR, password: '' }); 
   }
   setIsModalOpen(true);
 };

 const handleUserSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 const adminName = currentUser?.name || 'Admin';
 try {
 if (editingId && userForm.id) {
 updateSystemUser(userForm as SystemUser, adminName);
 showToast("Usuário atualizado com sucesso!","success");
 } else {
 addSystemUser({ ...userForm, id: Math.random().toString(36).substr(2, 9) } as SystemUser, adminName);
 showToast("Usuário criado com sucesso!","success");
 }
 setIsModalOpen(false);
 } catch (error) {
 showToast("Erro ao salvar usuário.","error");
 }
 };

 const handleZabbixSubmit = async () => {
    try {
        setLoading(true);
        const res = await fetch('/api/zabbix/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zabbixUrl: settingsForm.zabbixUrl || '', zabbixToken: settingsForm.zabbixToken || '' })
        });
        if (!res.ok) throw new Error('Erro ao salvar no servidor');
        updateSettings(settingsForm, currentUser?.name || 'Admin');
        showToast("Configuração Zabbix salva!", "success");
    } catch (e) {
        showToast("Erro ao salvar Zabbix.", "error");
    } finally {
        setLoading(false);
    }
  };
  
  const handleSettingsSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 try {
 updateSettings(settingsForm, currentUser?.name || 'Admin');
 showToast("Configurações atualizadas!","success");
 } catch (error) {
 showToast("Erro ao atualizar configurações.","error");
 }
 };

 const handleTermTemplateSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 try {
 const updatedSettings = { ...settings, termTemplate: JSON.stringify(termConfig) };
 updateSettings(updatedSettings, currentUser?.name || 'Admin');
 showToast("Templates de Termos salvos!","success");
 } catch (error) {
 showToast("Erro ao salvar templates.","error");
 }
 };

 const [logPage, setLogPage] = useState(1);
 const [debouncedLogSearch, setDebouncedLogSearch] = useState('');

 useEffect(() => {
 const timer = setTimeout(() => {
 setDebouncedLogSearch(logSearch);
 setLogPage(1); // Reset page on search
 }, 500);
 return () => clearTimeout(timer);
 }, [logSearch]);

 const { data: logsData, isLoading: logsLoading } = useQuery({
 queryKey: ['logs', logPage, debouncedLogSearch],
 queryFn: async () => {
 const res = await fetch(`/api/logs/paginated?page=${logPage}&limit=100&search=${encodeURIComponent(debouncedLogSearch)}`);
 if (!res.ok) throw new Error('Failed to fetch logs');
 return res.json();
 },
 enabled: activeTab === 'LOGS',
 });

 const filteredLogs = logsData?.logs || [];
 const totalLogs = logsData?.total || 0;
 const totalPages = logsData?.totalPages || 1;

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-end">
 <div>
 <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Administração do Sistema</h1>
 <p className="text-sm">Gerencie acessos, configurações e auditoria estruturada.</p>
 </div>
 </div>

 <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-800 px-2 pt-2 rounded-t-xl transition-colors">
 <button onClick={() => setActiveTab('USERS')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'USERS' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><Shield size={16} /> Acesso</button>
 <button onClick={() => setActiveTab('SETTINGS')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'SETTINGS' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><Settings size={16} /> Geral</button>
 <button onClick={() => setActiveTab('IMPORT')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'IMPORT' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><UploadCloud size={16} /> Importação</button>
 <button onClick={() => setActiveTab('ERP')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'ERP' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><Database size={16} /> Integração ERP</button>
 <button onClick={() => setActiveTab('TEMPLATE')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'TEMPLATE' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><FileText size={16} /> Editor de Termos</button>
 <button onClick={() => setActiveTab('LICENSE')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'LICENSE' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><ShieldCheck size={16} /> Licença</button>
 <button onClick={() => setActiveTab('LOGS')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-blue-600 bg-blue-50/50 bg-blue-50 dark:bg-sky-500/20' : ' hover:text-slate-700 dark:text-slate-300'}`}><Activity size={16} /> Auditoria</button>
                <button onClick={() => setActiveTab('ZABBIX')} className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[11px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'ZABBIX' ? 'border-blue-600 bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 border-transparent'}`}><Monitor size={16} /> Zabbix</button>
 </div>

 <div className="p-1 animate-fade-in">
 {activeTab === 'USERS' && (
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
   <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 pt-2 gap-2">
     <button 
       type="button"
       onClick={() => setAcessoSubTab('OPERADORES')} 
       className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${acessoSubTab === 'OPERADORES' ? 'border-blue-600 text-blue-600 dark:text-sky-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
     >
       Operadores ({systemUsers.length})
     </button>
     <button 
       type="button"
       onClick={() => setAcessoSubTab('PERFIS')} 
       className={`px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${acessoSubTab === 'PERFIS' ? 'border-blue-600 text-blue-600 dark:text-sky-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
     >
       Perfis de Acesso (RBAC) ({profiles.length})
     </button>
   </div>

   {acessoSubTab === 'OPERADORES' && (
     <div>
       <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
         <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><UserCheck size={18} className=""/> Usuários com Acesso ao Sistema</h3>
         <button onClick={() => handleOpenModal()} className="text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors"><Plus size={14}/> Novo Operador</button>
       </div>
       <div className="overflow-x-auto">
         <table className="w-full text-sm text-left">
           <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase tracking-widest">
             <tr>
               <th className="px-6 py-4">Nome</th>
               <th className="px-6 py-4">E-mail</th>
               <th className="px-6 py-4">Perfil / Permissões</th>
               <th className="px-6 py-4 text-right">Ações</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-800">
             {systemUsers.map(u => {
               const uProfileId = u.ID_Perfil || u.idPerfil || (u.role && !isNaN(Number(u.role)) ? Number(u.role) : null);
               const userProfile = profiles.find(p => p.ID_Perfil === uProfileId);
               const profileName = userProfile ? userProfile.Nome : (u.role === SystemRole.ADMIN ? 'Administrador (Legado)' : 'Operador (Legado)');
               const isProfileActive = userProfile ? userProfile.Ativo : true;
               return (
                 <tr key={u.id} className="border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:border-l-blue-500 bg-white dark:bg-slate-800">
                   <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{u.name}</td>
                   <td className="px-6 py-4 font-medium">{u.email}</td>
                   <td className="px-6 py-4">
                     <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${(u.role === SystemRole.ADMIN || userProfile?.Permissoes?.admin) ? ' bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 ' : ' bg-slate-100 dark:bg-slate-800 '}`}>
                       {profileName} {!isProfileActive && '(Inativo)'}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-right">
                     <div className="flex justify-end gap-2">
                       <button onClick={() => handleOpenModal(u)} className="p-1.5 hover:bg-blue-900/40 rounded-lg"><Edit2 size={16}/></button>
                       <button onClick={() => { if(window.confirm('Excluir acesso?')) deleteSystemUser(u.id, currentUser?.name || 'Admin') }} className="p-1.5 text-red-400 hover:bg-red-900/40 rounded-lg"><Trash2 size={16}/></button>
                     </div>
                   </td>
                 </tr>
               );
             })}
           </tbody>
         </table>
       </div>
     </div>
   )}

   {acessoSubTab === 'PERFIS' && (
     <div>
       <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
         <div>
           <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Shield size={18}/> Perfis de Acesso (RBAC)</h3>
           <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Crie perfis com permissões customizadas de Leitura e Escrita por módulo.</p>
         </div>
         <button onClick={() => handleOpenProfileModal()} className="text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors"><Plus size={14}/> Novo Perfil</button>
       </div>
       <div className="overflow-x-auto">
         <table className="w-full text-sm text-left">
           <thead className="bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase tracking-widest">
             <tr>
               <th className="px-6 py-4">Nome do Perfil</th>
               <th className="px-6 py-4">Status</th>
               <th className="px-6 py-4">Permissões Habilitadas</th>
               <th className="px-6 py-4 text-right">Ações</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-800">
             {profiles.map(p => {
               const activePerms = Object.keys(p.Permissoes || {}).filter(k => p.Permissoes[k]);
               const permsSummary = p.Permissoes?.admin ? 'Acesso Total (Admin)' : (activePerms.length === 0 ? 'Nenhuma' : activePerms.map(k => k.replace('_leitura', ' (L)').replace('_escrita', ' (E)')).join(', '));
               
               return (
                 <tr key={p.ID_Perfil} className="border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent transition-all hover:bg-slate-100 dark:hover:bg-slate-700/60 bg-white dark:bg-slate-800">
                   <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{p.Nome}</td>
                   <td className="px-6 py-4">
                     <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${p.Ativo ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                       {p.Ativo ? 'Ativo' : 'Inativo'}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-xs font-mono text-slate-600 dark:text-slate-400 max-w-xs truncate" title={permsSummary}>
                     {permsSummary}
                   </td>
                   <td className="px-6 py-4 text-right">
                     <div className="flex justify-end gap-2">
                       <button onClick={() => handleOpenProfileModal(p)} className="p-1.5 hover:bg-blue-900/40 rounded-lg text-slate-700 dark:text-slate-300" title="Editar Perfil"><Edit2 size={16}/></button>
                       {p.ID_Perfil !== 1 && (
                         <button onClick={() => handleDeleteProfile(p.ID_Perfil)} className="p-1.5 text-red-400 hover:bg-red-900/40 rounded-lg" title="Excluir Perfil"><Trash2 size={16}/></button>
                       )}
                     </div>
                   </td>
                 </tr>
               );
             })}
           </tbody>
         </table>
       </div>
     </div>
   )}
 </div>
 )}

 {activeTab === 'SETTINGS' && (
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
 <form onSubmit={handleSettingsSubmit} className="max-w-2xl space-y-6">
 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4"><Layout size={20} className=""/> Personalização do App</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="md:col-span-2">
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Nome da Aplicação</label>
 <input required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={settingsForm.appName} onChange={e => setSettingsForm({...settingsForm, appName: e.target.value})}/>
 </div>
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">CNPJ da Empresa</label>
 <input className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono"value={settingsForm.cnpj || ''} onChange={e => setSettingsForm({...settingsForm, cnpj: e.target.value})} placeholder="00.000.000/0001-00"/>
 </div>
 <div className="md:col-span-2">
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">URL do Logotipo</label>
 <div className="flex gap-4 items-center">
 <input className="flex-1 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm"value={settingsForm.logoUrl} onChange={e => setSettingsForm({...settingsForm, logoUrl: e.target.value})} placeholder="https://..."/>
 {settingsForm.logoUrl && <img src={settingsForm.logoUrl} className="h-10 w-10 object-contain rounded border p-1"alt="Logo Preview"/>}
 </div>
 </div>
 </div>
 <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
 <button type="submit"className="text-slate-900 dark:text-white px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"><Save size={18}/> Salvar Configurações</button>
 </div>
 </form>
 </div>
 )}

 {activeTab === 'TEMPLATE' && (
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
 <form onSubmit={handleTermTemplateSubmit} className="space-y-10">
 <div>
 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2"><Globe size={20} className=""/> Termo de Entrega</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1">Declaração (Topo)</label>
 <textarea rows={4} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"value={termConfig.delivery.declaration} onChange={e => setTermConfig({...termConfig, delivery: {...termConfig.delivery, declaration: e.target.value}})}/>
 </div>
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1">Cláusulas e Condições</label>
 <textarea rows={4} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"value={termConfig.delivery.clauses} onChange={e => setTermConfig({...termConfig, delivery: {...termConfig.delivery, clauses: e.target.value}})}/>
 </div>
 </div>
 </div>
 <div>
 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-2"><RotateCcw size={20} className=""/> Termo de Devolução</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1">Declaração (Topo)</label>
 <textarea rows={4} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"value={termConfig.return.declaration} onChange={e => setTermConfig({...termConfig, return: {...termConfig.return, declaration: e.target.value}})}/>
 </div>
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1">Cláusulas e Condições</label>
 <textarea rows={4} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"value={termConfig.return.clauses} onChange={e => setTermConfig({...termConfig, return: {...termConfig.return, clauses: e.target.value}})}/>
 </div>
 </div>
 </div>
 <div className="bg-blue-50 dark:bg-sky-500/20 p-4 rounded-xl border border-blue-300 dark:border-sky-700/30 text-[11px] text-blue-300 font-bold uppercase tracking-widest">
 Variáveis Disponíveis: {'{NOME_EMPRESA}, {CNPJ}, {NOME_COLABORADOR}, {CPF}, {RG}'}
 </div>
 <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
 <button type="submit"className="text-slate-900 dark:text-white px-10 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"><Save size={18}/> Salvar Templates</button>
 </div>
 </form>
 </div>
 )}

 {activeTab === 'IMPORT' && <DataImporter />}

 {activeTab === 'LICENSE' && (
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 animate-fade-in">
 <div className="flex items-center gap-3 mb-8">
 <ShieldCheck size={24} className="text-blue-500" />
 <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Status da Licença</h3>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
 {/* Lado Esquerdo: Status */}
 <div className={`p-8 rounded-3xl border-2 transition-all ${licenseStatus?.status === 'ACTIVE' ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-red-900/10 border-red-500/30'}`}>
 <div className="space-y-6">
 <div>
 <p className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest mb-1">Situação</p>
 <p className={`text-2xl font-black uppercase tracking-tighter ${licenseStatus?.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-400'}`}>
 {licenseStatus?.status === 'ACTIVE' ? 'ATIVA' : 'EXPIRADA / INVÁLIDA'}
 </p>
 </div>
 <div>
 <p className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest mb-1">Cliente</p>
 <p className="text-lg font-bold text-slate-900 dark:text-white">{licenseStatus?.client || '---'}</p>
 </div>
 <div>
 <p className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 tracking-widest mb-1">Vencimento</p>
 <p className="text-lg font-bold text-slate-900 dark:text-white">
 {licenseStatus?.expiresAt ? new Date(licenseStatus.expiresAt).toLocaleDateString('pt-BR') : '---'}
 </p>
 </div>
 </div>
 </div>

 {/* Lado Direito: Ativação */}
 <div className="bg-slate-100 dark:bg-slate-800/30 p-8 rounded-3xl border border-slate-300 dark:border-slate-600/50">
 <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest mb-6">Ativar Licença</h4>
 <form onSubmit={handleLicenseSubmit} className="space-y-6">
 <div className="relative">
 <textarea
 rows={4}
 className="w-full border-2 border-slate-300 dark:border-slate-600 rounded-2xl p-4 text-sm focus:border-blue-500 outline-none bg-white dark:bg-slate-800/50 text-slate-900 dark:text-white font-mono resize-none transition-all"
 placeholder="Cole a chave aqui..."
 value={licenseKeyInput}
 onChange={e => setLicenseKeyInput(e.target.value)}
 />
 </div>
 <button
 type="submit"
 disabled={isValidatingLicense || !licenseKeyInput.trim()}
 className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20"
 >
 {isValidatingLicense ? (
 <>
 <Loader2 size={18} className="animate-spin" />
 Validando...
 </>
 ) : (
 'Validar'
 )}
 </button>
 </form>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'ERP' && (
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
 <form onSubmit={(e) => { e.preventDefault(); updateExternalDbConfig(erpForm, currentUser?.name || 'Admin'); alert('Configurações salvas!'); }} className="space-y-8">
 <div className="flex justify-between items-center">
 <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><Database size={20} className=""/> Configuração de Banco de Dados Externo</h3>
 <div className="flex gap-3">
 <button 
 type="button"
 onClick={async () => {
 setIsTestingConnection(true);
 try {
 const res = await testExternalDbConnection(erpForm);
 alert(res.message);
 } catch (e) { alert('Erro ao testar conexão.'); }
 finally { setIsTestingConnection(false); }
 }}
 disabled={isTestingConnection}
 className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all disabled:opacity-50"
 >
 {isTestingConnection ? <Loader2 size={14} className="animate-spin"/> : <RotateCcw size={14}/>}
 Testar Conexão
 </button>
 <button type="submit"className="text-slate-900 dark:text-white px-6 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"><Save size={14}/> Salvar Configuração</button>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Tecnologia</label>
 <select className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={erpForm.technology} onChange={e => setErpForm({...erpForm, technology: e.target.value})}>
 <option value="SQL Server">SQL Server</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Host / Servidor</label>
 <input required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={erpForm.host} onChange={e => setErpForm({...erpForm, host: e.target.value})} placeholder="ex: 192.168.1.50 ou sql.empresa.com.br"/>
 </div>
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Porta</label>
 <input required type="number"className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={erpForm.port} onChange={e => setErpForm({...erpForm, port: parseInt(e.target.value)})}/>
 </div>
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Usuário</label>
 <input required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={erpForm.username} onChange={e => setErpForm({...erpForm, username: e.target.value})}/>
 </div>
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1">Senha</label>
 <input 
 type="password"
 required 
 className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"
 value={isPasswordModified ? erpForm.password : (erpForm.password ? '********' : '')} 
 onChange={e => {
 setErpForm({...erpForm, password: e.target.value});
 setIsPasswordModified(true);
 }}
 onFocus={() => {
 if (!isPasswordModified) {
 setErpForm({...erpForm, password: ''});
 setIsPasswordModified(true);
 }
 }}
 />
 </div>
 <div className="md:col-span-3">
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Nome do Banco de Dados</label>
 <input required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={erpForm.databaseName} onChange={e => setErpForm({...erpForm, databaseName: e.target.value})}/>
 </div>
 <div className="md:col-span-3">
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Query SQL de Seleção</label>
 <div className="relative">
 <FileCode className="absolute left-3 top-3 text-slate-700 dark:text-slate-300"size={18}/>
 <textarea 
 rows={8} 
 className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 text-xs font-mono focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"
 value={erpForm.selectionQuery} 
 onChange={e => setErpForm({...erpForm, selectionQuery: e.target.value})}
 placeholder="SELECT Codigo, Nome, CPF, RG, PIS, ValidaExpediente FROM ..."
 />
 </div>
 <p className="text-[11px] mt-2 italic">A query deve retornar obrigatoriamente as colunas: <span className="font-bold">Codigo, Nome, CPF, RG, PIS, ValidaExpediente</span>.</p>
 </div>
 </div>
 </form>
 </div>
 )}

 
            {activeTab === 'ZABBIX' && (
                <div className="p-8 space-y-6">
                    <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-4 mb-8">
                        <div className="h-12 w-12 bg-blue-50 dark:bg-sky-500/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-sky-400 border border-blue-800/30">
                            <Monitor size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Integração Zabbix</h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Configure a conexão com seu servidor Zabbix para monitoramento de impressoras.</p>
                        </div>
                    </div>
                    
                    <div className="max-w-2xl bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400">URL do Zabbix (API)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white" 
                                    value={settingsForm.zabbixUrl || ''} 
                                    onChange={e => setSettingsForm({...settingsForm, zabbixUrl: e.target.value})} 
                                    placeholder="http://zabbix.suaempresa.local/zabbix" 
                                />
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">Sem o /api_jsonrpc.php no final.</p>
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1 text-slate-500 dark:text-slate-400">API Token</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white" 
                                    value={settingsForm.zabbixToken || ''} 
                                    onChange={e => setSettingsForm({...settingsForm, zabbixToken: e.target.value})} 
                                    placeholder="Zabbix API Token" 
                                />
                            </div>
                            <div className="pt-4 flex justify-end">
                                <button onClick={handleZabbixSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2">
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Salvar Zabbix
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'LOGS' && (
 <div className="space-y-4 animate-fade-in">
 <div className="flex flex-col md:flex-row gap-4 mb-2">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-3.5"size={18}/>
 <input type="text"placeholder="Filtrar por Admin, Item, Ação..."className="w-full pl-12 pr-6 py-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium text-sm transition-colors"value={logSearch} onChange={e => setLogSearch(e.target.value)}/>
 </div>
 <div className="bg-blue-50 dark:bg-sky-500/20 border rounded-2xl px-6 py-3 flex items-center gap-3">
 <Activity size={20} className=""/>
 <div className="text-[11px] font-black uppercase text-blue-600 dark:text-sky-400">Auditoria: {totalLogs} eventos</div>
 </div>
 </div>
 <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm text-left">
 <thead className="text-[11px] font-black uppercase bg-slate-100 dark:bg-slate-800 border-b tracking-widest">
 <tr><th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">Operador</th><th className="px-6 py-4">Ação</th><th className="px-6 py-4">Item Afetado</th><th className="px-6 py-4 text-right">Ações</th></tr>
 </thead>
 <tbody className="divide-y divide-slate-800">
 {logsLoading ? (
 <tr><td colSpan={5} className="px-6 py-8 text-center"><Loader2 className="animate-spin inline-block mr-2"size={20}/> Carregando auditoria...</td></tr>
 ) : filteredLogs.length === 0 ? (
 <tr><td colSpan={5} className="px-6 py-8 text-center">Nenhum log encontrado.</td></tr>
 ) : filteredLogs.map((log: AuditLog) => (
 <tr key={log.id} className="border-b border-slate-200 dark:border-slate-700/50 border-l-4 border-l-transparent transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 hover:border-l-blue-500 bg-white dark:bg-slate-800">
 <td className="px-6 py-4 whitespace-nowrap text-[11px] font-mono font-bold">{new Date(log.timestamp).toLocaleString()}</td>
 <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{log.adminUser}</td>
 <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400">{log.action}</span></td>
 <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300 text-xs truncate max-w-[150px]">{log.targetName || log.assetId}</td>
 <td className="px-6 py-4 text-right">
 <button onClick={() => setSelectedLogId(log.id)} className={`px-3 py-1.5 rounded-xl ${UI_BUTTON_SECONDARY} text-[11px]`}>Detalhes</button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 {totalPages > 1 && (
 <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50">
 <button 
 disabled={logPage === 1 || logsLoading} 
 onClick={() => setLogPage(p => Math.max(1, p - 1))}
 className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-700 border border-slate-600 rounded-lg disabled:opacity-50"
 >
 Anterior
 </button>
 <span className="text-xs font-bold">Página {logPage} de {totalPages}</span>
 <button 
 disabled={logPage === totalPages || logsLoading} 
 onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
 className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-700 border border-slate-600 rounded-lg disabled:opacity-50"
 >
 Próxima
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {isModalOpen && (
 <div className="fixed inset-0 bg-white dark:bg-slate-800/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
 <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-700">
 <div className="bg-white dark:bg-slate-800 bg-black px-8 py-5 flex justify-between items-center border-b border-white/10">
 <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingId ? 'Editar Operador' : 'Novo Operador'}</h3>
 <button onClick={() => setIsModalOpen(false)} className="hover:text-slate-900 dark:text-white"><X size={24}/></button>
 </div>
 <form onSubmit={handleUserSubmit} className="p-8 space-y-6">
 <div className="space-y-4">
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Nome Completo</label>
 <input required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"value={userForm.name || ''} onChange={e => setUserForm({...userForm, name: e.target.value})}/>
 </div>
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">E-mail de Acesso</label>
 <div className="relative">
 <Mail className="absolute left-3 top-3 text-slate-700 dark:text-slate-300"size={18}/>
 <input required type="email"className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"value={userForm.email || ''} onChange={e => setUserForm({...userForm, email: e.target.value})}/>
 </div>
 </div>
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1">Senha</label>
 <div className="relative">
 <Lock className="absolute left-3 top-3 text-slate-700 dark:text-slate-300"size={18}/>
 <input required={!editingId} type="password"placeholder={editingId ? '••••••••' : ''} className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 pl-10 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white"value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})}/>
 </div>
 </div>
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Perfil de Acesso (RBAC)</label>
 <select 
   className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold"
   value={userForm.ID_Perfil || ''} 
   onChange={e => {
     const pId = Number(e.target.value);
     const selectedProf = profiles.find(p => p.ID_Perfil === pId);
     setUserForm({
       ...userForm,
       ID_Perfil: pId,
       Nome_Perfil: selectedProf?.Nome || '',
       idPerfil: pId,
       Permissoes: selectedProf?.Permissoes,
       role: String(pId) as SystemRole
     });
   }}
 >
   <option value="">Selecione um Perfil de Acesso...</option>
   {profiles.map(p => (
     <option key={p.ID_Perfil} value={p.ID_Perfil}>
       {p.Nome} {p.Ativo ? '' : '(Inativo)'}
     </option>
   ))}
 </select>
 </div>
 </div>
 <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
 <button type="button" onClick={() => setIsModalOpen(false)} className={`px-6 py-2 rounded-xl ${UI_BUTTON_SECONDARY} text-xs`}>Cancelar</button>
 <button type="submit" className={`px-8 py-3 rounded-xl ${UI_BUTTON_PRIMARY} text-xs uppercase`}>Salvar Operador</button>
 </div>
 </form>
 </div>
 </div>
 )}

 {isProfileModalOpen && (
 <div className="fixed inset-0 bg-white dark:bg-slate-800/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
 <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-700">
 <div className="bg-white dark:bg-slate-800 bg-black px-8 py-5 flex justify-between items-center border-b border-white/10">
 <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingProfile ? 'Editar Perfil (RBAC)' : 'Novo Perfil (RBAC)'}</h3>
 <button onClick={() => setIsProfileModalOpen(false)} className="hover:text-slate-900 dark:text-white"><X size={24}/></button>
 </div>
 <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
 <div className="space-y-4">
 <div>
 <label className="block text-[11px] font-black uppercase mb-1 ml-1">Nome do Perfil</label>
 <input required className="w-full border-2 border-slate-200 dark:border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none bg-slate-100 dark:bg-slate-800/50 text-slate-900 dark:text-white font-bold" value={profileForm.Nome || ''} onChange={e => setProfileForm({...profileForm, Nome: e.target.value})}/>
 </div>
 
 <div className="flex items-center gap-2 py-2">
 <input 
   id="profile-active"
   type="checkbox" 
   checked={profileForm.Ativo} 
   onChange={e => setProfileForm({...profileForm, Ativo: e.target.checked})}
   className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
 />
 <label htmlFor="profile-active" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase select-none">Perfil Ativo</label>
 </div>

 <div className="flex items-center gap-2 p-3 bg-indigo-950/20 border border-indigo-800/40 rounded-xl">
 <input 
   id="profile-admin"
   type="checkbox" 
   checked={!!profileForm.Permissoes?.admin} 
   onChange={e => {
     setProfileForm({
       ...profileForm,
       Permissoes: {
         ...profileForm.Permissoes,
         admin: e.target.checked
       }
     });
   }}
   className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
 />
 <label htmlFor="profile-admin" className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase select-none">Acesso Total (Administrador TI)</label>
 </div>

 <div>
 <label className="block text-[11px] font-black uppercase mb-2 ml-1 text-slate-600 dark:text-slate-400">Matriz de Permissões</label>
 <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
   <div className="flex items-center justify-between p-2 border-b border-slate-200 dark:border-slate-700">
     <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Módulo</span>
     <div className="flex gap-8">
       <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 w-16 text-center">Leitura</span>
       <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 w-16 text-center">Escrita</span>
     </div>
   </div>
   {[
    { label: '📊 Dashboard', readKey: 'dashboard_leitura', writeKey: 'dashboard_escrita' },
    { label: '📱 Dispositivos', readKey: 'dispositivos_leitura', writeKey: 'dispositivos_escrita' },
    { label: '👥 Colaboradores', readKey: 'colaboradores_leitura', writeKey: 'colaboradores_escrita' },
    { label: '📳 Chips / SIMs', readKey: 'chips_leitura', writeKey: 'chips_escrita' },
    { label: '🌐 Licenças / Contas', readKey: 'licencas_leitura', writeKey: 'licencas_escrita' },
    { label: '📦 Consumíveis', readKey: 'consumiveis_leitura', writeKey: 'consumiveis_escrita' },
    { label: '✅ Gestão de Tarefas', readKey: 'tarefas_leitura', writeKey: 'tarefas_escrita' },
    { label: '📄 Relatórios', readKey: 'relatorios_leitura', writeKey: 'relatorios_escrita' },
    { label: '🔄 Entrega / Devolução', readKey: 'entrega_leitura', writeKey: 'entrega_escrita' },
    { label: '⚙️ Configurações do Sistema', readKey: 'sistema_leitura', writeKey: 'sistema_escrita' }
  ].map(m => (
     <div key={m.readKey} className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-700/20 rounded-lg">
       <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</span>
       <div className="flex gap-8">
         <div className="w-16 flex justify-center">
           <input 
             type="checkbox" 
             disabled={profileForm.Permissoes?.admin}
             checked={profileForm.Permissoes?.admin || !!profileForm.Permissoes?.[m.readKey]} 
             onChange={e => {
               setProfileForm({
                 ...profileForm,
                 Permissoes: {
                   ...profileForm.Permissoes,
                   [m.readKey]: e.target.checked
                 }
               });
             }}
             className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
           />
         </div>
         <div className="w-16 flex justify-center">
           <input 
             type="checkbox" 
             disabled={profileForm.Permissoes?.admin}
             checked={profileForm.Permissoes?.admin || !!profileForm.Permissoes?.[m.writeKey]} 
             onChange={e => {
               setProfileForm({
                 ...profileForm,
                 Permissoes: {
                   ...profileForm.Permissoes,
                   [m.writeKey]: e.target.checked
                 }
               });
             }}
             className="rounded border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 h-4 w-4"
           />
         </div>
       </div>
     </div>
   ))}
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
 <button type="button" onClick={() => setIsProfileModalOpen(false)} className={`px-6 py-2 rounded-xl ${UI_BUTTON_SECONDARY} text-xs`}>Cancelar</button>
 <button type="submit" className={`px-8 py-3 rounded-xl ${UI_BUTTON_PRIMARY} text-xs uppercase`}>Salvar Perfil</button>
 </div>
 </form>
 </div>
 </div>
 )}

 {selectedLogId && <AuditDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(null)} />}
 </div>
 );
};

export default AdminPanel;
