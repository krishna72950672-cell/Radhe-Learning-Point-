export const CLASS_OPTIONS: readonly string[] = Array.from(
  { length: 12 },
  (_, index) => `Class ${String(index + 1).padStart(2, '0')}`,
);

const ROMAN_TO_CLASS_NUMBER: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
};

/**
 * Attempts to normalize a class string or number into strict "Class 01" .. "Class 12" format.
 * Returns null if the input cannot be mapped to a valid class 1..12.
 */
export function tryNormalizeClass(input: string | number): string | null {
  if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 1 || input > 12) return null;
    return `Class ${String(input).padStart(2, '0')}`;
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Strip common prefixes/suffixes like "class", "std", "grade", "-", ordinals
  const cleaned = trimmed
    .replace(/^(class|std|standard|grade|कक्षा)\s*[-:.]?\s*/i, '')
    .replace(/(st|nd|rd|th)$/i, '')
    .trim();

  if (/^\d{1,2}$/.test(cleaned)) {
    const num = Number.parseInt(cleaned, 10);
    if (num >= 1 && num <= 12) {
      return `Class ${String(num).padStart(2, '0')}`;
    }
    return null;
  }

  const romanKey = cleaned.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(ROMAN_TO_CLASS_NUMBER, romanKey)) {
    const num = ROMAN_TO_CLASS_NUMBER[romanKey];
    return `Class ${String(num).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Normalizes class input into strict "Class 01" .. "Class 12".
 * Throws an Error if the input is outside Class 01 - Class 12.
 */
export function normalizeClass(input: string | number): string {
  const normalized = tryNormalizeClass(input);
  if (!normalized) {
    throw new Error(`Invalid class value "${input}". Expected Class 01 through Class 12.`);
  }
  return normalized;
}

function hasSequentialDigits(fourDigits: string): boolean {
  const digits = fourDigits.split('').map((ch) => Number.parseInt(ch, 10));
  if (digits.some((d) => Number.isNaN(d))) return true;

  // Reject identical digits like "1111" or repeating pairs like "1212"
  if (new Set(digits).size === 1) return true;
  if (fourDigits.slice(0, 2) === fourDigits.slice(2, 4)) return true;

  // Reject strictly ascending (+1) or strictly descending (-1) 4-digit runs (e.g. 1234, 6543)
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i += 1) {
    if (digits[i] !== digits[i - 1] + 1) ascending = false;
    if (digits[i] !== digits[i - 1] - 1) descending = false;
  }
  return ascending || descending;
}

/**
 * Validates whether an 8-digit student ID is safe against existing records:
 * - Must be an 8-digit numeric string not starting with '0'
 * - Full 8-digit ID must not collide with or be +/- 1 sequential to any existing ID
 * - Last 4 digits must not collide with any existing last-4-digits
 * - Last 4 digits must not be +/- 1 sequential to any existing last-4-digits
 * - Last 4 digits must not be internally sequential (1234/4321) or uniform (1111)
 */
export function isStudentIdSafe(
  candidateId: string,
  existingIds: readonly string[],
): boolean {
  if (!/^[1-9]\d{7}$/.test(candidateId)) return false;

  const candidateLast4 = candidateId.slice(-4);
  if (hasSequentialDigits(candidateLast4)) return false;

  const candidateNum = Number.parseInt(candidateId, 10);
  const candidateLast4Num = Number.parseInt(candidateLast4, 10);

  for (const existing of existingIds) {
    if (!existing) continue;
    if (existing === candidateId) return false;

    const existingNum = Number.parseInt(existing, 10);
    if (!Number.isNaN(existingNum) && Math.abs(candidateNum - existingNum) <= 1) {
      return false;
    }

    if (existing.length >= 4) {
      const existingLast4 = existing.slice(-4);
      if (existingLast4 === candidateLast4) return false;

      const existingLast4Num = Number.parseInt(existingLast4, 10);
      if (
        !Number.isNaN(existingLast4Num) &&
        Math.abs(candidateLast4Num - existingLast4Num) <= 1
      ) {
        return false;
      }
    }
  }

  return true;
}

function secureRandomInt(minInclusive: number, maxInclusive: number): number {
  const span = maxInclusive - minInclusive + 1;
  const array = new Uint32Array(1);
  const maxValid = Math.floor(0xffffffff / span) * span;

  while (true) {
    globalThis.crypto.getRandomValues(array);
    const val = array[0];
    if (val < maxValid) {
      return minInclusive + (val % span);
    }
  }
}

/**
 * Generates a cryptographically strong 8-digit unique numeric Student ID
 * guaranteeing no full-ID or last-4-digit collisions or sequential repeats.
 */
export function generateUniqueStudentId(existingIds: readonly string[]): string {
  const maxAttempts = 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const firstDigit = secureRandomInt(1, 9);
    const remaining = secureRandomInt(0, 9999999);
    const candidate = `${firstDigit}${String(remaining).padStart(7, '0')}`;
    if (isStudentIdSafe(candidate, existingIds)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a non-colliding unique 8-digit Student ID.');
}
