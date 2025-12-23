// In-game calendar and time utilities

export interface GameDate {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
}

export interface Calendar {
  name: string
  monthsPerYear: number
  daysPerMonth: number[] // Array of days per month
  monthNames: string[]
  daysPerWeek: number
  dayNames: string[]
  hoursPerDay: number
  startYear: number
}

// Default fantasy calendar (similar to Forgotten Realms)
export const DEFAULT_CALENDAR: Calendar = {
  name: 'Standard Reckoning',
  monthsPerYear: 12,
  daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  monthNames: [
    'Deepwinter', 'Claws of Winter', 'Storms', 'Melting',
    'Flowers', 'Summertide', 'Highsun', 'Harvest',
    'Fading', 'Leaffall', 'Rotting', 'Drawing Down'
  ],
  daysPerWeek: 10,
  dayNames: [
    'First', 'Second', 'Third', 'Fourth', 'Fifth',
    'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'
  ],
  hoursPerDay: 24,
  startYear: 1490,
}

// Greyhawk-style calendar
export const GREYHAWK_CALENDAR: Calendar = {
  name: 'Common Year',
  monthsPerYear: 12,
  daysPerMonth: [28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  monthNames: [
    'Needfest', 'Fireseek', 'Readying', 'Coldeven',
    'Growfest', 'Planting', 'Flocktime', 'Wealsun',
    'Richfest', 'Reaping', 'Goodmonth', 'Harvester'
  ],
  daysPerWeek: 7,
  dayNames: ['Starday', 'Sunday', 'Moonday', 'Godsday', 'Waterday', 'Earthday', 'Freeday'],
  hoursPerDay: 24,
  startYear: 576,
}

export function createCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return { ...DEFAULT_CALENDAR, ...overrides }
}

export function formatGameDate(date: GameDate, calendar: Calendar = DEFAULT_CALENDAR): string {
  const monthName = calendar.monthNames[date.month - 1] || `Month ${date.month}`
  return `${date.day} ${monthName}, ${date.year}`
}

export function formatGameDateTime(date: GameDate, calendar: Calendar = DEFAULT_CALENDAR): string {
  const dateStr = formatGameDate(date, calendar)
  if (date.hour !== undefined) {
    const hour = date.hour % 12 || 12
    const ampm = date.hour < 12 ? 'AM' : 'PM'
    const minute = (date.minute ?? 0).toString().padStart(2, '0')
    return `${dateStr}, ${hour}:${minute} ${ampm}`
  }
  return dateStr
}

export function getDayOfWeek(date: GameDate, calendar: Calendar = DEFAULT_CALENDAR): string {
  const totalDays = getTotalDays(date, calendar)
  const dayIndex = totalDays % calendar.daysPerWeek
  return calendar.dayNames[dayIndex]
}

export function getTotalDays(date: GameDate, calendar: Calendar = DEFAULT_CALENDAR): number {
  let days = 0

  // Years
  days += (date.year - calendar.startYear) * calendar.daysPerMonth.reduce((a, b) => a + b, 0)

  // Months
  for (let m = 0; m < date.month - 1; m++) {
    days += calendar.daysPerMonth[m]
  }

  // Days
  days += date.day

  return days
}

export function addDays(date: GameDate, days: number, calendar: Calendar = DEFAULT_CALENDAR): GameDate {
  let totalDays = getTotalDays(date, calendar) + days

  // Convert back to date
  const daysPerYear = calendar.daysPerMonth.reduce((a, b) => a + b, 0)
  let year = calendar.startYear + Math.floor(totalDays / daysPerYear)
  let remaining = totalDays % daysPerYear

  let month = 1
  for (const daysInMonth of calendar.daysPerMonth) {
    if (remaining <= daysInMonth) break
    remaining -= daysInMonth
    month++
  }

  return {
    year,
    month,
    day: remaining,
    hour: date.hour,
    minute: date.minute,
  }
}

export function addHours(date: GameDate, hours: number, calendar: Calendar = DEFAULT_CALENDAR): GameDate {
  const totalMinutes = ((date.hour ?? 0) * 60 + (date.minute ?? 0)) + (hours * 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const extraDays = Math.floor(totalHours / calendar.hoursPerDay)

  const newDate = extraDays > 0 ? addDays(date, extraDays, calendar) : { ...date }
  newDate.hour = totalHours % calendar.hoursPerDay
  newDate.minute = totalMinutes % 60

  return newDate
}

export function daysBetween(a: GameDate, b: GameDate, calendar: Calendar = DEFAULT_CALENDAR): number {
  return Math.abs(getTotalDays(b, calendar) - getTotalDays(a, calendar))
}

export function compareDates(a: GameDate, b: GameDate, calendar: Calendar = DEFAULT_CALENDAR): number {
  return getTotalDays(a, calendar) - getTotalDays(b, calendar)
}

export function isAfter(a: GameDate, b: GameDate, calendar: Calendar = DEFAULT_CALENDAR): boolean {
  return compareDates(a, b, calendar) > 0
}

export function isBefore(a: GameDate, b: GameDate, calendar: Calendar = DEFAULT_CALENDAR): boolean {
  return compareDates(a, b, calendar) < 0
}

export function isSameDay(a: GameDate, b: GameDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

// Time of day helpers
export function getTimeOfDay(hour: number): 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function formatTimeOfDay(hour: number): string {
  const timeOfDay = getTimeOfDay(hour)
  const descriptors: Record<string, string[]> = {
    dawn: ['The sky lightens', 'Dawn breaks', 'The sun rises'],
    morning: ['Morning light fills the sky', 'The day begins', 'Sunlight streams down'],
    afternoon: ['The sun is high', 'Midday arrives', 'The afternoon wears on'],
    evening: ['The sun sets', 'Dusk approaches', 'Evening falls'],
    night: ['Darkness covers the land', 'The stars emerge', 'Night has fallen'],
  }
  const options = descriptors[timeOfDay]
  return options[Math.floor(Math.random() * options.length)]
}

// Session time tracking
export interface SessionTime {
  realStartTime: Date
  realDuration: number // minutes
  gameStartDate: GameDate
  gameEndDate: GameDate
}

export function formatSessionDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function formatGameTimePassed(start: GameDate, end: GameDate, calendar: Calendar = DEFAULT_CALENDAR): string {
  const days = daysBetween(start, end, calendar)
  if (days === 0) {
    const hours = (end.hour ?? 0) - (start.hour ?? 0)
    return hours <= 1 ? 'about an hour' : `about ${hours} hours`
  }
  if (days === 1) return 'a day'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.floor(days / 7)} weeks`
  return `${Math.floor(days / 30)} months`
}
