# Troubleshooting

## The Booking System menu does not appear

- Save the Apps Script project and refresh the Google Sheet.
- Confirm `onOpen()` is a top-level function, not nested inside another function.
- Confirm the script was opened from **Extensions → Apps Script** in the correct Sheet.
- Check the editor for syntax errors.

## The payment panel does not appear

The paid event-type value must match exactly in `Index.html` and `Code.gs`.

The supplied value is:

```text
Online Appointment
```

After changing it, deploy a new version and hard-refresh the live page.

## Saved changes are not visible on the website

Use **Deploy → Manage deployments → Edit → New version → Deploy**. Then hard-refresh or test in a private browsing window.

## `ReferenceError: function is not defined`

- Search for the exact function name, including a trailing underscore.
- Confirm the helper function is outside every other function.
- Check the braces immediately above it.
- Remove duplicate older versions of the same function.

## A booking status changes but Calendar does not

- Run **Booking System → Test calendar**.
- Confirm the configured Calendar ID is correct.
- Confirm the Calendar event description contains the same Booking ID.
- Check Apps Script **Executions** for the failed function and line number.

## A confirmation email is not sent

- Verify the customer email address.
- Check spam or junk folders.
- Open Apps Script **Executions** and inspect the failed run.
- Confirm email permissions were granted.
- Check whether the daily Apps Script email quota was reached.

## All dates appear unavailable

- Check for overlapping Calendar events, including all-day events.
- Check active booking rows and statuses.
- Remember that configured buffers also block time.
- Run `clearAllAvailabilityCaches()` manually if stale cache is suspected.

## The iframe is blank or cut off

- Use the deployed `/exec` URL, not `/dev`.
- Redeploy with access set to **Anyone**.
- Confirm `doGet()` allows iframe embedding.
- Increase the iframe height.
- Open the `/exec` URL directly to separate an Apps Script problem from a website problem.

## Stripe reports an invalid API key or missing Price

- Re-enter the complete key through Setup / Install.
- Match test keys with test Prices and live keys with live Prices.
- Use a Price ID beginning with `price_`, not a Product ID beginning with `prod_`.
- Run **Booking System → Test Stripe**.

## Payment succeeds but the booking stays Awaiting Payment

- Confirm the deployed web-app URL is current.
- Install the Stripe reconciliation trigger.
- Check that the Stripe Session ID was saved in the row.
- Run `reconcilePendingStripePayments()` manually.
- Review both Apps Script Executions and the Stripe payment details.

## Finding the useful error details

Open **Extensions → Apps Script → Executions**, select the most recent failed run, and record:

- error message
- function name
- line number
- trigger type

Remove all secret keys before sharing logs or code for support.
