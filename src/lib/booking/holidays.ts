export const getDanishHolidays = (year: number): Record<string, string> => {
  const holidays: Record<string, string> = {};

  holidays[`${year}-01-01`] = 'Nytaarsdag';
  holidays[`${year}-06-05`] = 'Grundlovsdag';
  holidays[`${year}-12-24`] = 'Juleaften';
  holidays[`${year}-12-25`] = '1. Juledag';
  holidays[`${year}-12-26`] = '2. Juledag';
  holidays[`${year}-12-31`] = 'Nytaarsaften';

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);

  const fmt = (date: Date) => date.toISOString().split('T')[0];
  const add = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  holidays[fmt(add(easter, -3))] = 'Skaertorsdag';
  holidays[fmt(add(easter, -2))] = 'Langfredag';
  holidays[fmt(add(easter, 0))] = 'Paaskedag';
  holidays[fmt(add(easter, 1))] = '2. Paaskedag';
  holidays[fmt(add(easter, 39))] = 'Kristi Himmelfart';
  holidays[fmt(add(easter, 49))] = 'Pinsedag';
  holidays[fmt(add(easter, 50))] = '2. Pinsedag';

  return holidays;
};
