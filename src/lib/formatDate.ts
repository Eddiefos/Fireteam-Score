const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatLastPlayed(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate)

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart  = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.round(
    (todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays} days ago`

  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}
