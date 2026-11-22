/** Keep DnD / card drag from capturing progress control gestures. */
export function stopPointerPropagation(event: Event): void {
  event.stopPropagation();
}
