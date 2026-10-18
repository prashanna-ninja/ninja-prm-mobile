/** Copied verbatim from ref/ninja-crm-mobile/src/lib/sms-segments.ts. */
/**
 * SMS segment counting (3GPP TS 23.038).
 *
 * Every segment is billed separately, so this needs to be right rather than
 * "length / 160". Two rules make the naive version wrong:
 *
 * 1. **Encoding.** If every character is in the GSM-7 alphabet a segment holds
 *    160 characters. A single character outside it — an emoji, a curly “smart”
 *    quote, an em dash — forces the whole message to **UCS-2**, where a segment
 *    holds just **70**. One emoji can therefore more than double the bill.
 * 2. **Multipart overhead.** Split messages spend 7 bits per part on a
 *    concatenation header, so capacity drops to **153** (GSM-7) / **67**
 *    (UCS-2) once there's more than one segment.
 *
 * A few GSM-7 characters (`^ { } \ [ ~ ] | €`) live in an extension table and
 * cost **two** septets each.
 */

/** The GSM-7 default alphabet, minus the ESC slot (handled by the table below). */
const GSM7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ" +
    " !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§" +
    "¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

/** Reachable only via an ESC prefix, so each costs two septets. */
const GSM7_EXTENDED = new Set("\f^{}\\[~]|€");

const GSM7_SINGLE = 160;
const GSM7_MULTIPART = 153;
const UCS2_SINGLE = 70;
const UCS2_MULTIPART = 67;

export type SmsEncoding = "GSM-7" | "UCS-2";

export type SmsSegmentInfo = {
  encoding: SmsEncoding;
  /** Billable parts — 0 for an empty message. */
  segments: number;
  /** Septets (GSM-7) or UTF-16 code units (UCS-2). */
  units: number;
  /** Capacity of the segmentation actually in play (single vs multipart). */
  perSegment: number;
};

export function countSmsSegments(text: string): SmsSegmentInfo {
  if (!text) {
    return {
      encoding: "GSM-7",
      segments: 0,
      units: 0,
      perSegment: GSM7_SINGLE,
    };
  }

  let septets = 0;
  let isGsm7 = true;

  // Iterating the string yields code POINTS, so an astral emoji is one step
  // here (and correctly knocks us out of GSM-7 immediately).
  for (const ch of text) {
    if (GSM7_BASIC.has(ch)) {
      septets += 1;
    } else if (GSM7_EXTENDED.has(ch)) {
      septets += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (!isGsm7) {
    // UCS-2 is billed in 16-bit units, so a surrogate pair (most emoji) is 2.
    // `String.length` is exactly that count.
    const units = text.length;
    const single = units <= UCS2_SINGLE;
    return {
      encoding: "UCS-2",
      units,
      segments: single ? 1 : Math.ceil(units / UCS2_MULTIPART),
      perSegment: single ? UCS2_SINGLE : UCS2_MULTIPART,
    };
  }

  const single = septets <= GSM7_SINGLE;
  return {
    encoding: "GSM-7",
    units: septets,
    segments: single ? 1 : Math.ceil(septets / GSM7_MULTIPART),
    perSegment: single ? GSM7_SINGLE : GSM7_MULTIPART,
  };
}
