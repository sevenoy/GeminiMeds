import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';

interface SyncStatusIndicatorProps {
    status: 'synced' | 'syncing' | 'error' | 'offline';
    lastSyncTime?: Date;
    errorMessage?: string;
    onRetry?: () => void;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
    status,
    lastSyncTime,
    errorMessage,
    onRetry
}) => {
    const getStatusIcon = () => {
        switch (status) {
            case 'synced':
                return <Cloud className="w-4 h-4 text-green-500" />;
            case 'syncing':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'offline':
                return <CloudOff className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'synced':
                return lastSyncTime
                    ? `已同步 ${formatRelativeTime(lastSyncTime)}`
                    : '已同步';
            case 'syncing':
                return '同步中...';
            case 'error':
                return errorMessage || '同步失败';
            case 'offline':
                return '离线模式';
        }
    };

    const formatRelativeTime = (date: Date) => {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (seconds < 60) return '刚刚';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
        return `${Math.floor(seconds / 86400)}天前`;
    };

    return (
        <div className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className={`
        ${status === 'synced' ? 'text-green-600' : ''}
        ${status === 'syncing' ? 'text-blue-600' : ''}
        ${status === 'error' ? 'text-red-600' : ''}
        ${status === 'offline' ? 'text-gray-500' : ''}
      `}>
                {getStatusText()}
            </span>
            {status === 'error' && onRetry && (
                <button
                    onClick={onRetry}
                    className="ml-2 text-xs text-blue-500 hover:underline"
                >
                    重试
                </button>
            )}
        </div>
    );
};
