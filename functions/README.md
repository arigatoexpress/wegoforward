# Contact form bindings

The contact page posts to the Pages Function at `/api/contact`. Nothing in this folder is a secret. Set the values in the Cloudflare Pages project `wegoforward-app` (production and preview). This repository does not contain them, and writing this file does not change DNS, Email Routing, or the live project.

The function reads every address from the environment. It does not contain the destination address.

## Names to set

| Name | Kind | What to put |
| --- | --- | --- |
| `EMAIL` | `send_email` binding | The binding the function calls as `env.EMAIL.send(...)`. Add it on the Pages project. The sender domain has to be onboarded to Cloudflare Email Service first. |
| `OUTREACH_TO` | plain-text environment variable | The inbox that should receive shop questions. Set this to `outreach@wegoforward.app`. |
| `OUTREACH_FROM` | plain-text environment variable | The From address on the onboarded domain, for example `forms@wegoforward.app`. You choose the local part. It must be allowed to send. |
| `TURNSTILE_SITE_KEY` | plain-text environment variable | The public Turnstile site key. The contact page fetches it from `/api/contact-config`. It is not a secret. |
| `TURNSTILE_SECRET_KEY` | secret | The Turnstile secret key. Used only for `siteverify`. Never put it in a page, a commit, or `TURNSTILE_SITE_KEY`. |

Create the Turnstile widget for `wegoforward.app`. Add the preview hostname too if the form should work on preview. Turn on Email Routing so `outreach@wegoforward.app` lands in a mailbox you read. The function only sends mail to `OUTREACH_TO`. Routing is what delivers that message to you.

Until those values exist, the form tells the visitor it cannot send and leaves LinkedIn in place. A filled honeypot field (`company_website`) gets the same thank-you as a real note and is not emailed.

## Reply window

`assets/contact-config.js` exports `REPLY_WINDOW`. The contact page shows that sentence. The checked-in sentence is a placeholder: a reply window is not published yet. Replace it with the window you will keep, keep the contact page paragraph identical, and set `REPLY_WINDOW_STATUS` to `set`. Do not publish a time you will not keep.

Redeploy only after you have decided to. This file is not a deploy approval.
