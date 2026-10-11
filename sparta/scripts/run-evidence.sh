#!/usr/bin/env bash
# Reproduce the before/after evidence for the Handy deposit settlement agent.
# Same project inputs (seed, missions, checks) and same --scenario interruption for both agents;
# only the agent command differs. Usage: scripts/run-evidence.sh [OUT_DIR]
set -u
cd "$(dirname "$0")/.."
OUT="${1:-./evidence/rerun-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT/before" "$OUT/after"
export HANDY_DECISION_LOG="$(cd "$OUT" && pwd)/decisions.jsonl"  # every Claude decision, one JSON line each
P=./projects/handy-deposits
W="npx --no-install worlds starters run --project $P"

run() { # name, extra flags..., -- agent
  local name="$1"; shift
  echo "=== $name ==="
  $W "$@" 2>&1 | tee "$OUT/$name.txt"
  echo "exit=${PIPESTATUS[0]}" | tee -a "$OUT/$name.txt"
}

# BEFORE: naive v0 agent
run before/m2-provider-cancelled.normal        --mission provider-cancelled                                --evidence "$OUT/before/m2-provider-cancelled.normal.json"        -- node naive-agent.mjs
run before/m2-provider-cancelled.interruption  --mission provider-cancelled        --scenario interruption --evidence "$OUT/before/m2-provider-cancelled.interruption.json"  -- node naive-agent.mjs
run before/m3-rescheduled.interruption         --mission rescheduled-not-cancelled --scenario interruption --evidence "$OUT/before/m3-rescheduled.interruption.json"         -- node naive-agent.mjs
run before/all.interruption.runs3              --all --runs 3                      --scenario interruption --evidence "$OUT/before/all.interruption.runs3.json"              -- node naive-agent.mjs

# AFTER: fixed v1 agent (project.json default command), same inputs and scenario
run after/m2-provider-cancelled.interruption   --mission provider-cancelled        --scenario interruption --evidence "$OUT/after/m2-provider-cancelled.interruption.json"   -- node settlement-agent.mjs
run after/m3-rescheduled.interruption          --mission rescheduled-not-cancelled --scenario interruption --evidence "$OUT/after/m3-rescheduled.interruption.json"          -- node settlement-agent.mjs
run after/all.interruption.runs3               --all --runs 3                      --scenario interruption --evidence "$OUT/after/all.interruption.runs3.json"               -- node settlement-agent.mjs

node scripts/evidence-html.mjs "$OUT"
