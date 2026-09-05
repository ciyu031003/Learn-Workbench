/**
 * 每日一言 / 励志短句 —— 偏励志、有内涵的古典与哲思句子。
 * 单一事实源：首页“每日一言”与专注页“励志短句”共用。
 */

export const DAILY_QUOTES = [
  "天行健，君子以自强不息。",
  "地势坤，君子以厚德载物。",
  "博学之，审问之，慎思之，明辨之，笃行之。",
  "路漫漫其修远兮，吾将上下而求索。",
  "不积跬步，无以至千里；不积小流，无以成江海。",
  "锲而不舍，金石可镂。",
  "知之者不如好之者，好之者不如乐之者。",
  "学而不思则罔，思而不学则殆。",
  "苟日新，日日新，又日新。",
  "行百里者半九十。",
  "心中有光，脚下有路。",
  "学问之道无他，求其放心而已矣。",
];

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export function getDailyQuote(date: Date = new Date()): string {
  return DAILY_QUOTES[dayOfYear(date) % DAILY_QUOTES.length];
}
