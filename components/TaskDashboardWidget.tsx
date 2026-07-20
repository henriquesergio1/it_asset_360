import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Clock } from 'lucide-react';
import { parseLocalDate } from './recurrenceUtils';
import { UI_ICON_SIZE_SMALL } from '../constants';
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
      const aIsMineOrGeral = !a.assignedTo || a.assignedTo === currentUserId;
      const bIsMineOrGeral = !b.assignedTo || b.assignedTo === currentUserId;
      if (aIsMineOrGeral && !bIsMineOrGeral) return -1;
      if (!aIsMineOrGeral && bIsMineOrGeral) return 1;
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });

  const getAssignedUserName = (assignedTo?: string) => {
    if (!assignedTo) return 'Geral';
    const user = systemUsers.find(u => u.id === assignedTo);
    return user ? user.name : assignedTo;
  };

  return (
    <div className="space-y-1">
      {pendingTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-4">
          <ClipboardList size={20} strokeWidth={1.5} className="mb-1 text-slate-600"/>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Nenhuma tarefa pendente</p>
        </div>
      ) : (
        pendingTasks.slice(0, 5).map(task => (
          <div 
            key={task.id} 
            onClick={() => onTaskClick(task)}
            className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 flex items-center justify-between group hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
          >
            <div className="flex flex-1 items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                task.isOverdue ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40' : 
                task.isNearDue ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40' : 
                'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40'
              }`}>
                {getAssignedUserName(task.assignedTo).charAt(0)}
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:gap-x-3 flex-wrap">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-sky-400 transition-colors">
                  {task.title}
                </p>
                <p className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider w-fit md:mt-0 ${
                  task.type === 'Manutenção' ? 'bg-blue-100 text-blue-700 dark:bg-sky-500/20 dark:text-sky-300 border border-blue-200 dark:border-sky-800/40' :
                  task.type === 'Envio de Arquivo' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40' :
                  'bg-slate-200/70 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300 border border-slate-300 dark:border-slate-600'
                }`}>
                  {task.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-x-3 shrink-0">
              <div className={`text-[11px] flex items-center gap-1 font-bold ${
                task.isOverdue ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40 px-2 py-0.5 rounded-md' : 
                task.isNearDue ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 px-2 py-0.5 rounded-md' : 
                'text-slate-500 dark:text-slate-400'
              }`}>
                <Clock size={UI_ICON_SIZE_SMALL} />
                {task.dueDate ? parseLocalDate(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${
                task.isOverdue ? 'bg-rose-500 animate-pulse' : 
                task.isNearDue ? 'bg-amber-500' : 
                'bg-slate-400 dark:bg-slate-500'
              }`} />
            </div>
          </div>
        ))
      )}
      {pendingTasks.length > 5 && (
        <button 
          onClick={onViewAll}
          className="w-full py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-white dark:bg-slate-800 rounded-lg transition-all"
        >
          Ver mais {pendingTasks.length - 5} tarefas
        </button>
      )}
    </div>
  );
};
