/**
 * CIRO — Crisis Intelligence & Response Orchestrator
 * Antigravity-style multi-agent workflow:
 *   INGEST → DETECT → REASON → PLAN → SIMULATE → OUTCOME
 *
 * For hackathon demo: structured agent pipeline with logged handoffs.
 */

const { detectCrisis } = require('../agents/crisisDetector');
const { planActions } = require('../agents/actionPlanner');
const { simulateActions } = require('../agents/actionSimulator');

const PIPELINE_STAGES = [
  'signal_ingestion',
  'event_detection',
  'situation_analysis',
  'action_planning',
  'action_simulation',
  'outcome_publish',
];

async function runCiroForArea(areaLabel, allSignals) {
  const trace = { areaLabel, stages: [], startedAt: Date.now() };

  trace.stages.push({ stage: 'event_detection', agent: 'crisis_detector', status: 'running' });
  const detection = await detectCrisis(areaLabel, allSignals);
  trace.stages.push({
    stage: 'situation_analysis',
    agent: 'crisis_detector',
    status: 'done',
    output: {
      type: detection.situationType,
      confidence: detection.confidence,
      severity: detection.severity,
    },
  });

  trace.stages.push({ stage: 'action_planning', agent: 'action_planner', status: 'running' });
  const plan = await planActions(detection, areaLabel);
  trace.stages.push({
    stage: 'action_planning',
    agent: 'action_planner',
    status: 'done',
    output: { actionCount: plan.actions.length, alternate: plan.alternateRoad },
  });

  trace.stages.push({ stage: 'action_simulation', agent: 'action_simulator', status: 'running' });
  const simulation = await simulateActions(areaLabel, detection, plan);
  trace.stages.push({
    stage: 'outcome_publish',
    agent: 'action_simulator',
    status: 'done',
    output: { outcome: simulation?.outcome },
  });

  trace.completedAt = Date.now();
  trace.durationMs = trace.completedAt - trace.startedAt;

  return { detection, plan, simulation, trace };
}

module.exports = { runCiroForArea, PIPELINE_STAGES };
