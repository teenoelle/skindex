import XLSX from 'xlsx';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', '_reference', 'skindex-production.xlsx');

const wb = XLSX.readFile(filePath);
console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n=== Sheet: "${sheetName}" ===`);
  console.log('Headers (row 1):', rows[0]);
  console.log('Row 2:', rows[1]);
  console.log('Row 3:', rows[2]);
  console.log('Total rows:', rows.length);
}
