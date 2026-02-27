// Preloaded via --require to make Expo think it's running in a TTY.
// This enables the interactive UI (QR code, dev client URL, key hints) even
// when stdout/stderr are piped for log capture.
'use strict';

const noop = () => {};
const noopReturn = (stream) => () => stream;

// Fake TTY methods on stdout/stderr/stdin that pipes don't have
for (const stream of [process.stdout, process.stderr]) {
  Object.defineProperty(stream, 'isTTY', { value: true, configurable: true });
  if (!stream.cursorTo) stream.cursorTo = noop;
  if (!stream.moveCursor) stream.moveCursor = noop;
  if (!stream.clearLine) stream.clearLine = noop;
  if (!stream.clearScreenDown) stream.clearScreenDown = noop;
  if (!stream.getWindowSize) stream.getWindowSize = () => [120, 40];
  if (!stream.columns) {
    Object.defineProperty(stream, 'columns', { value: 120, configurable: true });
  }
  if (!stream.rows) {
    Object.defineProperty(stream, 'rows', { value: 40, configurable: true });
  }
}

Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
if (!process.stdin.setRawMode) {
  process.stdin.setRawMode = noopReturn(process.stdin);
}
