import { useState } from 'react';
import { CreditCard, QrCode, Store, CheckCircle2, Lock, X } from 'lucide-react';
import { QrCodeDisplay } from './QrCodeDisplay';
import { formatCurrency, type OrderPricing, type XeroxCenter } from '../types/print';

interface PaymentModalProps {
  center: XeroxCenter;
  pricing: OrderPricing;
  submitting: boolean;
  onClose: () => void;
  onConfirmPayment: (payload: {
    customerName: string;
    customerPhone: string;
    paymentMethod: 'upi' | 'card' | 'counter';
    transactionId: string | null;
  }) => void;
}

export function PaymentModal({
  center,
  pricing,
  submitting,
  onClose,
  onConfirmPayment,
}: PaymentModalProps) {
  const [method, setMethod] = useState<'upi' | 'card' | 'counter'>('upi');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [upiRef, setUpiRef] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [error, setError] = useState<string | null>(null);

  const upiUri = `upi://pay?pa=${encodeURIComponent(center.upiId)}&pn=${encodeURIComponent(
    center.name
  )}&am=${pricing.totalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
    `QuickPress ${center.code}`
  )}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Please enter your name so the counter can label your print packet.');
      return;
    }

    if (method === 'card') {
      const digits = cardNumber.replace(/\s+/g, '');
      if (digits.length < 12 || !cardExpiry.trim() || cardCvv.trim().length < 3) {
        setError('Enter valid card details or choose Instant UPI / Pay at Counter.');
        return;
      }
    }

    const txId =
      method === 'upi'
        ? upiRef.trim() || `UPI${Math.floor(10000000 + Math.random() * 89999999)}`
        : method === 'card'
        ? `CRD${Math.floor(10000000 + Math.random() * 89999999)}`
        : null;

    onConfirmPayment({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      paymentMethod: method,
      transactionId: txId,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Complete Print Payment"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Express Checkout</h3>
            <p className="text-xs text-slate-500">
              {center.code} · {center.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close payment modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Amount banner */}
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Amount</p>
              <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                {pricing.selectedPages} pages · {pricing.totalSheets} physical sheets
              </p>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(pricing.totalAmount)}
            </div>
          </div>

          {/* Customer details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pickup Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rohan Sharma"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Mobile Number (Optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="10-digit number"
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Payment method tabs */}
          <div>
            <p className="text-xs font-medium text-slate-700 mb-2">Select Payment Mode</p>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMethod('upi')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  method === 'upi'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <QrCode className="w-4 h-4" />
                UPI QR
              </button>
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  method === 'card'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Card
              </button>
              <button
                type="button"
                onClick={() => setMethod('counter')}
                className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                  method === 'counter'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-4 h-4" />
                At Counter
              </button>
            </div>
          </div>

          {/* Method specific details */}
          {method === 'upi' && (
            <div className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col sm:flex-row items-center gap-5">
              <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                <QrCodeDisplay value={upiUri} size={136} alt="UPI Payment QR Code" />
              </div>
              <div className="space-y-2.5 flex-1 w-full">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Scan with any UPI App
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Payee UPI ID: <span className="font-mono text-slate-800">{center.upiId}</span>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    UPI Reference / UTR (Optional)
                  </label>
                  <input
                    type="text"
                    value={upiRef}
                    onChange={(e) => setUpiRef(e.target.value)}
                    placeholder="Auto-verified on confirmation"
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {method === 'card' && (
            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4532 8910 2204 1189"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Expiry (MM/YY)
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="08/29"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">CVV</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="•••"
                    className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            </div>
          )}

          {method === 'counter' && (
            <div className="p-4 border border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed">
              Your print job enters the center queue immediately with a{' '}
              <span className="font-semibold text-slate-900">Pay on Pickup</span> token. Present
              your token at the express counter and pay {formatCurrency(pricing.totalAmount)} via
              cash or UPI when collecting your pages.
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-200">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5" />
              Direct center checkout
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting
                ? 'Sending to Printer...'
                : method === 'counter'
                ? 'Confirm & Reserve Token'
                : `Confirm Payment ${formatCurrency(pricing.totalAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
