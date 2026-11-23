import { useEffect, useState } from 'react';

/** Renvoie Date.now(), rafraîchi toutes les `intervalMs` tant que `active` est vrai. */
export function useNow(active = true, intervalMs = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export const mmss = (totalSec: number) => {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export const speedLabel = (v: number) => (v > 0 ? `x${v.toFixed(1).replace('.', ',')}` : '-');
