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
 const { systemUsers } = useData();
 
 // Sincronização IMEDIATA na inicialização para evitar que o isAuthenticated seja false por alguns ms
 const [user, setUser] = useState<SystemUser | null>(() => {
 const storedUser = localStorage.getItem('it_asset_user');
 try {
 return storedUser ? resolveUserPermissions(JSON.parse(storedUser)) : null;
 } catch (e) {
 return null;
 }
 });

 const login = async (email: string, pass: string) => {
 // Simple mock authentication against loaded system users
 const foundUser = systemUsers.find(u => u.email === email && u.password === pass);
 if (foundUser) {
 const resolved = resolveUserPermissions(foundUser);
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