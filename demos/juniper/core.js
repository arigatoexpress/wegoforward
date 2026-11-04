(function (root) {
  'use strict';
  const faqs = Object.freeze({
    'what are your hours?': 'Fictional hours: Tuesday–Saturday, 10am–5pm.',
    'what do you repair?': 'Fictional services: chairs, tables and wooden shelves. A person must assess each request.',
    'how do i book?': 'Booking is a placeholder in this demo. A person would review your request before sharing an approved link.'
  });
  const booking = "In a real setup the business's own booking link would appear here.";
  const cleanQuestion = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 1000 ? value.trim() : null;
  function emailAddress(value) {
    if (typeof value !== 'string' || /[\r\n]/.test(value)) return null;
    const email = value.trim().toLowerCase();
    if (email.length > 254) return null;
    const parts = email.split('@');
    if (parts.length !== 2) return null;
    const [local, domain] = parts;
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
    const labels = domain.split('.');
    if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || !/^[a-z]{2,63}$/.test(labels.at(-1))) return null;
    return email;
  }
  function createSession() {
    const leads = new Map();
    return Object.freeze({
      answer(value) {
        const question = cleanQuestion(value);
        if (!question) return { status: 'invalid', text: 'Enter a question between 1 and 1,000 characters.' };
        const key = question.toLowerCase();
        return Object.hasOwn(faqs, key)
          ? { status: 'answered', text: faqs[key] }
          : { status: 'handoff', text: 'This question needs a person. Add a fictional email below to prepare an unsent handoff.' };
      },
      capture(input) {
        const question = cleanQuestion(input?.question);
        const email = emailAddress(input?.email);
        if (!question || !email) {
          const errors = {};
          if (!question) errors.question = 'Enter a question between 1 and 1,000 characters.';
          if (!email) errors.email = 'Enter a complete fictional email, such as ada@example.test.';
          return { status: 'invalid', text: Object.values(errors).join(' '), errors, sent: false };
        }
        const existing = leads.get(email);
        if (existing) return { status: 'duplicate', draft: { ...existing }, booking, sent: false };
        const draft = Object.freeze({
          to: email,
          status: 'unsent',
          subject: 'Draft: fictional workshop enquiry',
          body: `Hello,\n\nA person would review this fictional enquiry before replying.\n\nQuestion supplied:\n${question}\n\n${booking}\n\nThis demo has sent nothing and booked nothing.`
        });
        leads.set(email, draft);
        return { status: 'captured', draft: { ...draft }, booking, sent: false };
      },
      count: () => leads.size
    });
  }
  const api = Object.freeze({ createSession });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FaqDemo = api;
})(globalThis);
