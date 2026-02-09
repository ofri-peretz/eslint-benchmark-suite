#!/bin/bash
#
# AI Security Benchmark — Overnight Statistical Significance Runner
#
# Runs all 6 models with high iterations and safe rate limiting to avoid
# hitting API quotas. Designed to run unattended overnight.
#
# Rate Limits:
#   - Google API: 5 RPM limit → 13.2s delay (12s + 10% safety margin)
#   - Claude CLI: Conservative 5 RPM → 13.2s delay (matching Google for consistency)
#
# Time Estimate (10 iterations, 20 prompts, 6 models):
#   - 1200 total API calls
#   - ~600 per provider pipeline (running in parallel)
#   - At 13.2s per call: ~2.2 hours per pipeline
#   - Wall clock: ~2.5 hours (with ESLint analysis overhead)
#
# Usage:
#   chmod +x benchmarks/ai-security/run-overnight.sh
#   nohup benchmarks/ai-security/run-overnight.sh &
#   # Or with screen/tmux:
#   screen -S benchmark benchmarks/ai-security/run-overnight.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Configuration ──────────────────────────────────────
ITERATIONS="${ITERATIONS:-10}"
# 5 RPM = 12000ms between calls, + 10% safety = 13200ms
RATE_LIMIT_MS="${RATE_LIMIT_MS:-13200}"
OUTPUT_PREFIX="${OUTPUT_PREFIX:-overnight}"
ENABLE_REMEDIATION="${ENABLE_REMEDIATION:-true}"

# ── Timestamp ──────────────────────────────────────────
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RESULTS_DIR="$SUITE_DIR/results/ai-security-overnight"
LOG_FILE="$RESULTS_DIR/overnight-${TIMESTAMP}.log"
mkdir -p "$RESULTS_DIR"

echo "═══════════════════════════════════════════════════════════"
echo "🌙 Overnight Statistical Significance Runner"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Started:     $(date)"
echo "  Iterations:  $ITERATIONS per prompt"
echo "  Rate Limit:  ${RATE_LIMIT_MS}ms between calls (5 RPM + 10% safety)"
echo "  Remediation: $ENABLE_REMEDIATION"
echo "  Log File:    $LOG_FILE"
echo ""
echo "  Estimated duration: ~2.5 hours (10 iterations)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── Backup existing results ────────────────────────────
BACKUP_DIR="$RESULTS_DIR/backups/pre-overnight-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"
cp "$SUITE_DIR/results/ai-security/"*.json "$BACKUP_DIR/" 2>/dev/null || true
cp "$RESULTS_DIR/"*.json "$BACKUP_DIR/" 2>/dev/null || true
echo "📦 Backed up existing results to: $BACKUP_DIR"
echo ""

# ── Build the CLI arguments ───────────────────────────
REMEDIATION_FLAG=""
if [ "$ENABLE_REMEDIATION" = "false" ]; then
  REMEDIATION_FLAG="--no-remediation"
fi

# ── Run all models ─────────────────────────────────────
echo "🚀 Starting benchmark..."
echo ""

cd "$SUITE_DIR"

node benchmarks/ai-security/run-antigravity.js \
  --compare \
  --iterations="$ITERATIONS" \
  --rate-limit-anthropic="$RATE_LIMIT_MS" \
  --rate-limit-google="$RATE_LIMIT_MS" \
  --output-prefix="$OUTPUT_PREFIX" \
  $REMEDIATION_FLAG \
  2>&1 | tee "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Overnight benchmark completed successfully!"
else
  echo "⚠️  Benchmark exited with code $EXIT_CODE"
fi
echo "  Finished:  $(date)"
echo "  Log:       $LOG_FILE"
echo "  Results:   $SUITE_DIR/results/ai-security/"
echo "═══════════════════════════════════════════════════════════"
