export function hmac(
  algorithm: "sha256",
  data: string,
  key: string,
  outputFormat: "base64"
): string {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const keyBuffer = encoder.encode(key);

  const cryptoKey = crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: algorithm.toUpperCase() },
    false,
    ["sign"]
  );

  return cryptoKey.then((key) =>
    crypto.subtle.sign("HMAC", key, dataBuffer).then((signature) => {
      if (outputFormat === "base64") {
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
      }
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    })
  ) as Promise<string>;
}