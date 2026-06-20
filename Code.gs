const SLOT_MINUTES = 30;
const BUFFER_BEFORE_MINUTES = 30;
const BUFFER_AFTER_MINUTES = 30;
const MONTHS_AHEAD = 9;
const MONTH_CACHE_SECONDS = 15 * 60;
const STRIPE_HOLD_MINUTES = 30;
const PAYMENT_EVENT_TYPE = "Online Appointment";

const SETTINGS_SHEET = "Settings";
const BOOKINGS_SHEET = "Bookings";

const DEFAULT_SETTINGS = {
  BUSINESS_NAME: "My Booking Service",
  OWNER_NAME: "Booking Team",
  OWNER_EMAIL: "",
  CALENDAR_ID: "",
  TIMEZONE: "Etc/UTC",
  WEBSITE_URL: "",
  WEB_APP_URL: "",
  STANDARD_BOOKING_QUESTIONNAIRE_URL: "",
  GROUP_BOOKING_QUESTIONNAIRE_URL: ""
};

const BOOKING_HEADERS = [
  "Booking ID",
  "Created",
  "Customer Name",
  "Email",
  "Phone",
  "Organisation / Business",
  "Visit Address",
  "Notes",
  "Selected Times",
  "Blocked From",
  "Blocked Until",
  "Status",
  "Event Type",
  "Hold Expires",
  "Stripe Session ID",
  "Payment Status",
  "Paid At",
  "Calendar Event ID",
  "Confirmation Email Sent"
];


/**
 * Displays the booking page.
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile("Index");
  template.businessName = getSetting_("BUSINESS_NAME", DEFAULT_SETTINGS.BUSINESS_NAME);
  template.ownerName = getSetting_("OWNER_NAME", DEFAULT_SETTINGS.OWNER_NAME);
  template.websiteUrl = getSetting_("WEBSITE_URL", "");

  return template
    .evaluate()
    .setTitle("Book " + template.businessName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/**
 * Opens the booking spreadsheet.
 */
function getBookingSpreadsheet() {
  const storedId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (storedId) {
    return SpreadsheetApp.openById(storedId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("No spreadsheet is connected. Run Booking System → Setup / Install first.");
  }
  return active;
}


/**
 * Gets the Bookings sheet and ensures
 * all required headings exist.
 */
function getBookingsSheet() {
  const spreadsheet =
    getBookingSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      "Bookings"
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        "Bookings"
      );
  }

  sheet
    .getRange(
      1,
      1,
      1,
      BOOKING_HEADERS.length
    )
    .setValues([
      BOOKING_HEADERS
    ]);

  sheet.setFrozenRows(1);

  return sheet;
}


/**
 * Tests the spreadsheet connection.
 */
function testSpreadsheetConnection() {
  const spreadsheet =
    getBookingSpreadsheet();

  const sheet =
    getBookingsSheet();

  console.log(
    "Connected to: " +
    spreadsheet.getName()
  );

  console.log(
    "Spreadsheet URL: " +
    spreadsheet.getUrl()
  );

  console.log(
    "Bookings sheet: " +
    sheet.getName()
  );
}


/**
 * Gets the Google Calendar used
 * for booking events.
 */
function getBookingCalendar() {
  const calendarId = getRequiredSetting_("CALENDAR_ID", "Calendar ID");
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    throw new Error("The configured booking calendar could not be found.");
  }
  return calendar;
}


/**
 * Returns the Stripe settings stored
 * in Script Properties.
 */
function getStripeSettings() {
  const properties =
    PropertiesService
      .getScriptProperties();

  const secretKey =
    properties.getProperty(
      "STRIPE_SECRET_KEY"
    );

  const priceId =
    properties.getProperty(
      "STRIPE_PRICE_ID"
    );

  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY has not been added to Script Properties."
    );
  }

  if (!priceId) {
    throw new Error(
      "STRIPE_PRICE_ID has not been added to Script Properties."
    );
  }

  return {
    secretKey: secretKey,
    priceId: priceId
  };
}


/**
 * Tests the Stripe configuration.
 */
function testStripeConnection() {
  const settings =
    getStripeSettings();

  const response =
    stripeRequest(
      "/v1/prices/" +
      encodeURIComponent(
        settings.priceId
      ),
      "get"
    );

  console.log(
    "Stripe price: " +
    response.id
  );

  console.log(
    "Currency: " +
    response.currency
  );

  console.log(
    "Amount: " +
    response.unit_amount
  );
}


/**
 * Makes an authenticated request
 * to the Stripe API.
 */
function stripeRequest(
  path,
  method,
  payload
) {
  const settings =
    getStripeSettings();

  const options = {
    method: method || "get",

    headers: {
      Authorization:
        "Bearer " +
        settings.secretKey
    },

    muteHttpExceptions: true
  };

  if (payload) {
    options.contentType =
      "application/x-www-form-urlencoded";

    options.payload =
      payload;
  }

  const response =
    UrlFetchApp.fetch(
      "https://api.stripe.com" +
      path,
      options
    );

  const statusCode =
    response.getResponseCode();

  const responseText =
    response.getContentText();

  let result;

  try {
    result =
      JSON.parse(
        responseText
      );
  } catch (error) {
    throw new Error(
      "Stripe returned an unreadable response."
    );
  }

  if (
    statusCode < 200 ||
    statusCode >= 300
  ) {
    const message =
      result &&
      result.error &&
      result.error.message
        ? result.error.message
        : "Stripe request failed.";

    throw new Error(message);
  }

  return result;
}


/**
 * Gets availability for one month.
 */
