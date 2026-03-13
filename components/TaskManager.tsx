import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Filter, ClipboardList, Clock, 
    AlertCircle, CheckCircle2, XCircle, MoreVertical,
    Calendar, User, Tag, ChevronDown, ArrowUpDown,
    Repeat, Paperclip, Trash2, ExternalLink, FileText
} from 'lucide-react';
import { Task, TaskStatus, TaskType, SystemUser, RecurrenceType, TaskRecurrenceConfig } from '../types';
import { TaskDetailModal } from './TaskDetailModal';

interface TaskManagerProps {
    tasks: Task[];
    systemUsers: SystemUser[];
    onAddTask: (task: Partial<Task>) => Promise<void>;
    onUpdateTask: (taskId: string, updates: Partial<Task> & { _actionNote?: string }) => Promise<void>;
    currentUser: string;
    isAdmin: boolean;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ tasks, systemUsers, onAddTask, onUpdateTask, currentUser, isAdmin }) => {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<TaskStatus | 'All'>('All');
    const [typeFilter, setTypeFilter] = useState<TaskType | 'All'>('All');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newTask, setNewTask] = useState<Partial<Task>>({
        title: '',
        description: '',
        type: TaskType.REMINDER,
        status: TaskStatus.PENDING,
        hasDueDate: true,
        dueDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
        assignedTo: '',
        isRecurring: false,
        recurrenceConfig: {
            type: RecurrenceType.NONE
        },
        manualAttachments: []
    });

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                                 t.description?.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
            const matchesType = typeFilter === 'All' || t.type === typeFilter;
            return matchesSearch && matchesStatus && matchesType;
        }).sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }, [tasks, search, statusFilter, typeFilter]);

    const handleManualAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert("O arquivo é muito grande. O tamanho máximo permitido é 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setNewTask(prev => ({
                ...prev,
                manualAttachments: [...(prev.manualAttachments || []), reader.result as string]
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveManualAttachment = (index: number) => {
        setNewTask(prev => ({
            ...prev,
            manualAttachments: (prev.manualAttachments || []).filter((_, i) => i !== index)
        }));
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await onAddTask(newTask);
            setIsAdding(false);
            setNewTask({
                title: '',
                description: '',
                type: TaskType.REMINDER,
                status: TaskStatus.PENDING,
                hasDueDate: true,
                dueDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
                assignedTo: '',
                isRecurring: false,
                recurrenceConfig: {
                    type: RecurrenceType.NONE
                },
                manualAttachments: []
            });
        } catch (err) {
            console.error('Erro ao criar tarefa:', err);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Gestão de Tarefas</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Acompanhe e gerencie as rotinas do setor IT.</p>
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                    <Plus size={20} /> Nova Tarefa
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-4 transition-colors">
                <div className="flex-1 min-w-[240px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Buscar por título ou descrição..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all dark:text-slate-100"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-400" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                    >
                        <option value="All">Todos Status</option>
                        <option value={TaskStatus.PENDING}>Pendente</option>
                        <option value={TaskStatus.IN_PROGRESS}>Em Andamento</option>
                        <option value={TaskStatus.COMPLETED}>Concluída</option>
                        <option value={TaskStatus.CANCELED}>Cancelada</option>
                    </select>
                    <select 
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        className="bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none dark:text-slate-100"
                    >
                        <option value="All">Todos Tipos</option>
                        <option value={TaskType.MAINTENANCE}>Manutenção</option>
                        <option value={TaskType.FILE_SEND}>Envio de Arquivo</option>
                        <option value={TaskType.SYSTEM_ACTION}>Ação no Sistema</option>
                        <option value={TaskType.REMINDER}>Lembrete</option>
                    </select>
                </div>
            </div>

            {/* Tasks Grid/List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredTasks.map(task => (
                        <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={() => setSelectedTask(task)}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer group flex flex-col h-full"
                        >
                            <div className="p-5 flex-1">
                                <div className="flex items-start justify-between mb-4">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                                        task.type === TaskType.MAINTENANCE ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                        task.type === TaskType.FILE_SEND ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                        task.type === TaskType.SYSTEM_ACTION ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                        {task.type}
                                    </span>
                                    <div className={`w-2 h-2 rounded-full ${
                                        task.status === TaskStatus.COMPLETED ? 'bg-emerald-500' :
                                        task.status === TaskStatus.CANCELED ? 'bg-slate-400' :
                                        task.isOverdue ? 'bg-red-500 animate-pulse' :
                                        task.isNearDue ? 'bg-amber-500' :
                                        'bg-blue-500'
                                    }`} />
                                </div>

                                <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                                    {task.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-4">
                                    {task.description || 'Sem descrição.'}
                                </p>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <User size={14} className="text-slate-400" />
                                        <span className="font-medium">{task.assignedTo ? systemUsers.find(u => u.id === task.assignedTo)?.name || task.assignedTo : 'Geral'}</span>
                                    </div>
                                    <div className={`flex items-center gap-2 text-xs font-bold ${
                                        task.isOverdue ? 'text-red-600 dark:text-red-400' : 
                                        task.isNearDue ? 'text-amber-600 dark:text-amber-400' : 
                                        'text-slate-500 dark:text-slate-400'
                                    }`}>
                                        <Calendar size={14} />
                                        <span>Prazo: {task.hasDueDate && task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}</span>
                                    </div>
                                    {task.isRecurring && (
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                            <Repeat size={12} />
                                            <span>Recorrente: {task.recurrenceConfig?.type}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between rounded-b-2xl">
                                <span className={`text-[11px] font-bold ${
                                    task.status === TaskStatus.COMPLETED ? 'text-emerald-600 dark:text-emerald-400' :
                                    task.status === TaskStatus.IN_PROGRESS ? 'text-blue-600 dark:text-blue-400' :
                                    task.status === TaskStatus.PENDING ? 'text-amber-600 dark:text-amber-400' :
                                    'text-slate-500 dark:text-slate-400'
                                }`}>
                                    {task.status}
                                </span>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                    ID: {task.id.slice(0, 8)}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Empty State */}
            {filteredTasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                    <ClipboardList size={64} strokeWidth={1} className="mb-4 opacity-20" />
                    <h3 className="text-lg font-medium">Nenhuma tarefa encontrada</h3>
                    <p className="text-sm">Tente ajustar seus filtros ou busca.</p>
                </div>
            )}

            {/* Add Task Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.form 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onSubmit={handleCreateTask}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nova Tarefa</h2>
                                <button type="button" onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <XCircle size={24} className="text-slate-400" />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Título</label>
                                    <input 
                                        required
                                        type="text"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                                        placeholder="Ex: Backup semanal do servidor"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Descrição</label>
                                    <textarea 
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                                        placeholder="Detalhes da tarefa..."
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none dark:text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Manual / Passo a Passo (Instruções)</label>
                                    <textarea 
                                        value={newTask.instructions || ''}
                                        onChange={(e) => setNewTask({...newTask, instructions: e.target.value})}
                                        placeholder="Descreva o passo a passo para realização desta tarefa..."
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-32 resize-none dark:text-slate-100 font-mono text-xs mb-3"
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
                                        
                                        {(newTask.manualAttachments && newTask.manualAttachments.length > 0) ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {newTask.manualAttachments.map((attachment, index) => (
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
                                                                type="button"
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
                                                                title="Visualizar"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemoveManualAttachment(index)}
                                                                className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm transition-colors"
                                                                title="Remover"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nenhum anexo adicionado</p>
                                                <p className="text-[10px] text-slate-400 mt-1">PDFs ou Imagens (Máx 5MB)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={newTask.hasDueDate}
                                                onChange={(e) => setNewTask({...newTask, hasDueDate: e.target.checked})}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                            />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Definir Prazo</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={newTask.isRecurring}
                                                onChange={(e) => setNewTask({...newTask, isRecurring: e.target.checked})}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                            />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Recorrente</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                                        <select 
                                            value={newTask.type}
                                            onChange={(e) => setNewTask({...newTask, type: e.target.value as any})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-100"
                                        >
                                            <option value={TaskType.MAINTENANCE}>Manutenção</option>
                                            <option value={TaskType.FILE_SEND}>Envio de Arquivo</option>
                                            <option value={TaskType.SYSTEM_ACTION}>Ação no Sistema</option>
                                            <option value={TaskType.REMINDER}>Lembrete</option>
                                            <option value={TaskType.OTHER}>Outro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Prazo</label>
                                        <input 
                                            disabled={!newTask.hasDueDate}
                                            required={newTask.hasDueDate}
                                            type="date"
                                            value={newTask.dueDate}
                                            onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-100 disabled:opacity-50"
                                        />
                                    </div>

                                    {newTask.isRecurring && (
                                        <div className="col-span-2 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-500 mb-1 tracking-widest">Padrão de Recorrência</label>
                                                    <select 
                                                        value={newTask.recurrenceConfig?.type}
                                                        onChange={(e) => setNewTask({
                                                            ...newTask, 
                                                            recurrenceConfig: { 
                                                                ...newTask.recurrenceConfig!, 
                                                                type: e.target.value as any,
                                                                // Reset other fields
                                                                dayOfMonth: undefined,
                                                                weekOfMonth: undefined,
                                                                dayOfWeek: undefined,
                                                                intervalMonths: undefined
                                                            }
                                                        })}
                                                        className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-xs font-bold dark:text-slate-100 outline-none"
                                                    >
                                                        <option value={RecurrenceType.MONTHLY_DAY}>Mensal (Dia Fixo)</option>
                                                        <option value={RecurrenceType.MONTHLY_WEEKDAY}>Mensal (Dia da Semana)</option>
                                                        <option value={RecurrenceType.INTERVAL_MONTHS}>Intervalo de Meses</option>
                                                    </select>
                                                </div>

                                                {newTask.recurrenceConfig?.type === RecurrenceType.MONTHLY_DAY && (
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-500 mb-1 tracking-widest">Dia do Mês</label>
                                                        <input 
                                                            type="number" min="1" max="31"
                                                            value={newTask.recurrenceConfig.dayOfMonth || ''}
                                                            onChange={(e) => setNewTask({...newTask, recurrenceConfig: {...newTask.recurrenceConfig!, dayOfMonth: parseInt(e.target.value)}})}
                                                            className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-xs font-bold dark:text-slate-100 outline-none"
                                                            placeholder="1-31"
                                                        />
                                                    </div>
                                                )}

                                                {newTask.recurrenceConfig?.type === RecurrenceType.MONTHLY_WEEKDAY && (
                                                    <>
                                                        <div>
                                                            <label className="block text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-500 mb-1 tracking-widest">Semana</label>
                                                            <select 
                                                                value={newTask.recurrenceConfig.weekOfMonth || ''}
                                                                onChange={(e) => setNewTask({...newTask, recurrenceConfig: {...newTask.recurrenceConfig!, weekOfMonth: parseInt(e.target.value)}})}
                                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-xs font-bold dark:text-slate-100 outline-none"
                                                            >
                                                                <option value="">Selecione...</option>
                                                                <option value="1">Primeira</option>
                                                                <option value="2">Segunda</option>
                                                                <option value="3">Terceira</option>
                                                                <option value="4">Quarta</option>
                                                                <option value="5">Última</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-500 mb-1 tracking-widest">Dia da Semana</label>
                                                            <select 
                                                                value={newTask.recurrenceConfig.dayOfWeek || ''}
                                                                onChange={(e) => setNewTask({...newTask, recurrenceConfig: {...newTask.recurrenceConfig!, dayOfWeek: parseInt(e.target.value)}})}
                                                                className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-xs font-bold dark:text-slate-100 outline-none"
                                                            >
                                                                <option value="">Selecione...</option>
                                                                <option value="1">Segunda-feira</option>
                                                                <option value="2">Terça-feira</option>
                                                                <option value="3">Quarta-feira</option>
                                                                <option value="4">Quinta-feira</option>
                                                                <option value="5">Sexta-feira</option>
                                                                <option value="6">Sábado</option>
                                                                <option value="0">Domingo</option>
                                                            </select>
                                                        </div>
                                                    </>
                                                )}

                                                {newTask.recurrenceConfig?.type === RecurrenceType.INTERVAL_MONTHS && (
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase text-indigo-400 dark:text-indigo-500 mb-1 tracking-widest">A cada X meses</label>
                                                        <input 
                                                            type="number" min="1"
                                                            value={newTask.recurrenceConfig.intervalMonths || ''}
                                                            onChange={(e) => setNewTask({...newTask, recurrenceConfig: {...newTask.recurrenceConfig!, intervalMonths: parseInt(e.target.value)}})}
                                                            className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900/60 rounded-lg text-xs font-bold dark:text-slate-100 outline-none"
                                                            placeholder="Ex: 3"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Atribuir a (Opcional)</label>
                                    <select 
                                        value={newTask.assignedTo}
                                        onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-100 font-bold"
                                    >
                                        <option value="">Geral (Todos)</option>
                                        {systemUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                                >
                                    Criar Tarefa
                                </button>
                            </div>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>

            {/* Detail Modal */}
            {selectedTask && (
                <TaskDetailModal 
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={onUpdateTask}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
};

export default TaskManager;
