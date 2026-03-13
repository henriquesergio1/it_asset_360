import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Clock, User, FileText, CheckCircle2, AlertCircle, 
    History, MessageSquare, Paperclip, Send, AlertTriangle,
    ClipboardList, Printer, Trash2, ExternalLink, Plus
} from 'lucide-react';
import { Task, TaskLog, TaskStatus, SystemUser } from '../types';

interface TaskDetailModalProps {
    task: Task;
    onClose: () => void;
    onUpdate: (taskId: string, updates: Partial<Task> & { _actionNote?: string }) => Promise<void>;
    currentUser: string;
    isAdmin: boolean;
    systemUsers: SystemUser[];
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onUpdate, currentUser, isAdmin, systemUsers }) => {
    const [logs, setLogs] = useState<TaskLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [newNote, setNewNote] = useState('');
    const [updating, setUpdating] = useState(false);
    const [isEditingInstructions, setIsEditingInstructions] = useState(false);
    const [tempInstructions, setTempInstructions] = useState(task.instructions || '');
    const [tempManualAttachments, setTempManualAttachments] = useState<string[]>(task.manualAttachments || []);

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

    const handleStatusChange = async (newStatus: TaskStatus) => {
        if (newStatus === task.status) return;
        setUpdating(true);
        try {
            await onUpdate(task.id, { 
                status: newStatus, 
                _actionNote: newNote || `Status alterado para ${newStatus}` 
            });
            setNewNote('');
            // Recarregar logs após atualização
            const res = await fetch(`/api/tasks/${task.id}/logs`);
            if (res.ok) setLogs(await res.json());
        } catch (err) {
            console.error('Erro ao atualizar status:', err);
        } finally {
            setUpdating(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        setUpdating(true);
        try {
            await onUpdate(task.id, { _actionNote: newNote });
            setNewNote('');
            const res = await fetch(`/api/tasks/${task.id}/logs`);
            if (res.ok) setLogs(await res.json());
        } catch (err) {
            console.error('Erro ao adicionar nota:', err);
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
            const res = await fetch(`/api/tasks/${task.id}/logs`);
            if (res.ok) setLogs(await res.json());
        } catch (err) {
            console.error('Erro ao salvar instruções:', err);
        } finally {
            setUpdating(false);
        }
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
                return `<img src="${attachment}" style="max-width: 100%; height: auto; margin-top: 20px; border: 1px solid #ccc;" alt="Anexo ${index + 1}" />`;
            } else if (attachment.startsWith('data:application/pdf')) {
                 return `<div style="margin-top: 20px; padding: 10px; border: 1px solid #ccc; background-color: #f9f9f9;">
                            <strong>Anexo PDF ${index + 1}:</strong> O arquivo PDF não pode ser renderizado diretamente na impressão. Por favor, visualize-o no sistema.
                        </div>`;
            }
            return '';
        }).join('');

        const html = `
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
                <div class="no-print" style="margin-bottom: 20px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 5px; cursor: pointer;">Imprimir Agora</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #e2e8f0; color: #333; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Fechar</button>
                </div>
                <h1>${task.title}</h1>
                <div class="meta">
                    <p><strong>Atribuído a:</strong> ${task.assignedTo || 'Geral'}</p>
                    <p><strong>Prazo:</strong> ${new Date(task.dueDate).toLocaleDateString('pt-BR')}</p>
                    <p><strong>Status:</strong> ${task.status}</p>
                </div>
                <h2>Manual / Passo a Passo</h2>
                <div class="instructions">${task.instructions || 'Nenhum manual em texto fornecido.'}</div>
                ${attachmentsHtml ? `<h2>Anexos</h2>${attachmentsHtml}` : ''}
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-colors"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${
                            task.status === TaskStatus.COMPLETED ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                            task.status === TaskStatus.CANCELED ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' :
                            task.isOverdue ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                            'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                        }`}>
                            <ClipboardList size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{task.title}</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Clock size={14} /> Criada em {new Date(task.createdAt).toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    task.status === TaskStatus.COMPLETED ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                                    task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                    task.status === TaskStatus.PENDING ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                                }`}>
                                    {task.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Main Info */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 border-r border-gray-100 dark:border-slate-800">
                        <section>
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileText size={16} /> Descrição
                            </h3>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {task.description || 'Sem descrição detalhada.'}
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                    <ClipboardList size={16} /> Manual / Passo a Passo
                                </h3>
                                <div className="flex items-center gap-3">
                                    {(task.instructions || (task.manualAttachments && task.manualAttachments.length > 0)) && (
                                        <button 
                                            onClick={handlePrintManual}
                                            className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 uppercase tracking-widest flex items-center gap-1 transition-colors"
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
                                            className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-widest"
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
                                        className="w-full p-4 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl text-slate-700 dark:text-slate-300 leading-relaxed min-h-[200px] focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                                    />
                                    
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <Paperclip size={14} /> Anexos do Manual
                                            </h4>
                                            <label className="cursor-pointer text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-widest flex items-center gap-1">
                                                <Plus size={12} /> Adicionar
                                                <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleManualAttachmentUpload} />
                                            </label>
                                        </div>
                                        
                                        {tempManualAttachments.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {tempManualAttachments.map((attachment, index) => (
                                                    <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 aspect-video flex items-center justify-center">
                                                        {attachment.startsWith('data:image') ? (
                                                            <img src={attachment} alt={`Anexo ${index + 1}`} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center text-slate-400">
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
                                                                            w.document.write(`<img src="${attachment}" style="max-width: 100%;" />`);
                                                                        } else {
                                                                            w.document.write(`<iframe src="${attachment}" width="100%" height="100%" style="border:none;"></iframe>`);
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
                                            <p className="text-xs text-slate-400 italic">Nenhum anexo adicionado.</p>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-2 mt-4">
                                        <button 
                                            onClick={() => {
                                                setIsEditingInstructions(false);
                                                setTempInstructions(task.instructions || '');
                                                setTempManualAttachments(task.manualAttachments || []);
                                            }}
                                            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
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
                                <div className="space-y-4">
                                    <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-2xl text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap border border-indigo-100/50 dark:border-indigo-900/20">
                                        {task.instructions || 'Nenhum manual ou passo a passo anexado a esta tarefa.'}
                                    </div>
                                    
                                    {task.manualAttachments && task.manualAttachments.length > 0 && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {task.manualAttachments.map((attachment, index) => (
                                                <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 aspect-video flex items-center justify-center">
                                                    {attachment.startsWith('data:image') ? (
                                                        <img src={attachment} alt={`Anexo ${index + 1}`} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="flex flex-col items-center text-slate-400">
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
                                                                        w.document.write(`<img src="${attachment}" style="max-width: 100%;" />`);
                                                                    } else {
                                                                        w.document.write(`<iframe src="${attachment}" width="100%" height="100%" style="border:none;"></iframe>`);
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

                        <div className="grid grid-cols-2 gap-6">
                            <section>
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Clock size={16} /> Prazo de Conclusão
                                </h3>
                                <div className={`p-4 rounded-2xl border ${
                                    task.isOverdue ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400' :
                                    task.isNearDue ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' :
                                    'bg-slate-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}>
                                    <div className="text-lg font-bold">
                                        {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                                    </div>
                                    {task.isOverdue && (
                                        <div className="text-xs font-medium mt-1 flex items-center gap-1">
                                            <AlertCircle size={12} /> Atrasada
                                        </div>
                                    )}
                                </div>
                            </section>
                            <section>
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <User size={16} /> Atribuída a
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                    <div className="text-lg font-bold">
                                        {task.assignedTo 
                                            ? (systemUsers.find(u => u.id === task.assignedTo)?.name || task.assignedTo) 
                                            : 'Geral'}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Responsável pela execução</div>
                                </div>
                            </section>
                        </div>

                        <section>
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <CheckCircle2 size={16} /> Ações Disponíveis
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELED && (
                                    <>
                                        {task.status === TaskStatus.PENDING && (
                                            <button 
                                                onClick={() => handleStatusChange(TaskStatus.IN_PROGRESS)}
                                                disabled={updating}
                                                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
                                            >
                                                Iniciar Tarefa
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleStatusChange(TaskStatus.COMPLETED)}
                                            disabled={updating}
                                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                                        >
                                            Marcar como Concluída
                                        </button>
                                        <button 
                                            onClick={() => handleStatusChange(TaskStatus.CANCELED)}
                                            disabled={updating}
                                            className="px-6 py-3 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-50"
                                        >
                                            Cancelar Tarefa
                                        </button>
                                    </>
                                )}
                                {(task.status === TaskStatus.COMPLETED || task.status === TaskStatus.CANCELED) && (
                                    <button 
                                        onClick={() => handleStatusChange(TaskStatus.PENDING)}
                                        disabled={updating}
                                        className="px-6 py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                                    >
                                        Reabrir Tarefa
                                    </button>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Timeline / Audit Logs */}
                    <div className="w-full md:w-80 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col">
                        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <History size={16} className="text-indigo-600 dark:text-indigo-400" /> Histórico de Ações
                            </h3>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {loadingLogs ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : logs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                                    Nenhum registro encontrado.
                                </div>
                            ) : (
                                <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-gray-200 dark:before:bg-slate-700">
                                    {logs.map((log, idx) => (
                                        <div key={log.id} className="relative pl-8">
                                            <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${
                                                idx === 0 ? 'bg-indigo-600 dark:bg-indigo-500 scale-110' : 'bg-slate-300 dark:bg-slate-600'
                                            }`} />
                                            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{log.action}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                                <User size={10} /> {log.adminUser} • {new Date(log.timestamp).toLocaleString('pt-BR')}
                                            </div>
                                            {log.notes && (
                                                <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 italic">
                                                    "{log.notes}"
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Note Input */}
                        <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
                            <div className="relative">
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    placeholder="Adicionar nota/comentário..."
                                    className="w-full p-3 pr-10 text-xs bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none h-20 dark:text-slate-100"
                                />
                                <button 
                                    onClick={handleAddNote}
                                    disabled={!newNote.trim() || updating}
                                    className="absolute right-2 bottom-2 p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50"
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
