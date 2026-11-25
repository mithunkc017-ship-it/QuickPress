export interface CenterRates {
  bwPerPage: number;
  colorPerPage: number;
  a3Multiplier: number;
  legalMultiplier: number;
  photo4x6PerPage: number;
  duplexDiscountPerSheet: number;
  gsm100ExtraPerSheet: number;
  glossyExtraPerSheet: number;
  staplePrice: number;
  spiralPrice: number;
  laminationPerSheet: number;
}

export interface XeroxCenter {
  code: string;
  name: string;
  area: string;
  address: string;
  hours: string;
  upiId: string;
  printersOnline: number;
  avgMinutesPerJob: number;
  acceptingOrders: boolean;
  rates: CenterRates;
  activeQueueCount?: number;
  estimatedWaitMinutes?: number;
  createdAt: string;
}

export interface PrintFileItem {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  detectedPages: number;
  source: 'upload' | 'camera';
  scanFilter: 'original' | 'bw-scan' | 'high-contrast';
  previewDataUrl: string | null;
  previewUrl?: string | null;
}

export interface PrintOptions {
  colorMode: 'bw' | 'color';
  paperSize: 'A4' | 'A3' | 'Legal' | 'Letter' | '4x6';
  sides: 'single' | 'duplex';
  pageRangeMode: 'all' | 'custom' | 'odd' | 'even';
  customPageRange: string;
  orientation: 'portrait' | 'landscape';
  pagesPerSheet: 1 | 2 | 4;
  paperStock: '75gsm' | '100gsm' | 'glossy';
  finishing: 'none' | 'staple' | 'spiral' | 'lamination';
  copies: number;
  instructions: string;
}

export interface OrderPricing {
  selectedPages: number;
  effectiveSheetsPerCopy: number;
  totalSheets: number;
  printCost: number;
  paperUpgradeCost: number;
  finishingCost: number;
  platformFee: number;
  totalAmount: number;
}

export interface PrintOrder {
  token: string;
  centerCode: string;
  centerName: string;
  customerName: string;
  customerPhone: string;
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    detectedPages: number;
    source: 'upload' | 'camera';
    scanFilter: 'original' | 'bw-scan' | 'high-contrast';
    previewUrl: string | null;
  }>;
  options: PrintOptions;
  pricing: OrderPricing;
  paymentMethod: 'upi' | 'card' | 'counter';
  paymentStatus: 'paid' | 'pending_counter';
  transactionId: string | null;
  status: 'queued' | 'printing' | 'ready' | 'collected';
  estimatedReadyAt: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  colorMode: 'bw',
  paperSize: 'A4',
  sides: 'single',
  pageRangeMode: 'all',
  customPageRange: '',
  orientation: 'portrait',
  pagesPerSheet: 1,
  paperStock: '75gsm',
  finishing: 'none',
  copies: 1,
  instructions: '',
};

export function parseCustomPageRange(rangeText: string, maxPages: number): number[] {
  if (!rangeText.trim() || maxPages <= 0) {
    return Array.from({ length: Math.max(1, maxPages) }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  const parts = rangeText.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes('-')) {
      const [startRaw, endRaw] = trimmed.split('-').map((s) => parseInt(s.trim(), 10));
      if (!Number.isNaN(startRaw) && !Number.isNaN(endRaw)) {
        const start = Math.max(1, Math.min(startRaw, endRaw));
        const end = Math.min(maxPages, Math.max(startRaw, endRaw));
        for (let p = start; p <= end; p++) {
          pages.add(p);
        }
      }
    } else {
      const single = parseInt(trimmed, 10);
      if (!Number.isNaN(single) && single >= 1 && single <= maxPages) {
        pages.add(single);
      }
    }
  }
  return pages.size > 0
    ? Array.from(pages).sort((a, b) => a - b)
    : Array.from({ length: Math.max(1, maxPages) }, (_, i) => i + 1);
}

export function calculateClientPricing(
  totalDetectedPages: number,
  options: PrintOptions,
  rates: CenterRates
): OrderPricing {
  const safeTotalPages = Math.max(1, totalDetectedPages);
  let selectedPages = safeTotalPages;

  if (options.pageRangeMode === 'custom') {
    selectedPages = parseCustomPageRange(options.customPageRange, safeTotalPages).length;
  } else if (options.pageRangeMode === 'odd') {
    selectedPages = Math.ceil(safeTotalPages / 2);
  } else if (options.pageRangeMode === 'even') {
    selectedPages = Math.max(1, Math.floor(safeTotalPages / 2));
  }

  const logicalSidesPerCopy = Math.ceil(selectedPages / options.pagesPerSheet);
  const effectiveSheetsPerCopy =
    options.sides === 'duplex'
      ? Math.ceil(logicalSidesPerCopy / 2)
      : logicalSidesPerCopy;
  const copies = Math.max(1, Math.min(500, Math.round(options.copies || 1)));
  const totalSheets = effectiveSheetsPerCopy * copies;
  const totalImpressions = logicalSidesPerCopy * copies;

  let basePerImpression =
    options.colorMode === 'color' ? rates.colorPerPage : rates.bwPerPage;

  if (options.paperSize === 'A3') {
    basePerImpression *= rates.a3Multiplier;
  } else if (options.paperSize === 'Legal') {
    basePerImpression *= rates.legalMultiplier;
  } else if (options.paperSize === '4x6') {
    basePerImpression = rates.photo4x6PerPage;
  }

  let printCost = totalImpressions * basePerImpression;
  if (options.sides === 'duplex' && options.paperSize !== '4x6') {
    const duplexSheetsSaved = Math.floor(logicalSidesPerCopy / 2) * copies;
    printCost = Math.max(1, printCost - duplexSheetsSaved * rates.duplexDiscountPerSheet);
  }

  let paperUpgradeCost = 0;
  if (options.paperStock === '100gsm') {
    paperUpgradeCost = totalSheets * rates.gsm100ExtraPerSheet;
  } else if (options.paperStock === 'glossy') {
    paperUpgradeCost = totalSheets * rates.glossyExtraPerSheet;
  }

  let finishingCost = 0;
  if (options.finishing === 'staple') {
    finishingCost = copies * rates.staplePrice;
  } else if (options.finishing === 'spiral') {
    finishingCost = copies * rates.spiralPrice;
  } else if (options.finishing === 'lamination') {
    finishingCost = totalSheets * rates.laminationPerSheet;
  }

  const platformFee = 2;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const subtotal =
    round2(printCost) + round2(paperUpgradeCost) + round2(finishingCost) + platformFee;

  return {
    selectedPages,
    effectiveSheetsPerCopy,
    totalSheets,
    printCost: round2(printCost),
    paperUpgradeCost: round2(paperUpgradeCost),
    finishingCost: round2(finishingCost),
    platformFee,
    totalAmount: round2(subtotal),
  };
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2).replace(/\.00$/, '')}`;
}
