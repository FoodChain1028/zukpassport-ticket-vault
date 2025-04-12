import { constructZupassPcdAddRequestUrl } from '@pcd/passport-interface';
import { PODPCD, PODPCDPackage } from '@pcd/pod-pcd';
import { POD, podEntriesFromJSON } from '@pcd/pod';
import { v4 as uuid } from 'uuid';
import { ZUPASS_URL } from './constants';
/**
 * Popup window will redirect to Zupass to request a proof.
 * Open the popup window under the current domain, let it redirect there.
 */
export function sendZupassRequest(proofUrl: string): void {
  // Open the popup directly with the provided proofUrl
  // The proofUrl already contains the full zupass.org URL with the necessary parameters
  window.open(proofUrl, '_blank', 'width=450,height=600,top=100,popup');
}

/**
 * Add a new POD to Zupass
 * @param podContent 
 * @param podPrivateKey 
 * @param podFolder 
 * @param redirectToFolder 
 */
export async function addPODPCD(
  podContent: string,
  podPrivateKey: string,
  podFolder: string | undefined,
  redirectToFolder?: boolean,
): Promise<void> {
  podPrivateKey ='AAECAwQFBgcICQABAgMEBQYHCAkAAQIDBAUGBwgJAAE=';
  const newPOD = new PODPCD(
    uuid(),
    POD.sign(podEntriesFromJSON(JSON.parse(podContent)), podPrivateKey),
  );

  const serializedPODPCD = await PODPCDPackage.serialize(newPOD);

  const url = constructZupassPcdAddRequestUrl(
    ZUPASS_URL,
    window.location.origin + '#/popup',
    serializedPODPCD,
    podFolder,
    false,
    redirectToFolder,
  );

  if (redirectToFolder) {
    open(url);
  } else {
    sendZupassRequest(url);
  }
}
