# Installation Guide

## 1. Create the spreadsheet

Create a new blank Google Sheet using the Google account that will operate the booking system.

## 2. Add the Apps Script files

Open **Extensions → Apps Script**.

- Replace the default `Code.gs` with the repository version.
- Add an HTML file named `Index` and paste in `Index.html`.
- Add an HTML file named `Setup` and paste in `Setup.html`.
- Open **Project Settings** and enable **Show appsscript.json manifest file**.
- Replace the manifest with `appsscript.json`.

Save the project, return to the Sheet, and refresh the browser tab.

## 3. Run setup

Open **Booking System → Setup / Install** and enter:

- business name
- owner or contact name
- owner notification email
- Google Calendar ID
- timezone
- website URL
- optional questionnaire links
- optional Stripe secret key and Price ID

The Stripe secret key is stored in Apps Script Properties rather than a spreadsheet cell.

## 4. Authorise Google services

The first setup or menu action may request access to Sheets, Calendar, email and external web requests. Review and approve the permissions needed by the system.

## 5. Deploy the public booking page

In Apps Script:

1. Click **Deploy → New deployment**.
2. Choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone**.
5. Click **Deploy**.
6. Copy the URL ending in `/exec`.

Return to **Booking System → Setup / Install**, save the deployed URL, and then use **Show iframe code**.

## 6. Install the Stripe trigger

When Stripe is configured, run **Booking System → Install Stripe trigger** once. The trigger checks pending Checkout Sessions and confirms successful payments.

## 7. Test before going live

Test all of the following:

- public `/exec` page opens without Google sign-in
- a standard booking writes to the Sheet
- customer and owner emails arrive
- Calendar event and buffer rules work
- confirming a provisional booking changes it to Booked
- the confirmation email is sent
- Stripe test-mode payment completes successfully
- the website iframe works on desktop and mobile

## 8. Updating later

After changing code, create a new version of the existing deployment through **Deploy → Manage deployments**. Saving the Apps Script project alone does not update the public page.
