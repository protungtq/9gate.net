export function sample<T>(items: T[], count: number): T[] {
  const pool = [...items];
  for (let index = 0; index < Math.min(count, pool.length); index++) {
    const randomIndex = index + Math.floor(Math.random() * (pool.length - index));
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }
  return pool.slice(0, count);
}
