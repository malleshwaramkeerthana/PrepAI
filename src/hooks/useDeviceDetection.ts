import { useRef, useState, useCallback, useEffect } from 'react';

// Objects that indicate potential cheating
const SUSPICIOUS_OBJECTS = [
  'cell phone',
  'mobile phone',
  'book',
  'laptop',
  'remote',
  'tablet',
  'computer',
];

export interface DetectedDevice {
  class: string;
  score: number;
  timestamp: number;
}

export const useDeviceDetection = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([]);
  const [deviceWarningCount, setDeviceWarningCount] = useState(0);
  const [showDeviceWarning, setShowDeviceWarning] = useState(false);
  const [currentDeviceWarning, setCurrentDeviceWarning] = useState<string | null>(null);
  
  const detectorRef = useRef<any>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastWarningTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load the object detection model dynamically using HuggingFace Transformers
  const loadModel = useCallback(async () => {
    try {
      console.log('Loading object detection model...');
      
      // Dynamic import to avoid bundling issues
      const { pipeline, env } = await import('@huggingface/transformers');
      
      // Configure for browser use
      env.allowLocalModels = false;
      
      // Use a lightweight object detection model
      const detector = await pipeline(
        'object-detection',
        'Xenova/detr-resnet-50',
        { device: 'webgpu' }
      );
      
      detectorRef.current = detector;
      
      // Create canvas for capturing frames
      canvasRef.current = document.createElement('canvas');
      
      setIsModelLoaded(true);
      console.log('Object detection model loaded successfully');
    } catch (error) {
      console.error('Failed to load object detection model:', error);
      // Still set as loaded to not block the interview
      setIsModelLoaded(true);
    }
  }, []);

  // Capture frame from video and detect objects
  const detectObjects = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }
    
    if (videoRef.current.readyState !== 4) {
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get image data as base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Run object detection
      const predictions = await detectorRef.current(imageData, {
        threshold: 0.5,
      });
      
      // Filter for suspicious objects
      const suspiciousItems = predictions.filter(
        (pred: any) => {
          const label = pred.label?.toLowerCase() || '';
          return SUSPICIOUS_OBJECTS.some(obj => label.includes(obj)) && pred.score > 0.5;
        }
      );

      if (suspiciousItems.length > 0) {
        const now = Date.now();
        // Only warn once every 5 seconds to avoid spam
        if (now - lastWarningTimeRef.current > 5000) {
          const deviceNames = [...new Set(suspiciousItems.map((item: any) => item.label))];
          
          setDetectedDevices(prev => [
            ...prev,
            ...deviceNames.map(name => ({
              class: name as string,
              score: suspiciousItems.find((i: any) => i.label === name)?.score || 0,
              timestamp: now,
            }))
          ]);
          
          setDeviceWarningCount(prev => prev + 1);
          setCurrentDeviceWarning(deviceNames.join(', '));
          setShowDeviceWarning(true);
          lastWarningTimeRef.current = now;
        }
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  }, [videoRef]);

  // Start continuous detection
  const startDetection = useCallback(() => {
    if (!isModelLoaded || isDetecting || !detectorRef.current) return;
    
    setIsDetecting(true);
    // Run detection every 3 seconds (heavier model needs more time)
    detectionIntervalRef.current = setInterval(detectObjects, 3000);
    console.log('Device detection started');
  }, [isModelLoaded, isDetecting, detectObjects]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    setIsDetecting(false);
    console.log('Device detection stopped');
  }, []);

  // Dismiss warning
  const dismissWarning = useCallback(() => {
    setShowDeviceWarning(false);
    setCurrentDeviceWarning(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  return {
    isModelLoaded,
    isDetecting,
    detectedDevices,
    deviceWarningCount,
    showDeviceWarning,
    currentDeviceWarning,
    loadModel,
    startDetection,
    stopDetection,
    dismissWarning,
  };
};
