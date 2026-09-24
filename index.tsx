import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { DataProvider } from './contexts/DataProvider';
import { ToastProvider } from './contexts/ToastContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Envia o token de autenticação (JWT emitido no login) em todas as chamadas à API da própria aplicação
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
 try {
 const token = localStorage.getItem('AUTH_TOKEN');
 const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
 const isOwnApi = url.startsWith('/api') || url.startsWith(`${window.location.origin}/api`);
 if (token && isOwnApi) {
 const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
 if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
 return nativeFetch(input, { ...init, headers });
 }
 } catch (e) {
 // Em caso de falha na preparação do cabeçalho, segue com a chamada original
 }
 return nativeFetch(input, init);
};

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
 throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
 <React.StrictMode>
 <QueryClientProvider client={queryClient}>
 <ToastProvider>
 <DataProvider>
 <App />
 </DataProvider>
 </ToastProvider>
 </QueryClientProvider>
 </React.StrictMode>
);