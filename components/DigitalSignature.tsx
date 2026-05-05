
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { FileText, Camera, MapPin, Clock, Calendar, Hash, CheckCircle2, AlertTriangle, ShieldCheck, MapPinned, UserCheck, Smartphone, X, CheckSquare } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'framer-motion';

const DigitalSignature = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { settings } = useData();
    const [termData, setTermData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [signed, setSigned] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<string>('Capturando...');
    const [ip, setIp] = useState<string>('Capturando...');
    const [photo, setPhoto] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const sigCanvas = useRef<SignatureCanvas>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const fetchTermData = async () => {
            try {
                const res = await fetch(`/api/public/terms-to-sign/${token}`);
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text);
                }
                const data = await res.json();
                setTermData(data);

                // Capturar IP (usando um serviço público simples ou o próprio backend)
                // Para simplificar, o backend já capturará o IP na submissão, mas podemos tentar mostrar aqui.
                fetch('https://api.ipify.org?format=json')
                    .then(r => r.json())
                    .then(j => setIp(j.ip))
                    .catch(() => setIp('IP Oculto/Privado'));

                // Geolocation
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`),
                        () => setLocation('Não autorizado/desabilitado'),
                        { timeout: 5000 }
                    );
                } else {
                    setLocation('Não suportado pelo navegador');
                }

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchTermData();
    }, [token]);

    const handleCapturePhoto = async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            setPhoto(canvas.toDataURL('image/jpeg', 0.8));
            setShowCamera(false);
            // Parar stream
            const stream = videoRef.current.srcObject as MediaStream;
            stream?.getTracks().forEach(track => track.stop());
        }
    };

    const startCamera = async () => {
        try {
            setShowCamera(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            alert('Não foi possível acessar a câmera');
            setShowCamera(false);
        }
    };

    const handleSubmit = async () => {
        if (sigCanvas.current?.isEmpty()) {
            alert('Por favor, faça sua assinatura na tela.');
            return;
        }

        setSubmitting(true);
        try {
            const signatureCanvasData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
            const res = await fetch(`/api/public/terms-to-sign/${token}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signatureCanvas: signatureCanvasData,
                    documentPhoto: photo,
                    location,
                    ip
                })
            });

            if (!res.ok) throw new Error('Falha ao salvar assinatura');
            setSigned(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"
                />
                <p className="text-slate-400 font-medium">Carregando Termo Digital...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-red-500/10 p-6 rounded-3xl border border-red-500/20 mb-6 max-w-md">
                    <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
                    <h2 className="text-xl font-bold text-slate-100 mb-2">Ops! Algo deu errado</h2>
                    <p className="text-slate-400">{error}</p>
                </div>
                <button onClick={() => navigate('/')} className="px-6 py-3 bg-slate-800 rounded-xl font-bold hover:bg-slate-700 transition-all text-slate-100">
                    Voltar para o Início
                </button>
            </div>
        );
    }

    if (signed) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-emerald-500/10 p-10 rounded-[40px] border border-emerald-500/20 mb-8 max-w-md shadow-2xl shadow-emerald-500/5"
                >
                    <div className="bg-emerald-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                        <CheckCircle2 className="text-white" size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-100 mb-3 tracking-tight">Assinatura Concluída!</h2>
                    <p className="text-slate-400 leading-relaxed font-medium">
                        O termo foi assinado com sucesso e registrado em nosso sistema seguro.
                    </p>
                    <div className="mt-8 pt-8 border-t border-emerald-500/10">
                        <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest">
                            <ShieldCheck size={16} />
                            Hash de Integridade Gerado
                        </div>
                    </div>
                </motion.div>
                <p className="text-slate-500 text-sm">Você já pode fechar esta página.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 overflow-x-hidden p-4 md:p-8 flex flex-col items-center">
            {/* Header */}
            <header className="w-full max-w-3xl mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/20">
                        {settings.logoUrl ? (
                            <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                        ) : (
                            <FileText className="text-white" size={32} />
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-100 tracking-tight">{settings.appName}</h1>
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">Assinatura de Termo Digital</p>
                    </div>
                </div>
            </header>

            <div className="w-full max-w-3xl space-y-8 pb-12">
                {/* Term Info Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className="bg-slate-900 rounded-[32px] border border-slate-800 overflow-hidden shadow-xl"
                >
                    <div className="p-8 border-b border-slate-800 bg-slate-800/20">
                        <div className="flex items-center justify-between mb-6">
                            <span className="bg-blue-600/20 text-blue-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                                Termo de {termData.type === 'ENTREGA' ? 'Entrega' : 'Devolução'}
                            </span>
                            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs">
                                <Calendar size={14} />
                                {new Date(termData.date).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                        <h2 className="text-3xl font-black text-slate-100 mb-6 tracking-tight">Revisão de Ativos</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-700/50">
                                <div className="flex items-center gap-3 mb-2 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                    <UserCheck size={14} />
                                    Colaborador
                                </div>
                                <p className="text-slate-100 font-bold">{termData.userName}</p>
                                <p className="text-slate-400 text-xs mt-1 font-medium">{termData.userCpf || 'CPF NÃO CADASTRADO'} | {termData.userCode || 'S/M'}</p>
                            </div>
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-700/50">
                                <div className="flex items-center gap-3 mb-2 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                                    <Smartphone size={14} />
                                    Ativos Relacionados
                                </div>
                                <p className="text-slate-100 font-medium text-sm line-clamp-2">{termData.assetDetails}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <p className="text-slate-300 text-sm leading-relaxed mb-8 font-medium">
                            Ao prosseguir com a assinatura digital, você confirma o recebimento/devolução dos ativos mencionados acima nas condições descritas, responsabilizando-se pelo uso e conservação conforme as políticas da empresa.
                        </p>

                        {/* Accessories if any */}
                        {termData.accessories?.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Acessórios Incluídos</h3>
                                <div className="flex flex-wrap gap-2">
                                    {termData.accessories.map((acc: any) => (
                                        <span key={acc.id} className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg text-xs font-bold border border-slate-700">
                                            {acc.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Signature Capture Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                    className="bg-slate-900 rounded-[32px] border border-slate-800 p-8 shadow-xl"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                            <CheckSquare className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-100 tracking-tight">Assinatura na Tela</h3>
                            <p className="text-xs text-slate-500 font-medium italic">Use o dedo ou caneta touch para assinar abaixo</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-inner border-2 border-slate-800">
                        <SignatureCanvas 
                            ref={sigCanvas}
                            penColor='black'
                            canvasProps={{ className: 'w-full h-48', style: { width: '100%', height: '192px' } }}
                        />
                    </div>
                    <button 
                        onClick={() => sigCanvas.current?.clear()} 
                        className="text-xs font-black text-red-500 uppercase tracking-widest hover:text-red-400 transition-all flex items-center gap-2"
                    >
                        Limpar Assinatura
                    </button>
                </motion.div>

                {/* Proof of Identity Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                    className="bg-slate-900 rounded-[32px] border border-slate-800 p-8 shadow-xl"
                >
                    <div className="flex items-center gap-3 mb-8">
                        <div className="bg-purple-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/20">
                            <Camera className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-100 tracking-tight">Evidência / Foto</h3>
                            <p className="text-xs text-slate-500 font-medium italic">Capture uma foto de seu documento ou crachá</p>
                        </div>
                    </div>

                    {showCamera ? (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video mb-4">
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-6 flex justify-center px-6">
                                <button 
                                    onClick={handleCapturePhoto}
                                    className="bg-white text-slate-900 p-4 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all"
                                >
                                    <Camera size={24} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            {photo ? (
                                <div className="relative group overflow-hidden rounded-2xl mb-4 border-2 border-slate-700 shadow-xl">
                                    <img src={photo} alt="Capture" className="w-full h-48 object-cover" />
                                    <button 
                                        onClick={startCamera}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center font-black text-white uppercase text-xs tracking-widest gap-2"
                                    >
                                        <Camera size={18} />
                                        Tirar Nova Foto
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={startCamera}
                                    className="w-full py-12 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all bg-slate-950/20"
                                >
                                    <Camera size={40} className="mb-4 opacity-50" />
                                    <span className="font-black uppercase tracking-widest text-xs">Capturar Foto do Rosto ou Documento</span>
                                </button>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Metadata Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                    <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800/50 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-1 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                            <MapPinned size={14} />
                            Localização do Registro
                        </div>
                        <p className="text-slate-100 font-bold text-sm truncate">{location}</p>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-[24px] border border-slate-800/50 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-1 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                            <Hash size={14} />
                            Endereço IP / Protocolo
                        </div>
                        <p className="text-slate-100 font-bold text-sm">{ip}</p>
                    </div>
                </motion.div>

                {/* Submission Block */}
                <div className="pt-8 flex flex-col items-center">
                    <button 
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black text-xl shadow-2xl shadow-blue-600/30 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all flex items-center justify-center gap-3"
                    >
                        {submitting ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-6 h-6 border-3 border-white border-t-transparent rounded-full" />
                        ) : (
                            <>
                                <UserCheck size={28} />
                                Finalizar e Assinar Digitalmente
                            </>
                        )}
                    </button>
                    <p className="mt-6 text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <ShieldCheck size={12} className="text-emerald-500" />
                        Autenticado via Protocolo IT 360 Secure Hash
                    </p>
                </div>
            </div>
            
            {/* Camera Modal Overlay */}
            <AnimatePresence>
                {showCamera && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
                    >
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
                        
                        <div className="absolute top-8 left-8">
                            <h2 className="text-white font-black text-xl tracking-tight flex items-center gap-2">
                                <Camera className="text-blue-500" />
                                Captura de Evidência
                            </h2>
                        </div>

                        <button 
                            onClick={() => setShowCamera(false)}
                            className="absolute top-8 right-8 text-white bg-slate-800/50 p-2 rounded-full hover:bg-slate-700 transition-all"
                        >
                            <X size={24} />
                        </button>

                        <div className="absolute bottom-12 inset-x-0 flex justify-center">
                             <button 
                                onClick={handleCapturePhoto}
                                className="bg-white text-slate-900 p-6 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all outline outline-offset-4 outline-white/20"
                            >
                                <Camera size={32} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DigitalSignature;
