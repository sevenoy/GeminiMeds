import { Medication } from '../types';

// 检查是否需要提醒
export function shouldNotify(medication: Medication): boolean {
    const now = new Date();
    const [hours, minutes] = medication.scheduled_time.split(':').map(Number);

    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    const diff = scheduledTime.getTime() - now.getTime();

    // 提前 5 分钟提醒
    return diff > 0 && diff <= 5 * 60 * 1000;
}

// 请求通知权限
export async function requestNotificationPermission(): Promise<boolean> {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

// 发送通知
export function sendNotification(medication: Medication): void {
    if (Notification.permission !== 'granted') {
        return;
    }

    const notification = new Notification('服药提醒', {
        body: `该服用 ${medication.name} 了（${medication.dosage}）`,
        icon: '/meds/icon-192.png',
        badge: '/meds/icon-192.png',
        tag: medication.id,
        requireInteraction: true
    });

    // 点击通知时聚焦到应用
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

// 检查所有药品并发送提醒
export function checkAndNotifyMedications(medications: Medication[]): void {
    medications.forEach(medication => {
        if (shouldNotify(medication)) {
            sendNotification(medication);
        }
    });
}

// 设置定时检查（每分钟检查一次）
export function startNotificationService(
    getMedications: () => Promise<Medication[]>
): () => void {
    const intervalId = setInterval(async () => {
        const medications = await getMedications();
        checkAndNotifyMedications(medications);
    }, 60000); // 每分钟检查一次

    return () => clearInterval(intervalId);
}
