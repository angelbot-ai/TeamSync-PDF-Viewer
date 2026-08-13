/**
 * © 2026 AngelBot Ai Pvt Ltd. All rights reserved.
 */
import fs from 'fs';
import { signPdfWithUSB } from './src/utils/signPdf.js';
import * as forge from 'node-forge';

// Mock websocket behavior for the bridge
// We'll just run the bridge's signing logic directly here
function simulateBridge(hashHex, docBase64) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [{ name: 'commonName', value: 'Simulated USB Token' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, nonRepudiation: true }
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(forge.util.decode64(docBase64));
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
  return forge.util.bytesToHex(forge.asn1.toDer(p7.toAsn1()).getBytes()).toUpperCase();
}

// Override WebSocket in signPdfWithUSB to just call simulateBridge synchronously
global.WebSocket = class {
  constructor() {
    setTimeout(() => this.onopen(), 10);
  }
  send(data) {
    const parsed = JSON.parse(data);
    const sig = simulateBridge(parsed.hash, parsed.docBase64);
    setTimeout(() => this.onmessage({ data: JSON.stringify({ signature: sig }) }), 10);
  }
  close() {}
};

async function run() {
  // To avoid having to compile the PDF with the signature field, we'll just read clean.pdf,
  // but wait, clean.pdf doesn't have the ByteRange placeholders yet.
  // We need to use pdf-lib to add the placeholders just like getFileData does.
  
  const { PDFDocument, PDFName, PDFString, PDFHexString } = await import('pdf-lib');
  const pdfBytes = fs.readFileSync('public/clean.pdf');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  const page = pdfDoc.getPages()[0];
  const sigDict = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 1000000000, 1000000000, 1000000000],
    Contents: PDFHexString.of('0'.repeat(8192)),
    Reason: PDFString.of('Digitally Signed with USB Token'),
    M: PDFString.fromDate(new Date()),
  });
  const sigRef = pdfDoc.context.register(sigDict);
  
  const sigFieldDict = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    T: PDFString.of('Signature1'),
    V: sigRef,
    Rect: [0, 0, 100, 100],
    F: 4,
  });
  const sigFieldRef = pdfDoc.context.register(sigFieldDict);
  page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([sigFieldRef]));
  
  let acroForm = pdfDoc.context.obj({ Fields: [sigFieldRef] });
  pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
  
  const placeholderPdfBytes = await pdfDoc.save({ useObjectStreams: false });
  
  const signedPdfBytes = await signPdfWithUSB(placeholderPdfBytes);
  fs.writeFileSync('signed_test.pdf', Buffer.from(signedPdfBytes));
  console.log("Wrote signed_test.pdf");
}

run().catch(console.error);
