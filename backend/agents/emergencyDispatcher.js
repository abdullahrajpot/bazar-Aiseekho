/**
 * Notify Rescue 1122, Police (15), Fire (16), Edhi (115) via WhatsApp + Firebase log.
 */

const { db } = require('../lib/firebase-admin');
const { sendWhatsAppMessage } = require('./dispatchAgent');

const AGENCIES = [
  { id: 'rescue_1122', name: 'Rescue 1122', phone: '1122', shortCode: '1122' },
  { id: 'police', name: 'Police Emergency', phone: '15', shortCode: '15' },
  { id: 'fire', name: 'Fire Brigade', phone: '16', shortCode: '16' },
  { id: 'edhi', name: 'Edhi Ambulance', phone: '115', shortCode: '115' },
];

function getDispatchPhone(agencyId) {
  const envMap = {
    rescue_1122: process.env.RESCUE_1122_DISPATCH_PHONE || process.env.CIRO_ALERT_PHONE,
    police: process.env.POLICE_DISPATCH_PHONE,
    fire: process.env.FIRE_DISPATCH_PHONE,
    edhi: process.env.EDHI_DISPATCH_PHONE,
  };
  return envMap[agencyId] || process.env.DISPATCH_DRIVER_PHONE;
}

async function dispatchToAgencies(crisis, situation, plan) {
  if (!db) return [];

  const { crisisId, type, location, locationCoords, severity } = crisis;
  const dispatchLog = [];
  const agenciesToNotify =
    type === 'accident'
      ? ['rescue_1122', 'police', 'edhi']
      : type === 'flood' || type === 'urban_flooding'
        ? ['rescue_1122', 'police']
        : ['rescue_1122', 'police'];

  const messageBase =
    `*BAZAR CIRO EMERGENCY*\n` +
    `Type: ${type}\n` +
    `Location: ${location}\n` +
    `Severity: ${severity}\n` +
    `Impact: ${situation?.impactSummary || 'See app'}\n` +
    `Coords: ${locationCoords?.lat || '—'}, ${locationCoords?.lng || '—'}\n` +
    `Ticket ref: ${crisisId}\n` +
    `Auto-dispatch by CIRO agent.`;

  for (const agencyId of agenciesToNotify) {
    const agency = AGENCIES.find((a) => a.id === agencyId);
    if (!agency) continue;

    const dispatchId = db.ref('emergency_dispatches').push().key;
    const targetPhone = getDispatchPhone(agencyId);

    let channel = 'simulated';
    let sent = false;

    if (targetPhone) {
      sent = await sendWhatsAppMessage(
        targetPhone,
        `${messageBase}\n\nPlease respond — ${agency.name} (${agency.shortCode})`
      );
      channel = sent ? 'whatsapp' : 'whatsapp_failed';
    }

    const record = {
      dispatchId,
      crisisId,
      agency: agency.name,
      agencyPhone: agency.shortCode,
      type: `${type}_dispatch`,
      location,
      locationCoords: locationCoords || null,
      status: sent ? 'notified' : 'simulated_logged',
      channel,
      messagePreview: messageBase.slice(0, 200),
      createdAt: Date.now(),
      createdBy: 'emergency_dispatcher_agent',
    };

    await db.ref(`emergency_dispatches/${dispatchId}`).set(record);
    dispatchLog.push(record);

    await db.ref('action_log').push({
      agent: 'emergency_dispatcher',
      crisisId,
      action: sent ? 'agency_notified' : 'agency_simulated',
      detail: `${agency.name} (${agency.shortCode}) — ${sent ? 'WhatsApp sent' : 'logged for demo'}`,
      severity: 'critical',
      timestamp: Date.now(),
    });
  }

  await db.ref('admin_stats/emergencyDispatches').transaction((n) => (n || 0) + dispatchLog.length);

  return dispatchLog;
}

module.exports = { dispatchToAgencies, AGENCIES };
