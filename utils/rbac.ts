import { Perfil, Usuario } from '../types';

/**
 * Função utilitária centralizada para verificar permissões de um usuário.
 * 
 * @param user Usuário ou objeto de perfil com permissões.
 * @param key Chave de permissão solicitada.
 * @returns boolean indicando se a permissão foi concedida.
 */
export function hasPermission(user: any, key: string): boolean {
  if (!user) return false;

  // Extrai o objeto de permissões de várias formas possíveis para máxima robustez
  const permissoes = user.Permissoes || user.permissoes || user.permissions || 
                     (user.perfil && (user.perfil.Permissoes || user.perfil.permissoes)) ||
                     (typeof user === 'object' && !('id' in user) && !('fullName' in user) ? user : null);

  if (!permissoes) {
    // Fallback de segurança para administradores legados baseados em role
    if (user.role === 'ADMIN') {
      return true;
    }
    return false;
  }

  // Se o perfil do usuário possuir a flag 'admin' ativa, retorna true para
  // qualquer permissão solicitada (exceto para modificar a própria flag 'admin')
  if (key !== 'admin' && (permissoes.admin === true || permissoes.ADMIN === true)) {
    return true;
  }

  // Verifica a permissão direta (ex: user.Permissoes[key])
  if (permissoes[key] !== undefined) {
    return !!permissoes[key];
  }

  // Mapeamento de fallback (legacy) para chaves antigas de grupos genéricos que se dividiram
  const legacyMapping: Record<string, string> = {
    // Novas chaves para chaves antigas
    'dashboard_leitura': 'dispositivos_leitura',
    'chips_leitura': 'dispositivos_leitura',
    'chips_escrita': 'dispositivos_escrita',
    'licencas_leitura': 'financeiro_leitura',
    'licencas_escrita': 'financeiro_escrita',
    'consumiveis_leitura': 'financeiro_leitura',
    'consumiveis_escrita': 'financeiro_escrita',
    'tarefas_leitura': 'dispositivos_leitura',
    'tarefas_escrita': 'dispositivos_escrita',
    'relatorios_leitura': 'faturamento_leitura',
    'relatorios_escrita': 'faturamento_escrita',
    'entrega_leitura': 'dispositivos_escrita',
    'entrega_escrita': 'dispositivos_escrita',
    
    // Fluxo
    'fluxo_leitura': 'fluxo',
    'fluxo_escrita': 'fluxo',
    // Faturamento
    'faturamento_leitura': 'faturamento',
    'faturamento_escrita': 'faturamento',
    // Financeiro
    'financeiro_leitura': 'financeiro',
    'financeiro_escrita': 'financeiro',
    // Vendas
    'vendas_leitura': 'vendas',
    'vendas_escrita': 'vendas',
    // Dispositivos/Ativos
    'dispositivos_leitura': 'dispositivos',
    'dispositivos_escrita': 'dispositivos',
    'ativos_leitura': 'ativos',
    'ativos_escrita': 'ativos',
    // Colaboradores/Usuários
    'usuarios_leitura': 'usuarios',
    'usuarios_escrita': 'usuarios',
    'colaboradores_leitura': 'colaboradores',
    'colaboradores_escrita': 'colaboradores',
    // Painéis/Relatórios
    'paineis_leitura': 'paineis',
    'paineis_escrita': 'paineis',
  };

  const legacyKey = legacyMapping[key];
  if (legacyKey && permissoes[legacyKey] !== undefined) {
    return !!permissoes[legacyKey];
  }

  return false;
}

/**
 * Resolve as permissões dinamicamente para um usuário com base no seu perfil cadastrado.
 */
