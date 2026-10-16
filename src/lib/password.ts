/** A random password the creator can hand over; letters without look-alikes, digits, a few symbols. */
export function generatePassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'
  const values = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}
