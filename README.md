# Project Overview

KRONE (ICDE 26) is a hierarchical structure-aware log anomaly detection platform designed to help system administrators and security analysts monitor, analyze, and respond to system anomalies in real time. Traditional log anomaly detection tools often treat logs as flat sequences, missing important structural relationships. KRONE addresses this by breaking down logs into structured representations, capturing status, action, and entity, to enable fine-grained and context-aware anomaly detection. 

Explore KRONE here: https://github.com/LeiMa0324/Krone_official

The demo is alive at: https://leima0324.github.io/KRONE_Demo_official/

We gratefully acknowledge the contributions of our developers (listed in alphabetical order):
- @suhanic44 https://github.com/suhanic44
- @EShanbaum https://github.com/EShanbaum
- @atassiad https://github.com/atassiad



With KRONE, users can:
- Visualize and interact with large log sequences as knowledge graphs.
- Detect both high-level and low-level anomalies with greater accuracy.
- Quickly identify root causes of system failures or security incidents.
- Explore and compare anomaly patterns for deeper insights.

**Key Benefits:**
- **Hierarchical Analysis:** Gain insights into the natural, hierarchical structure of your log sequences. KRONE automatically extracts and organizes log data into status, action, and entity levels, allowing you to see how normal log sequences are structured and how different components relate to each other.
- **Interactive Visualization:** Explore your logs as an interactive knowledge graph. This visualization makes it easy to understand relationships and dependencies within your system. You can click into nodes to drill down into specific log events, and switch to a timeline view to analyze how normal and abnormal patterns evolve over time.
- **Anomaly Analysis:** Precisely identify where anomalies occur within the hierarchy—whether at the status, action, or entity level. KRONE highlights the exact point and context of each anomaly, helping you uncover root causes, recurring patterns, and the broader impact of abnormal events.

# How It Works

KRONE processes logs in four key stages:
1. **Preprocessing**: CSV logs are parsed and normalized.
2. **Structure Extraction**: Logs are converted into hierarchical sequences (status → action → entity).
3. **Model Inference**: Sequences are analyzed using level-decoupled and cross-level detection.
4. **Visualization**: Results are visualized as graphs and anomaly tables for exploration and debugging.


# Features
<!-- (TODO: Add screenshots explaining general flow) -->

KRONE provides an interactive platform for log anomaly detection, offering the following key features:
## 1. Log File Upload & Preview
- **CSV Upload:** Upload raw log sequences in CSV format directly through the web interface.
- **Preview:** Preview CSV file before processing to ensure correct formatting and data selection.

## 2. Hierarchical Log Analysis
- **Structured Extraction:** KRONE automatically extracts hierarchical objects (such as status, action, and entity) from the uploaded log sequences.
- **Knowledge Base Construction:** The system builds a knowledge base representing the typical hierarchical structure of actions and relationships between entities.

## 3. Anomaly Detection
- **Model Inference:** The KRONE model analyzes the structured log data to detect anomalies by identifying log sequences that break the learned hierarchical patterns (entity, action, status). The model classifies each log sequence as normal or abnormal.
- **Prediction Results:** View model predictions for individual log sequences in a tabular format, which highlights the exact rows where the anomaly appears.

## 4. Visualization & Exploration
- **Knowledge Graph:** Explore the learned knowledge base as an interactive graph to understand patterns and relationships.
- **Root Cause Analysis:** Use graph visualizations to quickly identify anomaly patterns and pinpoint root causes of failures or incidents.

KRONE’s intuitive interface optimizes the process of monitoring system health, exploring log data, and responding to anomalies.

# Getting Started

Make sure you have the following installed:

- **Node.js** (includes npm): [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js): [npm Documentation](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- **Git:** [Download Git](https://git-scm.com/downloads)
- **A modern browser** (e.g., Chrome, Firefox)

## Install Prerequisites

**On Ubuntu/Linux:**
```sh
sudo apt update
sudo apt install nodejs npm git
```

**On macOS (with Homebrew):**
```sh
brew install node git
```

**On Windows:**  
Download and install [Node.js](https://nodejs.org/) and [Git](https://git-scm.com/download/win).


## Setup Instructions

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-username/KRONE_Demo.git
   cd KRONE_Demo
   ```

2. **Install Vite:**
   ```sh
   npm install -g vite
   ```

3. **Install dependencies:**
   ```sh
   npm install
   ```

4. **Run the development server:**
   ```sh
   npm run dev
   ```

5. **Open the app:**
   Visit [http://localhost:5173](http://localhost:5173) in your browser.

6. **Upload your log CSV:**  
   Use the web interface to upload and analyze your log files.

# Datasets

The demo ships three datasets — **HDFS**, **BGL**, and **Thunderbird** — switchable
from the picker in the navbar. The choice is remembered across pages and reloads,
and `?dataset=BGL` on any URL opens the demo on that dataset directly.

Each one lives in `public/data/<Dataset>/` as the same seven CSVs. These are the
filenames the demo has always used — they simply moved one level down, from
`public/` into the dataset they belong to:

| File                                                       | Used by                                |
| ---------------------------------------------------------- | -------------------------------------- |
| `Krone_Tree.csv`                                           | Hierarchy Mining, Knowledge Base       |
| `structured_processes.csv`                                 | log key → template labels, File Upload |
| `krone_decompose_res.csv`                                  | Log Anomaly Detection                  |
| `krone_train_decompose.csv`                                | Training Process                       |
| `krone_detection_res.csv`                                  | Log Anomaly Detection                  |
| `train_knowledge_all.csv`, `test_knowledge_all_fixed2.csv` | Knowledge Base, Cost Analysis          |

`public/data/manifest.json` records the true row counts, which is what the
"showing first N of M" notes report.

## Regenerating the data

These files are derived from the research outputs by `scripts/build_demo_data.py`,
which drops columns the UI never reads and caps the row counts a browser can
reasonably download. It reads from `data_raw/<Dataset>/` when present, and
otherwise from the research repos beside this one:

```sh
python3 scripts/build_demo_data.py                      # all datasets
python3 scripts/build_demo_data.py --datasets BGL       # just one
KRONE_RESEARCH_ROOT=/path/to/Code python3 scripts/build_demo_data.py
```

`data_raw/` is gitignored — it holds the full-fidelity inputs, several hundred MB.

To add a fourth dataset: add an entry to `DATASETS` in `scripts/build_demo_data.py`
and to `DATASETS` in `src/datasets.ts`, then re-run the script. Nothing else in the
app names a dataset. `src/unit_tests/dataset_data.test.ts` checks the generated
files hold up the joins the pages depend on.

# Technologies Used
- React
- Typescript
- Vite
- Tailwind CSS
- @xyflow/react
- papaparse
- lucide-react
- shadcn/ui
