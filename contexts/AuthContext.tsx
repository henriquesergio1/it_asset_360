import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemUser, SystemRole } from '../types';
import { useData } from './DataContext';
import { resolveUserPermissions } from '../utils/rbac';

interface AuthContextType {
 user: SystemUser | null;
 login: (email: string, pass: string) => Promise<boolean>;
 logout: () => void;
 isAuthenticated: boolean;
 isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
 const { systemUsers, profiles } = useData();
 
 // Sincronização IMEDIATA na inicialização para evitar que o isAuthenticated seja false por alguns ms
 const [user, setUser] = useState<SystemUser | null>(() => {
 const storedUser = localStorage.getItem('it_asset_user');
 try {
 return storedUser ? resolveUserPermissions(JSON.parse(storedUser)) : null;
 } catch (e) {
 return null;
 }
 });

 // Re-resolve permissões do usuário logado se os perfis do banco forem sincronizados/atualizados
 useEffect(() => {
   if (user && profiles && profiles.length > 0) {
     const updatedUser = resolveUserPermissions(user, profiles);
     if (
       JSON.stringify(updatedUser.Permissoes) !== JSON.stringify(user.Permissoes) || 
       updatedUser.Nome_Perfil !== user.Nome_Perfil
     ) {
       setUser(updatedUser);
       localStorage.setItem('it_asset_user', JSON.stringify(updatedUser));
     }
   }
 }, [profiles]);

 const login = async (email: string, pass: string) => {
  // Tenta autenticar via endpoint seguro do servidor (bcrypt no backend)
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        const resolved = resolveUserPermissions(data.user, profiles);
        setUser(resolved);
        localStorage.setItem('it_asset_user', JSON.stringify(resolved));
        return true;
      }
    }
    // Resposta 401 = credenciais inválidas
    if (response.status === 401) return false;
  } catch {
    // Servidor indisponível — fallback para modo mock (desenvolvimento local sem banco)
  }
  // Fallback mock: compara contra usuários carregados em memória (sem banco)
  const foundUser = systemUsers.find(u => u.email === email && (u as any).password === pass);
  if (foundUser) {
    const resolved = resolveUserPermissions(foundUser, profiles);
    setUser(resolved);
    localStorage.setItem('it_asset_user', JSON.stringify(resolved));
    return true;
  }
  return false;
 };


 const logout = () => {
 setUser(null);
 localStorage.removeItem('it_asset_user');
 };

 const value = {
 user,
 login,
 logout,
 isAuthenticated: !!user,
 isAdmin: user?.role === SystemRole.ADMIN || user?.Permissoes?.admin === true || user?.permissoes?.admin === true
 };

 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
 const context = useContext(AuthContext);
 if (!context) throw new Error('useAuth must be used within an AuthProvider');
 return context;
};