/**
 * Pure Node.js PDF text extractor
 * Uses pdf-parse core engine directly without triggering debug root module
 */
const pdfParseCore = require('pdf-parse/lib/pdf-parse.js');

/**
 * Extracts clean, full human-readable plain text from a PDF Buffer or Uint8Array.
 */
export async function extractTextFromPdfBuffer(data: Buffer | Uint8Array): Promise<string> {
  try {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = await pdfParseCore(buffer);
    
    if (result && typeof result.text === 'string' && result.text.trim().length > 0) {
      return result.text.trim();
    }
    
    return '';
  } catch (err: any) {
    console.error('Error extracting text from PDF:', err);
    throw new Error(`Failed to parse PDF document: ${err.message || 'Corrupt or unreadable PDF structure'}`);
  }
}
