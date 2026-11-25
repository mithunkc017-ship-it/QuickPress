import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Printer,
  PackageCheck,
  RefreshCw,
  ArrowLeft,
  FileText,
} from 'lucide-react';
import { QrCodeDisplay } from './QrCodeDisplay';
import { formatCurrency, type PrintOrder } from '../types/print';

interface OrderReceiptViewProps {
  initialOrder: PrintOrder;
  onStartNewOrder: () => void;
}

const STEPS: Array<{
  key: PrintOrder['status'];
  label: string;
  description: string;
}> = [
  { key: 'queued', label: 'In Queue', description: 'Received by center terminal' },
  { key: 'printing', label: 'Printing', description: 'Pages running on press' },
  { key: 'ready', label: 'Ready', description: 'Collect at express desk' },
  { key: 'collected', label: 'Collected', description: 'Handed over to customer' },
];

export function OrderReceiptView({
  initialOrder,
  onStartNewOrder,
}: OrderReceiptViewProps) {
  const [order, setOrder] = useState<PrintOrder>(initialOrder);
  const [queueAhead, setQueueAhead] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshStatus() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.token)}`);
      if (res.ok) {
        const data = (await res.json()) as { order: PrintOrder; queueAhead: number };
        setOrder(data.order);
        setQueueAhead(data.queueAhead || 0);
      }
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (order.status === 'collected') return;
    const timer = window.setInterval(() => {
      refreshStatus();
    }, 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.token, order.status]);

  const currentStepIndex = STEPS.findIndex((s) => s.key === order.status);
  const pickupQrUrl = `${window.location.origin}/?token=${encodeURIComponent(order.token)}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button
          type="button"
          onClick={onStartNewOrder}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          New Print Order
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={refreshStatus}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
        </div>
      </div>

      {/* Main Token & Pickup Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden print-only-standee">
        <div className="p-6 sm:p-8 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">
              {order.centerCode} · {order.centerName}
            </p>
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
                {order.token}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                  order.status === 'ready' || order.status === 'collected'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : order.status === 'printing'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {order.status === 'ready' ? (
                  <PackageCheck className="w-3.5 h-3.5" />
                ) : order.status === 'printing' ? (
                  <Printer className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {STEPS[currentStepIndex]?.label || order.status}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Pickup for <span className="font-semibold text-slate-900">{order.customerName}</span>
              {order.status === 'queued' && (
                <> · {queueAhead === 0 ? 'Next up on printer' : `${queueAhead} job(s) ahead`}</>
              )}
              {order.status === 'ready' && ' · Your packet is printed and waiting at Express Desk.'}
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5 shrink-0">
            <QrCodeDisplay value={pickupQrUrl} size={96} alt={`Pickup QR for ${order.token}`} />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-slate-900">Express Pickup QR</p>
              <p className="text-slate-500 max-w-[130px]">
                Show this code at the counter to skip the line.
              </p>
            </div>
          </div>
        </div>

        {/* 4-step Queue Progress */}
        <div className="p-6 sm:p-8 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STEPS.map((step, idx) => {
              const completed = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={step.key}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    isCurrent
                      ? 'bg-white border-blue-600'
                      : completed
                      ? 'bg-white border-slate-200'
                      : 'bg-transparent border-slate-200/70 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono text-slate-400">0{idx + 1}</span>
                    {completed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Specs & Itemized Payment Breakdown */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Files & Xerox Specifications</h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {order.files.map((file) => (
                <div key={file.id} className="p-3 bg-white flex items-center gap-3">
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt={file.name}
                      className="w-10 h-12 object-cover rounded border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-12 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {file.detectedPages} {file.detectedPages === 1 ? 'page' : 'pages'} ·{' '}
                      {file.source === 'camera' ? 'Camera Scan' : 'Uploaded File'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <dl className="grid grid-cols-2 gap-y-2 text-xs pt-2">
              <dt className="text-slate-500">Color Mode</dt>
              <dd className="font-medium text-slate-900 text-right">
                {order.options.colorMode === 'color' ? 'Full Color' : 'Black & White'}
              </dd>
              <dt className="text-slate-500">Paper Size & Stock</dt>
              <dd className="font-medium text-slate-900 text-right">
                {order.options.paperSize} · {order.options.paperStock.toUpperCase()}
              </dd>
              <dt className="text-slate-500">Sides & Layout</dt>
              <dd className="font-medium text-slate-900 text-right">
                {order.options.sides === 'duplex' ? '2-Sided' : '1-Sided'} · {order.options.pagesPerSheet}-up
              </dd>
              <dt className="text-slate-500">Copies & Finishing</dt>
              <dd className="font-medium text-slate-900 text-right capitalize">
                {order.options.copies} {order.options.copies === 1 ? 'copy' : 'copies'} · {order.options.finishing}
              </dd>
            </dl>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Payment Receipt</h3>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Print Impressions ({order.pricing.selectedPages} pg × {order.options.copies})</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatCurrency(order.pricing.printCost)}
                </span>
              </div>
              {order.pricing.paperUpgradeCost > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Paper Stock Upgrade</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatCurrency(order.pricing.paperUpgradeCost)}
                  </span>
                </div>
              )}
              {order.pricing.finishingCost > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span className="capitalize">Finishing ({order.options.finishing})</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatCurrency(order.pricing.finishingCost)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Express Queue Fee</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatCurrency(order.pricing.platformFee)}
                </span>
              </div>
              <div className="pt-2.5 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrency(order.pricing.totalAmount)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-600">
                <span>
                  Status:{' '}
                  <strong className={order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                    {order.paymentStatus === 'paid' ? 'Paid Online' : 'Pay at Counter'}
                  </strong>
                </span>
                {order.transactionId && (
                  <span className="font-mono text-[11px]">Ref: {order.transactionId}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
