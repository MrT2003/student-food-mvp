// Chỉ phục vụ hướng dẫn UX; quyền push thực tế do browser và API session kiểm soát.
export function needsIOSInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}
