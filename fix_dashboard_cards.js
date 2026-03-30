const fs = require('fs');
const path = './components/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex items-start justify-between hover:shadow-md transition-all">
    <div>
      <p className="text-sm font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
      {subtitle && <p className="text-xs mt-2">{subtitle}</p>}
    </div>
    <div className={\`p-3 rounded-lg \${color}\`}>
      <Icon className="w-6 h-6 text-white"/>
    </div>
  </div>
);`;

const replacement = `const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex items-start justify-between hover:shadow-md transition-all">
    <div>
      <p className="text-sm font-medium mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
      {subtitle && <p className="text-xs mt-2">{subtitle}</p>}
    </div>
    <div className={\`p-3 rounded-lg \${color}\`}>
      <Icon className="w-6 h-6 text-white"/>
    </div>
  </div>
);

const ExpandableDeviceCard = ({ devices }: { devices: any[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const available = devices.filter(d => d.status === 'AVAILABLE').length;
  const inUse = devices.filter(d => d.status === 'IN_USE').length;
  const maintenance = devices.filter(d => d.status === 'MAINTENANCE').length;

  return (
    <div 
      className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between z-10">
        <div>
          <p className="text-sm font-medium mb-1">Dispositivos</p>
          <h3 className="text-2xl font-bold text-slate-100">{devices.length}</h3>
          <p className="text-xs mt-2 text-slate-400">{available} disponíveis</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-600 group-hover:scale-110 transition-transform">
          <Smartphone className="w-6 h-6 text-white"/>
        </div>
      </div>
      
      <div className={\`transition-all duration-500 ease-in-out z-10 overflow-hidden \${isExpanded ? 'max-h-40 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}\`}>
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Disponíveis</div>
            <span className="font-bold text-slate-100">{available}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Em Uso</div>
            <span className="font-bold text-slate-100">{inUse}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Manutenção</div>
            <span className="font-bold text-slate-100">{maintenance}</span>
          </div>
        </div>
      </div>
      
      {/* Background glow effect */}
      <div className={\`absolute -bottom-10 -right-10 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl transition-all duration-500 \${isExpanded ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}\`}></div>
    </div>
  );
};

const ExpandableAccountCard = ({ accounts }: { accounts: any[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const active = accounts.filter(a => a.status === 'Ativo').length;
  
  return (
    <div 
      className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between z-10">
        <div>
          <p className="text-sm font-medium mb-1">Licenças / Contas</p>
          <h3 className="text-2xl font-bold text-slate-100">{accounts.length}</h3>
          <p className="text-xs mt-2 text-slate-400">{active} ativas</p>
        </div>
        <div className="p-3 rounded-lg bg-indigo-600 group-hover:scale-110 transition-transform">
          <Lock className="w-6 h-6 text-white"/>
        </div>
      </div>
      
      <div className={\`transition-all duration-500 ease-in-out z-10 overflow-hidden \${isExpanded ? 'max-h-60 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}\`}>
        <div className="pt-4 border-t border-slate-800 space-y-3">
          {Object.values(AccountType).map(type => {
            const count = accounts.filter(a => a.type === type).length;
            if (count === 0) return null;
            return (
              <div key={type} className="flex justify-between items-center text-sm">
                <span className="text-slate-300">{type}</span>
                <span className="font-bold text-slate-100">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Background glow effect */}
      <div className={\`absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl transition-all duration-500 \${isExpanded ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}\`}></div>
    </div>
  );
};`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content);
  console.log('Replaced successfully');
} else {
  console.log('Target not found');
}
