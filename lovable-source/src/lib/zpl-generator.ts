import { toast } from 'sonner';

// ============================================================
// ZPL LABEL GENERATOR FOR ZEBRA LP 2824 PLUS (203 DPI, 2" x 1")
// ============================================================

/**
 * ZPL Generator for Rolliworks label printing
 * Target printer: Zebra LP 2824 Plus
 * Label size: 2" x 1" (406 x 203 dots at 203 DPI)
 * Print width: 406 dots (2 inches)
 * Label length: 203 dots (1 inch)
 */

// Base dimensions for 2" x 1" label at 203 DPI
const LABEL_WIDTH = 406; // dots
const LABEL_HEIGHT = 203; // dots

// ZPL header with proper label dimensions
const ZPL_HEADER = `^XA
 ^PW${LABEL_WIDTH}
 ^LL${LABEL_HEIGHT}`;

const ZPL_FOOTER = `^XZ`;

// ============================================================
// LOCATION LABELS
// ============================================================

export interface LocationLabelData {
  storeName: string; // "Store 01" or "Store 02"
  locationName: string;
  barcodeValue: string; // S01-LOC-XXXX or S02-LOC-XXXX
}

export function generateLocationLabelZPL(data: LocationLabelData): string {
  return `${ZPL_HEADER}
 ^CF0,22
 ^FO20,15^FD${data.storeName}^FS
 ^CF0,18
 ^FO20,42^FD${data.locationName}^FS
 ^BY2
 ^FO20,70^BCN,80,Y,N,N
 ^FD${data.barcodeValue}^FS
 ${ZPL_FOOTER}`;
}

// ============================================================
// PART LABELS
// ============================================================

export interface PartLabelData {
  partNumber: string;
  description: string;
  line2?: string; // Optional second description line
}

export function generatePartLabelZPL(data: PartLabelData): string {
  // Truncate description to fit label
  const desc1 = data.description.substring(0, 35);
  const desc2 = data.line2 ? data.line2.substring(0, 35) : '';

  // Layout: Barcode at top with part number, then description below
  return `${ZPL_HEADER}
 ^BY2
 ^FO50,20^BCN,100,Y,N,N
 ^FD${data.partNumber}^FS
 ^CF0,20
 ^FO20,140^FD${desc1}^FS
 ${desc2 ? `^CF0,18\n^FO20,165^FD${desc2}^FS` : ''}
 ${ZPL_FOOTER}`;
}

// ============================================================
// INTAKE PART LABELS (for client watch intake)
// Format: Row1=barcode, Row2=partNumber, Row3=date^model^lastName^estimateNumber
// ============================================================

export interface IntakePartLabelData {
  partNumber: string;
  date: string; // YYYY-MM-DD format
  model: string;
  lastName: string;
  estimateNumber: string;
}

export function generateIntakePartLabelZPL(data: IntakePartLabelData): string {
  const line3 = [data.date, data.model, data.lastName, data.estimateNumber]
    .filter(Boolean)
    .join('^');

  return `${ZPL_HEADER}
 ^BY2
 ^FO50,10^BCN,80,N,N,N
 ^FD${data.partNumber}^FS
 ^CF0,22
 ^FO20,100^FD${data.partNumber}^FS
 ^CF0,18
 ^FO20,130^FD${line3.substring(0, 40)}^FS
 ${ZPL_FOOTER}`;
}

// ============================================================
// CLIENT WATCH LABELS
// ============================================================

export interface ClientWatchLabelData {
  jobId: string;
  brand: string;
  serialNumber: string; // FULL serial - no masking
  watchTagNumber: string; // Barcode value
}

export function generateClientWatchLabelZPL(data: ClientWatchLabelData): string {
  return `${ZPL_HEADER}
 ^CF0,24
 ^FO20,12^FDJob: ${data.jobId}^FS
 ^CF0,18
 ^FO20,42^FD${data.brand} ${data.serialNumber}^FS
 ^BY2
 ^FO20,75^BCN,80,Y,N,N
 ^FD${data.watchTagNumber}^FS
 ${ZPL_FOOTER}`;
}

// ============================================================
// QR CODE LABELS (caret-delimited format for LP2824)
// Format: full_name^email^phone^part_number^date^brand^model^estimate_number
// ============================================================

export interface QRLabelData {
  fullName: string;
  email: string;
  phone: string;
  partNumber: string;
  date: string; // YYYY-MM-DD format
  brand: string;
  model: string;
  estimateNumber: string;
}

