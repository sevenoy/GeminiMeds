import { supabase, getCurrentUserId } from '../lib/supabase';
import { getDeviceId } from '../utils';
import { RealtimeCallbacks } from '../types';

let isApplyingRemote = false;

export function isApplyingRemoteChange(): boolean {
    return isApplyingRemote;
}

export async function runWithRemoteFlag(fn: () => Promise<void>): Promise<void> {
    isApplyingRemote = true;
    try {
        await fn();
    } finally {
        // Delay reset to ensure all sync operations complete
        setTimeout(() => {
            isApplyingRemote = false;
        }, 2000);
    }
}

export async function initRealtimeSync(callbacks: RealtimeCallbacks): Promise<() => void> {
    const userId = await getCurrentUserId();
    if (!userId) {
        console.warn('[Realtime] No user logged in, skipping sync');
        return () => { };
    }

    const deviceId = getDeviceId();

    const channel = supabase
        .channel(`meds_sync_${deviceId}`)
        // Subscribe to medications table
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'medications',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const newData = payload.new as any;
            const currentDeviceId = getDeviceId();

            // Check if this is our own update
            if (newData.device_id === currentDeviceId) {
                console.log('[Realtime] Ignoring own medication update');
                return;
            }

            if (!isApplyingRemote && callbacks.onMedicationChange) {
                console.log('[Realtime] Received medication change from another device');
                callbacks.onMedicationChange();
            }
        })
        // Subscribe to medication_logs table
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'medication_logs',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const currentDeviceId = getDeviceId();
            const newData = payload.new as any;

            if (newData?.source_device === currentDeviceId) {
                console.log('[Realtime] Ignoring own log update');
                return;
            }

            if (!isApplyingRemote && callbacks.onLogChange) {
                console.log('[Realtime] Received log change from another device');
                callbacks.onLogChange();
            }
        })
        // Subscribe to user_settings table
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${userId}`
        }, () => {
            if (!isApplyingRemote && callbacks.onSettingsChange) {
                console.log('[Realtime] Received settings change');
                callbacks.onSettingsChange();
            }
        })
        .subscribe();

    console.log('[Realtime] Subscribed to changes');

    return () => {
        supabase.removeChannel(channel);
        console.log('[Realtime] Unsubscribed from changes');
    };
}
