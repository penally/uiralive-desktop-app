/**
 * Indirect env access. Index map: 14=proof, 15-16=path (keys server-side only)
 */
const _p = (i: number) =>
  typeof import.meta !== 'undefined'
    ? ((import.meta as any).env?.[String.fromCharCode(86, 73, 84, 69, 95, 88) + i] ?? '')
    : '';
export const envAt = _p;

