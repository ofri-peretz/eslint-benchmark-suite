#!/usr/bin/env node

/**
 * FN/FP Benchmark Runner
 *
 * Compares False Negatives (missed vulnerabilities) and False Positives
 * (incorrectly flagged safe code) across ESLint security plugins.
 *
 * Usage:
 *   node benchmarks/fn-fp-comparison/run.js
 *
 * Output:
 *   results/fn-fp-comparison/YYYY-MM-DD.json
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import expected detections from fixtures
import {
  EXPECTED_DETECTIONS,
  TOTAL_EXPECTED_VULNERABILITIES,
} from "./fixtures/vulnerable/vulnerable.js";
import {
  EXPECTED_NO_DETECTIONS,
  TOTAL_SAFE_PATTERNS,
} from "./fixtures/safe/safe-patterns.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const PLUGINS_TO_TEST = [
  {
    name: "eslint-plugin-security",
    displayName: "eslint-plugin-security",
    config: "./configs/eslint-plugin-security.config.js",
    rules: 13,
    lastUpdated: "2023 (maintenance mode)",
    weeklyDownloads: "1.5M+",
  },
  {
    name: "interlace",
    displayName: "Interlace ESLint Ecosystem",
    config: "./configs/interlace.config.js",
    rules: 84, // secure-coding + node-security + pg + jwt
    lastUpdated: "Weekly",
    weeklyDownloads: "~5K",
  },
];

const FIXTURE_FILES = {
  vulnerable: path.join(__dirname, "fixtures/vulnerable/vulnerable.js"),
  safe: path.join(__dirname, "fixtures/safe/safe-patterns.js"),
};

const OUTPUT_DIR = path.join(__dirname, "../../results/fn-fp-comparison");

// =============================================================================
// ESLINT RUNNER
// =============================================================================

function runEslint(configPath, targetFile) {
  const absoluteConfig = path.resolve(__dirname, configPath);
  const absoluteTarget = path.resolve(targetFile);

  const result = spawnSync(
    "npx",
    [
      "eslint",
      "--config",
      absoluteConfig,
      "--format",
      "json",
      "--no-error-on-unmatched-pattern",
      absoluteTarget,
    ],
    {
      cwd: __dirname,
      encoding: "utf-8",
      timeout: 60000,
    },
  );

  try {
    // ESLint returns exit code 1 when there are errors, but still outputs valid JSON
    const output = result.stdout || "[]";
    return JSON.parse(output);
  } catch (e) {
    console.error(
      `Failed to parse ESLint output for ${configPath}:`,
      e.message,
    );
    console.error("stdout:", result.stdout);
    console.error("stderr:", result.stderr);
    return [];
  }
}

/**
 * Extract function-level violations from ESLint results
 */
function extractViolations(eslintResults) {
  const violations = [];

  for (const file of eslintResults) {
    for (const message of file.messages || []) {
      // Skip parsing errors
      if (message.ruleId === null) continue;

      violations.push({
        ruleId: message.ruleId,
        severity: message.severity === 2 ? "error" : "warning",
        message: message.message,
        line: message.line,
        column: message.column,
      });
    }
  }

  return violations;
}

/**
 * Map violations to function names based on line numbers
 * This is a simplified approach - in production you'd use AST parsing
 */
function mapViolationsToFunctions(violations, sourceCode) {
  const functionViolations = {};
  const lines = sourceCode.split("\n");

  // Find all function declarations with their line ranges
  const functions = [];
  let currentFunction = null;
  let braceDepth = 0;

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Detect function declarations
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      if (currentFunction) {
        currentFunction.endLine = lineNum - 1;
        functions.push(currentFunction);
      }
      currentFunction = {
        name: funcMatch[1],
        startLine: lineNum,
        endLine: null,
      };
      braceDepth = 0;
    }

    // Track brace depth for function end detection
    braceDepth += (line.match(/{/g) || []).length;
    braceDepth -= (line.match(/}/g) || []).length;
  });

  // Close the last function
  if (currentFunction) {
    currentFunction.endLine = lines.length;
    functions.push(currentFunction);
  }

  // Map violations to functions
  for (const violation of violations) {
    for (const func of functions) {
      if (violation.line >= func.startLine && violation.line <= func.endLine) {
        if (!functionViolations[func.name]) {
          functionViolations[func.name] = [];
        }
        functionViolations[func.name].push(violation);
        break;
      }
    }
  }

  return functionViolations;
}

