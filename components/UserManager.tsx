
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { User, UserSector, ActionType, Device, SimCard, Term } from '../types';
import { Plus, Search, Edit2, Trash2, Mail, MapPin, Briefcase, Power, Settings, X, Smartphone, FileText, History, ExternalLink, AlertTriangle, Printer, Link as LinkIcon, User as UserIcon, Upload, CheckCircle, Filter, Users, Archive, Tag, ChevronRight, Cpu, Hash, CreditCard, Fingerprint, UserCheck, UserX, FileWarning } from 'lucide-react';
import { generateAndPrintTerm } from '../utils/termGenerator';

const LogNoteRenderer = ({ note }: { note: string }) => {
    const { devices, sims } = useData();
    const navigate = useNavigate();
    const assetPattern = /(Recebeu|Devolveu):\s+([^\.]+)/i;
    const match = note.match(assetPattern);
    if (!match) return <span>{note}</span>;
    const action = match[1];
    const assetString = match[2].trim();
    const restOfNote = note.substring(match[0].length);
    let targetLink = null;
    const foundDevice = devices.find(d => assetString.includes(d.assetTag) || (d.imei && assetString.includes(d.imei)));
    if (foundDevice) {
        targetLink = (
            <span onClick={() => navigate(`/devices?deviceId=${foundDevice.id}`)} className="text-blue-600 hover:underline font-bold cursor-pointer hover:bg-blue-50 px-1 rounded">
                {assetString}
            </span>
        );
    } else {
        const foundSim = sims.find(s => assetString.includes(s.phoneNumber));
        if (foundSim) {
            targetLink = (
                <span onClick={() => navigate(`/sims`)} className="text-indigo-600 hover:underline font-bold cursor-pointer hover:bg-indigo-50 px-1 rounded">
                    {assetString}
                </span>
            );
        }
    }
    return (<span>{action}: {targetLink || <span className="font-bold">{assetString}</span>}{restOfNote}</span>);
};

