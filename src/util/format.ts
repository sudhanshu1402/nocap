// True when filePath is dir itself or a proper descendant of it — checks the
// boundary character instead of appending '/' so a root dir ("/") doesn't
// need special-casing to avoid a doubled "//" prefix.
function isUnderDir(filePath: string, dir: string): boolean {
  if (filePath === dir) return true;
  if (!filePath.startsWith(dir)) return false;
  return filePath[dir.length] === '/' || dir.endsWith('/');
}

export function shortenPath(filePath: string, cwd: string = process.cwd()): string {
  if (!filePath) return filePath;
  if (isUnderDir(filePath, cwd)) {
    const rel = filePath.slice(cwd.length).replace(/^\//, '');
    return rel || '.';
  }
  const home = process.env.HOME;
  if (home && isUnderDir(filePath, home)) {
    return `~${filePath.slice(home.length)}`;
  }
  return filePath;
}

export function truncate(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
