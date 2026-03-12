
import React from 'react';
import packageJson from '../package.json';
import { X, GitCommit, Calendar, Tag, User } from 'lucide-react';

interface SystemInfoModalProps {
  onClose: () => void;
}

const versions = [
    { 
        version: packageJson.version, 
        date: 'Hoje',
        title: 'Evidência de Danos no Termo de Devolução',
        changes: [
            'Termos: Adicionado campo para registrar a condição do equipamento no momento da devolução.',
            'Termos: Adicionado campo para descrever avarias (se houver).',
            'Termos: Adicionado upload de evidência (foto/B.O.) em caso de dano.',
            'Termos: O termo gerado agora inclui a condição, descrição do dano e a imagem da evidência.',
            'Usuários: A aba de Termos no perfil do usuário agora exibe a condição e a descrição do dano, além de um botão para visualizar a evidência.',
            'Versão: Atualizado para v2.18.24.',
            'Sincronização global para v2.18.24.'
        ] 
    },
    { 
        version: '2.18.23', 
        date: 'Hoje',
        title: 'Filtro de Múltiplos Setores',
        changes: [
            'Relatórios: O filtro de Cargos/Setores agora permite a seleção múltipla.',
            'Relatórios: Interface do filtro atualizada para um dropdown com checkboxes, padronizando com o filtro de Tipos de Dispositivo.',
            'Versão: Atualizado para v2.18.23.',
            'Sincronização global para v2.18.23.'
        ] 
    },
    { 
        version: '2.18.22', 
        date: 'Hoje',
        title: 'Filtro de Tipo de Dispositivo no Relatório',
        changes: [
            'Relatórios: Adicionado filtro por Tipo de Dispositivo no Relatório de Colaboradores.',
            'Relatórios: Por padrão, o relatório agora exibe apenas colaboradores com dispositivos do tipo "Smartphone" ou "Celular", ou com chips avulsos.',
            'Relatórios: A lista de contatos foi otimizada para focar em dispositivos móveis, com a flexibilidade de incluir outros tipos via filtro.',
            'Versão: Atualizado para v2.18.22.',
            'Sincronização global para v2.18.22.'
        ] 
    },
    { 
        version: '2.18.21', 
        date: 'Hoje',
        title: 'Relatório de Colaboradores Personalizável',
        changes: [
            'Relatórios: Adicionado seletor de colunas para personalizar a visualização e exportação do relatório.',
            'Relatórios: Agora é possível escolher exibir ou ocultar: Cargo/Setor, Cód. Setor, E-mail, Linha(s) e ID Pulsus.',
            'Relatórios: A exportação para Excel respeita exatamente as colunas selecionadas em tela.',
            'Versão: Atualizado para v2.18.21.',
            'Sincronização global para v2.18.21.'
        ] 
    },
    { 
        version: '2.18.20', 
        date: 'Hoje',
        title: 'Relatório de Colaboradores e Pulsus ID',
        changes: [
            'Relatórios: O antigo relatório "Lista de Contatos" foi aprimorado e renomeado para "Relatório de Colaboradores".',
            'Relatórios: Adicionada a opção de exibir a coluna "ID Pulsus", que busca o ID do dispositivo vinculado ao colaborador.',
            'Relatórios: O filtro "Apenas com linha" agora vem desmarcado por padrão para facilitar a visualização de todos os colaboradores.',
            'Versão: Atualizado para v2.18.20.',
            'Sincronização global para v2.18.20.'
        ] 
    },
    { 
        version: '2.18.19', 
        date: 'Hoje',
        title: 'Substituição de Termos Manuais',
        changes: [
            'Termos: Agora é possível anexar um arquivo digitalizado mesmo em termos que foram "Resolvidos Manualmente".',
            'Termos: Ao fazer o upload, a marcação de "Resolvido Manualmente" é removida e o termo passa a constar como digitalizado.',
            'Versão: Atualizado para v2.18.19.',
            'Sincronização global para v2.18.19.'
        ] 
    },
    { 
        version: '2.18.18', 
        date: 'Hoje',
        title: 'Dashboard: Código do Setor em Termos Pendentes',
        changes: [
            'Dashboard: Adicionado o código do setor do dispositivo na lista de termos pendentes.',
            'Dashboard: Agora exibe "Setor: [Nome] Código: [Código]" para facilitar a identificação.',
            'Versão: Atualizado para v2.18.18.',
            'Sincronização global para v2.18.18.'
        ] 
    },
    { 
        version: '2.18.17', 
        date: 'Hoje',
        title: 'Correção na Impressão de Termos',
        changes: [
            'Termos: Corrigido o campo "Setor" no cabeçalho dos termos de entrega/devolução.',
            'Termos: Agora o sistema prioriza o código do setor vinculado ao DISPOSITIVO, evitando campos em branco para novos colaboradores ou dados incorretos.',
            'Versão: Atualizado para v2.18.17.',
            'Sincronização global para v2.18.17.'
        ] 
    },
    { 
        version: '2.18.16', 
        date: 'Hoje',
        title: 'Busca Inteligente & Normalização',
        changes: [
            'Busca: Implementada busca case-insensitive e ignorando acentos em todo o sistema (Colaboradores, Dispositivos, Chips, Contas, Modelos, Relatórios, Logs).',
            'UX: Melhoria na experiência de busca, permitindo encontrar "André" buscando por "andre" ou "Caçapava" por "cacapava".',
            'Versão: Atualizado para v2.18.16.',
            'Sincronização global para v2.18.16.'
        ] 
    },
    { 
        version: '2.18.15', 
        date: 'Ontem',
        title: 'Resolução Manual de Pendências',
        changes: [
            'Adicionada opção para resolver pendências de termos sem anexo diretamente no dashboard.',
            'Registro de justificativa obrigatória para resoluções manuais.',
            'Auditoria detalhada no colaborador, dispositivo e sistema para resoluções manuais.',
            'Restaurada exibição detalhada de dispositivos nos termos pendentes (modelo, patrimônio, serial, IMEI e data do termo).',
            'Atualizados ícones dos botões de ação nos termos pendentes para maior clareza.'
        ] 
    },
    { 
        version: '2.12.52', 
        date: 'Hoje',
        title: 'Resolução Manual de Pendências', 
        changes: [
            'Adicionada opção para resolver pendências de termos sem anexo diretamente no dashboard.',
            'Registro de justificativa obrigatória para resoluções manuais.',
            'Auditoria detalhada no colaborador, dispositivo e sistema para resoluções manuais.'
        ] 
    },
    {
    version: '2.12.51',
    date: 'Hoje',
    title: 'LCC Dashboard Redesign & Global Financials',
    changes: [
      'Dashboard: Redesign completo da seção de LCC para maior clareza e impacto visual.',
      'Dashboard: Agrupamento de métricas financeiras globais (Aquisição vs Manutenção).',
      'Dashboard: Tabela de alertas de saúde integrada com indicadores de obsolescência.',
      'Versão: Atualizado para v2.12.51.',
      'Sincronização global para v2.12.51.'
    ]
  },
    {
    version: '2.12.49',
    date: 'Hoje',
    title: 'Advanced LCC Dashboard & Financial Insights',
    changes: [
      'Dashboard: Nova seção "Saúde Financeira & LCC" com métricas globais de investimento.',
      'Dashboard: Visualização de alertas críticos de manutenção (>60%) e obsolescência (>4 anos).',
      'Dashboard: Gráfico de distribuição de custos (Aquisição vs Manutenção).',
      'Versão: Atualizado para v2.12.49.',
      'Sincronização global para v2.12.49.'
    ]
  },
    {
    version: '2.12.48',
    date: 'Hoje',
    title: 'LCC Breakdown & UI Refinement',
    changes: [
      'Financeiro: Detalhamento do LCC com separação de custos de aquisição e manutenção.',
      'UI: Melhoria visual no card de Custo do Ciclo de Vida para maior clareza.',
      'Versão: Atualizado para v2.12.48.',
      'Sincronização global para v2.12.48.'
    ]
  },
    {
    version: '2.12.47',
    date: 'Hoje',
    title: 'LCC (Life Cycle Cost) & Asset Health',
    changes: [
      'Financeiro: Implementado cálculo de LCC (Custo do Ciclo de Vida) na aba financeira dos dispositivos.',
      'Alertas: Adicionados alertas visuais para dispositivos com gastos de manutenção > 60% do valor de compra.',
      'Alertas: Adicionados alertas para dispositivos com mais de 4 anos de uso.',
      'Dashboard: Nova seção de "Saúde dos Ativos" com indicadores de LCC e obsolescência.',
      'Versão: Atualizado para v2.12.47.',
      'Sincronização global para v2.12.47.'
    ]
  },
    {
    version: '2.12.46',
    date: 'Hoje',
    title: 'Enhanced Device Search',
    changes: [
      'Busca: Agora é possível pesquisar dispositivos pelo nome do colaborador responsável.',
      'Busca: Adicionada pesquisa pelo número do chip (linha) vinculado ao dispositivo.',
      'Versão: Atualizado para v2.12.46.',
      'Sincronização global para v2.12.46.'
    ]
  },
    {
    version: '2.12.45',
    date: 'Hoje',
    title: 'Infrastructure Renaming & Port Updates',
    changes: [
      'Docker: Renomeados containers para it-asset-new-api e it-asset-new-app.',
      'Portas: Alterada porta da API para 5002 e do App para 8084 no docker-compose.',
      'Versão: Atualizado para v2.12.45.',
      'Sincronização global para v2.12.45.'
    ]
  },
    {
    version: '2.12.44',
    date: 'Hoje',
    title: 'Vite Build & Docker Optimization',
    changes: [
      'Build: Removido tsc do processo de build para garantir sucesso na compilação do Docker.',
      'Docker: Simplificado Dockerfile removendo lógica legada do CRA e adaptando para Vite.',
      'Configuração: Definido outDir para "build" no vite.config.ts para manter compatibilidade com Nginx.',
      'Versão: Atualizado para v2.12.44.',
      'Sincronização global para v2.12.44.'
    ]
  },
    {
    version: '2.12.43',
    date: 'Hoje',
    title: 'Deployment Optimization & Dependency Cleanup',
    changes: [
      'Infraestrutura: Removido react-scripts e dependências legadas para resolver erro de build no Portainer.',
      'Dependências: Organizado devDependencies e atualizado TypeScript/Vite para versões estáveis.',
      'Versão: Atualizado para v2.12.43.',
      'Sincronização global para v2.12.43.'
    ]
  },
    {
    version: '2.12.42',
    date: 'Hoje',
    title: 'Vite Environment & Sync Stability',
    changes: [
      'Ambiente: Configurado proxy do Vite para evitar conflitos de rotas API/SPA.',
      'Estabilidade: Corrigido erro de "Unexpected token <" na detecção de ambiente.',
      'Versão: Atualizado para v2.12.42 em todos os componentes.',
      'Sincronização global para v2.12.42.'
    ]
  },
    {
    version: '2.12.41',
    date: 'Hoje',
    title: 'Admin Panel Restoration & Visual Consistency',
    changes: [
      'Administração: Restauradas as abas "Acesso", "Geral" e "Editor de Termos" com CRUD funcional.',
      'Acesso: Implementado gerenciamento de operadores e administradores do sistema.',
      'Geral: Adicionado formulário para edição de nome do app, logo e CNPJ.',
      'Editor de Termos: Novo editor dinâmico para personalização de cláusulas e declarações (Entrega/Devolução).',
      'Importação: Adicionado suporte completo ao Dark Mode (Modo Escuro).',
      'Sincronização global para v2.12.41.'
    ]
  },
    {
    version: '2.12.40',
    date: 'Ontem',
    title: 'TypeScript Stability & Missing Properties',
    changes: [
      'Correção de Tipos: Adicionadas as propriedades hasFile e hasInvoice às interfaces globais no types.ts.',
      'Estabilidade: Resolvidos erros de compilação nos módulos Dashboard, DeviceManager e UserManager.',
      'Sincronização global para v2.12.40.'
    ]
  },
    {
    version: '2.12.39',
    date: '02/2025',
    title: 'Visual Standardization & Column Fixes',
    changes: [
      'Colaboradores: Adicionados contadores de itens ao lado dos títulos das abas no modal de detalhes.',
      'Correção de Lista: Ativadas as colunas dinâmicas "Número de Chip" e "Detalhes do Aparelho" na listagem de colaboradores.',
      'Lógica de Chips: A coluna de chip vinculado agora exibe chips diretos E chips vinculados via dispositivo em posse.',
      'Dispositivos: Indicador visual (bolinha verde/amarela) na aba Financeiro para monitoramento rápido de Nota Fiscal e Anexo.',
      'Sincronização global para v2.12.39.'
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