// =============================================================================
// METRICS CALCULATION
// =============================================================================

function calculateMetrics(vulnerableResults, safeResults) {
  // True Positives: Vulnerabilities correctly detected
  const detectedVulnerabilities = Object.keys(vulnerableResults);
  const TP = detectedVulnerabilities.filter(
    (fn) => fn in EXPECTED_DETECTIONS,
  ).length;

  // False Negatives: Vulnerabilities missed
  const FN = TOTAL_EXPECTED_VULNERABILITIES - TP;

  // False Positives: Safe code incorrectly flagged
  const flaggedSafePatterns = Object.keys(safeResults);
  const FP = flaggedSafePatterns.filter((fn) =>
    EXPECTED_NO_DETECTIONS.includes(fn),
  ).length;

  // True Negatives: Safe code correctly ignored
  const TN = TOTAL_SAFE_PATTERNS - FP;

  // Calculate rates
  const FNR =
    TOTAL_EXPECTED_VULNERABILITIES > 0
      ? ((FN / TOTAL_EXPECTED_VULNERABILITIES) * 100).toFixed(1)
      : 0;
  const FPR =
    TOTAL_SAFE_PATTERNS > 0 ? ((FP / TOTAL_SAFE_PATTERNS) * 100).toFixed(1) : 0;
  const precision = TP + FP > 0 ? ((TP / (TP + FP)) * 100).toFixed(1) : 100;
  const recall = TP + FN > 0 ? ((TP / (TP + FN)) * 100).toFixed(1) : 0;
  const f1Score =
    parseFloat(precision) + parseFloat(recall) > 0
      ? (
          (2 * parseFloat(precision) * parseFloat(recall)) /
          (parseFloat(precision) + parseFloat(recall))
        ).toFixed(1)
      : 0;

  return {
    TP,
    TN,
    FP,
    FN,
    FNR: `${FNR}%`,
    FPR: `${FPR}%`,
    precision: `${precision}%`,
    recall: `${recall}%`,
    f1Score: `${f1Score}%`,
    detectedVulnerabilities,
    missedVulnerabilities: Object.keys(EXPECTED_DETECTIONS).filter(
      (fn) => !detectedVulnerabilities.includes(fn),
    ),
    falsePositives: flaggedSafePatterns,
  };
}

// =============================================================================
// MAIN RUNNER
// =============================================================================

