/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
const WebSocket = require('ws');
const forge = require('node-forge');

// In a real environment, you would run: `npm install pkcs11js`
// For testing locally without a token, we wrap it in a try/catch.
let pkcs11js;
try {
  pkcs11js = require('pkcs11js');
} catch (e) {
  console.warn("pkcs11js not installed or failed to load native bindings.");
}

// Common libraries used by Indian Certifying Authorities (eMudhra, nCode, Sify, etc.)
const tokenDrivers = [
  // Windows
  'C:\\Windows\\System32\\eps2003csp11.dll', // ePass2003 (nCode / eMudhra)
  'C:\\Windows\\System32\\wdpkcs.dll',      // WatchData ProxKey
  'C:\\Windows\\System32\\mToken.dll',      // mToken
  'C:\\Windows\\System32\\ShuttleCsp11_3003.dll', // TrustKey
  // macOS
  '/usr/local/lib/libeps2003.dylib',
  '/usr/local/lib/libwdpkcs.dylib',
  '/usr/local/lib/libmToken.dylib',
  '/Library/OpenSC/lib/opensc-pkcs11.so'
];

// Helper to find the correct driver
function findTokenDriver() {
  const fs = require('fs');
  for (const driver of tokenDrivers) {
    if (fs.existsSync(driver)) {
      return driver;
    }
  }
  return null;
}

// Simulated signing for development testing if no token is plugged in
function simulateHardwareSigning(hashHex, docBase64) {
  console.log("SIMULATION MODE: Generating fake RSA keys to simulate a USB token...");
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '0123456789';
  cert.validity.notBefore = new Date();
  cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1);
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{
    name: 'commonName',
    value: 'Simulated USB Token'
  }, {
    name: 'countryName',
    value: 'IN'
  }, {
    name: 'organizationName',
    value: 'Simulated CA'
  }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: false,
    critical: true
  }, {
    name: 'keyUsage',
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
    critical: true
  }, {
    name: 'extKeyUsage',
    emailProtection: true
  }, {
    name: 'subjectAltName',
    altNames: [{
      type: 1, // email
      value: 'signer@example.com'
    }]
  }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p7 = forge.pkcs7.createSignedData();
  if (docBase64) {
    p7.content = forge.util.createBuffer(forge.util.decode64(docBase64), 'raw');
  } else {
    p7.content = forge.util.createBuffer(forge.util.hexToBytes(hashHex), 'raw');
  }
  p7.addCertificate(cert);
        p7.addSigner({
    key: keys.privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() }
    ]
  });
  p7.sign({ detached: true });
  return forge.util.bytesToHex(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

const crypto = require('crypto');
const BRIDGE_TOKEN = crypto.randomBytes(16).toString('hex');

const wss = new WebSocket.Server({ port: 8080, host: '127.0.0.1' });
console.log("==========================================================");
console.log("USB Bridge Service is running on ws://127.0.0.1:8080");
console.log(`BRIDGE AUTHORIZATION TOKEN: ${BRIDGE_TOKEN}`);
console.log("Enter this token in the PDFViewer Settings to authorize signatures.");
console.log("==========================================================");
console.log("Waiting for PDFViewer to request a signature...");

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    try {
      const data = JSON.parse(message);
      if (data.action === 'sign' && data.hash) {
        if (data.token !== BRIDGE_TOKEN) {
          console.error("CSWSH Attack Prevented: Invalid Bridge Token received from client!");
          ws.send(JSON.stringify({ error: "Invalid Bridge Token. Connection rejected." }));
          return;
        }

        console.log(`\n--- Signature Request Received ---`);
        console.log(`Document SHA256 Hash: ${data.hash}`);
        
        // Prompt for PIN in the terminal
        const rl = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question('Please enter your USB Token PIN to authorize signature: ', (pin) => {
          rl.close();
          
          if (pin !== '1234') {
            console.error("Incorrect PIN entered.");
            ws.send(JSON.stringify({ error: "Incorrect PIN entered." }));
            return;
          }
          console.log("PIN accepted. Proceeding with signature...");

          let driverPath = findTokenDriver();

          if (!pkcs11js || !driverPath) {
            console.warn("Hardware Token not found or PKCS11 missing. Falling back to Simulation Mode.");
            const hexSig = simulateHardwareSigning(data.hash, data.docBase64);
            ws.send(JSON.stringify({ signature: hexSig }));
            return;
          }

        // --- ACTUAL PKCS#11 HARDWARE SIGNING LOGIC ---
        try {
          const pkcs11 = new pkcs11js.PKCS11();
          pkcs11.load(driverPath);
          pkcs11.C_Initialize();
          
          const slots = pkcs11.C_GetSlotList(true);
          if (slots.length === 0) throw new Error("No USB Token plugged in.");
          const slot = slots[0];
          
          // Note: In a production app, you would prompt the user for the PIN via a native UI dialog here.
          // For security, never send the PIN from the browser!
          const session = pkcs11.C_OpenSession(slot, pkcs11js.CKF_RW_SESSION | pkcs11js.CKF_SERIAL_SESSION);
          
          // Hardcoded prompt simulation (replace with readline or GUI prompt)
          const pin = "12345678"; 
          pkcs11.C_Login(session, 1, pin);
          
          // 1. Find Certificate and Private Key handles...
          // 2. Perform pkcs11.C_SignInit and C_Sign on the hash...
          // 3. Wrap raw signature in PKCS#7 using node-forge...
          // 4. Return to WebSocket...

          throw new Error("Hardware signing logic requires PIN prompt integration. Simulation Mode used instead.");

        } catch (hwError) {
          console.error("Hardware signing error:", hwError);
          ws.send(JSON.stringify({ error: hwError.message }));
        }

        }); // Close rl.question callback

      }
    } catch (e) {
      console.error(e);
      ws.send(JSON.stringify({ error: "Bridge Service Error: " + e.message }));
    }
  });
});
