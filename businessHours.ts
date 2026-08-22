export const STORE_TIME_ZONE = 'Asia/Kuala_Lumpur';
export const WEBSITE_STORE_BRANCH = { id: 'cheras', name: 'Cheras 区' } as const;
export const STORE_OPEN_MINUTE = 17 * 60;
export const STORE_CLOSE_MINUTE = 4 * 60;

export function formatStoreTime(minuteOfDay: number) {
  const normalized = ((Math.trunc(minuteOfDay) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function formatStoreSchedule(openingMinute = STORE_OPEN_MINUTE, closingMinute = STORE_CLOSE_MINUTE) {
  return `每日 ${formatStoreTime(openingMinute)}–${formatStoreTime(closingMinute)}`;
}

const storeTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: STORE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function getStoreMinuteOfDay(date = new Date()) {
  const parts = storeTimeFormatter.formatToParts(date);
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export function isStoreOpen(date = new Date(), openingMinute = STORE_OPEN_MINUTE, closingMinute = STORE_CLOSE_MINUTE) {
  const minuteOfDay = getStoreMinuteOfDay(date);
  if (openingMinute === closingMinute) return false;
  if (openingMinute < closingMinute) return minuteOfDay >= openingMinute && minuteOfDay < closingMinute;
  return minuteOfDay >= openingMinute || minuteOfDay < closingMinute;
}
