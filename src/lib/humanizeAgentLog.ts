/** Turn agent jargon into plain language for citizens */

export interface HumanAlert {
  title: string;
  detail: string;
  meta?: string;
}

export function humanizeAgentMessage(
  agent: string,
  action: string,
  detail: string
): HumanAlert {
  const d = detail || '';
  const a = (action || '').toLowerCase();

  if (a.includes('trucks_rerouted') || d.toLowerCase().includes('trucks via')) {
    const count = d.match(/(\d+)\s*truck/i)?.[1] || 'Some';
    const road = d.match(/via\s+([^.]+)/i)?.[1]?.trim() || 'a safer road';
    const eta = d.match(/ETA\s*\+?\s*(\d+)/i)?.[1];
    return {
      title: 'Supply trucks rerouted',
      detail: `${count} trucks carrying food & essentials are now using ${road} to reach your area.`,
      meta: eta ? `About ${eta} minutes slower than usual` : 'Delivery may take a bit longer',
    };
  }

  if (a.includes('route_recommendation') || agent.includes('supply_router')) {
    return {
      title: 'Safer route suggested',
      detail: d.replace(/_/g, ' '),
      meta: 'Check the Map tab for green (clear) and blue (alternate) lines',
    };
  }

  if (agent.includes('rumour') || agent.includes('truth')) {
    return {
      title: 'Rumour checked',
      detail: d,
      meta: 'See Khabar tab for full truth check',
    };
  }

  if (agent.includes('crisis') || agent.includes('emergency')) {
    return {
      title: 'Crisis update',
      detail: d,
      meta: 'Rescue 1122 & police may already be notified',
    };
  }

  if (a.includes('surveillance') || a.includes('monitoring')) {
    return {
      title: 'Agents watching your area',
      detail: d,
    };
  }

  return {
    title: (agent || 'Agent').replace(/_/g, ' '),
    detail: d || 'Update from live monitoring',
    meta: action ? action.replace(/_/g, ' ') : undefined,
  };
}

export function humanizeRouteStatus(status: string, routeName: string, extraMin?: number): string {
  const name = routeName || 'This road';
  switch (status) {
    case 'blocked':
    case 'disrupted':
      return `${name} is blocked — do not use this route`;
    case 'partial':
    case 'rerouted':
      return extraMin
        ? `${name} has delays (~${extraMin} min slower)`
        : `${name} is slow — consider the blue alternate route`;
    case 'clear':
    default:
      return `${name} is clear — safe to travel`;
  }
}
