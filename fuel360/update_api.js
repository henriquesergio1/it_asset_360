const fs = require('fs');

let content = fs.readFileSync('api/index.js', 'utf8');

// 1. Update checkDbUpdates
const updatesRegex = /const updates = \[([\s\S]*?)\];/;
const newUpdates = `const updates = [$1,
            "ALTER TABLE SystemSettings ADD ExtPromoter_Host NVARCHAR(255)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Port INT DEFAULT 1433",
            "ALTER TABLE SystemSettings ADD ExtPromoter_User NVARCHAR(100)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Pass NVARCHAR(255)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Database NVARCHAR(100)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Query NVARCHAR(MAX)",
            "ALTER TABLE SystemSettings ADD ExtPromoter_Type NVARCHAR(50) DEFAULT 'MSSQL'"
        ];`;
content = content.replace(updatesRegex, newUpdates);

// 2. Update GET /system/integration
const getIntegrationRegex = /app\.get\('\/system\/integration', async \(req, res\) => \{[\s\S]*?res\.json\(\{[\s\S]*?colab: \{[\s\S]*?\},[\s\S]*?route: \{[\s\S]*?\}[\s\S]*?\}\);[\s\S]*?\}\);/;
const newGetIntegration = `app.get('/system/integration', async (req, res) => {
    try {
        const { rows } = await executeQuery(dbConfig, "SELECT * FROM SystemSettings WHERE ID = 1");
        const s = rows[0];
        res.json({
            colab: { host: s.ExtDb_Host, port: s.ExtDb_Port, user: s.ExtDb_User, pass: s.ExtDb_Pass, database: s.ExtDb_Database, query: s.ExtDb_Query, type: s.ExtDb_Type || 'MARIADB' },
            route: { host: s.ExtRoute_Host, port: s.ExtRoute_Port, user: s.ExtRoute_User, pass: s.ExtRoute_Pass, database: s.ExtRoute_Database, query: s.ExtRoute_Query, type: 'MSSQL' },
            promoter: { host: s.ExtPromoter_Host, port: s.ExtPromoter_Port, user: s.ExtPromoter_User, pass: s.ExtPromoter_Pass, database: s.ExtPromoter_Database, query: s.ExtPromoter_Query, type: s.ExtPromoter_Type || 'MSSQL' }
        });
    } catch (e) { res.status(500).json({ message: e.message }); }
});`;
content = content.replace(getIntegrationRegex, newGetIntegration);

// 3. Update PUT /system/integration
const putIntegrationRegex = /app\.put\('\/system\/integration', async \(req, res\) => \{[\s\S]*?const \{ colab, route \} = req\.body;[\s\S]*?const query = \`UPDATE SystemSettings SET ExtDb_Host = @ch, ExtDb_Port = @cp, ExtDb_User = @cu, ExtDb_Pass = @cpass, ExtDb_Database = @cdb, ExtDb_Query = @cq, ExtDb_Type = @ct, ExtRoute_Host = @rh, ExtRoute_Port = @rp, ExtRoute_User = @ru, ExtRoute_Pass = @rpass, ExtRoute_Database = @rdb, ExtRoute_Query = @rq WHERE ID = 1\`;[\s\S]*?await executeQuery\(dbConfig, query, \[[\s\S]*?\]\);[\s\S]*?res\.json\(\{ success: true \}\);[\s\S]*?\} catch \(e\) \{ res\.status\(500\)\.json\(\{ message: e\.message \}\); \}[\s\S]*?\}\);/;
const newPutIntegration = `app.put('/system/integration', async (req, res) => {
    const { colab, route, promoter } = req.body;
    try {
        const query = \`UPDATE SystemSettings SET ExtDb_Host = @ch, ExtDb_Port = @cp, ExtDb_User = @cu, ExtDb_Pass = @cpass, ExtDb_Database = @cdb, ExtDb_Query = @cq, ExtDb_Type = @ct, ExtRoute_Host = @rh, ExtRoute_Port = @rp, ExtRoute_User = @ru, ExtRoute_Pass = @rpass, ExtRoute_Database = @rdb, ExtRoute_Query = @rq, ExtPromoter_Host = @ph, ExtPromoter_Port = @pp, ExtPromoter_User = @pu, ExtPromoter_Pass = @ppass, ExtPromoter_Database = @pdb, ExtPromoter_Query = @pq, ExtPromoter_Type = @pt WHERE ID = 1\`;
        await executeQuery(dbConfig, query, [
            { name: 'ch', type: TYPES.NVarChar, value: colab.host }, 
            { name: 'cp', type: TYPES.Int, value: colab.port }, 
            { name: 'cu', type: TYPES.NVarChar, value: colab.user }, 
            { name: 'cpass', type: TYPES.NVarChar, value: colab.pass }, 
            { name: 'cdb', type: TYPES.NVarChar, value: colab.database }, 
            { name: 'cq', type: TYPES.NVarChar, value: colab.query }, 
            { name: 'ct', type: TYPES.NVarChar, value: colab.type || 'MARIADB' },
            { name: 'rh', type: TYPES.NVarChar, value: route.host }, 
            { name: 'rp', type: TYPES.Int, value: route.port }, 
            { name: 'ru', type: TYPES.NVarChar, value: route.user }, 
            { name: 'rpass', type: TYPES.NVarChar, value: route.pass }, 
            { name: 'rdb', type: TYPES.NVarChar, value: route.database }, 
            { name: 'rq', type: TYPES.NVarChar, value: route.query },
            { name: 'ph', type: TYPES.NVarChar, value: promoter?.host || '' }, 
            { name: 'pp', type: TYPES.Int, value: promoter?.port || 1433 }, 
            { name: 'pu', type: TYPES.NVarChar, value: promoter?.user || '' }, 
            { name: 'ppass', type: TYPES.NVarChar, value: promoter?.pass || '' }, 
            { name: 'pdb', type: TYPES.NVarChar, value: promoter?.database || '' }, 
            { name: 'pq', type: TYPES.NVarChar, value: promoter?.query || '' },
            { name: 'pt', type: TYPES.NVarChar, value: promoter?.type || 'MSSQL' }
        ]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});`;
content = content.replace(putIntegrationRegex, newPutIntegration);

fs.writeFileSync('api/index.js', content);
console.log('Script done');
