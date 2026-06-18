export async function blobToBase64(blob: Blob) {
  return Buffer.from(await blob.arrayBuffer()).toString('base64');
}
