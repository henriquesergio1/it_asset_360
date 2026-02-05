
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SystemUser, SystemRole, ActionType, AuditLog } from '../types';
import { Shield, Settings, Activity, Trash2, Plus, X, Edit2, Save, Database, Server, FileCode, FileText, Bold, Italic, Heading1, List, Eye, ArrowLeftRight, UploadCloud, Info, AlertTriangle, RotateCcw, ChevronRight, Search } from 'lucide-react';
import DataImporter from './DataImporter';
import { generateAndPrintTerm } from '../utils/termGenerator';

// --- SUB-COMPONENTE: AuditDetailModal ---
const AuditDetailModal = ({ log, onClose }: { log: AuditLog, onClose: () => void }) => {
    let diffs: { field: string, old: any, new: any }[] = [];
    
    try {
        const prev = log.previousData ? JSON.parse(log.previousData) : null;
        const next = log.newData ? JSON.parse(log.newData) : null;

        if (prev && next) {
            const allKeys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
            allKeys.forEach(key => {
                if (key.startsWith('_')) return; // ignorar campos de sistema
                
                const val1 = JSON.stringify(prev[key]);
                const val2 = JSON.stringify(next[key]);
                
                if (val1 !== val2) {
                    diffs.push({
                        field: key,
                        old: prev[key],
                        new: next[key]
                    });
                }
            });
        }
    } catch (e) {
        console.error("Erro ao processar diff", e);
    }

    const formatValue = (v: any) => {
        if (v === null || v === undefined) return <span className="text-slate-300 italic text-[10px]">vazio</span>;
        if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
        if (typeof v === 'object') return <span className="text-[10px] font-mono text-slate-400 break-all">{JSON.stringify(v)}</span>;
        return String(v);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">
                <div className="bg-slate-900 px-8 py-5 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter">Detalhes da Auditoria</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{log.action} em {new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24}/></button>
                </div>
                
                <div className="p-8 overflow-y-auto">
                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-xl border">
                            <span className="block text-[10px] font-black text-slate-400 uppercase mb-1">Realizado por</span>
                            <span className="font-bold text-slate-800 text-sm">{log.adminUser}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border">
                            <span className="block text-[10px] font-black text-slate-400 uppercase mb-1">Item Afetado</span>
                            <span className="font-bold text-slate-800 text-sm">[{log.assetType}] {log.targetName}</span>
                        </div>
                    </div>

                    {diffs.length > 0 ? (
                        <div className="border rounded-2xl overflow-hidden shadow-inner">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-500 border-b">
                                    <tr>
                                        <th className="px-4 py-3">Campo</th>
                                        <th className="px-4 py-3">Valor Anterior</th>
                                        <th className="px-4 py-3">Novo Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {diffs.map((d, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-bold text-slate-700 capitalize">{d.field}</td>
                                            <td className="px-4 py-3 text-red-600 bg-red-50/30 line-through decoration-red-300">{formatValue(d.old)}</td>
                                            <td className="px-4 py-3 text-emerald-700 bg-emerald-50/30 font-bold">{formatValue(d.new)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                            <Info size={32} className="mx-auto text-slate-300 mb-2"/>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Nenhuma mudança de valor detectada nos campos principais.</p>
                            {log.notes && <p className="mt-4 text-xs font-medium text-slate-600">Observação: {log.notes}</p>}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 px-8 py-5 border-t flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all">Fechar Detalhes</button>
                </div>
            </div>
        </div>
    );
};

const AdminPanel = () => {
  const { systemUsers, addSystemUser, updateSystemUser, deleteSystemUser, settings, updateSettings, logs, clearLogs, restoreItem } = useData();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'USERS' | 'SETTINGS' | 'LOGS' | 'TEMPLATE' | 'IMPORT'>('USERS');

  // User Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<Partial<SystemUser>>({ role: SystemRole.OPERATOR });

  // Settings State
  const [settingsForm, setSettingsForm] = useState(settings);
  const [msg, setMsg] = useState('');
  
  // App Mode State
  const [currentMode, setCurrentMode] = useState('mock');
  
  // Template Logic State
  const [activeTemplateType, setActiveTemplateType] = useState<'DELIVERY' | 'RETURN'>('DELIVERY');
  
  // Auditoria Detalhada
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [logSearch, setLogSearch] = useState('');

  // Track focused textarea for insertions
  const [activeField, setActiveField] = useState<'declaration' | 'clauses'>('declaration');
  const declRef = useRef<HTMLTextAreaElement>(null);
  const clausesRef = useRef<HTMLTextAreaElement>(null);

  // Parsed Config Object (for Structured Editing)
  const [termConfig, setTermConfig] = useState({
      delivery: { declaration: '', clauses: '' },
      return: { declaration: '', clauses: '' }
  });

  useEffect(() => {
    setCurrentMode(localStorage.getItem('app_mode') || 'mock');
  }, []);

  // Initialize Config from Settings string
  useEffect(() => {
      try {
          if (settings.termTemplate && settings.termTemplate.trim().startsWith('{')) {
              setTermConfig(JSON.parse(settings.termTemplate));
          }
      } catch (e) {
          console.error("Failed to parse term config", e);
      }
  }, [settings]);

  // Handlers for User Management
  const handleOpenModal = (user?: SystemUser) => {
    if (user) {
      setEditingId(user.id);
      setUserForm(user);
    } else {
      setEditingId(null);
      setUserForm({ role: SystemRole.OPERATOR, password: '' });
    }
    setIsModalOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && userForm.id) {
        const userToUpdate = { ...userForm } as SystemUser;
        updateSystemUser(userToUpdate, currentUser?.name || 'Admin');
    } else {
        addSystemUser({ ...userForm, id: Math.random().toString(36).substr(2, 9) } as SystemUser, currentUser?.name || 'Admin');
    }
    setIsModalOpen(false);
  };

  // Handler for Settings
  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(settingsForm, currentUser?.name || 'Admin');
    setMsg('Configurações salvas com sucesso!');
    setTimeout(() => setMsg(''), 3000);
  };

  // Handler for saving Term Texts
  const handleTermSave = () => {
      const jsonString = JSON.stringify(termConfig);
      const newSettings = { ...settingsForm, termTemplate: jsonString };
      setSettingsForm(newSettings);
      updateSettings(newSettings, currentUser?.name || 'Admin');
      setMsg('Textos dos termos atualizados com sucesso!');
      setTimeout(() => setMsg(''), 3000);
  };

  // Handler for Mode Switch
  const toggleAppMode = () => {
    const newMode = currentMode === 'mock' ? 'prod' : 'mock';
    if (window.confirm(`ATENÇÃO: Você está prestes a mudar para o modo ${newMode.toUpperCase()}.\n\nIsso fará com que o sistema use ${newMode === 'prod' ? 'o Banco SQL Server Real' : 'Dados Fictícios em Memória'}.\n\nA página será recarregada. Deseja continuar?`)) {
        localStorage.setItem('app_mode', newMode);
        window.location.reload();
    }
  };

  const updateConfig = (field: 'declaration' | 'clauses', value: string) => {
      setTermConfig(prev => ({
          ...prev,
          [activeTemplateType === 'DELIVERY' ? 'delivery' : 'return']: {
              ...prev[activeTemplateType === 'DELIVERY' ? 'delivery' : 'return'],
              [field]: value
          }
      }));
  };

  const handleClearLogs = () => {
      if (window.confirm('PERIGO: Esta ação apagará PERMANENTEMENTE todo o histórico de auditoria e movimentações.\n\nDeseja realmente continuar?')) {
          clearLogs();
          alert('Histórico limpo com sucesso.');
      }
  };

  const handleRestore = (logId: string) => {
      if(window.confirm('Deseja restaurar este item excluído?')) {
          restoreItem(logId, currentUser?.name || 'Admin');
      }
  };

  const filteredLogs = logs.filter(l => 
    `${l.adminUser} ${l.targetName} ${l.action} ${l.notes || ''}`.toLowerCase().includes(logSearch.toLowerCase())
  );

  // --- PREVIEW HANDLER ---
  const handlePreview = () => {
      const tempSettings = {
          ...settingsForm,
          termTemplate: JSON.stringify(termConfig)
      };

      const mockUser = {
          id: 'preview_u',
          fullName: 'João da Silva (Exemplo)',
          cpf: '123.456.789-00',
          rg: '12.345.678-9',
          email: 'joao.silva@empresa.com',
          jobTitle: 'Cód: TI-001',
          active: true
      };
      const mockAsset = {
          id: 'preview_a',
          serialNumber: 'SN-EXAMPLE-01',
          assetTag: 'TAG-9999',
          status: 'Em Uso'
      };

      generateAndPrintTerm({
          user: mockUser as any,
          asset: mockAsset as any,
          settings: tempSettings,
          model: { name: 'Notebook Dell Latitude 3420' } as any,
          brand: { name: 'Dell' } as any,
          type: { name: 'Notebook' } as any,
          actionType: activeTemplateType === 'DELIVERY' ? 'ENTREGA' : 'DEVOLUCAO',
          sectorName: 'Tecnologia da Informação',
          notes: 'Este é um termo de exemplo para visualização de layout e formatação.',
          checklist: activeTemplateType === 'RETURN' ? { 'Notebook': true, 'Carregador': true, 'Mouse': true } : undefined
      });
  };

  const insertTag = (tagStart: string, tagEnd: string) => {
      const textarea = activeField === 'declaration' ? declRef.current : clausesRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = activeField === 'declaration' 
        ? (activeTemplateType === 'DELIVERY' ? termConfig.delivery.declaration : termConfig.return.declaration)
        : (activeTemplateType === 'DELIVERY' ? termConfig.delivery.clauses : termConfig.return.clauses);
      
      const selectedText = text.substring(start, end);
      const newText = text.substring(0, start) + tagStart + selectedText + tagEnd + text.substring(end);

      updateConfig(activeField, newText);
      
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tagStart.length, end + tagStart.length);
      }, 0);
  };

  const insertVariable = (val: string) => {
      const textarea = activeField === 'declaration' ? declRef.current : clausesRef.current;
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = activeField === 'declaration' 
        ? (activeTemplateType === 'DELIVERY' ? termConfig.delivery.declaration : termConfig.return.declaration)
        : (activeTemplateType === 'DELIVERY' ? termConfig.delivery.clauses : termConfig.return.clauses);

      const newText = text.substring(0, start) + val + text.substring(end);
      updateConfig(activeField, newText);

      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + val.length, start + val.length);
      }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Administração do Sistema</h1>
          <p className="text-gray-500 text-sm">Gerencie acessos, configurações e auditoria estruturada.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto bg-white px-2 pt-2 rounded-t-xl shadow-sm">
        <button 
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'USERS' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
            <Shield size={16} /> Acesso
        </button>
        <button 
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'SETTINGS' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
            <Settings size={16} /> Geral
        </button>
        <button 
            onClick={() => setActiveTab('IMPORT')}
            className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'IMPORT' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
            <UploadCloud size={16} /> Importação
        </button>
        <button 
            onClick={() => setActiveTab('TEMPLATE')}
            className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'TEMPLATE' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
            <FileText size={16} /> Editor de Termos
        </button>
        <button 
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-2 px-6 py-4 font-black uppercase text-[10px] tracking-widest border-b-4 transition-all whitespace-nowrap ${activeTab === 'LOGS' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-700'}`}
        >
            <Activity size={16} /> Auditoria Detalhada
        </button>
      </div>

      {activeTab === 'USERS' && (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                <div>
                    <h3 className="font-black text-blue-900 uppercase tracking-tighter text-lg">Controle de Acesso</h3>
                    <p className="text-sm text-blue-700 font-medium">Gerenciamento de operadores e administradores do painel.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-black uppercase text-xs tracking-widest">
                    <Plus size={18} /> Novo Usuário
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-gray-500 uppercase bg-gray-50 border-b tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Nome</th>
                            <th className="px-6 py-4">Email / Login</th>
                            <th className="px-6 py-4 text-center">Permissão</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {systemUsers.map(u => (
                            <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-gray-900">{u.name}</td>
                                <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${u.role === SystemRole.ADMIN ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleOpenModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={16}/></button>
                                        {u.id !== currentUser?.id && (
                                            <button onClick={() => deleteSystemUser(u.id, currentUser?.name || 'Admin')} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeTab === 'IMPORT' && <DataImporter />}

      {activeTab === 'SETTINGS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Settings className="text-blue-600"/> Personalização Visual
                </h3>
                <form onSubmit={handleSettingsSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Nome da Empresa</label>
                            <input type="text" value={settingsForm.appName} onChange={(e) => setSettingsForm({...settingsForm, appName: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 font-bold" placeholder="Razão Social"/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">CNPJ</label>
                            <input type="text" value={settingsForm.cnpj || ''} onChange={(e) => setSettingsForm({...settingsForm, cnpj: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 font-bold" placeholder="00.000.000/0000-00"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">URL Logotipo (PNG Recomendado)</label>
                        <input type="text" value={settingsForm.logoUrl} onChange={(e) => setSettingsForm({...settingsForm, logoUrl: e.target.value})} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50" placeholder="https://seu-site.com/logo.png"/>
                    </div>
                    
                    {settingsForm.logoUrl && (
                        <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                            <img src={settingsForm.logoUrl} alt="Preview" className="h-16 object-contain" />
                        </div>
                    )}

                    {msg && <div className="text-emerald-700 text-xs font-black uppercase bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center animate-fade-in">{msg}</div>}

                    <button type="submit" className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all active:scale-95">
                        <Save size={20} /> Salvar Configurações
                    </button>
                </form>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-fit">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <Database className="text-indigo-600"/> Fonte de Dados
                </h3>
                
                <div className={`p-6 rounded-2xl border-2 mb-8 shadow-inner ${currentMode === 'prod' ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-sm ${currentMode === 'prod' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                            {currentMode === 'prod' ? <Server size={24}/> : <FileCode size={24}/>}
                        </div>
                        <div>
                            <p className={`font-black uppercase text-xs tracking-widest ${currentMode === 'prod' ? 'text-emerald-800' : 'text-orange-800'}`}>
                                Modo: {currentMode === 'prod' ? 'PRODUÇÃO (SQL Real)' : 'MOCK (Teste Local)'}
                            </p>
                            <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
                                {currentMode === 'prod' 
                                    ? 'Conexão ativa com o SQL Server. Todos os dados são permanentes e reais.' 
                                    : 'Ambiente de testes. Dados são temporários e resetados ao recarregar a página.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <button onClick={toggleAppMode} className={`w-full py-4 px-6 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 ${currentMode === 'mock' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                        {currentMode === 'mock' ? 'Alternar para Modo SQL Server' : 'Alternar para Modo de Teste'}
                    </button>

                    <div className="pt-6 mt-6 border-t border-slate-100">
                        <button onClick={handleClearLogs} className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] text-red-600 border-2 border-red-100 hover:bg-red-50 transition-all">
                            <Trash2 size={18}/> Limpar Logs e Auditoria
                        </button>
                        <p className="text-[9px] text-red-400 font-bold text-center mt-3 uppercase tracking-tighter">* Esta ação não pode ser revertida.</p>
                    </div>
                </div>
            </div>
          </div>
      )}

      {activeTab === 'TEMPLATE' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-fade-in flex flex-col h-full min-h-[600px]">
              <div className="flex justify-between items-center mb-8 shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Editor de Documentos</h3>
                    <p className="text-sm text-gray-500 font-medium">Personalize os termos de responsabilidade jurídica.</p>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={handlePreview} className="flex items-center gap-2 bg-white border-2 border-slate-100 text-slate-600 px-6 py-3 rounded-xl hover:bg-slate-50 shadow-sm font-black uppercase text-xs tracking-widest transition-all active:scale-95">
                          <Eye size={18} /> Prévia
                      </button>
                      <button onClick={handleTermSave} className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 shadow-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95">
                          <Save size={18} /> Salvar Textos
                      </button>
                  </div>
              </div>

              <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit shadow-inner">
                  <button onClick={() => setActiveTemplateType('DELIVERY')} className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTemplateType === 'DELIVERY' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>
                      <FileText size={18}/> Termo Entrega
                  </button>
                  <button onClick={() => setActiveTemplateType('RETURN')} className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTemplateType === 'RETURN' ? 'bg-white text-orange-700 shadow-md' : 'text-slate-400 hover:bg-slate-200'}`}>
                      <ArrowLeftRight size={18}/> Termo Devolução
                  </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-t-2xl border border-slate-200 border-b-0 shadow-inner">
                  <span className="text-[10px] font-black text-slate-400 uppercase mr-3 pl-2 tracking-widest">Ferramentas:</span>
                  <button onClick={() => insertTag('<strong>', '</strong>')} className="p-2 hover:bg-white rounded-xl text-slate-700 font-bold border border-transparent hover:border-slate-200" title="Negrito"><Bold size={18}/></button>
                  <button onClick={() => insertTag('<em>', '</em>')} className="p-2 hover:bg-white rounded-xl text-slate-700 italic border border-transparent hover:border-slate-200" title="Itálico"><Italic size={18}/></button>
                  <div className="w-px h-6 bg-slate-300 mx-2"></div>
                  <button onClick={() => insertTag('<h3>', '</h3>')} className="p-2 hover:bg-white rounded-xl text-slate-700 border border-transparent hover:border-slate-200" title="Título"><Heading1 size={18}/></button>
                  <button onClick={() => insertTag('<p>', '</p>')} className="p-2 hover:bg-white rounded-xl text-slate-700 font-bold border border-transparent hover:border-slate-200" title="Parágrafo">P</button>
                  <div className="w-px h-6 bg-slate-300 mx-2"></div>
                  <button onClick={() => insertVariable('{NOME_EMPRESA}')} className="px-3 py-1.5 bg-white border-2 border-blue-100 rounded-lg text-[10px] font-black text-blue-600 hover:bg-blue-50 transition-colors">EMPRESA</button>
                  <button onClick={() => insertVariable('{CNPJ}')} className="px-3 py-1.5 bg-white border-2 border-blue-100 rounded-lg text-[10px] font-black text-blue-600 hover:bg-blue-50 transition-colors">CNPJ</button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 border border-slate-200 p-8 rounded-b-2xl shadow-sm bg-white">
                  <div className="flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-3">
                          <span className="h-6 w-6 flex items-center justify-center bg-slate-900 text-white font-black rounded-lg text-[10px]">1</span>
                          <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest">Declaração Inicial</h4>
                      </div>
                      <textarea ref={declRef} onFocus={() => setActiveField('declaration')} className={`w-full h-48 p-6 border-2 rounded-2xl focus:ring-4 outline-none text-sm resize-none transition-all leading-relaxed ${activeField === 'declaration' ? 'border-blue-400 bg-white ring-blue-50' : 'border-slate-100 bg-slate-50'}`} value={activeTemplateType === 'DELIVERY' ? termConfig.delivery.declaration : termConfig.return.declaration} onChange={(e) => updateConfig('declaration', e.target.value)} placeholder="Texto jurídico de abertura..."/>
                      
                      <div className="my-8 border-y-4 border-dotted border-slate-100 py-8 flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 rounded-2xl">
                          <List size={40} className="mb-3 opacity-20"/>
                          <span className="text-[10px] font-black uppercase tracking-[0.3em]">[ Tabela de Itens e Acessórios ]</span>
                          <span className="text-[9px] font-bold mt-2 opacity-60">GERADA AUTOMATICAMENTE PELO SISTEMA</span>
                      </div>
                  </div>

                  <div className="flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-3">
                          <span className="h-6 w-6 flex items-center justify-center bg-slate-900 text-white font-black rounded-lg text-[10px]">2</span>
                          <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest">Cláusulas e Condições</h4>
                      </div>
                      <textarea ref={clausesRef} onFocus={() => setActiveField('clauses')} className={`w-full flex-1 p-6 border-2 rounded-2xl focus:ring-4 outline-none text-sm resize-none min-h-[350px] font-mono leading-relaxed transition-all ${activeField === 'clauses' ? 'border-blue-400 bg-white ring-blue-50' : 'border-slate-100 bg-slate-50'}`} value={activeTemplateType === 'DELIVERY' ? termConfig.delivery.clauses : termConfig.return.clauses} onChange={(e) => updateConfig('clauses', e.target.value)} placeholder="Cláusulas contratuais detalhadas..."/>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'LOGS' && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex flex-col md:flex-row gap-4 mb-2">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-slate-400" size={18}/>
                    <input type="text" placeholder="Filtrar por Admin, Item, Ação ou Notas..." className="w-full pl-12 pr-6 py-3.5 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 shadow-sm font-medium text-sm" value={logSearch} onChange={e => setLogSearch(e.target.value)}/>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-3 flex items-center gap-3">
                    <Activity size={20} className="text-blue-600"/>
                    <div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Auditoria Ativa</p>
                        <p className="text-sm font-bold text-blue-900">{filteredLogs.length} eventos listados</p>
                    </div>
                </div>
             </div>

             <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-black text-slate-500 uppercase bg-slate-50 border-b tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Operador</th>
                                <th className="px-6 py-4">Ação</th>
                                <th className="px-6 py-4">Item Afetado</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLogs.slice(0, 100).map(log => {
                                const hasDiff = log.previousData || log.newData;
                                return (
                                    <tr key={log.id} className="hover:bg-blue-50/20 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-[11px] font-mono font-bold text-slate-400">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 border border-slate-200">{log.adminUser.charAt(0)}</div>
                                                <span className="font-bold text-slate-800">{log.adminUser}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border 
                                                ${log.action === ActionType.create ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                                  log.action === ActionType.DELETE ? 'bg-red-50 text-red-700 border-red-100' : 
                                                  log.action === ActionType.RESTORE ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                  log.action === ActionType.UPDATE ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">[{log.assetType}]</span>
                                                <span className="font-bold text-slate-700 text-xs truncate max-w-[150px]">{log.targetName || log.assetId}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {hasDiff ? (
                                                <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-blue-100 shadow-sm animate-pulse">
                                                    <Info size={12}/> Detalhado
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-[10px] font-bold uppercase italic">Básico</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                {hasDiff && (
                                                    <button onClick={() => setSelectedLog(log)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white border-2 border-blue-100 text-blue-600 px-3 py-1.5 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                                                        <Search size={14}/> Ver Alteração
                                                    </button>
                                                )}
                                                {log.action === ActionType.DELETE && log.backupData && (
                                                    <button onClick={() => handleRestore(log.id)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100" title="Restaurar item excluído">
                                                        <RotateCcw size={14}/> Restaurar
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
             </div>
          </div>
      )}

      {/* --- MODAL FOR LOG DETAILS --- */}
      {selectedLog && <AuditDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {/* --- MODAL FOR USER EDIT --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-blue-100">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center border-b border-white/10">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? 'Editar Usuário' : 'Novo Usuário de Sistema'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Nome Completo</label>
                <input required type="text" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 font-bold" value={userForm.name || ''} onChange={e => setUserForm({...userForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">E-mail (Login)</label>
                <input required type="email" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50" value={userForm.email || ''} onChange={e => setUserForm({...userForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Senha {editingId && '(Vazio para manter)'}</label>
                <input type="password" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 font-mono" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!editingId}/>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 ml-1 tracking-widest">Nível de Permissão</label>
                <select className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-blue-500 outline-none bg-slate-50 font-bold" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as SystemRole})}>
                    <option value={SystemRole.OPERATOR}>Operador (Gestão diária)</option>
                    <option value={SystemRole.ADMIN}>Administrador (Controle Total)</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all">Cancelar</button>
                <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95">Salvar Acesso</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
