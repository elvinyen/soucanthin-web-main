export const STORE_TIME_ZONE = 'Asia/Kuala_Lumpur';
export const WEBSITE_STORE_BRANCH = { id: 'cheras', name: 'Cheras 区' } as const;
export const STORE_OPEN_MINUTE = 17 * 60;
export const STORE_CLOSE_MINUTE = 4 * 60;

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

export function isStoreOpen(date = new Date()) {
  const minuteOfDay = getStoreMinuteOfDay(date);
  return minuteOfDay >= STORE_OPEN_MINUTE || minuteOfDay < STORE_CLOSE_MINUTE;
}
