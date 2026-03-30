
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { SimCard, DeviceStatus } from '../types';
import { Plus, Search, Edit2, Trash2, Smartphone, AlertTriangle, Wifi, Signal, X, Eye, Info, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { normalizeString } from '../utils/stringUtils';

// Componente divisor para redimensionamento
const Resizer = ({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) => (
 <div 
 onMouseDown={onMouseDown}
 className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-400/50 transition-colors z-10 bg-slate-200/50 bg-slate-700/50"
 />
);

const SimManager = () => {
 const { sims, addSim, updateSim, deleteSim, users } = useData();
 const { user: currentUser } = useAuth();
 const { showToast } = useToast();
 const navigate = useNavigate();
 const [searchTerm, setSearchTerm] = useState('');
 const [isModalOpen, setIsModalOpen] = useState(false);
 const [isViewOnly, setIsViewOnly] = useState(false);
 const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
 const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
 const [editReason, setEditReason] = useState('');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
 const [deleteReason, setDeleteReason] = useState('');
 const [formData, setFormData] = useState<Partial<SimCard>>({ status: DeviceStatus.AVAILABLE });
 const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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
 setColumnWidths(prev => ({
 ...prev,
 [colId]: Math.max(startWidth + delta, 50)
 }));
 };
 const onMouseUp = () => {
 document.removeEventListener('mousemove', onMouseMove);
 document.removeEventListener('mouseup', onMouseUp);
 };
 document.addEventListener('mousemove', onMouseMove);
 document.addEventListener('mouseup', onMouseUp);
 };

 const adminName = currentUser?.name || 'Unknown';

 const total = sims.length;
 const inUse = sims.filter(s => s.status === DeviceStatus.IN_USE).length;
 const available = sims.filter(s => s.status === DeviceStatus.AVAILABLE).length;

 const handleOpenModal = (sim?: SimCard, viewOnly: boolean = false) => {
 setIsViewOnly(viewOnly);
 if (sim) {
 setEditingId(sim.id);
 setFormData(sim);
 } else {
 setEditingId(null);
 setFormData({ status: DeviceStatus.AVAILABLE, operator: 'Vivo', planDetails: '' });
 }
 setIsModalOpen(true);
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (isViewOnly) return;

 if (formData.phoneNumber) {
 const dupPhone = sims.find(s => s.phoneNumber === formData.phoneNumber && s.id !== editingId);
 if (dupPhone) {
 alert(`FALHA DE UNICIDADE:\n\nO número de linha ${formData.phoneNumber} já está cadastrado no sistema.`);
 return;
 }
 }

 if (editingId) {
 setEditReason('');
 setIsReasonModalOpen(true);
 } else {
 try {
 addSim({ ...formData, phoneNumber: (formData.phoneNumber || '').trim(), iccid: (formData.iccid || '').trim(), id: Math.random().toString(36).substr(2, 9), currentUserId: null } as SimCard, adminName);
 setIsModalOpen(false);
 showToast('Chip cadastrado com sucesso!', 'success');
 } catch (error) {
 showToast('Erro ao cadastrar chip.', 'error');
 }
 }
 };

 const confirmEdit = () => {
 if (!editReason.trim()) {
 alert('Por favor, informe o motivo da alteração.');
 return;
 }
 try {
 updateSim({ ...formData, phoneNumber: (formData.phoneNumber || '').trim(), iccid: (formData.iccid || '').trim() } as SimCard,`${adminName} (Motivo: ${editReason})`);
 setIsReasonModalOpen(false);
 setIsModalOpen(false);
 showToast('Dados do chip atualizados!', 'success');
 } catch (error) {
 showToast('Erro ao atualizar chip.', 'error');
 }
 };

 const handleDeleteClick = (id: string) => {
 setDeleteTargetId(id);
 setDeleteReason('');
 setIsDeleteModalOpen(true);
 };

 const handleConfirmDelete = () => {
 if (deleteTargetId && deleteReason.trim()) {
 try {
 deleteSim(deleteTargetId, adminName, deleteReason);
 setIsDeleteModalOpen(false);
 setDeleteTargetId(null);
 setDeleteReason('');
 showToast('Chip removido do inventário!', 'success');
 } catch (error) {
 showToast('Erro ao remover chip.', 'error');
 }
 } else {
 alert('Por favor, informe o motivo da exclusão.');
 }
 };

 const handleSort = (key: string) => {
 let direction: 'asc' | 'desc' = 'asc';
 if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
 direction = 'desc';
 }
 setSortConfig({ key, direction });
 };

 const sortedSims = React.useMemo(() => {
 let sortableItems = [...sims];
 if (sortConfig !== null) {
 sortableItems.sort((a, b) => {
 const aValue = a[sortConfig.key as keyof SimCard];
 const bValue = b[sortConfig.key as keyof SimCard];
 
 if (aValue === null || aValue === undefined) return 1;
 if (bValue === null || bValue === undefined) return -1;

 if (typeof aValue === 'string' && typeof bValue === 'string') {
 return sortConfig.direction === 'asc' 
 ? aValue.localeCompare(bValue) 
 : bValue.localeCompare(aValue);
 }

 if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
 if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
 return 0;
 });
 } else {
 sortableItems.sort((a, b) => a.phoneNumber.localeCompare(b.phoneNumber));
 }
 return sortableItems;
 }, [sims, sortConfig]);

 const filteredSims = sortedSims.filter(s => {
 const assignedUser = users.find(u => u.id === s.currentUserId);
 const userName = assignedUser ? assignedUser.fullName : '';
 const searchNormalized = normalizeString(searchTerm);
 
 return (
 normalizeString(s.phoneNumber).includes(searchNormalized) || 
 normalizeString(s.iccid).includes(searchNormalized) ||
 normalizeString(s.operator).includes(searchNormalized) ||
 normalizeString(userName).includes(searchNormalized)
 );
 });

 return (
 <div className="space-y-6 animate-fade-in">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h1 className="text-2xl font-bold text-slate-100">Gestão de Chips / SIMs</h1>
 <p className="text-sm">Controle de linhas (Ordem A-Z por Número).</p>
 </div>
 <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 font-bold">
 <Plus size={18} /> Novo SIM
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-colors hover:shadow-md">
 <div>
 <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Total de Linhas</span>
 <p className="text-3xl font-black text-slate-100">{total}</p>
 </div>
 <div className="h-10 w-10 bg-blue-900/30 rounded-full flex items-center justify-center text-blue-400"><Signal size={20}/></div>
 </div>
 <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-colors hover:shadow-md">
 <div>
 <span className="text-[10px] font-black text-green-400 uppercase tracking-widest block mb-1">Disponíveis</span>
 <p className="text-3xl font-black text-slate-100">{available}</p>
 </div>
 <div className="h-10 w-10 bg-green-900/30 rounded-full flex items-center justify-center text-green-400"><Wifi size={20}/></div>
 </div>
 <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between transition-colors hover:shadow-md">
 <div>
 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Em Uso</span>
 <p className="text-3xl font-black text-slate-100">{inUse}</p>
 </div>
 <div className="h-10 w-10 bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-400"><Smartphone size={20}/></div>
 </div>
 </div>

 <div className="relative">
 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
 <Search className="h-5 w-5"/>
 </div>
 <input 
 type="text"
 placeholder="Buscar por número, ICCID ou operadora..."
 className="pl-12 w-full border-none rounded-xl py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-100 bg-slate-900 transition-colors"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>

 <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden transition-colors">
 <div className="overflow-x-auto">
 <table className="w-full text-sm text-left table-fixed">
 <thead className="text-[10px] uppercase bg-slate-800/50 font-black tracking-widest border-b border-slate-800">
 <tr>
 <th className="px-6 py-4 relative cursor-pointer hover:bg-slate-700/50 transition-colors"style={{ width: columnWidths['phone'] || '180px' }} onClick={() => handleSort('phoneNumber')}><div className="flex items-center gap-1">Número {sortConfig?.key === 'phoneNumber' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div><Resizer onMouseDown={(e) => handleResize('phone', e.clientX, columnWidths['phone'] || 180)} /></th>
 <th className="px-6 py-4 relative cursor-pointer hover:bg-slate-700/50 transition-colors"style={{ width: columnWidths['operator'] || '140px' }} onClick={() => handleSort('operator')}><div className="flex items-center gap-1">Operadora {sortConfig?.key === 'operator' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div><Resizer onMouseDown={(e) => handleResize('operator', e.clientX, columnWidths['operator'] || 140)} /></th>
 <th className="px-6 py-4 relative cursor-pointer hover:bg-slate-700/50 transition-colors"style={{ width: columnWidths['iccid'] || '200px' }} onClick={() => handleSort('iccid')}><div className="flex items-center gap-1">ICCID {sortConfig?.key === 'iccid' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div><Resizer onMouseDown={(e) => handleResize('iccid', e.clientX, columnWidths['iccid'] || 200)} /></th>
 <th className="px-6 py-4 relative text-center cursor-pointer hover:bg-slate-700/50 transition-colors"style={{ width: columnWidths['status'] || '120px' }} onClick={() => handleSort('status')}><div className="flex items-center justify-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div><Resizer onMouseDown={(e) => handleResize('status', e.clientX, columnWidths['status'] || 120)} /></th>
 <th className="px-6 py-4 relative cursor-pointer hover:bg-slate-700/50 transition-colors"style={{ width: columnWidths['user'] || '200px' }} onClick={() => handleSort('currentUserId')}><div className="flex items-center gap-1">Usuário {sortConfig?.key === 'currentUserId' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div><Resizer onMouseDown={(e) => handleResize('user', e.clientX, columnWidths['user'] || 200)} /></th>
 <th className="px-6 py-4 text-right"style={{ width: '120px' }}>Ações</th>
 </tr>
 </thead>
 <tbody>
 {filteredSims.map((sim) => {
 const assignedUser = users.find(u => u.id === sim.currentUserId);
 return (
 <tr key={sim.id} onClick={() => handleOpenModal(sim, true)} className="bg-slate-900 border-b border-slate-800/50 hover:bg-indigo-50/30 hover:bg-indigo-900/20 transition-colors cursor-pointer group">
 <td className="px-6 py-4 font-bold text-slate-100 truncate">{sim.phoneNumber}</td>
 <td className="px-6 py-4 truncate">
 <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider">{sim.operator}</span>
 </td>
 <td className="px-6 py-4 font-mono text-xs font-bold truncate">{sim.iccid}</td>
 <td className="px-6 py-4 text-center truncate">
 <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sim.status === DeviceStatus.AVAILABLE ? ' bg-emerald-900/30 text-emerald-400' : ' bg-blue-900/30 text-blue-400'}`}>
 {sim.status}
 </span>
 </td>
 <td className="px-6 py-4 truncate">
 {assignedUser ? (
 <span 
 className="text-xs font-bold text-blue-400 underline cursor-pointer hover:text-blue-300 truncate block"
 onClick={(e) => {
 e.stopPropagation();
 navigate(`/users?userId=${assignedUser.id}`);
 }}
 >
 {assignedUser.fullName}
 </span>
 ) : <span className="font-bold text-[10px] uppercase tracking-wider italic">Disponível</span>}
 </td>
 <td className="px-6 py-4 text-right"onClick={(e) => e.stopPropagation()}>
 <div className="flex items-center justify-end gap-2">
 <button onClick={() => handleOpenModal(sim, false)} className="text-blue-400 hover:bg-indigo-900/30 p-2 rounded-xl transition-all"title="Editar"><Edit2 size={16} /></button>
 <button onClick={() => handleDeleteClick(sim.id)} className="text-red-400 hover:text-red-400 hover:bg-red-900/30 p-2 rounded-xl transition-all"title="Excluir"><Trash2 size={16} /></button>
 </div>
 </td>
 </tr>
 );
 })}
 {filteredSims.length === 0 && (
 <tr>
 <td colSpan={6} className="px-6 py-10 text-center italic">Nenhum chip encontrado.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 {/* Modal de Cadastro/Edição */}
 {isModalOpen && (
 <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
 <div className="bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden animate-scale-up border border-indigo-900/40 transition-colors">
 <div className="bg-slate-900 bg-black px-8 py-5 flex justify-between items-center border-b border-white/10">
 <h3 className="text-lg font-black text-white uppercase tracking-tighter">{editingId ? (isViewOnly ? 'Visualização do Chip' : 'Edição de Linha') : 'Novo Chip / SIM'}</h3>
 <button onClick={() => setIsModalOpen(false)} className="hover:text-white transition-colors"><X size={20}/></button>
 </div>
 <form onSubmit={handleSubmit} className="p-8 space-y-6">
 {isViewOnly && (
 <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-900/40 flex items-center gap-3 mb-2">
 <Info className="text-blue-400"size={20}/>
 <p className="text-xs font-bold text-blue-200">Modo de visualização. Clique no botão azul"Habilitar Edição"abaixo para realizar alterações.</p>
 </div>
 )}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">Número da Linha</label>
 <input disabled={isViewOnly} required type="text"placeholder="(00) 00000-0000"className="w-full border-2 border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-800 text-slate-100 font-bold transition-colors"value={formData.phoneNumber || ''} onChange={e => setFormData({...formData, phoneNumber: e.target.value.trim()})}/>
 </div>
 <div>
 <label className="block text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">Operadora</label>
 <select disabled={isViewOnly} className="w-full border-2 border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-800 text-slate-100 font-bold transition-colors"value={formData.operator || ''} onChange={e => setFormData({...formData, operator: e.target.value})}>
 <option value="Vivo">Vivo</option>
 <option value="Claro">Claro</option>
 <option value="Tim">Tim</option>
 <option value="Oi">Oi</option>
 <option value="Arquia">Arquia</option>
 <option value="Outra">Outra</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">ICCID (20 dígitos)</label>
 <input disabled={isViewOnly} required type="text"placeholder="8955..."className="w-full border-2 border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-800 text-slate-100 font-mono transition-colors"value={formData.iccid || ''} onChange={e => setFormData({...formData, iccid: e.target.value.trim()})}/>
 </div>
 <div className="md:col-span-2">
 <label className="block text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">Detalhes do Plano</label>
 <input disabled={isViewOnly} type="text"placeholder="Ex: 50GB Mensal Corporativo"className="w-full border-2 border-slate-800 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none bg-slate-800 text-slate-100 transition-colors"value={formData.planDetails || ''} onChange={e => setFormData({...formData, planDetails: e.target.value})}/>
 </div>
 </div>
 
 <div className="flex justify-end gap-3 pt-6 border-t border-slate-800 transition-colors">
 <button type="button"onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase hover:bg-slate-800 rounded-xl transition-all tracking-widest border border-slate-700">Fechar</button>
 {isViewOnly ? (
 <button type="button"onClick={(e) => { e.preventDefault(); setIsViewOnly(false); }} className="px-8 py-3 bg-indigo-600 bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 hover:bg-indigo-600 font-black text-xs uppercase tracking-[0.1em] transition-all flex items-center gap-2">
 <Edit2 size={16}/> Habilitar Edição
 </button>
 ) : (
 <button type="submit"className="px-8 py-3 bg-indigo-600 bg-indigo-500 text-white rounded-xl hover:bg-indigo-700 hover:bg-indigo-600 font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95">Salvar Cadastro</button>
 )}
 </div>
 </form>
 </div>
 </div>
 )}

 {isReasonModalOpen && (
 <div className="fixed inset-0 bg-slate-900/80 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
 <div className="bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden border border-indigo-900/40 transition-colors">
 <div className="p-8">
 <div className="flex flex-col items-center text-center mb-6">
 <div className="h-16 w-16 bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-400 mb-4 shadow-inner border border-indigo-900/40"><Save size={32} /></div>
 <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Confirmar Alterações?</h3>
 <p className="text-xs mt-2">Informe o motivo da alteração para auditoria:</p>
 </div>
 <textarea className="w-full border-2 border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-indigo-100 focus:ring-indigo-900/20 focus:border-indigo-300 focus:border-indigo-700 outline-none mb-6 transition-all bg-slate-800 text-slate-100"rows={3} placeholder="Descreva o que foi alterado..."value={editReason} onChange={(e) => setEditReason(e.target.value)}></textarea>
 <div className="flex gap-4">
 <button onClick={() => setIsReasonModalOpen(false)} className="flex-1 py-3 bg-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-colors">Voltar</button>
 <button onClick={confirmEdit} disabled={!editReason.trim()} className="flex-1 py-3 bg-indigo-600 bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 transition-all">Salvar Alterações</button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Modal de Exclusão */}
 {isDeleteModalOpen && (
 <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
 <div className="bg-slate-900 rounded-3xl w-full max-sm overflow-hidden border border-red-900/40 transition-colors">
 <div className="p-8">
 <div className="flex flex-col items-center text-center mb-6">
 <div className="h-16 w-16 bg-red-900/30 rounded-full flex items-center justify-center text-red-400 mb-4 shadow-inner border border-red-900/40"><AlertTriangle size={32} /></div>
 <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter leading-tight">Remover Chip do Inventário?</h3>
 <p className="text-xs mt-2">Esta ação é permanente. Informe o motivo abaixo:</p>
 </div>
 <textarea className="w-full border-2 border-slate-800 rounded-2xl p-4 text-sm focus:ring-4 focus:ring-red-100 focus:ring-red-900/20 focus:border-red-300 focus:border-red-700 outline-none mb-6 transition-all bg-slate-800 text-slate-100"rows={3} placeholder="Ex: Chip extraviado, linha cancelada..."value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)}></textarea>
 <div className="flex gap-4">
 <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-700 transition-colors">Manter</button>
 <button onClick={handleConfirmDelete} disabled={!deleteReason.trim()} className="flex-1 py-3 bg-red-600 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 hover:bg-red-600 transition-all disabled:opacity-50">Confirmar</button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default SimManager;
