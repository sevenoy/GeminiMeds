import { useState, useEffect } from 'react';
import { User, Mail, LogOut, Download, Upload, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cloudSaveV2, cloudLoadV2, applySnapshot } from '../services/sync';
import { db } from '../db/localDB';
import { NotificationToggle } from './NotificationToggle';
import { requestNotificationPermission } from '../services/notification';

interface SettingsPageProps {
    onLogout: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout }) => {
    const [userEmail, setUserEmail] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [notificationEnabled, setNotificationEnabled] = useState(false);

    useEffect(() => {
        loadUserInfo();
        checkNotificationPermission();
    }, []);

    const checkNotificationPermission = () => {
        if ('Notification' in window) {
            setNotificationEnabled(Notification.permission === 'granted');
        }
    };

    const handleToggleNotification = async () => {
        if (notificationEnabled) {
            // 无法撤销权限，只能提示用户在浏览器设置中关闭
            alert('请在浏览器设置中关闭通知权限');
        } else {
            const granted = await requestNotificationPermission();
            setNotificationEnabled(granted);
            if (!granted) {
                alert('通知权限被拒绝，请在浏览器设置中允许通知');
            }
        }
    };

    const loadUserInfo = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserEmail(user.email || '游客');
            setDisplayName(user.user_metadata?.display_name || '');
        } else {
            setUserEmail('游客模式');
        }
    };

    const handleSaveProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.auth.updateUser({
                data: { display_name: displayName }
            });
        }
        setIsEditing(false);
    };

    const handleCloudSave = async () => {
        setIsSyncing(true);
        try {
            const result = await cloudSaveV2();
            if (result.success) {
                alert('✅ 数据已保存到云端');
            } else {
                alert('❌ 保存失败: ' + result.message);
            }
        } catch (error: any) {
            alert('❌ 保存失败: ' + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleCloudLoad = async () => {
        if (!confirm('⚠️ 这将覆盖本地数据，确定要从云端恢复吗？')) {
            return;
        }

        setIsSyncing(true);
        try {
            const snapshot = await cloudLoadV2();
            if (snapshot) {
                await applySnapshot(snapshot);
                alert('✅ 数据已从云端恢复');
                window.location.reload();
            } else {
                alert('❌ 未找到云端数据');
            }
        } catch (error: any) {
            alert('❌ 恢复失败: ' + error.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClearData = async () => {
        if (!confirm('⚠️ 确定要清空所有本地数据吗？此操作不可恢复！')) {
            return;
        }

        if (!confirm('⚠️⚠️ 再次确认：这将删除所有药品和服药记录！')) {
            return;
        }

        await db.medications.clear();
        await db.medicationLogs.clear();
        alert('✅ 本地数据已清空');
        window.location.reload();
    };

    const getStorageInfo = async () => {
        const medCount = await db.medications.count();
        const logCount = await db.medicationLogs.count();
        return { medCount, logCount };
    };

    const [storageInfo, setStorageInfo] = useState({ medCount: 0, logCount: 0 });

    useEffect(() => {
        getStorageInfo().then(setStorageInfo);
    }, []);

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <h1 className="text-4xl font-black italic tracking-tight">设置</h1>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* User Profile */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <User className="w-6 h-6" />
                        个人信息
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                邮箱
                            </label>
                            <div className="flex items-center gap-2 text-gray-600">
                                <Mail className="w-5 h-5" />
                                {userEmail}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                显示名称
                            </label>
                            {isEditing ? (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                                        placeholder="输入您的名称"
                                    />
                                    <button
                                        onClick={handleSaveProfile}
                                        className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                                    >
                                        保存
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        取消
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600">{displayName || '未设置'}</span>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-sm text-blue-500 hover:underline"
                                    >
                                        编辑
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Data Management */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">数据管理</h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <div>
                                <p className="font-medium">本地数据</p>
                                <p className="text-sm text-gray-600">
                                    {storageInfo.medCount} 个药品，{storageInfo.logCount} 条记录
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleCloudSave}
                            disabled={isSyncing}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            <Upload className="w-5 h-5" />
                            {isSyncing ? '保存中...' : '保存到云端'}
                        </button>

                        <button
                            onClick={handleCloudLoad}
                            disabled={isSyncing}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                            <Download className="w-5 h-5" />
                            {isSyncing ? '恢复中...' : '从云端恢复'}
                        </button>

                        <button
                            onClick={handleClearData}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                            清空本地数据
                        </button>
                    </div>
                </div>

                {/* App Info */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">关于</h2>
                    <div className="space-y-2 text-sm text-gray-600">
                        <p><strong>应用名称：</strong>药盒助手</p>
                        <p><strong>版本：</strong>1.0.0</p>
                        <p><strong>描述：</strong>智能服药追踪应用</p>
                        <p className="pt-4 text-xs text-gray-400">
                            © 2026 药盒助手. 基于技术白皮书构建。
                        </p>
                    </div>
                </div>

                {/* Notification Settings */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">通知设置</h2>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">服药提醒</p>
                                <p className="text-sm text-gray-600">
                                    在服药时间前 5 分钟提醒您
                                </p>
                            </div>
                            <NotificationToggle
                                enabled={notificationEnabled}
                                onToggle={handleToggleNotification}
                            />
                        </div>

                        {notificationEnabled && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm text-green-700">
                                    ✅ 通知已启用。我们会在您的服药时间前 5 分钟提醒您。
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    退出登录
                </button>
            </div>
        </div>
    );
};
