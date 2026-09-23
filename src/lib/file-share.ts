/**
 * Downloading a file to the device, then handing it to the share sheet.
 *
 * Ported from ninja-crm-mobile's `lib/file-download.ts` — same approach, same
 * reasoning.
 *
 * **Why this isn't just `Linking.openURL`.** Opening hands the URL to a
 * browser or viewer, which shows the file but leaves the user no reliable way
 * to keep it. This pulls the bytes down to the app's cache and then opens the
 * system share sheet, which is where *"Save to Files"*, *"Save to Drive"* and
 * every other destination live. That sheet **is** what "download" means on a
 * phone — there's no visible filesystem for a file to land in otherwise.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Where downloads are staged. Cache, not documents: the OS may reclaim it,
 *  which is right for a file the user has already been offered a home for. */
const DOWNLOAD_DIR = "ninja-prm-files";

/**
 * A filename the filesystem will accept.
 *
 * Recording titles come from meeting names and phone numbers, and routinely
 * contain slashes, colons and quotes — all of which either break the path or
 * silently create nested directories.
 */
export function safeFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned.replace(/^\.+/, "") || "download";
}

function ensureDir(): Directory {
  const directory = new Directory(Paths.cache, DOWNLOAD_DIR);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

async function share(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle });
}

/**
 * Download `url` and open the share sheet for it.
 * Throws with a readable message; the caller decides how to show it.
 */
export async function downloadAndShare(
  url: string,
  fileName: string,
  mimeType: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }

  const target = new File(ensureDir(), safeFileName(fileName));
  // Re-downloading the same file is normal (share it twice). Without this the
  // download throws rather than replacing what's already there.
  if (target.exists) target.delete();

  const downloaded = await File.downloadFileAsync(url, target);
  await share(downloaded.uri, mimeType, fileName);
}

/**
 * Write text to a .txt file and share it.
 *
 * Deliberately a FILE rather than `Share.share({ message })`: transcripts run
 * to tens of thousands of characters, and most targets (SMS, some mail
 * clients) silently truncate a long message body. A file arrives intact and
 * can be saved.
 */
export async function shareTextAsFile(
  text: string,
  fileName: string,
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }

  const target = new File(ensureDir(), safeFileName(fileName));
  if (target.exists) target.delete();

  target.create();
  target.write(text);

  await share(target.uri, "text/plain", fileName);
}
