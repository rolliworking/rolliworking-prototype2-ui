const at = (d: Date, h: number, m = 0) => {
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const daysAgo = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return at(d, h);
};

export const daysFromNow = (n: number, h = 17) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return at(d, h);
};

export const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

export const dayThisMonth = (day: number) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), Math.min(day, now.getDate()));
  return at(d, 14, 30);
};
