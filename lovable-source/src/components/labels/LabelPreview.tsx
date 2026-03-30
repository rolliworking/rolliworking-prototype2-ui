import { cn } from '@/lib/utils';
import type { 
  LocationLabelData, 
  PartLabelData, 
  ClientWatchLabelData, 
  IntakeConfirmationLabelData,
  QRLabelData,
  IntakePartLabelData,
} from '@/lib/zpl-generator';

interface LabelPreviewProps {
  type: 'location' | 'part' | 'watch' | 'intake' | 'qrcode' | 'intakePart';
  locationData?: LocationLabelData;
  partData?: PartLabelData;
  watchData?: ClientWatchLabelData;
  intakeData?: IntakeConfirmationLabelData;
  qrData?: QRLabelData;
  intakePartData?: IntakePartLabelData;
  className?: string;
}

// Simulated barcode component (CODE128 style bars)
function SimulatedBarcode({ value, className }: { value: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="flex h-8 items-end gap-px">
        {/* Generate pseudo-random bar pattern based on value */}
        {value.split('').map((char, i) => {
          const code = char.charCodeAt(0);
          const widths = [1, 2, 1, 3, 1, 2];
          return (
            <div key={i} className="flex gap-px">
              {widths.map((w, j) => (
                <div
                  key={j}
                  className={cn(
                    "bg-black h-full",
                    j % 2 === 0 ? "bg-black" : "bg-transparent"
                  )}
                  style={{ width: `${w}px`, height: `${24 + (code % 8)}px` }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <span className="text-[8px] font-mono mt-0.5 tracking-wider">{value}</span>
    </div>
  );
}

export function LabelPreview({ 
  type, 
  locationData, 
  partData, 
  watchData, 
  intakeData,
  qrData,
  intakePartData,
  className 
}: LabelPreviewProps) {
  // Label dimensions: 2" x 1" at 203 DPI = 406 x 203 dots
  // We'll use a 2:1 aspect ratio scaled preview
  
  return (
    <div className={cn("flex justify-center", className)}>
      <div 
        className="bg-white border-2 border-dashed border-muted-foreground/30 rounded-sm shadow-sm"
        style={{ width: '320px', height: '160px' }}
      >
        <div className="h-full w-full p-2 flex flex-col justify-center">
          {type === 'location' && locationData && (
            <LocationLabelContent data={locationData} />
          )}
          {type === 'part' && partData && (
            <PartLabelContent data={partData} />
          )}
          {type === 'watch' && watchData && (
            <WatchLabelContent data={watchData} />
          )}
          {type === 'intake' && intakeData && (
            <IntakeLabelContent data={intakeData} />
          )}
          {type === 'qrcode' && qrData && (
            <QRLabelContent data={qrData} />
          )}
          {type === 'intakePart' && intakePartData && (
            <IntakePartLabelContent data={intakePartData} />
          )}
        </div>
      </div>
    </div>
  );
}

function LocationLabelContent({ data }: { data: LocationLabelData }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span className="text-xs font-semibold text-black">{data.storeName}</span>
      <span className="text-lg font-bold text-black">{data.locationName || 'LOCATION'}</span>
      <SimulatedBarcode value={data.barcodeValue || 'S01-LOC-XXX'} />
    </div>
  );
}

function PartLabelContent({ data }: { data: PartLabelData }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <SimulatedBarcode value={data.partNumber || 'PART-XXX'} />
      <span className="text-sm font-semibold text-black text-center leading-tight">
        {data.description || 'Description'}
      </span>
      {data.line2 && (
        <span className="text-xs text-black/70 text-center">{data.line2}</span>
      )}
    </div>
  );
}

function WatchLabelContent({ data }: { data: ClientWatchLabelData }) {
  const serialLast6 = data.serialNumber?.slice(-6) || 'XXXXXX';
  
  return (
    <div className="flex flex-col h-full gap-0.5 px-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-black">Job: {data.jobId || 'EXXXX'}</span>
        <span className="text-xs font-semibold text-black">{data.brand || 'Brand'}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-black/70">Serial: ...{serialLast6}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <SimulatedBarcode value={data.watchTagNumber || 'TAG-XXX'} />
      </div>
    </div>
  );
}

function IntakeLabelContent({ data }: { data: IntakeConfirmationLabelData }) {
  const formattedDate = data.dateIn ? new Date(data.dateIn).toLocaleDateString() : 'MM/DD/YYYY';
  
  return (
    <div className="flex flex-col h-full gap-0.5 px-1">
      <div className="text-center">
        <span className="text-sm font-bold text-black">{data.customerName || 'Customer Name'}</span>
      </div>
      <div className="flex justify-between text-[10px] text-black/70">
        <span>Est: {data.estimateNumber || 'EST-XXX'}</span>
        <span>{formattedDate}</span>
      </div>
      {data.watchRef && (
        <span className="text-[10px] text-black/70 text-center">{data.watchRef}</span>
      )}
      <div className="flex-1 flex items-center justify-center">
        <SimulatedBarcode value={data.customerNumber || 'CUST-XXX'} />
      </div>
    </div>
  );
}

function QRLabelContent({ data }: { data: QRLabelData }) {
  const formattedDate = data.date ? new Date(data.date).toLocaleDateString() : '';
  
  return (
    <div className="flex h-full gap-1.5">
      {/* QR Code - maximized size */}
      <div className="flex items-center justify-center flex-shrink-0">
        <div className="w-[88px] h-[88px] border border-black/10 bg-white flex items-center justify-center">
          <div className="grid grid-cols-7 gap-[2px] w-[72px] h-[72px]">
            {[...Array(49)].map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-full h-full",
                  Math.random() > 0.4 ? "bg-black" : "bg-white"
                )} 
              />
            ))}
          </div>
        </div>
      </div>
      {/* Text content - right aligned */}
      <div className="flex-1 flex flex-col justify-center items-end text-right gap-0.5 text-black overflow-hidden pr-1">
        {data.fullName && <span className="text-[14px] font-bold leading-tight truncate max-w-full">{data.fullName}</span>}
        {data.email && <span className="text-[12px] truncate max-w-full">{data.email}</span>}
        {data.phone && <span className="text-[12px] truncate max-w-full">{data.phone}</span>}
        {data.partNumber && <span className="text-[12px] font-mono truncate max-w-full">{data.partNumber}</span>}
        {formattedDate && <span className="text-[12px] truncate max-w-full">{formattedDate}</span>}
        {(data.brand || data.model) && <span className="text-[12px] truncate max-w-full">{data.brand} {data.model}</span>}
        {data.estimateNumber && <span className="text-[12px] font-mono truncate max-w-full">{data.estimateNumber}</span>}
      </div>
    </div>
  );
}

function IntakePartLabelContent({ data }: { data: IntakePartLabelData }) {
  const line3 = [data.date, data.model, data.lastName, data.estimateNumber]
    .filter(Boolean)
    .join('^');
  
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1.5">
      <SimulatedBarcode value={data.partNumber || 'PART-XXX'} />
      <span className="text-base font-bold font-mono text-black text-center">
        {data.partNumber || 'Part #'}
      </span>
      <span className="text-xs text-black/80 text-center font-mono">
        {line3 || 'date^model^lastName^estimate'}
      </span>
    </div>
  );
}
