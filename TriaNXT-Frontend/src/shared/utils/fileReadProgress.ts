/**
 * Read a File in slices, reporting real byte progress.
 *
 * Upload UIs that need a genuine progress-to-100% step before showing Save
 * (the shared document managers' upload UX) use this helper: it reads the
 * actual bytes off disk in 256 KB chunks and reports the true percentage
 * read after every chunk, yielding to the event loop between chunks so the
 * progress bar can paint. The promise resolves only when the whole file has
 * been read - nothing is faked, timed, or progressed on an interval.
 *
 * onProgress receives 0-99 during the read; callers set 100 on resolve.
 * Rejects when the browser cannot read the file.
 */
export function readFileWithProgress(file, onProgress) {
  if (typeof FileReader === "undefined") {
    return Promise.reject(
      new Error("File reading is not supported in this browser.")
    );
  }

  const CHUNK_SIZE = 256 * 1024;
  const total = Number(file?.size) || 0;

  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    let offset = 0;

    const readNextChunk = () => {
      if (offset >= total) {
        resolve();
        return;
      }

      const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, total));

      reader.onload = () => {
        if (reader.error) {
          reject(reader.error);
          return;
        }
        offset = Math.min(total, offset + slice.size);
        const pct =
          total > 0 ? Math.min(99, Math.round((offset / total) * 100)) : 100;

        if (typeof onProgress === "function") onProgress(pct);

        // Yield so the progress bar can paint between chunks.
        setTimeout(readNextChunk, 0);
      };

      reader.onerror = () =>
        reject(reader.error || new Error("File could not be read."));
      reader.readAsArrayBuffer(slice);
    };

    readNextChunk();
  });
}

export default readFileWithProgress;
