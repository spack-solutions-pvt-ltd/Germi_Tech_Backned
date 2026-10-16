"use strict";

// Response messages for controller/notificationController.js.
// Functions build messages that include values (counts, codes, statuses).
const notificationMessages = {
  notificationSummaryFetchedSuccessfully: "Notification summary fetched successfully",
  notificationsFetchedSuccessfully: "Notifications fetched successfully",
  idIsRequired: "id is required",
  notificationNotFound: "Notification not found",
  notificationFetchedSuccessfully: "Notification fetched successfully",
  thisNotificationHasNoDocument: "This notification has no document",
  documentFileIsMissingOnThe: "Document file is missing on the server",
  fileLinksAreNotAvailableYet: "File links are not available yet — CloudFront is not configured",
  authenticationRequiredToSendANotification: "Authentication required to send a notification",
  toLevelIsRequired: "toLevel is required",
  toLevelMustBeOneOfL1: "toLevel must be one of L1, L2, L3, All",
  messageIsRequired: "message is required",
  notificationSentSuccessfully: "Notification sent successfully",
  cannotEditANotificationThatAlready: "Cannot edit a notification that already has responses",
  notificationUpdatedSuccessfully: "Notification updated successfully",
  notificationIdIsRequired: "notificationId is required",
  notificationResponsesFetchedSuccessfully: "Notification responses fetched successfully",
  authenticationRequiredToRespondToA: "Authentication required to respond to a notification",
  responseSubmittedSuccessfully: "Response submitted successfully",
};

module.exports = { notificationMessages };
