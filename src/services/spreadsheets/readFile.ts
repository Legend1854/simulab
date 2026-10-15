/** Reads a browser File into bytes. Uses Blob.arrayBuffer() where available, otherwise FileReader. */
export function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error('Unexpected file reader result.')));
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}
