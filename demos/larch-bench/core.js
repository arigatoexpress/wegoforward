(function (root) {
  'use strict';
  // Demo #4: unsent repair-status drafts for a fictional appliance bench.
  // Distinct from the lead-follow-up demo. Nothing is sent.
  const SHOP = 'Larch Bench Appliance Repair';
  const OPEN_HOURS = Object.freeze({
    label: 'Fictional hours: Monday–Friday, 8am–5pm.',
    nextOpenLabel: 'next open morning (Monday 8am fictional)'
  });
  const STATUSES = Object.freeze({
    parts_arrived: Object.freeze({
      id: 'parts_arrived',
      label: 'Parts arrived',
      subject: 'Draft: parts arrived (unsent)',
      line: 'The ordered part is in at the fictional shop. A person would confirm before anyone is told it is ready.'
    }),
    ready_for_pickup: Object.freeze({
      id: 'ready_for_pickup',
      label: 'Ready for pickup',
      subject: 'Draft: ready for pickup (unsent)',
      line: 'The repair is marked ready for pickup on the fictional ticket. A person would confirm the bench note before anyone is told to come in.'
    })
  });
  const HOUR_MS = 60 * 60 * 1000;
  const OPEN_START = 8 * 3600;
  const OPEN_END = 17 * 3600;

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

  function fictionalPhone(value) {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
    const phone = value.trim();
    return /^555-01\d{2}$/.test(phone) ? phone : null;
  }

  function ticketId(value) {
    if (typeof value !== 'string') return null;
    const id = value.trim().toUpperCase();
    return /^LB-\d{4}$/.test(id) ? id : null;
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

  function bodyFor(status, ticket) {
    return [
      `Hello ${ticket.customerName},`,
      '',
      status.line,
      '',
      `Ticket: ${ticket.ticketId}`,
      `Item: ${ticket.item}`,
      `Note: ${ticket.note}`,
      ticket.email ? `Email supplied: ${ticket.email}` : `Phone supplied: ${ticket.phone}`,
      '',
      `Shop hours (fictional): ${OPEN_HOURS.label}`,
      'This draft states no price and books nothing.',
      'Sender: filled in during a real setup',
      'Business: filled in during a real setup',
      'Reply-to: filled in during a real setup',
      '',
      'Nothing was sent, booked, or texted.'
    ].join('\n');
  }

  function createSession() {
    const drafts = new Map();
    return Object.freeze({
      hours: () => OPEN_HOURS.label,
      statuses: () => Object.values(STATUSES).map(status => ({ id: status.id, label: status.label })),
      prepare(input) {
        const customerName = cleanText(input && input.customerName, 80);
        const email = emailAddress(input && input.email);
        const item = cleanText(input && input.item, 120);
        const note = cleanText(input && input.note, 500);
        const id = ticketId(input && input.ticketId);
        const statusId = typeof (input && input.statusId) === 'string' ? input.statusId : '';
        const status = Object.hasOwn(STATUSES, statusId) ? STATUSES[statusId] : null;
        const errors = {};
        if (!customerName) errors.customerName = 'Enter a fictional customer name (1–80 characters).';
        if (!email) errors.email = 'Enter a complete fictional email, such as ada@example.test.';
        if (!item) errors.item = 'Enter the appliance on the ticket (1–120 characters).';
        if (!note) errors.note = 'Enter the bench note (1–500 characters).';
        if (!id) errors.ticketId = 'Enter a fictional ticket id like LB-1001.';
        if (!status) errors.statusId = 'Choose parts arrived or ready for pickup.';
        if (Object.keys(errors).length) {
          return { status: 'invalid', text: Object.values(errors).join(' '), errors, sent: false };
        }
        const key = `${id}:${status.id}`;
        const existing = drafts.get(key);
        if (existing) return { status: 'duplicate', draft: { ...existing }, sent: false };
        const draft = Object.freeze({
          to: email,
          ticketId: id,
          status: 'unsent',
          statusId: status.id,
          subject: status.subject,
          shop: SHOP,
          body: bodyFor(status, { customerName, ticketId: id, item, note, email })
        });
        drafts.set(key, draft);
        return { status: 'prepared', draft: { ...draft }, sent: false };
      },
      count: () => drafts.size
    });
  }

  function stopReason(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (/^stop$/i.test(trimmed)) return 'opt_out';
    if (/^picked up$/i.test(trimmed)) return 'picked_up';
    return null;
  }

  function planStatus(input) {
    const errors = {};
    const customerName = cleanText(input && input.customerName, 80);
    const item = cleanText(input && input.item, 120);
    const note = cleanText(input && input.note, 500);
    const id = ticketId(input && input.ticketId);
    const statusId = typeof (input && input.statusId) === 'string' ? input.statusId : '';
    const status = Object.hasOwn(STATUSES, statusId) ? STATUSES[statusId] : null;
    const markedAt = parseStamp(input && input.markedAt);
    const now = parseStamp(input && input.now);
    const phoneSupplied = typeof (input && input.phone) === 'string' && input.phone.trim() !== '';
    const emailSupplied = typeof (input && input.email) === 'string' && input.email.trim() !== '';
    const phone = phoneSupplied ? fictionalPhone(input.phone) : null;
    const email = emailSupplied ? emailAddress(input.email) : null;
    if (!customerName) errors.customerName = 'Enter a fictional customer name (1–80 characters).';
    if (!item) errors.item = 'Enter the appliance on the ticket (1–120 characters).';
    if (!note) errors.note = 'Enter the bench note (1–500 characters).';
    if (!id) errors.ticketId = 'Enter a fictional ticket id like LB-1001.';
    if (!status) errors.statusId = 'Choose parts arrived or ready for pickup.';
    if (markedAt === null) errors.markedAt = 'Enter when the bench marked the ticket as YYYY-MM-DDTHH:mm:ssZ.';
    if (now === null) errors.now = 'Provide a fictional shop-clock stamp YYYY-MM-DDTHH:mm:ssZ.';
    if (!phone && !email) errors.contact = 'Supply a fictional 555-01xx phone or an email such as ada@example.test. This demo does not infer one.';
    if (phoneSupplied && !phone) errors.phone = 'Use a fictional number in the form 555-01xx.';
    if (emailSupplied && !email) errors.email = 'Enter a complete fictional email, such as ada@example.test.';
    const reply = typeof (input && input.reply) === 'string' ? input.reply : '';
    if (reply.length > 280) errors.reply = 'Reply text must be at most 280 characters.';
    if (Object.keys(errors).length) {
      return Object.freeze({ status: 'invalid', sent: false, text: Object.values(errors).join(' '), errors: Object.freeze({ ...errors }) });
    }
    const reason = stopReason(reply) || stopReason(note);
    const raw = markedAt + HOUR_MS;
    const scheduled = shiftToOpen(raw);
    if (reason) {
      return Object.freeze({
        status: 'stopped',
        sent: false,
        reason,
        ticketId: id,
        statusId: status.id,
        draft: null
      });
    }
    const draft = Object.freeze({
      to: email || phone,
      ticketId: id,
      status: 'unsent',
      statusId: status.id,
      subject: status.subject,
      shop: SHOP,
      scheduledFor: formatStamp(scheduled),
      quietHoursShifted: scheduled !== raw,
      due: scheduled <= now,
      body: bodyFor(status, { customerName, ticketId: id, item, note, email, phone })
    });
    return Object.freeze({ status: 'planned', sent: false, draft, shop: SHOP });
  }

  const FIXTURE_LIST = Object.freeze([
    Object.freeze({
      id: 'parts_arrived',
      label: 'Parts arrived',
      ticket: Object.freeze({
        customerName: 'Ada Example',
        ticketId: 'LB-1001',
        statusId: 'parts_arrived',
        item: 'Fictional dishwasher pump',
        note: 'Part is on the bench. Not installed yet.',
        email: 'ada@example.test',
        markedAt: '2026-10-08T15:00:00Z',
        now: '2026-10-08T16:30:00Z'
      })
    }),
    Object.freeze({
      id: 'ready_for_pickup',
      label: 'Ready for pickup',
      ticket: Object.freeze({
        customerName: 'Blake Example',
        ticketId: 'LB-1002',
        statusId: 'ready_for_pickup',
        item: 'Fictional dryer belt',
        note: 'Belt replaced. Ready for pickup during fictional open hours.',
        phone: '555-0102',
        markedAt: '2026-10-08T14:00:00Z',
        now: '2026-10-08T16:00:00Z'
      })
    }),
    Object.freeze({
      id: 'after_close',
      label: 'After close',
      ticket: Object.freeze({
        customerName: 'Casey Example',
        ticketId: 'LB-1003',
        statusId: 'ready_for_pickup',
        item: 'Fictional washer lid switch',
        note: 'Switch swapped after close.',
        email: 'casey@example.test',
        markedAt: '2026-10-09T16:30:00Z',
        now: '2026-10-09T17:30:00Z'
      })
    }),
    Object.freeze({
      id: 'opt_out',
      label: 'STOP',
      ticket: Object.freeze({
        customerName: 'Dana Example',
        ticketId: 'LB-1004',
        statusId: 'parts_arrived',
        item: 'Fictional range igniter',
        note: 'Part arrived.',
        email: 'dana@example.test',
        reply: 'STOP',
        markedAt: '2026-10-08T15:00:00Z',
        now: '2026-10-08T16:30:00Z'
      })
    }),
    Object.freeze({
      id: 'picked_up',
      label: 'Already picked up',
      ticket: Object.freeze({
        customerName: 'Eden Example',
        ticketId: 'LB-1005',
        statusId: 'ready_for_pickup',
        item: 'Fictional fridge fan',
        note: 'Picked up',
        phone: '555-0105',
        markedAt: '2026-10-08T15:00:00Z',
        now: '2026-10-08T16:30:00Z'
      })
    })
  ]);

  function fixtures() {
    return JSON.parse(JSON.stringify(FIXTURE_LIST));
  }

  const api = Object.freeze({ createSession, planStatus, fixtures, shop: () => SHOP });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RepairStatusDemo = api;
})(globalThis);
