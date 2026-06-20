# Security Policy

## Supported version

Security fixes are applied to the latest version in the repository.

## Reporting a vulnerability

Do not open a public issue containing credentials, customer information, private deployment URLs or exploitable details.

Report the problem privately to the repository owner through the contact method listed on their GitHub profile. Include a clear description, affected file or function, reproduction steps and the likely impact. Remove or redact all credentials and personal data.

## Secrets and personal data

Never commit:

- Stripe secret keys beginning with `sk_`
- customer names, emails, phone numbers, addresses or booking notes
- exported production booking spreadsheets
- private Calendar IDs
- production Apps Script deployment URLs
- private form links

If a secret is committed, deleting it in a later commit is not enough. Rotate or revoke it immediately, remove it from Git history, and review any related account activity.

## Installation permissions

Each installer should review the Apps Script manifest and permission prompts before authorising the project. Deploy the web app only from an account intended to own the booking system.
