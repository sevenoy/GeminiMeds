// Core type definitions for the Medication Tracker app

export type TimeSource = 'exif' | 'system' | 'manual';
export type LogStatus = 'ontime' | 'late' | 'manual' | 'suspect';
export type SyncState = 'synced' | 'dirty' | 'pending';
export type AccentColor = 'lime' | 'berry' | 'mint' | 'sky' | 'sunset';

export interface Medication {
    id: string;
    user_id?: string;
    device_id?: string;
    name: string;
    dosage: string;
    scheduled_time: string; // HH:mm format
    created_at?: string;
    updated_at?: string;
    accent?: AccentColor;
}

export interface MedicationLog {
    id: string;
    user_id?: string;
    medication_id: string;
    taken_at: string; // ISO 8601
    uploaded_at: string; // ISO 8601
    time_source: TimeSource;
    status: LogStatus;
    image_path?: string;
    image_hash?: string;
    source_device?: string;
    sync_state?: SyncState;
    created_at?: string;
    updated_at?: string;
}

export interface ExifResult {
    takenAt: Date | null;
    source: TimeSource;
}

export interface UserSettings {
    user_id: string;
    settings: {
        theme?: 'light' | 'dark';
        notifications_enabled?: boolean;
        reminder_advance_minutes?: number;
        avatar_url?: string;
        display_name?: string;
    };
    created_at?: string;
    updated_at?: string;
}

export interface SnapshotPayload {
    medications: Medication[];
    medicationLogs: MedicationLog[];
    userSettings?: UserSettings;
    version: number;
    timestamp: string;
}

export interface AppSnapshot {
    id: string;
    owner_id: string;
    key: string;
    payload: SnapshotPayload;
    version: number;
    updated_at: string;
    updated_by?: string;
    updated_by_name?: string;
}

export interface ConflictInfo {
    local: MedicationLog;
    remote: MedicationLog;
    reason: string;
}

export interface RealtimeCallbacks {
    onMedicationChange?: () => void;
    onLogChange?: () => void;
    onSettingsChange?: () => void;
}

export interface SaveResult {
    success: boolean;
    message?: string;
    version?: number;
}
