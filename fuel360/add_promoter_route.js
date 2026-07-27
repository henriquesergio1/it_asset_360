const fs = require('fs');

let content = fs.readFileSync('api/index.js', 'utf8');

const routePrevisaoRegex = /app\.get\('\/roteiro\/previsao', async \(req, res\) => \{[\s\S]*?\}\);/;

const newRoute = `app.get('/roteiro/promotores/clientes', async (req, res) => {
    let mariadbConn;
    try {
        const { rows: settings } = await executeQuery(dbConfig, "SELECT * FROM SystemSettings WHERE ID = 1");
        const s = settings[0];
        if (!s.ExtPromoter_Host || !s.ExtPromoter_Query) throw new Error("Configuração de Clientes Promotores não encontrada.");
        
        let rawClients = [];
        const dbType = s.ExtPromoter_Type || 'MSSQL';

        if (dbType === 'MSSQL') {
            const extPromoterConfig = { 
                server: s.ExtPromoter_Host, 
                authentication: { type: 'default', options: { userName: s.ExtPromoter_User, password: s.ExtPromoter_Pass } }, 
                options: { database: s.ExtPromoter_Database, port: s.ExtPromoter_Port || 1433, encrypt: false, trustServerCertificate: true, rowCollectionOnRequestCompletion: true, requestTimeout: 120000 } 
            };
            const { rows } = await executeQuery(extPromoterConfig, s.ExtPromoter_Query);
            rawClients = rows;
        } else {
            mariadbConn = await mariadb.createConnection({ host: s.ExtPromoter_Host, port: s.ExtPromoter_Port || 3306, user: s.ExtPromoter_User, password: s.ExtPromoter_Pass, database: s.ExtPromoter_Database, connectTimeout: 10000 });
            rawClients = await mariadbConn.query(s.ExtPromoter_Query);
        }
        
        res.json(rawClients);
    } catch (e) { 
        res.status(500).json({ message: e.message }); 
    } finally {
        if (mariadbConn) mariadbConn.end();
    }
});`;

content = content.replace(routePrevisaoRegex, match => match + '\n\n' + newRoute);

fs.writeFileSync('api/index.js', content);
console.log('Script done');
