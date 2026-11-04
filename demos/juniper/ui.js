'use strict';
let session = FaqDemo.createSession();
const byId = id => document.getElementById(id);
const emptyDraft = 'Your draft will appear here.\n\nA person would review the question and approve any real reply.';
function fieldError(id, message = '') {
  const field = byId(id);
  const error = byId(`${id}-error`);
  error.textContent = message;
  error.hidden = !message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
}
function clearDraft() { byId('draft').textContent = emptyDraft; }
function edited(id) {
  clearDraft();
  fieldError(id);
  byId('status').textContent = 'Enquiry changed. Prepare a draft to review the current details.';
  if (id === 'question') byId('reply').textContent = 'Question changed. Check the FAQ for this question.';
}
function answer() {
  const result = session.answer(byId('question').value);
  fieldError('question', result.status === 'invalid' ? result.text : '');
  byId('reply').textContent = result.text;
  if (result.status === 'invalid') byId('question').focus();
}
for (const id of ['question', 'email']) byId(id).addEventListener('input', () => edited(id));
document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => {
  byId('question').value = button.dataset.question;
  edited('question');
  answer();
}));
byId('answer').addEventListener('click', answer);
byId('capture').addEventListener('click', () => {
  const result = session.capture({ question: byId('question').value, email: byId('email').value });
  for (const id of ['question', 'email']) fieldError(id, result.errors?.[id]);
  if (result.status === 'invalid') {
    clearDraft();
    byId('status').textContent = result.text;
    byId(Object.keys(result.errors)[0]).focus();
    return;
  }
  byId('status').textContent = result.status === 'duplicate'
    ? `Duplicate email: the original unsent draft is shown. ${session.count()} enquiry in this session.`
    : `Unsent draft prepared. ${session.count()} enquiry in this session. Nothing sent or booked.`;
  byId('draft').textContent = `To: ${result.draft.to}\nSubject: ${result.draft.subject}\nStatus: unsent\n\n${result.draft.body}`;
});
byId('reset').addEventListener('click', () => {
  session = FaqDemo.createSession();
  byId('question').value = '';
  byId('email').value = '';
  for (const id of ['question', 'email']) fieldError(id);
  byId('reply').textContent = 'Choose a sample or write a question. Only the three exact sample questions have prepared answers.';
  byId('status').textContent = 'Demo reset. No enquiries retained.';
  clearDraft();
  byId('question').focus();
});
