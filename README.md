# ESLint Benchmark Suite

> **Reproducible benchmarks** for ESLint plugins across the Interlace ecosystem

## 📊 Available Benchmarks

| Benchmark                          | Comparison                                                | Status     |
| ---------------------------------- | --------------------------------------------------------- | ---------- |
| [import](./benchmarks/import/)     | `eslint-plugin-import` vs `eslint-plugin-import-next`     | ✅ Ready   |
| [security](./benchmarks/security/) | `eslint-plugin-security` vs `eslint-plugin-secure-coding` | 🔜 Planned |
| [crypto](./benchmarks/crypto/)     | Cryptography rules comparison                             | 🔜 Planned |
| [jwt](./benchmarks/jwt/)           | JWT security rules                                        | 🔜 Planned |

## 📈 Latest Results (January 2, 2026)

### Benchmark 1: Core Rules (9 rules)

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup  |
| ------ | -------------------- | ------------------------- | -------- |
| 1,000  | 2.80s (±0.20s)       | 1.78s (±0.01s)            | **1.6x** |
| 5,000  | 19.04s (±0.24s)      | 5.76s (±0.12s)            | **3.3x** |
| 10,000 | 58.67s (±0.61s)      | 11.26s (±0.80s)           | **5.2x** |

### Benchmark 2: Recommended Preset

| Files  | eslint-plugin-import | eslint-plugin-import-next | Speedup  |
| ------ | -------------------- | ------------------------- | -------- |
| 1,000  | 2.42s (±0.11s)       | 1.78s (±0.05s)            | **1.4x** |
| 5,000  | 18.43s (±0.28s)      | 6.07s (±0.28s)            | **3.0x** |
| 10,000 | 57.74s (±0.82s)      | 10.57s (±0.12s)           | **5.5x** |

### Benchmark 3: no-cycle Rule Only 🔥

| Files  | eslint-plugin-import   | eslint-plugin-import-next | Speedup   |
| ------ | ---------------------- | ------------------------- | --------- |
| 1,000  | 27.03s (±1.59s)        | 1.05s (±0.01s)            | **25.7x** |
| 5,000  | 148.59s (±31.13s)      | 2.71s (±0.01s)            | **54.9x** |
| 10,000 | _(would take 10+ min)_ | ~5s (projected)           | **100x+** |

_Environment: Node v20.19.5, Apple Silicon M1 (arm64), 3-5 iterations_

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/ofri-peretz/eslint-benchmark-suite.git
cd eslint-benchmark-suite

# Install dependencies
npm install

# Run a specific benchmark
npm run benchmark:import

# Run all benchmarks
npm run benchmark:all
```

---

## 📁 Repository Structure

```
eslint-benchmark-suite/
├── benchmarks/
│   ├── import/                 # Import plugin benchmark
│   │   ├── configs/           # ESLint configs for each plugin
│   │   ├── fixtures/          # Generated test files
│   │   └── README.md          # Benchmark-specific docs
│   ├── security/              # Security plugin benchmark
│   │   ├── configs/
│   │   ├── fixtures/
│   │   └── README.md
│   └── ...
├── shared/
│   ├── runner.js              # Common benchmark runner
│   ├── stats.js               # Statistical utilities
│   └── reporter.js            # Report generator
├── results/                   # All benchmark results
│   ├── import/
│   ├── security/
│   └── ...
├── scripts/
│   ├── run-benchmark.js       # CLI entry point
│   └── generate-fixtures.js   # Fixture generator
└── README.md                  # This file
```

---

## 🔬 Methodology

1. **Fixture Generation**: Realistic code samples for each benchmark type
2. **Iterations**: 10 runs per test (configurable)
3. **Statistics**: Mean, median, min, max, standard deviation
4. **Cold starts**: Cache cleared between runs
5. **Isolation**: Each plugin runs in a fresh process

---

## 📈 Results Format

Each benchmark produces JSON results:

```json
{
  "benchmark": "import",
  "timestamp": "2026-01-01T23:50:00Z",
  "iterations": 10,
  "results": [
    {
      "size": 1000,
      "plugins": {
        "eslint-plugin-import": { "mean": 12.5, "median": 12.3 },
        "eslint-plugin-import-next": { "mean": 0.4, "median": 0.3 }
      },
      "speedup": "31.25x"
    }
  ]
}
```

---

## 🛠️ Adding New Benchmarks

```bash
# Create new benchmark directory
mkdir -p benchmarks/my-plugin/configs benchmarks/my-plugin/fixtures

# Add configs and fixture generator
# See benchmarks/import/ for reference
```

---

## 📜 License

MIT

---

**Built by [@ofri-peretz](https://github.com/ofri-peretz)** for transparent performance comparisons.
