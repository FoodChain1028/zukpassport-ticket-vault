/**
 * Popup window will redirect to Zupass to request a proof.
 * Open the popup window under the current domain, let it redirect there.
 */
export function sendZupassRequest(proofUrl: string): void {
  // Open the popup directly with the provided proofUrl
  // The proofUrl already contains the full zupass.org URL with the necessary parameters
  window.open(proofUrl, '_blank', 'width=450,height=600,top=100,popup');
}
