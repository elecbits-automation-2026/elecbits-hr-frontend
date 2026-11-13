/** Labels for the fields inside object-shaped settings. */
export const FIELD_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  vacation_family: 'Vacation / family',
  amount: 'Amount (₹/month)',
  salaryFloor: 'Applies from salary (₹)',
  noticeDays: 'Notice period (days)',
  probationMonths: 'Probation (months)',
  remindDaysBefore: 'Remind heads (days before the quarter)',
  deadlineDaysBefore: 'Deadline (days before the quarter)',
  leaves: 'Leave requests',
  remote: 'Remote-work requests',
  minMonthsInBand: 'Months in current band',
  minAttainment: "Last quarter's attainment (%)",
  cooldownDays: 'Wait after a closed conversation (days)',
  companyName: 'Company name',
  address: 'Address',
  l1Decide: 'Dispute L1 — manager decides in',
  l2Ack: 'Dispute L2 — HR acknowledges in',
  l2Decide: 'Dispute L2 — HR decides in',
  l3Decide: 'Dispute L3 — committee decides in',
  escalateWithin: 'Escalate within (after a decision)',
  complaintAck: 'Complaint — acknowledge in',
  complaintResolveCalendarDays: 'Complaint — outcome in (calendar days)',
  contact: 'Contact (name, email or phone)',
};

export const SATURDAY_LABELS: Record<string, string> = {
  all_working: 'All Saturdays working',
  all_off: 'All Saturdays off',
  first_third_off: '1st & 3rd Saturdays off',
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  earned: 'Earned leave',
  sick: 'Sick leave',
};
