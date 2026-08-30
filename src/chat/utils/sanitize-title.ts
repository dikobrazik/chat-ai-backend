const QUOTES_REGEX = /^["'«“].+["'»”]$/;

export function sanitizeTitle(title: string): string {
  if (QUOTES_REGEX.test(title)) {
    return title.slice(1, -1);
  }

  return title;
}
