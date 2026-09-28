process.env.APP_ENV = 'development';
process.env.NODE_ENV = 'development';

import fs from 'fs';
import { createSessionToken } from '../src/lib/auth';

async function main() {
  const token = await createSessionToken({
    userId: 'usr_merchant_01',
    email: 'merchant@shopmate.com',
    workspaceId: 'ws_acme_corp'
  });

  const pdfPath = 'C:/Users/91730/Downloads/BrightForge_Internal_Company_Operations_SOP_Premium.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF file not found');
    return;
  }

  const fileBuffer = fs.readFileSync(pdfPath);
  const blob = new Blob([fileBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'BrightForge_Internal_Company_Operations_SOP_Premium.pdf');
  formData.append('name', 'BrightForge Internal Company Operations SOP Manual');
  formData.append('type', 'PDF');

  console.log('Sending multipart/form-data POST to /api/knowledge...');
  const res = await fetch('http://localhost:3000/api/knowledge', {
    method: 'POST',
    headers: {
      'Cookie': `aaas_session_token=${token}`
    },
    body: formData
  });

  console.log('HTTP Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);
}

main();
