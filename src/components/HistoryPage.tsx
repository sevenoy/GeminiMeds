import { useState, useEffect } from 'react';
import { Calendar, Clock, Image as ImageIcon, Search } from 'lucide-react';
import { Medication, MedicationLog } from '../types';
import { getMedications, getMedicationLogs } from '../db/localDB';
import { formatTime } from '../utils/exif';

export const HistoryPage: React.FC = () => {
    const [medications, setMedications] = useState<Medication[]>([]);
    const [logs, setLogs] = useState<MedicationLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<MedicationLog[]>([]);
    const [selectedMed, setSelectedMed] = useState<string>('all');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        filterLogs();
    }, [logs, selectedMed, searchTerm]);

    const loadData = async () => {
        const meds = await getMedications();
        const allLogs = await getMedicationLogs();
        setMedications(meds);
        setLogs(allLogs.sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()));
    };

    const filterLogs = () => {
        let filtered = logs;

        if (selectedMed !== 'all') {
            filtered = filtered.filter(log => log.medication_id === selectedMed);
        }

        if (searchTerm) {
            filtered = filtered.filter(log => {
                const med = medications.find(m => m.id === log.medication_id);
                return med?.name.toLowerCase().includes(searchTerm.toLowerCase());
            });
        }

        setFilteredLogs(filtered);
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'ontime': return '准时';
            case 'late': return '延迟';
            case 'manual': return '手动';
            case 'suspect': return '可疑';
            default: return status;
        }
    };

    const getTimeSourceText = (source: string) => {
        switch (source) {
            case 'exif': return 'EXIF';
            case 'system': return '系统';
            case 'manual': return '手动';
            default: return source;
        }
    };

    const groupLogsByDate = () => {
        const groups: { [key: string]: MedicationLog[] } = {};

        filteredLogs.forEach(log => {
            const date = new Date(log.taken_at).toLocaleDateString('zh-CN');
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(log);
        });

        return groups;
    };

    const logGroups = groupLogsByDate();

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <h1 className="text-4xl font-black italic tracking-tight mb-4">服药记录</h1>

                    {/* Search and Filter */}
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索药品..."
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
                            />
                        </div>
                        <select
                            value={selectedMed}
                            onChange={(e) => setSelectedMed(e.target.value)}
                            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none bg-white"
                        >
                            <option value="all">全部药品</option>
                            {medications.map(med => (
                                <option key={med.id} value={med.id}>{med.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-xl shadow">
                        <p className="text-gray-600 text-sm mb-1">总记录数</p>
                        <p className="text-3xl font-bold">{filteredLogs.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow">
                        <p className="text-gray-600 text-sm mb-1">准时率</p>
                        <p className="text-3xl font-bold text-green-500">
                            {filteredLogs.length > 0
                                ? Math.round((filteredLogs.filter(l => l.status === 'ontime').length / filteredLogs.length) * 100)
                                : 0}%
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow">
                        <p className="text-gray-600 text-sm mb-1">本周记录</p>
                        <p className="text-3xl font-bold text-blue-500">
                            {filteredLogs.filter(log => {
                                const weekAgo = new Date();
                                weekAgo.setDate(weekAgo.getDate() - 7);
                                return new Date(log.taken_at) >= weekAgo;
                            }).length}
                        </p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="space-y-6">
                    {Object.keys(logGroups).length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg">暂无服药记录</p>
                        </div>
                    ) : (
                        Object.entries(logGroups).map(([date, dateLogs]) => (
                            <div key={date}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-2 h-2 rounded-full bg-black"></div>
                                    <h3 className="text-lg font-bold text-gray-900">{date}</h3>
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                </div>

                                <div className="space-y-3">
                                    {dateLogs.map(log => {
                                        const med = medications.find(m => m.id === log.medication_id);
                                        if (!med) return null;

                                        return (
                                            <div key={log.id} className="bg-white p-4 rounded-xl shadow hover:shadow-lg transition-shadow">
                                                <div className="flex gap-4">
                                                    {/* Photo */}
                                                    {log.image_path && (
                                                        <div
                                                            onClick={() => setSelectedImage(log.image_path!)}
                                                            className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                        >
                                                            <img
                                                                src={log.image_path}
                                                                alt="Medication"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Info */}
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                                <h4 className="text-lg font-bold">{med.name}</h4>
                                                                <p className="text-sm text-gray-600">{med.dosage}</p>
                                                            </div>
                                                            <div className={`px-3 py-1 rounded-full text-xs font-semibold status-${log.status}`}>
                                                                {getStatusText(log.status)}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="w-4 h-4" />
                                                                {formatTime(new Date(log.taken_at))}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <ImageIcon className="w-4 h-4" />
                                                                时间来源: {getTimeSourceText(log.time_source)}
                                                            </span>
                                                            {log.image_hash && (
                                                                <span className="text-xs text-gray-400">
                                                                    哈希: {log.image_hash.substring(0, 8)}...
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Image Viewer Modal */}
            {selectedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedImage(null)}
                >
                    <img
                        src={selectedImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain"
                    />
                </div>
            )}
        </div>
    );
};
