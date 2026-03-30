
import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
 id: string;
 message: string;
 type: ToastType;
}

interface ToastContextType {
 showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
 const [toasts, setToasts] = useState<Toast[]>([]);

 const showToast = useCallback((message: string, type: ToastType = 'success') => {
 const id = Math.random().toString(36).substring(2, 9);
 setToasts(prev => [...prev, { id, message, type }]);
 setTimeout(() => {
 setToasts(prev => prev.filter(t => t.id !== id));
 }, 3000);
 }, []);

 return (
 <ToastContext.Provider value={{ showToast }}>
 {children}
 <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
 <AnimatePresence>
 {toasts.map(toast => (
 <motion.div
 key={toast.id}
 initial={{ opacity: 0, x: 50, scale: 0.9 }}
 animate={{ opacity: 1, x: 0, scale: 1 }}
 exit={{ opacity: 0, x: 20, scale: 0.9 }}
 className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border min-w-[300px] ${
 toast.type === 'success' ? ' bg-emerald-900/40 border-emerald-800 text-emerald-300' :
 toast.type === 'error' ? ' bg-red-900/40 border-red-800 text-red-300' :
 ' bg-blue-900/40 border-blue-800 text-blue-300'
 }`}
 >
 {toast.type === 'success' && <CheckCircle2 size={20} className=""/>}
 {toast.type === 'error' && <AlertCircle size={20} className=""/>}
 {toast.type === 'info' && <Info size={20} className=""/>}
 
 <p className="flex-1 text-sm font-bold">{toast.message}</p>
 
 <button 
 onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
 className="p-1 hover:bg-black/5 hover:bg-white/5 rounded-lg transition-colors"
 >
 <X size={16} className="opacity-50"/>
 </button>
 </motion.div>
 ))}
 </AnimatePresence>
 </div>
 </ToastContext.Provider>
 );
};

export const useToast = () => {
 const context = useContext(ToastContext);
 if (!context) throw new Error('useToast must be used within a ToastProvider');
 return context;
};