const UserManager = () => {
  const { users, addUser, updateUser, toggleUserActive, sectors, addSector, devices, sims, models, brands, assetTypes, getHistory, settings, updateTermFile, deleteTermFile } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE'); 
  const [filterSectorId, setFilterSectorId] = useState(''); 
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false); 
  const [isSectorModalOpen, setIsSectorModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'DATA' | 'ASSETS' | 'TERMS' | 'LOGS'>('DATA');
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [deactivateReasonType, setDeactivateReasonType] = useState('');
  const [deactivateReasonNote, setDeactivateReasonNote] = useState('');
  const [isDeleteTermModalOpen, setIsDeleteTermModalOpen] = useState(false);
  const [deleteTermTarget, setDeleteTermTarget] = useState<{termId: string, userId: string} | null>(null);
  const [deleteTermReason, setDeleteTermReason] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ active: true });

  useEffect(() => {
      const params = new URLSearchParams(location.search);
      const userId = params.get('userId');
      if (userId) {
          const user = users.find(u => u.id === userId);
          if (user) { handleOpenModal(user, true); navigate('/users', { replace: true }); }
      }
  }, [location, users]);

  const adminName = currentUser?.name || 'Unknown';

  const handleOpenModal = (user?: User, viewOnly: boolean = false) => {
    setActiveTab('DATA');
    setIsViewOnly(viewOnly);
    if (user) { setEditingId(user.id); setFormData(user); }
    else { setEditingId(null); setFormData({ active: true }); }
    setIsModalOpen(true);
  };

  const handleTermUpload = (termId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editingId) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          const fileUrl = reader.result as string;
          updateTermFile(termId, editingId, fileUrl, adminName);
      };
      reader.readAsDataURL(file);
  };

  const handleReprintTerm = (term: Term) => {
      const user = users.find(u => u.id === term.userId);
      if (!user) return;
      let asset: any = devices.find(d => term.assetDetails.includes(d.assetTag) || (d.imei && term.assetDetails.includes(d.imei)));
      if (!asset) asset = sims.find(s => term.assetDetails.includes(s.phoneNumber));
      if (!asset) { alert("Ativo não localizado no estoque para re-impressão."); return; }

      let model, brand, type, linkedSim;
      if ('serialNumber' in asset) {
          model = models.find(m => m.id === asset.modelId);
          brand = brands.find(b => b.id === model?.brandId);
          type = assetTypes.find(t => t.id === model?.typeId);
          if (asset.linkedSimId) linkedSim = sims.find(s => s.id === asset.linkedSimId);
      }

      generateAndPrintTerm({
          user, asset, settings, model, brand, type, linkedSim,
          actionType: term.type as 'ENTREGA' | 'DEVOLUCAO',
          sectorName: sectors.find(s => s.id === user.sectorId)?.name,
          notes: 'Re-impressão solicitada via painel do colaborador.'
      });
  };

  const handleOpenFile = (fileUrl: string) => {
      if (fileUrl.startsWith('data:')) {
          fetch(fileUrl).then(res => res.blob()).then(blob => {
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
          }).catch(() => alert("Erro ao abrir arquivo."));
      } else { window.open(fileUrl, '_blank'); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (editingId && formData.id) updateUser(formData as User, adminName);
    else addUser({ ...formData, id: Math.random().toString(36).substr(2, 9), terms: [] } as User, adminName);
    setIsModalOpen(false);
  };

  const handleToggleClick = (user: User) => {
      if (!user.active) { if (window.confirm(`Reativar ${user.fullName}?`)) toggleUserActive(user, adminName, 'Reativação'); return; }
      const hasAssets = devices.some(d => d.currentUserId === user.id) || sims.some(s => s.currentUserId === user.id);
      if (hasAssets) return alert("Não é possível inativar com ativos em posse.");
      setDeactivateTarget(user); setDeactivateReasonType(''); setIsDeactivateModalOpen(true);
  };

  const filteredUsers = users.filter(u => {
    if (viewMode === 'ACTIVE' ? !u.active : u.active) return false;
    if (showPendingOnly && !(u.terms || []).some(t => !t.fileUrl)) return false;
    if (filterSectorId && u.sectorId !== filterSectorId) return false;
    return `${u.fullName} ${u.cpf}`.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Colaboradores</h1>
          <p className="text-gray-500 text-sm">Gestão de vínculos e termos de responsabilidade.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setIsSectorModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm hover:bg-gray-50"><Briefcase size={18} /> Cargos</button>
            <button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-bold"><Plus size={18} /> Novo</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input type="text" placeholder="Nome ou CPF..." className="pl-10 w-full border rounded-lg py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => setShowPendingOnly(!showPendingOnly)} className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-xs font-bold uppercase transition-all ${showPendingOnly ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white text-gray-500'}`}>
            <FileWarning size={16}/> {showPendingOnly ? 'Exibindo Pendências' : 'Filtrar Pendências'}
        </button>
        <div className="flex bg-gray-200 p-1 rounded-lg">
            <button onClick={() => setViewMode('ACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase ${viewMode === 'ACTIVE' ? 'bg-white text-emerald-700' : 'text-gray-500'}`}>Ativos</button>
            <button onClick={() => setViewMode('INACTIVE')} className={`px-6 py-1.5 rounded-md text-xs font-black uppercase ${viewMode === 'INACTIVE' ? 'bg-white text-gray-700' : 'text-gray-500'}`}>Inativos</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500 border-b">
            <tr>
              <th className="px-6 py-4">Colaborador</th>
              <th className="px-6 py-4">Ativos em Posse</th>
              <th className="px-6 py-4">Cargo / Função</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => {
              const userDevices = devices.filter(d => d.currentUserId === user.id);
              const userSims = sims.filter(s => s.currentUserId === user.id);
              const hasPending = (user.terms || []).some(t => !t.fileUrl);
              return (
                <tr key={user.id} className={`border-b hover:bg-gray-50 ${!user.active ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
                  <td className="px-6 py-4">
                    <div onClick={() => handleOpenModal(user, true)} className="font-bold text-gray-900 cursor-pointer hover:text-emerald-600">{user.fullName}</div>
                    <div className="text-[10px] text-gray-400 font-mono font-bold uppercase">CPF: {user.cpf}</div>
                    {hasPending && <span className="inline-flex items-center gap-1 mt-1 bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded border border-orange-200"><FileWarning size={10} /> TERMO PENDENTE</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                        {userDevices.length > 0 && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-[10px] font-black border border-blue-100"><Smartphone size={10} className="inline mr-1"/> {userDevices.length}</span>}
                        {userSims.length > 0 && <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-[10px] font-black border border-indigo-100"><Cpu size={10} className="inline mr-1"/> {userSims.length}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded">{sectors.find(s => s.id === user.sectorId)?.name || 'Não Definido'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                        <button onClick={() => handleOpenModal(user)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-xl transition-all"><Edit2 size={16}/></button>
                        <button onClick={() => handleToggleClick(user)} className={`p-2 rounded-xl ${user.active ? 'text-gray-400 hover:text-red-600' : 'text-green-500'}`}><Power size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? 'Cadastro de Colaborador' : 'Novo Colaborador'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex border-b bg-gray-50 overflow-x-auto">
                <button onClick={() => setActiveTab('DATA')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'DATA' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400'}`}>Dados</button>
                {editingId && (
                    <>
                        <button onClick={() => setActiveTab('ASSETS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'ASSETS' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400'}`}>Ativos</button>
                        <button onClick={() => setActiveTab('TERMS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'TERMS' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400'}`}>Termos</button>
                        <button onClick={() => setActiveTab('LOGS')} className={`px-6 py-4 text-xs font-black uppercase border-b-4 transition-all ${activeTab === 'LOGS' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400'}`}>Auditoria</button>
                    </>
                )}
            </div>
            <div className="p-8 overflow-y-auto flex-1 bg-white">
                {activeTab === 'DATA' && (
                    <form id="userForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nome Completo</label>
                            <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Email</label>
                            <input disabled={isViewOnly} type="email" className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Cargo</label>
                            <select disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50 font-bold" value={formData.sectorId} onChange={e => setFormData({...formData, sectorId: e.target.value})}>
                                <option value="">Selecione...</option>
                                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">CPF</label>
                            <input disabled={isViewOnly} required className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm font-mono bg-slate-50" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})}/>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Código Setor</label>
                            <input disabled={isViewOnly} className="w-full border-2 border-slate-100 rounded-xl p-3 text-sm focus:border-emerald-500 outline-none bg-slate-50" value={formData.internalCode || ''} onChange={e => setFormData({...formData, internalCode: e.target.value})}/>
                        </div>
                    </form>
                )}
                {activeTab === 'TERMS' && (
                    <div className="space-y-4">
                        {(users.find(u => u.id === editingId)?.terms || []).map(term => (
                            <div key={term.id} className="flex items-center justify-between p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl group transition-all hover:border-emerald-300">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-xl ${term.type === 'ENTREGA' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}><FileText size={24}/></div>
                                    <div>
                                        <p className="font-black text-slate-800 text-sm">{term.assetDetails}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TERMO DE {term.type} • {new Date(term.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleReprintTerm(term)} className="p-2.5 bg-white text-blue-600 rounded-xl border border-blue-100 hover:bg-blue-50 shadow-sm" title="Reimprimir"><Printer size={18}/></button>
                                    {term.fileUrl ? (
                                        <>
                                            <button onClick={() => handleOpenFile(term.fileUrl)} className="p-2.5 bg-white text-emerald-600 rounded-xl border border-emerald-100 hover:bg-emerald-50 shadow-sm" title="Ver Arquivo"><ExternalLink size={18}/></button>
                                            {!isViewOnly && <button onClick={() => deleteTermFile(term.id, editingId!, 'Remoção manual', adminName)} className="p-2.5 bg-white text-red-400 rounded-xl border border-red-100 hover:bg-red-50 shadow-sm"><Trash2 size={18}/></button>}
                                        </>
                                    ) : (
                                        !isViewOnly && (
                                            <label className="cursor-pointer flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border-2 border-dashed border-emerald-200 hover:bg-emerald-100 transition-colors">
                                                <Upload size={14}/> ANEXAR ASSINADO
                                                <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => handleTermUpload(term.id, e)} />
                                            </label>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                        {(users.find(u => u.id === editingId)?.terms || []).length === 0 && <p className="text-center py-10 text-slate-300 italic uppercase text-xs font-black">Nenhum termo gerado.</p>}
                    </div>
                )}
                {activeTab === 'ASSETS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {devices.filter(d => d.currentUserId === editingId).map(d => (
                            <div key={d.id} onClick={() => navigate(`/devices?deviceId=${d.id}`)} className="p-4 border-2 border-slate-100 rounded-2xl flex items-center gap-4 hover:border-blue-300 cursor-pointer transition-all bg-slate-50">
                                <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center border shadow-sm"><Smartphone size={24} className="text-blue-500"/></div>
                                <div><p className="font-black text-sm">{models.find(m => m.id === d.modelId)?.name || 'Dispositivo'}</p><p className="text-[10px] font-mono font-bold text-slate-400 uppercase">TAG: {d.assetTag}</p></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-white border-2 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100">Fechar</button>
                {!isViewOnly && activeTab === 'DATA' && <button type="submit" form="userForm" className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase shadow-lg hover:bg-emerald-700 transition-all">Salvar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