function getAvailableSlotsForMonth(
  year,
  monthNumber
) {
  year = Number(year);
  monthNumber = Number(monthNumber);

  validateRequestedMonth(
    year,
    monthNumber
  );

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    getMonthCacheKey(
      year,
      monthNumber
    );

  const cached =
    cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const possibleSlots =
    generateSlotsForMonth(
      year,
      monthNumber
    );

  const monthStart =
    new Date(
      year,
      monthNumber - 1,
      1,
      0,
      0,
      0,
      0
    );

  const monthEnd =
    new Date(
      year,
      monthNumber,
      1,
      0,
      0,
      0,
      0
    );

  const calendarEvents =
    getBookingCalendar()
      .getEvents(
        monthStart,
        monthEnd
      );

  const savedBlocks =
    getSavedBookingBlocks(
      monthStart,
      monthEnd
    );

  const results =
    possibleSlots.map(
      function (slotStart) {
        const slotEnd =
          new Date(
            slotStart.getTime() +
            SLOT_MINUTES * 60000
          );

        const blockedBySheet =
          savedBlocks.some(
            function (block) {
              return rangesOverlap(
                slotStart,
                slotEnd,
                block.blockedFrom,
                block.blockedUntil
              );
            }
          );

        const blockedByCalendar =
          calendarEvents.some(
            function (event) {
              return slotClashesWithEvent(
                slotStart,
                slotEnd,
                event
              );
            }
          );

        return {
          start:
            formatDateForClient(
              slotStart
            ),

          available:
            !blockedBySheet &&
            !blockedByCalendar
        };
      }
    );

  cache.put(
    cacheKey,
    JSON.stringify(results),
    MONTH_CACHE_SECONDS
  );

  return results;
}


/**
 * Generates all possible slots
 * for one month.
 */
function generateSlotsForMonth(
  year,
  monthNumber
) {
  const slots = [];

  const monthStart =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  const monthEnd =
    new Date(
      year,
      monthNumber,
      1
    );

  const now =
    new Date();

  const latestAllowed =
    new Date();

  latestAllowed.setMonth(
    latestAllowed.getMonth() +
    MONTHS_AHEAD
  );

  const date =
    new Date(monthStart);

  while (date < monthEnd) {
    if (date <= latestAllowed) {
      const day =
        date.getDay();

      if (day === 5) {
        addSlotsForDay(
          slots,
          date,
          18,
          0,
          21,
          0,
          now
        );
      }

      if (
        day === 6 ||
        day === 0
      ) {
        addSlotsForDay(
          slots,
          date,
          9,
          0,
          21,
          0,
          now
        );
      }
    }

    date.setDate(
      date.getDate() + 1
    );
  }

  return slots;
}


/**
 * Adds appointment starts for one day.
 */
function addSlotsForDay(
  slots,
  date,
  startHour,
  startMinute,
  finishHour,
  finishMinute,
  now
) {
  const start =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      startHour,
      startMinute,
      0,
      0
    );

  const finish =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      finishHour,
      finishMinute,
      0,
      0
    );

  let slotStart =
    new Date(start);

  while (
    slotStart.getTime() +
    SLOT_MINUTES * 60000 <=
    finish.getTime()
  ) {
    if (
      slotStart.getTime() >
      now.getTime()
    ) {
      slots.push(
        new Date(slotStart)
      );
    }

    slotStart =
      new Date(
        slotStart.getTime() +
        SLOT_MINUTES * 60000
      );
  }
}


/**
 * Creates a standard non-paid booking.
 */
