export async function hmac(
  algorithm: "sha256",
  data: string,
  key: string,
  outputFormat: "base64"
): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const keyBuffer = encoder.encode(key);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: algorithm.toUpperCase() },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);

  if (outputFormat === "base64") {
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}