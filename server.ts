import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

interface CenterRates {
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

interface XeroxCenter {
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
  createdAt: string;
}

interface PrintFileRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  detectedPages: number;
  source: 'upload' | 'camera';
  scanFilter: 'original' | 'bw-scan' | 'high-contrast';
  previewUrl: string | null;
}

interface PrintOptionsRecord {
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

interface OrderPricing {
  selectedPages: number;
  effectiveSheetsPerCopy: number;
  totalSheets: number;
  printCost: number;
  paperUpgradeCost: number;
  finishingCost: number;
  platformFee: number;
  totalAmount: number;
}

interface PrintOrder {
  token: string;
  centerCode: string;
  centerName: string;
  customerName: string;
  customerPhone: string;
  files: PrintFileRecord[];
  options: PrintOptionsRecord;
  pricing: OrderPricing;
  paymentMethod: 'upi' | 'card' | 'counter';
  paymentStatus: 'paid' | 'pending_counter';
  transactionId: string | null;
  status: 'queued' | 'printing' | 'ready' | 'collected';
  estimatedReadyAt: string;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  centers: XeroxCenter[];
  orders: PrintOrder[];
}

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const DEFAULT_RATES: CenterRates = {
  bwPerPage: 2,
  colorPerPage: 10,
  a3Multiplier: 2,
  legalMultiplier: 1.25,
  photo4x6PerPage: 20,
  duplexDiscountPerSheet: 0.5,
  gsm100ExtraPerSheet: 1.5,
  glossyExtraPerSheet: 8,
  staplePrice: 5,
  spiralPrice: 35,
  laminationPerSheet: 20,
};

function createSeedData(): DatabaseSchema {
  const now = Date.now();
  return {
    centers: [
      {
        code: 'XRX-104',
        name: 'Campus Central Copy & Print',
        area: 'Engineering Block Gate 2',
        address: 'Shop 4, Student Plaza, Main Campus Road',
        hours: '07:30 AM – 10:30 PM',
        upiId: 'campuscopy.xrx104@upi',
        printersOnline: 4,
        avgMinutesPerJob: 2,
        acceptingOrders: true,
        rates: { ...DEFAULT_RATES },
        createdAt: new Date(now - 86400000 * 14).toISOString(),
      },
      {
        code: 'XRX-208',
        name: 'Metro Express Xerox Hub',
        area: 'Central Metro Concourse',
        address: 'Kiosk B-12, Exit Gate 3, Metro Station',
        hours: '06:00 AM – 11:00 PM',
        upiId: 'metroxerox.208@upi',
        printersOnline: 3,
        avgMinutesPerJob: 2,
        acceptingOrders: true,
        rates: {
          ...DEFAULT_RATES,
          bwPerPage: 2.5,
          colorPerPage: 12,
          spiralPrice: 40,
        },
        createdAt: new Date(now - 86400000 * 9).toISOString(),
      },
      {
        code: 'XRX-315',
        name: 'TechPark 24x7 Document Studio',
        area: 'Cyber Hub Tower B',
        address: 'Ground Lobby, East Wing, TechPark',
        hours: 'Open 24 Hours',
        upiId: 'techparkprint.315@upi',
        printersOnline: 5,
        avgMinutesPerJob: 1.5,
        acceptingOrders: true,
        rates: {
          ...DEFAULT_RATES,
          bwPerPage: 3,
          colorPerPage: 10,
          gsm100ExtraPerSheet: 2,
        },
        createdAt: new Date(now - 86400000 * 5).toISOString(),
      },
    ],
    orders: [
      {
        token: 'QP-4821',
        centerCode: 'XRX-104',
        centerName: 'Campus Central Copy & Print',
        customerName: 'Aarav Mehta',
        customerPhone: '9876543210',
        files: [
          {
            id: 'seed-f1',
            name: 'Thermodynamics_Lab_Report.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 1420500,
            detectedPages: 14,
            source: 'upload',
            scanFilter: 'original',
            previewUrl: null,
          },
        ],
        options: {
          colorMode: 'bw',
          paperSize: 'A4',
          sides: 'duplex',
          pageRangeMode: 'all',
          customPageRange: '',
          orientation: 'portrait',
          pagesPerSheet: 1,
          paperStock: '75gsm',
          finishing: 'spiral',
          copies: 1,
          instructions: 'Clear front cover sheet',
        },
        pricing: {
          selectedPages: 14,
          effectiveSheetsPerCopy: 7,
          totalSheets: 7,
          printCost: 24.5,
          paperUpgradeCost: 0,
          finishingCost: 35,
          platformFee: 2,
          totalAmount: 61.5,
        },
        paymentMethod: 'upi',
        paymentStatus: 'paid',
        transactionId: 'UPI4821904412',
        status: 'printing',
        estimatedReadyAt: new Date(now + 120000).toISOString(),
        createdAt: new Date(now - 180000).toISOString(),
        updatedAt: new Date(now - 60000).toISOString(),
      },
      {
        token: 'QP-4822',
        centerCode: 'XRX-104',
        centerName: 'Campus Central Copy & Print',
        customerName: 'Priya Nair',
        customerPhone: '9820194421',
        files: [
          {
            id: 'seed-f2',
            name: 'Campus_ID_Scan.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 482000,
            detectedPages: 1,
            source: 'camera',
            scanFilter: 'high-contrast',
            previewUrl: null,
          },
        ],
        options: {
          colorMode: 'color',
          paperSize: 'A4',
          sides: 'single',
          pageRangeMode: 'all',
          customPageRange: '',
          orientation: 'portrait',
          pagesPerSheet: 1,
          paperStock: '100gsm',
          finishing: 'lamination',
          copies: 2,
          instructions: '',
        },
        pricing: {
          selectedPages: 1,
          effectiveSheetsPerCopy: 1,
          totalSheets: 2,
          printCost: 20,
          paperUpgradeCost: 3,
          finishingCost: 40,
          platformFee: 2,
          totalAmount: 65,
        },
        paymentMethod: 'upi',
        paymentStatus: 'paid',
        transactionId: 'UPI4822819930',
        status: 'ready',
        estimatedReadyAt: new Date(now - 30000).toISOString(),
        createdAt: new Date(now - 420000).toISOString(),
        updatedAt: new Date(now - 30000).toISOString(),
      },
    ],
  };
}

function readDb(): DatabaseSchema {
  ensureStorage();
  if (!fs.existsSync(DB_PATH)) {
    const seed = createSeedData();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw) as DatabaseSchema;
  } catch {
    const seed = createSeedData();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

function writeDb(data: DatabaseSchema): void {
  ensureStorage();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function parseCustomPageCount(rangeText: string, maxPages: number): number {
  if (!rangeText.trim() || maxPages <= 0) return maxPages;
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
  return pages.size > 0 ? pages.size : maxPages;
}

function calculateOrderPricing(
  totalDetectedPages: number,
  options: PrintOptionsRecord,
  rates: CenterRates
): OrderPricing {
  const safeTotalPages = Math.max(1, totalDetectedPages);
  let selectedPages = safeTotalPages;

  if (options.pageRangeMode === 'custom') {
    selectedPages = parseCustomPageCount(options.customPageRange, safeTotalPages);
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

  const subtotal = round2(printCost) + round2(paperUpgradeCost) + round2(finishingCost) + platformFee;

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

function saveDataUrlPreview(dataUrl: string): string | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const ext = match[2].toLowerCase() === 'jpeg' ? 'jpg' : match[2].toLowerCase();
  const buffer = Buffer.from(match[3], 'base64');
  if (buffer.byteLength > 10 * 1024 * 1024) return null;
  ensureStorage();
  const filename = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/api/uploads/${filename}`;
}

function generateUniqueToken(existingOrders: PrintOrder[]): string {
  const existing = new Set(existingOrders.map((o) => o.token));
  for (let i = 0; i < 50; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const candidate = `QP-${num}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `QP-${Date.now().toString().slice(-5)}`;
}

async function startServer(): Promise<void> {
  ensureStorage();
  const app = express();
  app.use(express.json({ limit: '45mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.get('/api/uploads/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Preview not found' });
      return;
    }
    res.sendFile(filePath);
  });

  app.get('/api/centers', (_req, res) => {
    const db = readDb();
    const enriched = db.centers.map((center) => {
      const activeJobs = db.orders.filter(
        (o) => o.centerCode === center.code && (o.status === 'queued' || o.status === 'printing')
      ).length;
      return {
        ...center,
        activeQueueCount: activeJobs,
        estimatedWaitMinutes: Math.max(1, Math.round((activeJobs + 1) * center.avgMinutesPerJob)),
      };
    });
    res.json({ centers: enriched });
  });

  app.get('/api/centers/:code', (req, res) => {
    const db = readDb();
    const lookup = req.params.code.trim().toUpperCase();
    const center = db.centers.find((c) => c.code.toUpperCase() === lookup);
    if (!center) {
      res.status(404).json({ error: `No Xerox center found for code ${lookup}` });
      return;
    }
    const activeJobs = db.orders.filter(
      (o) => o.centerCode === center.code && (o.status === 'queued' || o.status === 'printing')
    ).length;
    res.json({
      center: {
        ...center,
        activeQueueCount: activeJobs,
        estimatedWaitMinutes: Math.max(1, Math.round((activeJobs + 1) * center.avgMinutesPerJob)),
      },
    });
  });

  app.post('/api/centers', (req, res) => {
    const db = readDb();
    const body = req.body as {
      code?: string;
      name?: string;
      area?: string;
      address?: string;
      hours?: string;
      upiId?: string;
      bwPerPage?: number;
      colorPerPage?: number;
      printersOnline?: number;
    };

    if (!body.name || !body.area) {
      res.status(400).json({ error: 'Shop name and area are required.' });
      return;
    }

    let code = (body.code || '').trim().toUpperCase();
    if (!code) {
      const existingCodes = new Set(db.centers.map((c) => c.code.toUpperCase()));
      do {
        code = `XRX-${Math.floor(400 + Math.random() * 599)}`;
      } while (existingCodes.has(code));
    }

    if (db.centers.some((c) => c.code.toUpperCase() === code)) {
      res.status(409).json({ error: `Center code ${code} is already registered.` });
      return;
    }

    const newCenter: XeroxCenter = {
      code,
      name: body.name.trim(),
      area: body.area.trim(),
      address: (body.address || body.area).trim(),
      hours: (body.hours || '08:00 AM – 09:30 PM').trim(),
      upiId: (body.upiId || `${code.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`).trim(),
      printersOnline: Math.max(1, Number(body.printersOnline) || 2),
      avgMinutesPerJob: 2,
      acceptingOrders: true,
      rates: {
        ...DEFAULT_RATES,
        bwPerPage: Math.max(0.5, Number(body.bwPerPage) || DEFAULT_RATES.bwPerPage),
        colorPerPage: Math.max(1, Number(body.colorPerPage) || DEFAULT_RATES.colorPerPage),
      },
      createdAt: new Date().toISOString(),
    };

    db.centers.push(newCenter);
    writeDb(db);
    res.status(201).json({
      center: {
        ...newCenter,
        activeQueueCount: 0,
        estimatedWaitMinutes: 2,
      },
    });
  });

  app.get('/api/centers/:code/orders', (req, res) => {
    const db = readDb();
    const lookup = req.params.code.trim().toUpperCase();
    const center = db.centers.find((c) => c.code.toUpperCase() === lookup);
    if (!center) {
      res.status(404).json({ error: `Center ${lookup} not found.` });
      return;
    }
    const orders = db.orders
      .filter((o) => o.centerCode.toUpperCase() === lookup)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalRevenue = orders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((acc, o) => acc + o.pricing.totalAmount, 0);
    const totalSheetsPrinted = orders
      .filter((o) => o.status === 'ready' || o.status === 'collected')
      .reduce((acc, o) => acc + o.pricing.totalSheets, 0);

    res.json({
      center,
      orders,
      summary: {
        totalOrders: orders.length,
        queuedCount: orders.filter((o) => o.status === 'queued').length,
        printingCount: orders.filter((o) => o.status === 'printing').length,
        readyCount: orders.filter((o) => o.status === 'ready').length,
        collectedCount: orders.filter((o) => o.status === 'collected').length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSheetsPrinted,
      },
    });
  });

  app.post('/api/orders', (req, res) => {
    const db = readDb();
    const body = req.body as {
      centerCode?: string;
      customerName?: string;
      customerPhone?: string;
      files?: Array<{
        id?: string;
        name: string;
        mimeType: string;
        sizeBytes: number;
        detectedPages: number;
        source: 'upload' | 'camera';
        scanFilter?: 'original' | 'bw-scan' | 'high-contrast';
        previewDataUrl?: string | null;
      }>;
      options?: PrintOptionsRecord;
      paymentMethod?: 'upi' | 'card' | 'counter';
      transactionId?: string | null;
    };

    const lookup = (body.centerCode || '').trim().toUpperCase();
    const center = db.centers.find((c) => c.code.toUpperCase() === lookup);
    if (!center) {
      res.status(400).json({ error: 'Valid Xerox Center Code ID is required.' });
      return;
    }
    if (!body.files || body.files.length === 0) {
      res.status(400).json({ error: 'At least one document or captured photo is required.' });
      return;
    }
    if (!body.options) {
      res.status(400).json({ error: 'Print configuration options are required.' });
      return;
    }

    const storedFiles: PrintFileRecord[] = body.files.map((f, index) => {
      const previewUrl = f.previewDataUrl ? saveDataUrlPreview(f.previewDataUrl) : null;
      return {
        id: f.id || `file-${Date.now()}-${index}`,
        name: f.name || `Document_${index + 1}`,
        mimeType: f.mimeType || 'application/octet-stream',
        sizeBytes: Number(f.sizeBytes) || 0,
        detectedPages: Math.max(1, Number(f.detectedPages) || 1),
        source: f.source === 'camera' ? 'camera' : 'upload',
        scanFilter: f.scanFilter || 'original',
        previewUrl,
      };
    });

    const totalDetectedPages = storedFiles.reduce((sum, f) => sum + f.detectedPages, 0);
    const pricing = calculateOrderPricing(totalDetectedPages, body.options, center.rates);
    const activeAhead = db.orders.filter(
      (o) => o.centerCode === center.code && (o.status === 'queued' || o.status === 'printing')
    ).length;

    const paymentMethod = body.paymentMethod || 'upi';
    const paymentStatus = paymentMethod === 'counter' ? 'pending_counter' : 'paid';
    const token = generateUniqueToken(db.orders);
    const now = Date.now();
    const etaMinutes = Math.max(1, Math.round((activeAhead + 1) * center.avgMinutesPerJob));

    const order: PrintOrder = {
      token,
      centerCode: center.code,
      centerName: center.name,
      customerName: (body.customerName || 'Walk-in Customer').trim() || 'Walk-in Customer',
      customerPhone: (body.customerPhone || '').trim(),
      files: storedFiles,
      options: body.options,
      pricing,
      paymentMethod,
      paymentStatus,
      transactionId:
        paymentStatus === 'paid'
          ? body.transactionId || `${paymentMethod.toUpperCase()}${Math.floor(10000000 + Math.random() * 89999999)}`
          : null,
      status: 'queued',
      estimatedReadyAt: new Date(now + etaMinutes * 60000).toISOString(),
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };

    db.orders.unshift(order);
    writeDb(db);

    res.status(201).json({ order });
  });

  app.get('/api/orders/:token', (req, res) => {
    const db = readDb();
    const lookup = req.params.token.trim().toUpperCase();
    const order = db.orders.find((o) => o.token.toUpperCase() === lookup);
    if (!order) {
      res.status(404).json({ error: `Order token ${lookup} not found.` });
      return;
    }
    const queueAhead = db.orders.filter(
      (o) =>
        o.centerCode === order.centerCode &&
        (o.status === 'queued' || o.status === 'printing') &&
        new Date(o.createdAt).getTime() < new Date(order.createdAt).getTime()
    ).length;

    res.json({ order, queueAhead });
  });

  app.patch('/api/orders/:token/status', (req, res) => {
    const db = readDb();
    const lookup = req.params.token.trim().toUpperCase();
    const index = db.orders.findIndex((o) => o.token.toUpperCase() === lookup);
    if (index === -1) {
      res.status(404).json({ error: `Order token ${lookup} not found.` });
      return;
    }

    const body = req.body as {
      status?: 'queued' | 'printing' | 'ready' | 'collected';
      paymentStatus?: 'paid' | 'pending_counter';
    };

    const current = db.orders[index];
    if (body.status && ['queued', 'printing', 'ready', 'collected'].includes(body.status)) {
      current.status = body.status;
    }
    if (body.paymentStatus && ['paid', 'pending_counter'].includes(body.paymentStatus)) {
      current.paymentStatus = body.paymentStatus;
      if (body.paymentStatus === 'paid' && !current.transactionId) {
        current.transactionId = `CTR${Math.floor(10000000 + Math.random() * 89999999)}`;
      }
    }
    current.updatedAt = new Date().toISOString();
    db.orders[index] = current;
    writeDb(db);

    res.json({ order: current });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuickPress server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start QuickPress server:', err);
  process.exit(1);
});
