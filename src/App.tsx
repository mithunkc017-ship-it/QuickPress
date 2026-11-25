import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FileText,
  Layers,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { CameraModal } from './components/CameraModal';
import { OrderReceiptView } from './components/OrderReceiptView';
import { PaymentModal } from './components/PaymentModal';
import { PrintPreviewSheet } from './components/PrintPreviewSheet';
import { QrCodeDisplay } from './components/QrCodeDisplay';
import { ShopCounterView } from './components/ShopCounterView';
import {
  calculateClientPricing,
  DEFAULT_PRINT_OPTIONS,
  formatCurrency,
  type PrintFileItem,
  type PrintOptions,
  type PrintOrder,
  type XeroxCenter,
} from './types/print';
import {
  detectDocumentPages,
  formatFileSize,
  readFileAsResizedImage,
} from './utils/pdfUtils';

type NavTab = 'print' | 'track' | 'qr' | 'counter';

const COUNTER_PHOTO_URL = '/src/assets/images/print_center_counter_1794918827300.jpg';
const SAMPLES_PHOTO_URL = '/src/assets/images/paper_finishing_samples_1794918827640.jpg';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('print');
  const [centers, setCenters] = useState<XeroxCenter[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [selectedCenterCode, setSelectedCenterCode] = useState<string>('XRX-104');
  const [centerCodeInput, setCenterCodeInput] = useState<string>('XRX-104');
  const [centerLookupError, setCenterLookupError] = useState<string | null>(null);

  // Print Job State
  const [files, setFiles] = useState<PrintFileItem[]>([]);
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);
  const [dragActive, setDragActive] = useState(false);

  // Modals
  const [cameraMode, setCameraMode] = useState<'photo' | 'qr' | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Active Order / Tracking State
  const [activeOrder, setActiveOrder] = useState<PrintOrder | null>(null);
  const [trackInput, setTrackInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<PrintOrder | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [recentTokens, setRecentTokens] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quickpress_recent_tokens');
      return saved ? (JSON.parse(saved) as string[]) : ['QP-4821', 'QP-4822'];
    } catch {
      return ['QP-4821', 'QP-4822'];
    }
  });

  // Image fallback state
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [samplesImgFailed, setSamplesImgFailed] = useState(false);

  async function loadCenters() {
    setLoadingCenters(true);
    try {
      const res = await fetch('/api/centers');
      if (res.ok) {
        const data = (await res.json()) as { centers: XeroxCenter[] };
        setCenters(data.centers);
      }
    } finally {
      setLoadingCenters(false);
    }
  }

  useEffect(() => {
    loadCenters();

    // Parse URL params for QR scan deep link (?center=XRX-104 or ?token=QP-4821)
    const params = new URLSearchParams(window.location.search);
    const centerParam = params.get('center');
    const tokenParam = params.get('token');

    if (tokenParam) {
      setActiveTab('track');
      setTrackInput(tokenParam.toUpperCase());
      lookupOrderByToken(tokenParam.toUpperCase());
    } else if (centerParam) {
      const normalized = centerParam.trim().toUpperCase();
      setSelectedCenterCode(normalized);
      setCenterCodeInput(normalized);
      setActiveTab('print');
    }
  }, []);

  const selectedCenter = useMemo(() => {
    return (
      centers.find((c) => c.code.toUpperCase() === selectedCenterCode.toUpperCase()) ||
      centers[0] ||
      null
    );
  }, [centers, selectedCenterCode]);

  const totalDetectedPages = useMemo(() => {
    return files.reduce((sum, f) => sum + f.detectedPages, 0);
  }, [files]);

  const pricing = useMemo(() => {
    if (!selectedCenter || files.length === 0) return null;
    return calculateClientPricing(totalDetectedPages, options, selectedCenter.rates);
  }, [selectedCenter, files.length, totalDetectedPages, options]);

  async function handleConnectCenterCode(codeRaw: string) {
    const code = codeRaw.trim().toUpperCase();
    if (!code) return;
    setCenterLookupError(null);

    try {
      const res = await fetch(`/api/centers/${encodeURIComponent(code)}`);
      if (!res.ok) {
        setCenterLookupError(`Center code "${code}" not found. Try XRX-104, XRX-208, or XRX-315.`);
        return;
      }
      const data = (await res.json()) as { center: XeroxCenter };
      setSelectedCenterCode(data.center.code);
      setCenterCodeInput(data.center.code);
      setActiveTab('print');

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('center', data.center.code);
      nextUrl.searchParams.delete('token');
      window.history.replaceState({}, '', nextUrl.toString());
    } catch {
      setCenterLookupError('Unable to reach print center registry.');
    }
  }

  async function processUploadedFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    const prepared: PrintFileItem[] = await Promise.all(
      incoming.map(async (file, idx) => {
        const [detectedPages, previewDataUrl] = await Promise.all([
          detectDocumentPages(file),
          readFileAsResizedImage(file, 1200),
        ]);
        return {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          detectedPages,
          source: 'upload',
          scanFilter: 'original',
          previewDataUrl,
        };
      })
    );

    setFiles((prev) => [...prev, ...prepared]);
  }

  function handleCapturedPhoto(
    dataUrl: string,
    scanFilter: 'original' | 'bw-scan' | 'high-contrast'
  ) {
    const approxBytes = Math.round((dataUrl.length * 3) / 4);
    const pageNumber = files.filter((f) => f.source === 'camera').length + 1;
    const item: PrintFileItem = {
      id: `cam-${Date.now()}`,
      name: `Camera_Scan_Page_${pageNumber}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: approxBytes,
      detectedPages: 1,
      source: 'camera',
      scanFilter,
      previewDataUrl: dataUrl,
    };
    setFiles((prev) => [...prev, item]);
    if (scanFilter === 'bw-scan') {
      setOptions((prev) => ({ ...prev, colorMode: 'bw' }));
    } else if (scanFilter === 'high-contrast') {
      setOptions((prev) => ({ ...prev, colorMode: 'color' }));
    }
  }

  function updateFilePageCount(id: string, delta: number) {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, detectedPages: Math.max(1, f.detectedPages + delta) } : f
      )
    );
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleConfirmOrder(paymentPayload: {
    customerName: string;
    customerPhone: string;
    paymentMethod: 'upi' | 'card' | 'counter';
    transactionId: string | null;
  }) {
    if (!selectedCenter || files.length === 0) return;
    setSubmittingOrder(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerCode: selectedCenter.code,
          customerName: paymentPayload.customerName,
          customerPhone: paymentPayload.customerPhone,
          files: files.map((f) => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            detectedPages: f.detectedPages,
            source: f.source,
            scanFilter: f.scanFilter,
            previewDataUrl: f.previewDataUrl,
          })),
          options,
          paymentMethod: paymentPayload.paymentMethod,
          transactionId: paymentPayload.transactionId,
        }),
      });

      const data = (await res.json()) as { order?: PrintOrder; error?: string };
      if (!res.ok || !data.order) {
        setSubmitError(data.error || 'Could not place print order.');
        return;
      }

      const nextRecent = [
        data.order.token,
        ...recentTokens.filter((t) => t !== data.order!.token),
      ].slice(0, 6);
      setRecentTokens(nextRecent);
      try {
        localStorage.setItem('quickpress_recent_tokens', JSON.stringify(nextRecent));
      } catch {
        // Ignore storage quota errors
      }

      setShowPaymentModal(false);
      setActiveOrder(data.order);
      loadCenters();
    } catch {
      setSubmitError('Network error while submitting print job.');
    } finally {
      setSubmittingOrder(false);
    }
  }

  async function lookupOrderByToken(tokenRaw: string) {
    const token = tokenRaw.trim().toUpperCase();
    if (!token) return;
    setTrackError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(token)}`);
      if (!res.ok) {
        setTrackedOrder(null);
        setTrackError(`No order found for token ${token}.`);
        return;
      }
      const data = (await res.json()) as { order: PrintOrder };
      setTrackedOrder(data.order);
    } catch {
      setTrackError('Could not connect to server.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('print');
              setActiveOrder(null);
            }}
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            QuickPress
          </button>

          {/* Zone 2: 4 single-line text nav links */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
            aria-label="Primary Navigation"
          >
            {(
              [
                { id: 'print', label: 'Print Job' },
                { id: 'track', label: 'Track Token' },
                { id: 'qr', label: 'Center QR' },
                { id: 'counter', label: 'Shop Counter' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'print') setActiveOrder(null);
                }}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'text-slate-900 border-blue-600 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCameraMode('qr')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              Scan QR
            </button>
          </div>
        </div>

        {/* Mobile sub-navigation row */}
        <div className="md:hidden border-t border-slate-100 px-4 flex items-center justify-between gap-2 overflow-x-auto">
          {(
            [
              { id: 'print', label: 'Print Job' },
              { id: 'track', label: 'Track Token' },
              { id: 'qr', label: 'Center QR' },
              { id: 'counter', label: 'Shop Counter' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                if (item.id !== 'print') setActiveOrder(null);
              }}
              className={`py-2.5 px-2 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === item.id
                  ? 'border-blue-600 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 pb-28 lg:pb-12">
        {/* VIEW 1: CUSTOMER PRINT ORDER FLOW */}
        {activeTab === 'print' && (
          <>
            {activeOrder ? (
              <OrderReceiptView
                initialOrder={activeOrder}
                onStartNewOrder={() => {
                  setActiveOrder(null);
                  setFiles([]);
                  setOptions(DEFAULT_PRINT_OPTIONS);
                }}
              />
            ) : (
              <div className="space-y-8">
                {/* Compact Editorial Intro Split */}
                <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-blue-600">
                        Zero-Queue QR Xerox & Document Printing
                      </p>
                      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                        Scan a center QR, upload or snap pages, and collect without waiting in line.
                      </h1>
                      <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                        Connect using any shop’s Center Code ID, configure color, paper size, duplex, and binding, pay via UPI or counter, and get an express pickup token.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setCameraMode('qr')}
                        className="px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                      >
                        <QrCode className="w-4 h-4" />
                        Scan Center QR Code
                      </button>
                      <button
                        type="button"
                        onClick={() => setCameraMode('photo')}
                        className="px-4 py-2.5 text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 rounded-xl inline-flex items-center gap-2 whitespace-nowrap transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Take Document Photo
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-slate-100 relative min-h-[220px]">
                    {!heroImgFailed ? (
                      <img
                        src={COUNTER_PHOTO_URL}
                        alt="Modern Xerox and print shop counter with QR standee and paper stacks"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="w-full h-full lg:h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <Printer className="w-8 h-8 text-slate-500 mb-2" />
                        <p className="text-sm font-medium text-slate-700">QuickPress Counter Standee</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Main 12-Column Print Configuration Workspace */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left 8 Columns: 3 Sequential Steps */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* 01. Xerox Center Code ID */}
                    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">
                            01. Select Xerox Center Code ID
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Enter the code printed on the shop’s QR standee or pick a nearby center.
                          </p>
                        </div>
                        {selectedCenter && (
                          <div className="text-xs text-slate-600 font-medium">
                            <span className="font-mono font-semibold text-slate-900">
                              {selectedCenter.code}
                            </span>{' '}
                            · {selectedCenter.activeQueueCount ?? 0} in queue · ~
                            {selectedCenter.estimatedWaitMinutes ?? 2} min ready
                          </div>
                        )}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleConnectCenterCode(centerCodeInput);
                        }}
                        className="flex flex-col sm:flex-row gap-2.5"
                      >
                        <input
                          type="text"
                          value={centerCodeInput}
                          onChange={(e) => setCenterCodeInput(e.target.value)}
                          placeholder="Enter Center ID (e.g. XRX-104)"
                          aria-label="Center Code ID"
                          className="flex-1 px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
                        >
                          Apply Center Code
                        </button>
                      </form>

                      {centerLookupError && (
                        <p className="text-xs font-medium text-red-600">{centerLookupError}</p>
                      )}

                      {loadingCenters ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[1, 2, 3].map((n) => (
                            <div
                              key={n}
                              className="h-24 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {centers.map((center) => {
                            const active =
                              selectedCenter?.code.toUpperCase() === center.code.toUpperCase();
                            return (
                              <button
                                key={center.code}
                                type="button"
                                onClick={() => handleConnectCenterCode(center.code)}
                                className={`text-left p-4 rounded-xl border transition-colors ${
                                  active
                                    ? 'border-blue-600 bg-blue-50/40'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs font-bold text-blue-600">
                                    {center.code}
                                  </span>
                                  {active && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                </div>
                                <p className="text-sm font-semibold text-slate-900 mt-1 truncate">
                                  {center.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  {center.area}
                                </p>
                                <p className="text-xs font-mono text-slate-700 mt-2 tabular-nums">
                                  B&W {formatCurrency(center.rates.bwPerPage)} · Color{' '}
                                  {formatCurrency(center.rates.colorPerPage)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>

                    {/* 02. Upload Documents or Take Photo */}
                    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">
                            02. Upload Documents or Take Photo
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            PDFs auto-detect page count. Camera photos include Crisp B&W Document Scan mode.
                          </p>
                        </div>
                        {files.length > 0 && (
                          <span className="text-xs font-mono text-slate-600 tabular-nums">
                            {files.length} {files.length === 1 ? 'item' : 'items'} · {totalDetectedPages}{' '}
                            {totalDetectedPages === 1 ? 'page' : 'pages'} total
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                          }}
                          onDragLeave={() => setDragActive(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            if (e.dataTransfer.files) {
                              processUploadedFiles(e.dataTransfer.files);
                            }
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              fileInputRef.current?.click();
                            }
                          }}
                          className={`sm:col-span-2 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 ${
                            dragActive
                              ? 'border-blue-600 bg-blue-50/50'
                              : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
                            onChange={(e) => {
                              if (e.target.files) processUploadedFiles(e.target.files);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          <Upload className="w-6 h-6 text-blue-600" />
                          <p className="text-sm font-semibold text-slate-900">
                            Drop PDF or Image files here, or browse
                          </p>
                          <p className="text-xs text-slate-500">
                            Supports PDF, PNG, JPG, WebP, DOCX, TXT
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCameraMode('photo')}
                          className="border border-slate-300 hover:border-blue-600 hover:bg-blue-50/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors bg-white"
                        >
                          <Camera className="w-6 h-6 text-slate-800" />
                          <span className="text-sm font-semibold text-slate-900">
                            Take Photo
                          </span>
                          <span className="text-xs text-slate-500">
                            Snap ID, notes, or book pages
                          </span>
                        </button>
                      </div>

                      {files.length > 0 && (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                          {files.map((file) => (
                            <div
                              key={file.id}
                              className="p-3.5 bg-white flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {file.previewDataUrl ? (
                                  <img
                                    src={file.previewDataUrl}
                                    alt={file.name}
                                    className={`w-11 h-14 object-cover rounded border border-slate-200 shrink-0 ${
                                      options.colorMode === 'bw' ? 'grayscale' : ''
                                    }`}
                                  />
                                ) : (
                                  <div className="w-11 h-14 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5 text-slate-500" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {formatFileSize(file.sizeBytes)} ·{' '}
                                    {file.source === 'camera'
                                      ? `Camera (${file.scanFilter})`
                                      : 'Uploaded file'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                                  <button
                                    type="button"
                                    onClick={() => updateFilePageCount(file.id, -1)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900"
                                    aria-label="Decrease detected pages"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="px-2 text-xs font-mono tabular-nums text-slate-800">
                                    {file.detectedPages} pg
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateFilePageCount(file.id, 1)}
                                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-slate-900"
                                    aria-label="Increase detected pages"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeFile(file.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                  aria-label={`Remove ${file.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* 03. Xerox & Print Configuration */}
                    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">
                            03. Choose Color, Page Size & Finishing
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Configure exact xerox print parameters before checkout.
                          </p>
                        </div>
                      </div>

                      {/* Color Mode & Sides */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Color Mode
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({ ...prev, colorMode: 'bw' }))
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                options.colorMode === 'bw'
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                Black & White
                              </p>
                              <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                                {selectedCenter
                                  ? `${formatCurrency(selectedCenter.rates.bwPerPage)} / pg`
                                  : '₹2 / pg'}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({ ...prev, colorMode: 'color' }))
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                options.colorMode === 'color'
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">
                                Full Color
                              </p>
                              <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                                {selectedCenter
                                  ? `${formatCurrency(selectedCenter.rates.colorPerPage)} / pg`
                                  : '₹10 / pg'}
                              </p>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Print Sides
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({ ...prev, sides: 'single' }))
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                options.sides === 'single'
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">1-Sided</p>
                              <p className="text-xs text-slate-500 mt-0.5">Single face</p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({ ...prev, sides: 'duplex' }))
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                options.sides === 'duplex'
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">2-Sided</p>
                              <p className="text-xs text-emerald-700 mt-0.5">
                                Back-to-back savings
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Paper Size */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Paper Size
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {(
                            [
                              { id: 'A4', sub: '210×297 mm' },
                              { id: 'A3', sub: '297×420 mm' },
                              { id: 'Legal', sub: '8.5×14 in' },
                              { id: 'Letter', sub: '8.5×11 in' },
                              { id: '4x6', sub: 'Photo Sheet' },
                            ] as const
                          ).map((size) => (
                            <button
                              key={size.id}
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({
                                  ...prev,
                                  paperSize: size.id,
                                  paperStock: size.id === '4x6' ? 'glossy' : prev.paperStock,
                                  colorMode: size.id === '4x6' ? 'color' : prev.colorMode,
                                }))
                              }
                              className={`p-2.5 rounded-lg border text-left transition-colors ${
                                options.paperSize === size.id
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-sm font-semibold text-slate-900">{size.id}</p>
                              <p className="text-[11px] font-mono text-slate-500">{size.sub}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Page Range & Copies */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                        <div className="sm:col-span-8 space-y-2.5">
                          <label className="block text-xs font-semibold text-slate-700">
                            Pages to Xerox / Print
                          </label>
                          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                            {(
                              [
                                { id: 'all', label: 'All' },
                                { id: 'custom', label: 'Custom' },
                                { id: 'odd', label: 'Odd' },
                                { id: 'even', label: 'Even' },
                              ] as const
                            ).map((mode) => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() =>
                                  setOptions((prev) => ({ ...prev, pageRangeMode: mode.id }))
                                }
                                className={`py-2 px-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                                  options.pageRangeMode === mode.id
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                          {options.pageRangeMode === 'custom' && (
                            <input
                              type="text"
                              value={options.customPageRange}
                              onChange={(e) =>
                                setOptions((prev) => ({
                                  ...prev,
                                  customPageRange: e.target.value,
                                }))
                              }
                              placeholder="e.g. 1-4, 7, 10-12"
                              className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          )}
                        </div>

                        <div className="sm:col-span-4 space-y-2.5">
                          <label className="block text-xs font-semibold text-slate-700">
                            Copies
                          </label>
                          <div className="flex items-center justify-between border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({
                                  ...prev,
                                  copies: Math.max(1, prev.copies - 1),
                                }))
                              }
                              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-700"
                              aria-label="Decrease copies"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={options.copies}
                              onChange={(e) =>
                                setOptions((prev) => ({
                                  ...prev,
                                  copies: Math.max(1, Math.min(500, Number(e.target.value) || 1)),
                                }))
                              }
                              className="w-16 text-center font-mono text-base font-bold text-slate-900 focus:outline-none tabular-nums"
                              aria-label="Number of copies"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({
                                  ...prev,
                                  copies: Math.min(500, prev.copies + 1),
                                }))
                              }
                              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-700"
                              aria-label="Increase copies"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Orientation, N-up & Paper Stock */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Orientation
                          </label>
                          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                            {(['portrait', 'landscape'] as const).map((ori) => (
                              <button
                                key={ori}
                                type="button"
                                onClick={() =>
                                  setOptions((prev) => ({ ...prev, orientation: ori }))
                                }
                                className={`py-2 text-xs font-semibold rounded-md capitalize transition-colors ${
                                  options.orientation === ori
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600'
                                }`}
                              >
                                {ori}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Pages Per Sheet
                          </label>
                          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                            {([1, 2, 4] as const).map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  setOptions((prev) => ({ ...prev, pagesPerSheet: n }))
                                }
                                className={`py-2 text-xs font-semibold rounded-md transition-colors ${
                                  options.pagesPerSheet === n
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-600'
                                }`}
                              >
                                {n}-up
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            Paper Weight
                          </label>
                          <select
                            value={options.paperStock}
                            onChange={(e) =>
                              setOptions((prev) => ({
                                ...prev,
                                paperStock: e.target.value as PrintOptions['paperStock'],
                              }))
                            }
                            className="w-full px-3 py-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            <option value="75gsm">75 GSM Standard</option>
                            <option value="100gsm">100 GSM Executive (+₹1.5/sheet)</option>
                            <option value="glossy">Glossy Photo (+₹8/sheet)</option>
                          </select>
                        </div>
                      </div>

                      {/* Finishing & Binding */}
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-700">
                          Finishing & Binding
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {(
                            [
                              { id: 'none', label: 'Loose Pages', price: 'Free' },
                              {
                                id: 'staple',
                                label: 'Corner Staple',
                                price: selectedCenter
                                  ? `${formatCurrency(selectedCenter.rates.staplePrice)} / set`
                                  : '₹5 / set',
                              },
                              {
                                id: 'spiral',
                                label: 'Spiral Bind',
                                price: selectedCenter
                                  ? `${formatCurrency(selectedCenter.rates.spiralPrice)} / set`
                                  : '₹35 / set',
                              },
                              {
                                id: 'lamination',
                                label: 'Lamination',
                                price: selectedCenter
                                  ? `${formatCurrency(selectedCenter.rates.laminationPerSheet)} / sheet`
                                  : '₹20 / sheet',
                              },
                            ] as const
                          ).map((fin) => (
                            <button
                              key={fin.id}
                              type="button"
                              onClick={() =>
                                setOptions((prev) => ({ ...prev, finishing: fin.id }))
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                options.finishing === fin.id
                                  ? 'border-blue-600 bg-blue-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <p className="text-xs font-semibold text-slate-900">{fin.label}</p>
                              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                {fin.price}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Optional Operator Instructions */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Note for Print Operator (Optional)
                        </label>
                        <input
                          type="text"
                          value={options.instructions}
                          onChange={(e) =>
                            setOptions((prev) => ({ ...prev, instructions: e.target.value }))
                          }
                          placeholder="e.g. Add transparent front cover sheet, scale to fit margins"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </section>

                    {/* Finishing Reference Card */}
                    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-12 items-stretch">
                      <div className="sm:col-span-5 bg-slate-100 min-h-[160px]">
                        {!samplesImgFailed ? (
                          <img
                            src={SAMPLES_PHOTO_URL}
                            alt="Color charts, crisp laser text pages, spiral bound booklet, and stapled sets"
                            referrerPolicy="no-referrer"
                            onError={() => setSamplesImgFailed(true)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-6">
                            <Layers className="w-7 h-7 text-slate-400" />
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-7 p-5 flex flex-col justify-center space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Commercial Laser Output & Binding Quality
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          All partner centers run 1200 DPI duplex laser presses on archival 75–100 GSM paper. Camera-captured documents are automatically contrast-normalized before printing.
                        </p>
                      </div>
                    </section>
                  </div>

                  {/* Right 4 Columns: Sticky Live Sheet Preview & Checkout */}
                  <aside className="lg:col-span-4 lg:sticky lg:top-24">
                    <PrintPreviewSheet
                      center={selectedCenter}
                      files={files}
                      options={options}
                      pricing={pricing}
                      canCheckout={Boolean(selectedCenter && files.length > 0)}
                      onProceedToPay={() => setShowPaymentModal(true)}
                    />
                  </aside>
                </div>
              </div>
            )}
          </>
        )}

        {/* VIEW 2: TRACK PICKUP TOKEN */}
        {activeTab === 'track' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Track Pickup Token</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Enter your QuickPress token (e.g. QP-4821) to watch real-time printing progress.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  lookupOrderByToken(trackInput);
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={trackInput}
                    onChange={(e) => setTrackInput(e.target.value)}
                    placeholder="Enter Token ID (e.g. QP-4821)"
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
                >
                  Check Status
                </button>
              </form>

              {recentTokens.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="text-slate-500">Recent tokens:</span>
                  {recentTokens.map((tok) => (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => {
                        setTrackInput(tok);
                        lookupOrderByToken(tok);
                      }}
                      className="font-mono font-medium text-blue-600 hover:underline px-2 py-1 rounded bg-slate-50 border border-slate-200"
                    >
                      {tok}
                    </button>
                  ))}
                </div>
              )}

              {trackError && (
                <p className="text-xs font-medium text-red-600">{trackError}</p>
              )}
            </div>

            {trackedOrder && (
              <OrderReceiptView
                initialOrder={trackedOrder}
                onStartNewOrder={() => {
                  setActiveTab('print');
                  setActiveOrder(null);
                }}
              />
            )}
          </div>
        )}

        {/* VIEW 3: CENTER QR DIRECTORY */}
        {activeTab === 'qr' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Xerox Center QR Codes & Standees
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Scan any center QR code with your phone camera, or click “Simulate QR Scan” to open that center directly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCameraMode('qr')}
                className="px-4 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
              >
                <QrCode className="w-4 h-4" />
                Open Camera Scanner
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {centers.map((center) => {
                const qrUrl = `${window.location.origin}/?center=${encodeURIComponent(
                  center.code
                )}`;
                return (
                  <div
                    key={center.code}
                    className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-xs font-bold text-blue-600">{center.code}</p>
                      <h2 className="text-lg font-bold text-slate-900">{center.name}</h2>
                      <p className="text-xs text-slate-500">{center.address}</p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center">
                      <QrCodeDisplay
                        value={qrUrl}
                        size={172}
                        alt={`QR Standee for ${center.code}`}
                      />
                      <p className="text-[11px] font-mono text-slate-500 mt-3 truncate max-w-full">
                        ?center={center.code}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
                        <span>B&W {formatCurrency(center.rates.bwPerPage)}/pg</span>
                        <span>Color {formatCurrency(center.rates.colorPerPage)}/pg</span>
                        <span>~{center.estimatedWaitMinutes ?? 2}m wait</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleConnectCenterCode(center.code)}
                        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
                      >
                        Simulate QR Scan ({center.code})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 4: SHOP COUNTER OPERATOR CONSOLE */}
        {activeTab === 'counter' && (
          <ShopCounterView
            centers={centers}
            initialCenterCode={selectedCenterCode}
            onCenterCreated={(newCenter) => {
              setCenters((prev) => [...prev, newCenter]);
              setSelectedCenterCode(newCenter.code);
            }}
            onOpenCenterAsCustomer={(code) => handleConnectCenterCode(code)}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Checkout Bar (<= 15% viewport height) */}
      {activeTab === 'print' && !activeOrder && files.length > 0 && pricing && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-4 no-print">
          <div>
            <p className="text-[11px] text-slate-500">
              {selectedCenter?.code} · {pricing.totalSheets} sheets
            </p>
            <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(pricing.totalAmount)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold whitespace-nowrap"
          >
            Pay & Get Token
          </button>
        </div>
      )}

      {/* Camera Modal (Document Capture or QR Scan) */}
      {cameraMode && (
        <CameraModal
          mode={cameraMode}
          centers={centers}
          onClose={() => setCameraMode(null)}
          onCapturePhoto={handleCapturedPhoto}
          onDetectedCenterCode={(code) => handleConnectCenterCode(code)}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedCenter && pricing && (
        <PaymentModal
          center={selectedCenter}
          pricing={pricing}
          submitting={submittingOrder}
          onClose={() => setShowPaymentModal(false)}
          onConfirmPayment={handleConfirmOrder}
        />
      )}

      {submitError && (
        <div className="fixed bottom-20 right-4 z-50 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium">
          {submitError}
        </div>
      )}
    </div>
  );
}
