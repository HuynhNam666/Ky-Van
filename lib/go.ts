// Chuyển trang mượt (SoftNav xử lý) để trình phát nhạc nền không bị tải lại.
export function go(path: string) {
  window.postMessage({ type: "kyvan-navigate", path }, location.origin);
}
