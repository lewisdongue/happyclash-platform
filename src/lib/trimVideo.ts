/**
 * Cuts [start, start + length] out of a video file in the browser, without
 * re-encoding when possible (fast, no quality loss). Loaded only when needed.
 */
export async function trimVideo(file: File, start: number, length: number, onProgress?: (ratio: number) => void): Promise<File> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } = await import('mediabunny')
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS })
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const conversion = await Conversion.init({
    input,
    output,
    trim: { start, end: start + length },
    copy: { shiftTolerance: Infinity, boundaryPolicy: 'shrink' },
  })
  if (!conversion.isValid) throw new Error('This video format cannot be cut here. Record in the app instead.')
  if (onProgress) conversion.onProgress = onProgress
  await conversion.execute()
  const buffer = output.target.buffer
  if (!buffer) throw new Error('The cut failed. Try again.')
  return new File([buffer], file.name.replace(/\.[^.]+$/, '') + '-clip.mp4', { type: 'video/mp4' })
}
