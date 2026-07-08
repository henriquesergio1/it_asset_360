import React from 'react';

type StatusType = 
  | 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED' // Devices
  | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' // SimCards
  | 'Ativo' | 'Inativo' | 'Afastado' // Users / Accounts
  | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' // Tasks
  | string;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  let colorClass = 'bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
  let label = status;

  // Normalize status string for matching
  const normalizedStatus = status.toUpperCase();

  switch (normalizedStatus) {
    // Green (Available / Active / Completed)
    case 'AVAILABLE':
    case 'DISPONÍVEL':
    case 'ACTIVE':
    case 'ATIVO':
    case 'COMPLETED':
    case 'CONCLUÍDA':
      colorClass = 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30';
      if (normalizedStatus === 'AVAILABLE') label = 'Disponível';
      if (normalizedStatus === 'ACTIVE') label = 'Ativo';
      if (normalizedStatus === 'COMPLETED') label = 'Concluída';
      break;

    // Blue (In Use / In Progress)
    case 'IN_USE':
    case 'EM USO':
    case 'IN_PROGRESS':
    case 'EM ANDAMENTO':
      colorClass = 'bg-blue-100 dark:bg-sky-500/20 text-blue-600 dark:text-sky-400 border-blue-200 dark:border-sky-500/30';
      if (normalizedStatus === 'IN_USE') label = 'Em Uso';
      if (normalizedStatus === 'IN_PROGRESS') label = 'Em Andamento';
      break;

    // Orange/Yellow (Maintenance / Pending / Suspended / Afastado)
    case 'MAINTENANCE':
    case 'MANUTENÇÃO':
    case 'EM MANUTENÇÃO':
    case 'PENDING':
    case 'PENDENTE':
    case 'SUSPENDED':
    case 'SUSPENSO':
    case 'AFASTADO':
      colorClass = 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30';
      if (normalizedStatus === 'MAINTENANCE') label = 'Manutenção';
      if (normalizedStatus === 'PENDING') label = 'Pendente';
      if (normalizedStatus === 'SUSPENDED') label = 'Suspenso';
      if (normalizedStatus === 'AFASTADO') label = 'Afastado';
      break;

    // Red (Retired / Inactive / Cancelled / Error)
    case 'RETIRED':
    case 'APOSENTADO':
    case 'INACTIVE':
    case 'INATIVO':
    case 'CANCELLED':
    case 'CANCELADA':
    case 'ERROR':
      colorClass = 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30';
      if (normalizedStatus === 'RETIRED') label = 'Aposentado';
      if (normalizedStatus === 'INACTIVE') label = 'Inativo';
      if (normalizedStatus === 'CANCELLED') label = 'Cancelada';
      break;
      
    default:
      colorClass = 'bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
  }

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${colorClass} ${className}`}>
      {label}
    </span>
  );
};
