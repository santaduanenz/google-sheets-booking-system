# Google Sheets Booking System

A reusable booking system built with **Google Sheets**, **Google Apps Script**, **Google Calendar**, and optional **Stripe Checkout** payments.

It provides a public booking page, availability management, calendar blocking, customer and owner emails, provisional-to-confirmed booking workflows, and an optional paid online appointment flow—without requiring a traditional web server or database.

Front facing and admin spreadsheet video demo available on YouTube https://youtu.be/vCU54l2mzhE

## Features

- Public responsive booking form hosted by Google Apps Script
- Multiple appointment selection for standard bookings
- Configurable appointment length and buffer time
- Google Calendar conflict checking and event creation
- Google Sheets booking records and status management
- Customer and owner email notifications
- Provisional booking review and confirmation workflow
- Optional Stripe Checkout payment flow
- Automatic payment reconciliation trigger
- Setup sidebar for business, calendar, website and Stripe settings
- Website embed code generator
- Generic event types and editable wording

## How it works

1. A customer selects an available date and time.
2. The system checks both Google Calendar and saved booking blocks.
3. Standard bookings are stored as **Provisionally Reserved**.
4. The operator reviews the booking and confirms it from the Google Sheets menu.
5. Paid online appointments are held temporarily while Stripe Checkout is completed.
6. Confirmed bookings are added to Google Calendar and email notifications are sent.

## Requirements

- A Google account
- Google Sheets
- Google Apps Script
- A Google Calendar accessible by the installing account
- Optional: a Stripe account for paid appointments
- Optional: a website that accepts iframe or HTML embeds

## Installation

1. Create a blank Google Sheet using the account that will own the booking system.
2. Open **Extensions → Apps Script**.
3. Replace the default `Code.gs` with the supplied `Code.gs`.
4. Add an HTML file named `Index` and paste in `Index.html`.
5. Add an HTML file named `Setup` and paste in `Setup.html`.
6. In **Project Settings**, enable **Show appsscript.json manifest file**.
7. Replace the manifest contents with `appsscript.json`.
8. Save the project and refresh the Google Sheet.
9. Open **Booking System → Setup / Install**.
10. Enter the business, calendar, timezone, website and optional Stripe details.
11. Approve the requested Google permissions.
12. Deploy the Apps Script project as a web app:
    - **Execute as:** Me
    - **Who has access:** Anyone
13. Copy the deployed URL ending in `/exec` back into the setup sidebar.
14. Use **Booking System → Show iframe code** to generate website embed code.
15. When Stripe is enabled, run **Booking System → Install Stripe trigger** once.

> Apps Script displays `.html` automatically. Name the HTML files `Index` and `Setup`, not `Index.html` and `Setup.html`, inside the Apps Script editor.

## Website embed

```html
<iframe
  src="YOUR_WEB_APP_EXEC_URL"
  width="100%"
  height="1500"
  style="border:0;display:block;"
  loading="lazy"
  allow="payment">
</iframe>
```

Use the deployed `/exec` URL. The `/dev` URL is intended for authorised testing and should not be used for public bookings.

## Updating a live installation

Saving code does not update an existing public deployment.

After making changes:

1. Open **Deploy → Manage deployments**.
2. Edit the existing web-app deployment.
3. Choose **New version**.
4. Click **Deploy**.
5. Keep using the same `/exec` URL.

## Booking statuses

| Status | Meaning |
|---|---|
| Provisionally Reserved | A standard booking has been received and is awaiting review. |
| Booked | The booking has been reviewed and confirmed. |
| Cancelled | The booking has been cancelled and no longer blocks availability. |
| Awaiting Payment | Stripe Checkout is active and the appointment is temporarily held. |
| Paid / Confirmed | Stripe has confirmed payment and the booking is confirmed. |
| Payment Cancelled | The customer cancelled Stripe Checkout. |
| Payment Expired | The temporary Stripe hold expired without payment. |

## Stripe configuration

Stripe is optional. The setup sidebar stores the Stripe secret key in **Apps Script Properties**, not in spreadsheet cells.

Use matching modes:

- test secret key + test Price ID
- live secret key + live Price ID

A Stripe Price ID begins with `price_`. A Product ID beginning with `prod_` cannot be used in its place.

Never commit Stripe secret keys or customer data to GitHub.

## Customisation

- Public labels, event types and visible wording: `Index.html`
- Booking rules, statuses, email content and Calendar descriptions: `Code.gs`
- Setup-screen fields and layout: `Setup.html`
- Permissions and timezone defaults: `appsscript.json`

The supplied paid event type is `Online Appointment`. If it is renamed, update the exact value everywhere it is referenced in both `Code.gs` and `Index.html`.

## Documentation

- [Installation guide](docs/INSTALLATION.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [New-user Word guide](docs/Google_Sheets_Booking_System_New_User_Guide.docx)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Security

Do not commit:

- Stripe secret keys
- deployed Apps Script URLs
- customer bookings or personal information
- private Calendar IDs
- private form or questionnaire links
- copied production Settings sheets

The included GitHub workflow performs a basic scan for common secret patterns. It is a guardrail, not a replacement for reviewing changes before publishing.

## Licence

Released under the [MIT License](LICENSE).
