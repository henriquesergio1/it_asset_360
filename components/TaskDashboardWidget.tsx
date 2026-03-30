import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Clock } from 'lucide-react';
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
          <p className="text-[10px] text-slate-500">Nenhuma tarefa pendente</p>
        </div>
      ) : (
        pendingTasks.slice(0, 5).map(task => (
          <div 
            key={task.id} 
            onClick={() => onTaskClick(task)}
            className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 flex items-center justify-between group hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex flex-1 items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] shrink-0 ${
                task.isOverdue ? 'bg-red-900/30 text-red-400' : 
                task.isNearDue ? 'bg-amber-900/30 text-amber-400' : 
                'bg-indigo-900/30 text-indigo-400'
              }`}>
                {getAssignedUserName(task.assignedTo).charAt(0)}
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:gap-x-2 flex-wrap">
                <p className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">
                  {task.title}
                </p>
                <p className={`text-[9px] px-1 py-0 rounded font-bold uppercase tracking-tighter w-fit md:mt-0 ${
                  task.type === 'Manutenção' ? 'bg-blue-900/30 text-blue-400' :
                  task.type === 'Envio de Arquivo' ? 'bg-purple-900/30 text-purple-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {task.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-x-2 shrink-0">
              <div className={`text-[9px] flex items-center gap-1 font-bold ${
                task.isOverdue ? 'text-red-500' : 
                task.isNearDue ? 'text-amber-500' : 
                'text-slate-500'
              }`}>
                <Clock size={9} />
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
              </div>
              <div className={`w-1.5 h-1.5 rounded-full ${
                task.isOverdue ? 'bg-red-500 animate-pulse' : 
                task.isNearDue ? 'bg-amber-500' : 
                'bg-slate-600'
              }`} />
            </div>
          </div>
        ))
      )}
      {pendingTasks.length > 5 && (
        <button 
          onClick={onViewAll}
          className="w-full py-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:bg-slate-900 rounded-lg transition-all"
        >
          Ver mais {pendingTasks.length - 5} tarefas
        </button>
      )}
    </div>
  );
};
