(function () {
  'use strict';
  const demo = window.RepairStatusDemo;
  const fields = ['customerName', 'email', 'ticketId', 'item', 'note', 'statusId'];
  const draftEl = document.getElementById('draft');
  const statusEl = document.getElementById('status');
  const timelineEl = document.getElementById('timeline');
  const timelineStatus = document.getElementById('timeline-status');
  const emptyDraft = 'Your status draft will appear here.\n\nA person would approve any real message. Nothing is sent from this page.';
  let session = demo.createSession();

  function text(node, value) {
    node.textContent = value;
  }

  function clearErrors() {
    for (const id of fields) {
      const error = document.getElementById(id + '-error');
      if (!error) continue;
      error.hidden = true;
      text(error, '');
    }
  }

  function clearDraft() {
    text(draftEl, emptyDraft);
  }

  function readInput() {
    const input = {};
    for (const id of fields) input[id] = document.getElementById(id).value;
    return input;
  }

  function invalidateDraft() {
    clearErrors();
    clearDraft();
    text(statusEl, 'Details changed. Prepare a draft to review the current status.');
  }

  function showDraft(result) {
    clearErrors();
    if (result.status === 'invalid') {
      clearDraft();
      text(statusEl, result.text);
      for (const [key, message] of Object.entries(result.errors || {})) {
        const error = document.getElementById(key + '-error');
        if (!error) continue;
        error.hidden = false;
        text(error, message);
      }
      return;
    }
    const draft = result.draft;
    text(statusEl, result.status === 'duplicate' ? 'Kept the first unsent draft for this ticket and status.' : 'Prepared an unsent draft. Nothing was sent.');
    text(draftEl, [
      'To: ' + draft.to,
      'Subject: ' + draft.subject,
      'Status: unsent',
      'Ticket: ' + draft.ticketId,
      '',
      draft.body
    ].join('\n'));
  }

  document.getElementById('prepare').addEventListener('click', function () {
    showDraft(session.prepare(readInput()));
  });

  for (const id of fields) {
    const field = document.getElementById(id);
    field.addEventListener('input', invalidateDraft);
    field.addEventListener('change', invalidateDraft);
  }

  document.querySelectorAll('[data-sample]').forEach(function (button) {
    button.addEventListener('click', function () {
      const sample = JSON.parse(button.getAttribute('data-sample'));
      for (const id of fields) document.getElementById(id).value = sample[id] || '';
      clearErrors();
      clearDraft();
      text(statusEl, 'Sample loaded. Prepare an unsent status draft to review it.');
    });
  });

  document.querySelectorAll('[data-fixture]').forEach(function (button) {
    button.addEventListener('click', function () {
      const id = button.getAttribute('data-fixture');
      const fixture = demo.fixtures().find(function (item) { return item.id === id; });
      const plan = demo.planStatus(fixture.ticket);
      if (plan.status === 'stopped') {
        text(timelineStatus, 'Stopped (' + plan.reason + '). No draft prepared. Nothing was sent.');
        text(timelineEl, 'Ticket ' + plan.ticketId + ': no unsent draft.\nReason: ' + plan.reason);
        return;
      }
      const draft = plan.draft;
      text(timelineStatus, draft.quietHoursShifted ? 'Draft moved to the next fictional open morning. Nothing was sent.' : 'Unsent draft prepared. Nothing was sent.');
      text(timelineEl, [
        'To: ' + draft.to,
        'Subject: ' + draft.subject,
        'Status: unsent',
        'Scheduled: ' + draft.scheduledFor,
        'Quiet-hours shift: ' + (draft.quietHoursShifted ? 'yes' : 'no'),
        '',
        draft.body
      ].join('\n'));
    });
  });

  document.getElementById('reset').addEventListener('click', function () {
    session = demo.createSession();
    for (const id of fields) document.getElementById(id).value = '';
    clearErrors();
    text(statusEl, 'No status drafts prepared.');
    clearDraft();
    text(timelineStatus, 'Choose a synthetic ticket. Drafts stay unsent.');
    text(timelineEl, 'A synthetic ticket replay will appear here.\n\nNothing is sent from this page.');
  });
})();
