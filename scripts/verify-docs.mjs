#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const rootOnly = args.has('--root-only');

const errors = [];

function checkFileExists(relPath) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required file: ${relPath}`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function checkContainsAll(fileLabel, content, requiredTokens, categoryLabel) {
  if (!content) return;
  for (const token of requiredTokens) {
    if (!content.includes(token)) {
      errors.push(`${fileLabel} is missing ${categoryLabel}: "${token}"`);
    }
  }
}

function checkContainsNone(fileLabel, content, forbiddenTokens, reasonLabel) {
  if (!content) return;
  for (const token of forbiddenTokens) {
    if (content.includes(token)) {
      errors.push(`${fileLabel} contains forbidden ${reasonLabel}: "${token}"`);
    }
  }
}

function verifyRelativeMarkdownLinks(relFilePath, content, allowMissingDocsInRootMode = false) {
  if (!content) return;
  const fileDir = path.dirname(path.join(rootDir, relFilePath));
  const linkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const rawHref = match[1].trim().split(/\s+/)[0];
    if (
      !rawHref ||
      rawHref.startsWith('http://') ||
      rawHref.startsWith('https://') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('#') ||
      rawHref.startsWith('file://') ||
      rawHref.startsWith('conversation://')
    ) {
      continue;
    }
    const cleanHref = rawHref.split('#')[0];
    if (!cleanHref) continue;

    if (allowMissingDocsInRootMode && (cleanHref.startsWith('docs/') || cleanHref.startsWith('./docs/'))) {
      continue;
    }

    const resolvedPath = path.resolve(fileDir, cleanHref);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(`Broken relative link in ${relFilePath}: "${rawHref}" -> ${path.relative(rootDir, resolvedPath)} does not exist`);
    }
  }
}

// 1. Check Root Governance Files
const rootFiles = ['AGENTS.md', 'CONTEXT.md', 'design.md', 'DESIGN.md', 'PRODUCT.md'];
if (!rootOnly) {
  rootFiles.push('docs/README.md');
}

const fileContents = new Map();
for (const file of rootFiles) {
  const content = checkFileExists(file);
  if (content !== null) {
    fileContents.set(file, content);
  }
}

// 2. Verify CONTEXT.md Ubiquitous Language (20 core terms) & 9 Document Codes & State Machines
const requiredTerms = [
  'Property',
  'Building',
  'Floor',
  'UnitType',
  'Unit',
  'StayMode',
  'Customer',
  'Occupant',
  'Reservation',
  'Stay',
  'Folio',
  'Lease',
  'MeterReading',
  'Invoice',
  'Receipt',
  'CashierShift',
  'DepositLedger',
  'HousekeepingTask',
  'WorkOrder',
  'Parcel',
];

const requiredDocCodes = ['RES', 'STY', 'LSE', 'INV', 'RCT', 'DEP', 'SHF', 'WKO', 'PCL'];
const requiredForbiddenMentions = ['Branch', 'Hotel', 'RoomType', 'Booking', 'Contract'];

const contextContent = fileContents.get('CONTEXT.md');
checkContainsAll('CONTEXT.md', contextContent, requiredTerms, 'Ubiquitous Language term');
checkContainsAll('CONTEXT.md', contextContent, requiredDocCodes, 'Document Numbering prefix');
checkContainsAll('CONTEXT.md', contextContent, requiredForbiddenMentions, 'explicitly listed forbidden synonym');

// 3. Verify AGENTS.md and design.md follow Ollama Minimal Design System and (admin)/(client) separation
const ollamaTokens = ['#000000', '#ffffff', '#171717', '9999px', '12px', 'SF Pro Rounded'];
const scopeTokens = ['(admin)', '(client)', 'AdminScope', 'ClientScope'];

const designContent = fileContents.get('design.md');
checkContainsAll('design.md', designContent, ollamaTokens, 'Ollama Design System token');
checkContainsAll('design.md', designContent, ['shadcn/ui', 'FormTabs', 'useDeferredFileUpload'], 'UI architecture rule');
checkContainsNone('design.md', designContent, ['#0B3056'], 'legacy Navy color token');

const agentsContent = fileContents.get('AGENTS.md');
checkContainsAll('AGENTS.md', agentsContent, ollamaTokens, 'Ollama Design System token');
checkContainsAll('AGENTS.md', agentsContent, scopeTokens, 'Audience/Scope rule');
checkContainsNone('AGENTS.md', agentsContent, ['#0B3056'], 'legacy Navy color token');

// 4. Verify relative links in checked files
for (const [file, content] of fileContents.entries()) {
  verifyRelativeMarkdownLinks(file, content, rootOnly);
}

if (errors.length > 0) {
  console.error(`\n❌ Documentation verification FAILED (${errors.length} issue(s)):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log(`✅ Documentation verification PASSED (${fileContents.size} file(s) checked${rootOnly ? ', --root-only mode' : ''}).`);
}
