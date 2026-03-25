const { sql, dbConfig, logAction, isBase64, getBufferFromBase64, getBase64FromBuffer } = require('../utils/db');

const IGexternal_CRUD_KEYS = ['accessories', 'terms', 'hasInvoice', 'hasFile', 'customDataStr', 'hasDueDate', 'isRecurring', 'recurrenceConfig', 'parentId'];

module.exports = (app) => {
    app.get('/api/devices/:id/invoice', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const result = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT PurchaseInvoiceBinary FROM Devices WHERE Id=@Id");
            const row = result.recordset[0];
            if (!row) return res.json({ invoiceUrl: '' });
            res.json({ invoiceUrl: getBase64FromBuffer(row.PurchaseInvoiceBinary) });
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/operations/checkout', async (req, res) => {
        try {
            const { assetId, assetType, userId, notes, _adminUser, accessories } = req.body;
            const pool = await sql.connect(dbConfig);
            const table = assetType === 'Device' ? 'Devices' : 'SimCards';
            const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];
            const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
            const userName = userRes.recordset[0]?.FullName || 'Colaborador';
            
            let assetDetails = notes || '';
            let targetIdStr = assetId;

            if (assetType === 'Device' && prev) {
                const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT Name FROM Models WHERE Id=@Mid");
                const modelName = modelRes.recordset[0]?.Name || 'Dispositivo';
                assetDetails = `[TAG: ${prev.AssetTag || 'S/T'} | S/N: ${prev.SerialNumber || 'S/S'} | IMEI: ${prev.Imei || 'S/I'}] ${modelName}`;
                targetIdStr = `${prev.AssetTag || prev.Imei || prev.SerialNumber} (${modelName})`;
            } else if (prev) {
                assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
                targetIdStr = prev.PhoneNumber;
            }

            await pool.request().input('Aid', assetId).input('Uid', userId).query(`UPDATE ${table} SET Status='Em Uso', CurrentUserId=@Uid WHERE Id=@Aid`);
            if (assetType === 'Device' && accessories) {
                await pool.request().input('Did', assetId).query("DELETE FROM DeviceAccessories WHERE DeviceId=@Did");
                for (let acc of accessories) {
                    await pool.request().input('I', acc.id).input('Did', assetId).input('At', acc.accessoryTypeId).input('N', acc.name).query("INSERT INTO DeviceAccessories (Id, DeviceId, AccessoryTypeId, Name) VALUES (@I, @Did, @At, @N)");
                }
            }
            const termId = Math.random().toString(36).substr(2, 9);
            await pool.request().input('I', termId).input('U', userId).input('T', 'ENTREGA').input('Ad', assetDetails).query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date) VALUES (@I, @U, @T, @Ad, GETDATE())");
            
            const richNotes = `Alvo: ${userName}\nStatus: 'Disponível' ➔ 'Em Uso'${notes ? `\nObservação: ${notes}` : ''}`;
            await logAction(assetId, assetType, 'Entrega', _adminUser, targetIdStr, richNotes, null, prev, { status: 'Em Uso', currentUserId: userId, userName: userName, timestamp: new Date().toISOString() });
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/operations/checkin', async (req, res) => {
        try {
            const { assetId, assetType, notes, _adminUser, inactivateUser, condition, damageDescription, evidenceFiles, isManual, resolutionReason } = req.body;
            const pool = await sql.connect(dbConfig);
            const table = assetType === 'Device' ? 'Devices' : 'SimCards';
            const oldRes = await pool.request().input('Id', sql.NVarChar, assetId).query(`SELECT * FROM ${table} WHERE Id=@Id`);
            const prev = oldRes.recordset[0];
            const userId = prev?.CurrentUserId;
            
            let assetDetails = notes || '';
            let targetIdStr = assetId;

            if (assetType === 'Device' && prev) {
                const modelRes = await pool.request().input('Mid', sql.NVarChar, prev.ModelId).query("SELECT Name FROM Models WHERE Id=@Mid");
                const modelName = modelRes.recordset[0]?.Name || 'Dispositivo';
                assetDetails = `[TAG: ${prev.AssetTag || 'S/T'} | S/N: ${prev.SerialNumber || 'S/S'} | IMEI: ${prev.Imei || 'S/I'}] ${modelName}`;
                targetIdStr = `${prev.AssetTag || prev.Imei || prev.SerialNumber} (${modelName})`;
            } else if (prev) {
                assetDetails = `[CHIP: ${prev.PhoneNumber}]`;
                targetIdStr = prev.PhoneNumber;
            }

            let userName = 'Colaborador';
            if (userId) {
                const userRes = await pool.request().input('Uid', sql.NVarChar, userId).query("SELECT FullName FROM Users WHERE Id=@Uid");
                userName = userRes.recordset[0]?.FullName || 'Colaborador';
            }
            
            await pool.request().input('Aid', assetId).query(`UPDATE ${table} SET Status='Disponível', CurrentUserId=NULL WHERE Id=@Aid`);
            
            if (userId) {
                const termId = Math.random().toString(36).substr(2, 9);
                
                const ev1 = evidenceFiles && evidenceFiles.length > 0 ? getBufferFromBase64(evidenceFiles[0]) : null;
                const ev2 = evidenceFiles && evidenceFiles.length > 1 ? getBufferFromBase64(evidenceFiles[1]) : null;
                const ev3 = evidenceFiles && evidenceFiles.length > 2 ? getBufferFromBase64(evidenceFiles[2]) : null;
                
                await pool.request()
                    .input('I', termId)
                    .input('U', userId)
                    .input('T', 'DEVOLUCAO')
                    .input('Ad', assetDetails)
                    .input('Cond', condition || 'Perfeito')
                    .input('Desc', damageDescription || null)
                    .input('Notes', notes || null)
                    .input('Evid', sql.VarBinary, ev1)
                    .input('Evid2', sql.VarBinary, ev2)
                    .input('Evid3', sql.VarBinary, ev3)
                    .input('IsM', isManual ? 1 : 0)
                    .input('ResR', resolutionReason || null)
                    .query("INSERT INTO Terms (Id, UserId, Type, AssetDetails, Date, Condition, DamageDescription, Notes, EvidenceBinary, Evidence2Binary, Evidence3Binary, IsManual, ResolutionReason) VALUES (@I, @U, @T, @Ad, GETDATE(), @Cond, @Desc, @Notes, @Evid, @Evid2, @Evid3, @IsM, @ResR)");
                
                if (inactivateUser) {
                    await pool.request().input('Uid', sql.NVarChar, userId).query("UPDATE Users SET Active=0, Status='Inativo' WHERE Id=@Uid");
                    await logAction(userId, 'User', 'Inativação', _adminUser, userName, 'Inativado automaticamente durante a devolução (Desligamento)');
                }
            }
            
            const richNotes = `Origem: ${userName}\nStatus: 'Em Uso' ➔ 'Disponível'${notes ? `\nObservação: ${notes}` : ''}${condition && condition !== 'Perfeito' ? `\nCondição: ${condition}\nDescrição do Dano: ${damageDescription || 'N/A'}` : ''}`;
            await logAction(assetId, assetType, 'Devolução', _adminUser, targetIdStr, richNotes, null, { status: 'Em Uso', currentUserId: userId, userName: userName }, { status: 'Disponível', currentUserId: null, timestamp: new Date().toISOString() });
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/devices', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            let columns = [];
            let values = [];
            const processedKeys = new Set();

            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                if (key.endsWith('Binary')) continue;
                
                const val = (['customFieldIds', 'customData', 'userIds', 'deviceIds'].includes(key)) ? JSON.stringify(req.body[key]) : req.body[key];
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        columns.push(dbKey);
                        values.push('@' + dbKey);
                    }
                    continue;
                }

                request.input(dbKey, val);
                columns.push(dbKey);
                values.push('@' + dbKey);
            }
            await request.query(`INSERT INTO Devices (${columns.join(',')}) VALUES (${values.join(',')})`);

            if (req.body.linkedSimId) {
                await pool.request()
                    .input('Sid', sql.NVarChar, req.body.linkedSimId)
                    .query("UPDATE SimCards SET Status='Em Uso' WHERE Id=@Sid");
            }

            const tName = req.body.assetTag || req.body.serialNumber || 'Novo Dispositivo';
            await logAction(req.body.id, 'Device', 'Criação', req.body._adminUser, tName, 'Dispositivo criado manualmente');
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.put('/api/devices/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            const request = pool.request();
            
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT * FROM Devices WHERE Id=@Id");
            const prev = oldRes.recordset[0];
            
            let diffNotes = [];
            let sets = [];
            const processedKeys = new Set();

            for (let key in req.body) {
                if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                if (key.endsWith('Binary')) continue;

                const val = (key === 'customFieldIds' || key === 'customData') ? JSON.stringify(req.body[key]) : req.body[key];
                let dbKey = key.charAt(0).toUpperCase() + key.slice(1);

                if (key === 'purchaseInvoiceUrl') dbKey = 'PurchaseInvoiceBinary';
                else if (key === 'imageUrl') dbKey = 'ImageBinary';
                else if (key === 'invoiceUrl') dbKey = 'InvoiceBinary';
                else if (key === 'fileUrl') dbKey = 'FileBinary';

                if (processedKeys.has(dbKey)) continue;
                processedKeys.add(dbKey);

                if (['PurchaseInvoiceBinary', 'ImageBinary', 'InvoiceBinary', 'FileBinary'].includes(dbKey)) {
                    if (isBase64(val)) {
                        const buffer = getBufferFromBase64(val);
                        request.input(dbKey, sql.VarBinary, buffer);
                        sets.push(`${dbKey}=@${dbKey}`);
                    } else {
                        request.input(dbKey, sql.VarBinary, null);
                        sets.push(`${dbKey}=@${dbKey}`);
                    }
                    continue;
                }

                request.input(dbKey, val);
                sets.push(`${dbKey}=@${dbKey}`);

                if (prev) {
                    let oldVal = prev[dbKey];
                    let newVal = req.body[key];
                    if (['customData', 'customFieldIds', 'userIds', 'deviceIds'].includes(key)) newVal = JSON.stringify(newVal);
                    
                    if (String(oldVal || '') !== String(newVal || '')) {
                        diffNotes.push(`${key}: '${oldVal || '---'}' ➔ '${newVal || '---'}'`);
                    }
                }
            }
            request.input('TargetId', req.params.id);
            await request.query(`UPDATE Devices SET ${sets.join(',')} WHERE Id=@TargetId`);
            
            const oldSimId = prev?.LinkedSimId;
            const newSimId = req.body.linkedSimId;

            if (oldSimId !== newSimId) {
                if (oldSimId) {
                    await pool.request()
                        .input('Sid', sql.NVarChar, oldSimId)
                        .query("UPDATE SimCards SET Status='Disponível' WHERE Id=@Sid");
                }
                if (newSimId) {
                    await pool.request()
                        .input('Sid', sql.NVarChar, newSimId)
                        .query("UPDATE SimCards SET Status='Em Uso' WHERE Id=@Sid");
                }
            }

            const richNotes = (req.body._notes || req.body._reason ? `Motivo: ${req.body._notes || req.body._reason}\n\n` : '') + diffNotes.join('\n');
            const tName = req.body.assetTag || req.body.serialNumber || 'Dispositivo';
            
            await logAction(req.params.id, 'Device', 'Atualização', req.body._adminUser, tName, richNotes, null, prev, req.body);
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.delete('/api/devices/:id', async (req, res) => {
        try {
            const pool = await sql.connect(dbConfig);
            
            const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query("SELECT LinkedSimId FROM Devices WHERE Id=@Id");
            const device = oldRes.recordset[0];

            if (device && device.LinkedSimId) {
                await pool.request()
                    .input('Sid', sql.NVarChar, device.LinkedSimId)
                    .query("UPDATE SimCards SET Status='Disponível' WHERE Id=@Sid");
            }

            await pool.request().input('Id', req.params.id).query("DELETE FROM Devices WHERE Id=@Id");
            res.json({success: true});
        } catch (err) { res.status(500).send(err.message); }
    });

    app.post('/api/devices/bulk', async (req, res) => {
        try {
            const { ids, updates, _adminUser } = req.body;
            const pool = await sql.connect(dbConfig);
            
            for (const id of ids) {
                const request = pool.request();
                const oldRes = await pool.request().input('Id', sql.NVarChar, id).query("SELECT * FROM Devices WHERE Id=@Id");
                const prev = oldRes.recordset[0];
                
                let sets = [];
                for (let key in updates) {
                    if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                    let dbKey = key.charAt(0).toUpperCase() + key.slice(1);
                    request.input(dbKey, updates[key]);
                    sets.push(`${dbKey}=@${dbKey}`);
                }
                
                if (sets.length > 0) {
                    request.input('TargetId', id);
                    await request.query(`UPDATE Devices SET ${sets.join(',')} WHERE Id=@TargetId`);
                    await logAction(id, 'Device', 'Atualização em Massa', _adminUser, prev?.AssetTag || 'Ativo', JSON.stringify(updates), null, prev, updates);
                }
            }
            res.json({ success: true });
        } catch (err) { res.status(500).send(err.message); }
    });
};
