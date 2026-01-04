import React from 'react';
import { Home, Calendar, Settings } from 'lucide-react';

interface BottomNavProps {
    currentPage: 'home' | 'history' | 'settings';
    onNavigate: (page: 'home' | 'history' | 'settings') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate }) => {
    const navItems = [
        { id: 'home' as const, icon: Home, label: '首页' },
        { id: 'history' as const, icon: Calendar, label: '记录' },
        { id: 'settings' as const, icon: Settings, label: '设置' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-around">
                    {navItems.map(item => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`flex flex-col items-center py-3 px-6 transition-colors ${isActive ? 'text-black' : 'text-gray-400'
                                    }`}
                            >
                                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5]' : ''}`} />
                                <span className={`text-xs ${isActive ? 'font-semibold' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};
