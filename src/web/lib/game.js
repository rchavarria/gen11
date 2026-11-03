export function formatTime(time) {
  const hhmm = time?.slice(0, 5);
  return hhmm && hhmm !== '00:00' ? hhmm : null;
}

export function periodLabel(index) {
  if (index < 4) return `Q${index + 1}`;
  return index === 4 ? 'OT' : `OT${index - 3}`;
}
