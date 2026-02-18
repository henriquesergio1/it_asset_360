import React from 'react';
import { X, GitCommit, Calendar, Tag, User, Command, Zap } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    {
    version: '3.5.0',
    date: 'Hoje',
    title: 'HELIOS IT: Full Recall & Bidirectional Audit',
    changes: [
      'Document Recall: Implementação de snapshots JSON em termos para permitir reimpressão fiel (mantém acessórios da época).',
      'Audit 360: Auditoria bidirecional agora gera logs tanto no dispositivo quanto no histórico do colaborador envolvido.',
      'UX Flow: Restaurado o botão de impressão direta na aba de termos do colaborador.',
      'Data Integrity: Adicionado campo SnapshotData no banco para persistência de estado histórico.',
      'Versioning: Sincronização global para v3.5.0.'
    ]
  },
    {
    version: '3.4.9',
    date: 'Fev/2025',
    title: 'HELIOS IT: Audit UX Standardization',
    changes: [
      'Audit Focus: Padronização do detalhamento de logs entre Dispositivos e Colaboradores.',
      'UI Consistency: Renderização de comparação "De/Para" estruturada diretamente na linha do tempo.',
      'Technical Clarity: Tradução de IDs técnicos para nomes amigáveis em tempo real.',
      'UX Flow: Destaque visual para alterações de campos críticos via tags semânticas.'
    ]
  },
    {
    version: '3.4.8',
    date: 'Fev/2025',
    title: 'HELIOS IT: Pulsus MDM Integration & Quick Actions',
    changes: [
      'MDM Integration: Suporte visual e links diretos para dispositivos no Pulsus MDM via ID cadastrado.',
      'Table Layout: Adição da coluna ID Pulsus e botões de ação rápida para acesso ao MDM.',
      'UI Refinement: Reposicionamento do Serial Number para Identidade Primária.',
      'Clean UI: Remoção do campo Centro de Custo no formulário de ativos.'
    ]
  }
];

const SystemInfoModal: React.FC<SystemInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all duration-300 border border-white/20">
        <div className="bg-indigo-600 px-10 py-10 flex justify-between items-start shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Command size={240} className="rotate-12"/>
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full w-fit mb-4">
                <Zap size={14} className="text-yellow-300 fill-yellow-300"/>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Release Helios 3.5.0</span>
            </div>
            <h2 className="text-4xl font-extrabold text-white mb-1 tracking-tight">Sobre o Helios</h2>
            <p className="text-indigo-100 text-sm font-medium">Smart Asset Intelligence Platform</p>
          </div>
          <button onClick={onClose} className="h-10 w-10 bg-black/20 hover:bg-black/40 text-white rounded-full flex items-center justify-center transition-colors relative z-10 cursor-pointer">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 bg-white dark:bg-slate-900">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
            <GitCommit className="text-indigo-600" size={16}/> Roadmap de Evolução
          </h3>
          <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 space-y-12 pb-4">
            {versions.map((ver, index) => (
              <div key={index} className="relative pl-10">
                <div className={`absolute -left-[11px] top-1 h-5 w-5 rounded-full border-4 border-white dark:border-slate-900 shadow-lg ${index === 0 ? 'bg-indigo-600 ring-8 ring-indigo-500/10' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <span className={`px-3 py-1 rounded-xl text-xs font-black border transition-colors ${index === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>v{ver.version}</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> {ver.date}</span>
                </div>
                <h4 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-tight">{ver.title}</h4>
                <ul className="space-y-2.5">
                    {ver.changes.map((change, i) => (
                        <li key={i} className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-3 leading-relaxed">
                            <div className="mt-2 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0"></div>
                            {change}
                        </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-950 px-10 py-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center transition-colors">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2025 IT ASSET 360 • HELIOS DS</p>
            <div className="flex gap-4">
                <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                <div className="h-2 w-2 rounded-full bg-violet-500"></div>
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SystemInfoModal;