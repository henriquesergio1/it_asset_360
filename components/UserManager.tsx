import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link, User as UserIcon, Upload, CheckCircle } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

const UserManager = () => {
  const { 
    users, addUser, updateUser, toggleUserActive, 
    sectors, addSector, deleteSector,
    devices, sims, models, brands, assetTypes, getHistory, settings 
  } = useData();
  const { user: currentUser } = useAuth();
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'TERMS' | 'LOGS'>('DATA');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });
  
  // Sector Management State
  const [newSectorName, setNewSectorName] = useState('');

  const adminName = currentUser?.name || 'Unknown';

  // --- Helpers ---
  const handleOpenModal = (user?: User) => {
    setActiveTab('DATA');
    if (user) {
      setEditingId(user.id);
      setFormData(user);
    } else {
      setEditingId(null);
      setFormData({ active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // --- VALIDAÇÃO DE UNICIDADE (CPF E EMAIL) ---
    const cleanEmail = formData.email?.trim().toLowerCase();
    const cleanCpf = formData.cpf?.trim();

    if (cleanEmail) {
        // Procura usuário com mesmo email, excluindo o usuário atual (em caso de edição)
        const emailConflict = users.find(u => 
            u.email.toLowerCase() === cleanEmail && 
            u.id !== editingId
        );

        if (emailConflict) {
            alert(`ERRO: O E-mail "${formData.email}" já está cadastrado para o colaborador: ${emailConflict.fullName}.`);
            return;
        }
    }

    if (cleanCpf) {
        // Procura usuário com mesmo CPF, excluindo o usuário atual
        const cpfConflict = users.find(u => 
            u.cpf === cleanCpf && 
            u.id !== editingId
        );

        if (cpfConflict) {
            alert(`ERRO: O CPF "${formData.cpf}" já está cadastrado para o colaborador: ${cpfConflict.fullName}.`);
            return;
        }
    }
    // ---------------------------------------------

    if (editingId && formData.id) {
      updateUser(formData as User, adminName);
    } else {
      addUser({ ...formData, id: Math.random().toString(36).substr(2, 9), terms: [] } as User, adminName);
    }
    setIsModalOpen(false);
  };

  const handleToggleActive = (user: User) => {
      // Check for assigned assets
      const assignedDevices = devices.filter(d => d.currentUserId === user.id);
      const assignedSims = sims.filter(s => s.currentUserId === user.id);
      
      if (user.active && (assignedDevices.length > 0 || assignedSims.length > 0)) {
          alert(`NÃO É POSSÍVEL INATIVAR!\n\nO colaborador ${user.fullName} possui ${assignedDevices.length} dispositivo(s) e ${assignedSims.length} chip(s) vinculados.\n\nRealize a devolução dos equipamentos antes de inativar o cadastro.`);
          return;
      }

      const action = user.active ? 'inativar' : 'ativar';
      if (window.confirm(`Tem certeza que deseja ${action} o colaborador ${user.fullName}?`)) {
          toggleUserActive(user, adminName);
      }
  };

  const handleAddSector = () => {
      if(newSectorName.trim()) {
          addSector({ id: Math.random().toString(36).substr(2, 9), name: newSectorName }, adminName);
          setNewSectorName('');
      }
  };

  const handlePrintTerm = (asset: Device | SimCard, type: 'Device' | 'Sim') => {
      if (!editingId) return;
      const user = users.find(u => u.id === editingId);
      if (!user) return;

      let model, brand, assetType;
      let linkedSim: SimCard | undefined;
      
      if (type === 'Device') {
          const d = asset as Device;
          model = models.find(m => m.id === d.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          assetType = assetTypes.find(t => t.id === model?.typeId);

           // Check for linked SIM
          if (d.linkedSimId) {
              linkedSim = sims.find(s => s.id === d.linkedSimId);
          }
      }

      const sectorName = sectors.find(s => s.id === user.sectorId)?.name;

      generateAndPrintTerm({
          user,
          asset,
          settings,
          model,
          brand,
          type: assetType,
          actionType: 'ENTREGA', // Re-issuing implies printing the delivery term
          linkedSim,
          sectorName
      });
  };

  // Logic to reprint a historic term based on minimal data
  const handleReprintHistoricTerm = (term: Term) => {
      if (!editingId) return;
      const user = users.find(u => u.id === editingId);
      if (!user) return;

      // Create a "Ghost" Asset based on term description for printing purposes
      // This is a simplification. In a real app we might try to find the original asset ID if stored.
      // Since Term interface has assetDetails string like "Latitude 5420 (Tag: TI-001)", we pass this.
      
      // We pass a dummy object that looks like a Device/Sim just enough for the generator
      // Actually, termGenerator expects a Device or Sim object. 
      // We will create a fake object and pass the term description as the 'model name' effectively.
      const ghostAsset: any = {
          assetTag: 'N/A', // Assuming details are in the name
          serialNumber: 'N/A'
      };

      const sectorName = sectors.find(s => s.id === user.sectorId)?.name;

      // We modify the generator slightly or we abuse the props.
      // Better: Update generator to accept manual override OR just pass the string as the Model Name.
      // Let's pass a mock model.
      
      const mockModel: any = { name: term.assetDetails }; 
      
      generateAndPrintTerm({
          user,
          asset: ghostAsset,
          settings,
          model: mockModel,
          actionType: term.type,
          sectorName
      });
  };

  const handleAttachFile = (termId: string, file: File) => {
      // In a real app, upload via API. Here we update local state (Mock or Prod Context handles it).
      // We'll assume the context handles User updates.
      if (!editingId) return;
      
      const user = users.find(u => u.id === editingId);
      if (!user || !user.terms) return;

      const updatedTerms = user.terms.map(t => 
          t.id === termId ? { ...t, fileUrl: URL.createObjectURL(file) } : t
      );

      updateUser({ ...user, terms: updatedTerms }, adminName);
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.cpf.includes(searchTerm)
  );

  // Data for tabs
  const userAssets = editingId ? devices.filter(d => d.currentUserId === editingId) : [];
  const userSims = editingId ? sims.filter(s => s.currentUserId === editingId) : [];
  const userHistory = editingId ? getHistory(editingId) : [];
  const userTerms = editingId ? users.find(u => u.id === editingId)?.terms || [] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 text-sm">Cadastro de funcionários e gestão de termos.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsSectorModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50">
                <Settings size={18} /> Setores
            </button>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm">
                <Plus size={18} /> Novo Usuário
            </button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input 
          type="text" 
          placeholder="Buscar por nome, email ou CPF..." 
          className="pl-10 w-full sm:w-96 border border-gray-300 rounded-lg py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Nome / Cargo</th>
                <th className="px-6 py-3">Setor</th>
                <th className="px-6 py-3">Contato / CPF</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const sectorName = sectors.find(s => s.id === user.sectorId)?.name || 'Sem Setor';
                // Check for pending terms
                const hasPending = user.terms?.some(t => !t.fileUrl);

                return (
                  <tr key={user.id} className={`border-b hover:bg-gray-50 transition-colors ${!user.active ? 'bg-gray-50 opacity-75' : 'bg-white'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 relative ${user.active ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>
                             {user.fullName.charAt(0)}
                             {hasPending && (
                                 <span className="absolute -top-1 -right-1 h-3 w-3 bg-orange-500 rounded-full border-2 border-white" title="Termos Pendentes"></span>
                             )}
                         </div>
                         <div>
                             <div className={`font-bold ${user.active ? 'text-gray-900' : 'text-gray-500'}`}>{user.fullName}</div>
                             <div className="text-xs text-gray-400">{user.jobTitle}</div>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium">
                            {sectorName}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="flex items-center gap-1"><Mail size={12}/> {user.email}</span>
                            <span className="text-xs text-gray-400">CPF: {user.cpf}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        {user.active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                <span className="h-2 w-2 rounded-full bg-green-500"></span> Ativo
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                Inativo
                            </span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                             <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors" title="Editar / Detalhes">
                                 <Edit2 size={16} />
                             </button>
                             <button 
                                onClick={() => handleToggleActive(user)} 
                                className={`p-1 rounded transition-colors ${user.active ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`} 
                                title={user.active ? 'Inativar Usuário' : 'Reativar Usuário'}
                             >
                                 <Power size={16} />
                             </button>
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
              <div className="p-8 text-center text-gray-400">Nenhum colaborador encontrado.</div>
          )}
        </div>
      </div>

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Colaborador' : 'Novo Colaborador'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b shrink-0 overflow-x-auto bg-gray-50">
                <button onClick={() => setActiveTab('DATA')} className={`flex-1 min-w-[120px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Dados Cadastrais</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`flex-1 min-w-[120px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Dispositivos ({userAssets.length + userSims.length})</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`flex-1 min-w-[120px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Termos ({userTerms.length})</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`flex-1 min-w-[120px] py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>Histórico</button>
                    </>
                )}
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
                {/* TAB: DATA */}
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                          <input required type="text" className="w-full border rounded-lg p-2" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                          <input required type="email" className="w-full border rounded-lg p-2" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                          <input required type="text" className="w-full border rounded-lg p-2" value={formData.jobTitle || ''} onChange={e => setFormData({...formData, jobTitle: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                          <select className="w-full border rounded-lg p-2" value={formData.sectorId || ''} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                             <option value="">Selecione...</option>
                             {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                          <input required type="text" className="w-full border rounded-lg p-2" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                        </div>
                         <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                          <input required type="text" className="w-full border rounded-lg p-2" value={formData.rg || ''} onChange={e => setFormData({...formData, rg: e.target.value})} />
                        </div>
                         <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">PIS (Opcional)</label>
                          <input type="text" className="w-full border rounded-lg p-2" value={formData.pis || ''} onChange={e => setFormData({...formData, pis: e.target.value})} />
                        </div>
                         <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                          <input type="text" className="w-full border rounded-lg p-2" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                        </div>
                      </div>
                    </form>
                )}

                {/* TAB: ASSETS */}
                {activeTab === 'ASSETS' && (
                    <div className="space-y-4">
                        <h4 className="font-bold text-gray-800">Equipamentos Vinculados Atualmente</h4>
                        
                        {userAssets.length === 0 && userSims.length === 0 && (
                            <p className="text-gray-400 text-center py-4">Nenhum ativo vinculado a este colaborador.</p>
                        )}

                        {userAssets.map(dev => {
                            const model = models.find(m => m.id === dev.modelId);
                            return (
                                <div key={dev.id} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                    <Smartphone className="text-blue-600" size={20}/>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800">{model?.name || 'Desconhecido'}</p>
                                        <p className="text-xs text-gray-500">Patrimônio: {dev.assetTag} | Serial: {dev.serialNumber}</p>
                                    </div>
                                    <button onClick={() => handlePrintTerm(dev, 'Device')} className="flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-700 px-2 py-1 rounded hover:bg-blue-50">
                                        <Printer size={14}/> Termo
                                    </button>
                                </div>
                            )
                        })}

                        {userSims.map(sim => {
                            // Verifica se este chip está vinculado a algum dispositivo
                            const parentDevice = devices.find(d => d.linkedSimId === sim.id);
                            const parentModel = parentDevice ? models.find(m => m.id === parentDevice.modelId) : null;
                            
                            return (
                                <div key={sim.id} className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                    <div className="text-indigo-600 font-bold text-xs border border-indigo-200 bg-white rounded p-1">SIM</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-gray-800">{sim.phoneNumber}</p>
                                            {parentDevice && (
                                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full flex items-center gap-1" title={`Vinculado ao ${parentModel?.name || 'Dispositivo'}`}>
                                                    <Link size={8}/> Vinculado
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">Operadora: {sim.operator} | ICCID: {sim.iccid}</p>
                                    </div>
                                    
                                    {parentDevice ? (
                                        <span className="text-xs text-gray-400 italic px-2">
                                            Use o termo do dispositivo
                                        </span>
                                    ) : (
                                        <button onClick={() => handlePrintTerm(sim, 'Sim')} className="flex items-center gap-1 text-xs bg-white border border-indigo-200 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50">
                                            <Printer size={14}/> Termo
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* TAB: TERMS */}
                {activeTab === 'TERMS' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-gray-800">Termos de Responsabilidade</h4>
                            <span className="text-xs text-gray-500">Histórico de Entrega/Devolução</span>
                        </div>
                        
                        <div className="space-y-2">
                            {userTerms.slice().reverse().map(term => {
                                const isPending = !term.fileUrl;
                                return (
                                <div key={term.id} className={`flex items-center justify-between p-3 border rounded-lg hover:shadow-sm ${isPending ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${term.type === 'ENTREGA' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-800 flex items-center gap-2">
                                                Termo de {term.type === 'ENTREGA' ? 'Entrega' : 'Devolução'}
                                                {isPending && <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold">PENDENTE</span>}
                                            </p>
                                            <p className="text-xs text-gray-500">{new Date(term.date).toLocaleString()} • {term.assetDetails}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Reprint Button */}
                                        <button onClick={() => handleReprintHistoricTerm(term)} className="flex items-center gap-1 text-xs bg-white border border-gray-300 text-gray-700 px-2 py-1.5 rounded hover:bg-gray-50" title="Reimprimir Documento">
                                            <Printer size={14}/>
                                        </button>

                                        {/* View/Upload Action */}
                                        {isPending ? (
                                            <label className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 cursor-pointer">
                                                <Upload size={14}/> Anexar
                                                <input type="file" className="hidden" accept=".pdf,.png,.jpg" onChange={(e) => e.target.files?.[0] && handleAttachFile(term.id, e.target.files[0])} />
                                            </label>
                                        ) : (
                                            <a href={term.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-2">
                                                <CheckCircle size={14} className="text-green-500"/> Visualizar
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )})}
                            {userTerms.length === 0 && (
                                <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                    Nenhum termo gerado para este colaborador.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: LOGS */}
                {activeTab === 'LOGS' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <History size={20} className="text-emerald-600" />
                            <h4 className="font-bold text-gray-800">Linha do Tempo do Colaborador</h4>
                        </div>
                        
                        <div className="relative border-l-2 border-gray-200 ml-3 space-y-8">
                            {userHistory.map((log) => (
                                <div key={log.id} className="relative pl-6">
                                    <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white
                                        ${log.action === ActionType.CHECKOUT ? 'bg-blue-500' : 
                                          log.action === ActionType.CHECKIN ? 'bg-green-500' :
                                          log.action === ActionType.INACTIVATE ? 'bg-red-500' :
                                          'bg-gray-400'
                                        }`}></div>
                                    
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                        <div>
                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                            <h5 className="font-bold text-gray-900 mt-1">{log.action}</h5>
                                            <p className="text-sm text-gray-600 mt-1">{log.notes || 'Sem observações.'}</p>
                                        </div>
                                        <div className="text-xs text-right bg-gray-50 px-2 py-1 rounded border self-start">
                                            <span className="text-gray-400 block">Admin</span>
                                            <span className="font-medium text-gray-700">{log.adminUser}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {userHistory.length === 0 && (
                                <p className="text-gray-400 text-sm pl-6">Nenhum histórico registrado.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">Fechar</button>
                {activeTab === 'DATA' && (
                    <button type="submit" form="userForm" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                        {editingId ? 'Salvar Alterações' : 'Cadastrar'}
                    </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Sector Modal */}
      {isSectorModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Gerenciar Setores</h3>
                    <button onClick={() => setIsSectorModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6">
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            className="flex-1 border rounded-lg p-2" 
                            placeholder="Nome do Setor"
                            value={newSectorName}
                            onChange={(e) => setNewSectorName(e.target.value)}
                        />
                        <button onClick={handleAddSector} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700"><Plus/></button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {sectors.map(s => (
                            <div key={s.id} className="flex justify-between items-center p-3 bg-gray-50 border rounded-lg">
                                <span>{s.name}</span>
                                <button onClick={() => deleteSector(s.id, adminName)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default UserManager;