/**
 * The balance as the lesson totals table shows it: "+2" paid in advance, "0", and an amount owed
 * without its sign ("5" for −5), since the column's header then says "In arrears" instead.
 */
export function balanceValue(balance: number): string {
  if (balance > 0) return `+${balance}`
  return String(Math.abs(balance))
}
