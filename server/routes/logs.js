const { sql, dbConfig, format } = require('../utils/db');

module.exports = (app) => {
    app.get('/api/logs/paginated', async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const search = req.query.search || '';
            const offset = (page - 1) * limit;

            const pool = await sql.connect(dbConfig);
            
            let query = "SELECT Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs";
            let countQuery = "SELECT COUNT(*) as total FROM AuditLogs";
            
            if (search) {
                const searchCondition = " WHERE AdminUser LIKE @search OR TargetName LIKE @search OR Action LIKE @search OR Notes LIKE @search";
                query += searchCondition;
                countQuery += searchCondition;
            }
            
            query += " ORDER BY Timestamp DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY";

            const request = pool.request();
            if (search) request.input('search', sql.NVarChar, `%${search}%`);
            
            const countRequest = pool.request();
            if (search) countRequest.input('search', sql.NVarChar, `%${search}%`);

            const [logsRes, countRes] = await Promise.all([
                request.input('offset', sql.Int, offset).input('limit', sql.Int, limit).query(query),
                countRequest.query(countQuery)
            ]);

            res.json({
                logs: format(logsRes),
                total: countRes.recordset[0].total,
                page,
                totalPages: Math.ceil(countRes.recordset[0].total / limit)
            });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.get('/api/logs/asset/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request()
                .input('AssetId', sql.NVarChar, req.params.id)
                .query("SELECT Id, AssetId, AssetType, Action, Timestamp, AdminUser, TargetName, Notes FROM AuditLogs WHERE AssetId=@AssetId ORDER BY Timestamp DESC");
            res.json(format(result));
        } catch (err) { res.status(500).send(err.message); }
    });

    app.get('/api/logs/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM AuditLogs WHERE Id=@Id");
            const log = result.recordset[0];
            if (log) {
                res.json({
                    id: log.Id, assetId: log.AssetId, assetType: log.AssetType, action: log.Action, timestamp: log.Timestamp,
                    adminUser: log.AdminUser, targetName: log.TargetName, notes: log.Notes, backupData: log.BackupData,
                    previousData: log.PreviousData, newData: log.NewData
                });
            } else res.status(404).send("Log não encontrado");
        } catch (err) { res.status(500).send(err.message); }
    });
};
