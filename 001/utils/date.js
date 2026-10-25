/** 日期工具：全部使用本地时区的 YYYY-MM-DD 字符串作为主键。 */

const DAY = 86400000

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/** Date -> 'YYYY-MM-DD'（本地时区，不用 toISOString，避免时区偏移） */
function fmt(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

/** 'YYYY-MM-DD' -> Date（本地零点） */
function parse(str) {
  if (!str) return new Date()
  const p = String(str).split('-')
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
}

function today() {
  return fmt(new Date())
}

function yearOf(dateStr) {
  return String(dateStr).slice(0, 4)
}

function monthOf(dateStr) {
  return Number(String(dateStr).slice(5, 7))
}

function dayOf(dateStr) {
  return Number(String(dateStr).slice(8, 10))
}

function addDays(dateStr, n) {
  const d = parse(dateStr)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

function diffDays(a, b) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / DAY)
}

/** 0 = 周日 */
function weekday(dateStr) {
  return parse(dateStr).getDay()
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/** '今天' / '昨天' / '10月12日' / '2025年10月12日' */
function friendly(dateStr) {
  const t = today()
  if (dateStr === t) return '今天'
  if (dateStr === addDays(t, -1)) return '昨天'
  if (dateStr === addDays(t, -2)) return '前天'
  const y = yearOf(dateStr)
  const now = yearOf(t)
  if (y === now) return monthOf(dateStr) + '月' + dayOf(dateStr) + '日'
  return y + '年' + monthOf(dateStr) + '月' + dayOf(dateStr) + '日'
}

/** 相对时间描述，用于「最近更新」 */
function relative(dateStr) {
  const n = diffDays(dateStr, today())
  if (n <= 0) return '今天'
  if (n === 1) return '昨天'
  if (n < 7) return n + ' 天前'
  if (n < 30) return Math.floor(n / 7) + ' 周前'
  return friendly(dateStr)
}

/** 有数据的年份列表，倒序 */
function yearsOf(dates) {
  const set = {}
  dates.forEach((d) => {
    if (d) set[yearOf(d)] = true
  })
  return Object.keys(set).sort((a, b) => Number(b) - Number(a))
}

module.exports = {
  fmt,
  parse,
  today,
  yearOf,
  monthOf,
  dayOf,
  addDays,
  diffDays,
  weekday,
  daysInMonth,
  friendly,
  relative,
  yearsOf
}
