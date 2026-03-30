// ZPL Label Generation for Zebra LP 2824 (2" x 1" labels, 203 DPI)

// Label dimensions at 203 DPI
const LABEL_WIDTH = 406; // 2 inches * 203 DPI
const LABEL_HEIGHT = 203; // 1 inch * 203 DPI

interface LocationLabelData {
  storeCode: string; // S01, S02
  storeName: string;
  locationName: string;
  locationCode: string; // S01-LOC-XXXX
}

interface PartLabelData {
  partNumber: string;
  description: string;
  bin?: string;
}

interface ClientWatchLabelData {
  watchTagNumber: string;
  jobId: string;
  brand: string;
  serialNumber: string;
}

interface QRLabelData {
  name: string;
  email: string;
  phone: string;
  watchRef?: string;
  watchSerial?: string;
  dateIn: string;
  estimateNo?: string;
  serviceCodes: string[];
}

// Generate ZPL for CODE128 barcode
function generateCode128(value: string, x: number, y: number, height: number = 50): string {
  return `^FO${x},${y}^BY2^BCN,${height},Y,N,N^FD${value}^FS`;
}

// Generate ZPL for text
function generateText(text: string, x: number, y: number, fontSize: 'small' | 'medium' | 'large' = 'medium'): string {
  const fontSizes = {
    small: 'A0N,18,18',
    medium: 'A0N,24,24',
    large: 'A0N,32,32',
  };
  return `^FO${x},${y}^${fontSizes[fontSize]}^FD${text}^FS`;
}

// Generate ZPL for QR code
function generateQRCode(data: string, x: number, y: number, magnification: number = 3): string {
  return `^FO${x},${y}^BQN,2,${magnification}^FDQA,${data}^FS`;
}

// Location Label ZPL
export function generateLocationLabelZPL(data: LocationLabelData): string {
  const barcodeValue = data.locationCode;
  
  return `
^XA
^CF0,30
${generateText(data.storeName, 10, 10, 'large')}
${generateText(data.locationName, 10, 50, 'medium')}
${generateCode128(barcodeValue, 10, 90, 60)}
^XZ
`.trim();
}

// Part Label ZPL
export function generatePartLabelZPL(data: PartLabelData): string {
  // Truncate description if too long
  const desc1 = data.description.substring(0, 30);
  const desc2 = data.description.length > 30 ? data.description.substring(30, 60) : '';
  
  return `
^XA
^CF0,24
${generateCode128(data.partNumber, 10, 10, 50)}
${generateText(desc1, 10, 120, 'small')}
${desc2 ? generateText(desc2, 10, 145, 'small') : ''}
${data.bin ? generateText(`Bin: ${data.bin}`, 10, 175, 'small') : ''}
^XZ
`.trim();
}

// Client Watch Label ZPL
export function generateClientWatchLabelZPL(data: ClientWatchLabelData): string {
  return `
^XA
^CF0,24
${generateCode128(data.watchTagNumber, 10, 10, 50)}
${generateText(data.jobId, 10, 120, 'medium')}
${generateText(`${data.brand} - ${data.serialNumber}`, 10, 150, 'small')}
^XZ
`.trim();
}

// QR Label with customer/watch info
export function generateQRLabelZPL(data: QRLabelData): string {
  // Build QR data as plain text with labels on each line
  const qrContent = [
    `NAME:${data.name}`,
    `EMAIL:${data.email}`,
    `PHONE:${data.phone}`,
    `WATCH_REF:${data.watchRef || ''}`,
    `WATCH_SERIAL:${data.watchSerial || ''}`,
    `DATE_IN:${data.dateIn}`,
    `ESTIMATE_NO:${data.estimateNo || ''}`,
    `SERVICE_CODES:${data.serviceCodes.join(',')}`,
  ].join('\n');
  
  return `
^XA
${generateQRCode(qrContent, 10, 10, 4)}
${generateText(data.name, 180, 20, 'small')}
${generateText(data.watchRef || '', 180, 45, 'small')}
${generateText(data.dateIn, 180, 70, 'small')}
^XZ
`.trim();
}

// Intake Confirmation Label with barcode (customer number)
export function generateIntakeConfirmationLabelZPL(data: {
  customerNumber: string;
  customerName: string;
  estimateNumber: string;
  dateIn: string;
  watchRef?: string;
}): string {
  return `
^XA
^CF0,24
${generateText(data.customerName, 10, 10, 'medium')}
${generateText(`Est: ${data.estimateNumber}`, 10, 40, 'small')}
${generateText(`Date In: ${data.dateIn}`, 10, 65, 'small')}
${data.watchRef ? generateText(data.watchRef, 10, 90, 'small') : ''}
${generateCode128(data.customerNumber, 10, 120, 50)}
^XZ
`.trim();
}

// Print ZPL to browser (opens print dialog with ZPL content)
export function printZPL(zpl: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print labels');
    return;
  }

  // Create a page that triggers print dialog
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Label</title>
      <style>
        body {
          font-family: monospace;
          white-space: pre-wrap;
          padding: 20px;
        }
        .instructions {
          background: #f0f0f0;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .zpl-content {
          background: #fff;
          border: 1px solid #ccc;
          padding: 10px;
          font-size: 12px;
        }
        @media print {
          .instructions { display: none; }
          body { padding: 0; margin: 0; }
          .zpl-content { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="instructions">
        <strong>Zebra LP 2824 Label</strong><br>
        <p>Select your Zebra printer and print. The ZPL code below will be sent to the printer.</p>
        <button onclick="window.print()">Print Label</button>
        <button onclick="copyZPL()">Copy ZPL</button>
      </div>
      <div class="zpl-content" id="zpl">${zpl.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      <script>
        function copyZPL() {
          navigator.clipboard.writeText(document.getElementById('zpl').textContent);
          alert('ZPL copied to clipboard');
        }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Generate multiple labels at once
export function generateMultipleLabelsZPL(labels: string[]): string {
  return labels.join('\n');
}
