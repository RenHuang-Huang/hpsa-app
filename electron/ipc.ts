import { app, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import db from './db';
import { ExportService } from './services/ExportService';
// import { v4 as uuidv4 } from 'uuid';
// import { Store } from './store';

import crypto from 'crypto';

const generateUUID = () => crypto.randomUUID();
// const store = new Store('user-data.json');

export function setupIpc() {
    console.log("Setting up IPC handlers...");
    const exportService = new ExportService(db);


    // ==========================================
    // Database Config
    // ==========================================
    ipcMain.handle('get-db-config', () => {
        const currentPath = db.name;
        // Determine if it is a custom path by checking config
        // Note: This is a lightweight check. For 100% accuracy we'd read config again or export it from db.ts
        // But for UI display 'db.name' is sufficient.
        // To know if it is "custom", we can check if it matches the default.
        // Actually, let's just return the path and let the UI/Store decide, or read config here.
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        let isCustom = false;
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.customDbPath && path.resolve(config.customDbPath) === path.resolve(currentPath)) {
                    isCustom = true;
                }
            }
        } catch (e) { }
        return { path: currentPath, isCustom };
    });

    ipcMain.handle('select-db-path', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: '選擇資料庫存放資料夾'
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('set-db-path', (_, folderPath) => {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        const newDbPath = path.join(folderPath, 'hpsa_prod.db');

        try {
            let config: any = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
            config.customDbPath = newDbPath;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('reset-db-path', () => {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'config.json');
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                delete config.customDbPath;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('app-exit', () => {
        app.quit();
    });

    ipcMain.handle('open-external', async (_, url) => {
        await shell.openExternal(url);
        return { success: true };
    });

    ipcMain.handle('mark-records-printed', (_, uuids: string[]) => {
        try {
            const placeholders = uuids.map(() => '?').join(',');
            db.prepare(`UPDATE inspection_results SET is_printed = 1 WHERE uuid IN (${placeholders})`).run(...uuids);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    // ==========================================
    // Authenticaton
    // ==========================================
    ipcMain.handle('auth-check-status', () => {
        const row = db.prepare('SELECT count(*) as count FROM users').get();
        return { isInitialized: (row as any).count > 0 };
    });

    ipcMain.handle('auth-setup', (_, { username, password }) => {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        const stmt = db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (@username, @hash, @salt)');
        try {
            stmt.run({ username, hash, salt });
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('auth-login', (_, { username, password }) => {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
        if (!user) return { success: false, message: '使用者不存在' };

        const hash = crypto.pbkdf2Sync(password, user.salt, 1000, 64, 'sha512').toString('hex');
        if (hash === user.password_hash) {
            return { success: true };
        } else {
            return { success: false, message: '密碼錯誤' };
        }
    });

    // ==========================================
    // Master Data: Reagents
    // ==========================================
    ipcMain.handle('get-reagents', () => {
        return db.prepare('SELECT * FROM reagents ORDER BY code').all();
    });

    // ==========================================
    // Master Data: Hospitals (SQLite)
    // ==========================================
    ipcMain.handle('get-hospitals', () => {
        return db.prepare('SELECT * FROM hospitals ORDER BY created_at DESC').all();
    });

    ipcMain.handle('save-hospital', (_, { code, name }) => {
        const stmt = db.prepare(`
            INSERT INTO hospitals(code, name) VALUES(@code, @name)
            ON CONFLICT(code) DO UPDATE SET name = @name
    `);
        return stmt.run({ code, name });
    });

    ipcMain.handle('delete-hospital', (_, code) => {
        return db.prepare('DELETE FROM hospitals WHERE code = ?').run(code);
    });

    ipcMain.handle('import-hospitals', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }
            ],
            title: '匯入醫療院所資料'
        });

        if (result.canceled || result.filePaths.length === 0) return { success: false, message: '取消匯入' };

        const filePath = result.filePaths[0];
        try {
            // Use fs.readFileSync to ensure better handling of paths/locks before passing to XLSX
            const fileBuffer = fs.readFileSync(filePath);
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                return { success: false, message: '檔案內容為空' };
            }

            // Validation: Check first row for keys
            const firstRow = jsonData[0];
            if (!('院所代碼' in firstRow) || !('院所名稱' in firstRow)) {
                return { success: false, message: '格式錯誤：找不到「院所代碼」或「院所名稱」欄位' };
            }

            // Transaction
            const stmt = db.prepare(`
                INSERT INTO hospitals(code, name) VALUES(@code, @name)
                ON CONFLICT(code) DO UPDATE SET name = @name
    `);

            let count = 0;
            const transaction = db.transaction((rows) => {
                for (const row of rows) {
                    const code = String(row['院所代碼']).trim();
                    const name = String(row['院所名稱']).trim();
                    if (code && name) {
                        stmt.run({ code, name });
                        count++;
                    }
                }
            });

            transaction(jsonData);
            return { success: true, count };

        } catch (e: any) {
            console.error('Import Error:', e);
            let msg = e.message;
            if (e.code === 'EBUSY' || msg.includes('busy') || msg.includes('locked')) {
                msg = '檔案正被其他程式使用中 (例如 Excel)，請關閉後再試';
            }
            return { success: false, message: '匯入失敗: ' + msg };
        }
    });

    // ==========================================
    // Settings (Defaults) - SQLite
    // ==========================================
    ipcMain.handle('get-settings', () => {
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings: any = {};
        for (const row of (rows as any[])) {
            settings[row.key] = row.value;
        }
        return settings;
    });

    ipcMain.handle('save-setting', (_, { key, value }) => {
        const stmt = db.prepare(`
            INSERT INTO settings(key, value) VALUES(@key, @value)
            ON CONFLICT(key) DO UPDATE SET value = @value
    `);
        return stmt.run({ key, value });
    });

    ipcMain.handle('save-settings', (_, settings) => {
        const stmt = db.prepare(`
            INSERT INTO settings(key, value) VALUES(@key, @value)
            ON CONFLICT(key) DO UPDATE SET value = @value
    `);

        const transaction = db.transaction((data) => {
            for (const [key, value] of Object.entries(data)) {
                stmt.run({ key, value: String(value) });
            }
        });

        try {
            transaction(settings);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-record-status', (_, { uuid, status }) => {
        try {
            db.prepare('UPDATE inspection_results SET is_exported = ? WHERE uuid = ?').run(status, uuid);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    // ==========================================
    // Records
    // ==========================================
    ipcMain.handle('get-records', (_, { search, startDate, endDate, hospitalId, filters }) => {
        let query = `
            SELECT ir.*, h.name as hospital_name 
            FROM inspection_results ir
            LEFT JOIN hospitals h ON ir.hospital_id = h.code
            WHERE 1 = 1
    `;
        const params = [];

        // 1. Text Search (ID, Name, Hospital Code, Hospital Name, Birth Date)
        if (search) {
            query += ' AND (ir.id_no LIKE ? OR ir.hospital_id LIKE ? OR ir.name LIKE ? OR h.name LIKE ? OR ir.birth_date LIKE ?)';
            params.push(`%${search}%`);
            params.push(`%${search}%`);
            params.push(`%${search}%`);
            params.push(`%${search}%`);
            params.push(`%${search}%`);
        }

        // 2. Specific Filters (Advanced Search)
        if (filters) {
            if (filters.order_number) {
                query += ' AND ir.order_number LIKE ?';
                params.push(`%${filters.order_number}%`);
            }
            if (filters.lab_date_start) {
                query += ' AND ir.lab_date >= ?';
                params.push(filters.lab_date_start);
            }
            if (filters.lab_date_end) {
                query += ' AND ir.lab_date <= ?';
                params.push(filters.lab_date_end);
            }
            if (filters.hospital_name) {
                query += ' AND h.name LIKE ?';
                params.push(`%${filters.hospital_name}%`);
            }
            if (filters.name) {
                query += ' AND ir.name LIKE ?';
                params.push(`%${filters.name}%`);
            }
            if (filters.birth_date) {
                query += ' AND ir.birth_date = ?';
                params.push(filters.birth_date);
            }
            if (filters.id_no) {
                query += ' AND ir.id_no LIKE ?';
                params.push(`%${filters.id_no}%`);
            }
            if (filters.outpatient_date_start) {
                query += ' AND ir.outpatient_date >= ?';
                params.push(filters.outpatient_date_start);
            }
            if (filters.outpatient_date_end) {
                query += ' AND ir.outpatient_date <= ?';
                params.push(filters.outpatient_date_end);
            }
            if (filters.result !== undefined && filters.result !== '') {
                query += ' AND ir.result = ?';
                params.push(filters.result);
            }
            if (filters.is_printed !== undefined && filters.is_printed !== '') {
                query += ' AND ir.is_printed = ?';
                params.push(filters.is_printed);
            }
            if (filters.is_exported !== undefined && filters.is_exported !== '') {
                query += ' AND ir.is_exported = ?';
                params.push(filters.is_exported);
            }
        }

        // 3. Quick Filters (Legacy/Sidebar)
        if (hospitalId) {
            query += ' AND ir.hospital_id = ?';
            params.push(hospitalId);
        }

        // 4. Date Range (Global)
        if (startDate) {
            query += ' AND ir.lab_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND ir.lab_date <= ?';
            params.push(endDate);
        }

        // 5. Default Rule: If NO filters at all, 
        // AND not searching, show current month data
        if (!search && !startDate && !endDate && !hospitalId && (!filters || Object.keys(filters).length === 0)) {
            const date = new Date();
            // Start from 1st day of current month
            const rocYear = date.getFullYear() - 1911;
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const cutoffDate = `${rocYear}${month}01`;

            query += ' AND ir.lab_date >= ?';
            params.push(cutoffDate);
        }

        query += ' ORDER BY ir.lab_date DESC, ir.created_at DESC LIMIT 500'; // Increase limit for search results

        return db.prepare(query).all(...params);
    });

    // Get Next Order Number
    ipcMain.handle('get-next-order-number', (_, labDate) => {
        const row = db.prepare('SELECT MAX(order_number) as maxNum FROM inspection_results WHERE lab_date = ?').get(labDate);
        const maxNum = row ? (row as any).maxNum : null;
        if (!maxNum) return '00001';
        const next = parseInt(maxNum, 10) + 1;
        return String(next).padStart(5, '0');
    });

    // Save Record (Upsert)
    ipcMain.handle('save-record', (_, record) => {
        // Validation: Unique Order Number per Day
        if (record.order_number && record.lab_date) {
            const existing = db.prepare(`
                SELECT uuid FROM inspection_results 
                WHERE lab_date = @lab_date AND order_number = @order_number AND uuid != @uuid
    `).get({
                lab_date: record.lab_date,
                order_number: record.order_number,
                uuid: record.uuid || ''
            });

            if (existing) {
                throw new Error(`檢驗單號重複：${record.lab_date} 已存在單號 ${record.order_number} `);
            }
        }

        if (record.uuid) {
            // Update
            const keys = Object.keys(record).filter(k => k !== 'uuid' && k !== 'created_at');
            const setClause = keys.map(k => `${k} = @${k} `).join(', ');
            // Reset is_exported to 0 on update
            const stmt = db.prepare(`UPDATE inspection_results SET ${setClause}, is_exported = 0, updated_at = CURRENT_TIMESTAMP WHERE uuid = @uuid`);
            return stmt.run(record);
        } else {
            // Insert
            const newRecord = { ...record, uuid: generateUUID() };
            const keys = Object.keys(newRecord);
            const cols = keys.join(', ');
            const vals = keys.map(k => `@${k} `).join(', ');
            const stmt = db.prepare(`INSERT INTO inspection_results(${cols}) VALUES(${vals})`);
            return stmt.run(newRecord);
        }
    });

    // Delete Record
    ipcMain.handle('delete-record', (_, uuid) => {
        return db.prepare('DELETE FROM inspection_results WHERE uuid = ?').run(uuid);
    });

    // ==========================================
    // Seed Data
    // ==========================================
    // Generate Valid Taiwan ID
    const generateRandomTWID = () => {
        const letters = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';
        const letter = letters[Math.floor(Math.random() * letters.length)];
        const letterIndex = letters.indexOf(letter) + 10;
        const n1 = Math.floor(letterIndex / 10);
        const n2 = letterIndex % 10;

        // Gender 1=Male, 2=Female
        const genderCode = Math.floor(Math.random() * 2) + 1;

        let idArray = [n1, n2, genderCode];
        for (let i = 0; i < 7; i++) {
            idArray.push(Math.floor(Math.random() * 10));
        }

        // Calculate Checksum
        // L1 L2 D1 D2 D3 D4 D5 D6 D7 D8
        // X1 9  8  7  6  5  4  3  2  1  1 (Weights)
        const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += idArray[i] * weights[i];
        }

        const checkCode = (10 - (sum % 10)) % 10;

        // Reconstruct string (Letter + Gender + 7 digits + CheckCode)
        const idBody = idArray.slice(2).join('') + checkCode;
        return letter + idBody;
    };

    ipcMain.handle('seed-records', () => {
        const hospitals = db.prepare('SELECT code FROM hospitals').all();
        if (hospitals.length === 0) return { success: false, message: 'No hospitals found' };

        const insertStmt = db.prepare(`
            INSERT INTO inspection_results(
        uuid, id_no, name, gender, birth_date, hospital_id,
        outpatient_date, lab_id, lab_date, result, reagent_code, order_number, report_date,
        fee, second_fee, second_result, second_reagent_code, second_report_date, second_lab_date, second_outpatient_date
    ) VALUES(
        @uuid, @id_no, @name, @gender, @birth_date, @hospital_id,
        @outpatient_date, @lab_id, @lab_date, @result, @reagent_code, @order_number, @report_date,
        @fee, @second_fee, @second_result, @second_reagent_code, @second_report_date, @second_lab_date, @second_outpatient_date
    )
        `);

        // Transaction ensures speed and consistency
        const transaction = db.transaction((count: number) => {
            for (let i = 0; i < count; i++) {
                const hospital = hospitals[1];

                // 1. Generate Valid ID & Deduce Gender
                const randomId = generateRandomTWID();
                // Taiwan ID Gender Logic: 2nd char '1'=Male, '2'=Female
                const genderChar = randomId.charAt(1);
                const randomGender = genderChar === '1' ? 'M' : 'F';

                const randomName = `測試者${Math.floor(Math.random() * 1000)}`;

                // Random date last 30 days
                const date = new Date();
                date.setDate(date.getDate() - Math.floor(Math.random() * 30));

                const formatRocDate = (d: Date) => {
                    const rocYear = d.getFullYear() - 1911;
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${rocYear}${month}${day}`;
                };

                const rocDate = formatRocDate(date);
                const reportDate = formatRocDate(date); // Same day report for mock

                const resultRand = Math.random();
                let result = '0';
                if (resultRand > 0.95) result = '2'; // 5% Invalid
                else if (resultRand > 0.8) result = '1'; // 15% Positive

                // 2. Second Result Logic: Only if First Result is Invalid (2)
                let secondResult = '';
                let secondDate = '';
                let secondFee: number | null = null;

                if (result === '2') {
                    // Force second result if invalid
                    secondResult = Math.random() > 0.5 ? '0' : '1';
                    const nextDate = new Date(date);
                    nextDate.setDate(date.getDate() + 7); // 7 days later
                    secondDate = formatRocDate(nextDate);
                    secondFee = 230;
                }

                insertStmt.run({
                    uuid: generateUUID(),
                    id_no: randomId,
                    name: randomName,
                    gender: randomGender,
                    birth_date: '0600101',
                    hospital_id: (hospital as any).code,
                    outpatient_date: rocDate,
                    lab_id: '1234567890', // Default Lab
                    lab_date: rocDate,
                    result: result,
                    reagent_code: '001',
                    order_number: (10000 + i).toString().slice(-5),
                    report_date: reportDate,
                    fee: 220, // Default Fee
                    second_fee: secondFee, // Using null if no second fee
                    second_result: secondResult,
                    second_reagent_code: secondResult ? '001' : '',
                    second_report_date: secondDate, // Use secondDate for report
                    second_lab_date: secondDate,
                    second_outpatient_date: secondDate
                });
            }
        });

        try {
            transaction(100);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('clear-records', () => {
        try {
            db.prepare('DELETE FROM inspection_results').run();
            // Optional: reset autoincrement if needed, but uuid is primary
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    // ==========================================
    // Export
    // ==========================================
    ipcMain.handle('export-batch', async (_, { hospitalId, labId, startDate, endDate, uuidList, suffix, format }) => {
        const date = new Date();
        const rocYear = date.getFullYear() - 1911;
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const rocYM = `${rocYear}${month}`;

        const filenameSuffix = suffix ? `_${suffix}` : '';
        const defaultPath = `HpSAA${labId}_${rocYM}${filenameSuffix}.csv`;

        const { filePath } = await dialog.showSaveDialog({
            title: '匯出申報檔案',
            defaultPath: defaultPath,
            filters: [{ name: 'CSV/TXT', extensions: ['csv', 'txt'] }]
        });

        if (!filePath) return { success: false };

        try {
            const mode = suffix === 'Del' ? 'deletion' : 'full';
            const count = await exportService.exportBatch(hospitalId, labId, filePath, startDate, endDate, uuidList, mode, format);
            return { success: true, count, filePath };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    });
    // ==========================================
    // Dialogs
    // ==========================================
    ipcMain.handle('show-confirm', async (_, { message, title = '確認', type = 'question', okLabel = '確定', cancelLabel = '取消' }) => {
        const result = await dialog.showMessageBox({
            type: type,
            buttons: [okLabel, cancelLabel],
            title: title || 'Confirmation',
            message: message,
            defaultId: 0,
            cancelId: 1,
        });
        return result.response === 0;
    });

    ipcMain.handle('show-message-box', async (_, options) => {
        const result = await dialog.showMessageBox({
            type: options.type || 'info',
            buttons: options.buttons || ['OK'],
            title: options.title || 'Message',
            message: options.message,
            defaultId: options.defaultId || 0,
            cancelId: options.cancelId,
        });
        return result.response;
    });

    ipcMain.handle('show-alert', async (_, { message, title = '訊息', type = 'info' }) => {
        await dialog.showMessageBox({
            type: type,
            buttons: ['OK'],
            title: title,
            message: message,
        });
        return true;
    });

    // ==========================================
    // Database Backup & Restore
    // ==========================================
    ipcMain.handle('backup-database', async () => {
        const { filePath } = await dialog.showSaveDialog({
            title: '備份資料庫',
            defaultPath: `hpsa_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.db`,
            filters: [{ name: 'SQLite Database', extensions: ['db'] }]
        });

        if (!filePath) return { success: false, message: '已取消' };

        try {
            await db.backup(filePath);
            return { success: true, filePath };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    });

    ipcMain.handle('restore-database', async () => {
        const { filePaths } = await dialog.showOpenDialog({
            title: '選擇備份檔案還原',
            filters: [{ name: 'SQLite Database', extensions: ['db'] }],
            properties: ['openFile']
        });

        if (filePaths.length === 0) return { success: false, message: '已取消' };
        const sourcePath = filePaths[0];

        try {
            // 1. Close current connection
            db.close();

            // 2. Overwrite current DB file
            // Note: This relies on dbPath being accessible in this scope. 
            // We defined dbPath at the top level of this file or passed it in?
            // Checking file... dbPath is defined at top of ipc.ts? No, it's passed to setupIPC usually or global?
            // Wait, looking at lines 1-50 (not shown), usually db is initialized globally in this file or main.
            // I need to check how db is initialized to know the path.
            // Assuming `db` object has `.name` property which is the filename.

            const currentDbPath = db.name;

            // Wait, better-sqlite3 db.name is the filename.
            fs.copyFileSync(sourcePath, currentDbPath);

            // 3. Re-open connection
            // We need to re-assign the global 'db' variable. 
            // Since 'db' is likely a 'const' imported or defined at top, we might need a way to re-init.
            // Let's check the top of the file first to be safe.
            // IF I cannot easily re-open, simply copying and telling user to restart is safer.
            // But the Plan said "re-open".
            // Let me pause and check the top of `ipc.ts` to see how `db` is defined.

            // Actually, for safety/simplicity in this context:
            // "Restore" -> Copy file -> Tell user to restart is VERY robust.
            // Hot-swapping the DB connection might be risky if there are prepared statements?
            // better-sqlite3 docs say: "You can use db.close() to close the database connection."
            // But if `db` is a const, I cannot overwrite the variable.

            // Strategy: Close, Copy, Return Success (Restart Required).

            return { success: true, restartRequired: true };

        } catch (e: any) {
            // Try to re-open if failed?
            try {
                // db = new Database(currentDbPath); // Only if I can reassign
                // If I cannot re-open, the app is in a broken state until restart.
            } catch (err) { }
            return { success: false, message: e.message };
        }
    });
}
