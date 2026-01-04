import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check } from 'lucide-react';
import { extractExifTime, calculateLogStatus } from '../utils/exif';
import { calculateImageHash, compressImage, generateUUID } from '../utils';
import { Medication, MedicationLog } from '../types';

interface CameraModalProps {
    medication: Medication;
    onClose: () => void;
    onCapture: (log: MedicationLog) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ medication, onClose, onCapture }) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (error) {
            console.error('Camera access error:', error);
            alert('无法访问摄像头，请检查权限设置');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (!context) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);

        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
    };

    const retake = () => {
        setCapturedImage(null);
        startCamera();
    };

    const confirmCapture = async () => {
        if (!capturedImage) return;

        setIsProcessing(true);

        try {
            // Compress image
            const compressed = await compressImage(capturedImage, 1200, 0.8);

            // Extract EXIF time
            const exifResult = await extractExifTime(compressed);
            const takenAt = exifResult.takenAt || new Date();

            // Calculate status
            const status = calculateLogStatus(medication.scheduled_time, takenAt);

            // Calculate hash
            const imageHash = calculateImageHash(compressed);

            // Create log
            const log: MedicationLog = {
                id: generateUUID(),
                medication_id: medication.id,
                taken_at: takenAt.toISOString(),
                uploaded_at: new Date().toISOString(),
                time_source: exifResult.source,
                status,
                image_path: compressed,
                image_hash: imageHash,
                sync_state: 'dirty'
            };

            onCapture(log);
            onClose();
        } catch (error) {
            console.error('Error processing image:', error);
            alert('处理照片时出错，请重试');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                    <div>
                        <h3 className="text-lg font-bold">{medication.name}</h3>
                        <p className="text-sm opacity-80">{medication.dosage}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Camera/Preview */}
            <div className="flex-1 relative flex items-center justify-center bg-black">
                {!capturedImage ? (
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-full object-contain"
                    />
                )}
                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-8">
                {!capturedImage ? (
                    <div className="flex justify-center">
                        <button
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 hover:bg-gray-100 transition-all animate-pulse-ring flex items-center justify-center"
                        >
                            <Camera className="w-8 h-8 text-gray-800" />
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={retake}
                            disabled={isProcessing}
                            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <button
                            onClick={confirmCapture}
                            disabled={isProcessing}
                            className="w-16 h-16 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors flex items-center justify-center disabled:opacity-50"
                        >
                            {isProcessing ? (
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Check className="w-8 h-8" />
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