export function generateQRLabelZPL(data: QRLabelData): string {
  // Format QR data as caret-delimited string
  const qrText = [
    data.fullName,
    data.email,
    data.phone,
    data.partNumber,
    data.date,
    data.brand,
    data.model,
    data.estimateNumber,
  ].join('^');

  return `${ZPL_HEADER}
 ^CF0,16
 ^FO130,15^FD${data.fullName.substring(0, 18)}^FS
 ^FO130,35^FD${data.estimateNumber}^FS
 ^FO130,55^FD${data.brand} ${data.model}^FS
 ^BQN,2,4
 ^FO15,15^FDLA,${qrText}^FS
 ${ZPL_FOOTER}`;
}

// ============================================================
// INTAKE CONFIRMATION LABEL (with customer number barcode)
// ============================================================

export interface IntakeConfirmationLabelData {
  customerNumber: string; // Barcode value
  customerName: string;
  estimateNumber: string;
  dateIn: string;
  watchRef?: string;
}

export function generateIntakeConfirmationLabelZPL(data: IntakeConfirmationLabelData): string {
  return `${ZPL_HEADER}
 ^CF0,22
 ^FO20,10^FD${data.customerName.substring(0, 25)}^FS
 ^CF0,18
 ^FO20,38^FD${data.estimateNumber} | ${data.dateIn}^FS
 ${data.watchRef ? `^FO20,60^FD${data.watchRef}^FS` : ''}
 ^BY2
 ^FO50,85^BCN,70,Y,N,N
 ^FD${data.customerNumber}^FS
 ${ZPL_FOOTER}`;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Combine multiple ZPL labels into a single print job
 */
export function combineLabels(labels: string[]): string {
  return labels.join('\n');
}

/**
 * Repeat a label multiple times
 */
export function repeatLabel(zpl: string, count: number): string {
  return Array(count).fill(zpl).join('\n');
}

/**
 * Normalize ZPL so commands are at the start of each line.
 *
 * Template strings often introduce leading indentation; some Zebra printers
 * are picky about that and will silently ignore the job.
 */
function normalizeZpl(zpl: string): string {
  return zpl.replace(/^\s+/gm, '').trim() + '\n';
}

// ============================================================
// ZEBRA BROWSER PRINT INTEGRATION
// ============================================================

declare global {
  interface Window {
    BrowserPrint?: {
      getDefaultDevice: (
        type: string,
        successCallback: (device: ZebraPrinter) => void,
        errorCallback: (error: string) => void
      ) => void;
      getLocalDevices: (
        successCallback: (devices: { printer?: ZebraPrinter[] }) => void,
        errorCallback: (error: string) => void,
        type?: string
      ) => void;
    };
  }
}

interface ZebraPrinter {
  name: string;
  deviceType: string;
  connection: string;
  uid: string;
  send: (data: string, successCallback?: () => void, errorCallback?: (error: string) => void) => void;
  read: (successCallback: (data: string) => void, errorCallback: (error: string) => void) => void;
}

let cachedPrinter: ZebraPrinter | null = null;

/**
 * Check if Zebra Browser Print is available
 */
export function isBrowserPrintAvailable(): boolean {
  const available = !!window.BrowserPrint?.getDefaultDevice;
  console.log('[ZPL] BrowserPrint available:', available, 'window.BrowserPrint:', window.BrowserPrint);
  return available;
}

/**
 * Get available printers via Browser Print SDK
 */
export function getAvailablePrinters(): Promise<ZebraPrinter[]> {
  return new Promise((resolve, reject) => {
    if (!window.BrowserPrint) {
      reject(new Error('Zebra Browser Print not loaded'));
      return;
    }

    console.log('[ZPL] Calling BrowserPrint.getLocalDevices...');
    window.BrowserPrint.getLocalDevices(
      (devices: { printer?: ZebraPrinter[] }) => {
        console.log('[ZPL] getLocalDevices result:', devices);
        const printers = devices?.printer || [];
        resolve(printers);
      },
      (error: string) => {
        console.error('[ZPL] getLocalDevices error:', error);
        reject(new Error(`Failed to list printers: ${error}`));
      },
      'printer'
    );
  });
}

/**
 * Get the default Zebra printer via Browser Print SDK
 * Falls back to first available printer if no default is set
 */
export function getZebraPrinter(): Promise<ZebraPrinter> {
  return new Promise((resolve, reject) => {
    if (cachedPrinter) {
      console.log('[ZPL] Using cached printer:', cachedPrinter.name);
      resolve(cachedPrinter);
      return;
    }

    if (!window.BrowserPrint) {
      console.error('[ZPL] window.BrowserPrint is undefined - SDK not loaded');
      reject(new Error('Zebra Browser Print not installed or not loaded'));
      return;
    }

    console.log('[ZPL] Calling BrowserPrint.getDefaultDevice...');
    window.BrowserPrint.getDefaultDevice(
      'printer',
      async (device) => {
        console.log('[ZPL] getDefaultDevice success, device:', device);
        if (device && device.uid) {
          cachedPrinter = device;
          resolve(device);
        } else {
          // No default set - try to get first available printer
          console.log('[ZPL] No default printer, trying getLocalDevices...');
          try {
            const printers = await getAvailablePrinters();
            if (printers.length > 0) {
              console.log('[ZPL] Found printer via getLocalDevices:', printers[0].name);
              cachedPrinter = printers[0];
              resolve(printers[0]);
            } else {
              reject(new Error('No Zebra printers found. Is the printer connected and powered on?'));
            }
          } catch (err) {
            reject(new Error('No Zebra printer found. Check connection and Browser Print service.'));
          }
        }
      },
      async (error) => {
        console.error('[ZPL] getDefaultDevice error:', error);
        // Error getting default - try listing all printers
        console.log('[ZPL] Trying getLocalDevices as fallback...');
        try {
          const printers = await getAvailablePrinters();
          if (printers.length > 0) {
            console.log('[ZPL] Found printer via fallback:', printers[0].name);
            cachedPrinter = printers[0];
            resolve(printers[0]);
          } else {
            reject(new Error('No Zebra printers detected. Ensure printer is connected and Browser Print service is running.'));
          }
        } catch (err) {
          reject(new Error(`Browser Print error: ${error || 'Service not responding'}`));
        }
      }
    );
  });
}

/**
 * Print ZPL using Zebra Browser Print SDK (for USB printers)
 */
export async function printZPLViaBrowserPrint(zpl: string): Promise<boolean> {
  try {
    console.log('[ZPL] printZPLViaBrowserPrint called, zpl length:', zpl.length);
    const printer = await getZebraPrinter();
    console.log('[ZPL] Got printer, sending ZPL to:', printer.name, 'connection:', printer.connection);
    return await new Promise((resolve) => {
      printer.send(
        zpl,
        () => {
          console.log('[ZPL] Send success!');
          resolve(true);
        },
        (error) => {
          console.error('[ZPL] Browser Print send error:', error);
          resolve(false);
        }
      );
    });
  } catch (error) {
    console.error('[ZPL] Browser Print error:', error);
    return false;
  }
}

/**
 * Print ZPL directly to a network-connected Zebra printer
 * Sends raw ZPL via HTTP POST to the printer's print endpoint
 */
export async function printZPLToNetwork(zpl: string, printerIp: string): Promise<boolean> {
  try {
    const url = `http://${printerIp}/pstprnt`;
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      body: zpl,
    });
    return true;
  } catch (error) {
    console.error('Failed to print to Zebra printer:', error);
    return false;
  }
}

