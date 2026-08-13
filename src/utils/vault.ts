/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
// Memory-only secure credential vault
// This isolates sensitive certificates and passwords from the global window and browser storage,
// preventing XSS scripts from reading them.

let p12Cert: string | null = null;
let p12Password: string | null = null;
let bridgeToken: string | null = null;

export const Vault = {
  setP12Cert: (cert: string | null) => { p12Cert = cert; },
  getP12Cert: () => p12Cert,
  setP12Password: (pwd: string | null) => { p12Password = pwd; },
  getP12Password: () => p12Password,
  setBridgeToken: (token: string | null) => { bridgeToken = token; },
  getBridgeToken: () => bridgeToken
};
