
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SystemUser, SystemRole, ActionType } from '../types';
import { Shield, Settings, Activity, Trash2, Plus, X, Edit2, Save, Database, Server, FileCode, FileText, Bold, Italic, Heading1, List, Eye, ArrowLeftRight, UploadCloud, Info, AlertTriangle, RotateCcw } from 'lucide-react';
import DataImporter from './DataImporter';
import { generateAndPrintTerm } from '../utils/termGenerator';

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

  // --- PREVIEW HANDLER ---
  const handlePreview = () => {
      // 1. Create temporary settings with current text (even if not saved)
      const tempSettings = {
          ...settingsForm,
          termTemplate: JSON.stringify(termConfig)
      };

      // 2. Mock Data
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

      // 3. Generate
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

  // --- RICH TEXT HELPERS ---
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
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Administração do Sistema</h1>
        <p className="text-gray-500 text-sm">Gerencie acessos, configurações e auditoria.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button 
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'USERS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Shield size={18} /> Acesso
        </button>
        <button 
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'SETTINGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Settings size={18} /> Geral
        </button>
        <button 
            onClick={() => setActiveTab('IMPORT')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'IMPORT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <UploadCloud size={18} /> Importação
        </button>
        <button 
            onClick={() => setActiveTab('TEMPLATE')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'TEMPLATE' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <FileText size={18} /> Editor de Termos
        </button>
        <button 
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'LOGS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
            <Activity size={18} /> Auditoria
        </button>
      </div>

      {/* --- USERS TAB --- */}
      {activeTab === 'USERS' && (
        <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div>
                    <h3 className="font-bold text-blue-900">Controle de Acesso</h3>
                    <p className="text-sm text-blue-700">Cadastre quem pode acessar este painel.</p>
                </div>
                <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm text-sm">
                    <Plus size={16} /> Novo Usuário
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th className="px-6 py-3">Nome</th>
                            <th className="px-6 py-3">Email (Login)</th>
                            <th className="px-6 py-3">Função</th>
                            <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {systemUsers.map(u => (
                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                                <td className="px-6 py-4">{u.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === SystemRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleOpenModal(u)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={16}/></button>
                                        {u.id !== currentUser?.id && (
                                            <button onClick={() => deleteSystemUser(u.id, currentUser?.name || 'Admin')} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
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

      {/* --- IMPORT TAB (NEW) --- */}
      {activeTab === 'IMPORT' && (
          <DataImporter />
      )}

      {/* --- SETTINGS TAB --- */}
      {activeTab === 'SETTINGS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* Visual Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Personalização Visual</h3>
                <form onSubmit={handleSettingsSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa / Razão Social</label>
                            <input 
                                type="text" 
                                value={settingsForm.appName}
                                onChange={(e) => setSettingsForm({...settingsForm, appName: e.target.value})}
                                className="w-full border rounded-lg p-2.5"
                                placeholder="Minha Empresa S.A."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ da Empresa</label>
                            <input 
                                type="text" 
                                value={settingsForm.cnpj || ''}
                                onChange={(e) => setSettingsForm({...settingsForm, cnpj: e.target.value})}
                                className="w-full border rounded-lg p-2.5"
                                placeholder="00.000.000/0000-00"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">URL da Logo (Cabeçalho e Termos)</label>
                        <input 
                            type="text" 
                            value={settingsForm.logoUrl}
                            onChange={(e) => setSettingsForm({...settingsForm, logoUrl: e.target.value})}
                            className="w-full border rounded-lg p-2.5"
                            placeholder="https://..."
                        />
                        <p className="text-xs text-gray-400 mt-1">Recomendado: Imagem PNG transparente.</p>
                    </div>
                    
                    {settingsForm.logoUrl && (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center">
                            <img src={settingsForm.logoUrl} alt="Preview" className="h-12 object-contain" />
                        </div>
                    )}

                    {msg && <div className="text-green-600 text-sm font-medium bg-green-50 p-3 rounded">{msg}</div>}

                    <button type="submit" className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 font-medium">
                        <Save size={18} /> Salvar Alterações
                    </button>
                </form>
            </div>

            {/* Data Source Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Database size={20} className="text-blue-600"/> Fonte de Dados & Manutenção
                </h3>
                
                <div className={`p-4 rounded-lg border mb-6 ${currentMode === 'prod' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                    <div className="flex items-start gap-3">
                        {currentMode === 'prod' ? <Server className="text-green-600 mt-1" /> : <FileCode className="text-orange-600 mt-1" />}
                        <div>
                            <p className={`font-bold ${currentMode === 'prod' ? 'text-green-800' : 'text-orange-800'}`}>
                                {currentMode === 'prod' ? 'Modo: PRODUÇÃO (Real)' : 'Modo: DESENVOLVIMENTO (Mock)'}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                                {currentMode === 'prod' 
                                    ? 'O sistema está conectado à API Backend e gravando no SQL Server.' 
                                    : 'O sistema está usando dados temporários em memória. As alterações serão perdidas ao recarregar.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                    <button 
                        onClick={toggleAppMode}
                        className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-colors ${currentMode === 'mock' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                    >
                        {currentMode === 'mock' ? 'Mudar para Modo REAL (SQL Server)' : 'Mudar para Modo MOCK (Teste)'}
                    </button>

                    <div className="pt-4 border-t">
                        <button 
                            onClick={handleClearLogs}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={18}/> Limpar Logs e Auditoria
                        </button>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* --- TEMPLATE TAB (STRUCTURED EDITOR) --- */}
      {activeTab === 'TEMPLATE' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in flex flex-col h-full min-h-[600px]">
              <div className="flex justify-between items-center mb-6 shrink-0">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Editor de Documentos</h3>
                    <p className="text-sm text-gray-500">Personalize o texto jurídico dos termos. Use a barra de ferramentas para formatação.</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={handlePreview} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 shadow-sm font-medium transition-colors">
                          <Eye size={18} /> Visualizar Exemplo
                      </button>
                      <button onClick={handleTermSave} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 shadow-sm font-medium transition-colors">
                          <Save size={18} /> Salvar Textos
                      </button>
                  </div>
              </div>

              {/* Template Switcher */}
              <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
                  <button 
                    onClick={() => setActiveTemplateType('DELIVERY')}
                    className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTemplateType === 'DELIVERY' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      <FileText size={16}/> Termo de Entrega
                  </button>
                  <button 
                    onClick={() => setActiveTemplateType('RETURN')}
                    className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTemplateType === 'RETURN' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      <ArrowLeftRight size={16}/> Termo de Devolução
                  </button>
              </div>

              {/* TOOLBAR */}
              <div className="flex flex-wrap items-center gap-2 bg-gray-100 p-2 rounded-t-lg border-b border-gray-300">
                  <span className="text-xs font-bold text-gray-500 uppercase mr-2 pl-2">Formatação:</span>
                  <button onClick={() => insertTag('<strong>', '</strong>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-bold" title="Negrito"><Bold size={16}/></button>
                  <button onClick={() => insertTag('<em>', '</em>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 italic" title="Itálico"><Italic size={16}/></button>
                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                  <button onClick={() => insertTag('<h3>', '</h3>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Título da Seção"><Heading1 size={16}/></button>
                  <button onClick={() => insertTag('<p>', '</p>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-serif text-xs font-bold" title="Parágrafo">¶</button>
                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                  <button onClick={() => insertTag('<br>', '')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700 text-xs font-bold" title="Quebra de Linha">BR</button>
                  <button onClick={() => insertTag('<ul><li>', '</li></ul>')} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Lista"><List size={16}/></button>
                  
                  <div className="flex-1"></div>
                  <span className="text-xs font-bold text-gray-500 uppercase mr-2">Variáveis:</span>
                  <button onClick={() => insertVariable('{NOME_EMPRESA}')} className="px-2 py-1 bg-white border rounded text-xs hover:bg-blue-50 text-blue-700">Empresa</button>
                  <button onClick={() => insertVariable('{CNPJ}')} className="px-2 py-1 bg-white border rounded text-xs hover:bg-blue-50 text-blue-700">CNPJ</button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 border border-t-0 p-6 rounded-b-lg border-gray-300">
                  
                  {/* Left Column: Declaration */}
                  <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded text-xs">1</span>
                          <h4 className="font-bold text-gray-700">Declaração Inicial (Topo)</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                          Este texto aparece logo após os dados do colaborador. Clique na caixa para ativar a barra de ferramentas.
                      </p>
                      <textarea 
                          ref={declRef}
                          onFocus={() => setActiveField('declaration')}
                          className={`w-full h-40 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none ${activeField === 'declaration' ? 'border-blue-400 bg-white' : 'border-gray-300 bg-gray-50'}`}
                          value={activeTemplateType === 'DELIVERY' ? termConfig.delivery.declaration : termConfig.return.declaration}
                          onChange={(e) => updateConfig('declaration', e.target.value)}
                          placeholder="Digite o texto de declaração aqui..."
                      />
                      
                      {/* Visual Placeholder for Assets Table */}
                      <div className="my-6 border-y-2 border-dashed border-gray-200 py-6 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded">
                          <List size={32} className="mb-2 opacity-20"/>
                          <span className="text-xs font-bold uppercase tracking-wider">[ Área Fixa: Tabela de Ativos e Acessórios ]</span>
                          <span className="text-[10px]">Gerada automaticamente pelo sistema</span>
                      </div>
                  </div>

                  {/* Right Column: Clauses */}
                  <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded text-xs">2</span>
                          <h4 className="font-bold text-gray-700">Cláusulas e Condições (Base)</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                          Use <strong>&lt;h3&gt;</strong> para títulos e <strong>&lt;strong&gt;</strong> para negrito.
                      </p>
                      <textarea 
                          ref={clausesRef}
                          onFocus={() => setActiveField('clauses')}
                          className={`w-full flex-1 p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none min-h-[300px] font-mono leading-relaxed ${activeField === 'clauses' ? 'border-blue-400 bg-white' : 'border-gray-300 bg-gray-50'}`}
                          value={activeTemplateType === 'DELIVERY' ? termConfig.delivery.clauses : termConfig.return.clauses}
                          onChange={(e) => updateConfig('clauses', e.target.value)}
                          placeholder="Digite as cláusulas contratuais aqui..."
                      />
                  </div>

              </div>

              {msg && <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-lg text-center font-bold text-sm animate-fade-in">{msg}</div>}
          </div>
      )}

      {/* --- LOGS TAB --- */}
      {activeTab === 'LOGS' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
             <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">Histórico Completo de Alterações</h3>
                 <span className="text-xs text-gray-500">Últimos 100 registros</span>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th className="px-6 py-3">Data/Hora</th>
                            <th className="px-6 py-3">Usuário (Admin)</th>
                            <th className="px-6 py-3">Ação</th>
                            <th className="px-6 py-3">Item Afetado</th>
                            <th className="px-6 py-3">Detalhes</th>
                            <th className="px-6 py-3">Opções</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.slice(0, 100).map(log => (
                            <tr key={log.id} className="border-b hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                <td className="px-6 py-4 font-medium text-gray-900">{log.adminUser}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${log.action === ActionType.create ? 'bg-green-100 text-green-700' : 
                                          log.action === ActionType.DELETE ? 'bg-red-100 text-red-700' : 
                                          log.action === ActionType.RESTORE ? 'bg-indigo-100 text-indigo-700' :
                                          log.action === ActionType.UPDATE ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-gray-400 text-xs mr-1">[{log.assetType}]</span>
                                    {log.targetName || log.assetId}
                                </td>
                                <td className="px-6 py-4 text-gray-500 truncate max-w-xs" title={log.notes}>{log.notes || '-'}</td>
                                <td className="px-6 py-4">
                                    {log.action === ActionType.DELETE && log.backupData && (
                                        <button 
                                            onClick={() => handleRestore(log.id)}
                                            className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 border border-indigo-200"
                                            title="Restaurar este item excluído"
                                        >
                                            <RotateCcw size={12}/> Restaurar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
          </div>
      )}

      {/* --- MODAL FOR USER EDIT --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Usuário' : 'Novo Usuário de Sistema'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input required type="text" className="w-full border rounded-lg p-2" value={userForm.name || ''} onChange={e => setUserForm({...userForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Login)</label>
                <input required type="email" className="w-full border rounded-lg p-2" value={userForm.email || ''} onChange={e => setUserForm({...userForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha {editingId && '(Deixe em branco para manter)'}</label>
                <input 
                    type="password" 
                    className="w-full border rounded-lg p-2" 
                    value={userForm.password || ''} 
                    onChange={e => setUserForm({...userForm, password: e.target.value})} 
                    required={!editingId}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permissão</label>
                <select className="w-full border rounded-lg p-2" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as SystemRole})}>
                    <option value={SystemRole.OPERATOR}>Operador (Visualizar/Entregar)</option>
                    <option value={SystemRole.ADMIN}>Administrador (Total)</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
