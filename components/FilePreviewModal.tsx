import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, Maximize2, FileText, ImageIcon, Loader2, AlertCircle, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, onClose, fileUrl, fileName }) => {
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  if (!isOpen) return null;

  const isPDF = fileUrl.includes('application/pdf') || fileName.toLowerCase().endsWith('.pdf') || fileUrl.startsWith('blob:');
  const isImage = fileUrl.startsWith('data:image/') || fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-6xl h-full max-h-[90vh] bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                {isPDF ? <FileText size={20} className="text-red-400" /> : <ImageIcon size={20} className="text-emerald-400" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-100 truncate uppercase tracking-widest">{fileName}</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter shrink-0">Pré-visualização do documento</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <button 
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button 
                    onClick={() => setScale(1)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all text-[10px] font-bold"
                    title="Redefinir"
                  >
                    100%
                  </button>
                  <button 
                    onClick={() => setScale(s => Math.min(3, s + 0.2))}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn size={18} />
                  </button>
                </>
              )}
              <div className="h-6 w-px bg-slate-800 mx-1" />
              <button 
                onClick={handleDownload}
                className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 rounded-lg transition-all flex items-center gap-2"
                title="Baixar Arquivo"
              >
                <Download size={18} />
                <span className="hidden sm:inline text-[10px] font-black uppercase">Baixar</span>
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-red-900/40 rounded-lg transition-all ml-2"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center relative custom-scrollbar">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-950">
                <Loader2 size={40} className="text-emerald-500 animate-spin" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carregando conteúdo...</span>
              </div>
            )}

            {isPDF ? (
              <object
                data={fileUrl}
                type="application/pdf"
                className="w-full h-full rounded-lg"
                onLoad={() => setLoading(false)}
              >
                <div className="text-center p-10">
                  <FileWarning size={48} className="mx-auto text-amber-500 mb-4 opacity-50" />
                  <p className="text-slate-300 font-bold mb-4">Não foi possível exibir o PDF diretamente.</p>
                  <button 
                    onClick={handleDownload} 
                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs"
                  >
                    Baixar para Visualizar
                  </button>
                </div>
              </object>
            ) : isImage ? (
              <div className="relative inline-block transition-transform duration-200 ease-out" style={{ transform: `scale(${scale})` }}>
                <img 
                  src={fileUrl} 
                  alt={fileName} 
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  onLoad={() => setLoading(false)}
                />
              </div>
            ) : (
              <div className="text-center p-10">
                <AlertCircle size={48} className="mx-auto text-red-500 mb-4 opacity-50" />
                <p className="text-slate-300 font-bold mb-4">Formato de arquivo não suportado para visualização direta.</p>
                <button 
                  onClick={handleDownload} 
                  className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs"
                >
                  Baixar Arquivo
                </button>
              </div>
            )}
          </div>

          {/* Footer - Info */}
          <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center">
             <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
                <span className="flex items-center gap-1.5"><Maximize2 size={12}/> Suporte a Zoom</span>
                <span className="flex items-center gap-1.5"><FileText size={12}/> PDF / Imagem</span>
             </div>
             <p className="text-[9px] text-slate-600 font-medium italic">Pressione ESC para fechar</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FilePreviewModal;
