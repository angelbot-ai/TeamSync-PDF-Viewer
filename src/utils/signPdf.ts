/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import * as forge from 'node-forge';

const findSubarray = (arr: Uint8Array, subarr: Uint8Array, start: number = 0): number => {
  for (let i = start; i <= arr.length - subarr.length; i++) {
    let match = true;
    for (let j = 0; j < subarr.length; j++) {
      if (arr[i + j] !== subarr[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
};

export const signPdf = (pdfBytes: Uint8Array, p12Base64: string, password: string): Uint8Array => {
  const encoder = new TextEncoder();
  
  // 1. Find ByteRange and Contents placeholders using native Uint8Array matching to prevent V8 String Allocation OOMs
  const byteRangeToken = encoder.encode('/ByteRange [');
  const byteRangeEndToken = encoder.encode(']');
  const contentsToken = encoder.encode('/Contents <');
  const contentsEndToken = encoder.encode('>');

  const byteRangePos = findSubarray(pdfBytes, byteRangeToken);
  if (byteRangePos === -1) throw new Error("Could not find /ByteRange placeholder in PDF.");
  
  const byteRangeEndPos = findSubarray(pdfBytes, byteRangeEndToken, byteRangePos);
  const placeholderLength = byteRangeEndPos + 1 - byteRangePos;

  const contentsPos = findSubarray(pdfBytes, contentsToken, byteRangeEndPos);
  if (contentsPos === -1) throw new Error("Could not find /Contents placeholder in PDF.");
  
  const contentsEndPos = findSubarray(pdfBytes, contentsEndToken, contentsPos);
  if (contentsEndPos === -1) throw new Error("Could not find end of Contents placeholder.");

  const byteRangeStart = byteRangePos + 11; // After '/ByteRange '
  const contentsStart = contentsPos + 11; // After '/Contents <'
  const contentsEnd = contentsEndPos;

  const placeholderPos = contentsStart;
  const placeholderEnd = contentsEnd;
  
  const range1Length = placeholderPos;
  const range2Start = placeholderEnd + 1;
  const range2Length = pdfBytes.length - range2Start;

  // 2. Format new ByteRange
  const byteRangeString = `[0 ${range1Length} ${range2Start} ${range2Length}]`;
  const paddedByteRange = byteRangeString.padEnd(placeholderLength - 11, ' ');
  const paddedByteRangeBytes = encoder.encode(paddedByteRange);

  // 3. Create modified PDF bytes natively in memory
  const modifiedPdfBytes = new Uint8Array(pdfBytes.length);
  modifiedPdfBytes.set(pdfBytes);
  modifiedPdfBytes.set(paddedByteRangeBytes, byteRangeStart);

  // 4. Extract Certificate and Private Key from .p12
  const p12Der = forge.util.decode64(p12Base64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
  
  let privateKey: forge.pki.PrivateKey | null = null;
  let certificate: forge.pki.Certificate | null = null;
  
  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKey = safeBag.key as forge.pki.PrivateKey;
      } else if (safeBag.type === forge.pki.oids.certBag) {
        certificate = safeBag.cert as forge.pki.Certificate;
      }
    }
  }

  if (!privateKey || !certificate) {
    throw new Error("Could not extract private key or certificate from the .p12 file. Ensure the password is correct.");
  }

  // 5. Create PKCS#7 detached signature (pass Uint8Array to forge to avoid strings)
  const docToSign = new Uint8Array(range1Length + range2Length);
  docToSign.set(modifiedPdfBytes.subarray(0, range1Length), 0);
  docToSign.set(modifiedPdfBytes.subarray(range2Start), range1Length);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(docToSign as any);
  p7.addCertificate(certificate);
  p7.addSigner({
    key: privateKey as any,
    certificate: certificate as any,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data,
      },
      {
        type: forge.pki.oids.messageDigest,
      },
      {
        type: forge.pki.oids.signingTime,
        value: new Date() as any,
      }
    ]
  });
  p7.sign({ detached: true });
  const p7Der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  
  // 6. Convert PKCS7 to Hex
  let p7Hex = forge.util.bytesToHex(p7Der);
  
  // 7. Pad the hex string to fit exactly inside the /Contents <...> placeholder
  const contentsSize = contentsEnd - contentsStart;
  if (p7Hex.length > contentsSize) {
    throw new Error(`Signature size (${p7Hex.length}) exceeds the allocated placeholder size (${contentsSize}).`);
  }
  const paddedP7Hex = p7Hex.padEnd(contentsSize, '0');
  const paddedP7HexBytes = encoder.encode(paddedP7Hex);

  // 8. Inject the signature hex into the modified PDF bytes
  modifiedPdfBytes.set(paddedP7HexBytes, contentsStart);

  return modifiedPdfBytes;
};

