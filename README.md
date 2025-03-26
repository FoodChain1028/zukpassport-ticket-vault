# Proof Carrying Data (PCD) zkpassport

## Overview

This project focuses on integrating zkpassport and zupass to store and manage Proof Carrying Data (PCD) of users. Zupass is a user-centric app based on PCD SDK framework and provides a wallet-like interface for managing **proofs** and **user-self-controlled data**.

![](/docs/img/v1_sys_design.png)
*First version of system design*

## System Architecture

The system consists of several key components that work together to provide secure, privacy-preserving identity verification and ticket management:

### 1. zkpassport-native-app

- **Functionality**: Scans physical passports and generates zero-knowledge proofs
- **Features**:
  - Passport scanning interface
  - Proof generation using zero-knowledge cryptography

> This is built by zkpassport team, we are using `zkpassport-sdk` to jump into `zkpassport-native-app`.

### 2. client

- **Functionality**: A service handling requests between components
- **Key Services**:
  - Route/diff service - Determines what data needs to be verified
    - Age verification: Proves a user is above a certain age without revealing the exact age
    - Nationality verification: Confirms nationality without exposing full passport details
    - personhood verification: Confirms the user is a unique human
  - `zkpassport-sdk` integration - Processing passport data securely
  - Integrate zupass and deal with PCDs

### 3. zupass

- **Functionality**: User-facing wallet for managing identity proofs
- **Key Services**:
  - Access controls for applications requiring verification
  - Maintains privacy while enabling verification

### 4. hyle (ticket marketplace; blockchain)

- **Functionality**: Decentralized ticket verifier
- **Key Features**:
  - **Buy Ticket**:
    1. Verifies nationality proof
    2. Maps to user (creates unique ID)
    3. Sets ticket_is_used = false
  - **Spend Ticket**:
    1. Verifies passport identity
    2. Checks user owns ticket
    3. Updates ticket_is_used from false to true
  - **Resell/Transfer**:
    1. Verifies passport identity
    2. Checks user owns ticket
    3. User repays the discount (if the nationality doesn't match)
    4. Transfers ticket to new owner

## Todos and Status

- [ ] Writing frontend and api endpoints to handle different `zkpassport-sdk`
- [ ] Implement PCD storage integration with encryption and access controls
- [ ] Develop hyle ticket marketplace features (buy, spend, transfer)
- [ ] Create user flows for passport scanning and verification
- [ ] Add monitoring and security auditing for proof verification

## Development

```bash
yarn install
yarn dev:client
```

## Reference

### zupass

#### projects

- [zukyc](https://github.com/proofcarryingdata/zukyc)
- [Building Verifiable Computation](https://hackmd.io/@swezkl/Hy4AKFrIa)

#### videos

- [What is PODs?](https://app.devcon.org/schedule/YP9HRR)
- [A Deep Dive into ZK Proofs of PODs](https://app.devcon.org/schedule/EQ9BYQ)
- [Building Consumer Apps with Programmable Cryptography](https://app.devcon.org/schedule/ZXS33Q)
- [Behind Zupass: Applied Cryptography For Consumers](https://app.devcon.org/schedule/GEEXRU)
- [Zupass, identity and credentials beyond proof of personhood](https://app.devcon.org/schedule/K9SNB7)
