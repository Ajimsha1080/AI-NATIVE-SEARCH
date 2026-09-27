/**
 * Automated Security & Mock-Free Codebase Scanner
 * Fails the build if any hardcoded API key fallbacks, raw credentials, or fake mock indicators are detected.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_DIRS = ['src', 'python-backend'];
const IGNORED_FILES = [
  path.join(ROOT_DIR, 'src', 'lib', 'db', 'seed.ts'), // Database seed records
];

// Patterns that indicate secrets or fake fallback mocks
const BANNED_PATTERNS = [
  {
    regex: /\|\|\s*['"`](sk_|rzp_|shpat_|shpst_|shpss_|cs_|ck_|whsec_|pk_)/i,
    description: 'Hardcoded API secret fallback literal (e.g. process.env.KEY || "sk_...")'
  },
  {
    regex: /REDACTED_SECRET/i,
    description: 'Exposed Sarvam AI API key'
  },
  {
    regex: /mock data if/i,
    description: 'Mock data fallback indicator in production code'
  },
  {
    regex: /Math\.random\(\)\s*\*\s*\d+\s*\+\s*\d+.*latency/i,
    description: 'Fabricated random latency generator'
  }
];

let violations = [];

function scanFile(filePath) {
  if (IGNORED_FILES.some(ignored => path.resolve(filePath) === path.resolve(ignored))) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: path.relative(ROOT_DIR, filePath),
          line: index + 1,
          description: pattern.description,
          snippet: line.trim()
        });
      }
    }
  });
}

function traverseDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '__pycache__') {
        traverseDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx', '.py', '.json'].includes(ext)) {
        scanFile(fullPath);
      }
    }
  }
}

console.log('🔒 Starting Security & Mock-Free Codebase Audit...\n');

for (const dir of TARGET_DIRS) {
  traverseDirectory(path.join(ROOT_DIR, dir));
}

if (violations.length > 0) {
  console.error(`❌ FAILED: Found ${violations.length} security / mock data violation(s):\n`);
  violations.forEach((v, i) => {
    console.error(`[${i + 1}] ${v.file}:${v.line}`);
    console.error(`    Issue:   ${v.description}`);
    console.error(`    Snippet: ${v.snippet}\n`);
  });
  process.exit(1);
} else {
  console.log('✅ PASSED: Zero secret fallbacks or fabricated mock indicators detected.');
  process.exit(0);
}
