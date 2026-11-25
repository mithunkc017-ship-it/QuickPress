import { FileText, Printer } from 'lucide-react';
import {
  formatCurrency,
  type OrderPricing,
  type PrintFileItem,
  type PrintOptions,
  type XeroxCenter,
} from '../types/print';

interface PrintPreviewSheetProps {
  center: XeroxCenter | null;
  files: PrintFileItem[];
  options: PrintOptions;
  pricing: OrderPricing | null;
  onProceedToPay: () => void;
  canCheckout: boolean;
}

const PAPER_ASPECT: Record<PrintOptions['paperSize'], string> = {
  A4: 'aspect-[210/297]',
  A3: 'aspect-[297/420]',
  Legal: 'aspect-[216/356]',
  Letter: 'aspect-[216/279]',
  '4x6': 'aspect-[4/6]',
};

export function PrintPreviewSheet({
  center,
  files,
  options,
  pricing,
  onProceedToPay,
  canCheckout,
}: PrintPreviewSheetProps) {
  const firstImage = files.find((f) => f.previewDataUrl);
  const firstFile = files[0];
  const isLandscape = options.orientation === 'landscape';
  const gridCols = options.pagesPerSheet === 1 ? 1 : 2;
  const slots = Array.from({ length: options.pagesPerSheet }, (_, i) => i + 1);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Live Sheet Preview</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {options.paperSize} · {options.colorMode === 'color' ? 'Full Color' : 'Black & White'} ·{' '}
            {options.sides === 'duplex' ? '2-Sided' : '1-Sided'}
          </p>
        </div>
        <span className="font-mono text-xs text-slate-600 tabular-nums">
          {options.pagesPerSheet}-up · {options.copies} {options.copies === 1 ? 'copy' : 'copies'}
        </span>
      </div>

      {/* Realistic paper preview frame */}
      <div className="bg-slate-100 rounded-lg p-5 flex items-center justify-center min-h-[260px]">
        <div
          className={`relative bg-white shadow-md border border-slate-300 transition-all duration-200 p-3 flex flex-col justify-between ${
            isLandscape ? 'w-56 aspect-[297/210]' : `w-44 ${PAPER_ASPECT[options.paperSize]}`
          }`}
        >
          {/* Finishing visual cues */}
          {options.finishing === 'staple' && (
            <div
              className="absolute top-2 left-2 w-3.5 h-1 bg-slate-700 -rotate-45 rounded-full z-10"
              title="Corner Staple"
            />
          )}
          {options.finishing === 'spiral' && (
            <div
              className="absolute inset-y-2 -left-1.5 w-2.5 flex flex-col justify-between py-1 z-10"
              title="Spiral Binding"
            >
              {Array.from({ length: 8 }).map((_, idx) => (
                <span key={idx} className="w-2.5 h-1.5 rounded-full border border-slate-700 bg-slate-200" />
              ))}
            </div>
          )}
          {options.finishing === 'lamination' && (
            <div className="pointer-events-none absolute inset-0 border-2 border-blue-200/80 bg-gradient-to-tr from-transparent via-white/20 to-blue-50/30 z-10" />
          )}

          {/* Sheet layout grid */}
          <div
            className={`grid gap-1.5 flex-1 ${
              gridCols === 1 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {slots.map((slot) => (
              <div
                key={slot}
                className="border border-slate-200 bg-slate-50 rounded-sm overflow-hidden flex items-center justify-center relative"
              >
                {firstImage?.previewDataUrl ? (
                  <img
                    src={firstImage.previewDataUrl}
                    alt={firstImage.name}
                    className={`w-full h-full object-cover transition-all duration-200 ${
                      options.colorMode === 'bw' ? 'grayscale contrast-125' : ''
                    }`}
                  />
                ) : firstFile ? (
                  <div className="p-2 text-center space-y-1.5 w-full">
                    <FileText
                      className={`w-5 h-5 mx-auto ${
                        options.colorMode === 'color' ? 'text-blue-600' : 'text-slate-600'
                      }`}
                    />
                    <div className="space-y-1 px-1">
                      <div className="h-1 bg-slate-300 rounded w-4/5 mx-auto" />
                      <div className="h-1 bg-slate-200 rounded w-full" />
                      <div className="h-1 bg-slate-200 rounded w-3/4 mx-auto" />
                    </div>
                    <p className="text-[9px] font-mono text-slate-500 truncate">
                      Pg {slot}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 text-center">
                    <p className="text-[10px] text-slate-400">Page {slot}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-100 mt-1.5">
            <span>{options.paperStock.toUpperCase()}</span>
            <span>{options.orientation === 'portrait' ? 'PORTRAIT' : 'LANDSCAPE'}</span>
          </div>
        </div>
      </div>

      {/* Pricing Summary */}
      {pricing && center ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>
              Print ({pricing.selectedPages} pg × {options.copies}{' '}
              {options.copies === 1 ? 'copy' : 'copies'})
            </span>
            <span className="font-mono tabular-nums text-slate-900">
              {formatCurrency(pricing.printCost)}
            </span>
          </div>

          {pricing.paperUpgradeCost > 0 && (
            <div className="flex items-center justify-between text-slate-600">
              <span>
                Paper Stock ({options.paperStock === '100gsm' ? '100 GSM' : 'Glossy'} ·{' '}
                {pricing.totalSheets} sheets)
              </span>
              <span className="font-mono tabular-nums text-slate-900">
                {formatCurrency(pricing.paperUpgradeCost)}
              </span>
            </div>
          )}

          {pricing.finishingCost > 0 && (
            <div className="flex items-center justify-between text-slate-600">
              <span className="capitalize">Finishing ({options.finishing})</span>
              <span className="font-mono tabular-nums text-slate-900">
                {formatCurrency(pricing.finishingCost)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600">
            <span>Zero-Queue Express Fee</span>
            <span className="font-mono tabular-nums text-slate-900">
              {formatCurrency(pricing.platformFee)}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
            <div>
              <span className="text-base font-semibold text-slate-900">Total Payable</span>
              <p className="text-xs text-slate-500 tabular-nums">
                {pricing.totalSheets} physical {pricing.totalSheets === 1 ? 'sheet' : 'sheets'} · ~
                {center.estimatedWaitMinutes || 2} min ready
              </p>
            </div>
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(pricing.totalAmount)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-500 py-2">
          Select a Xerox center and upload or capture at least one page to calculate exact cost.
        </div>
      )}

      <button
        type="button"
        onClick={onProceedToPay}
        disabled={!canCheckout}
        className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
      >
        <Printer className="w-4 h-4" />
        {canCheckout && pricing
          ? `Pay ${formatCurrency(pricing.totalAmount)} & Get Pickup Token`
          : 'Upload File or Photo to Continue'}
      </button>
    </div>
  );
}
