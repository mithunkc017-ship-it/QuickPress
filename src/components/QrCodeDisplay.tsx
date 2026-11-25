import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

export function QrCodeDisplay({
  value,
  size = 180,
  alt = 'Scannable QR Code',
  className = '',
  darkColor = '#0F172A',
  lightColor = '#FFFFFF',
}: QrCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size, darkColor, lightColor]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-500 ${className}`}
      >
        Generating QR...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      referrerPolicy="no-referrer"
      className={`block select-none ${className}`}
    />
  );
}
