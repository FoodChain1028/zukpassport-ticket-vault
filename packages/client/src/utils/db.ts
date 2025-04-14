import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Define the path for the SQLite database file
// Store it in a temporary directory or a designated data directory
// Avoid storing it directly in the src directory
const dbPath = path.resolve(process.cwd(), 'temp_verification_data.db');

let db: Database | null = null;

// Function to initialize the database connection and create the table
async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const verboseSqlite3 = sqlite3.verbose();
  const newDb = await open({
    filename: dbPath,
    driver: verboseSqlite3.Database,
  });

  console.log(`Connected to SQLite database at ${dbPath}`);

  // Create the table if it doesn't exist
  await newDb.exec(`
    CREATE TABLE IF NOT EXISTS verification_data (
      uid TEXT PRIMARY KEY,
      proof TEXT NOT NULL,
      public_signals TEXT NOT NULL,
      disclosure_data TEXT, -- Added disclosure_data column, assuming it will be stringified JSON
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Optional: Create an index for faster timestamp lookups (for cleanup)
  await newDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_timestamp ON verification_data (timestamp);
  `);

  console.log('Table "verification_data" initialized.');
  db = newDb;
  return db;
}

// Function to add verification data
export async function addVerificationData(
  uid: string,
  proof: Record<string, unknown>,
  publicSignals: Record<string, unknown>,
  disclosureData?: Record<string, unknown>,
): Promise<void> {
  const dbInstance = await initializeDatabase();
  const proofString = JSON.stringify(proof);
  const publicSignalsString = JSON.stringify(publicSignals);
  const disclosureDataString = disclosureData ? JSON.stringify(disclosureData) : null;

  await dbInstance.run(
    'INSERT INTO verification_data (uid, proof, public_signals, disclosure_data) VALUES (?, ?, ?, ?)',
    uid,
    proofString,
    publicSignalsString,
    disclosureDataString,
  );
  console.log(`Data inserted for UID: ${uid}`);
}

// Function to retrieve verification data by UID
export async function getVerificationData(uid: string): Promise<{
  proof: Record<string, unknown>;
  public_signals: Record<string, unknown>;
  disclosure_data?: Record<string, unknown>;
} | null> {
  const dbInstance = await initializeDatabase();
  const row = await dbInstance.get<{
    proof: string;
    public_signals: string;
    disclosure_data: string | null;
  }>('SELECT proof, public_signals, disclosure_data FROM verification_data WHERE uid = ?', uid);

  if (row) {
    return {
      proof: JSON.parse(row.proof) as Record<string, unknown>,
      public_signals: JSON.parse(row.public_signals) as Record<string, unknown>,
      disclosure_data: row.disclosure_data
        ? (JSON.parse(row.disclosure_data) as Record<string, unknown>)
        : undefined,
    };
  }
  return null;
}

// Function to delete old verification data (e.g., older than 1 hour)
export async function cleanupOldData(maxAgeMinutes: number = 60): Promise<void> {
  const dbInstance = await initializeDatabase();
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  const result = await dbInstance.run(
    'DELETE FROM verification_data WHERE timestamp < ?',
    cutoffTime,
  );
  console.log(`Cleaned up ${result.changes} old records.`);
}

// Initialize the database when the module loads
// initializeDatabase().catch(console.error);

// Periodically clean up old data (e.g., every hour)
// setInterval(() => {
//     cleanupOldData().catch(console.error);
// }, 60 * 60 * 1000); // Run every hour
