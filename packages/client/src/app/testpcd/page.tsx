'use client';
import { useState } from 'react';
import { constructZupassPcdAddRequestUrl } from '@pcd/passport-interface';
import { PODPCD, PODPCDPackage } from '@pcd/pod-pcd';
import { POD, podEntriesFromJSON } from '@pcd/pod';
import { v4 as uuid } from 'uuid';
import { sendZupassRequest } from '../utils';
import { ZUPASS_URL } from '../constants';
// import { EXAMPLE_POD_CONTENT } from '../podExampleConstants';

export default function TestPCD() {
  const [podContent, setPODContent] = useState('{"A": "aaassddf"}');
  const [podPrivateKey] = useState('AAECAwQFBgcICQABAgMEBQYHCAkAAQIDBAUGBwgJAAE=');
  const [podFolder, setPodFolder] = useState('Test PODs'); // Default folder name

  return (
    <div>
      <h3>POD PCD Example</h3>
      <p>This demonstrates how to add a simple POD PCD Zupass</p>
      <br />
      <br />
      Example POD content to sign: <br />
      <br />
      <textarea
        cols={45}
        rows={15}
        value={podContent}
        onChange={(e): void => {
          setPODContent(e.target.value);
        }}
      />
      <br />
      <button
        onClick={() =>
          addPODPCD(podContent, podPrivateKey, podFolder.length > 0 ? podFolder : undefined)
        }
      >
        add a new POD to Zupass
      </button>
      <br />
      <br />
      <label>
        Folder to add POD to:
        <input
          type="text"
          value={podFolder}
          placeholder="Enter folder name..."
          style={{ marginLeft: '16px' }}
          onChange={(e): void => {
            setPodFolder(e.target.value);
          }}
        />
      </label>
    </div>
  );
}

async function addPODPCD(
  podContent: string,
  podPrivateKey: string,
  podFolder: string | undefined,
  redirectToFolder?: boolean,
): Promise<void> {
  console.log(ZUPASS_URL);
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
  console.log(url);

  if (redirectToFolder) {
    open(url);
  } else {
    sendZupassRequest(url);
  }
}