function createBooking(
  bookingData
) {
  validateBookingData(
    bookingData
  );

  if (
    bookingData.eventType ===
    PAYMENT_EVENT_TYPE
  ) {
    throw new Error(
      "Online appointments must be paid through Stripe."
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const selectedDates =
      parseSelectedDates(
        bookingData.selectedTimes
      );

    const groups =
      groupConsecutiveTimes(
        selectedDates
      );

    checkGroupsAreAvailable(
      groups
    );

    const bookingId =
      Utilities.getUuid();

    const sheet =
      getBookingsSheet();

    groups.forEach(
      function (group) {
        const period =
          getBookingPeriod(group);

        const calendarEvent = createCalendarEvent(
          bookingId,
          bookingData,
          period.appointmentStart,
          period.appointmentEnd,
          "Provisionally Reserved"
        );

        sheet.appendRow([
          bookingId,
          new Date(),
          bookingData.customerName,
          bookingData.email,
          bookingData.phone,
          bookingData.organisation || "",
          bookingData.address,
          bookingData.notes,
          group
            .map(formatDateForSheet)
            .join(" | "),
          period.blockedFrom,
          period.blockedUntil,
          "Provisionally Reserved",
          bookingData.eventType,
          "",
          "",
          "Not required",
          "",
          calendarEvent.getId(),
          ""
        ]);
      }
    );

    SpreadsheetApp.flush();

    clearCacheForSelectedDates(
      selectedDates
    );

    sendBookingEmails(
      bookingData,
      groups,
      bookingId,
      false
    );

    return {
      success: true,
      bookingId: bookingId
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Creates a temporary paid online appointment
 * hold and a Stripe Checkout Session.
 */
function createVirtualCheckout(
  bookingData
) {
  validateBookingData(
    bookingData
  );

  if (
    bookingData.eventType !==
    PAYMENT_EVENT_TYPE
  ) {
    throw new Error(
      "This payment option is only for Online appointments."
    );
  }

  if (
    bookingData.selectedTimes.length !== 1
  ) {
    throw new Error(
      "Please select one appointment time for the online appointment."
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const selectedDates =
      parseSelectedDates(
        bookingData.selectedTimes
      );

    const groups = [
      [selectedDates[0]]
    ];

    checkGroupsAreAvailable(
      groups
    );

    const bookingId =
      Utilities.getUuid();

    const period =
      getBookingPeriod(
        groups[0]
      );

    const holdExpires =
      new Date(
        Date.now() +
        STRIPE_HOLD_MINUTES *
        60000
      );

    const sheet =
      getBookingsSheet();

    const rowNumber =
      sheet.getLastRow() + 1;

    sheet.appendRow([
      bookingId,
      new Date(),
      bookingData.customerName,
      bookingData.email,
      bookingData.phone,
      bookingData.organisation || "",
      bookingData.address,
      bookingData.notes,
      formatDateForSheet(
        selectedDates[0]
      ),
      period.blockedFrom,
      period.blockedUntil,
      "Awaiting Payment",
      bookingData.eventType,
      holdExpires,
      "",
      "Unpaid",
      "",
      "",
      ""
    ]);

    SpreadsheetApp.flush();

    clearCacheForSelectedDates(
      selectedDates
    );

    try {
      const settings =
        getStripeSettings();

      const expiresAt =
        Math.floor(
          holdExpires.getTime() /
          1000
        );

      const checkout =
        stripeRequest(
          "/v1/checkout/sessions",
          "post",
          {
            mode: "payment",

            "line_items[0][price]":
              settings.priceId,

            "line_items[0][quantity]":
              "1",

            customer_email:
              bookingData.email,

            client_reference_id:
              bookingId,

            success_url:
              getRequiredSetting_("WEB_APP_URL", "Web app URL") +
              "?stripe=success&session_id={CHECKOUT_SESSION_ID}",

            cancel_url:
              getRequiredSetting_("WEB_APP_URL", "Web app URL") +
              "?stripe=cancelled&booking_id=" +
              encodeURIComponent(
                bookingId
              ),

            expires_at:
              String(expiresAt),

            "metadata[booking_id]":
              bookingId,

            "metadata[event_type]":
              PAYMENT_EVENT_TYPE
          }
        );

      sheet
        .getRange(
          rowNumber,
          15
        )
        .setValue(
          checkout.id
        );

      SpreadsheetApp.flush();

      return {
        success: true,
        checkoutUrl: checkout.url,
        bookingId: bookingId
      };

    } catch (error) {
      sheet.deleteRow(
        rowNumber
      );

      clearCacheForSelectedDates(
        selectedDates
      );

      throw error;
    }

  } finally {
    lock.releaseLock();
  }
}


/**
 * Confirms a Stripe booking after
 * the customer returns from Checkout.
 */
function finalizeStripePayment(
  sessionId
) {
  if (!sessionId) {
    throw new Error(
      "No Stripe Checkout Session was supplied."
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const session =
      stripeRequest(
        "/v1/checkout/sessions/" +
        encodeURIComponent(
          sessionId
        ),
        "get"
      );

    if (
      session.payment_status !==
      "paid"
    ) {
      throw new Error(
        "Stripe has not confirmed this payment as paid."
      );
    }

    const sheet =
      getBookingsSheet();

    const rowNumber =
      findRowByStripeSessionId(
        sheet,
        sessionId
      );

    if (!rowNumber) {
      throw new Error(
        "The matching booking record could not be found."
      );
    }

    const row =
      sheet
        .getRange(
          rowNumber,
          1,
          1,
          BOOKING_HEADERS.length
        )
        .getValues()[0];

    if (
      String(row[11]) ===
      "Paid / Confirmed"
    ) {
      return buildPaidResponse(
        row
      );
    }

    const bookingData =
      rowToBookingData(row);

    const appointmentStart =
      new Date(
        new Date(row[9]).getTime() +
        BUFFER_BEFORE_MINUTES *
        60000
      );

    const appointmentEnd =
      new Date(
        new Date(row[10]).getTime() -
        BUFFER_AFTER_MINUTES *
        60000
      );

    const calendarEvent = createCalendarEvent(
      row[0],
      bookingData,
      appointmentStart,
      appointmentEnd,
      "Paid / Confirmed"
    );

    sheet
      .getRange(
        rowNumber,
        12
      )
      .setValue(
        "Paid / Confirmed"
      );

    sheet
      .getRange(
        rowNumber,
        16
      )
      .setValue(
        "Paid"
      );

    sheet
      .getRange(
        rowNumber,
        17
      )
      .setValue(
        new Date()
      );

    sheet
      .getRange(rowNumber, 18)
      .setValue(calendarEvent.getId());

    SpreadsheetApp.flush();

    const selectedDates = [
      appointmentStart
    ];

    clearCacheForSelectedDates(
      selectedDates
    );

    sendBookingEmails(
      bookingData,
      [selectedDates],
      row[0],
      true
    );

    return {
      success: true,
      bookingId: row[0],
      customerName: bookingData.customerName,
      eventType: bookingData.eventType,
      selectedTimes: [
        formatDateForClient(
          appointmentStart
        )
      ],
      paid: true
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Cancels an abandoned Stripe hold.
 */
function cancelVirtualCheckout(
  bookingId
) {
  if (!bookingId) {
    return {
      success: true
    };
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const sheet =
      getBookingsSheet();

    const rowNumber =
      findRowByBookingId(
        sheet,
        bookingId
      );

    if (!rowNumber) {
      return {
        success: true
      };
    }

    const row =
      sheet
        .getRange(
          rowNumber,
          1,
          1,
          BOOKING_HEADERS.length
        )
        .getValues()[0];

    if (
      String(row[11]) !==
      "Awaiting Payment"
    ) {
      return {
        success: true
      };
    }

    const sessionId =
      String(row[14] || "");

    if (sessionId) {
      try {
        stripeRequest(
          "/v1/checkout/sessions/" +
          encodeURIComponent(
            sessionId
          ) +
          "/expire",
          "post",
          {}
        );
      } catch (error) {
        console.log(
          "Stripe expiry warning: " +
          error.message
        );
      }
    }

    sheet
      .getRange(
        rowNumber,
        12
      )
      .setValue(
        "Payment Cancelled"
      );

    sheet
      .getRange(
        rowNumber,
        16
      )
      .setValue(
        "Cancelled"
      );

    SpreadsheetApp.flush();

    clearCacheForSelectedDates([
      new Date(
        new Date(row[9]).getTime() +
        BUFFER_BEFORE_MINUTES *
        60000
      )
    ]);

    return {
      success: true
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Checks pending sessions and confirms
 * successful payments automatically.
 */
function reconcilePendingStripePayments() {
  const sheet =
    getBookingsSheet();

  if (
    sheet.getLastRow() < 2
  ) {
    return;
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        BOOKING_HEADERS.length
      )
      .getValues();

  values.forEach(
    function (row) {
      const status =
        String(row[11] || "");

      const sessionId =
        String(row[14] || "");

      if (
        status !==
        "Awaiting Payment" ||
        !sessionId
      ) {
        return;
      }

      try {
        const session =
          stripeRequest(
            "/v1/checkout/sessions/" +
            encodeURIComponent(
              sessionId
            ),
            "get"
          );

        if (
          session.payment_status ===
          "paid"
        ) {
          finalizeStripePayment(
            sessionId
          );

          return;
        }

        if (
          session.status ===
          "expired"
        ) {
          markStripeSessionExpired(
            sessionId
          );
        }

      } catch (error) {
        console.log(
          "Stripe reconciliation error: " +
          error.message
        );
      }
    }
  );
}


/**
 * Creates the recurring reconciliation trigger.
 * Run this function once manually.
 */
function setupStripeReconciliationTrigger() {
  ScriptApp
    .getProjectTriggers()
    .forEach(function (trigger) {
      if (
        trigger.getHandlerFunction() ===
        "reconcilePendingStripePayments"
      ) {
        ScriptApp.deleteTrigger(
          trigger
        );
      }
    });

  ScriptApp
    .newTrigger(
      "reconcilePendingStripePayments"
    )
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log(
    "Stripe reconciliation trigger created."
  );
}


/**
 * Marks an unpaid expired Stripe session.
 */
function markStripeSessionExpired(
  sessionId
) {
  const sheet =
    getBookingsSheet();

  const rowNumber =
    findRowByStripeSessionId(
      sheet,
      sessionId
    );

  if (!rowNumber) {
    return;
  }

  const row =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        BOOKING_HEADERS.length
      )
      .getValues()[0];

  if (
    String(row[11]) !==
    "Awaiting Payment"
  ) {
    return;
  }

  sheet
    .getRange(
      rowNumber,
      12
    )
    .setValue(
      "Payment Expired"
    );

  sheet
    .getRange(
      rowNumber,
      16
    )
    .setValue(
      "Expired"
    );

  SpreadsheetApp.flush();

  clearCacheForSelectedDates([
    new Date(
      new Date(row[9]).getTime() +
      BUFFER_BEFORE_MINUTES *
      60000
    )
  ]);
}


/**
 * Returns active blocks stored
 * in the Bookings sheet.
 */
function getSavedBookingBlocks(
  rangeStart,
  rangeEnd
) {
  const sheet =
    getBookingsSheet();

  if (
    sheet.getLastRow() < 2
  ) {
    return [];
  }

  const now =
    new Date();

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        BOOKING_HEADERS.length
      )
      .getValues();

  return values
    .filter(function (row) {
      const status =
        String(row[11] || "")
          .trim()
          .toLowerCase();

      const alwaysBlocking = [
        "confirmed",
        "provisionally reserved",
        "paid / confirmed"
      ];

      if (
        alwaysBlocking.indexOf(
          status
        ) !== -1
      ) {
        return true;
      }

      if (
        status ===
        "awaiting payment"
      ) {
        const holdExpires =
          new Date(row[13]);

        return (
          !isNaN(
            holdExpires.getTime()
          ) &&
          holdExpires > now
        );
      }

      return false;
    })
    .map(function (row) {
      return {
        blockedFrom:
          new Date(row[9]),

        blockedUntil:
          new Date(row[10])
      };
    })
    .filter(function (block) {
      if (
        !rangeStart ||
        !rangeEnd
      ) {
        return true;
      }

      return rangesOverlap(
        block.blockedFrom,
        block.blockedUntil,
        rangeStart,
        rangeEnd
      );
    });
}


/**
 * Checks availability before saving.
 */
function checkGroupsAreAvailable(
  groups
) {
  const calendar =
    getBookingCalendar();

  const savedBlocks =
    getSavedBookingBlocks();

  groups.forEach(
    function (group) {
      const period =
        getBookingPeriod(group);

      const sheetClash =
        savedBlocks.some(
          function (block) {
            return rangesOverlap(
              period.blockedFrom,
              period.blockedUntil,
              block.blockedFrom,
              block.blockedUntil
            );
          }
        );

      if (sheetClash) {
        throw new Error(
          "One or more selected times are no longer available."
        );
      }

      const events =
        calendar.getEvents(
          period.blockedFrom,
          period.blockedUntil
        );

      if (events.length) {
        throw new Error(
          "One or more selected times clash with another calendar event."
        );
      }
    }
  );
}


/**
 * Calculates appointment and buffer periods.
 */
function getBookingPeriod(
  group
) {
  const appointmentStart =
    group[0];

  const appointmentEnd =
    new Date(
      group[
        group.length - 1
      ].getTime() +
      SLOT_MINUTES * 60000
    );

  return {
    appointmentStart:
      appointmentStart,

    appointmentEnd:
      appointmentEnd,

    blockedFrom:
      new Date(
        appointmentStart.getTime() -
        BUFFER_BEFORE_MINUTES *
        60000
      ),

    blockedUntil:
      new Date(
        appointmentEnd.getTime() +
        BUFFER_AFTER_MINUTES *
        60000
      )
  };
}


/**
 * Creates the Google Calendar event.
 */
function createCalendarEvent(
  bookingId,
  bookingData,
  appointmentStart,
  appointmentEnd,
  status
) {
  return getBookingCalendar()
    .createEvent(
      businessNameForEvent_() + " booking - " +
      bookingData.customerName,
      appointmentStart,
      appointmentEnd,
      {
        description:
          buildCalendarDescription(
            bookingId,
            bookingData,
            appointmentStart,
            status
          ),

        location:
          bookingData.eventType ===
          PAYMENT_EVENT_TYPE
            ? "Online"
            : bookingData.address,

        guests:
          bookingData.email,

        sendInvites: true
      }
    );
}


/**
 * Builds a Calendar event description.
 */
function buildCalendarDescription(
  bookingId,
  bookingData,
  appointmentStart,
  status
) {
  return [
    businessNameForEvent_() + " booking",
    "",
    "Booking ID: " + bookingId,
    "Status: " + status,
    "Customer: " +
      bookingData.customerName,
    "Event type: " +
      bookingData.eventType,
    "Email: " +
      bookingData.email,
    "Phone: " +
      bookingData.phone,
    "Organisation / Business: " +
      (
        bookingData.organisation ||
        "Not supplied"
      ),
    "Address / Location: " +
      bookingData.address,
    "",
    "Appointment:",
    formatDateForSheet(
      appointmentStart
    ),
    "",
    "Notes:",
    bookingData.notes
  ].join("\n");
}



function businessNameForEvent_() {
  return getSetting_("BUSINESS_NAME", DEFAULT_SETTINGS.BUSINESS_NAME);
}

/**
 * Sends customer and owner emails.
 */
function sendBookingEmails(
  bookingData,
  groups,
  bookingId,
  isPaid
) {
  const businessName = getSetting_("BUSINESS_NAME", DEFAULT_SETTINGS.BUSINESS_NAME);
  const ownerName = getSetting_("OWNER_NAME", DEFAULT_SETTINGS.OWNER_NAME);
  const websiteUrl = getSetting_("WEBSITE_URL", "");
  const selectedDates = [];

  groups.forEach(
    function (group) {
      group.forEach(
        function (date) {
          selectedDates.push(date);
        }
      );
    }
  );

  const selectedLines =
    selectedDates.map(
      function (date) {
        return (
          "• " +
          formatDateForSheet(date)
        );
      }
    );

  const customerSubject =
    isPaid
      ? "Your online appointment is confirmed"
      : "Your " + businessName + " booking";

  const openingText =
    isPaid
      ? "Your payment has been received, and your online appointment is now confirmed."
      : "Your booking has been provisionally reserved, and the selected time is now being held for you.";

  const customerBody = [
    "Hello " +
      bookingData.customerName +
      ",",
    "",
    openingText,
    "",
    isPaid
      ? "The online meeting details and any final instructions will be sent before the appointment."
      : "A member of the team will be in touch to review the booking details and confirm any remaining requirements.",
    "",
    "To help prepare for your booking, please complete the relevant questionnaire:",
    "",
    "Standard appointments or services:",
    getSetting_("STANDARD_BOOKING_QUESTIONNAIRE_URL", ""),
    "",
    "Group, business or event bookings:",
    getSetting_("GROUP_BOOKING_QUESTIONNAIRE_URL", ""),
    "",
    "Event type: " +
      bookingData.eventType,
    "",
    "Selected times:",
    selectedLines.join("\n"),
    "",
    "Booking ID: " +
      bookingId,
    "",
    "Location: " +
      bookingData.address,
    "",
    "Kind regards,",
    ownerName,
    businessName,
    websiteUrl
  ].join("\n");

  const selectedTimesHtml =
    selectedDates
      .map(function (date) {
        return (
          "<li>" +
          escapeHtml(
            formatDateForSheet(date)
          ) +
          "</li>"
        );
      })
      .join("");

  const customerHtmlBody =
    '<div style="' +
      "width:100%;" +
      "font-family:Arial,Helvetica,sans-serif;" +
      "font-size:16px;" +
      "line-height:1.6;" +
      "color:#183b56;" +
    '">' +

      '<div style="' +
        "width:100%;" +
        "padding:24px;" +
        "box-sizing:border-box;" +
      '">' +

        "<p>Hello " +
        escapeHtml(
          bookingData.customerName
        ) +
        ",</p>" +

        "<p>" +
        escapeHtml(
          openingText
        ) +
        "</p>" +

        "<p>" +
        (
          isPaid
            ? "The online meeting details and any final instructions will be sent before the appointment."
            : "A member of the team will be in touch to review the booking details and confirm any remaining requirements."
        ) +
        "</p>" +

        "<p>To help prepare for your booking, please complete the relevant questionnaire:</p>" +

        "<p>" +
          '<a href="' +
          getSetting_("STANDARD_BOOKING_QUESTIONNAIRE_URL", "") +
          '" style="color:#034614;font-weight:bold;">' +
          "Standard appointments or services" +
          "</a><br>" +

          "<span>or</span><br>" +

          '<a href="' +
          getSetting_("GROUP_BOOKING_QUESTIONNAIRE_URL", "") +
          '" style="color:#034614;font-weight:bold;">' +
          "Group, business or event bookings" +
          "</a>" +
        "</p>" +

        '<div style="' +
          "width:100%;" +
          "padding:20px;" +
          "box-sizing:border-box;" +
          "background:#f4f8f5;" +
          "border-left:5px solid #034614;" +
        '">' +

          "<p><strong>Status:</strong> " +
          (
            isPaid
              ? "Paid / Confirmed"
              : "Provisionally Reserved"
          ) +
          "</p>" +

          "<p><strong>Event type:</strong> " +
          escapeHtml(
            bookingData.eventType
          ) +
          "</p>" +

          "<p><strong>Selected times:</strong></p>" +

          "<ul>" +
          selectedTimesHtml +
          "</ul>" +

          "<p><strong>Booking ID:</strong> " +
          escapeHtml(
            bookingId
          ) +
          "</p>" +

          "<p><strong>Location:</strong> " +
          escapeHtml(
            bookingData.address
          ) +
          "</p>" +

        "</div>" +

        "<p>Kind regards,<br>" +
        "<strong>" + escapeHtml(ownerName) + "</strong><br>" +
        escapeHtml(businessName) + "<br>" +
        (websiteUrl
          ? '<a href="' + escapeHtml(websiteUrl) + '" style="color:#034614;">' + escapeHtml(websiteUrl) + "</a>"
          : "") +
        "</p>" +

      "</div>" +
    "</div>";

  MailApp.sendEmail({
    to: bookingData.email,
    subject: customerSubject,
    body: customerBody,
    htmlBody: customerHtmlBody,
    name: getSetting_("BUSINESS_NAME", DEFAULT_SETTINGS.BUSINESS_NAME)
  });

  const ownerSubject =
    (
      isPaid
        ? "Paid online appointment from "
        : "New " +
          bookingData.eventType +
          " booking from "
    ) +
    bookingData.customerName;

  const ownerBody = [
    "A new " + businessName + " booking has been made.",
    "",
    "Status: " +
      (
        isPaid
          ? "Paid / Confirmed"
          : "Provisionally Reserved"
      ),
    "Booking ID: " +
      bookingId,
    "",
    "Customer: " +
      bookingData.customerName,
    "Event type: " +
      bookingData.eventType,
    "Email: " +
      bookingData.email,
    "Phone: " +
      bookingData.phone,
    "Organisation / Business: " +
      (
        bookingData.organisation ||
        "Not supplied"
      ),
    "Location: " +
      bookingData.address,
    "",
    "Selected times:",
    selectedLines.join("\n"),
    "",
    "Notes:",
    bookingData.notes
  ].join("\n");

  MailApp.sendEmail({
    to: getRequiredSetting_("OWNER_EMAIL", "Owner email"),
    subject: ownerSubject,
    body: ownerBody,
    name:
      getSetting_("BUSINESS_NAME", DEFAULT_SETTINGS.BUSINESS_NAME) + " Booking System"
  });
}


/**
 * Helpers.
 */
function parseSelectedDates(
  selectedTimes
) {
  return selectedTimes
    .map(parseClientDate)
    .sort(function (a, b) {
      return (
        a.getTime() -
        b.getTime()
      );
    });
}


function groupConsecutiveTimes(
  dates
) {
  if (!dates.length) {
    return [];
  }

  const groups = [
    [dates[0]]
  ];

  for (
    let index = 1;
    index < dates.length;
    index++
  ) {
    const difference =
      (
        dates[index].getTime() -
        dates[index - 1].getTime()
      ) / 60000;

    if (
      difference ===
      SLOT_MINUTES
    ) {
      groups[
        groups.length - 1
      ].push(
        dates[index]
      );
    } else {
      groups.push([
        dates[index]
      ]);
    }
  }

  return groups;
}


function validateBookingData(
  bookingData
) {
  if (!bookingData) {
    throw new Error(
      "No booking information was received."
    );
  }

  const required = [
    [
      bookingData.customerName,
      "Please enter your full name."
    ],
    [
      bookingData.email,
      "Please enter your email address."
    ],
    [
      bookingData.phone,
      "Please enter your phone number."
    ],
    [
      bookingData.address,
      "Please enter your visit address or location."
    ],
    [
      bookingData.eventType,
      "Please select an event type."
    ],
    [
      bookingData.notes,
      "Please provide information that will help us prepare for your booking."
    ]
  ];

  required.forEach(
    function (field) {
      if (
        !field[0] ||
        !String(field[0]).trim()
      ) {
        throw new Error(
          field[1]
        );
      }
    }
  );

  if (
    !String(
      bookingData.email
    ).includes("@")
  ) {
    throw new Error(
      "Please enter a valid email address."
    );
  }

  if (
    !Array.isArray(
      bookingData.selectedTimes
    ) ||
    !bookingData.selectedTimes.length
  ) {
    throw new Error(
      "Please select at least one appointment time."
    );
  }
}


function validateRequestedMonth(
  year,
  monthNumber
) {
  if (
    !Number.isInteger(year) ||
    year < 2020 ||
    year > 2100
  ) {
    throw new Error(
      "Invalid year."
    );
  }

  if (
    !Number.isInteger(monthNumber) ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {
    throw new Error(
      "Invalid month."
    );
  }
}


function parseClientDate(
  value
) {
  const match =
    String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
    );

  if (!match) {
    throw new Error(
      "An invalid booking date was received."
    );
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0
  );
}


function formatDateForClient(
  date
) {
  return Utilities.formatDate(
    date,
    getSetting_("TIMEZONE", DEFAULT_SETTINGS.TIMEZONE),
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function formatDateForSheet(
  date
) {
  return Utilities.formatDate(
    date,
    getSetting_("TIMEZONE", DEFAULT_SETTINGS.TIMEZONE),
    "EEEE d MMMM yyyy 'at' h:mm a"
  );
}


function rangesOverlap(
  startA,
  endA,
  startB,
  endB
) {
  return (
    startA.getTime() <
    endB.getTime() &&
    endA.getTime() >
    startB.getTime()
  );
}


function slotClashesWithEvent(
  slotStart,
  slotEnd,
  event
) {
  let blockedFrom;
  let blockedUntil;

  if (
    event.isAllDayEvent()
  ) {
    blockedFrom =
      event.getStartTime();

    blockedUntil =
      event.getEndTime();
  } else {
    blockedFrom =
      new Date(
        event
          .getStartTime()
          .getTime() -
        BUFFER_BEFORE_MINUTES *
        60000
      );

    blockedUntil =
      new Date(
        event
          .getEndTime()
          .getTime() +
        BUFFER_AFTER_MINUTES *
        60000
      );
  }

  return rangesOverlap(
    slotStart,
    slotEnd,
    blockedFrom,
    blockedUntil
  );
}


function escapeHtml(
  value
) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


function getMonthCacheKey(
  year,
  monthNumber
) {
  return (
    "booking-availability-" +
    year +
    "-" +
    String(monthNumber)
      .padStart(2, "0")
  );
}


function clearCacheForSelectedDates(
  selectedDates
) {
  const keys =
    Array.from(
      new Set(
        selectedDates.map(
          function (date) {
            return getMonthCacheKey(
              date.getFullYear(),
              date.getMonth() + 1
            );
          }
        )
      )
    );

  if (keys.length) {
    CacheService
      .getScriptCache()
      .removeAll(keys);
  }
}


function clearAllAvailabilityCaches() {
  const keys = [];
  const now = new Date();

  for (
    let index = 0;
    index <= MONTHS_AHEAD;
    index++
  ) {
    const month =
      new Date(
        now.getFullYear(),
        now.getMonth() + index,
        1
      );

    keys.push(
      getMonthCacheKey(
        month.getFullYear(),
        month.getMonth() + 1
      )
    );
  }

  CacheService
    .getScriptCache()
    .removeAll(keys);
}


function findRowByStripeSessionId(
  sheet,
  sessionId
) {
  if (
    sheet.getLastRow() < 2
  ) {
    return 0;
  }

  const values =
    sheet
      .getRange(
        2,
        15,
        sheet.getLastRow() - 1,
        1
      )
      .getValues();

  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    if (
      String(values[index][0]) ===
      String(sessionId)
    ) {
      return index + 2;
    }
  }

  return 0;
}


function findRowByBookingId(
  sheet,
  bookingId
) {
  if (
    sheet.getLastRow() < 2
  ) {
    return 0;
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        1
      )
      .getValues();

  for (
    let index = 0;
    index < values.length;
    index++
  ) {
    if (
      String(values[index][0]) ===
      String(bookingId)
    ) {
      return index + 2;
    }
  }

  return 0;
}


function rowToBookingData(
  row
) {
  return {
    customerName:
      String(row[2] || ""),

    email:
      String(row[3] || ""),

    phone:
      String(row[4] || ""),

    organisation:
      String(row[5] || ""),

    address:
      String(row[6] || ""),

    notes:
      String(row[7] || ""),

    eventType:
      String(row[12] || ""),

    selectedTimes: []
  };
}



function buildPaidResponse(row) {
  const appointmentStart = new Date(
    new Date(row[9]).getTime() + BUFFER_BEFORE_MINUTES * 60000
  );

  return {
    success: true,
    bookingId: row[0],
    customerName: row[2],
    eventType: row[12],
    selectedTimes: [formatDateForClient(appointmentStart)],
    paid: true
  };
}


/** Adds the spreadsheet menu whenever the Sheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Booking System")
    .addItem("Setup / Install", "showSetupSidebar")
    .addSeparator()
    .addItem("Confirm selected booking", "confirmSelectedBooking")
    .addItem("Cancel selected booking", "cancelSelectedBooking")
    .addSeparator()
    .addItem("Test calendar", "testCalendarConnection")
    .addItem("Test Stripe", "testStripeConnection")
    .addItem("Install Stripe trigger", "setupStripeReconciliationTrigger")
    .addSeparator()
    .addItem("Show iframe code", "showIframeCode")
    .addToUi();
}


function showSetupSidebar() {
  const html = HtmlService
    .createTemplateFromFile("Setup")
    .evaluate()
    .setTitle("Booking System Setup");

  SpreadsheetApp.getUi().showSidebar(html);
}


function getSetupData() {
  const result = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    result[key] = getSetting_(key, DEFAULT_SETTINGS[key]);
  });
  result.STRIPE_SECRET_KEY = "";
  result.STRIPE_PRICE_ID = PropertiesService.getScriptProperties().getProperty("STRIPE_PRICE_ID") || "";
  result.SPREADSHEET_ID = getBookingSpreadsheet().getId();
  return result;
}


function saveSetupData(form) {
  if (!form) throw new Error("No setup information was received.");

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Open this installer from its Google Sheet.");

  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", spreadsheet.getId());

  const publicKeys = Object.keys(DEFAULT_SETTINGS);
  publicKeys.forEach(function (key) {
    setSetting_(key, String(form[key] || "").trim());
  });

  if (String(form.STRIPE_SECRET_KEY || "").trim()) {
    PropertiesService.getScriptProperties().setProperty(
      "STRIPE_SECRET_KEY",
      String(form.STRIPE_SECRET_KEY).trim()
    );
  }

  PropertiesService.getScriptProperties().setProperty(
    "STRIPE_PRICE_ID",
    String(form.STRIPE_PRICE_ID || "").trim()
  );

  spreadsheet.setSpreadsheetTimeZone(
    getSetting_("TIMEZONE", DEFAULT_SETTINGS.TIMEZONE)
  );

  installBookingSystem_();
  return "Settings saved and the booking sheets are ready.";
}


function installBookingSystem_() {
  const spreadsheet = getBookingSpreadsheet();
  const bookings = getBookingsSheet();
  createSettingsSheet_();

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      "Provisionally Reserved",
      "Booked",
      "Cancelled",
      "Awaiting Payment",
      "Paid / Confirmed",
      "Payment Cancelled",
      "Payment Expired"
    ], true)
    .setAllowInvalid(false)
    .build();

  bookings.getRange("L2:L").setDataValidation(statusRule);
  bookings.autoResizeColumns(1, BOOKING_HEADERS.length);
  bookings.setFrozenRows(1);

  return true;
}


function createSettingsSheet_() {
  const spreadsheet = getBookingSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SETTINGS_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(SETTINGS_SHEET);

  const rows = [["Setting", "Value", "Description"]];
  const descriptions = {
    BUSINESS_NAME: "Name shown on the booking page and emails",
    OWNER_NAME: "Your name or team name",
    OWNER_EMAIL: "Receives new-booking notifications",
    CALENDAR_ID: "Google Calendar ID or calendar email address",
    TIMEZONE: "For example America/New_York, Europe/London or Pacific/Auckland",
    WEBSITE_URL: "Homepage used by the return button",
    WEB_APP_URL: "Paste the deployed Apps Script /exec URL",
    STANDARD_BOOKING_QUESTIONNAIRE_URL: "Optional questionnaire URL",
    GROUP_BOOKING_QUESTIONNAIRE_URL: "Optional questionnaire URL"
  };

  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    rows.push([key, getSetting_(key, DEFAULT_SETTINGS[key]), descriptions[key] || ""]);
  });

  sheet.clear();
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 3);
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  return sheet;
}


function getSetting_(key, fallback) {
  const propertyValue = PropertiesService.getScriptProperties().getProperty(key);
  if (propertyValue !== null && propertyValue !== "") return propertyValue;
  return fallback === undefined ? "" : fallback;
}


function setSetting_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value || "");
}


function getRequiredSetting_(key, label) {
  const value = getSetting_(key, "");
  if (!value) throw new Error((label || key) + " has not been configured. Open Booking System → Setup / Install.");
  return value;
}


function testCalendarConnection() {
  const calendar = getBookingCalendar();
  SpreadsheetApp.getUi().alert("Calendar connected: " + calendar.getName());
}


function showIframeCode() {
  const url = getRequiredSetting_("WEB_APP_URL", "Web app URL");
  const code = '<iframe src="' + url + '" width="100%" height="1500" style="border:0;display:block;" loading="lazy" allow="payment"></iframe>';

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial;padding:18px">' +
    '<h3>Website iframe code</h3>' +
    '<textarea style="width:100%;height:180px">' + escapeHtml(code) + '</textarea>' +
    '<p>Paste this into an HTML or Embed Code block on your website.</p></div>'
  ).setWidth(620).setHeight(360);

  SpreadsheetApp.getUi().showModalDialog(html, "Iframe code");
}


function confirmSelectedBooking() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();

  if (!sheet || sheet.getName() !== BOOKINGS_SHEET) {
    ui.alert("Open the Bookings sheet and select a booking row.");
    return;
  }

  const selectedRow = sheet.getActiveRange().getRow();
  if (selectedRow < 2) {
    ui.alert("Select a booking row first.");
    return;
  }

  const bookingId = String(sheet.getRange(selectedRow, 1).getValue()).trim();
  if (!bookingId) {
    ui.alert("The selected row has no Booking ID.");
    return;
  }

  const matchingRows = getRowsForBookingId_(sheet, bookingId);
  if (!matchingRows.length) throw new Error("No matching booking rows were found.");

  const response = ui.alert(
    "Confirm booking",
    "Change this booking to Booked and email the customer?",
    ui.ButtonSet.YES_NO
  );
  if (response !== ui.Button.YES) return;

  let updatedEvents = 0;
  matchingRows.forEach(function (item) {
    updatedEvents += updateCalendarEventStatus_(item.values, bookingId, "Booked");
    sheet.getRange(item.sheetRow, 12).setValue("Booked");
    sheet.getRange(item.sheetRow, 19).setValue(new Date());
  });

  const bookingData = rowToBookingData(matchingRows[0].values);
  sendBookedConfirmationEmail_(bookingData, bookingId, matchingRows);
  SpreadsheetApp.flush();

  ui.alert("Booking confirmed. " + updatedEvents + " Calendar event(s) updated and the customer was emailed.");
}


function cancelSelectedBooking() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSheet();
  if (!sheet || sheet.getName() !== BOOKINGS_SHEET) {
    ui.alert("Open the Bookings sheet and select a booking row.");
    return;
  }

  const row = sheet.getActiveRange().getRow();
  if (row < 2) {
    ui.alert("Select a booking row first.");
    return;
  }

  const bookingId = String(sheet.getRange(row, 1).getValue()).trim();
  const matchingRows = getRowsForBookingId_(sheet, bookingId);
  const response = ui.alert("Cancel booking", "Mark this booking as Cancelled and release its availability?", ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  matchingRows.forEach(function (item) {
    updateCalendarEventStatus_(item.values, bookingId, "Cancelled");
    sheet.getRange(item.sheetRow, 12).setValue("Cancelled");
  });
  clearAllAvailabilityCaches();
  SpreadsheetApp.flush();
  ui.alert("Booking marked as Cancelled.");
}


function getRowsForBookingId_(sheet, bookingId) {
  if (sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, BOOKING_HEADERS.length).getValues();
  return rows.map(function (values, index) {
    return {sheetRow: index + 2, values: values};
  }).filter(function (item) {
    return String(item.values[0]).trim() === String(bookingId).trim();
  });
}


function updateCalendarEventStatus_(row, bookingId, newStatus) {
  const calendar = getBookingCalendar();
  const savedEventId = String(row[17] || "").trim();
  let events = [];

  if (savedEventId) {
    const event = calendar.getEventById(savedEventId);
    if (event) events = [event];
  }

  if (!events.length) {
    events = calendar.getEvents(new Date(row[9]), new Date(row[10]));
  }

  let count = 0;
  events.forEach(function (event) {
    const description = event.getDescription() || "";
    if (description.indexOf("Booking ID: " + bookingId) === -1) return;

    const updated = /^Status:.*$/im.test(description)
      ? description.replace(/^Status:.*$/im, "Status: " + newStatus)
      : description + "\nStatus: " + newStatus;

    event.setDescription(updated);
    count++;
  });
  return count;
}


function sendBookedConfirmationEmail_(bookingData, bookingId, matchingRows) {
  const selectedTimes = matchingRows.map(function (item) {
    return formatDateForSheet(new Date(
      new Date(item.values[9]).getTime() + BUFFER_BEFORE_MINUTES * 60000
    ));
  });

  const businessName = getSetting_("BUSINESS_NAME", DEFAULT_SETTINGS.BUSINESS_NAME);
  const ownerName = getSetting_("OWNER_NAME", DEFAULT_SETTINGS.OWNER_NAME);
  const websiteUrl = getSetting_("WEBSITE_URL", "");
  const selectedLines = selectedTimes.map(function (time) { return "• " + time; }).join("\n");

  const body = [
    "Hello " + bookingData.customerName + ",",
    "",
    "Thank you for speaking with me.",
    "",
    "I’m pleased to confirm that your booking is now booked.",
    "",
    "Event type: " + bookingData.eventType,
    "",
    "Confirmed time:",
    selectedLines,
    "",
    "Booking ID: " + bookingId,
    "",
    "Location: " + bookingData.address,
    "",
    "I look forward to being part of your event.",
    "",
    "Kind regards,",
    ownerName,
    businessName,
    websiteUrl
  ].join("\n");

  MailApp.sendEmail({
    to: bookingData.email,
    subject: "Your " + businessName + " booking is confirmed",
    body: body,
    name: businessName
  });
}
