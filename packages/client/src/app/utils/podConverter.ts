/**
 * Converts complex proof data into a format suitable for POD storage.
 * POD storage requires simple key-value structures without nesting.
 */

type Groth16Proof = {
  a: string[];
  b: string[][];
  c: string[];
  protocol: string;
  curve: string;
};

/**
 * Converts a complex Groth16 proof and public signals into a flat structure for POD storage
 * @param proof The Groth16 proof object
 * @param publicSignals The array of public signals
 * @returns A flat object suitable for POD storage
 */
export function convertProofForPOD(proof: Groth16Proof, publicSignals: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Store proof_a values - using underscores instead of periods
  proof.a.forEach((value, index) => {
    result[`proof_a_${index}`] = value;
  });
  
  // Store proof_b values (2D array)
  proof.b.forEach((array, i) => {
    array.forEach((value, j) => {
      result[`proof_b_${i}_${j}`] = value;
    });
  });
  
  // Store proof_c values
  proof.c.forEach((value, index) => {
    result[`proof_c_${index}`] = value;
  });
  
  // Store protocol and curve
  result['proof_protocol'] = proof.protocol;
  result['proof_curve'] = proof.curve;
  
  // Store public signals
  publicSignals.forEach((value, index) => {
    result[`public_signal_${index}`] = value;
  });
  
  return result;
}

/**
 * Converts a flat POD structure back to a complex Groth16 proof and public signals
 * @param podData The flat POD data object
 * @returns An object containing the reconstructed proof and publicSignals
 */
export function convertPODToProof(podData: Record<string, string>): { 
  proof: Groth16Proof; 
  publicSignals: string[] 
} {
  const proof: Groth16Proof = {
    a: [],
    b: [[], []],
    c: [],
    protocol: '',
    curve: ''
  };
  
  const publicSignals: string[] = [];
  
  // Sort keys to ensure proper ordering
  const keys = Object.keys(podData).sort();
  
  for (const key of keys) {
    if (key.startsWith('proof_a_')) {
      const index = parseInt(key.split('_')[2]);
      proof.a[index] = podData[key];
    } else if (key.startsWith('proof_b_')) {
      const parts = key.split('_');
      const i = parseInt(parts[2]);
      const j = parseInt(parts[3]);
      
      if (!proof.b[i]) {
        proof.b[i] = [];
      }
      proof.b[i][j] = podData[key];
    } else if (key.startsWith('proof_c_')) {
      const index = parseInt(key.split('_')[2]);
      proof.c[index] = podData[key];
    } else if (key === 'proof_protocol') {
      proof.protocol = podData[key];
    } else if (key === 'proof_curve') {
      proof.curve = podData[key];
    } else if (key.startsWith('public_signal_')) {
      const index = parseInt(key.split('_')[2]);
      publicSignals[index] = podData[key];
    }
  }
  
  return { proof, publicSignals };
}

/**
 * Converts an entire proof verification result directly to a POD-compatible string
 * @param proof The Groth16 proof object
 * @param publicSignals The array of public signals 
 * @returns A JSON string ready for POD storage
 */
export function proofToPODString(proof: Groth16Proof, publicSignals: string[]): string {
  const flattenedData = convertProofForPOD(proof, publicSignals);
  return JSON.stringify(flattenedData);
}
