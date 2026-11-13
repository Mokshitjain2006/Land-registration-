export async function computeFileSha256Hex(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export async function computeTextSha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}`;
}

export function shortenAddress(address: string | null | undefined, chars = 4): string {
  if (!address) return "—";
  if (address === "0x0000000000000000000000000000000000000000") return "Genesis Registry";
  if (address.length <= chars * 2 + 4) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function shortenHash(hash: string | null | undefined, chars = 8): string {
  if (!hash) return "—";
  if (hash.length <= chars * 2 + 4) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function isValidBytes32Hash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash.trim());
}
