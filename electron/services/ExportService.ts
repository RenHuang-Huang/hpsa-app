import iconv from 'iconv-lite';
import fs from 'fs';
// import Database from 'better-sqlite3';

export class ExportService {
    private db: any;

    constructor(db: any) {
        this.db = db;
    }

    private toBig5Buffer(str: string, length: number): Buffer {
        // User Rule: 1 Chinese char = 1 unit of length (Character count, not bytes)
        let val = str || '';
        if (val.length > length) {
            val = val.substring(0, length);
        }
        // Pad with spaces to match target CHARACTER length
        val = val.padEnd(length, ' ');

        return iconv.encode(val, 'Big5');
    }

    // Logic to export
    public async exportBatch(hospitalId: string, labId: string, targetPath: string, startDate?: string, endDate?: string, uuidList?: string[], mode: 'full' | 'deletion' = 'full', format: 'fixed' | 'csv' = 'fixed'): Promise<number> {
        // Fetch non-exported records OR selected records
        let query = 'SELECT * FROM inspection_results WHERE 1=1';

        const params: any[] = [];

        if (uuidList && uuidList.length > 0) {
            const placeholders = uuidList.map(() => '?').join(',');
            query += ` AND uuid IN (${placeholders})`;
            params.push(...uuidList);
        } else {
            // Default Batch Mode
            query += ' AND is_exported = 0';

            if (hospitalId) {
                query += ' AND hospital_id = ?';
                params.push(hospitalId);
            }

            if (startDate && endDate) {
                query += ' AND lab_date >= ? AND lab_date <= ?';
                params.push(startDate);
                params.push(endDate);
            }
        }

        const records = this.db.prepare(query).all(...params);

        if (records.length === 0) return 0;

        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(targetPath);

            fileStream.on('error', (err) => {
                reject(err);
            });

            fileStream.on('finish', () => {
                resolve(records.length);
            });

            // If we can't write, we shouldn't update the DB either, but for now let's write first
            try {
                const updateStmt = this.db.prepare('UPDATE inspection_results SET is_exported = 1 WHERE uuid = ?');
                for (const record of (records as any[])) {
                    let lineBuffers: Buffer[] = [];

                    if (format === 'csv') {
                        // --- CSV Format (Comma Separated, Big5, No Padding) ---
                        const fields: string[] = [];
                        if (mode === 'deletion') {
                            fields.push(record.id_no || '');
                            fields.push(record.hospital_id || hospitalId || '');
                            fields.push(record.outpatient_date || '');
                            fields.push(record.second_outpatient_date || '');
                        } else {
                            fields.push(record.id_no || '');
                            fields.push(record.hospital_id || hospitalId || '');
                            fields.push(record.outpatient_date || '');
                            fields.push(record.lab_id || labId || '');
                            fields.push(record.lab_date || '');
                            fields.push(String(record.result));
                            fields.push(record.reagent_code || '');
                            // Other Regaent
                            fields.push(record.other_reagent_zh || '');
                            fields.push(record.other_reagent_en || '');
                            fields.push(record.other_license_no || '');
                            fields.push(record.other_expire_date || '');

                            fields.push(record.report_date || '');

                            // Second Result
                            fields.push(record.second_outpatient_date || '');
                            fields.push(record.second_lab_date || '');
                            fields.push(record.second_result !== null ? String(record.second_result) : '');
                            fields.push(record.second_reagent_code || '');

                            // Second Other Reagent
                            fields.push(record.second_other_reagent_zh || '');
                            fields.push(record.second_other_reagent_en || '');
                            fields.push(record.second_other_license_no || '');
                            fields.push(record.second_other_expire_date || '');

                            fields.push(record.second_report_date || '');
                        }

                        const lineStr = fields.join(',') + '\r\n';
                        lineBuffers.push(iconv.encode(lineStr, 'Big5'));

                    } else {
                        // --- Fixed Length Format (Existing) ---
                        if (mode === 'deletion') {
                            // --- Deletion Format (4 Columns) ---
                            // 1. id_no (10)
                            lineBuffers.push(this.toBig5Buffer(record.id_no, 10));
                            // 2. hospital_id (10)
                            lineBuffers.push(this.toBig5Buffer(record.hospital_id || hospitalId, 10));
                            // 3. outpatient_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.outpatient_date, 7));
                            // 4. second_outpatient_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.second_outpatient_date, 7));
                        } else {
                            // --- Full Format (Revised 21 Columns) ---
                            // 1. id_no (10)
                            lineBuffers.push(this.toBig5Buffer(record.id_no, 10));
                            // 2. hospital_id (10)
                            lineBuffers.push(this.toBig5Buffer(record.hospital_id || hospitalId, 10));
                            // 3. outpatient_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.outpatient_date, 7));
                            // 4. lab_id (10) - Use passed labId or record.lab_id
                            lineBuffers.push(this.toBig5Buffer(record.lab_id || labId, 10));
                            // 5. lab_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.lab_date, 7));
                            // 6. result (1)
                            lineBuffers.push(this.toBig5Buffer(String(record.result), 1));
                            // 7. reagent_code (3)
                            lineBuffers.push(this.toBig5Buffer(record.reagent_code, 3));

                            // 8-11. Other Reagent (Zh, En, Lic, Exp)
                            lineBuffers.push(this.toBig5Buffer(record.other_reagent_zh, 100));
                            lineBuffers.push(this.toBig5Buffer(record.other_reagent_en, 100));
                            lineBuffers.push(this.toBig5Buffer(record.other_license_no, 30));
                            lineBuffers.push(this.toBig5Buffer(record.other_expire_date, 7));

                            // 12. report_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.report_date, 7));

                            // 13. second_outpatient_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.second_outpatient_date, 7));
                            // 14. second_lab_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.second_lab_date, 7));
                            // 15. second_result (1)
                            lineBuffers.push(this.toBig5Buffer(String(record.second_result), 1));
                            // 16. second_reagent_code (3)
                            lineBuffers.push(this.toBig5Buffer(record.second_reagent_code, 3));

                            // 17-20. Second Other Reagent
                            lineBuffers.push(this.toBig5Buffer(record.second_other_reagent_zh, 100));
                            lineBuffers.push(this.toBig5Buffer(record.second_other_reagent_en, 100));
                            lineBuffers.push(this.toBig5Buffer(record.second_other_license_no, 30));
                            lineBuffers.push(this.toBig5Buffer(record.second_other_expire_date, 7));

                            // 21. second_report_date (7)
                            lineBuffers.push(this.toBig5Buffer(record.second_report_date, 7));
                        }
                        // EOL (CRLF) for Fixed
                        lineBuffers.push(Buffer.from('\r\n'));
                    }

                    // Write to stream
                    fileStream.write(Buffer.concat(lineBuffers));

                    // Mark as exported
                    if (mode === 'deletion') {
                        this.db.prepare('UPDATE inspection_results SET is_exported = 2 WHERE uuid = ?').run(record.uuid);
                    } else if (mode === 'full') {
                        updateStmt.run(record.uuid);
                    }
                }

                fileStream.end();
            } catch (err) {
                fileStream.destroy();
                reject(err);
            }
        });
    }
}
