export function openSidePanel() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("skindex:openPanel"));
  }
}
