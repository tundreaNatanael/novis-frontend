/**
 * How the console names the lesson counts (architecture.md → derived counts and finance counts):
 * one label and one hint per count, shared by a student's Lesson balances and the Finance tab, so
 * the same number has the same name and meaning wherever it shows. Teacher payouts are "paid out",
 * never "paid".
 */
export const LESSON_COUNTS = {
  paidByStudent: {
    label: 'Paid by student',
    hint: 'Lessons paid for in the period, each prepaid credit once.',
  },
  used: { label: 'Used', hint: 'Held or late-canceled lessons dated in the period.' },
  prepaidRemaining: {
    label: 'Prepaid left',
    hint: 'Paid lessons still pending (scheduled or not).',
  },
  unpaidDue: { label: 'Unpaid due', hint: 'Held or late-canceled lessons not paid yet.' },
  upcomingUnpaid: { label: 'Upcoming unpaid', hint: 'Dated pending lessons without payment.' },
  toSchedule: { label: 'To schedule', hint: 'Pending lessons without a date, paid or not.' },
  taught: { label: 'Taught', hint: 'Held or late-canceled lessons dated in the period.' },
  paidOut: { label: 'Paid out', hint: 'Taught lessons a payout to the teacher covers.' },
  owed: { label: 'Owed', hint: 'Taught lessons not paid out to the teacher yet.' },
  owedAllTime: {
    label: 'Owed, all time',
    hint: 'Every held or late-canceled lesson not paid out yet, whatever its date.',
  },
  usedPaidNotPaidOut: {
    label: 'Paid by student, not paid out',
    hint: 'Taught lessons the student paid for that the teacher is not paid out for yet.',
  },
  paidOutNotPaidByStudent: {
    label: 'Paid out, not paid by student',
    hint: 'Taught lessons paid out to the teacher that the student has not paid for.',
  },
} as const

export type LessonCountName = keyof typeof LESSON_COUNTS
