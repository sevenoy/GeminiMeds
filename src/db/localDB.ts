import Dexie, { Table } from 'dexie';
import { Medication, MedicationLog } from '../types';

class LocalDatabase extends Dexie {
    medications!: Table<Medication, string>;
    medicationLogs!: Table<MedicationLog, string>;

    constructor() {
        super('MedicationTrackerDB');

        this.version(1).stores({
            medications: 'id, user_id, name, scheduled_time, device_id',
            medicationLogs: 'id, medication_id, user_id, taken_at, sync_state, [medication_id+taken_at]'
        });
    }
}

export const db = new LocalDatabase();

// Helper functions for common operations
export async function getMedications(): Promise<Medication[]> {
    return await db.medications.toArray();
}

export async function getMedicationById(id: string): Promise<Medication | undefined> {
    return await db.medications.get(id);
}

export async function upsertMedication(medication: Medication): Promise<void> {
    await db.medications.put(medication);
}

export async function deleteMedication(id: string): Promise<void> {
    await db.medications.delete(id);
    // Also delete associated logs
    await db.medicationLogs.where('medication_id').equals(id).delete();
}

export async function getMedicationLogs(medicationId?: string): Promise<MedicationLog[]> {
    if (medicationId) {
        return await db.medicationLogs
            .where('medication_id')
            .equals(medicationId)
            .toArray();
    }
    return await db.medicationLogs.toArray();
}

export async function addMedicationLog(log: MedicationLog): Promise<void> {
    await db.medicationLogs.put(log);
}

export async function getUnsyncedLogs(): Promise<MedicationLog[]> {
    return await db.medicationLogs
        .where('sync_state')
        .equals('dirty')
        .toArray();
}

export async function markLogSynced(id: string): Promise<void> {
    await db.medicationLogs.update(id, { sync_state: 'synced' });
}
