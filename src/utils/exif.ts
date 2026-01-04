import { ExifResult, TimeSource } from '../types';

// @ts-ignore - exif-js doesn't have proper types
import EXIF from 'exif-js';

export async function extractExifTime(imageData: string): Promise<ExifResult> {
    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            EXIF.getData(img, function (this: any) {
                const dateTime = EXIF.getTag(this, 'DateTime') ||
                    EXIF.getTag(this, 'DateTimeOriginal') ||
                    EXIF.getTag(this, 'DateTimeDigitized');

                if (dateTime) {
                    // EXIF DateTime format: "YYYY:MM:DD HH:mm:ss"
                    const parts = dateTime.split(' ');
                    if (parts.length === 2) {
                        const datePart = parts[0].replace(/:/g, '-');
                        const timePart = parts[1];
                        const isoString = `${datePart}T${timePart}`;
                        const date = new Date(isoString);

                        if (!isNaN(date.getTime())) {
                            resolve({
                                takenAt: date,
                                source: 'exif'
                            });
                            return;
                        }
                    }
                }

                // Fallback to system time
                resolve({
                    takenAt: new Date(),
                    source: 'system'
                });
            });
        };

        img.onerror = () => {
            // Fallback to system time on error
            resolve({
                takenAt: new Date(),
                source: 'system'
            });
        };

        img.src = imageData;
    });
}

export function calculateLogStatus(
    scheduledTime: string,
    actualTime: Date
): 'ontime' | 'late' | 'manual' | 'suspect' {
    const now = new Date();
    const [hours, minutes] = scheduledTime.split(':').map(Number);

    const scheduled = new Date(now);
    scheduled.setHours(hours, minutes, 0, 0);

    const diffMinutes = (actualTime.getTime() - scheduled.getTime()) / (1000 * 60);

    // Within ±30 minutes is on time
    if (Math.abs(diffMinutes) <= 30) {
        return 'ontime';
    }

    // More than 30 minutes late
    if (diffMinutes > 30) {
        return 'late';
    }

    // Taken before scheduled time (suspect)
    return 'suspect';
}

export function formatTime(date: Date): string {
    return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}
