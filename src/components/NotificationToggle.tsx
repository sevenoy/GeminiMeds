import React from 'react';
import { Bell, BellOff } from 'lucide-react';

interface NotificationToggleProps {
    enabled: boolean;
    onToggle: () => void;
}

export const NotificationToggle: React.FC<NotificationToggleProps> = ({ enabled, onToggle }) => {
    return (
        <button
            onClick={onToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
        >
            {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            <span className="text-sm font-medium">
                {enabled ? '提醒已开启' : '提醒已关闭'}
            </span>
        </button>
    );
};
