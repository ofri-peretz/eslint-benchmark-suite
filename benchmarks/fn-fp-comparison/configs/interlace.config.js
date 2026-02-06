/**
 * ESLint Configuration for Interlace Ecosystem
 * The comprehensive security suite with 245+ security rules
 */

import secureCoding from "eslint-plugin-secure-coding";
import nodeSecurity from "eslint-plugin-node-security";
import pg from "eslint-plugin-pg";
import jwt from "eslint-plugin-jwt";

export default [
  // Core security rules
  secureCoding.configs.recommended,

  // Node.js security rules (fs, child_process, vm, etc.)
  nodeSecurity.configs.recommended,

  // PostgreSQL security rules (SQL injection, connection hygiene)
  pg.configs.recommended,

  // JWT security rules (algorithm confusion, secrets)
  jwt.configs.recommended,
];
