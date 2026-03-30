const fs = require('fs');
const path = './components/Operations.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<div className="flex bg-slate-950 p-2 gap-2 transition-colors">[\s\S]*?<\/div>/,
  `<div className="flex bg-slate-950 p-2 gap-2 transition-colors border-b border-slate-800">
          <button onClick={() => { setActiveTab('CHECKOUT'); setSelectedAssetId(''); }} className={\`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em] transition-all border \${activeTab === 'CHECKOUT' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'}\`}>
            <ArrowRightLeft size={18} className={activeTab === 'CHECKOUT' ? 'rotate-0' : 'rotate-180'}/> Entrega
          </button>
          <button onClick={() => { setActiveTab('CHECKIN'); setSelectedAssetId(''); }} className={\`flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-xs tracking-[0.2em] transition-all border \${activeTab === 'CHECKIN' ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/20' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'}\`}>
            <ArrowRightLeft size={18} className={activeTab === 'CHECKIN' ? 'rotate-180' : 'rotate-0'}/> Devolução
          </button>
        </div>`
);

fs.writeFileSync(path, content);
console.log('Done');
