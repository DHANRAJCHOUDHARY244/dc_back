export function toDateOnly(input: string | Date): string {
  const d = new Date(input);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeDateRange(
  start: string | Date,
  end: string | Date
): { start_date: string; end_date: string } {
  return {
    start_date: toDateOnly(start),
    end_date: toDateOnly(end),
  };
}