/**
 * Main print function - tries Browser Print first, then network, then download
 */
export async function printZPL(zpl: string): Promise<void> {
  const normalized = normalizeZpl(zpl);
  console.log('[ZPL] printZPL called. Normalized ZPL:\n', normalized.substring(0, 200) + '...');

  // Try Zebra Browser Print first (for USB printers)
  const bpAvailable = isBrowserPrintAvailable();
  console.log('[ZPL] Browser Print available:', bpAvailable);
  
  if (bpAvailable) {
    const success = await printZPLViaBrowserPrint(normalized);
    console.log('[ZPL] printZPLViaBrowserPrint result:', success);
    if (success) {
      toast.success('Label sent to Zebra printer');
      console.log('[ZPL] Label printed via Zebra Browser Print');
      return;
    }
  }

  // Try network printing if IP is configured
  const printerIp = localStorage.getItem('zebra_printer_ip');
  if (printerIp) {
    const success = await printZPLToNetwork(normalized, printerIp);
    if (success) {
      toast.success('Label sent to network printer');
      console.log('Label printed to network printer');
      return;
    }
  }

  // Fallback: download ZPL file
  if (!isBrowserPrintAvailable()) {
    toast.error('USB printing requires Zebra Browser Print. Install it and refresh the page.', {
      duration: 8000,
    });
  } else {
    toast.error(
      'Zebra Browser Print service not responding. Start the service (check system tray) and refresh.',
      { duration: 8000 }
    );
  }

  toast.info('Downloading .zpl file - copy contents to printer manually');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  downloadZPL(normalized, `label-${timestamp}.zpl`);
  console.log('[ZPL] ZPL file downloaded - Zebra Browser Print service is not running or not responding');
}

/**
 * Download ZPL as a file for manual printing
 */
export function downloadZPL(zpl: string, filename: string = 'label.zpl'): void {
  const normalized = normalizeZpl(zpl);
  const blob = new Blob([normalized], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

