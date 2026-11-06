#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const args = new Set(process.argv.slice(2));
const rootOnly = args.has('--root-only');
const throughTask2 = args.has('--through-task-2');

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

function verifyRelativeMarkdownLinks(relFilePath, content, allowFutureTaskLinks = false) {
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

    const resolvedPath = path.resolve(fileDir, cleanHref);
    const relTarget = path.relative(rootDir, resolvedPath);

    if (rootOnly && relTarget.startsWith('docs/')) {
      continue;
    }
    if (
      allowFutureTaskLinks &&
      (relTarget === 'docs/README.md' ||
        relTarget.startsWith('docs/03-contracts/') ||
        relTarget.startsWith('docs/04-data/') ||
        relTarget.startsWith('docs/05-engineering/') ||
        relTarget.startsWith('docs/06-operations/'))
    ) {
      continue;
    }

    if (!fs.existsSync(resolvedPath)) {
      errors.push(`Broken relative link in ${relFilePath}: "${rawHref}" -> ${relTarget} does not exist`);
    }
  }
}

// 1. Check Root Governance Files
const requiredFiles = ['AGENTS.md', 'CONTEXT.md', 'design.md', 'DESIGN.md', 'PRODUCT.md'];

const task2Files = [
  'docs/00-overview/product-vision.md',
  'docs/00-overview/scope-and-non-goals.md',
  'docs/00-overview/implementation-roadmap.md',
  'docs/01-business/stay-and-lease-flows.md',
  'docs/01-business/pricing-meter-and-tax-rules.md',
  'docs/02-architecture/system-context.md',
  'docs/02-architecture/module-boundaries.md',
  'docs/02-architecture/backend-architecture.md',
  'docs/02-architecture/frontend-architecture.md',
  'docs/adr/0001-clean-architecture-and-stack.md',
  'docs/adr/0002-hybrid-availability-and-ttl-hold.md',
  'docs/adr/0003-ollama-design-system-and-shadcn.md',
];

const task3DocsFiles = [
  'docs/03-contracts/api-conventions.md',
  'docs/03-contracts/error-contract.md',
  'docs/03-contracts/rbac-and-scopes.md',
  'docs/03-contracts/permission-catalog.md',
  'docs/04-data/conceptual-data-model.md',
  'docs/04-data/database-and-locking-standards.md',
  'docs/04-data/pdpa-and-audit-redaction.md',
  'docs/05-engineering/testing-strategy.md',
  'docs/05-engineering/development-ready-gate.md',
  'docs/05-engineering/definition-of-done.md',
  'docs/06-operations/environments-and-secrets.md',
  'docs/06-operations/observability-and-health.md',
  'docs/06-operations/backup-restore-and-release.md',
];

if (!rootOnly) {
  requiredFiles.push(...task2Files);
}
if (!rootOnly && !throughTask2) {
  requiredFiles.push(...task3DocsFiles, 'docs/README.md', 'README.md');
}

const fileContents = new Map();
for (const file of requiredFiles) {
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

// 4. Verify Task 2 files content (PM-01..PM-10 in implementation-roadmap.md, ADR sections)
if (!rootOnly) {
  const requiredSlices = ['PM-01', 'PM-02', 'PM-03', 'PM-04', 'PM-05', 'PM-06', 'PM-07', 'PM-08', 'PM-09', 'PM-10'];
  const roadmapContent = fileContents.get('docs/00-overview/implementation-roadmap.md');
  checkContainsAll('docs/00-overview/implementation-roadmap.md', roadmapContent, requiredSlices, 'Vertical Slice ID');

  const pricingContent = fileContents.get('docs/01-business/pricing-meter-and-tax-rules.md');
  checkContainsAll(
    'docs/01-business/pricing-meter-and-tax-rules.md',
    pricingContent,
    ['GracePeriodMinutes', 'AutoCapToDailyRate', 'TurnaroundBufferMinutes', 'Exempt', 'VatIncluded', 'VatExcluded', 'WithholdingTax'],
    'pricing/meter/tax rule'
  );

  for (const adrFile of [
    'docs/adr/0001-clean-architecture-and-stack.md',
    'docs/adr/0002-hybrid-availability-and-ttl-hold.md',
    'docs/adr/0003-ollama-design-system-and-shadcn.md',
  ]) {
    checkContainsAll(adrFile, fileContents.get(adrFile), ['## Status', '## Context', '## Decision', '## Consequences'], 'ADR section');
  }
}

// 5. Verify Task 3 files content & Orphan Docs check in docs/README.md
if (!rootOnly && !throughTask2) {
  checkContainsAll(
    'docs/03-contracts/error-contract.md',
    fileContents.get('docs/03-contracts/error-contract.md'),
    ['RFC 9457', 'unit.not_clean', 'reservation.slot_overlap', 'reservation.hold_expired', 'shift.not_open', 'meter.rollover_unconfirmed'],
    'error contract token'
  );
  checkContainsAll(
    'docs/03-contracts/rbac-and-scopes.md',
    fileContents.get('docs/03-contracts/rbac-and-scopes.md'),
    ['AdminScope', 'ClientScope', 'AllowedPropertyIds', 'CustomerId'],
    'RBAC scope token'
  );
  checkContainsAll(
    'docs/04-data/database-and-locking-standards.md',
    fileContents.get('docs/04-data/database-and-locking-standards.md'),
    ['tstzrange', 'EXCLUDE USING gist', 'DocumentSequence'],
    'database locking standard'
  );
  checkContainsAll(
    'docs/04-data/pdpa-and-audit-redaction.md',
    fileContents.get('docs/04-data/pdpa-and-audit-redaction.md'),
    ['admin.customer.unmask_pii', '1-xxxx-xxxxx-12-3', 'AuditEvent'],
    'PDPA/Audit rule'
  );

  // Verify docs/README.md links to every doc in task2Files + task3DocsFiles (no orphan docs)
  const docsReadmeContent = fileContents.get('docs/README.md');
  if (docsReadmeContent) {
    for (const docPath of [...task2Files, ...task3DocsFiles]) {
      const relFromDocsDir = docPath.replace(/^docs\//, '');
      if (!docsReadmeContent.includes(relFromDocsDir)) {
        errors.push(`Orphan doc not indexed in docs/README.md: "${docPath}" (expected link to "${relFromDocsDir}")`);
      }
    }
  }
}

// 6. Verify relative links in checked files
for (const [file, content] of fileContents.entries()) {
  verifyRelativeMarkdownLinks(file, content, throughTask2);
}

if (errors.length > 0) {
  console.error(`\n❌ Documentation verification FAILED (${errors.length} issue(s)):\n`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
} else {
  console.log(`✅ Documentation verification PASSED (${fileContents.size} file(s) checked).`);
}
