/**
 * Shared image element (N-04) — avoids eslint-disable noise for non-Next img tags.
 * Friġġ is Vite, not Next.js; plain <img> is correct for data URLs and remote thumbs.
 */

import type { ImgHTMLAttributes } from "react";

export type SafeImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Required for a11y; use "" only when decorative and aria-hidden is set */
  alt: string;
};

export function SafeImage({ alt, decoding = "async", ...rest }: SafeImageProps) {
  return <img alt={alt} decoding={decoding} {...rest} />;
}
