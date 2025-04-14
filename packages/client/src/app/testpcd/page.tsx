'use client';
import { useState } from 'react';
import { addPODPCD } from '../utils';
import { convertProofForPOD, proofToPODString } from '../utils/podConverter';

export default function TestPCD() {
  const [podPrivateKey] = useState('AAECAwQFBgcICQABAgMEBQYHCAkAAQIDBAUGBwgJAAE=');
  const [podFolder, setPodFolder] = useState('Self Proof Data'); // Default folder name

  // Example proof structure
  // this is the real proof get from backend in Self.
  const exampleProof = {
    a: [
      '2218721293884717613638497048031931256188091742657509215368815339884510653958',
      '2335713794755967637373876271044790175419374397897645565387294099657096854730',
    ],
    b: [
      [
        '19757409220170500343285743778763186834506143480073384527974078140890075749557',
        '11858899837098785153750971939927389636144504193705266730580625368764272240026',
      ],
      [
        '18903316782007708002900817992404286086354421525811570045190715751961435850855',
        '10543008542953568680830684611434449942479727121974715599974985711092315896196',
      ],
    ],
    c: [
      '9278308187848034359334492181158873226676949896135630083735738926547828526901',
      '3139679080712225980046420754840723260314838295194005369286231133550443547430',
    ],
    protocol: 'groth16',
    curve: '',
  };

  // Example public signals
  const examplePublicSignals = [
    '0',
    '125889334977186806473352390500834239990475522024106426917453824',
    '1773781688717606310397756023428205332782362187156068670010833396561870848',
    '6818352527182560077653388211384938507686473',
    '0',
    '0',
    '0',
    '10835404866968350488997494789445741373264055340251670148013289434802701779647',
    '1',
    '4519248318244936163329960176763313112511812759452292689850158372191562072786',
  ];

  // Convert to POD-compatible format
  const podData = convertProofForPOD(exampleProof, examplePublicSignals);
  console.log(podData);
  // For display purposes - pretty print the converted data
  const prettyPrintedPOD = JSON.stringify(podData, null, 2);

  // For actual usage with POD - compact JSON string
  const podReadyString = JSON.stringify(podData);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">ZK Proof POD Example</h2>
      <p className="mb-4">This demonstrates how to add a ZK proof to Zupass as a POD</p>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Converted POD Format:</h3>
        <textarea
          className="w-full border p-2 font-mono text-sm"
          cols={45}
          rows={15}
          value={prettyPrintedPOD}
          readOnly
        />
      </div>

      <div className="flex items-center mb-4">
        <label className="mr-4">
          Folder to add POD to:
          <input
            type="text"
            value={podFolder}
            placeholder="Enter folder name..."
            className="ml-2 p-1 border"
            onChange={(e): void => {
              setPodFolder(e.target.value);
            }}
          />
        </label>
      </div>

      <div className="flex gap-4">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => {
            // Use the converted proof data
            addPODPCD(podReadyString, podPrivateKey, podFolder.length > 0 ? podFolder : undefined);
          }}
        >
          Store ZK Proof in Zupass
        </button>
      </div>
    </div>
  );
}
