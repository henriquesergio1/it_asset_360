import React, { useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, Maximize2, FileText, ImageIcon, Loader2, AlertCircle, FileWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | string[]; // Suporte para um ou mais arquivos
  fileName: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, onClose, fileUrl, fileName }) => {
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  if (!isOpen) return null;

  const urls = Array.isArray(fileUrl) ? fileUrl : [fileUrl];
  const isMultiple = urls.length > 1;

  // Usa a primeira URL para determinar o tipo se não for múltiplo
  const primaryUrl = urls[0];
  const isDataImage = primaryUrl.startsWith('data:image/');
  const isDataPDF = primaryUrl.startsWith('data:application/pdf');

  const isPDF = !isMultiple && (
    isDataPDF || 
    (!isDataImage && (primaryUrl.includes('application/pdf') || fileName.toLowerCase().endsWith('.pdf') || (primaryUrl.startsWith('blob:') && !fileName.toLowerCase().endsWith('.html'))))
  );
  const isHTML = !isMultiple && (primaryUrl.includes('text/html') || fileName.toLowerCase().endsWith('.html'));
  const isImage = isMultiple || isDataImage || (!isPDF && !isHTML && (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) || primaryUrl.startsWith('data:image/')));

  const handleDownload = () => {
    urls.forEach((url, index) => {
      const currentFileName = urls.length > 1 ? `${index + 1}_${fileName}` : fileName;
      if (url.startsWith('data:')) {
        try {
          const parts = url.split(',');
          const contentType = parts[0].split(':')[1].split(';')[0];
          const byteCharacters = atob(parts[1]);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          const blob = new Blob(byteArrays, { type: contentType });
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          
          let finalFileName = currentFileName;
          const ext = contentType.includes('pdf') ? 'pdf' : (contentType.includes('png') ? 'png' : 'jpg');
          if (finalFileName.toLowerCase().endsWith('.pdf') && !contentType.includes('pdf')) {
            finalFileName = finalFileName.substring(0, finalFileName.lastIndexOf('.')) + '.' + ext;
          } else if (!finalFileName.toLowerCase().endsWith('.pdf') && contentType.includes('pdf')) {
            finalFileName = finalFileName.substring(0, finalFileName.lastIndexOf('.')) + '.pdf';
          }
          
          link.download = finalFileName;
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          }, 100);
        } catch (err) {
          console.error("Erro ao converter base64 para blob:", err);
          const link = document.createElement('a');
          link.href = url;
          link.download = currentFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = currentFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
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
          className="absolute inset-0 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-6xl h-full max-h-[90vh] bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 shrink-0">
                {isPDF ? <FileText size={20} className="text-red-400" /> : <ImageIcon size={20} className="text-emerald-600 dark:text-emerald-400" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate uppercase tracking-widest">{fileName}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-tighter shrink-0">
                  {isMultiple ? `Visualizando ${urls.length} arquivos` : 'Pré-visualização do documento'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isImage && !isMultiple && (
                <>
                  <button 
                    onClick={() => setScale(s => Math.max(0.5, s - 0.2))}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                    title="Diminuir Zoom"
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button 
                    onClick={() => setScale(1)}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-[10px] font-bold"
                    title="Redefinir"
                  >
                    100%
                  </button>
                  <button 
                    onClick={() => setScale(s => Math.min(3, s + 0.2))}
                    className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn size={18} />
                  </button>
                </>
              )}
              <div className="h-6 w-px bg-slate-100 dark:bg-slate-800 mx-1" />
              <button 
                onClick={handleDownload}
                className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-300 hover:bg-emerald-50 dark:bg-emerald-500/20 rounded-lg transition-all flex items-center gap-2"
                title="Baixar Arquivo(s)"
              >
                <Download size={18} />
                <span className="hidden sm:inline text-[10px] font-black uppercase">Baixar</span>
              </button>
              <button 
                onClick={onClose}
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-white hover:bg-red-900/40 rounded-lg transition-all ml-2"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-4 flex flex-col items-center gap-6 relative custom-scrollbar">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-slate-50 dark:bg-slate-900">
                <Loader2 size={40} className="text-emerald-500 animate-spin" />
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Carregando conteúdo...</span>
              </div>
            )}

            {isMultiple ? (
              <div className="w-full flex flex-col gap-8 py-4 items-center">
                {urls.map((url, i) => (
                  <div key={i} className="flex flex-col items-center gap-3 w-full max-w-4xl">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                       Arquivo {i + 1}
                    </span>
                    <img 
                      src={url} 
                      alt={`Evidence ${i + 1}`}
                      className="w-full h-auto rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700"
                      onLoad={() => i === urls.length - 1 && setLoading(false)}
                    />
                  </div>
                ))}
              </div>
            ) : isPDF ? (
              <object
                data={primaryUrl}
                type="application/pdf"
                className="w-full h-full rounded-lg"
                onLoad={() => setLoading(false)}
              >
                <div className="text-center p-10">
                  <FileWarning size={48} className="mx-auto text-amber-500 mb-4 opacity-50" />
                  <p className="text-slate-700 dark:text-slate-300 font-bold mb-4">Não foi possível exibir o PDF diretamente.</p>
                  <button 
                    onClick={handleDownload} 
                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold uppercase text-xs"
                  >
                    Baixar para Visualizar
                  </button>
                </div>
              </object>
            ) : isHTML ? (
              <iframe
                src={primaryUrl}
                className="w-full h-full rounded-lg bg-white border-0"
                onLoad={() => setLoading(false)}
                title="HTML Preview"
              />
            ) : isImage ? (
              <div className="relative inline-block transition-transform duration-200 ease-out" style={{ transform: `scale(${scale})` }}>
                <img 
                  src={primaryUrl} 
                  alt={fileName} 
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  onLoad={() => setLoading(false)}
                />
              </div>
            ) : (
              <div className="text-center p-10 w-full h-full flex flex-col items-center justify-center">
                <AlertCircle size={48} className="mx-auto text-red-500 mb-4 opacity-50" />
                <p className="text-slate-700 dark:text-slate-300 font-bold mb-4">Formato de arquivo não suportado para visualização direta.</p>
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
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
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
