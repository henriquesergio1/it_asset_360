import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 X, Clock, User, FileText, CheckCircle2, AlertCircle, 
 History, MessageSquare, Paperclip, Send, AlertTriangle,
 ClipboardList, Printer, Trash2, ExternalLink, Plus, XCircle,
 Wrench, DollarSign
} from 'lucide-react';
import { Task, TaskLog, TaskStatus, SystemUser, TaskType, MaintenanceType, Device, DeviceModel } from '../types';
import { useToast } from '../contexts/ToastContext';

interface TaskDetailModalProps {
 task: Task;
 onClose: () => void;
 onUpdate: (taskId: string, updates: Partial<Task> & { _actionNote?: string }) => Promise<void>;
 currentUser: string;
 isAdmin: boolean;
 systemUsers: SystemUser[];
 devices: Device[];
 models: DeviceModel[];
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ 
 task, onClose, onUpdate, currentUser, isAdmin, systemUsers, devices, models 
}) => {
 const { showToast } = useToast();
 const [logs, setLogs] = useState<TaskLog[]>([]);
 const [loadingLogs, setLoadingLogs] = useState(true);
 const [newNote, setNewNote] = useState('');
 const [updating, setUpdating] = useState(false);
 const [isEditingInstructions, setIsEditingInstructions] = useState(false);
 const [tempInstructions, setTempInstructions] = useState(task.instructions || '');
 const [tempManualAttachments, setTempManualAttachments] = useState<string[]>(task.manualAttachments || []);
 const [showCancelReason, setShowCancelReason] = useState(false);
 const [cancelReason, setCancelReason] = useState('');
 const [showCostConfirmation, setShowCostConfirmation] = useState(false);
 const [completingItemId, setCompletingItemId] = useState<string | null>(null);
 const [finalCost, setFinalCost] = useState(task.maintenanceCost || 0);
 const [invoiceFile, setInvoiceFile] = useState<string | null>(null);
 const [itemNote, setItemNote] = useState('');
 const [isEditingGeneral, setIsEditingGeneral] = useState(false);
 const [editTitle, setEditTitle] = useState(task.title);
 const [editDescription, setEditDescription] = useState(task.description || '');
 const [editAssignedTo, setEditAssignedTo] = useState(task.assignedTo || '');
 const [editDueDate, setEditDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
 const [editHasDueDate, setEditHasDueDate] = useState(task.hasDueDate || false);
 const [editIsRecurring, setEditIsRecurring] = useState(task.isRecurring || false);
 const [editRecurrenceConfig, setEditRecurrenceConfig] = useState<any>(task.recurrenceConfig || { type: 'Nenhuma' as any });
 const [editMaintenanceItems, setEditMaintenanceItems] = useState(task.maintenanceItems || []);
 const [searchTerm, setSearchTerm] = useState('');

 useEffect(() => {
 if (!isEditingInstructions) {
 setTempInstructions(task.instructions || '');
 setTempManualAttachments(task.manualAttachments || []);
 }
 }, [task.instructions, task.manualAttachments, isEditingInstructions]);

 useEffect(() => {
 const fetchLogs = async () => {
 try {
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) {
 const data = await res.json();
 setLogs(data);
 }
 } catch (err) {
 console.error('Erro ao buscar logs:', err);
 } finally {
 setLoadingLogs(false);
 }
 };
 fetchLogs();
 }, [task.id]);

 const getDeviceName = (deviceId?: string) => {
 if (!deviceId) return 'Nenhum dispositivo';
 const device = devices.find(d => d.id === deviceId);
 if (!device) return 'Dispositivo não encontrado';
 const model = models.find(m => m.id === device.modelId);
 return`${model?.name || 'Modelo Desconhecido'} (${device.assetTag || device.serialNumber})`;
 };

 const handleCompleteItem = async () => {
 if (!completingItemId) return;
 
 setUpdating(true);
 try {
 const updatedItems = (task.maintenanceItems || []).map(item => {
 if (item.deviceId === completingItemId) {
 return {
 ...item,
 status: 'Concluído',
 completedAt: new Date().toISOString(),
 completedBy: currentUser,
 finalCost: finalCost,
 invoiceUrl: invoiceFile || undefined,
 note: itemNote || undefined
 };
 }
 return item;
 });

 const updates: any = {
 maintenanceItems: updatedItems,
 _adminUser: currentUser,
 _actionNote:`Item de manutenção concluído: ${getDeviceName(completingItemId)}. Custo: R$ ${finalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}${itemNote ?`• Nota: ${itemNote}`: ''}`
 };

 await onUpdate(task.id, updates);
 
 setCompletingItemId(null);
 setShowCostConfirmation(false);
 setFinalCost(0);
 setInvoiceFile(null);
 setItemNote('');
 showToast('Item concluído com sucesso!');
 
 // Recarregar logs
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) setLogs(await res.json());
 } catch (err) {
 console.error('Erro ao concluir item:', err);
 showToast('Erro ao concluir item de manutenção.', 'error');
 } finally {
 setUpdating(false);
 }
 };

 const handleStartItem = async (deviceId: string) => {
 setUpdating(true);
 try {
 const updatedItems = (task.maintenanceItems || []).map(item => {
 if (item.deviceId === deviceId) {
 return {
 ...item,
 status: 'Em Andamento' as any
 };
 }
 return item;
 });

 const updates: any = {
 maintenanceItems: updatedItems,
 status: TaskStatus.IN_PROGRESS,
 _adminUser: currentUser,
 _actionNote:`Item de manutenção iniciado: ${getDeviceName(deviceId)}`
 };

 await onUpdate(task.id, updates);
 showToast('Item iniciado com sucesso!');
 
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) setLogs(await res.json());
 } catch (err) {
 console.error('Erro ao iniciar item:', err);
 showToast('Erro ao iniciar item de manutenção.', 'error');
 } finally {
 setUpdating(false);
 }
 };

 const handleStatusChange = async (newStatus: TaskStatus) => {
 if (newStatus === task.status) return;

 // Validação: Tarefas concluídas não podem ser canceladas
 if (task.status === TaskStatus.COMPLETED && newStatus === TaskStatus.CANCELED) {
 showToast('Tarefas concluídas não podem ser canceladas.', 'error');
 return;
 }

 // Validação: Tarefas canceladas não podem ser concluídas diretamente
 if (task.status === TaskStatus.CANCELED && newStatus === TaskStatus.COMPLETED) {
 showToast('Tarefas canceladas não podem ser concluídas diretamente. Reabra a tarefa primeiro.', 'error');
 return;
 }

 // Validação: Tarefas canceladas não podem ir para"Em Andamento"diretamente
 if (task.status === TaskStatus.CANCELED && newStatus === TaskStatus.IN_PROGRESS) {
 showToast('Tarefas canceladas devem ser reabertas para"Pendente"antes de iniciar.', 'error');
 return;
 }

 // Se for cancelamento, pedir motivo
 if (newStatus === TaskStatus.CANCELED && !showCancelReason) {
 setShowCancelReason(true);
 return;
 }

 // Se for conclusão de manutenção, pedir confirmação de custo e nota fiscal
 if (newStatus === TaskStatus.COMPLETED && task.type === TaskType.MAINTENANCE && !showCostConfirmation) {
 setShowCostConfirmation(true);
 return;
 }

 setUpdating(true);
 try {
 const updates: any = { 
 status: newStatus, 
 _adminUser: currentUser 
 };

 if (newStatus === TaskStatus.CANCELED) {
 updates._actionNote =`Tarefa Cancelada. Motivo: ${cancelReason || 'Não informado'}`;
 } else if (newStatus === TaskStatus.COMPLETED && task.type === TaskType.MAINTENANCE) {
 updates.maintenanceCost = finalCost;
 if (invoiceFile) {
 updates.maintenanceInvoice = invoiceFile;
 }
 updates._actionNote =`Manutenção concluída. Custo final: R$ ${finalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
 } else {
 updates._actionNote = newNote ||`Status alterado para ${newStatus}`;
 }

 await onUpdate(task.id, updates);

 // Se for conclusão de manutenção, avisar sobre notas fiscais (se não anexada agora)
 if (newStatus === TaskStatus.COMPLETED && task.type === TaskType.MAINTENANCE && !invoiceFile) {
 showToast('Manutenção concluída! Lembre-se de anexar notas fiscais se houver.', 'info');
 }
 
 setNewNote('');
 setCancelReason('');
 setShowCancelReason(false);
 setShowCostConfirmation(false);
 showToast(`Tarefa ${newStatus.toLowerCase()} com sucesso!`);

 // Recarregar logs após atualização
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) setLogs(await res.json());
 
 if (newStatus === TaskStatus.COMPLETED || newStatus === TaskStatus.CANCELED) {
 onClose();
 }
 } catch (err) {
 console.error('Erro ao atualizar status:', err);
 showToast('Erro ao atualizar status da tarefa.', 'error');
 } finally {
 setUpdating(false);
 }
 };

 const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 
 if (file.size > 5 * 1024 * 1024) {
 showToast("O arquivo é muito grande. Máximo 5MB.","error");
 return;
 }

 const reader = new FileReader();
 reader.onloadend = () => {
 setInvoiceFile(reader.result as string);
 };
 reader.readAsDataURL(file);
 };

 const handleAddNote = async () => {
 if (!newNote.trim()) return;
 setUpdating(true);
 try {
 await onUpdate(task.id, { _actionNote: newNote });
 setNewNote('');
 showToast('Comentário adicionado com sucesso!');
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) setLogs(await res.json());
 } catch (err) {
 console.error('Erro ao adicionar nota:', err);
 showToast('Erro ao adicionar comentário.', 'error');
 } finally {
 setUpdating(false);
 }
 };

 const handleSaveInstructions = async () => {
 setUpdating(true);
 try {
 await onUpdate(task.id, { 
 instructions: tempInstructions,
 manualAttachments: tempManualAttachments,
 _actionNote: 'Manual de execução atualizado'
 });
 setIsEditingInstructions(false);
 showToast('Manual de execução atualizado com sucesso!');
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) setLogs(await res.json());
 } catch (err) {
 console.error('Erro ao salvar instruções:', err);
 showToast('Erro ao salvar manual.', 'error');
 } finally {
 setUpdating(false);
 }
 };

 const handleSaveGeneral = async () => {
 setUpdating(true);
 try {
 const updates: any = {
 title: editTitle,
 description: editDescription,
 assignedTo: editAssignedTo || null,
 dueDate: editHasDueDate ? editDueDate : null,
 hasDueDate: editHasDueDate,
 isRecurring: editIsRecurring,
 recurrenceConfig: editIsRecurring ? editRecurrenceConfig : null,
 maintenanceItems: editMaintenanceItems,
 _adminUser: currentUser,
 _actionNote: 'Informações gerais da tarefa atualizadas'
 };

 await onUpdate(task.id, updates);
 setIsEditingGeneral(false);
 showToast('Tarefa atualizada com sucesso!');
 const res = await fetch(`/api/tasks/${task.id}/logs`);
 if (res.ok) setLogs(await res.json());
 } catch (err) {
 console.error('Erro ao salvar alterações:', err);
 showToast('Erro ao salvar alterações.', 'error');
 } finally {
 setUpdating(false);
 }
 };

 const handleAddDeviceToMaintenance = (device: Device) => {
 if (editMaintenanceItems.some(i => i.deviceId === device.id)) {
 showToast('Este dispositivo já está na lista.', 'info');
 return;
 }

 const model = models.find(m => m.id === device.modelId);
 const newItem: any = {
 deviceId: device.id,
 assetTag: device.assetTag || device.serialNumber,
 status: 'Pendente'
 };

 setEditMaintenanceItems([...editMaintenanceItems, newItem]);
 setSearchTerm('');
 };

 const handleRemoveDeviceFromMaintenance = (deviceId: string) => {
 setEditMaintenanceItems(editMaintenanceItems.filter(i => i.deviceId !== deviceId));
 };

 const handleManualAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 
 if (file.size > 5 * 1024 * 1024) {
 alert("O arquivo é muito grande. O tamanho máximo permitido é 5MB.");
 return;
 }

 const reader = new FileReader();
 reader.onloadend = () => {
 setTempManualAttachments(prev => [...prev, reader.result as string]);
 };
 reader.readAsDataURL(file);
 };

 const handleRemoveManualAttachment = (index: number) => {
 setTempManualAttachments(prev => prev.filter((_, i) => i !== index));
 };

 const handlePrintManual = () => {
 const printWindow = window.open('', '_blank');
 if (!printWindow) {
 alert('Por favor, permita pop-ups para imprimir o manual.');
 return;
 }

 const attachmentsHtml = (task.manualAttachments || []).map((attachment, index) => {
 if (attachment.startsWith('data:image')) {
 return`<img src="${attachment}"style="max-width: 100%; height: auto; margin-top: 20px; border: 1px solid #ccc;"alt="Anexo ${index + 1}"/>`;
 } else if (attachment.startsWith('data:application/pdf')) {
 return`<div style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">
 <strong>Anexo PDF ${index + 1}:</strong> O arquivo PDF não pode ser renderizado diretamente na impressão. Por favor, visualize-o no sistema.
 </div>`;
 }
 return '';
 }).join('');

 const html =`
 <!DOCTYPE html>
 <html>
 <head>
 <title>Manual da Tarefa: ${task.title}</title>
 <style>
 body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
 h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
 h2 { color: #34495e; margin-top: 30px; }
 .meta { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
 .meta p { margin: 5px 0; font-size: 14px; }
 .instructions { white-space: pre-wrap; background: #fff; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
 @media print {
 body { padding: 0; }
 .no-print { display: none; }
 }
 </style>
 </head>
 <body>
 <div class="no-print"style="margin-bottom: 20px;">
 <button onclick="window.print()"style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 5px; cursor: pointer;">Imprimir Agora</button>
 <button onclick="window.close()"style="padding: 10px 20px; background: #e2e8f0; color: #333; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Fechar</button>
 </div>
 <h1>${task.title}</h1>
 <div class="meta">
 <p><strong>Atribuído a:</strong> ${task.assignedTo || 'Geral'}</p>
 <p><strong>Prazo:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}</p>
 <p><strong>Status:</strong> ${task.status}</p>
 </div>
 <h2>Manual / Passo a Passo</h2>
 <div class="instructions">${task.instructions || 'Nenhum manual em texto fornecido.'}</div>
 ${attachmentsHtml ?`<h2>Anexos</h2>${attachmentsHtml}`: ''}
 </body>
 </html>
`;

 printWindow.document.write(html);
 printWindow.document.close();
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
 <motion.div 
 initial={{ opacity: 0, scale: 0.95, y: 20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 className="bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-800 transition-colors"
 >
 {/* Header */}
 <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
 <div className="flex items-center gap-4">
 <div className={`p-2 rounded-xl ${
 task.status === TaskStatus.COMPLETED ? ' bg-emerald-900/30 text-emerald-400' :
 task.status === TaskStatus.CANCELED ? ' bg-slate-800 ' :
 task.isOverdue ? ' bg-red-900/30 text-red-400' :
 ' bg-indigo-900/30 text-indigo-400'
 }`}>
 <ClipboardList size={24} />
 </div>
 <div>
 {isEditingGeneral ? (
 <input 
 value={editTitle}
 onChange={(e) => setEditTitle(e.target.value)}
 className="text-lg font-bold text-slate-100 bg-slate-800 border-b-2 border-indigo-500 outline-none w-full px-2 rounded"
 />
 ) : (
 <h2 className="text-lg font-bold text-slate-100">{task.title}</h2>
 )}
 <div className="flex items-center gap-3 mt-1">
 <span className="text-xs text-slate-400 flex items-center gap-1">
 <Clock size={14} /> Criada em {new Date(task.createdAt).toLocaleDateString('pt-BR')}
 </span>
 <span className="text-slate-500">•</span>
 <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
 task.status === TaskStatus.COMPLETED ? ' bg-emerald-900/30 text-emerald-400' :
 task.status === TaskStatus.IN_PROGRESS ? ' bg-blue-900/30 text-blue-400' :
 task.status === TaskStatus.PENDING ? ' bg-amber-900/30 text-amber-400' :
 ' bg-slate-800 text-slate-400'
 }`}>
 {task.status}
 </span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-2">
 {isAdmin && !isEditingGeneral && (
 <button 
 onClick={() => {
 setEditTitle(task.title);
 setEditDescription(task.description || '');
 setEditAssignedTo(task.assignedTo || '');
 setEditDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
 setEditHasDueDate(task.hasDueDate || false);
 setEditIsRecurring(task.isRecurring || false);
 setEditRecurrenceConfig(task.recurrenceConfig || { type: 'Nenhuma' as any });
 setEditMaintenanceItems(task.maintenanceItems || []);
 setIsEditingGeneral(true);
 }}
 className="p-2 hover:bg-indigo-900/20 text-indigo-400 rounded-full transition-colors"
 title="Editar Tarefa"
 >
 <Wrench size={20} />
 </button>
 )}
 <button onClick={onClose} className="p-2 hover:text-slate-300 hover:bg-slate-800 rounded-full transition-colors">
 <X size={20} />
 </button>
 </div>
 </div>

 <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
 {/* Main Info */}
 <div className="flex-1 overflow-y-auto p-4 space-y-6 border-r border-slate-800 bg-slate-900">
 <section>
 <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
 <FileText size={16} /> Descrição
 </h3>
 {isEditingGeneral ? (
 <textarea 
 value={editDescription}
 onChange={(e) => setEditDescription(e.target.value)}
 className="w-full p-4 bg-slate-800 border-2 border-indigo-900/30 rounded-2xl text-slate-300 leading-relaxed min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none"
 />
 ) : (
 <div className="bg-slate-800/50 p-3 rounded-xl text-slate-300 leading-relaxed whitespace-pre-wrap">
 {task.description || 'Sem descrição detalhada.'}
 </div>
 )}
 </section>

 <section>
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
 <ClipboardList size={16} /> Manual / Passo a Passo
 </h3>
 <div className="flex items-center gap-3">
 {(task.instructions || (task.manualAttachments && task.manualAttachments.length > 0)) && (
 <button 
 onClick={handlePrintManual}
 className="text-[10px] font-bold hover:text-slate-700 hover:text-slate-200 uppercase tracking-widest flex items-center gap-1 transition-colors"
 >
 <Printer size={12} /> Imprimir
 </button>
 )}
 {isAdmin && !isEditingInstructions && (
 <button 
 onClick={() => {
 setTempInstructions(task.instructions || '');
 setTempManualAttachments(task.manualAttachments || []);
 setIsEditingInstructions(true);
 }}
 className="text-[10px] font-bold text-indigo-400 hover:underline uppercase tracking-widest"
 >
 Editar Manual
 </button>
 )}
 </div>
 </div>
 
 {isEditingInstructions ? (
 <div className="space-y-3">
 <textarea
 value={tempInstructions}
 onChange={(e) => setTempInstructions(e.target.value)}
 placeholder="Descreva o passo a passo para realização desta tarefa..."
 className="w-full p-3 bg-slate-800 border-2 border-indigo-900/30 rounded-xl text-slate-300 leading-relaxed min-h-[150px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
 />
 
 <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
 <Paperclip size={14} /> Anexos do Manual
 </h4>
 <label className="cursor-pointer text-[10px] font-bold text-indigo-400 hover:underline uppercase tracking-widest flex items-center gap-1">
 <Plus size={12} /> Adicionar
 <input type="file"className="hidden"accept="application/pdf,image/*"onChange={handleManualAttachmentUpload} />
 </label>
 </div>
 
 {tempManualAttachments.length > 0 ? (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {tempManualAttachments.map((attachment, index) => (
 <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900 aspect-video flex items-center justify-center">
 {attachment.startsWith('data:image') ? (
 <img src={attachment} alt={`Anexo ${index + 1}`} className="w-full h-full object-cover"/>
 ) : (
 <div className="flex flex-col items-center">
 <FileText size={24} />
 <span className="text-[10px] mt-1 font-bold">PDF</span>
 </div>
 )}
 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
 <button 
 onClick={() => {
 const w = window.open('');
 if (w) {
 if (attachment.startsWith('data:image')) {
 w.document.write(`<img src="${attachment}"style="max-width: 100%;"/>`);
 } else {
 w.document.write(`<iframe src="${attachment}"width="100%"height="100%"style="border:none;"></iframe>`);
 }
 }
 }}
 className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
 >
 <ExternalLink size={14} />
 </button>
 <button 
 onClick={() => handleRemoveManualAttachment(index)}
 className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm transition-colors"
 >
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-xs italic">Nenhum anexo adicionado.</p>
 )}
 </div>

 <div className="flex justify-end gap-2 mt-4">
 <button 
 onClick={() => {
 setIsEditingInstructions(false);
 setTempInstructions(task.instructions || '');
 setTempManualAttachments(task.manualAttachments || []);
 }}
 className="px-4 py-2 text-xs font-bold hover:text-slate-700 hover:text-slate-200 transition-colors"
 >
 Cancelar
 </button>
 <button 
 onClick={handleSaveInstructions}
 disabled={updating}
 className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
 >
 Salvar Manual
 </button>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="bg-slate-800/50 p-3 rounded-xl text-slate-300 leading-relaxed whitespace-pre-wrap border border-slate-700/50">
 {task.instructions || 'Nenhum manual ou passo a passo anexado a esta tarefa.'}
 </div>
 
 {task.manualAttachments && task.manualAttachments.length > 0 && (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 {task.manualAttachments.map((attachment, index) => (
 <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900 aspect-video flex items-center justify-center">
 {attachment.startsWith('data:image') ? (
 <img src={attachment} alt={`Anexo ${index + 1}`} className="w-full h-full object-cover"/>
 ) : (
 <div className="flex flex-col items-center">
 <FileText size={24} />
 <span className="text-[10px] mt-1 font-bold">PDF</span>
 </div>
 )}
 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
 <button 
 onClick={() => {
 const w = window.open('');
 if (w) {
 if (attachment.startsWith('data:image')) {
 w.document.write(`<img src="${attachment}"style="max-width: 100%;"/>`);
 } else {
 w.document.write(`<iframe src="${attachment}"width="100%"height="100%"style="border:none;"></iframe>`);
 }
 }
 }}
 className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors flex items-center gap-2 text-xs font-bold"
 >
 <ExternalLink size={14} /> Abrir
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </section>

 <div className="grid grid-cols-2 gap-4">
 <section>
 <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
 <Clock size={16} /> Prazo de Conclusão
 </h3>
 {isEditingGeneral ? (
 <div className="space-y-2">
 <label className="flex items-center gap-2 cursor-pointer">
 <input 
 type="checkbox"
 checked={editHasDueDate}
 onChange={(e) => setEditHasDueDate(e.target.checked)}
 className="w-4 h-4 rounded focus:ring-indigo-500 border-slate-700 bg-slate-800 transition-colors"
 />
 <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Definir Prazo</span>
 </label>
 <input 
 type="date"
 disabled={!editHasDueDate}
 value={editDueDate}
 onChange={(e) => setEditDueDate(e.target.value)}
 className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-100 disabled:opacity-50"
 />
 </div>
 ) : (
 <div className={`p-4 rounded-2xl border ${
 task.isOverdue ? ' bg-red-900/20 border-red-900/30 text-red-400' :
 task.isNearDue ? ' bg-amber-900/20 border-amber-900/30 text-amber-400' :
 ' bg-slate-800 border-slate-700 text-slate-300'
 }`}>
 <div className="text-lg font-bold">
 {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
 </div>
 {task.isOverdue && (
 <div className="text-xs font-medium mt-1 flex items-center gap-1">
 <AlertCircle size={12} /> Atrasada
 </div>
 )}
 </div>
 )}
 </section>
 <section>
 <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
 <User size={16} /> Atribuída a
 </h3>
 {isEditingGeneral ? (
 <select 
 value={editAssignedTo}
 onChange={(e) => setEditAssignedTo(e.target.value)}
 className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-100"
 >
 <option value="">Geral</option>
 {systemUsers.map(user => (
 <option key={user.id} value={user.id}>{user.name}</option>
 ))}
 </select>
 ) : (
 <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-slate-300">
 <div className="text-lg font-bold">
 {task.assignedTo 
 ? (systemUsers.find(u => u.id === task.assignedTo)?.name || task.assignedTo) 
 : 'Geral'}
 </div>
 <div className="text-xs mt-1">Responsável pela execução</div>
 </div>
 )}
 </section>
 </div>

 {/* Recurrence Edit */}
 <section>
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
 <History size={16} /> Recorrência
 </h3>
 </div>
 {isEditingGeneral ? (
 <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-3">
 <label className="flex items-center gap-2 cursor-pointer">
 <input 
 type="checkbox"
 checked={editIsRecurring}
 onChange={(e) => setEditIsRecurring(e.target.checked)}
 className="w-4 h-4 rounded focus:ring-indigo-500 border-slate-700 bg-slate-800 transition-colors"
 />
 <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Tarefa Recorrente</span>
 </label>

 {editIsRecurring && (
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">Padrão</label>
 <select 
 value={editRecurrenceConfig.type}
 onChange={(e) => setEditRecurrenceConfig({ ...editRecurrenceConfig, type: e.target.value as any })}
 className="w-full p-2 bg-slate-800 border border-indigo-900/30 rounded-xl text-xs font-bold outline-none text-slate-100"
 >
 <option value="Mensal (Dia Fixo)">Mensal (Dia Fixo)</option>
 <option value="Mensal (Dia da Semana)">Mensal (Dia da Semana)</option>
 <option value="Intervalo de Meses">Intervalo de Meses</option>
 </select>
 </div>
 {editRecurrenceConfig.type === 'Mensal (Dia Fixo)' && (
 <div>
 <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">Dia do Mês</label>
 <input 
 type="number"min="1"max="31"
 value={editRecurrenceConfig.dayOfMonth || ''}
 onChange={(e) => setEditRecurrenceConfig({ ...editRecurrenceConfig, dayOfMonth: parseInt(e.target.value) })}
 className="w-full p-2 bg-slate-800 border border-indigo-900/30 rounded-xl text-xs font-bold outline-none text-slate-100"
 />
 </div>
 )}
 {editRecurrenceConfig.type === 'Intervalo de Meses' && (
 <div>
 <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">A cada X meses</label>
 <input 
 type="number"min="1"
 value={editRecurrenceConfig.intervalMonths || ''}
 onChange={(e) => setEditRecurrenceConfig({ ...editRecurrenceConfig, intervalMonths: parseInt(e.target.value) })}
 className="w-full p-2 bg-slate-800 border border-indigo-900/30 rounded-xl text-xs font-bold outline-none text-slate-100"
 />
 </div>
 )}
 </div>
 )}
 </div>
 ) : (
 <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 text-slate-300">
 <div className="text-sm font-medium">
 {task.isRecurring ? (
 <div className="flex items-center gap-2 text-indigo-400 font-bold">
 <History size={16} />
 {task.recurrenceConfig?.type} 
 {task.recurrenceConfig?.dayOfMonth &&`(Dia ${task.recurrenceConfig.dayOfMonth})`}
 {task.recurrenceConfig?.intervalMonths &&`(A cada ${task.recurrenceConfig.intervalMonths} meses)`}
 </div>
 ) : 'Não recorrente'}
 </div>
 </div>
 )}
 </section>

 <section>
 <h3 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
 <CheckCircle2 size={16} /> Ações Disponíveis
 </h3>
 
 {showCancelReason && (
 <motion.div 
 initial={{ opacity: 0, y: -10 }}
 animate={{ opacity: 1, y: 0 }}
 className="w-full p-4 bg-red-900/20 border border-red-900/30 rounded-2xl space-y-3 mb-4"
 >
 <div className="flex items-center justify-between">
 <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
 <AlertTriangle size={14} /> Motivo do Cancelamento
 </h4>
 <button onClick={() => setShowCancelReason(false)} className="text-red-400">
 <X size={14} />
 </button>
 </div>
 <textarea 
 value={cancelReason}
 onChange={(e) => setCancelReason(e.target.value)}
 placeholder="Descreva o motivo do cancelamento desta tarefa..."
 className="w-full p-3 bg-slate-800 border-2 border-red-900/30 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 transition-all text-slate-200"
 rows={2}
 autoFocus
 />
 <div className="flex justify-end gap-2">
 <button 
 onClick={() => setShowCancelReason(false)}
 className="px-4 py-2 text-xs font-bold hover:text-slate-700 hover:text-slate-300"
 >
 Voltar
 </button>
 <button 
 onClick={() => handleStatusChange(TaskStatus.CANCELED)}
 disabled={!cancelReason.trim() || updating}
 className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-all"
 >
 Confirmar Cancelamento
 </button>
 </div>
 </motion.div>
 )}

 {/* Task Actions */}
 <div className="flex flex-wrap gap-3">
 {isEditingGeneral ? (
 <>
 <button 
 onClick={handleSaveGeneral}
 disabled={updating}
 className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-emerald-200 shadow-none transition-all disabled:opacity-50"
 >
 <CheckCircle2 size={18} /> Salvar Alterações
 </button>
 <button 
 onClick={() => setIsEditingGeneral(false)}
 className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-4 hover:bg-slate-300 bg-slate-800 hover:bg-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
 >
 <X size={18} /> Cancelar Edição
 </button>
 </>
 ) : (
 <>
 {task.status === TaskStatus.PENDING && (
 <button 
 onClick={() => handleStatusChange(TaskStatus.IN_PROGRESS)}
 disabled={updating}
 className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-blue-200 shadow-none transition-all disabled:opacity-50"
 >
 <Clock size={18} /> Iniciar Tarefa
 </button>
 )}
 
 {task.status === TaskStatus.IN_PROGRESS && (
 <button 
 onClick={() => {
 if (task.type === TaskType.MAINTENANCE && task.maintenanceItems) {
 const allDone = task.maintenanceItems.every(i => i.status === 'Concluído');
 if (!allDone) {
 alert('Todos os dispositivos devem ser concluídos antes de finalizar a tarefa.');
 return;
 }
 }
 handleStatusChange(TaskStatus.COMPLETED);
 }}
 disabled={updating}
 className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-emerald-200 shadow-none transition-all disabled:opacity-50"
 >
 <CheckCircle2 size={18} /> Finalizar Tarefa
 </button>
 )}

 {task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELED && (
 <button 
 onClick={() => setShowCancelReason(true)}
 disabled={updating}
 className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-4 bg-slate-800 border-2 border-red-900/30 text-red-400 hover:bg-red-900/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
 >
 <AlertTriangle size={18} /> Cancelar Tarefa
 </button>
 )}
 </>
 )}
 </div>

 {task.type === TaskType.MAINTENANCE && (
 <section className="bg-amber-900/10 p-5 rounded-3xl border border-amber-900/20 space-y-4 mt-8">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-amber-400">
 <Wrench size={18} />
 <h3 className="text-sm font-bold uppercase tracking-wider">Dados da Manutenção</h3>
 </div>
 {isEditingGeneral && (
 <div className="relative">
 <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
 <Plus size={14} className=""/>
 <input 
 type="text"
 placeholder="Adicionar dispositivo..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="bg-transparent text-[10px] font-bold outline-none w-32 text-slate-100"
 />
 </div>
 {searchTerm && (
 <div className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-700 rounded-xl z-10 max-h-48 overflow-y-auto">
 {devices
 .filter(d => 
 (d.assetTag?.toLowerCase().includes(searchTerm.toLowerCase()) || 
 d.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())) &&
 !editMaintenanceItems.some(i => i.deviceId === d.id)
 )
 .map(device => (
 <button 
 key={device.id}
 onClick={() => handleAddDeviceToMaintenance(device)}
 className="w-full text-left p-2 hover:bg-slate-700 text-[10px] font-bold border-b border-slate-700 last:border-0"
 >
 {getDeviceName(device.id)}
 </button>
 ))
 }
 </div>
 )}
 </div>
 )}
 {task.maintenanceItems && !isEditingGeneral && (
 <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-900/40 text-amber-400">
 Manutenção em Lote
 </span>
 )}
 </div>
 
 {!task.maintenanceItems && !isEditingGeneral ? (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-800 p-3 rounded-2xl border border-amber-900/30">
 <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Dispositivo</label>
 <div className="text-xs font-bold text-slate-200 truncate">
 {getDeviceName(task.deviceId)}
 </div>
 </div>
 
 <div className="bg-slate-800 p-3 rounded-2xl border border-amber-900/30">
 <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Tipo</label>
 <div className="text-xs font-bold text-slate-200">
 {task.maintenanceType === MaintenanceType.PREVENTIVE ? 'Preventiva' : 
 task.maintenanceType === MaintenanceType.CORRECTIVE ? 'Corretiva' : 'Auditoria'}
 </div>
 </div>
 
 <div className="bg-slate-800 p-3 rounded-2xl border border-amber-900/30">
 <label className="block text-[10px] font-black uppercase mb-1 tracking-widest">Custo</label>
 <div className="text-xs font-bold text-slate-200 flex items-center gap-1">
 <DollarSign size={12} /> {task.maintenanceCost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest px-1">
 <span>Checklist de Dispositivos</span>
 <span>{(isEditingGeneral ? editMaintenanceItems : task.maintenanceItems!).filter(i => i.status === 'Concluído').length} / {(isEditingGeneral ? editMaintenanceItems : task.maintenanceItems!).length} concluídos</span>
 </div>
 <div className="grid grid-cols-1 gap-2">
 {(isEditingGeneral ? editMaintenanceItems : task.maintenanceItems!).map((item) => (
 <div key={item.deviceId} className="space-y-2">
 <div className="flex items-center justify-between p-3 bg-slate-800 rounded-2xl border border-amber-900/30 hover:shadow-md transition-all">
 <div className="flex items-center gap-3">
 <div className={`p-1.5 rounded-lg ${
 item.status === 'Concluído' ? ' ' : 
 item.status === 'Em Andamento' ? ' ' : 
 ' '
 }`}>
 {item.status === 'Concluído' ? <CheckCircle2 size={14} /> : 
 item.status === 'Em Andamento' ? <Clock size={14} className="animate-pulse"/> : 
 <Clock size={14} />}
 </div>
 <div>
 <div className="text-xs font-bold text-slate-200">{getDeviceName(item.deviceId)}</div>
 <div className="text-[10px] font-medium">Patrimônio: {item.assetTag}</div>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {isEditingGeneral ? (
 <button 
 onClick={() => handleRemoveDeviceFromMaintenance(item.deviceId)}
 className="p-1.5 hover:bg-red-900/20 rounded-lg transition-colors"
 >
 <Trash2 size={14} />
 </button>
 ) : (
 <>
 {item.status === 'Concluído' ? (
 <div className="text-right">
 <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Concluído</div>
 <div className="text-[10px]">{item.completedAt ? new Date(item.completedAt).toLocaleDateString('pt-BR') : ''}</div>
 </div>
 ) : item.status === 'Em Andamento' ? (
 <div className="flex items-center gap-2">
 <div className="text-right mr-2">
 <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Em Andamento</div>
 </div>
 <button 
 onClick={() => {
 setCompletingItemId(item.deviceId);
 setFinalCost(task.maintenanceCost || 0);
 setItemNote('');
 setInvoiceFile(null);
 }}
 disabled={task.status === TaskStatus.CANCELED || task.status === TaskStatus.COMPLETED || (completingItemId === item.deviceId)}
 className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
 >
 Finalizar
 </button>
 </div>
 ) : (
 <button 
 onClick={() => handleStartItem(item.deviceId)}
 disabled={task.status === TaskStatus.CANCELED || task.status === TaskStatus.COMPLETED}
 className="px-3 py-1.5 text-white text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50"
 >
 Iniciar
 </button>
 )}
 </>
 )}
 </div>
 </div>

 {/* Inline Completion Form */}
 {completingItemId === item.deviceId && (
 <motion.div 
 initial={{ opacity: 0, height: 0 }}
 animate={{ opacity: 1, height: 'auto' }}
 className="bg-emerald-900/10 border border-emerald-900/20 rounded-2xl p-4 space-y-4 overflow-hidden"
 >
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">Custo Final (R$)</label>
 <input 
 type="number"
 step="0.01"
 value={finalCost}
 onChange={(e) => setFinalCost(parseFloat(e.target.value))}
 className="w-full p-2 bg-slate-800 border border-emerald-900/30 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-100"
 />
 </div>
 <div>
 <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Nota Fiscal</label>
 <label className="cursor-pointer flex items-center justify-center gap-2 p-2 bg-slate-800 border border-emerald-900/30 rounded-xl text-[10px] font-bold text-emerald-400 hover:bg-emerald-900/40 transition-all">
 <Paperclip size={12} />
 {invoiceFile ? 'Anexo Pronto' : 'Anexar PDF/IMG'}
 <input type="file"className="hidden"accept="application/pdf,image/*"onChange={handleInvoiceUpload} />
 </label>
 </div>
 </div>
 <div>
 <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">Observações / Nota</label>
 <textarea 
 value={itemNote}
 onChange={(e) => setItemNote(e.target.value)}
 placeholder="Descreva o que foi feito ou observações importantes..."
 className="w-full p-2 bg-slate-800 border border-emerald-900/30 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px] text-slate-100"
 />
 </div>
 <div className="flex justify-end gap-2">
 <button 
 onClick={() => setCompletingItemId(null)}
 className="px-3 py-1.5 text-[10px] font-bold hover:text-slate-700 hover:text-slate-200"
 >
 Cancelar
 </button>
 <button 
 onClick={handleCompleteItem}
 disabled={updating}
 className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
 >
 {updating ? 'Salvando...' : 'Confirmar Conclusão'}
 </button>
 </div>
 </motion.div>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </section>
 )}
 </section>
 </div>

 {/* Timeline / Audit Logs */}
 <div className="w-full md:w-80 bg-slate-900 flex flex-col border-l border-slate-800">
 <div className="p-4 border-b border-slate-800 bg-slate-900">
 <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
 <History size={16} className="text-indigo-400"/> Histórico de Ações
 </h3>
 </div>
 
 <div className="flex-1 overflow-y-auto p-4 space-y-6">
 {loadingLogs ? (
 <div className="flex justify-center py-8">
 <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
 </div>
 ) : logs.length === 0 ? (
 <div className="text-center py-8 text-xs">
 Nenhum registro encontrado.
 </div>
 ) : (
 <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-700">
 {logs.map((log, idx) => (
 <div key={log.id} className="relative pl-8">
 <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white border-slate-900 ${
 idx === 0 ? 'bg-indigo-600 bg-indigo-500 scale-110' : 'bg-slate-300 bg-slate-600'
 }`} />
 <div className="text-xs font-bold text-slate-100">{log.action}</div>
 <div className="text-[10px] flex items-center gap-1 mt-0.5">
 <User size={10} /> {log.adminUser} • {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : 'Data inválida'}
 </div>
 {log.notes && (
 <div className="mt-2 p-2 bg-slate-800 rounded-lg border border-slate-700 text-[11px] italic whitespace-pre-wrap">
"{log.notes}"
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Quick Note Input */}
 <div className="p-4 bg-slate-900 border-t border-slate-800">
 <div className="relative">
 <textarea
 value={newNote}
 onChange={(e) => setNewNote(e.target.value)}
 placeholder="Adicionar nota/comentário..."
 className="w-full p-3 pr-10 text-xs bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none h-20 text-slate-100"
 />
 <button 
 onClick={handleAddNote}
 disabled={!newNote.trim() || updating}
 className="absolute right-2 bottom-2 p-2 text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50"
 >
 <Send size={16} />
 </button>
 </div>
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 );
};

export default TaskDetailModal;
