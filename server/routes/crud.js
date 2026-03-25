const { sql, dbConfig, logAction, isBase64, getBufferFromBase64 } = require('../utils/db');

const IGexternal_CRUD_KEYS = ['accessories', 'terms', 'hasInvoice', 'hasFile', 'customDataStr', 'hasDueDate', 'isRecurring', 'recurrenceConfig', 'parentId'];

module.exports = (app) => {
    const crud = (table, route, assetType) => {
        app.post(`/api/${route}`, async (req, res) => {
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
                await request.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${values.join(',')})`);
                const tName = req.body.assetTag || req.body.name || req.body.phoneNumber || req.body.fullName;
                await logAction(req.body.id, assetType, 'Criação', req.body._adminUser, tName, 'Item criado manualmente no sistema');
                res.json({success: true});
            } catch (err) { res.status(500).send(err.message); }
        });

        app.put(`/api/${route}/:id`, async (req, res) => {
            try {
                const pool = await sql.connect(dbConfig);
                const request = pool.request();
                const oldRes = await pool.request().input('Id', sql.NVarChar, req.params.id).query(`SELECT * FROM ${table} WHERE Id=@Id`);
                const prev = oldRes.recordset[0];
                
                let diffNotes = [];
                let sets = [];
                const processedKeys = new Set();
                for (let key in req.body) {
                    if (key.startsWith('_') || IGexternal_CRUD_KEYS.includes(key)) continue;
                    if (key.endsWith('Binary')) continue;

                    const val = (['customFieldIds', 'customData', 'userIds', 'deviceIds'].includes(key)) ? JSON.stringify(req.body[key]) : req.body[key];
                    if (val === null || val === undefined) continue; 

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
                await request.query(`UPDATE ${table} SET ${sets.join(',')} WHERE Id=@TargetId`);
                
                const richNotes = (req.body._notes || req.body._reason ? `Motivo: ${req.body._notes || req.body._reason}\n\n` : '') + diffNotes.join('\n');
                const tName = req.body.assetTag || req.body.name || req.body.phoneNumber || req.body.fullName;
                
                await logAction(req.params.id, assetType, 'Atualização', req.body._adminUser, tName, richNotes, null, prev, req.body);
                res.json({success: true});
            } catch (err) { res.status(500).send(err.message); }
        });

        app.delete(`/api/${route}/:id`, async (req, res) => {
            try {
                const pool = await sql.connect(dbConfig);
                await pool.request().input('Id', req.params.id).query(`DELETE FROM ${table} WHERE Id=@Id`);
                res.json({success: true});
            } catch (err) { res.status(500).send(err.message); }
        });
    };

    crud('Sectors', 'sectors', 'Sector');
    crud('Brands', 'brands', 'Brand');
    crud('AssetTypes', 'asset-types', 'Type');
    crud('Models', 'models', 'Model');
    crud('AccessoryTypes', 'accessory-types', 'Accessory');
    crud('CustomFields', 'custom-fields', 'CustomField');
    crud('MaintenanceRecords', 'maintenances', 'Maintenance');
    crud('SoftwareAccounts', 'accounts', 'Account');
    crud('Users', 'users', 'User');
    crud('SimCards', 'sims', 'Sim');
};
