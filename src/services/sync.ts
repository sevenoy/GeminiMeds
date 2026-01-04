import { supabase, getCurrentUserId } from '../lib/supabase';
import { db, getMedications, getMedicationLogs, upsertMedication, addMedicationLog } from '../db/localDB';
import { Medication, MedicationLog, SnapshotPayload, SaveResult } from '../types';
import { getDeviceId } from '../utils';
import { runWithRemoteFlag } from './realtime';

// Get current snapshot payload from local DB
export async function getCurrentSnapshotPayload(): Promise<SnapshotPayload> {
    const medications = await getMedications();
    const medicationLogs = await getMedicationLogs();

    return {
        medications,
        medicationLogs,
        version: 1,
        timestamp: new Date().toISOString()
    };
}

// Save snapshot to cloud
export async function cloudSaveV2(): Promise<SaveResult> {
    const userId = await getCurrentUserId();
    if (!userId) {
        return { success: false, message: '请先登录' };
    }

    const deviceId = getDeviceId();
    const currentSnapshot = await getCurrentSnapshotPayload();

    try {
        const { data, error } = await supabase
            .from('app_snapshots')
            .upsert({
                owner_id: userId,
                key: 'default',
                payload: currentSnapshot,
                version: currentSnapshot.version,
                updated_by: deviceId,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[Snapshot] Save error:', error);
            return { success: false, message: error.message };
        }

        console.log('[Snapshot] Saved successfully');
        return { success: true, version: data.version };
    } catch (error: any) {
        console.error('[Snapshot] Save exception:', error);
        return { success: false, message: error.message };
    }
}

// Load snapshot from cloud
export async function cloudLoadV2(): Promise<SnapshotPayload | null> {
    const userId = await getCurrentUserId();
    if (!userId) {
        console.warn('[Snapshot] No user logged in');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('app_snapshots')
            .select('*')
            .eq('owner_id', userId)
            .eq('key', 'default')
            .single();

        if (error) {
            console.error('[Snapshot] Load error:', error);
            return null;
        }

        if (!data) {
            console.log('[Snapshot] No snapshot found');
            return null;
        }

        console.log('[Snapshot] Loaded successfully');
        return data.payload as SnapshotPayload;
    } catch (error) {
        console.error('[Snapshot] Load exception:', error);
        return null;
    }
}

// Apply snapshot to local DB
export async function applySnapshot(snapshot: SnapshotPayload): Promise<void> {
    await runWithRemoteFlag(async () => {
        console.log('[Snapshot] Applying snapshot to local DB');

        // Clear existing data
        await db.medications.clear();
        await db.medicationLogs.clear();

        // Insert new data
        if (snapshot.medications.length > 0) {
            await db.medications.bulkPut(snapshot.medications);
        }

        if (snapshot.medicationLogs.length > 0) {
            await db.medicationLogs.bulkPut(snapshot.medicationLogs);
        }

        console.log('[Snapshot] Applied successfully');
    });
}

// Push local changes to cloud
export async function pushLocalChanges(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const deviceId = getDeviceId();

    // Push medications
    const medications = await getMedications();
    for (const med of medications) {
        try {
            await supabase
                .from('medications')
                .upsert({
                    ...med,
                    user_id: userId,
                    device_id: deviceId,
                    updated_at: new Date().toISOString()
                });
        } catch (error) {
            console.error('[Sync] Failed to push medication:', med.id, error);
        }
    }

    // Push unsynced logs
    const unsyncedLogs = await db.medicationLogs
        .where('sync_state')
        .equals('dirty')
        .toArray();

    for (const log of unsyncedLogs) {
        try {
            await supabase
                .from('medication_logs')
                .upsert({
                    ...log,
                    user_id: userId,
                    source_device: deviceId
                });

            // Mark as synced
            await db.medicationLogs.update(log.id, { sync_state: 'synced' });
        } catch (error) {
            console.error('[Sync] Failed to push log:', log.id, error);
        }
    }

    console.log('[Sync] Pushed local changes');
}

// Pull remote changes from cloud
export async function pullRemoteChanges(): Promise<void> {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await runWithRemoteFlag(async () => {
        // Pull medications
        const { data: medications } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', userId);

        if (medications) {
            for (const med of medications) {
                await upsertMedication(med as Medication);
            }
        }

        // Pull logs
        const { data: logs } = await supabase
            .from('medication_logs')
            .select('*')
            .eq('user_id', userId);

        if (logs) {
            for (const log of logs) {
                await addMedicationLog({ ...log, sync_state: 'synced' } as MedicationLog);
            }
        }

        console.log('[Sync] Pulled remote changes');
    });
}
