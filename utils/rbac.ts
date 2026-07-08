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
    'relatorios_leitura': 'relatorios',
    'relatorios_escrita': 'relatorios',
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
export function resolveUserPermissions(user: any): any {
  if (!user) return null;

  let profiles: Perfil[] = [];
  const saved = localStorage.getItem('rbac_profiles');
  if (saved) {
    try {
      profiles = JSON.parse(saved);
    } catch (e) {}
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
          dispositivos_leitura: true,
          dispositivos_escrita: true,
          usuarios_leitura: true,
          usuarios_escrita: true,
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
      }
    ];
    localStorage.setItem('rbac_profiles', JSON.stringify(profiles));
  }

  const userProfileId = user.ID_Perfil || user.idPerfil;
  const profile = profiles.find(p => p.ID_Perfil === Number(userProfileId));

  if (profile) {
    return {
      ...user,
      ID_Perfil: profile.ID_Perfil,
      Nome_Perfil: profile.Nome,
      Permissoes: profile.Permissoes,
      permissoes: profile.Permissoes
    };
  }

  // Mapeamento para usuários legados baseados em role anterior
  if (user.role === 'ADMIN') {
    return {
      ...user,
      ID_Perfil: 1,
      Nome_Perfil: 'Administrador TI',
      Permissoes: { admin: true },
      permissoes: { admin: true }
    };
  }

  return {
    ...user,
    ID_Perfil: 2,
    Nome_Perfil: 'Operador Suporte',
    Permissoes: {
      dispositivos_leitura: true,
      dispositivos_escrita: true,
      usuarios_leitura: true,
      usuarios_escrita: true,
      ativos_leitura: true,
      ativos_escrita: false,
      financeiro_leitura: true
    },
    permissoes: {
      dispositivos_leitura: true,
      dispositivos_escrita: true,
      usuarios_leitura: true,
      usuarios_escrita: true,
      ativos_leitura: true,
      ativos_escrita: false,
      financeiro_leitura: true
    }
  };
}

