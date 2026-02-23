
import React from 'react';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    {
    version: '2.12.46',
    date: 'Hoje',
    title: 'Database Configuration Resilience',
    changes: [
      'Estabilidade: Tratamento de erro 500/503 quando o SQL Server não está configurado.',
      'Recuperação: Ativação automática do modo Mock em caso de falha de configuração da API.',
      'Sincronização global para v2.12.46.'
    ]
  },
    {
    version: '2.12.45',
    date: 'Hoje',
    title: 'Emergency Recovery Fix',
    changes: [
      'Recuperação: Correção do botão de "Modo de Emergência (Mock)" na tela de login.',
      'Estabilidade: Ajuste na detecção automática de ambiente para maior resiliência.',
      'Sincronização global para v2.12.45.'
    ]
  },
    {
    version: '2.12.44',
    date: 'Hoje',
    title: 'Vite Migration & Dev Environment Fix',
    changes: [
      'Infraestrutura: Migração do ambiente de desenvolvimento para Vite + Express (Full-Stack).',
      'Correção de Bug: Resolvido problema de carregamento da tela de login no modo desenvolvimento.',
      'Sincronização global para v2.12.44.'
    ]
  },
    {
    version: '2.12.40',
    date: 'Hoje',
    title: 'TypeScript Stability & Missing Properties',
    changes: [
      'Correção de Tipos: Adicionadas as propriedades hasFile e hasInvoice às interfaces globais no types.ts.',
      'Estabilidade: Resolvidos erros de compilação nos módulos Dashboard, DeviceManager e UserManager.',
      'Sincronização global para v2.12.40.'
    ]
  },
    {
    version: '2.12.39',
    date: 'Ontem',
    title: 'Visual Standardization & Column Fixes',
    changes: [
      'Colaboradores: Adicionados contadores de itens ao lado dos títulos das abas no modal de detalhes.',
      'Correção de Lista: Ativadas as colunas dinâmicas "Número de Chip" e "Detalhes do Aparelho" na listagem de colaboradores.',
      'Lógica de Chips: A coluna de chip vinculado agora exibe chips diretos E chips vinculados via dispositivo em posse.',
      'Dispositivos: Indicador visual (bolinha verde/amarela) na aba Financeiro para monitoramento rápido de Nota Fiscal e Anexo.',
      'Sincronização global para v2.12.39.'
    ]
  },
    {
    version: '2.12.38',
    date: '02/2025',
    title: 'Critical Fix: Term File Management',
    changes: [
      'Correção de Bug: Implementados endpoints ausentes para upload e exclusão de termos digitalizados (Fix 404 error).',
      'Auditoria de Anexos: Inclusão automática de logs de auditoria ao digitalizar ou remover arquivos de termos.',
      'Sincronização de Estado: Atualização global para v2.12.38.'
    ]
  }
];

const SystemInfoModal: React.FC<SystemInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-300">
        <div className="bg-slate-900 px-8 py-6 flex justify-between items-start shrink-0 relative border-b dark:border-slate-800">
          <div className="relative z-10"><h2 className="text-2xl font-bold text-white mb-1">Sobre o Sistema</h2><p className="text-slate-400 text-sm">IT Asset 360 - Gestão Inteligente de Ativos</p></div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors relative z-10"><X size={24} /></button>
          <div className="absolute -right-10 -top-10 text-slate-800 opacity-50"><GitCommit size={150} /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><GitCommit className="text-blue-600" size={20}/> Histórico de Versões</h3>
          <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-8 pb-4">
            {versions.map((ver, index) => (
              <div key={index} className="relative pl-8">
                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${index === 0 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>v{ver.version}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={12}/> {ver.date}</span>
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{ver.title}</h4>
                <ul className="space-y-1">{ver.changes.map((change, i) => (<li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0"></span>{change}</li>))}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 px-8 py-4 text-center"><p className="text-xs text-slate-400">© 2025 IT Asset 360. Todos os direitos reservados.</p></div>
      </div>
    </div>
  );
};

export default SystemInfoModal;