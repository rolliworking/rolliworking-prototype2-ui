import { forwardRef } from 'react';

interface BarcodeLabelProps {
  code: string;
  title?: string;
  subtitle?: string;
  additionalInfo?: string[];
  size?: 'small' | 'medium' | 'large';
}

export const BarcodeLabel = forwardRef<HTMLDivElement, BarcodeLabelProps>(
  ({ code, title, subtitle, additionalInfo = [], size = 'medium' }, ref) => {
    const sizeClasses = {
      small: 'w-[2in] p-2',
      medium: 'w-[3in] p-3',
      large: 'w-[4in] p-4',
    };

    const fontSizes = {
      small: { title: 'text-xs', code: 'text-2xl', subtitle: 'text-[10px]' },
      medium: { title: 'text-sm', code: 'text-3xl', subtitle: 'text-xs' },
      large: { title: 'text-base', code: 'text-4xl', subtitle: 'text-sm' },
    };

    return (
      <div ref={ref} className={`border border-dashed border-gray-400 ${sizeClasses[size]} print:border-solid`}>
        {title && (
          <div className={`font-bold font-mono ${fontSizes[size].title} mb-1`}>{title}</div>
        )}
        
        {/* Barcode representation using Code 128 font styling */}
        <div 
          className={`text-center ${fontSizes[size].code} font-mono tracking-widest`}
          style={{ fontFamily: "'Libre Barcode 128', monospace" }}
        >
          *{code}*
        </div>
        
        {/* Human readable code */}
        <div className={`text-center ${fontSizes[size].subtitle} font-mono mt-1`}>
          {code}
        </div>
        
        {subtitle && (
          <div className={`${fontSizes[size].subtitle} text-gray-600 mt-1 truncate`}>
            {subtitle}
          </div>
        )}
        
        {additionalInfo.map((info, i) => (
          <div key={i} className={`${fontSizes[size].subtitle} text-gray-500`}>
            {info}
          </div>
        ))}
      </div>
    );
  }
);

BarcodeLabel.displayName = 'BarcodeLabel';

interface QRLabelProps {
  data: string;
  title?: string;
  subtitle?: string;
  additionalInfo?: string[];
  size?: 'small' | 'medium' | 'large';
}

export const QRLabel = forwardRef<HTMLDivElement, QRLabelProps>(
  ({ data, title, subtitle, additionalInfo = [], size = 'medium' }, ref) => {
    const sizeClasses = {
      small: 'w-[2in] p-2',
      medium: 'w-[3in] p-3',
      large: 'w-[4in] p-4',
    };

    const qrSizes = {
      small: 'w-12 h-12',
      medium: 'w-16 h-16',
      large: 'w-20 h-20',
    };

    const fontSizes = {
      small: { title: 'text-xs', subtitle: 'text-[10px]' },
      medium: { title: 'text-sm', subtitle: 'text-xs' },
      large: { title: 'text-base', subtitle: 'text-sm' },
    };

    return (
      <div ref={ref} className={`border border-dashed border-gray-400 ${sizeClasses[size]} flex gap-3 print:border-solid`}>
        {/* QR Code placeholder */}
        <div 
          className={`${qrSizes[size]} border-2 border-black flex items-center justify-center shrink-0`}
          title={data}
        >
          <div className="text-[8px] text-center text-gray-500">QR</div>
        </div>
        
        <div className="flex-1 min-w-0">
          {title && (
            <div className={`font-bold ${fontSizes[size].title} truncate`}>{title}</div>
          )}
          {subtitle && (
            <div className={`${fontSizes[size].subtitle} text-gray-600 truncate`}>{subtitle}</div>
          )}
          {additionalInfo.map((info, i) => (
            <div key={i} className={`${fontSizes[size].subtitle} text-gray-500 truncate`}>
              {info}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

QRLabel.displayName = 'QRLabel';
