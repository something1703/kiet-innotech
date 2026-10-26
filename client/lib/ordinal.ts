/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export function ordinal(number: number) {
  const suffix = number % 100 >= 10 && number % 100 <= 20 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[number % 10] ?? "th";
  return `${number}${suffix}`;
}
