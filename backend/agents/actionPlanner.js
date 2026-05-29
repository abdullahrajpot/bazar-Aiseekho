/**
 * CIRO — Action Planning Agent
 * Generates coordinated response actions from detected crisis.
 */

const { askJson, isConfigured } = require('../lib/groqClient');
const { getAreaRoutes } = require('../lib/areaRoutes');
const supplyGraph = require('../data/supplyGraph.json');

function defaultPlan(detection, areaLabel) {
  const routes = getAreaRoutes(areaLabel);
  const mainRoute = routes[0];
  const altRoute = routes.find((r) => r.road === 'N55' || r.road === 'alt') || routes[1];

  const actions = [];

  if (!detection.active) {
    return {
      actions: [
        {
          id: 'monitor',
          type: 'surveillance',
          priority: 'low',
          description: 'Continue multi-source monitoring',
          descriptionUrdu: 'ذرائع کی نگرانی جاری رکھیں',
        },
      ],
      blockedRouteId: null,
      alternateRouteId: altRoute?.id || null,
      alternateRoad: altRoute?.road || 'N55',
    };
  }

  switch (detection.situationType) {
    case 'urban_flooding':
      actions.push(
        {
          id: 'reroute_traffic',
          type: 'routing',
          priority: 'critical',
          description: `Redirect traffic via ${altRoute?.name || 'alternate bypass'}`,
          descriptionUrdu: 'ٹریفک کو متبادل راستے پر بھیجیں',
        },
        {
          id: 'dispatch_emergency',
          type: 'dispatch',
          priority: 'critical',
          description: 'Dispatch emergency / drainage teams',
          descriptionUrdu: 'ایمرجنسی / ڈرینج ٹیم بھیجیں',
        },
        {
          id: 'public_alert',
          type: 'alert',
          priority: 'high',
          description: 'Push flood alert to users in area',
          descriptionUrdu: 'صارفین کو سیلاب الرٹ بھیجیں',
        }
      );
      break;
    case 'road_blockage':
    case 'accident':
      actions.push(
        {
          id: 'reroute_traffic',
          type: 'routing',
          priority: 'critical',
          description: `Reroute via ${altRoute?.name || 'alternate'}`,
          descriptionUrdu: 'متبادل راستہ استعمال کریں',
        },
        {
          id: 'traffic_alert',
          type: 'alert',
          priority: 'high',
          description: 'Notify drivers and dukandars',
          descriptionUrdu: 'ڈرائیورز اور دکانداروں کو مطلع کریں',
        }
      );
      break;
    case 'earthquake':
      actions.push(
        {
          id: 'safety_alert',
          type: 'alert',
          priority: 'critical',
          description: 'Earthquake safety alert — avoid damaged buildings',
          descriptionUrdu: 'زلزلہ الرٹ — نقصان زدہ عمارتوں سے دور رہیں',
        },
        {
          id: 'dispatch_emergency',
          type: 'dispatch',
          priority: 'critical',
          description: 'Notify Rescue 1122 and district administration',
          descriptionUrdu: 'ریسکیو 1122 اور انتظامیہ کو مطلع کریں',
        }
      );
      break;
    case 'heatwave':
      actions.push(
        {
          id: 'cooling_alert',
          type: 'alert',
          priority: 'medium',
          description: 'Heat advisory + water/LPG supply check',
          descriptionUrdu: 'گرمی انتباہ اور پانی/گیس سپلائی چیک',
        },
        {
          id: 'price_watch',
          type: 'resource',
          priority: 'medium',
          description: 'Monitor price gouging on essentials',
          descriptionUrdu: 'ضروری اشیاء کی قیمتوں پر نظر',
        }
      );
      break;
    default:
      actions.push(
        {
          id: 'coordinate_response',
          type: 'coordination',
          priority: 'high',
          description: 'Coordinate multi-agency response',
          descriptionUrdu: 'مشترکہ ردعمل',
        },
        {
          id: 'public_alert',
          type: 'alert',
          priority: 'high',
          description: 'Area-wide user alert',
          descriptionUrdu: 'علاقائی الرٹ',
        }
      );
  }

  const alt = supplyGraph.alternates?.find((a) => a.brokenRoad === 'M9') || {
    alternateRoute: altRoute?.road || 'N55',
    extraMins: 25,
  };

  return {
    actions,
    blockedRouteId: mainRoute?.id || null,
    alternateRouteId: altRoute?.id || null,
    alternateRoad: alt.alternateRoute || altRoute?.road || 'N55',
    etaExtraMinutes: alt.extraMins || 25,
  };
}

async function planActions(detection, areaLabel) {
  let plan = defaultPlan(detection, areaLabel);

  if (isConfigured && detection.active && process.env.CIRO_USE_GROQ !== '0') {
    try {
      const ai = await askJson(
        `CIRO action planner. Crisis: ${JSON.stringify(detection)}
Area: ${areaLabel}
Return ONLY JSON:
{
  "actions": [{ "id", "type", "priority", "description", "descriptionUrdu" }],
  "blockedRouteId": "string or null",
  "alternateRouteId": "string or null",
  "alternateRoad": "string",
  "etaExtraMinutes": 0
}`,
        500
      );
      if (ai?.actions?.length) plan = { ...plan, ...ai };
    } catch {
      /* defaults */
    }
  }

  return {
    ...plan,
    plannedAt: Date.now(),
    areaLabel,
    situationType: detection.situationType,
  };
}

module.exports = { planActions, defaultPlan };
