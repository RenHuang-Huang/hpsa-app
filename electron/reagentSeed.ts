import { Database } from 'better-sqlite3';

const REAGENTS = Array.from({ length: 42 }, (_, i) => {
    const code = String(i + 1).padStart(3, '0');
    return { code, name: `試劑 ${code}` };
});

// Add special other code
REAGENTS.push({ code: '999', name: '其他試劑' });

export function seedReagents(db: Database) {
    const insert = db.prepare('INSERT OR IGNORE INTO reagents (code, name) VALUES (@code, @name)');
    const insertMany = db.transaction((reagents) => {
        for (const reagent of reagents) insert.run(reagent);
    });
    insertMany(REAGENTS);
    console.log('Reagents seeded.');
}
