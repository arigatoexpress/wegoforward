(function (root) {
  'use strict';
  const OPEN_HOURS = Object.freeze({
    label: 'Fictional hours: Monday–Friday, 8am–5pm.',
    nextOpenLabel: 'next open morning (Monday 8am fictional)'
  });
  const WINDOWS = Object.freeze({
    same_day: Object.freeze({
      id: 'same_day',
      label: 'Same-day close-of-business',
      when: 'today at 4:45pm (fictional local time)'
    }),
    next_open: Object.freeze({
      id: 'next_open',
      label: 'Next open morning',
      when: OPEN_HOURS.nextOpenLabel
    }),
    two_day: Object.freeze({
      id: 'two_day',
      label: 'Two business days',
      when: 'in two fictional business days at 9am'
    })
  });
  const cleanText = (value, max) =>
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max
      ? value.trim()
      : null;
  function emailAddress(value) {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
    const email = value.trim().toLowerCase();
    if (email.length > 254) return null;
    const parts = email.split('@');
    if (parts.length !== 2) return null;
    const [local, domain] = parts;
    if (
      !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(local) ||
      local.startsWith('.') ||
      local.endsWith('.') ||
      local.includes('..')
    ) {
      return null;
    }
    const labels = domain.split('.');
    if (
      labels.length < 2 ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/^[a-z]{2,63}$/.test(labels.at(-1))
    ) {
      return null;
    }
    return email;
  }
  function createSession() {
    const followUps = new Map();
    return Object.freeze({
      hours: () => OPEN_HOURS.label,
      windows: () => Object.values(WINDOWS).map(w => ({ ...w })),
      prepare(input) {
        const customerName = cleanText(input?.customerName, 80);
        const email = emailAddress(input?.email);
        const enquiry = cleanText(input?.enquiry, 1000);
        const windowId = typeof input?.windowId === 'string' ? input.windowId : '';
        const window = Object.hasOwn(WINDOWS, windowId) ? WINDOWS[windowId] : null;
        const errors = {};
        if (!customerName) errors.customerName = 'Enter a fictional customer name (1–80 characters).';
        if (!email) errors.email = 'Enter a complete fictional email, such as ada@example.test.';
        if (!enquiry) errors.enquiry = 'Enter the original enquiry (1–1,000 characters).';
        if (!window) errors.windowId = 'Choose one of the three follow-up windows.';
        if (Object.keys(errors).length) {
          return {
            status: 'invalid',
            text: Object.values(errors).join(' '),
            errors,
            sent: false
          };
        }
        const existing = followUps.get(email);
        if (existing) {
          return { status: 'duplicate', draft: { ...existing }, sent: false };
        }
        const draft = Object.freeze({
          to: email,
          status: 'unsent',
          windowId: window.id,
          scheduledFor: window.when,
          subject: 'Draft: repair-shop lead follow-up (unsent)',
          body:
            `Hello ${customerName},\n\n` +
            `Thanks for the note you left for Ridge Bolt Small Engine (fictional shop).\n\n` +
            `Your enquiry:\n${enquiry}\n\n` +
            `A person at the shop would review this and reply around ${window.when}. ` +
            `This demo has prepared an unsent follow-up only.\n\n` +
            `Shop hours (fictional): ${OPEN_HOURS.label}\n` +
            `Sender: filled in during a real setup\n` +
            `Business: filled in during a real setup\n` +
            `Reply-to: filled in during a real setup\n\n` +
            `Nothing was sent, booked, or texted.`
        });
        followUps.set(email, draft);
        return { status: 'prepared', draft: { ...draft }, sent: false };
      },
      count: () => followUps.size
    });
  }

  // Follow-up flow. Stamps are a fictional shop clock written as UTC
  // (YYYY-MM-DDTHH:mm:ssZ) so quiet hours do not depend on the host timezone.
  // Outside Monday–Friday 08:00–17:00, a touch moves to the next open morning.
  // Drafts stay unsent. The sender name, business name and reply-to address are filled in during a real setup. No prices are stated.
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;
  const MAX_TOUCHES = 3;
  const OPEN_START = 8 * 3600;
  const OPEN_END = 17 * 3600;
  const CADENCE = Object.freeze([
    Object.freeze({ id: 'acknowledgement', label: 'Acknowledgement', offsetMs: HOUR_MS }),
    Object.freeze({ id: 'quote_nudge', label: 'Quote nudge', offsetMs: 2 * DAY_MS }),
    Object.freeze({ id: 'last_check_in', label: 'Last check-in', offsetMs: 7 * DAY_MS })
  ]);
  const EVENT_TYPES = new Set(['quote_sent', 'replied', 'booked', 'gone_quiet', 'opt_out', 'stop']);
  const STOP_RANK = Object.freeze({ opt_out: 0, booked: 1, reply: 2 });
  const FIXTURE_LIST = Object.freeze([
    Object.freeze({
      id: 'quiet',
      label: 'Gone quiet',
      lead: Object.freeze({
        customerName: 'Ada Example',
        channel: 'missed_call',
        phone: '555-0101',
        enquiry: 'Stuck pull cord on a fictional mower.',
        receivedAt: '2026-10-06T15:00:00Z'
      }),
      events: Object.freeze([
        Object.freeze({ type: 'quote_sent', at: '2026-10-06T16:30:00Z' }),
        Object.freeze({ type: 'gone_quiet', at: '2026-10-08T15:00:00Z' })
      ]),
      clock: Object.freeze({ now: '2026-10-14T15:00:00Z' })
    }),
    Object.freeze({
      id: 'replied',
      label: 'Customer replied',
      lead: Object.freeze({
        customerName: 'Blake Example',
        channel: 'missed_call',
        phone: '555-0102',
        enquiry: 'Need a look at a chainsaw chain before the weekend.',
        receivedAt: '2026-10-06T15:00:00Z'
      }),
      events: Object.freeze([
        Object.freeze({ type: 'replied', at: '2026-10-06T18:00:00Z', text: 'Yes, please look at the chainsaw.' })
      ]),
      clock: Object.freeze({ now: '2026-10-14T15:00:00Z' })
    }),
    Object.freeze({
      id: 'booked',
      label: 'Booked',
      lead: Object.freeze({
        customerName: 'Casey Example',
        channel: 'web_form',
        email: 'casey@example.test',
        enquiry: 'Generator will not start after sitting all winter.',
        receivedAt: '2026-10-06T15:00:00Z'
      }),
      events: Object.freeze([
        Object.freeze({ type: 'booked', at: '2026-10-06T15:30:00Z' })
      ]),
      clock: Object.freeze({ now: '2026-10-14T15:00:00Z' })
    }),
    Object.freeze({
      id: 'opt_out',
      label: 'Customer opted out',
      lead: Object.freeze({
        customerName: 'Dana Example',
        channel: 'missed_call',
        phone: '555-0104',
        enquiry: 'Can you look at a snowblower that will not start?',
        receivedAt: '2026-10-06T15:00:00Z'
      }),
      events: Object.freeze([
        Object.freeze({ type: 'replied', at: '2026-10-06T15:10:00Z', text: 'STOP' })
      ]),
      clock: Object.freeze({ now: '2026-10-14T15:00:00Z' })
    }),
    Object.freeze({
      id: 'after_close',
      label: 'After close',
      lead: Object.freeze({
        customerName: 'Eden Example',
        channel: 'missed_call',
        phone: '555-0105',
        enquiry: 'Mower sat all winter and will not turn over.',
        receivedAt: '2026-10-09T16:30:00Z'
      }),
      events: Object.freeze([]),
      clock: Object.freeze({ now: '2026-10-16T16:45:00Z' })
    })
  ]);

  function personName(value) {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
    return cleanText(value, 80);
  }
  function fictionalPhone(value) {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
    const phone = value.trim();
    return /^555-01\d{2}$/.test(phone) ? phone : null;
  }
  function formatStamp(ms) {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  function parseStamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return null;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms) || formatStamp(ms) !== value) return null;
    return ms;
  }
  function shiftToOpen(ms) {
    const date = new Date(ms);
    const day = date.getUTCDay();
    const seconds = date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
    const weekend = day === 0 || day === 6;
    if (!weekend && seconds >= OPEN_START && seconds < OPEN_END) return ms;
    const shifted = new Date(ms);
    shifted.setUTCHours(8, 0, 0, 0);
    if (weekend || seconds >= OPEN_END) shifted.setUTCDate(shifted.getUTCDate() + 1);
    while (shifted.getUTCDay() === 0 || shifted.getUTCDay() === 6) {
      shifted.setUTCDate(shifted.getUTCDate() + 1);
    }
    return shifted.getTime();
  }
  function stopReason(event) {
    const text = typeof event.text === 'string' ? event.text.trim() : '';
    if (event.type === 'opt_out' || event.type === 'stop' || /^stop$/i.test(text)) return 'opt_out';
    if (event.type === 'replied') return 'reply';
    if (event.type === 'booked') return 'booked';
    return null;
  }
  function messageBody(kind, lead) {
    const intro = {
      acknowledgement: 'This unsent draft acknowledges the repair enquiry. A person at the shop would review it.',
      quote_nudge: 'This unsent draft checks whether a person should still look at the repair enquiry. This draft states no price.',
      last_check_in: "This is our last scheduled check-in about your repair enquiry. Thanks for considering us, and we're here whenever you need us."
    }[kind];
    const lines = [
      `Hello ${lead.customerName},`,
      '',
      intro,
      '',
      `Channel: ${lead.channel === 'missed_call' ? 'missed call' : 'web form'}`
    ];
    if (lead.phone) lines.push(`Phone supplied: ${lead.phone}`);
    if (lead.email) lines.push(`Email supplied: ${lead.email}`);
    lines.push(
      '',
      'Enquiry:',
      lead.enquiry,
      '',
      'Sender: filled in during a real setup',
      'Business: filled in during a real setup',
      'Reply-to: filled in during a real setup',
      '',
      'Nothing was sent, booked, or texted.'
    );
    return lines.join('\n');
  }
  function invalidPlan(errors) {
    return Object.freeze({
      status: 'invalid',
      sent: false,
      touchCap: MAX_TOUCHES,
      text: Object.values(errors).join(' '),
      errors: Object.freeze({ ...errors }),
      timeline: Object.freeze([]),
      touches: Object.freeze([]),
      stopped: Object.freeze([])
    });
  }
  function planFollowUps(lead, events, clock) {
    const errors = {};
    if (!lead || typeof lead !== 'object') errors.lead = 'Provide a synthetic lead.';
    const customerName = personName(lead?.customerName);
    const enquiry = cleanText(lead?.enquiry, 1000);
    const channel = lead?.channel === 'missed_call' || lead?.channel === 'web_form' ? lead.channel : null;
    const receivedAt = parseStamp(lead?.receivedAt);
    const now = clock && typeof clock === 'object' ? parseStamp(clock.now) : null;
    if (!customerName) errors.customerName = 'Enter a fictional customer name (1–80 characters).';
    if (!channel) errors.channel = 'Choose missed_call or web_form.';
    const phoneSupplied = typeof lead?.phone === 'string' && lead.phone.trim() !== '';
    const emailSupplied = typeof lead?.email === 'string' && lead.email.trim() !== '';
    const phone = phoneSupplied ? fictionalPhone(lead.phone) : null;
    const email = emailSupplied ? emailAddress(lead.email) : null;
    if (phoneSupplied && !phone) errors.phone = 'Use a fictional number in the form 555-01xx.';
    if (!phoneSupplied && channel === 'missed_call') {
      errors.phone = 'Enter the fictional 555-01xx number supplied with the missed call. This demo does not infer one.';
    }
    if (emailSupplied && !email) errors.email = 'Enter a complete fictional email, such as ada@example.test.';
    if (!emailSupplied && channel === 'web_form') {
      errors.email = 'Enter the fictional email supplied with the web form. This demo does not infer one.';
    }
    if (!enquiry) errors.enquiry = 'Enter the repair enquiry (1–1,000 characters).';
    if (receivedAt === null) errors.receivedAt = 'Enter when the enquiry arrived as YYYY-MM-DDTHH:mm:ssZ (fictional shop clock).';
    if (now === null) errors.now = 'Provide a fictional shop-clock stamp YYYY-MM-DDTHH:mm:ssZ.';
    if (!Array.isArray(events) || events.length > 20) {
      errors.events = 'Provide a list of up to 20 events. An empty list is allowed.';
    }
    const parsed = [];
    if (Array.isArray(events) && events.length <= 20) {
      for (const event of events) {
        if (!event || typeof event !== 'object' || !EVENT_TYPES.has(event.type) || parseStamp(event.at) === null) {
          errors.events = 'Each event needs a known type and a YYYY-MM-DDTHH:mm:ssZ stamp.';
          break;
        }
        if (event.text !== undefined && (typeof event.text !== 'string' || event.text.length > 280)) {
          errors.events = 'Event text must be plain text of at most 280 characters.';
          break;
        }
        parsed.push({
          type: event.type,
          at: event.at,
          atMs: parseStamp(event.at),
          text: typeof event.text === 'string' ? event.text.trim() : ''
        });
      }
    }
    if (Object.keys(errors).length) return invalidPlan(errors);
    parsed.sort((a, b) => a.atMs - b.atMs || a.type.localeCompare(b.type));
    const stops = parsed
      .filter(event => stopReason(event))
      .map(event => ({ atMs: event.atMs, at: event.at, reason: stopReason(event) }));
    if (/^stop$/i.test(enquiry)) stops.push({ atMs: receivedAt, at: formatStamp(receivedAt), reason: 'opt_out' });
    stops.sort((a, b) => a.atMs - b.atMs || STOP_RANK[a.reason] - STOP_RANK[b.reason]);
    const kept = [];
    const stopped = [];
    for (const step of CADENCE) {
      const raw = receivedAt + step.offsetMs;
      const scheduled = shiftToOpen(raw);
      const stop = stops.find(item => item.atMs <= scheduled);
      if (stop) {
        stopped.push({ id: step.id, label: step.label, reason: stop.reason, at: stop.at });
        continue;
      }
      if (kept.length >= MAX_TOUCHES) {
        stopped.push({ id: step.id, label: step.label, reason: 'touch_cap', at: null });
        continue;
      }
      kept.push({
        id: step.id,
        label: step.label,
        status: 'unsent',
        scheduledFor: formatStamp(scheduled),
        quietHoursShifted: scheduled !== raw,
        due: scheduled <= now,
        body: messageBody(step.id, {
          customerName,
          channel,
          phone,
          email,
          enquiry
        })
      });
    }
    return Object.freeze({
      status: 'planned',
      sent: false,
      touchCap: MAX_TOUCHES,
      lead: Object.freeze({
        customerName,
        channel,
        phone,
        email,
        enquiry,
        receivedAt: formatStamp(receivedAt)
      }),
      now: formatStamp(now),
      timeline: Object.freeze(parsed.map(event => Object.freeze({
        type: event.type,
        at: event.at,
        text: event.text || null
      }))),
      touches: Object.freeze(kept.map(touch => Object.freeze(touch))),
      stopped: Object.freeze(stopped.map(item => Object.freeze(item)))
    });
  }
  function fixtures() {
    return JSON.parse(JSON.stringify(FIXTURE_LIST));
  }
  function cadence() {
    return CADENCE.map(step => ({ id: step.id, label: step.label, offsetMs: step.offsetMs }));
  }

  const api = Object.freeze({
    createSession,
    planFollowUps,
    fixtures,
    cadence,
    limits: Object.freeze({ maxTouches: MAX_TOUCHES })
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LeadFollowupDemo = api;
})(globalThis);
