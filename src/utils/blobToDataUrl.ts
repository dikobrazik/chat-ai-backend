export async function blobToDataUrl(blob: Blob, mimeType: string) {
  const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64');

  return `data:${mimeType};base64,${base64}`;
}
