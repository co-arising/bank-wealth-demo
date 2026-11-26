#!/usr/bin/env node
// PreToolUse anti-cheat guard for co-arising EARS 1.0 (Section 7.2).
// Exits 2 to physically block AI Agent writes to locked projections, locked BDD oracles,
// generated scaffolds, or lines outside @cloze:start(<id>)..@cloze:end(<id>) slots.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const READ_ONLY_PREFIXES = [
  'projections/ac/',
  'projections/tables/',
  'generated-tests/',
  'generated-scaffold/',
  'generated/',
];

const CLOZE_START_RE = /@cloze:start\(([^)]+)\)/u;
const CLOZE_END_RE = /@cloze:end\(([^)]+)\)/u;

export function parseClozeRanges(sourceText) {
  const lines = sourceText.split('\n');
  const ranges = [];
  let open = null;
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const startMatch = line.match(CLOZE_START_RE);
    if (startMatch) {
      open = { id: startMatch[1].trim(), startMarkerLine: lineNo, editableStart: lineNo + 1 };
      return;
    }
    const endMatch = line.match(CLOZE_END_RE);
    if (endMatch && open && endMatch[1].trim() === open.id) {
      ranges.push({
        id: open.id,
        startMarkerLine: open.startMarkerLine,
        endMarkerLine: lineNo,
        editableStart: open.editableStart,
        editableEnd: lineNo - 1,
      });
      open = null;
    }
  });
  return ranges;
}

function normalizeRelPath(filePath, rootDir) {
  const abs = resolve(rootDir, filePath);
  const rel = relative(rootDir, abs).split(sep).join('/');
  return { abs, rel };
}

function lineSpanOfSubstring(sourceText, needle) {
  if (!needle) return null;
  const idx = sourceText.indexOf(needle);
  if (idx < 0) return null;
  const startLine = sourceText.slice(0, idx).split('\n').length;
  const endLine = startLine + needle.split('\n').length - 1;
  return { startLine, endLine };
}

export function evaluateWriteGuard(payload, { rootDir = ROOT, activeCloze = process.env.COARISING_ACTIVE_CLOZE || '' } = {}) {
  const toolInput = payload?.tool_input ?? payload ?? {};
  const filePath = toolInput.file_path ?? toolInput.path ?? '';
  if (!filePath) return { allowed: true };

  const { abs, rel } = normalizeRelPath(filePath, rootDir);
  if (rel.startsWith('..')) return { allowed: true };

  for (const prefix of READ_ONLY_PREFIXES) {
    if (rel === prefix.slice(0, -1) || rel.startsWith(prefix)) {
      return {
        allowed: false,
        code: 'TERRITORY_LOCKED',
        reason: `Blocked write to locked territory "${rel}". Projections, generated-tests, and generated-scaffold are compiler-owned read-only artifacts.`,
      };
    }
  }

  if (rel.startsWith('handwritten/') && existsSync(abs)) {
    const current = readFileSync(abs, 'utf8');
    const ranges = parseClozeRanges(current);
    if (ranges.length > 0) {
      const allowedRanges = activeCloze ? ranges.filter(r => r.id === activeCloze) : ranges;
      if (allowedRanges.length === 0) {
        return {
          allowed: false,
          code: 'CLOZE_SLOT_MISMATCH',
          reason: `File "${rel}" has no @cloze slot matching active COARISING_ACTIVE_CLOZE="${activeCloze}".`,
        };
      }

      const edits = Array.isArray(toolInput.edits)
        ? toolInput.edits
        : (typeof toolInput.old_string === 'string'
          ? [{ old_string: toolInput.old_string, new_string: toolInput.new_string ?? '' }]
          : null);

      if (!edits) {
        return {
          allowed: false,
          code: 'CLOZE_FULL_OVERWRITE_BLOCKED',
          reason: `Full-file overwrite on @cloze-protected file "${rel}" is forbidden; edit only inside @cloze:start..@cloze:end.`,
        };
      }

      for (const edit of edits) {
        if (CLOZE_START_RE.test(edit.old_string) || CLOZE_END_RE.test(edit.old_string)) {
          return {
            allowed: false,
            code: 'CLOZE_MARKER_TAMPER',
            reason: `Modifying @cloze boundary markers in "${rel}" is forbidden.`,
          };
        }
        const span = lineSpanOfSubstring(current, edit.old_string);
        if (!span) continue;
        const inside = allowedRanges.some(r => span.startLine >= r.editableStart && span.endLine <= r.editableEnd);
        if (!inside) {
          return {
            allowed: false,
            code: 'CLOZE_OUT_OF_BOUNDS',
            reason: `Edit on "${rel}" lines ${span.startLine}-${span.endLine} falls outside permitted @cloze slot boundaries.`,
          };
        }
      }
    }
  }

  return { allowed: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8').trim();
  } catch {
    process.exit(0);
  }
  if (!raw) process.exit(0);
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`[coarising-guard-write] invalid hook JSON: ${err.message}\n`);
    process.exit(2);
  }
  const decision = evaluateWriteGuard(payload);
  if (!decision.allowed) {
    process.stderr.write(`[coarising-guard-write][${decision.code}] ${decision.reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}
