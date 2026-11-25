import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { QrCodeDisplay } from './QrCodeDisplay';
import { formatCurrency, type PrintOrder, type XeroxCenter } from '../types/print';

interface ShopCounterViewProps {
  centers: XeroxCenter[];
  initialCenterCode: string;
  onCenterCreated: (newCenter: XeroxCenter) => void;
  onOpenCenterAsCustomer: (code: string) => void;
}

interface CenterOrdersResponse {
  center: XeroxCenter;
  orders: PrintOrder[];
  summary: {
    totalOrders: number;
    queuedCount: number;
    printingCount: number;
    readyCount: number;
    collectedCount: number;
    totalRevenue: number;
    totalSheetsPrinted: number;
  };
}

export function ShopCounterView({
  centers,
  initialCenterCode,
  onCenterCreated,
  onOpenCenterAsCustomer,
}: ShopCounterViewProps) {
  const [selectedCode, setSelectedCode] = useState(
    initialCenterCode || centers[0]?.code || 'XRX-104'
  );
  const [tab, setTab] = useState<'queue' | 'standee' | 'register'>('queue');
  const [filterStatus, setFilterStatus] = useState<'all' | PrintOrder['status']>('all');
  const [data, setData] = useState<CenterOrdersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingToken, setUpdatingToken] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);

  // Register new center form
  const [newName, setNewName] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newUpi, setNewUpi] = useState('');
  const [newBwRate, setNewBwRate] = useState('2');
  const [newColorRate, setNewColorRate] = useState('10');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function fetchOrders(code = selectedCode) {
    if (!code) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/centers/${encodeURIComponent(code)}/orders`);
      if (res.ok) {
        const json = (await res.json()) as CenterOrdersResponse;
        setData(json);
        if (selectedOrder) {
          const updated = json.orders.find((o) => o.token === selectedOrder.token);
          if (updated) setSelectedOrder(updated);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders(selectedCode);
    const interval = window.setInterval(() => fetchOrders(selectedCode), 4000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode]);

  async function handleUpdateOrder(
    token: string,
    payload: { status?: PrintOrder['status']; paymentStatus?: 'paid' | 'pending_counter' }
  ) {
    setUpdatingToken(token);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(token)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchOrders(selectedCode);
      }
    } finally {
      setUpdatingToken(null);
    }
  }

  async function handleCreateCenter(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          area: newArea,
          code: newCode,
          upiId: newUpi,
          bwPerPage: Number(newBwRate),
          colorPerPage: Number(newColorRate),
        }),
      });
      const json = (await res.json()) as { center?: XeroxCenter; error?: string };
      if (!res.ok || !json.center) {
        setCreateError(json.error || 'Could not register center.');
        return;
      }
      onCenterCreated(json.center);
      setSelectedCode(json.center.code);
      setNewName('');
      setNewArea('');
      setNewCode('');
      setNewUpi('');
      setTab('standee');
    } finally {
      setCreating(false);
    }
  }

  const activeCenter = data?.center || centers.find((c) => c.code === selectedCode) || centers[0];
  const centerQrUrl = activeCenter
    ? `${window.location.origin}/?center=${encodeURIComponent(activeCenter.code)}`
    : window.location.origin;

  const filteredOrders =
    data?.orders.filter((o) => filterStatus === 'all' || o.status === filterStatus) || [];

  return (
    <div className="space-y-6">
      {/* Workspace Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="operator-center-select" className="block text-xs font-medium text-slate-500 mb-1">
              Operating Xerox Center
            </label>
            <select
              id="operator-center-select"
              value={selectedCode}
              onChange={(e) => {
                setSelectedCode(e.target.value);
                setSelectedOrder(null);
              }}
              className="px-3.5 py-2 text-sm font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {centers.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('queue')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                tab === 'queue' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Print Queue
            </button>
            <button
              type="button"
              onClick={() => setTab('standee')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                tab === 'standee' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Printable QR Standee
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-colors inline-flex items-center gap-1 ${
                tab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              New Center
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchOrders(selectedCode)}
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
            title="Refresh Queue"
            aria-label="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab 1: Live Print Queue */}
      {tab === 'queue' && (
        <div className="space-y-6">
          {/* Summary metrics strip */}
          {data && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Queued</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {data.summary.queuedCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Printing Now</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                  {data.summary.printingCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Ready for Pickup</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                  {data.summary.readyCount}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="text-xs text-slate-500">Sheets Printed</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {data.summary.totalSheetsPrinted}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 col-span-2 lg:col-span-1">
                <p className="text-xs text-slate-500">Collected Revenue</p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {formatCurrency(data.summary.totalRevenue)}
                </p>
              </div>
            </div>
          )}

          {/* Queue List & Detail Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Incoming Print Jobs</h3>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {(['all', 'queued', 'printing', 'ready', 'collected'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFilterStatus(status)}
                      className={`px-2.5 py-1 text-xs font-medium rounded capitalize whitespace-nowrap transition-colors ${
                        filterStatus === status
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-900">No jobs in this filter</p>
                  <p className="text-xs text-slate-500">
                    Share or scan the Center QR Code so customers can send print jobs directly here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const isSelected = selectedOrder?.token === order.token;
                    return (
                      <div
                        key={order.token}
                        onClick={() => setSelectedOrder(order)}
                        className={`p-4 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                              {order.token}
                            </span>
                            <span className="text-sm font-medium text-slate-800 truncate">
                              {order.customerName}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded capitalize ${
                                order.status === 'ready'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : order.status === 'printing'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : order.status === 'collected'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {order.files.length} {order.files.length === 1 ? 'file' : 'files'} ·{' '}
                            {order.options.paperSize} ·{' '}
                            {order.options.colorMode === 'color' ? 'Color' : 'B&W'} ·{' '}
                            {order.options.sides === 'duplex' ? '2-Sided' : '1-Sided'} ·{' '}
                            {order.options.copies} {order.options.copies === 1 ? 'copy' : 'copies'} ·{' '}
                            <span className="capitalize">{order.options.finishing}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                              {formatCurrency(order.pricing.totalAmount)}
                            </p>
                            <p
                              className={`text-[11px] font-medium ${
                                order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {order.paymentStatus === 'paid' ? 'Paid' : 'Due at Counter'}
                            </p>
                          </div>

                          {order.status === 'queued' && (
                            <button
                              type="button"
                              disabled={updatingToken === order.token}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateOrder(order.token, { status: 'printing' });
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 whitespace-nowrap"
                            >
                              Start Print
                            </button>
                          )}
                          {order.status === 'printing' && (
                            <button
                              type="button"
                              disabled={updatingToken === order.token}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateOrder(order.token, { status: 'ready' });
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 whitespace-nowrap"
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.status === 'ready' && (
                            <button
                              type="button"
                              disabled={updatingToken === order.token}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateOrder(order.token, {
                                  status: 'collected',
                                  paymentStatus: 'paid',
                                });
                              }}
                              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                            >
                              Hand Over
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Job Inspector Panel */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              {selectedOrder ? (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <p className="font-mono text-lg font-bold text-slate-900">
                        {selectedOrder.token}
                      </p>
                      <p className="text-sm text-slate-600">
                        {selectedOrder.customerName}
                        {selectedOrder.customerPhone ? ` · ${selectedOrder.customerPhone}` : ''}
                      </p>
                    </div>
                    <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(selectedOrder.pricing.totalAmount)}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-700">Attached Documents & Scans</p>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedOrder.files.map((f) => (
                        <div
                          key={f.id}
                          className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-900 truncate flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              {f.name}
                            </span>
                            <span className="text-xs font-mono text-slate-500 shrink-0">
                              {f.detectedPages} pg
                            </span>
                          </div>
                          {f.previewUrl && (
                            <img
                              src={f.previewUrl}
                              alt={f.name}
                              className={`w-full max-h-48 object-contain rounded border border-slate-200 bg-white ${
                                selectedOrder.options.colorMode === 'bw' ? 'grayscale' : ''
                              }`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedOrder.options.instructions && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                      <strong>Customer Note:</strong> {selectedOrder.options.instructions}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                    {selectedOrder.paymentStatus === 'pending_counter' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOrder(selectedOrder.token, { paymentStatus: 'paid' })
                        }
                        className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Collect {formatCurrency(selectedOrder.pricing.totalAmount)} Cash/UPI
                      </button>
                    )}
                    {selectedOrder.status !== 'collected' && (
                      <button
                        type="button"
                        onClick={() => {
                          const next =
                            selectedOrder.status === 'queued'
                              ? 'printing'
                              : selectedOrder.status === 'printing'
                              ? 'ready'
                              : 'collected';
                          handleUpdateOrder(selectedOrder.token, { status: next });
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        {selectedOrder.status === 'queued'
                          ? 'Move to Printing'
                          : selectedOrder.status === 'printing'
                          ? 'Mark Ready for Pickup'
                          : 'Complete & Hand Over'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-10 text-center space-y-2">
                  <Printer className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-800">Select a print job</p>
                  <p className="text-xs text-slate-500">
                    Click any row in the queue to inspect attached pages, photo scans, and payment status.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Printable QR Standee */}
      {tab === 'standee' && activeCenter && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-6 shadow-sm print-only-standee">
              <div className="space-y-1">
                <p className="text-xs font-mono uppercase tracking-wider text-blue-600 font-semibold">
                  Zero-Queue Express Print
                </p>
                <h2 className="text-2xl font-bold text-slate-900">{activeCenter.name}</h2>
                <p className="text-xs text-slate-500">{activeCenter.address}</p>
              </div>

              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl inline-flex flex-col items-center">
                <QrCodeDisplay
                  value={centerQrUrl}
                  size={220}
                  alt={`QR Code for ${activeCenter.code}`}
                />
                <div className="mt-4 pt-3 border-t border-slate-200 w-full">
                  <p className="text-[11px] text-slate-500">Center Code ID</p>
                  <p className="font-mono text-xl font-bold text-slate-900 tracking-wide">
                    {activeCenter.code}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left border-t border-slate-100 pt-5">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] text-slate-500">B&W Print / Xerox</p>
                  <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatCurrency(activeCenter.rates.bwPerPage)} / pg
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-[11px] text-slate-500">Full Color Laser</p>
                  <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatCurrency(activeCenter.rates.colorPerPage)} / pg
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                1. Scan QR · 2. Upload PDF or Take Photo · 3. Choose Color & Size · 4. Pay & Skip the Line
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5 no-print">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">Counter Standee Actions</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Place this QR standee on your shop counter or window. When customers scan it, their phone opens directly into{' '}
              <span className="font-mono text-slate-900 font-medium">{activeCenter.code}</span>{' '}
              with your exact paper pricing.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-[11px] text-slate-500 mb-1">Direct QR Target URL</p>
              <p className="font-mono text-xs text-slate-800 break-all">{centerQrUrl}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                Print Standee
              </button>
              <button
                type="button"
                onClick={() => onOpenCenterAsCustomer(activeCenter.code)}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                Test Customer View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Register New Xerox Center */}
      {tab === 'register' && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Register a New Xerox Center
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Generates a unique Center Code ID, live print queue, and scannable counter QR standee.
            </p>
          </div>

          <form onSubmit={handleCreateCenter} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Shop / Center Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Library North Copy Shop"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Campus / Area <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  placeholder="e.g. Gate 1 Market"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Custom Center Code ID (Optional)
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Auto-generated (e.g. XRX-450)"
                  className="w-full px-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Shop UPI ID
                </label>
                <input
                  type="text"
                  value={newUpi}
                  onChange={(e) => setNewUpi(e.target.value)}
                  placeholder="shopname@upi"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  B&W Rate (₹ / page)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={newBwRate}
                  onChange={(e) => setNewBwRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Color Rate (₹ / page)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={newColorRate}
                  onChange={(e) => setNewColorRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {createError}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg"
              >
                {creating ? 'Registering Center...' : 'Create Center & Generate QR'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
