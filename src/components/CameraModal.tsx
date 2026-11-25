import { useEffect, useRef, useState } from 'react';
import { Camera, Check, QrCode, RotateCw, RefreshCw, X, Upload } from 'lucide-react';
import { applyDocumentScanFilter } from '../utils/pdfUtils';
import type { XeroxCenter } from '../types/print';

interface CameraModalProps {
  mode: 'photo' | 'qr';
  centers?: XeroxCenter[];
  onClose: () => void;
  onCapturePhoto?: (dataUrl: string, filter: 'original' | 'bw-scan' | 'high-contrast') => void;
  onDetectedCenterCode?: (code: string) => void;
}

export function CameraModal({
  mode,
  centers = [],
  onClose,
  onCapturePhoto,
  onDetectedCenterCode,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Photo capture state
  const [rawCaptureUrl, setRawCaptureUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [scanFilter, setScanFilter] = useState<'original' | 'bw-scan' | 'high-contrast'>('bw-scan');
  const [rotation, setRotation] = useState(0);
  const [processing, setProcessing] = useState(false);

  // QR manual fallback state
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let active = true;
    let scanTimer: number | null = null;

    async function startCamera() {
      setCameraError(null);
      setCameraReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Live camera access is unavailable in this browser context. You can capture or upload an image file below.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }

        // If QR mode and BarcodeDetector is supported, poll frames
        if (mode === 'qr' && 'BarcodeDetector' in window) {
          const DetectorClass = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
          const detector = new DetectorClass({ formats: ['qr_code'] });

          scanTimer = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const results = await detector.detect(videoRef.current);
              if (results.length > 0) {
                const raw = results[0].rawValue.trim();
                const match = raw.match(/center=([A-Za-z0-9-]+)/i) || raw.match(/\b(XRX-\d{3,5})\b/i);
                const code = match ? match[1].toUpperCase() : raw.toUpperCase();
                if (code && onDetectedCenterCode) {
                  onDetectedCenterCode(code);
                  onClose();
                }
              }
            } catch {
              // Continue scanning silently
            }
          }, 450);
        }
      } catch {
        if (active) {
          setCameraError(
            mode === 'photo'
              ? 'Camera permission was not granted or no camera was detected. Use "Choose Image" below to take or select a photo.'
              : 'Camera unavailable on this device. Enter a Center Code ID or select a center standee below.'
          );
        }
      }
    }

    if (!rawCaptureUrl) {
      startCamera();
    }

    return () => {
      active = false;
      if (scanTimer) window.clearInterval(scanTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, mode, rawCaptureUrl, onClose, onDetectedCenterCode]);

  useEffect(() => {
    if (!rawCaptureUrl) return;
    let active = true;
    setProcessing(true);
    applyDocumentScanFilter(rawCaptureUrl, scanFilter, rotation).then((result) => {
      if (active) {
        setProcessedUrl(result);
        setProcessing(false);
      }
    });
    return () => {
      active = false;
    };
  }, [rawCaptureUrl, scanFilter, rotation]);

  function handleSnapFrame() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setRawCaptureUrl(dataUrl);
    setRotation(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawCaptureUrl(String(reader.result));
      setRotation(0);
    };
    reader.readAsDataURL(file);
  }

  function handleConfirmPhoto() {
    if (processedUrl && onCapturePhoto) {
      onCapturePhoto(processedUrl, scanFilter);
      onClose();
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim() || !onDetectedCenterCode) return;
    onDetectedCenterCode(manualCode.trim().toUpperCase());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'photo' ? 'Capture Document Photo' : 'Scan Xerox Center QR Code'}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            {mode === 'photo' ? (
              <Camera className="w-5 h-5 text-blue-600" />
            ) : (
              <QrCode className="w-5 h-5 text-blue-600" />
            )}
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === 'photo' ? 'Capture Document Photo' : 'Scan Center QR Code'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {mode === 'photo' && rawCaptureUrl ? (
            <>
              <div className="relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[420px]">
                {processedUrl && (
                  <img
                    src={processedUrl}
                    alt="Captured document preview"
                    className="max-h-[400px] w-auto object-contain"
                  />
                )}
                {processing && (
                  <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center text-white text-sm font-medium">
                    Enhancing scan...
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'original', label: 'Original Color' },
                      { id: 'bw-scan', label: 'Crisp B&W Scan' },
                      { id: 'high-contrast', label: 'High Contrast' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScanFilter(item.id)}
                      className={`px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                        scanFilter === item.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCw className="w-4 h-4" />
                    Rotate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRawCaptureUrl(null);
                      setProcessedUrl(null);
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                  >
                    Retake
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  disabled={!processedUrl || processing}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-2 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  Add Page to Print Batch
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                {!cameraError ? (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {cameraReady && (
                      <div className="pointer-events-none absolute inset-6 border-2 border-white/50 rounded-lg">
                        <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-md" />
                        <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-md" />
                        <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-md" />
                        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-md" />
                      </div>
                    )}
                    {!cameraReady && (
                      <p className="absolute text-sm text-slate-300">Starting camera...</p>
                    )}
                  </>
                ) : (
                  <div className="p-6 text-center max-w-md space-y-3">
                    <p className="text-sm text-slate-200 leading-relaxed">{cameraError}</p>
                    {mode === 'photo' && (
                      <>
                        <input
                          ref={fileFallbackRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileInput}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileFallbackRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          <Upload className="w-4 h-4" />
                          Choose Image / Native Camera
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {mode === 'photo' && !cameraError && (
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Switch Camera
                  </button>
                  <button
                    type="button"
                    onClick={handleSnapFrame}
                    disabled={!cameraReady}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-2 whitespace-nowrap"
                  >
                    <Camera className="w-4 h-4" />
                    Take Photo
                  </button>
                </div>
              )}

              {mode === 'qr' && (
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="Or enter Center Code ID (e.g. XRX-104)"
                      className="flex-1 px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
                    >
                      Connect Center
                    </button>
                  </form>

                  {centers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">
                        Quick-connect nearby standee QR codes
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {centers.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              if (onDetectedCenterCode) onDetectedCenterCode(c.code);
                              onClose();
                            }}
                            className="text-left p-3 rounded-lg border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 transition-colors"
                          >
                            <div className="font-mono text-xs font-semibold text-blue-600">{c.code}</div>
                            <div className="text-xs font-medium text-slate-900 truncate mt-0.5">{c.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
