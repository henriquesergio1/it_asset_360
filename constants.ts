export const SYSTEM_VERSION = '3.121.1';
export const APP_VERSION = SYSTEM_VERSION;

// Estilos sistêmicos para padronização (UI Pattern 100% Tailwind CSS v4)
export const UI_LABEL_SMALL = "block text-[11px] font-bold uppercase tracking-wider mb-1 ml-1 text-slate-500 dark:text-slate-400";

export const UI_ICON_SIZE_SMALL = 14;
export const UI_ICON_SIZE_BASE = 18;
export const UI_ICON_SIZE_LARGE = 24;

export const UI_BUTTON_BASE = "font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 px-4 py-2 rounded-xl cursor-pointer";

export const UI_BUTTON_PRIMARY = `bg-blue-600 text-white hover:bg-blue-700 dark:bg-sky-600 dark:hover:bg-sky-700 shadow-lg shadow-blue-900/20 dark:shadow-sky-900/20 ${UI_BUTTON_BASE}`;
export const UI_BUTTON_SECONDARY = `bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 ${UI_BUTTON_BASE}`;
export const UI_BUTTON_DANGER = `bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 ${UI_BUTTON_BASE}`;
export const UI_BUTTON_SUCCESS = `bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 ${UI_BUTTON_BASE}`;
export const UI_BUTTON_WARNING = `bg-amber-600 text-white hover:bg-amber-700 shadow-lg shadow-amber-900/20 ${UI_BUTTON_BASE}`;

// Tokens de Superfície e Containers
export const UI_CARD_CONTAINER = "bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors";
export const UI_CARD_HEADER = "flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors";

// Tokens de Formulários
export const UI_INPUT_BASE = "w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all";
export const UI_TEXTAREA_BASE = `${UI_INPUT_BASE} resize-none`;

// Tokens de Modais
export const UI_MODAL_OVERLAY = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4";
export const UI_MODAL_CONTAINER = "bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 w-full max-w-lg transition-colors";

// Tokens de Tabelas
export const UI_TABLE_CONTAINER = "overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800";
export const UI_TABLE_TH = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[11px] font-extrabold tracking-wider p-3 text-left";
export const UI_TABLE_TD = "p-3 border-b border-slate-100 dark:border-slate-800/60 text-sm text-slate-700 dark:text-slate-200";

// Tokens de Badges
export const UI_BADGE_SUCCESS = "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 uppercase";
export const UI_BADGE_NEUTRAL = "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-600 uppercase";

