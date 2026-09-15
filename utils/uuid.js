'use strict';

// CommonJS shim for the `uuid` package (v9+ is ESM-only).
// Uses Node's built-in crypto.randomUUID (Node >= 14.17 / 16+).
const { randomUUID } = require('crypto');

const v4 = () => randomUUID();

// Minimal v1/v5 stubs so existing imports that destructure still work.
// For v4 (the only one we actually need) the crypto implementation is used.
const v1 = () => randomUUID();

// Namespace-based v5 is not needed here; fall back to v4 to avoid crashes.
const v5 = () => randomUUID();

const NIL = '00000000-0000-0000-0000-000000000000';
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const validate = (str) =>
  typeof str === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const version = (str) => (validate(str) ? parseInt(str.charAt(14), 10) : -1);

module.exports = {
  v1,
  v4,
  v5,
  NIL,
  MAX,
  validate,
  version,
  // Default export compatibility
  default: { v1, v4, v5, NIL, MAX, validate, version },
};
