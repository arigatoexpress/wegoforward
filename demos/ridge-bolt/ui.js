'use strict';
let session = LeadFollowupDemo.createSession();
const byId = id => document.getElementById(id);
const emptyDraft = 'Your follow-up draft will appear here.\n\nA person would approve any real reply. Nothing is sent from this page.';
function fieldError(id, message = '') {
  const field = byId(id);
  const error = byId(`${id}-error`);
  if (!field || !error) return;
  error.textContent = message;
  error.hidden = !message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
}
function clearDraft() { byId('draft').textContent = emptyDraft; }
function edited(id) {
  clearDraft();
  fieldError(id);
  byId('status').textContent = 'Details changed. Prepare a draft to review the current follow-up.';
}
for (const id of ['customerName', 'email', 'enquiry', 'windowId']) {
  byId(id).addEventListener('input', () => edited(id));
  byId(id).addEventListener('change', () => edited(id));
}
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => {
  const sample = JSON.parse(button.dataset.sample);
  byId('customerName').value = sample.customerName;
  byId('email').value = sample.email;
  byId('enquiry').value = sample.enquiry;
  byId('windowId').value = sample.windowId;
  edited('enquiry');
  byId('status').textContent = 'Sample loaded. Prepare an unsent follow-up draft to review it.';
}));
byId('prepare').addEventListener('click', () => {
  const result = session.prepare({
    customerName: byId('customerName').value,
    email: byId('email').value,
    enquiry: byId('enquiry').value,
    windowId: byId('windowId').value
  });
  for (const id of ['customerName', 'email', 'enquiry', 'windowId']) {
    fieldError(id, result.errors?.[id]);
  }
  if (result.status === 'invalid') {
    clearDraft();
    byId('status').textContent = result.text;
    byId(Object.keys(result.errors)[0]).focus();
    return;
  }
  byId('status').textContent = result.status === 'duplicate'
    ? `Duplicate email: the original unsent follow-up is shown. ${session.count()} follow-up in this session.`
    : `Unsent follow-up prepared for ${result.draft.scheduledFor}. ${session.count()} follow-up in this session. Nothing sent.`;
  byId('draft').textContent =
    `To: ${result.draft.to}\nSubject: ${result.draft.subject}\nStatus: unsent\nWindow: ${result.draft.windowId}\nWhen: ${result.draft.scheduledFor}\n\n${result.draft.body}`;
});
const emptyTimeline = 'A synthetic lead timeline will appear here.\n\nNothing is sent from this page.';
function renderTimeline(plan) {
  const lines = [
    'DRAFT - NOT SENT',
    `Fictional lead: ${plan.lead.customerName}`,
    `Channel: ${plan.lead.channel === 'missed_call' ? 'missed call' : 'web form'}`
  ];
  if (plan.lead.phone) lines.push(`Phone supplied: ${plan.lead.phone}`);
  if (plan.lead.email) lines.push(`Email supplied: ${plan.lead.email}`);
  lines.push(`Enquiry received: ${plan.lead.receivedAt}`, `Fictional shop clock: ${plan.now}`, '', 'Events:');
  if (!plan.timeline.length) lines.push('(none)');
  for (const event of plan.timeline) {
    lines.push(`- ${event.type} at ${event.at}${event.text ? `: ${event.text}` : ''}`);
  }
  lines.push('', `Scheduled drafts: ${plan.touches.length} of ${plan.touchCap}`);
  if (!plan.touches.length) lines.push('No drafts scheduled.');
  plan.touches.forEach((touch, index) => {
    lines.push(
      '',
      `Touch ${index + 1}: ${touch.label}`,
      `When: ${touch.scheduledFor}`,
      'Status: unsent',
      `Due at this clock: ${touch.due ? 'yes' : 'not yet'}`
    );
    if (touch.quietHoursShifted) lines.push('Quiet hours: moved to the next fictional open morning (Monday–Friday, 8am).');
    lines.push('', touch.body);
  });
  if (plan.stopped.length) {
    lines.push('', 'Stopped:');
    for (const stop of plan.stopped) {
      lines.push(`- ${stop.label}: ${stop.reason}${stop.at ? ` at ${stop.at}` : ''}`);
    }
  }
  return lines.join('\n');
}
function showTimeline(id) {
  const fixture = LeadFollowupDemo.fixtures().find(item => item.id === id);
  if (!fixture) return;
  const plan = LeadFollowupDemo.planFollowUps(fixture.lead, fixture.events, fixture.clock);
  if (plan.status !== 'planned') {
    byId('timeline-status').textContent = plan.text;
    byId('timeline').textContent = emptyTimeline;
    return;
  }
  const count = plan.touches.length;
  byId('timeline-status').textContent = `${count} unsent draft${count === 1 ? '' : 's'} on this timeline. Nothing sent.`;
  byId('timeline').textContent = renderTimeline(plan);
}
document.querySelectorAll('[data-timeline]').forEach(button => {
  if (!button.dataset || !button.dataset.timeline) return;
  button.addEventListener('click', () => showTimeline(button.dataset.timeline));
});
byId('reset').addEventListener('click', () => {
  session = LeadFollowupDemo.createSession();
  byId('customerName').value = '';
  byId('email').value = '';
  byId('enquiry').value = '';
  byId('windowId').value = '';
  for (const id of ['customerName', 'email', 'enquiry', 'windowId']) fieldError(id);
  byId('status').textContent = 'Demo reset. No follow-ups retained.';
  clearDraft();
  byId('timeline').textContent = emptyTimeline;
  byId('timeline-status').textContent = 'Choose a synthetic timeline. Drafts stay unsent.';
  byId('customerName').focus();
});
