import { useState, useEffect } from 'react';
import { Plus, Camera, Clock, Calendar } from 'lucide-react';
import { CameraModal } from './components/CameraModal';
import { LoginPage } from './components/LoginPage';
import { SyncStatusIndicator } from './components/SyncStatusIndicator';
import { BottomNav } from './components/BottomNav';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';
import { Medication, MedicationLog, AccentColor } from './types';
import { getMedications, upsertMedication, deleteMedication, getMedicationLogs, addMedicationLog } from './db/localDB';
import { supabase, getCurrentUserId } from './lib/supabase';
import { initRealtimeSync } from './services/realtime';
import { pushLocalChanges, pullRemoteChanges } from './services/sync';
import { generateUUID, getDeviceId } from './utils';
import { formatTime, formatDate } from './utils/exif';
import { startNotificationService, requestNotificationPermission } from './services/notification';

type PageType = 'home' | 'history' | 'settings';

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [currentPage, setCurrentPage] = useState<PageType>('home');
    const [medications, setMedications] = useState<Medication[]>([]);
    const [logs, setLogs] = useState<MedicationLog[]>([]);
    const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [showAddMed, setShowAddMed] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
    const [lastSyncTime, setLastSyncTime] = useState<Date>();
    const [isLoading, setIsLoading] = useState(true);

    // New medication form state
    const [newMedName, setNewMedName] = useState('');
    const [newMedDosage, setNewMedDosage] = useState('');
    const [newMedTime, setNewMedTime] = useState('09:00');
    const [newMedAccent, setNewMedAccent] = useState<AccentColor>('lime');

    const accentColors: AccentColor[] = ['lime', 'berry', 'mint', 'sky', 'sunset'];

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        if (isAuthenticated !== null) {
            loadData();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            const cleanup = initRealtimeSync({
                onMedicationChange: () => {
                    console.log('Medication changed, reloading...');
                    loadMedications();
                },
                onLogChange: () => {
                    console.log('Log changed, reloading...');
                    loadLogs();
                }
            });

            return () => {
                cleanup.then(fn => fn());
            };
        }
    }, [isAuthenticated]);

    // 启动通知服务
    useEffect(() => {
        if (isAuthenticated !== null) {
            // 请求通知权限
            requestNotificationPermission();

            // 启动定时检查
            const cleanup = startNotificationService(getMedications);

            return cleanup;
        }
    }, [isAuthenticated]);

    const checkAuth = async () => {
        // 检查是否是游客模式
        const isGuest = localStorage.getItem('guestMode') === 'true';
        if (isGuest) {
            setIsAuthenticated(true);
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        setIsAuthenticated(!!session);
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load from local DB first
            await loadMedications();
            await loadLogs();

            // If authenticated, sync with cloud
            if (isAuthenticated) {
                await syncWithCloud();
            }
        } finally {
            setIsLoading(false);
        }
    };

    const loadMedications = async () => {
        const meds = await getMedications();
        setMedications(meds.sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
    };

    const loadLogs = async () => {
        const allLogs = await getMedicationLogs();
        setLogs(allLogs.sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()));
    };

    const syncWithCloud = async () => {
        setSyncStatus('syncing');
        try {
            await pullRemoteChanges();
            await pushLocalChanges();
            setSyncStatus('synced');
            setLastSyncTime(new Date());
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('error');
        }
    };

    const handleAddMedication = async () => {
        if (!newMedName || !newMedDosage) return;

        const userId = await getCurrentUserId();
        const newMed: Medication = {
            id: generateUUID(),
            user_id: userId || undefined,
            device_id: getDeviceId(),
            name: newMedName,
            dosage: newMedDosage,
            scheduled_time: newMedTime,
            accent: newMedAccent,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        await upsertMedication(newMed);

        // Sync to cloud if authenticated
        if (isAuthenticated) {
            await supabase.from('medications').upsert({
                ...newMed,
                user_id: userId
            });
        }

        await loadMedications();
        setShowAddMed(false);
        setNewMedName('');
        setNewMedDosage('');
        setNewMedTime('09:00');
        setNewMedAccent('lime');
    };

    const handleDeleteMedication = async (id: string) => {
        if (!confirm('确定要删除这个药品吗？')) return;

        await deleteMedication(id);

        if (isAuthenticated) {
            await supabase.from('medications').delete().eq('id', id);
        }

        await loadMedications();
    };

    const handleCapture = async (log: MedicationLog) => {
        const userId = await getCurrentUserId();
        const logWithUser = {
            ...log,
            user_id: userId || undefined,
            source_device: getDeviceId()
        };

        await addMedicationLog(logWithUser);

        if (isAuthenticated) {
            await supabase.from('medication_logs').insert(logWithUser);
        }

        await loadLogs();
        setShowCamera(false);
        setSelectedMed(null);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('guestMode');
        setIsAuthenticated(false);
        setMedications([]);
        setLogs([]);
        setCurrentPage('home');
    };

    const getTodayProgress = () => {
        const today = new Date().toDateString();
        const todayLogs = logs.filter(log => new Date(log.taken_at).toDateString() === today);
        const todayMeds = medications.length;
        return todayMeds > 0 ? Math.round((todayLogs.length / todayMeds) * 100) : 0;
    };

    if (isAuthenticated === null || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-sky border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">加载中...</p>
                </div>
            </div>
        );
    }

    // 如果未认证且不是游客模式，显示登录页面
    if (isAuthenticated === false) {
        return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    const progress = getTodayProgress();

    // Render different pages based on currentPage
    const renderPage = () => {
        switch (currentPage) {
            case 'history':
                return <HistoryPage />;
            case 'settings':
                return <SettingsPage onLogout={handleLogout} />;
            case 'home':
            default:
                return renderHomePage();
        }
    };

    const renderHomePage = () => (
        <>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div>
                        <h1 className="text-2xl font-black italic tracking-tight">药盒助手</h1>
                        <SyncStatusIndicator
                            status={syncStatus}
                            lastSyncTime={lastSyncTime}
                            onRetry={syncWithCloud}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8 pb-24">
                {/* Hero Section */}
                <div className="mb-12">
                    <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase leading-none text-black mb-4">
                        TODAY
                    </h2>

                    {/* Progress Ring */}
                    <div className="flex items-center gap-8">
                        <div className="relative w-32 h-32">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="50%"
                                    cy="50%"
                                    r="45%"
                                    className="stroke-gray-200 fill-none"
                                    strokeWidth="8"
                                />
                                <circle
                                    cx="50%"
                                    cy="50%"
                                    r="45%"
                                    className="stroke-green-500 fill-none transition-all duration-500"
                                    strokeWidth="8"
                                    strokeDasharray={`${2 * Math.PI * 45}`}
                                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-3xl font-bold">{progress}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{logs.filter(l => new Date(l.taken_at).toDateString() === new Date().toDateString()).length} / {medications.length}</p>
                            <p className="text-gray-600">今日已服用</p>
                        </div>
                    </div>
                </div>

                {/* Medications Grid */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-3xl font-bold">我的药品</h3>
                        <button
                            onClick={() => setShowAddMed(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            添加药品
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {medications.map(med => {
                            const todayLog = logs.find(
                                log => log.medication_id === med.id &&
                                    new Date(log.taken_at).toDateString() === new Date().toDateString()
                            );

                            return (
                                <div
                                    key={med.id}
                                    className={`p-6 rounded-2xl shadow-lg border-2 transition-all hover:shadow-xl ${todayLog ? 'bg-white border-green-500' : 'bg-white border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h4 className="text-xl font-bold mb-1">{med.name}</h4>
                                            <p className="text-gray-600">{med.dosage}</p>
                                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                                                <Clock className="w-4 h-4" />
                                                {med.scheduled_time}
                                            </div>
                                        </div>
                                        <div className={`w-12 h-12 rounded-full accent-${med.accent || 'lime'} flex items-center justify-center`}>
                                            {todayLog ? '✓' : ''}
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedMed(med);
                                                setShowCamera(true);
                                            }}
                                            disabled={!!todayLog}
                                            className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${todayLog
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-black text-white hover:bg-gray-800'
                                                }`}
                                        >
                                            <Camera className="w-5 h-5" />
                                            {todayLog ? '已服用' : '拍照记录'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMedication(med.id)}
                                            className="px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {medications.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <p className="text-lg mb-2">还没有添加药品</p>
                            <p className="text-sm">点击"添加药品"开始使用</p>
                        </div>
                    )}
                </div>

                {/* Recent Logs Timeline */}
                {logs.length > 0 && (
                    <div>
                        <h3 className="text-3xl font-bold mb-6">最近记录</h3>
                        <div className="space-y-4">
                            {logs.slice(0, 10).map(log => {
                                const med = medications.find(m => m.id === log.medication_id);
                                if (!med) return null;

                                return (
                                    <div key={log.id} className="bg-white p-4 rounded-xl shadow flex items-center gap-4">
                                        {log.image_path && (
                                            <img
                                                src={log.image_path}
                                                alt="Medication"
                                                className="w-20 h-20 rounded-lg object-cover"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <h4 className="font-bold">{med.name}</h4>
                                            <p className="text-sm text-gray-600">{med.dosage}</p>
                                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-4 h-4" />
                                                    {formatDate(new Date(log.taken_at))}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {formatTime(new Date(log.taken_at))}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-semibold status-${log.status}`}>
                                            {log.status === 'ontime' ? '准时' : log.status === 'late' ? '延迟' : '手动'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Render current page */}
            {renderPage()}

            {/* Bottom Navigation */}
            <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />

            {/* Add Medication Modal */}
            {showAddMed && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full">
                        <h3 className="text-2xl font-bold mb-6">添加新药品</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">药品名称</label>
                                <input
                                    type="text"
                                    value={newMedName}
                                    onChange={(e) => setNewMedName(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                    placeholder="例如：阿司匹林"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">剂量</label>
                                <input
                                    type="text"
                                    value={newMedDosage}
                                    onChange={(e) => setNewMedDosage(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                    placeholder="例如：1片"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">服药时间</label>
                                <input
                                    type="time"
                                    value={newMedTime}
                                    onChange={(e) => setNewMedTime(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">颜色标识</label>
                                <div className="flex gap-2">
                                    {accentColors.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewMedAccent(color)}
                                            className={`w-12 h-12 rounded-full accent-${color} ${newMedAccent === color ? 'ring-4 ring-black ring-offset-2' : ''
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddMed(false)}
                                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleAddMedication}
                                className="flex-1 px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                            >
                                添加
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Camera Modal */}
            {showCamera && selectedMed && (
                <CameraModal
                    medication={selectedMed}
                    onClose={() => {
                        setShowCamera(false);
                        setSelectedMed(null);
                    }}
                    onCapture={handleCapture}
                />
            )}
        </div>
    );
}

export default App;
