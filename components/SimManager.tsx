import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SimCard, DeviceStatus } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, AlertTriangle, Wifi, Signal, X, Eye, Info, Save, Cpu, UserCheck, UserX } from 'lucide-react';

// Componente divisor para redimensionamento
const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
    <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400 transition-colors z-10 bg-slate-200/50 dark:bg-slate-700/50" />
);

const SimManager = () => {
  const { sims, addSim, updateSim, deleteSim, users } = useData();
  const { user: currentUser } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [formData, setFormData] = useState<Partial<SimCard>>({ status: DeviceStatus.AVAILABLE });
  const flyoutRef = useRef<HTMLDivElement>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
      const saved = localStorage.getItem('sim_manager_widths');
      return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
      localStorage.setItem('sim_manager_widths', JSON.stringify(columnWidths));
  }, [columnWidths]);

  const handleResize = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        setColumnWidths(prev => ({ ...prev, [colId]: Math.max(startWidth + delta, 50) }));
    };
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const adminName = currentUser?.name || 'Sistema';

  const total = sims.length;
  const inUse = sims.filter(s => s.status === DeviceStatus.IN_USE).length;
  const available = sims.filter(s => s.status === DeviceStatus.AVAILABLE).length;

  const handleOpenFlyout = (sim?: SimCard, viewOnly: boolean = false) => {
    setIsViewOnly(viewOnly);
    if (sim) {
      setEditingId(sim.id);
      setFormData(sim);
    } else {
      setEditingId(null);
      setFormData({ status: DeviceStatus.AVAILABLE, operator: 'Vivo', planDetails: '' });
    }
    setIsFlyoutOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) return;
    if (formData.phoneNumber) {
        const dupPhone = sims.find(s => s.phoneNumber === formData.phoneNumber && s.id !== editingId);
        if (dupPhone) return alert(`Número ${formData.phoneNumber} já cadastrado.`);
    }
    if (editingId) { 
        setEditReason(''); 
        setIsReasonModalOpen(true); 
    } 
    else { addSim({ ...formData, id: Math.random().toString(36).substr(2, 9), currentUserId: null } as SimCard, adminName); setIsFlyoutOpen(false); }
  };

  const confirmEdit = () => {
    if (!editReason.trim()) return alert('Informe o motivo.');
    updateSim(formData as SimCard, adminName);
    setIsReasonModalOpen(false); setIsFlyoutOpen(false);
  };

  const handleDeleteClick = (id: string) => { setDeleteTargetId(id); setDeleteReason(''); setIsDeleteModalOpen(true); };

  const filteredSims = sims.filter(s => 
    s.phoneNumber.includes(searchTerm) || s.iccid.includes(searchTerm) || s.operator.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => a.phoneNumber.localeCompare(b.phoneNumber));

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Chips / SIM Cards</h1><p className="text-slate-500 dark:text-slate-400 font-medium">Gestão padronizada de linhas e operadoras.</p></div>
        <button onClick={() => handleOpenFlyout()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 shadow-xl shadow-indigo-600/20 font-black uppercase text-xs tracking-widest transition-all active:scale-95"><Plus size={20} strokeWidth={3} /> Novo SIM</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm group hover:shadow-lg transition-all">
            <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total de Linhas</span><p className="text-4xl font-black text-slate-900 dark:text-white">{total}</p></div>
            <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform"><Signal size={28}/></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm group hover:shadow-lg transition-all">
            <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Disponíveis</span><p className="text-4xl font-black text-slate-900 dark:text-white">{available}</p></div>
            <div className="h-14 w-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform"><Wifi size={28}/></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm group hover:shadow-lg transition-all">
            <div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Em Uso</span><p className="text-4xl font-black text-slate-900 dark:text-white">{inUse}</p></div>
            <div className="h-14 w-14 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform"><Smartphone size={28}/></div>
          </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={22} />
        <input type="text" placeholder="Buscar por número, ICCID ou operadora..." className="pl-14 w-full border-none rounded-2xl py-4 shadow-xl shadow-slate-200/50 dark:shadow-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 transition-all text-lg font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left table-fixed min-w-[900px]">
            <thead className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
              <tr>
                <th className="px-8 py-5 relative" style={{ width: columnWidths['phone'] || '200px' }}>Número <Resizer onMouseDown={(e) => handleResize('phone', e.clientX, columnWidths['phone'] || 200)} /></th>
                <th className="px-6 py-5 relative" style={{ width: columnWidths['operator'] || '160px' }}>Operadora <Resizer onMouseDown={(e) => handleResize('operator', e.clientX, columnWidths['operator'] || 160)} /></th>
                <th className="px-6 py-5 relative" style={{ width: columnWidths['iccid'] || '250px' }}>ICCID <Resizer onMouseDown={(e) => handleResize('iccid', e.clientX, columnWidths['iccid'] || 250)} /></th>
                <th className="px-6 py-5 relative text-center" style={{ width: columnWidths['status'] || '150px' }}>Status <Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 150)} /></th>
                <th className="px-6 py-5 relative" style={{ width: columnWidths['user'] || '220px' }}>Usuário Atual <Resizer onMouseDown={(e) => handleResize('user', e.clientX, columnWidths['user'] || 220)} /></th>
                <th className="px-8 py-5 text-right w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {filteredSims.map((sim) => {
                const assignedUser = users.find(u => u.id === sim.currentUserId);
                return (
                  <tr key={sim.id} onClick={() => handleOpenFlyout(sim, true)} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group bg-white dark:bg-slate-900/40">
                    <td className="px-8 py-5 font-black text-slate-900 dark:text-slate-100 truncate">{sim.phoneNumber}</td>
                    <td className="px-6 py-5 truncate"><span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest border dark:border-slate-700">{sim.operator}</span></td>
                    <td className="px-6 py-5 font-mono text-xs text-slate-400 dark:text-slate-500 font-bold truncate">{sim.iccid}</td>
                    <td className="px-6 py-5 text-center truncate"><span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm ${sim.status === DeviceStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{sim.status}</span></td>
                    <td className="px-6 py-5 truncate">{assignedUser ? (<span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline truncate block">{assignedUser.fullName}</span>) : <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase italic">Livre</span>}</td>
                    <td className="px-8 py-5 text-right"><div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}><button onClick={() => handleOpenFlyout(sim, false)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={18}/></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flyout Drawer Chips Standardized v3 */}
      {isFlyoutOpen && (
        <>
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] animate-fade-in" onClick={() => setIsFlyoutOpen(false)}></div>
            <div ref={flyoutRef} className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-white dark:bg-slate-900 z-[100] shadow-[-20px_0_40px_rgba(0,0,0,0.1)] flex flex-col transform transition-all duration-500 ease-out animate-slide-in border-l dark:border-slate-800">
                <div className="bg-slate-900 dark:bg-black px-8 py-8 shrink-0 relative overflow-hidden transition-all duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Cpu size={180}/></div>
                    
                    <div className="relative z-10 flex items-center gap-6">
                        {/* Icon Container Standardized */}
                        <div className="h-28 w-28 rounded-3xl bg-indigo-600/20 border border-indigo-400/20 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl backdrop-blur-sm">
                            <Cpu size={40} className="text-indigo-400 opacity-60" />
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex items-center gap-2 bg-indigo-500/20 px-3 py-1 rounded-full w-fit mb-3">
                                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                                    {editingId ? 'SIM Card Ativo' : 'Nova Linha Móvel'}
                                </span>
                            </div>
                            
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-3 truncate">
                                {formData.phoneNumber || 'Nova Linha'}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="flex items-center gap-2 text-slate-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                    <Signal size={12} className="text-indigo-400"/>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{formData.operator}</span>
                                </div>
                                {formData.iccid && (
                                    <div className="flex items-center gap-2 text-slate-500">
                                        <span className="text-[9px] font-mono font-bold tracking-tighter">ICCID: {formData.iccid.slice(-6)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="h-10 w-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all cursor-pointer absolute top-0 right-0 z-50"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-white dark:bg-slate-900 transition-colors">
                    <form id="simForm" onSubmit={handleSubmit} className="space-y-10 animate-fade-in">
                        {isViewOnly && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-4"><div className="h-10 w-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0"><Info size={24}/></div><p className="text-xs font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-tighter">Visualizando registro. Habilite a edição para modificar operadora ou plano.</p></div>)}
                        <div className="grid grid-cols-1 gap-8">
                            <div className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 space-y-6">
                                <div><label className="block text-[10px] font-black uppercase text-indigo-500 mb-2 tracking-widest">Número de Telefone</label><input disabled={isViewOnly} required type="text" className="w-full bg-transparent border-b-2 border-slate-200 dark:border-slate-800 py-3 text-2xl font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all" value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="(00) 00000-0000"/></div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Operadora</label><select disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm font-bold bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none" value={formData.operator || ''} onChange={e => setFormData({...formData, operator: e.target.value})}><option value="Vivo">Vivo</option><option value="Claro">Claro</option><option value="Tim">Tim</option><option value="Oi">Oi</option><option value="Arquia">Arquia</option></select></div>
                                    <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Status</label><div className="p-3 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-xs font-black uppercase text-indigo-600">{formData.status}</div></div>
                                </div>
                            </div>
                            <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">ICCID do Cartão</label><input disabled={isViewOnly} required className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-mono focus:border-indigo-500 outline-none bg-slate-50 dark:bg-slate-950 dark:text-white" value={formData.iccid || ''} onChange={e => setFormData({...formData, iccid: e.target.value})} placeholder="8955..."/></div>
                            <div><label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Plano Contratado / Franquia</label><input disabled={isViewOnly} className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm bg-slate-50 dark:bg-slate-950 dark:text-white" value={formData.planDetails || ''} onChange={e => setFormData({...formData, planDetails: e.target.value})} placeholder="Ex: 50GB Mensal"/></div>
                        </div>
                    </form>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 px-10 py-8 flex justify-between items-center border-t dark:border-slate-800 shrink-0 transition-colors">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setIsFlyoutOpen(false); }} className="px-8 py-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 font-black text-[10px] uppercase text-slate-500 hover:bg-slate-100 transition-all tracking-[0.2em] shadow-sm cursor-pointer">Fechar</button>
                    {isViewOnly ? (
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsViewOnly(false); }} className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 flex items-center gap-3 cursor-pointer"><Edit2 size={20}/> Habilitar Edição</button>
                    ) : (
                        <button type="submit" form="simForm" className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 cursor-pointer">Salvar Cadastro</button>
                    )}
                </div>
            </div>
        </>
      )}

      {isReasonModalOpen && (<div className="fixed inset-0 bg-slate-900/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"><div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-indigo-100 dark:border-indigo-900/50"><div className="p-10"><div className="flex flex-col items-center text-center mb-8"><div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 mb-6 shadow-inner border-2 border-white dark:border-slate-800"><Save size={40} /></div><h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Salvar Alterações?</h3><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Justificativa necessária:</p></div><textarea className="w-full border-2 border-slate-100 dark:border-slate-800 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-indigo-100 outline-none mb-8 transition-all bg-slate-50 dark:bg-slate-950 dark:text-white shadow-inner" rows={3} placeholder="Descreva o motivo..." value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea><div className="flex gap-4"><button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 dark:border-slate-700 cursor-pointer">Voltar</button><button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">Confirmar</button></div></div></div></div>)}
    </div>
  );
};

export default SimManager;