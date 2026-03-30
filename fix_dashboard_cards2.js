const fs = require('fs');
const path = './components/Dashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
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

const replacement1 = `const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
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

const target2 = `  {/* Cards Principais Restaurados */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <StatCard 
      title="Dispositivos"
      value={devices.length} 
      icon={Smartphone} 
      color=""
      subtitle={\`\${availableDevices} disponíveis\`}
    />
    <StatCard 
      title="Licenças / Contas"
      value={accounts.length} 
      icon={Lock} 
      color="bg-indigo-600"
      subtitle={\`\${accounts.filter(a => a.status === 'Ativo').length} e-mails ativos\`}
    />
    <StatCard 
      title="Colaboradores"
      value={users.length} 
      icon={Users} 
      color="bg-emerald-600"
      subtitle={\`\${users.filter(u => u.active).length} ativos\`}
    />
    <StatCard 
      title="Em Manutenção"
      value={maintenanceDevices} 
      icon={Wrench} 
      color="bg-amber-500"
      subtitle="Aguardando reparo"
    />
  </div>`;

const replacement2 = `  {/* Cards Principais Restaurados */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <ExpandableDeviceCard devices={devices} />
    <ExpandableAccountCard accounts={accounts} />
    <StatCard 
      title="Colaboradores"
      value={users.length} 
      icon={Users} 
      color="bg-emerald-600"
      subtitle={\`\${users.filter(u => u.active).length} ativos\`}
    />
    <StatCard 
      title="Em Manutenção"
      value={maintenanceDevices} 
      icon={Wrench} 
      color="bg-amber-500"
      subtitle="Aguardando reparo"
    />
  </div>`;

const target3 = `  {/* Gráficos Principais */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex flex-col h-[320px]">
      <h2 className="text-lg font-bold text-slate-100 mb-3">Status dos Dispositivos</h2>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dataStatus} cx="40%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value">
              {dataStatus.map((entry, index) => (
                <Cell key={\`cell-\${index}\`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f172a', 
                borderRadius: '12px', 
                border: '1px solid #334155', 
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
                color: '#f1f5f9'
              }}
              itemStyle={{ color: '#f1f5f9', fontSize: '12px', fontWeight: 'bold' }}
            />
            <Legend 
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ 
                fontSize: '10px', 
                fontWeight: 'bold', 
                textTransform: 'uppercase',
                color: '#94a3b8'
              }} 
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>

    <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 h-[320px] flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Lock size={18} className="text-indigo-400"/> Licenças / Contas
        </h2>
        <Link to="/accounts" className="text-[10px] font-black uppercase text-indigo-400 hover:underline">Ver Tudo</Link>
      </div>
      <div className="space-y-2 overflow-hidden">
        {Object.values(AccountType).map(type => {
          const count = accounts.filter(a => a.type === type).length;
          const percentage = accounts.length > 0 ? (count / accounts.length) * 100 : 0;
          return (
            <div key={type} className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase">
                <span>{type}</span>
                <span>{count}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 bg-indigo-500 h-full transition-all duration-1000" style={{ width: \`\${percentage}%\` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>`;

const replacement3 = ``;

// Normalize whitespace for matching
const normalize = (str) => str.replace(/\s+/g, ' ').trim();

let replaced = false;

if (normalize(content).includes(normalize(target1))) {
  // Use regex to replace to avoid exact whitespace matching issues
  const regex1 = new RegExp(target1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  content = content.replace(regex1, replacement1);
  replaced = true;
}

if (normalize(content).includes(normalize(target2))) {
  const regex2 = new RegExp(target2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  content = content.replace(regex2, replacement2);
  replaced = true;
}

if (normalize(content).includes(normalize(target3))) {
  const regex3 = new RegExp(target3.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  content = content.replace(regex3, replacement3);
  replaced = true;
}

if (replaced) {
  fs.writeFileSync(path, content);
  console.log('Replaced successfully');
} else {
  console.log('Targets not found');
}