export const signPdfWithUSB = async (pdfBytes: Uint8Array, bridgeToken: string): Promise<Uint8Array> => {
  const encoder = new TextEncoder();
  
  const byteRangeToken = encoder.encode('/ByteRange [');
  const byteRangeEndToken = encoder.encode(']');
  const contentsToken = encoder.encode('/Contents <');
  const contentsEndToken = encoder.encode('>');

  const byteRangePos = findSubarray(pdfBytes, byteRangeToken);
  if (byteRangePos === -1) throw new Error("Could not find /ByteRange placeholder in PDF.");
  
  const byteRangeEndPos = findSubarray(pdfBytes, byteRangeEndToken, byteRangePos);
  const placeholderLength = byteRangeEndPos + 1 - byteRangePos;

  const contentsPos = findSubarray(pdfBytes, contentsToken, byteRangeEndPos);
  if (contentsPos === -1) throw new Error("Could not find /Contents placeholder in PDF.");
  
  const contentsEndPos = findSubarray(pdfBytes, contentsEndToken, contentsPos);
  if (contentsEndPos === -1) throw new Error("Could not find end of Contents placeholder.");

  const byteRangeStart = byteRangePos + 11;
  const contentsStart = contentsPos + 11;
  const contentsEnd = contentsEndPos;
  
  const range1Length = contentsStart;
  const range2Start = contentsEnd + 1;
  const range2Length = pdfBytes.length - range2Start;

  const byteRangeString = `[0 ${range1Length} ${range2Start} ${range2Length}]`;
  const paddedByteRange = byteRangeString.padEnd(placeholderLength - 11, ' ');
  const paddedByteRangeBytes = encoder.encode(paddedByteRange);

  const modifiedPdfBytes = new Uint8Array(pdfBytes.length);
  modifiedPdfBytes.set(pdfBytes);
  modifiedPdfBytes.set(paddedByteRangeBytes, byteRangeStart);

  const docToSign = new Uint8Array(range1Length + range2Length);
  docToSign.set(modifiedPdfBytes.subarray(0, range1Length), 0);
  docToSign.set(modifiedPdfBytes.subarray(range2Start), range1Length);

  // Hash the document
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', docToSign);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8080');
    
    // Safety timeout: reject if bridge doesn't respond within 120 seconds
    // (e.g. bridge crashed, user abandoned PIN prompt, token unplugged)
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("USB Bridge timed out after 120 seconds. Please ensure the bridge is running and try again."));
    }, 120_000);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'sign',
        hash: hashHex,
        hashAlgorithm: 'SHA-256',
        token: bridgeToken
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.success && response.signature) {
          clearTimeout(timeout);
          ws.close();
          const p7Hex = response.signature;
          
          const contentsSize = contentsEnd - contentsStart;
          if (p7Hex.length > contentsSize) {
            reject(new Error(`Signature size exceeds the allocated placeholder.`));
            return;
          }
          const paddedP7Hex = p7Hex.padEnd(contentsSize, '0');
          const paddedP7HexBytes = encoder.encode(paddedP7Hex);

          modifiedPdfBytes.set(paddedP7HexBytes, contentsStart);
          resolve(modifiedPdfBytes);
        } else {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(response.error || "Failed to sign via USB token."));
        }
      } catch {
        clearTimeout(timeout);
        ws.close();
        reject(new Error("Invalid response from USB token bridge."));
      }
    };
    
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Could not connect to USB Bridge Service."));
    };
  });
};
