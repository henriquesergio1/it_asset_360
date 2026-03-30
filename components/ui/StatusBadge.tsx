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
  let colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
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
      colorClass = 'bg-emerald-900/30 text-emerald-400 border-emerald-900/50';
      if (normalizedStatus === 'AVAILABLE') label = 'Disponível';
      if (normalizedStatus === 'ACTIVE') label = 'Ativo';
      if (normalizedStatus === 'COMPLETED') label = 'Concluída';
      break;

    // Blue (In Use / In Progress)
    case 'IN_USE':
    case 'EM USO':
    case 'IN_PROGRESS':
    case 'EM ANDAMENTO':
      colorClass = 'bg-blue-900/30 text-blue-400 border-blue-900/50';
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
      colorClass = 'bg-amber-900/30 text-amber-400 border-amber-900/50';
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
      colorClass = 'bg-rose-900/30 text-rose-400 border-rose-900/50';
      if (normalizedStatus === 'RETIRED') label = 'Aposentado';
      if (normalizedStatus === 'INACTIVE') label = 'Inativo';
      if (normalizedStatus === 'CANCELLED') label = 'Cancelada';
      break;
      
    default:
      colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
  }

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${colorClass} ${className}`}>
      {label}
    </span>
  );
};
