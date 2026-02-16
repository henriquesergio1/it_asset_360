
import React from 'react';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    {
    version: '2.12.37',
    date: 'Hoje',
    title: 'Advanced Asset Snapshotting & Heuristics',
    changes: [
      'Persistência Histórica: Operações de entrega e devolução agora salvam snapshots JSON completos no log de auditoria.',
      'Rastreabilidade de Termos: Heurística de re-impressão aprimorada para localizar ativos mesmo após mudanças de identificador no cadastro principal.',
      'Sincronização de Estado: Garantia de integridade de metadados durante o ciclo de vida do ativo.',
      'Incremento global para v2.12.37.'
    ]
  },
    {
    version: '2.12.36',
    date: 'Ontem',
    title: 'Robust Multi-Identifier Asset Matching',
    changes: [
      'Identificação Infalível: Novos termos agora incluem obrigatoriamente o IMEI do ativo na string de detalhes.',
      'Lógica de Re-impressão: O sistema prioriza IMEI > Tag > S/N para localizar o ativo exato no inventário.',
      'Isolamento de Usuário: Fallback heurístico agora restringe a busca ao dono do termo, impedindo que ativos de outros colaboradores apareçam por engano.'
    ]
  }
];

const SystemInfoModal: React.FC<SystemInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors duration-300">
        <div className="bg-slate-900 px-8 py-6 flex justify-between items-start shrink-0 relative border-b dark:border-slate-800">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-1">Sobre o Sistema</h2>
            <p className="text-slate-400 text-sm">IT Asset 360 - Gestão Inteligente de Ativos</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors relative z-10">
            <X size={24} />
          </button>
          <div className="absolute -right-10 -top-10 text-slate-800 opacity-50">
             <GitCommit size={150} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <GitCommit className="text-blue-600 dark:text-blue-400" size={20}/> Histórico de Versões
          </h3>
          <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-8 pb-4">
            {versions.map((ver, index) => (
              <div key={index} className="relative pl-8">
                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 shadow-sm ${index === 0 ? 'bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/20' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${index === 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>v{ver.version}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1"><Calendar size={12}/> {ver.date}</span>
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-2">{ver.title}</h4>
                <ul className="space-y-1">{ver.changes.map((change, i) => (<li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-600 shrink-0"></span>{change}</li>))}</ul>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 px-8 py-4 text-center"><p className="text-xs text-slate-400 dark:text-slate-500">© 2025 IT Asset 360. Todos os direitos reservados.</p></div>
      </div>
    </div>
  );
};

export default SystemInfoModal;
