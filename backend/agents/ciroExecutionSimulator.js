const { db } = require('../lib/firebase-admin');
const { simulateActions } = require('./actionSimulator');
const { dispatchToAgencies } = require('./emergencyDispatcher');
const { sendAreaPushNotification } = require('../lib/pushNotifications');
const { normalizeAreaKey } = require('../lib/constants');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function simulateExecution(crisis, situation, responsePlan) {
  const { crisisId, type, location, locationCoords, detectedAt } = crisis;
  const { actions } = responsePlan;

  const steps = [
    {
      stepId: 1,
      title: 'Crisis detected',
      description: `${type.replace(/_/g, ' ')} confirmed at ${location}.`,
      status: 'completed',
      completedAt: detectedAt,
      agentResponsible: 'crisis_detector',
    },
    {
      stepId: 2,
      title: 'Situation analysed',
      description: situation.impactSummary,
      status: 'completed',
      completedAt: Date.now(),
      agentResponsible: 'situation_analyser',
    },
  ];

  actions.forEach((action, i) => {
    const stepId = i + 3;
    let description = action.description;
    const extras = { actionId: action.id, actionType: action.type };

    if (action.type === 'traffic_reroute') {
      description += ' Route updated on map — alternate corridor activated (blue).';
      extras.mapChange = {
        alternateRoute: action.alternateRoute,
        routeStatusUpdate: 'rerouted',
      };
    }
    if (action.type === 'emergency_dispatch') {
      const ticketId = `CR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      description = `Emergency ticket #${ticketId}. ${description}`;
      extras.ticketId = ticketId;
    }
    if (action.type === 'public_alert') {
      extras.usersNotified = Math.floor((situation.impactDetails?.affectedPopulation || 5000) * 0.7);
      description = `Alert sent to ${extras.usersNotified} users near ${location}.`;
    }

    steps.push({
      stepId,
      title: action.title,
      description,
      status: 'pending',
      agentResponsible: 'action_simulator',
      ...extras,
    });
  });

  steps.push({
    stepId: steps.length + 1,
    title: 'Rescue 1122 / Police notified',
    description: 'CIRO auto-dispatched WhatsApp/SMS to emergency agencies.',
    status: 'pending',
    agentResponsible: 'emergency_dispatcher',
  });

  steps.push({
    stepId: steps.length + 1,
    title: 'System status updated',
    description: 'Crisis dashboard + map markers updated.',
    status: 'pending',
    agentResponsible: 'action_simulator',
  });

  if (!db) return { crisisId, stepsExecuted: 0 };

  await db.ref(`simulation_state/${crisisId}`).set({
    currentStep: 1,
    totalSteps: steps.length,
    steps,
    startedAt: Date.now(),
  });

  // Step-through with delays (demo: 1.5s per step; set CIRO_FAST_SIM=1 for instant)
  const fast = process.env.CIRO_FAST_SIM === '1';
  for (let i = 1; i < steps.length; i++) {
    if (!fast) await sleep(1500 + Math.random() * 800);

    await db.ref(`simulation_state/${crisisId}/steps/${i}/status`).set('in_progress');
    await db.ref(`simulation_state/${crisisId}/currentStep`).set(i + 1);

    if (steps[i].actionType === 'emergency_dispatch' && steps[i].ticketId) {
      await db.ref(`emergency_tickets/${steps[i].ticketId}`).set({
        crisisId,
        agency: 'Rescue 1122',
        type: `${type}_rescue`,
        location,
        locationCoords,
        status: 'dispatched',
        createdAt: Date.now(),
        createdBy: 'action_simulator_agent',
      });
      await db.ref('admin_stats/emergencyTicketsCreated').transaction((n) => (n || 0) + 1);
    }

    if (!fast) await sleep(fast ? 0 : 1000);

    await db.ref(`simulation_state/${crisisId}/steps/${i}`).update({
      status: 'completed',
      completedAt: Date.now(),
    });

    const actionIndex = actions.findIndex((a) => a.id === steps[i].actionId);
    if (actionIndex >= 0) {
      await db.ref(`response_plans/${crisisId}/actions/${actionIndex}`).update({
        status: 'executed',
        simulatedAt: Date.now(),
      });
    }

    await db.ref('action_log').push({
      agent: 'action_simulator',
      crisisId,
      action: 'action_simulated',
      detail: `Step ${i + 1}/${steps.length}: ${steps[i].title}`,
      severity: 'info',
      timestamp: Date.now(),
    });
  }

  await dispatchToAgencies(crisis, situation, responsePlan);

  const detection = {
    active: true,
    situationType: type,
    situationLabel: type,
    confidence: crisis.confidence,
    severity: crisis.severity,
    explanationEnglish: crisis.confidenceReason,
  };
  const plan = {
    actions,
    blockedRouteId: null,
    alternateRouteId: actions.find((a) => a.alternateRoute)?.alternateRoute,
    alternateRoad: 'N55',
    etaExtraMinutes: 25,
  };
  await simulateActions(location, detection, plan);

  const areaKey = normalizeAreaKey(location);
  await sendAreaPushNotification(areaKey, 'khareedar', {
    title: `CIRO: ${type}`,
    body: situation.impactSummary?.slice(0, 100) || 'Crisis response active',
    type: 'crisis_alert',
  });

  await db.ref(`simulation_state/${crisisId}/completedAt`).set(Date.now());

  return { crisisId, stepsExecuted: steps.length };
}

module.exports = { simulateExecution };
