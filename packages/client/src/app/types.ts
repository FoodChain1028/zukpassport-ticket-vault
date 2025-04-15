// Define types for verification data structures

export type Groth16Proof = {
  a: string[];
  b: string[][];
  c: string[];
  protocol: string;
  curve: string;
};

export type VerificationData = {
  status: string;
  data: {
    proof: Groth16Proof;
    public_signals: string[];
    disclosure_data?: Record<string, unknown>;
  };
};
