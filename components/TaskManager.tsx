import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, Search, Filter, ClipboardList, Clock, 
    AlertCircle, CheckCircle2, XCircle, MoreVertical,
    Calendar, User, Tag, ChevronDown, ArrowUpDown,
    Repeat, Paperclip, Trash2, ExternalLink, FileText,
    Smartphone, Bell, Wrench, ShieldCheck, CheckSquare,
    Download, FileSpreadsheet, FileJson, Check
} from 'lucide-react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Task, TaskStatus, TaskType, SystemUser, RecurrenceType, TaskRecurrenceConfig, Device, DeviceModel, MaintenanceType, DeviceStatus, AssetType, MaintenanceItem } from '../types';
import { TaskDetailModal } from './TaskDetailModal';
import { useToast } from '../contexts/ToastContext';

interface TaskManagerProps {
    tasks: Task[];
    systemUsers: SystemUser[];
    devices: Device[];
    models: DeviceModel[];
    assetTypes: AssetType[];
    onAddTask: (task: Partial<Task>) => Promise<void>;
    onUpdateTask: (taskId: string, updates: Partial<Task> & { _actionNote?: string }) => Promise<void>;
    currentUser: string;
    isAdmin: boolean;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ tasks, systemUsers, devices, models, assetTypes, onAddTask, onUpdateTask, currentUser, isAdmin }) => {
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'Ativas' | 'Concluídas' | 'Canceladas'>('Ativas');
    const [typeFilter, setTypeFilter] = useState<TaskType | 'All'>('All');
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isBatchMaintenance, setIsBatchMaintenance] = useState(false);
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
    const [assetTypeFilter, setAssetTypeFilter] = useState<string>('All');
    
    // Bulk Actions & Selection
    const [selectedTasksIds, setSelectedTasksIds] = useState<string[]>([]);
    const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
    const [bulkActionType, setBulkActionType] = useState<'status' | 'assignee' | null>(null);
    const [bulkValue, setBulkValue] = useState('');

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
        manualAttachments: [],
        maintenanceType: MaintenanceType.PREVENTIVE,
        maintenanceCost: 0
    });

    const selectedTask = useMemo(() => {
        if (!selectedTaskId) return null;
        return tasks.find(t => t.id === selectedTaskId) || null;
    }, [tasks, selectedTaskId]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (!t) return false;
            const matchesSearch = (t.title || '').toLowerCase().includes(search.toLowerCase()) || 
                                 (t.description || '').toLowerCase().includes(search.toLowerCase());
            
            let matchesTab = false;
            if (activeTab === 'Ativas') {
                matchesTab = t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS;
            } else if (activeTab === 'Concluídas') {
                matchesTab = t.status === TaskStatus.COMPLETED;
            } else if (activeTab === 'Canceladas') {
                matchesTab = t.status === TaskStatus.CANCELED;
            }

            const matchesType = typeFilter === 'All' || t.type === typeFilter;
            return matchesSearch && matchesTab && matchesType;
        }).sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
    }, [tasks, search, activeTab, typeFilter]);

    const getDeviceName = (deviceId?: string) => {
        if (!deviceId) return 'N/A';
        const device = devices.find(d => d.id === deviceId);
        if (!device) return 'Desconhecido';
        const model = models.find(m => m.id === device.modelId);
        return `${model?.name || 'Dispositivo'} (${device.assetTag || device.serialNumber})`;
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

    // Export Functions
    const exportToCSV = () => {
        const headers = ['ID', 'Título', 'Tipo', 'Status', 'Responsável', 'Prazo', 'Descrição'];
        const rows = filteredTasks.map(t => [
            t.id,
            t.title,
            t.type,
            t.status,
            systemUsers.find(u => u.id === t.assignedTo)?.name || t.assignedTo || 'Geral',
            t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'N/A',
            t.description
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, `tarefas_it_${new Date().toISOString().split('T')[0]}.csv`);
        showToast('Exportação CSV iniciada');
    };

    const exportToExcel = () => {
        const data = filteredTasks.map(t => ({
            'ID': t.id,
            'Título': t.title,
            'Tipo': t.type,
            'Status': t.status,
            'Responsável': systemUsers.find(u => u.id === t.assignedTo)?.name || t.assignedTo || 'Geral',
            'Prazo': t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'N/A',
            'Descrição': t.description
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tarefas");
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `tarefas_it_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('Exportação Excel iniciada');
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        const tableColumn = ["Título", "Tipo", "Status", "Responsável", "Prazo"];
        const tableRows = filteredTasks.map(t => [
            t.title,
            t.type,
            t.status,
            systemUsers.find(u => u.id === t.assignedTo)?.name || t.assignedTo || 'Geral',
            t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR') : 'N/A'
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillStyle: [63, 81, 181] }
        });

        doc.text("Relatório de Gestão de Tarefas IT", 14, 15);
        doc.save(`tarefas_it_${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('Exportação PDF iniciada');
    };

    // Bulk Action Handlers
    const handleBulkUpdate = async () => {
        if (!bulkActionType || !bulkValue || selectedTasksIds.length === 0) return;

        try {
            const updates = bulkActionType === 'status' 
                ? { status: bulkValue as TaskStatus } 
                : { assignedTo: bulkValue };

            const promises = selectedTasksIds.map(id => 
                onUpdateTask(id, { ...updates, _actionNote: `Atualização em massa: ${bulkActionType} alterado para ${bulkValue}` })
            );

            await Promise.all(promises);
            showToast(`${selectedTasksIds.length} tarefas atualizadas com sucesso!`);
            setSelectedTasksIds([]);
            setIsBulkActionOpen(false);
            setBulkValue('');
        } catch (err) {
            console.error('Erro na atualização em massa:', err);
            showToast('Erro ao processar atualização em massa', 'error');
        }
    };

    const toggleSelectAll = () => {
        if (selectedTasksIds.length === filteredTasks.length) {
            setSelectedTasksIds([]);
        } else {
            setSelectedTasksIds(filteredTasks.map(t => t.id));
        }
    };

    const toggleSelectTask = (id: string) => {
        setSelectedTasksIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const taskToSave = { ...newTask };
            if (!taskToSave.hasDueDate) {
                taskToSave.dueDate = undefined;
            }
            
            // Validação para Manutenção
            if (taskToSave.type === TaskType.MAINTENANCE) {
                if (isBatchMaintenance) {
                    if (selectedDeviceIds.length === 0) {
                        showToast('Selecione ao menos um dispositivo para a manutenção em lote.', 'error');
                        return;
                    }
                    taskToSave.maintenanceItems = selectedDeviceIds.map(id => {
                        const device = devices.find(d => d.id === id);
                        return {
                            deviceId: id,
                            assetTag: device?.assetTag || 'N/A',
                            status: 'Pendente'
                        } as MaintenanceItem;
                    });
                    taskToSave.deviceId = undefined;
                } else if (!taskToSave.deviceId) {
                    showToast('Selecione um dispositivo para a manutenção.', 'error');
                    return;
                }
            }

            await onAddTask(taskToSave);
            setIsAdding(false);
            setIsBatchMaintenance(false);
            setSelectedDeviceIds([]);
            setAssetTypeFilter('All');
            showToast('Tarefa criada com sucesso!');
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
                manualAttachments: [],
                maintenanceType: MaintenanceType.PREVENTIVE,
                maintenanceCost: 0
            });
        } catch (err) {
            console.error('Erro ao criar tarefa:', err);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Gestão de Tarefas</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Acompanhe e gerencie as rotinas do setor IT.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                        <button 
                            onClick={exportToCSV}
                            className="p-2.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="Exportar CSV"
                        >
                            <FileJson size={20} />
                        </button>
                        <button 
                            onClick={exportToExcel}
                            className="p-2.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Exportar Excel"
                        >
                            <FileSpreadsheet size={20} />
                        </button>
                        <button 
                            onClick={exportToPDF}
                            className="p-2.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Exportar PDF"
                        >
                            <FileText size={20} />
                        </button>
                    </div>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
                    >
                        <Plus size={20} /> Nova Tarefa
                    </button>
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 mb-6 transition-all">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar tarefas por título ou descrição..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                            {(['Ativas', 'Concluídas', 'Canceladas'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                        activeTab === tab 
                                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <select
                            className="px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm"
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                        >
                            <option value="All">Todos os Tipos</option>
                            <option value={TaskType.REMINDER}>Lembretes</option>
                            <option value={TaskType.MAINTENANCE}>Manutenções</option>
                            <option value={TaskType.AUDIT}>Auditorias</option>
                            <option value={TaskType.OTHER}>Outros</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Lista de Tarefas */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                                <th className="px-6 py-4 w-10">
                                    <input 
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={filteredTasks.length > 0 && selectedTasksIds.length === filteredTasks.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tarefa</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Responsável</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Prazo</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {filteredTasks.length > 0 ? (
                                filteredTasks.map((task) => (
                                    <tr 
                                        key={task.id} 
                                        className={`hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer group ${selectedTasksIds.includes(task.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                                        onClick={() => setSelectedTaskId(task.id)}
                                    >
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedTasksIds.includes(task.id)}
                                                onChange={() => toggleSelectTask(task.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                    {task.title}
                                                </span>
                                                <span className="text-xs text-gray-500 dark:text-slate-400 line-clamp-1">
                                                    {task.description}
                                                </span>
                                                {task.type === TaskType.MAINTENANCE && task.deviceId && (
                                                    <span className="text-[10px] font-medium text-blue-500 mt-1 flex items-center gap-1">
                                                        <Smartphone size={10} /> {getDeviceName(task.deviceId)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {task.type === TaskType.REMINDER && <Bell size={14} className="text-blue-500" />}
                                                {task.type === TaskType.MAINTENANCE && <Wrench size={14} className="text-amber-500" />}
                                                {task.type === TaskType.AUDIT && <ShieldCheck size={14} className="text-emerald-500" />}
                                                {task.type === TaskType.OTHER && <Tag size={14} className="text-slate-500" />}
                                                <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                                                    {task.type === TaskType.REMINDER ? 'Lembrete' :
                                                     task.type === TaskType.MAINTENANCE ? 'Manutenção' :
                                                     task.type === TaskType.AUDIT ? 'Auditoria' : 'Outro'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                task.status === TaskStatus.PENDING ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                task.status === TaskStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                            }`}>
                                                {task.status === TaskStatus.PENDING ? 'Pendente' :
                                                 task.status === TaskStatus.IN_PROGRESS ? 'Em Curso' :
                                                 task.status === TaskStatus.COMPLETED ? 'Concluída' : 'Cancelada'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-slate-400">
                                                    {task.assignedTo?.charAt(0) || '?'}
                                                </div>
                                                <span className="text-xs text-gray-700 dark:text-slate-300">
                                                    {task.assignedTo ? systemUsers.find(u => u.id === task.assignedTo)?.name || task.assignedTo : 'Geral'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {task.hasDueDate ? (
                                                <div className={`flex items-center gap-1.5 text-xs font-medium ${
                                                    task.isOverdue && task.status !== TaskStatus.COMPLETED ? 'text-rose-600 dark:text-rose-400' :
                                                    task.isNearDue && task.status !== TaskStatus.COMPLETED ? 'text-amber-600 dark:text-amber-400' :
                                                    'text-gray-600 dark:text-slate-400'
                                                }`}>
                                                    <Calendar size={14} />
                                                    {new Date(task.dueDate!).toLocaleDateString('pt-BR')}
                                                    {task.isOverdue && task.status !== TaskStatus.COMPLETED && (
                                                        <AlertCircle size={12} className="animate-pulse" />
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Sem prazo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button 
                                                className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedTaskId(task.id);
                                                }}
                                            >
                                                <ExternalLink size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
                                            <CheckSquare size={48} className="mb-4 opacity-20" />
                                            <p className="text-lg font-medium">Nenhuma tarefa encontrada</p>
                                            <p className="text-sm">Tente ajustar seus filtros ou busca.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Task Modal */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.form 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onSubmit={handleCreateTask}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Nova Tarefa</h2>
                                <button type="button" onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <XCircle size={24} className="text-slate-400" />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-4 overflow-y-auto flex-1">
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
                                    
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <Paperclip size={14} /> Anexos do Manual
                                            </h4>
                                            <label className="cursor-pointer text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-widest flex items-center gap-1">
                                                <Plus size={12} /> Adicionar
                                                <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleManualAttachmentUpload} />
                                            </label>
                                        </div>
                                        
                                        {(newTask.manualAttachments && newTask.manualAttachments.length > 0) ? (
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                {newTask.manualAttachments.map((attachment, index) => (
                                                    <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 aspect-square flex items-center justify-center">
                                                        {attachment.startsWith('data:image') ? (
                                                            <img src={attachment} alt={`Anexo ${index + 1}`} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center text-slate-400">
                                                                <FileText size={20} />
                                                                <span className="text-[9px] mt-1 font-bold">PDF</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
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
                                                                className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                                                                title="Visualizar"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemoveManualAttachment(index)}
                                                                className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm transition-colors"
                                                                title="Remover"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nenhum anexo</p>
                                                <p className="text-[9px] text-slate-400 mt-1">PDFs ou Imagens (Máx 5MB)</p>
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
                                                onChange={(e) => {
                                                    const isRecurring = e.target.checked;
                                                    setNewTask({
                                                        ...newTask, 
                                                        isRecurring,
                                                        recurrenceConfig: isRecurring ? {
                                                            type: RecurrenceType.MONTHLY_DAY,
                                                            dayOfMonth: new Date().getDate()
                                                        } : undefined
                                                    });
                                                }}
                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                                            />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Recorrente</span>
                                        </label>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Tipo de Tarefa</label>
                                        <select 
                                            value={newTask.type}
                                            onChange={(e) => setNewTask({...newTask, type: e.target.value as any})}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-slate-100 font-bold"
                                        >
                                            <option value={TaskType.REMINDER}>Lembrete</option>
                                            <option value={TaskType.MAINTENANCE}>Manutenção de Dispositivo</option>
                                            <option value={TaskType.AUDIT}>Auditoria / Inventário</option>
                                            <option value={TaskType.FILE_SEND}>Envio de Arquivo</option>
                                            <option value={TaskType.SYSTEM_ACTION}>Ação no Sistema</option>
                                            <option value={TaskType.OTHER}>Outro</option>
                                        </select>
                                    </div>

                                    {newTask.type === TaskType.MAINTENANCE && (
                                        <div className="col-span-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/40 space-y-4 animate-fade-in">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                    <Wrench size={16} />
                                                    <h4 className="text-xs font-bold uppercase tracking-wider">Detalhes da Manutenção</h4>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                                        <input 
                                                            type="checkbox"
                                                            checked={isBatchMaintenance}
                                                            onChange={(e) => {
                                                                setIsBatchMaintenance(e.target.checked);
                                                                if (!e.target.checked) setSelectedDeviceIds([]);
                                                            }}
                                                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                                                        />
                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Manutenção em Lote</span>
                                                    </label>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {!isBatchMaintenance ? (
                                                    <div className="md:col-span-2">
                                                        <label className="block text-[10px] font-black uppercase text-amber-500 dark:text-amber-600 mb-1 tracking-widest">Dispositivo Único</label>
                                                        <select 
                                                            required={newTask.type === TaskType.MAINTENANCE && !isBatchMaintenance}
                                                            value={newTask.deviceId || ''}
                                                            onChange={(e) => setNewTask({...newTask, deviceId: e.target.value})}
                                                            className="w-full p-2.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-bold dark:text-slate-100 outline-none"
                                                        >
                                                            <option value="">Selecione o dispositivo...</option>
                                                            {devices.filter(d => d.status !== DeviceStatus.RETIRED).map(device => (
                                                                <option key={device.id} value={device.id}>
                                                                    {getDeviceName(device.id)}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="md:col-span-2 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-1">
                                                                <label className="block text-[10px] font-black uppercase text-amber-500 dark:text-amber-600 mb-1 tracking-widest">Filtrar por Tipo</label>
                                                                <select 
                                                                    value={assetTypeFilter}
                                                                    onChange={(e) => {
                                                                        const typeId = e.target.value;
                                                                        setAssetTypeFilter(typeId);
                                                                        if (typeId !== 'All') {
                                                                            const filtered = devices.filter(d => {
                                                                                const model = models.find(m => m.id === d.modelId);
                                                                                return model?.typeId === typeId && d.status !== DeviceStatus.RETIRED;
                                                                            });
                                                                            setSelectedDeviceIds(filtered.map(d => d.id));
                                                                        }
                                                                    }}
                                                                    className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-bold dark:text-slate-100 outline-none"
                                                                >
                                                                    <option value="All">Todos os Tipos</option>
                                                                    {assetTypes.map(type => (
                                                                        <option key={type.id} value={type.id}>{type.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="flex items-end h-full pb-1">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setSelectedDeviceIds([])}
                                                                    className="text-[10px] font-bold text-amber-600 hover:underline uppercase tracking-wider"
                                                                >
                                                                    Limpar Seleção
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="max-h-40 overflow-y-auto p-3 bg-white dark:bg-slate-800/50 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2">
                                                            {devices
                                                                .filter(d => d.status !== DeviceStatus.RETIRED)
                                                                .filter(d => assetTypeFilter === 'All' || models.find(m => m.id === d.modelId)?.typeId === assetTypeFilter)
                                                                .map(device => (
                                                                    <label key={device.id} className="flex items-center gap-2 p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg cursor-pointer transition-colors">
                                                                        <input 
                                                                            type="checkbox"
                                                                            checked={selectedDeviceIds.includes(device.id)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setSelectedDeviceIds(prev => [...prev, device.id]);
                                                                                } else {
                                                                                    setSelectedDeviceIds(prev => prev.filter(id => id !== device.id));
                                                                                }
                                                                            }}
                                                                            className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                                                                        />
                                                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                                                            {getDeviceName(device.id)}
                                                                        </span>
                                                                    </label>
                                                                ))
                                                            }
                                                        </div>
                                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                                                            {selectedDeviceIds.length} dispositivo(s) selecionado(s)
                                                        </p>
                                                    </div>
                                                )}
                                                
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-amber-500 dark:text-amber-600 mb-1 tracking-widest">Tipo de Manutenção</label>
                                                    <select 
                                                        value={newTask.maintenanceType}
                                                        onChange={(e) => setNewTask({...newTask, maintenanceType: e.target.value as any})}
                                                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-bold dark:text-slate-100 outline-none"
                                                    >
                                                        <option value={MaintenanceType.PREVENTIVE}>Preventiva</option>
                                                        <option value={MaintenanceType.CORRECTIVE}>Corretiva</option>
                                                        <option value={MaintenanceType.AUDIT}>Auditoria</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-black uppercase text-amber-500 dark:text-amber-600 mb-1 tracking-widest">Custo Estimado (R$)</label>
                                                    <input 
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={newTask.maintenanceCost || 0}
                                                        onChange={(e) => setNewTask({...newTask, maintenanceCost: parseFloat(e.target.value)})}
                                                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs font-bold dark:text-slate-100 outline-none"
                                                        placeholder="0,00"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
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

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3 shrink-0">
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
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={onUpdateTask}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    systemUsers={systemUsers}
                    devices={devices}
                    models={models}
                />
            )}

            {/* Quick Action Bar */}
            <AnimatePresence>
                {selectedTasksIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-6"
                    >
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                                {selectedTasksIds.length}
                            </div>
                            <span className="text-sm font-bold uppercase tracking-widest whitespace-nowrap">Selecionadas</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => { setBulkActionType('status'); setIsBulkActionOpen(true); }}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider"
                            >
                                <CheckCircle2 size={16} className="text-emerald-400" /> Alterar Status
                            </button>
                            <button 
                                onClick={() => { setBulkActionType('assignee'); setIsBulkActionOpen(true); }}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-xl transition-colors text-xs font-bold uppercase tracking-wider"
                            >
                                <User size={16} className="text-blue-400" /> Alterar Responsável
                            </button>
                        </div>

                        <button 
                            onClick={() => setSelectedTasksIds([])}
                            className="ml-4 p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <XCircle size={20} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk Action Modal */}
            <AnimatePresence>
                {isBulkActionOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                    {bulkActionType === 'status' ? 'Alterar Status em Lote' : 'Alterar Responsável em Lote'}
                                </h2>
                                <button onClick={() => setIsBulkActionOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <XCircle size={24} className="text-slate-400" />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Você está alterando {selectedTasksIds.length} tarefas simultaneamente.
                                </p>

                                {bulkActionType === 'status' ? (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Novo Status</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELED].map(status => (
                                                <button
                                                    key={status}
                                                    onClick={() => setBulkValue(status)}
                                                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${
                                                        bulkValue === status 
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-none' 
                                                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300'
                                                    }`}
                                                >
                                                    {status === TaskStatus.PENDING ? 'Pendente' :
                                                     status === TaskStatus.IN_PROGRESS ? 'Em Curso' :
                                                     status === TaskStatus.COMPLETED ? 'Concluída' : 'Cancelada'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Novo Responsável</label>
                                        <select 
                                            value={bulkValue}
                                            onChange={(e) => setBulkValue(e.target.value)}
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white font-bold"
                                        >
                                            <option value="">Selecione o responsável...</option>
                                            <option value="Geral">Geral (Todos)</option>
                                            {systemUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3">
                                <button 
                                    onClick={() => setIsBulkActionOpen(false)}
                                    className="flex-1 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleBulkUpdate}
                                    disabled={!bulkValue}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50"
                                >
                                    Confirmar Alteração
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default TaskManager;
