// Shared XOR-based reversible encryption for supplier credentials.
// Keys are server-side only — never sent to the client.
// Upgrade to AES-256-GCM via Node crypto when scaling to production.

function getSecret() {
  return process.env.CREDENTIAL_SECRET ?? "dentago-secret-key-change-in-prod";
}

export function encrypt(text: string): string {
  const secret = getSecret();
  const encoded = Buffer.from(text, "utf8");
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secret.charCodeAt(i % secret.length);
  }
  return result.toString("base64");
}

export function decrypt(enc: string): string {
  const secret = getSecret();
  const encoded = Buffer.from(enc, "base64");
  const result = Buffer.alloc(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    result[i] = encoded[i] ^ secret.charCodeAt(i % secret.length);
  }
  return result.toString("utf8");
}