export function resolveUserPermissions(user: any, customProfiles?: Perfil[]): any {
  if (!user) return null;

  let profiles: Perfil[] = customProfiles && customProfiles.length > 0 ? customProfiles : [];
  if (profiles.length === 0) {
    const saved = localStorage.getItem('rbac_profiles');
    if (saved) {
      try {
        profiles = JSON.parse(saved);
      } catch (e) {}
    }
  }

  // Se não houver perfis cadastrados, usa os padrões iniciais
  if (profiles.length === 0) {
    profiles = [
      {
        ID_Perfil: 1,
        Nome: 'Administrador TI',
        Ativo: true,
        Permissoes: { admin: true }
      },
      {
        ID_Perfil: 2,
        Nome: 'Operador Suporte',
        Ativo: true,
        Permissoes: {
          dashboard_leitura: true,
          dispositivos_leitura: true,
          dispositivos_escrita: true,
          colaboradores_leitura: true,
          colaboradores_escrita: true,
          ativos_leitura: true,
          ativos_escrita: false,
          financeiro_leitura: true
        }
      },
      {
        ID_Perfil: 3,
        Nome: 'Financeiro e Compras',
        Ativo: true,
        Permissoes: {
          financeiro_leitura: true,
          financeiro_escrita: true,
          faturamento_leitura: true,
          faturamento_escrita: true
        }
      },
      {
        ID_Perfil: 4,
        Nome: 'Gestor de R.H.',
        Ativo: true,
        Permissoes: {
          rh_dashboard: true,
          rh_dashboard_leitura: true,
          rh_dashboard_escrita: true,
          rh_colaboradores: true,
          rh_colaboradores_leitura: true,
          rh_colaboradores_escrita: true,
          rh_comodatos: true,
          rh_comodato_leitura: true,
          rh_comodato_escrita: true,
          rh_atestados: true,
          rh_ocorrencias_leitura: true,
          rh_ocorrencias_escrita: true,
          rh_modelos_leitura: true,
          rh_modelos_escrita: true,
          rh_estoque_leitura: true,
          rh_estoque_escrita: true,
          rh_relatorios_leitura: true,
          rh_relatorios_escrita: true
        }
      },
      {
        ID_Perfil: 5,
        Nome: 'Colaborador / Self-Service',
        Ativo: true,
        Permissoes: {
          self_service: true
        }
      }
    ];
    localStorage.setItem('rbac_profiles', JSON.stringify(profiles));
  }

  const userProfileId = user.ID_Perfil || user.idPerfil || (user.role && !isNaN(Number(user.role)) ? Number(user.role) : null);
  const profile = userProfileId ? profiles.find(p => Number(p.ID_Perfil) === Number(userProfileId)) : null;

  if (profile) {
    const finalPerms = (profile.Permissoes && Object.keys(profile.Permissoes).length > 0)
      ? profile.Permissoes
      : (user.Permissoes || user.permissoes || {});
    return {
      ...user,
      ID_Perfil: profile.ID_Perfil,
      idPerfil: profile.ID_Perfil,
      Nome_Perfil: profile.Nome,
      Permissoes: finalPerms,
      permissoes: finalPerms
    };
  }

  // Se o usuário possui um dicionário de permissões vindo diretamente do backend
  const userDirectPerms = user.Permissoes || user.permissoes;
  if (userDirectPerms && typeof userDirectPerms === 'object' && Object.keys(userDirectPerms).length > 0) {
    return {
      ...user,
      Nome_Perfil: user.Nome_Perfil || (user.role === 'ADMIN' ? 'Administrador TI' : 'Operador'),
      Permissoes: userDirectPerms,
      permissoes: userDirectPerms
    };
  }

  // Mapeamento para usuários legados baseados em role anterior
  if (user.role === 'ADMIN') {
    return {
      ...user,
      ID_Perfil: 1,
      idPerfil: 1,
      Nome_Perfil: 'Administrador TI',
      Permissoes: { admin: true },
      permissoes: { admin: true }
    };
  }

  return {
    ...user,
    ID_Perfil: 2,
    idPerfil: 2,
    Nome_Perfil: 'Operador Suporte',
    Permissoes: {
      dashboard_leitura: true,
      dispositivos_leitura: true,
      dispositivos_escrita: true,
      colaboradores_leitura: true,
      colaboradores_escrita: true,
      ativos_leitura: true,
      ativos_escrita: false,
      financeiro_leitura: true
    },
    permissoes: {
      dashboard_leitura: true,
      dispositivos_leitura: true,
      dispositivos_escrita: true,
      colaboradores_leitura: true,
      colaboradores_escrita: true,
      ativos_leitura: true,
      ativos_escrita: false,
      financeiro_leitura: true
    }
  };
}

