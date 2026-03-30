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
 <div className="space-y-2">
 {pendingTasks.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-6">
 <ClipboardList size={24} strokeWidth={1.5} className="mb-2 opacity-20"/>
 <p className="text-xs">Nenhuma tarefa pendente</p>
 </div>
 ) : (
 pendingTasks.slice(0, 5).map(task => (
 <div 
 key={task.id} 
 onClick={() => onTaskClick(task)}
 className="bg-slate-900/80 p-3 rounded-lg border border-indigo-900/50 flex items-center justify-between group hover:border-indigo-300 hover:border-indigo-700 transition-all cursor-pointer shadow-none"
 >
 <div className="flex flex-1 items-center gap-3">
 <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
 task.isOverdue ? ' bg-red-900/40 ' : 
 task.isNearDue ? ' bg-amber-900/40 ' : 
 ' bg-indigo-900/40 '
 }`}>
 {getAssignedUserName(task.assignedTo).charAt(0)}
 </div>
 <div className="flex flex-col md:flex-row md:items-center md:gap-x-4 flex-wrap">
 <p className="text-sm font-bold text-slate-200 group-hover:text-indigo-600 group-hover:text-indigo-400 transition-colors">
 {task.title}
 </p>
 <p className={`text-[10px] px-1 py-0.5 rounded font-bold uppercase tracking-tighter w-fit md:mt-0 ${
 task.type === 'Manutenção' ? ' bg-blue-900/30 text-blue-400' :
 task.type === 'Envio de Arquivo' ? 'bg-purple-50 bg-purple-900/30 text-purple-600 text-purple-400' :
 ' bg-slate-800 '
 }`}>
 {task.type}
 </p>
 <p className="text-[10px] uppercase font-black tracking-tighter md:mt-0">
 Resp: {getAssignedUserName(task.assignedTo)}
 </p>
 <p className={`text-[10px] font-bold uppercase tracking-widest md:mt-0 ml-auto md:ml-0 ${
 task.isOverdue ? '' : 
 task.isNearDue ? '' : 
 ''
 }`}>
 {task.isOverdue ? 'Atrasada' : task.isNearDue ? 'Próxima do Vencimento' : 'Pendente'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-x-4 shrink-0">
 <div className={`text-[10px] flex items-center gap-1 font-bold ${
 task.isOverdue ? ' text-red-400' : 
 task.isNearDue ? ' text-amber-400' : 
 ' '
 }`}>
 <Clock size={10} />
 {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo'}
 </div>
 <div className={`w-2 h-2 rounded-full ${
 task.isOverdue ? 'bg-red-500 animate-pulse' : 
 task.isNearDue ? 'bg-amber-500' : 
 'bg-slate-300 bg-slate-600'
 }`} />
 </div>
 </div>
 ))
 )}
 {pendingTasks.length > 5 && (
 <button 
 onClick={onViewAll}
 className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-900/40 rounded-lg transition-all"
 >
 Ver mais {pendingTasks.length - 5} tarefas
 </button>
 )}
 </div>
 );
};
