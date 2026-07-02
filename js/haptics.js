// 짧은 진동으로 동작 완료를 알림 (지원 안 하는 기기에서는 조용히 무시)
export function haptic(pattern = 15) {
  navigator.vibrate?.(pattern);
}
