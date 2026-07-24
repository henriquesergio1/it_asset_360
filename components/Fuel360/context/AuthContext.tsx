import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth as useGlobalAuth } from '../../../contexts/AuthContext';
import { Usuario } from '../types';

interface AuthContextType {
    user: Usuario | null;
    isAuthenticated: boolean;
    loading: boolean;
    login: (usuario: string, senha: string) => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
    const globalAuth = useGlobalAuth();

    const currentUser: Usuario | null = globalAuth.user ? {
        ID_Usuario: 1,
        Nome: globalAuth.user.name || 'Operador Asset',
        Usuario: globalAuth.user.email || 'operador@asset',
        Perfil: globalAuth.isAdmin ? 'Admin' : 'Operador',
        Ativo: true
    } : null;

    const login = async (email: string, pass: string) => {
        await globalAuth.login(email, pass);
    };

    const logout = () => {
        globalAuth.logout();
    };

    return (
        <AuthContext.Provider value={{
            user: currentUser,
            isAuthenticated: globalAuth.isAuthenticated,
            loading: false,
            login,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
