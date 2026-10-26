/**
 * Hands a downloaded certificate to the browser. The link goes into the page for the click and the object URL lives on for a
 * few seconds: iPhone Safari and some Android browsers start the download after the click, and a URL revoked straight away
 * gives them an empty file.
 */
export function saveCertificate(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