async function runBenchmark() {
  console.log("🔬 FN/FP Benchmark: ESLint Security Plugin Comparison\n");
  console.log("=".repeat(70));

  // Read source files
  const vulnerableCode = fs.readFileSync(FIXTURE_FILES.vulnerable, "utf-8");
  const safeCode = fs.readFileSync(FIXTURE_FILES.safe, "utf-8");

  console.log(`\n📁 Test Fixtures:`);
  console.log(`   Vulnerable patterns: ${TOTAL_EXPECTED_VULNERABILITIES}`);
  console.log(`   Safe patterns: ${TOTAL_SAFE_PATTERNS}`);

  const results = {
    timestamp: new Date().toISOString(),
    methodology: {
      approach: "Static fixture-based comparison",
      vulnerablePatterns: TOTAL_EXPECTED_VULNERABILITIES,
      safePatterns: TOTAL_SAFE_PATTERNS,
      categories: [
        "SQL Injection",
        "Command Injection",
        "Path Traversal",
        "Hardcoded Credentials",
        "JWT Vulnerabilities",
        "XSS",
        "Prototype Pollution",
        "Insecure Randomness",
        "Weak Cryptography",
        "Timing Attacks",
        "NoSQL Injection",
        "SSRF",
        "Open Redirect",
        "ReDoS",
      ],
    },
    plugins: {},
    summary: {},
  };

  for (const plugin of PLUGINS_TO_TEST) {
    console.log(`\n\n🔍 Testing: ${plugin.displayName}`);
    console.log(
      `   Rules: ${plugin.rules} | Last Updated: ${plugin.lastUpdated}`,
    );
    console.log("-".repeat(70));

    // Run on vulnerable code
    console.log("   Scanning vulnerable.js...");
    const vulnerableRaw = runEslint(plugin.config, FIXTURE_FILES.vulnerable);
    const vulnerableViolations = extractViolations(vulnerableRaw);
    const vulnerableByFunction = mapViolationsToFunctions(
      vulnerableViolations,
      vulnerableCode,
    );

    // Run on safe code
    console.log("   Scanning safe-patterns.js...");
    const safeRaw = runEslint(plugin.config, FIXTURE_FILES.safe);
    const safeViolations = extractViolations(safeRaw);
    const safeByFunction = mapViolationsToFunctions(safeViolations, safeCode);

    // Calculate metrics
    const metrics = calculateMetrics(vulnerableByFunction, safeByFunction);

    console.log(`\n   📊 Results:`);
    console.log(
      `      True Positives (detected vulnerabilities): ${metrics.TP}/${TOTAL_EXPECTED_VULNERABILITIES}`,
    );
    console.log(
      `      False Negatives (missed vulnerabilities): ${metrics.FN}`,
    );
    console.log(
      `      False Positives (incorrectly flagged safe code): ${metrics.FP}`,
    );
    console.log(
      `      True Negatives (correctly ignored safe code): ${metrics.TN}/${TOTAL_SAFE_PATTERNS}`,
    );
    console.log(`\n   📈 Metrics:`);
    console.log(`      False Negative Rate: ${metrics.FNR}`);
    console.log(`      False Positive Rate: ${metrics.FPR}`);
    console.log(`      Precision: ${metrics.precision}`);
    console.log(`      Recall: ${metrics.recall}`);
    console.log(`      F1 Score: ${metrics.f1Score}`);

    results.plugins[plugin.name] = {
      displayName: plugin.displayName,
      rules: plugin.rules,
      lastUpdated: plugin.lastUpdated,
      weeklyDownloads: plugin.weeklyDownloads,
      vulnerableAnalysis: {
        totalViolations: vulnerableViolations.length,
        byFunction: vulnerableByFunction,
        byRule: groupByRule(vulnerableViolations),
      },
      safeAnalysis: {
        totalViolations: safeViolations.length,
        byFunction: safeByFunction,
        byRule: groupByRule(safeViolations),
      },
      metrics,
    };
  }

  // Generate comparison summary
  console.log("\n\n" + "=".repeat(70));
  console.log("📋 COMPARISON SUMMARY");
  console.log("=".repeat(70));

  console.log(
    "\n| Plugin | Rules | FN Rate | FP Rate | Precision | Recall | F1 |",
  );
  console.log(
    "|--------|-------|---------|---------|-----------|--------|-----|",
  );

  for (const [name, data] of Object.entries(results.plugins)) {
    console.log(
      `| ${data.displayName.substring(0, 25).padEnd(25)} | ${String(data.rules).padEnd(5)} | ` +
        `${data.metrics.FNR.padEnd(7)} | ${data.metrics.FPR.padEnd(7)} | ` +
        `${data.metrics.precision.padEnd(9)} | ${data.metrics.recall.padEnd(6)} | ${data.metrics.f1Score} |`,
    );
  }

  // Save results
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(
    OUTPUT_DIR,
    `${new Date().toISOString().split("T")[0]}.json`,
  );
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`\n\n✅ Results saved to: ${outputPath}`);

  return results;
}

function groupByRule(violations) {
  const byRule = {};
  for (const v of violations) {
    if (!byRule[v.ruleId]) {
      byRule[v.ruleId] = 0;
    }
    byRule[v.ruleId]++;
  }
  return byRule;
}

// Run if called directly
runBenchmark().catch(console.error);
