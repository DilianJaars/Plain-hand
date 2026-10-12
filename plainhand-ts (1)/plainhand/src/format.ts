export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h + "h " + (m < 10 ? "0" : "") + m + "m";
}

/** A thin progress ring. `fraction` is how much is left, from 0 to 1. */
export function ring(fraction: number, size: number, stroke: number): string {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" aria-hidden="true">' +
    '<circle class="ring-bg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke + '"/>' +
    '<circle class="ring-fg" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - f)).toFixed(2) +
    '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/></svg>'
  );
}

export function copyText(text: string, fallback: HTMLTextAreaElement | null): Promise<boolean> {
  const select = (): boolean => {
    if (!fallback) return false;
    fallback.focus();
    fallback.select();
    return false;
  };
  try {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => select(),
    );
  } catch {
    return Promise.resolve(select());
  }
}
