import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fjuzwjjziqdwosgexdlk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdXp3amp6aXFkd29zZ2V4ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0Mzg4MjIsImV4cCI6MjA4MzAxNDgyMn0.Lx6aCL_Z_vdujtXTJa1n-5f_wp2v_LPzfcKFsB8hvOE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// Helper to get current user ID
export async function getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
}

// Helper to check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
    const userId = await getCurrentUserId();
    return userId !== null;
}
