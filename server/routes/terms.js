const { sql, dbConfig, logAction, getBufferFromBase64, getBase64FromBuffer } = require('../utils/db');

module.exports = (app) => {
    app.get('/api/terms/:id/file', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT FileBinary FROM Terms WHERE Id=@Id");
            const row = result.recordset[0];
            if (!row) return res.json({ fileUrl: '' });
            res.json({ fileUrl: getBase64FromBuffer(row.FileBinary) });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.get('/api/terms/evidence/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT EvidenceBinary, Evidence2Binary, Evidence3Binary FROM Terms WHERE Id=@Id");
            const row = result.recordset[0];
            if (!row) return res.json({ fileUrls: [] });
            
            const fileUrls = [];
            if (row.EvidenceBinary) fileUrls.push(getBase64FromBuffer(row.EvidenceBinary));
            if (row.Evidence2Binary) fileUrls.push(getBase64FromBuffer(row.Evidence2Binary));
            if (row.Evidence3Binary) fileUrls.push(getBase64FromBuffer(row.Evidence3Binary));
            
            res.json({ fileUrl: fileUrls[0] || '', fileUrls });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put('/api/terms/:id', async (req, res) => {
        try {
            const { condition, damageDescription, assetDetails, notes, evidenceFiles, _adminUser } = req.body;
            const pool = await sql.connect(dbConfig);
            
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails, FileBinary FROM Terms WHERE Id=@Id");
            const term = oldRes.recordset[0];
            
            if (!term) return res.status(404).send("Termo não encontrado");
            if (term.FileBinary) return res.status(400).send("Termos já digitalizados não podem ser editados");

            let query = "UPDATE Terms SET Condition=@Cond, DamageDescription=@Desc, AssetDetails=@Ad, Notes=@Notes";
            
            const request = pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .input('Cond', sql.NVarChar, condition || 'Perfeito')
                .input('Desc', sql.NVarChar, damageDescription || null)
                .input('Ad', sql.NVarChar, assetDetails || term.AssetDetails)
                .input('Notes', sql.NVarChar, notes || null);

            if (evidenceFiles !== undefined) {
                query += ", EvidenceBinary=@Evid, Evidence2Binary=@Evid2, Evidence3Binary=@Evid3";
                
                const ev1 = evidenceFiles && evidenceFiles.length > 0 ? getBufferFromBase64(evidenceFiles[0]) : null;
                const ev2 = evidenceFiles && evidenceFiles.length > 1 ? getBufferFromBase64(evidenceFiles[1]) : null;
                const ev3 = evidenceFiles && evidenceFiles.length > 2 ? getBufferFromBase64(evidenceFiles[2]) : null;
                
                request.input('Evid', sql.VarBinary, ev1);
                request.input('Evid2', sql.VarBinary, ev2);
                request.input('Evid3', sql.VarBinary, ev3);
            }

            query += " WHERE Id=@Id";
            await request.query(query);

            await logAction(req.params.id, 'Term', 'Edição', _adminUser, term.UserId, `Termo editado. Condição: ${condition}`);
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put('/api/terms/file/:id', async (req, res) => {
        try {
            const { fileUrl, _adminUser } = req.body;
            const pool = await sql.connect(dbConfig);
            
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
            const term = oldRes.recordset[0];
            
            if (!term) return res.status(404).send("Termo não encontrado");

            const buffer = getBufferFromBase64(fileUrl);
            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .input('Bin', buffer)
                .query("UPDATE Terms SET FileBinary=@Bin, IsManual=0, ResolutionReason=NULL WHERE Id=@Id");

            const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            const userName = userRes.recordset[0]?.FullName || 'Colaborador';

            await logAction(term.UserId, 'User', 'Atualização', _adminUser, userName, `Digitalização anexada ao termo: ${term.AssetDetails}`);
            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.delete('/api/terms/:id/file', async (req, res) => {
        try {
            const { _adminUser, reason } = req.body;
            const pool = await sql.connect(dbConfig);

            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
            const term = oldRes.recordset[0];

            if (!term) return res.status(404).send("Termo não encontrado");

            await pool.request().input('Id', sql.NVarChar, req.params.id).query("UPDATE Terms SET FileBinary=NULL WHERE Id=@Id");

            const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            const userName = userRes.recordset[0]?.FullName || 'Colaborador';

            await logAction(term.UserId, 'User', 'Atualização', _adminUser, userName, `Anexo removido do termo (${term.AssetDetails}). Motivo: ${reason || 'Não informado'}`);
            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put('/api/terms/resolve/:id', async (req, res) => {
        try {
            const { reason, _adminUser } = req.body;
            const pool = await sql.connect(dbConfig);
            
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT UserId, AssetDetails FROM Terms WHERE Id=@Id");
            const term = oldRes.recordset[0];
            
            if (!term) return res.status(404).send("Termo não encontrado");

            await pool.request()
                .input('Id', sql.NVarChar, req.params.id)
                .input('Reason', sql.NVarChar, reason)
                .query("UPDATE Terms SET IsManual=1, ResolutionReason=@Reason WHERE Id=@Id");

            const userRes = await pool.request().input('Uid', sql.NVarChar, term.UserId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            const userName = userRes.recordset[0]?.FullName || 'Colaborador';

            await logAction(term.UserId, 'User', 'Resolução Manual', _adminUser, userName, `Pendência de termo resolvida manualmente. Motivo: ${reason}`);
            await logAction('system', 'System', 'Resolução Manual', _adminUser, 'Administração', `Termo de ${userName} resolvido sem anexo. Motivo: ${reason}`);

            const tagMatch = term.AssetDetails.match(/TAG:\s*([^|\]]+)/);
            if (tagMatch && tagMatch[1] && tagMatch[1].trim() !== 'S/T') {
                const assetTag = tagMatch[1].trim();
                const devRes = await pool.request().input('Tag', sql.NVarChar, assetTag).query("SELECT Id, AssetTag FROM Devices WHERE AssetTag=@Tag");
                const device = devRes.recordset[0];
                if (device) {
                    await logAction(device.Id, 'Device', 'Resolução Manual', _adminUser, device.AssetTag, `Pendência de termo de entrega/devolução resolvida manualmente. Motivo: ${reason}`);
                }
            }

            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });
};
