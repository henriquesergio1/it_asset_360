import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, AlertCircle, Clock, ChevronRight, User } from 'lucide-react';
import { Task, TaskStatus, SystemUser } from '../types';

interface TaskDashboardWidgetProps {
    tasks: Task[];
    onViewAll: () => void;
    onTaskClick: (task: Task) => void;
    systemUsers: SystemUser[];
    currentUserId: string;
}

export const TaskDashboardWidget: React.FC<TaskDashboardWidgetProps> = ({ tasks, onViewAll, onTaskClick, systemUsers, currentUserId }) => {
    const pendingTasks = tasks
        .filter(t => t.status === TaskStatus.PENDING || t.status === TaskStatus.IN_PROGRESS)
        .sort((a, b) => {
            // 1. Sort by assigned to current user OR Geral
            const aIsMineOrGeral = !a.assignedTo || a.assignedTo === currentUserId;
            const bIsMineOrGeral = !b.assignedTo || b.assignedTo === currentUserId;
            if (aIsMineOrGeral && !bIsMineOrGeral) return -1;
            if (!aIsMineOrGeral && bIsMineOrGeral) return 1;

            // 2. Sort by due date (closest first)
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return dateA - dateB;
        });

    const overdueCount = pendingTasks.filter(t => t.isOverdue).length;
    const nearDueCount = pendingTasks.filter(t => t.isNearDue).length;

    const getAssignedUserName = (assignedTo?: string) => {
        if (!assignedTo) return 'Geral';
        const user = systemUsers.find(u => u.id === assignedTo);
        return user ? user.name : assignedTo;
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col h-full transition-colors">
            <div className="p-3 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                        <ClipboardList size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Gestão de Tarefas</h3>
                </div>
                <button 
                    onClick={onViewAll}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                    Ver Tudo <ChevronRight size={12} />
                </button>
            </div>

            <div className="p-3 flex gap-3 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex-1 p-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-red-600 dark:text-red-400">{overdueCount}</span>
                    <span className="text-[9px] uppercase tracking-wider font-black text-red-500 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle size={8} /> Atrasadas
                    </span>
                </div>
                <div className="flex-1 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-amber-600 dark:text-amber-400">{nearDueCount}</span>
                    <span className="text-[9px] uppercase tracking-wider font-black text-amber-500 dark:text-amber-400 flex items-center gap-1">
                        <Clock size={8} /> No Prazo
                    </span>
                </div>
                <div className="flex-1 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-black text-slate-600 dark:text-slate-400">{pendingTasks.length}</span>
                    <span className="text-[9px] uppercase tracking-wider font-black text-slate-500 dark:text-slate-400">Pendentes</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-[220px]">
                {pendingTasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-6">
                        <ClipboardList size={24} strokeWidth={1.5} className="mb-2 opacity-20" />
                        <p className="text-xs">Nenhuma tarefa pendente</p>
                    </div>
                ) : (
                    pendingTasks.slice(0, 5).map(task => (
                        <button
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-slate-700 group"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {task.title}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-tighter ${
                                            task.type === 'Manutenção' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                            task.type === 'Envio de Arquivo' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        }`}>
                                            {task.type}
                                        </span>
                                        <span className={`text-[9px] flex items-center gap-1 font-bold ${
                                            task.isOverdue ? 'text-red-600 dark:text-red-400' : 
                                            task.isNearDue ? 'text-amber-600 dark:text-amber-400' : 
                                            'text-slate-500 dark:text-slate-400'
                                        }`}>
                                            <Clock size={8} />
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
                                        </span>
                                        <span className="text-[9px] flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                                            <User size={8} />
                                            {getAssignedUserName(task.assignedTo)}
                                        </span>
                                    </div>
                                </div>
                                <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                                    task.isOverdue ? 'bg-red-500 animate-pulse' : 
                                    task.isNearDue ? 'bg-amber-500' : 
                                    'bg-slate-300 dark:bg-slate-600'
                                }`} />
                            </div>
                        </button>
                    ))
                )}
                {pendingTasks.length > 5 && (
                    <button 
                        onClick={onViewAll}
                        className="w-full py-1.5 text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold uppercase tracking-wider transition-colors"
                    >
                        + {pendingTasks.length - 5} outras tarefas
                    </button>
                )}
            </div>
        </div>
    );
};
