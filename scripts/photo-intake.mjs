#!/usr/bin/env node
/**
 * Photograph intake.
 *
 * Photographs handed over by GMZ have carried GPS coordinates identifying
 * client home addresses. Astro strips metadata from the derivatives it serves,
 * so the published file is safe. The committed *source* is not: it keeps its
 * own metadata, and git history is permanent, so deleting the file later does
 * not remove what it carried.
 *
 * Until now that rule was enforced by review, which is to say by remembering.
 * This enforces it.
 *
 *   node scripts/photo-intake.mjs audit <file...>
 *       Report what metadata a candidate file carries. Exits 1 if it carries
 *       location. Run this on anything before it goes near `git add`.
 *
 *   node scripts/photo-intake.mjs clean <src> <dest> [--width 1600] [--quality 82]
 *       Write a stripped, correctly-oriented, resized derivative, then audit
 *       the result and refuse to leave a dirty file behind.
 *
 *   node scripts/photo-intake.mjs scan [dir...]
 *       Walk everything already committed (src/assets and public by default)
 *       and fail if any of it carries location. Wired into `npm run build`.
 *
 * A deliberate omission: this reports that coordinates are PRESENT and how
 * precise they are, never what they are. The whole point is a client's home
 * address, and a build log is not the place to reprint it.
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.tif',
  '.tiff',
  '.heic',
  '.heif',
]);

const DEFAULT_SCAN_DIRS = ['src/assets', 'public'];

/* ---- A very small TIFF/EXIF reader ------------------------------------- */

/*
 * sharp hands back the raw TIFF block and nothing more, so the tags have to be
 * walked by hand. Only what this script actually reports is decoded; anything
 * unrecognised is counted, not interpreted.
 */

const TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;

/** IFD0 tags worth naming in a report. */
const DESCRIPTIVE_TAGS = new Map([
  [0x010e, 'ImageDescription'],
  [0x010f, 'Make'],
  [0x0110, 'Model'],
  [0x0131, 'Software'],
  [0x0132, 'DateTime'],
  [0x013b, 'Artist'],
  [0x8298, 'Copyright'],
]);

/** ExifIFD tags worth naming. */
const EXIF_TAGS = new Map([
  [0x9003, 'DateTimeOriginal'],
  [0x9004, 'DateTimeDigitized'],
  [0x927c, 'MakerNote'],
  [0x9286, 'UserComment'],
  [0xa430, 'CameraOwnerName'],
  [0xa433, 'LensMake'],
  [0xa434, 'LensModel'],
]);

/** GPS IFD tags. Presence of any of these is the thing that fails a build. */
const GPS_TAGS = new Map([
  [0x0001, 'GPSLatitudeRef'],
  [0x0002, 'GPSLatitude'],
  [0x0003, 'GPSLongitudeRef'],
  [0x0004, 'GPSLongitude'],
  [0x0005, 'GPSAltitudeRef'],
  [0x0006, 'GPSAltitude'],
  [0x0007, 'GPSTimeStamp'],
  [0x0012, 'GPSMapDatum'],
  [0x001b, 'GPSProcessingMethod'],
  [0x001c, 'GPSAreaInformation'],
  [0x001d, 'GPSDateStamp'],
]);

/** Tags that pin a photograph to a place. Anything here is disqualifying. */
const LOCATING_TAGS = new Set([0x0002, 0x0004, 0x0006, 0x001c]);

function u16(buf, at, le) {
  return le ? buf.readUInt16LE(at) : buf.readUInt16BE(at);
}

function u32(buf, at, le) {
  return le ? buf.readUInt32LE(at) : buf.readUInt32BE(at);
}

function decodeEntry(buf, at, le) {
  const tag = u16(buf, at, le);
  const type = u16(buf, at + 2, le);
  const count = u32(buf, at + 4, le);
  const width = TYPE_SIZE[type] ?? 0;
  const bytes = width * count;

  const entry = { tag, type, count, bytes, value: null };
  if (width === 0 || bytes === 0) return entry;

  const from = bytes > 4 ? u32(buf, at + 8, le) : at + 8;
  if (from < 0 || from + bytes > buf.length) return entry;

  switch (type) {
    case 2: // ASCII
      entry.value = buf
        .subarray(from, from + bytes)
        .toString('latin1')
        .replace(/\0[\s\S]*$/, '')
        .trim();
      break;
    case 1: // BYTE
    case 6: // SBYTE
      entry.value = Array.from(buf.subarray(from, from + bytes));
      break;
    case 3: // SHORT
      entry.value = Array.from({ length: count }, (_, i) => u16(buf, from + i * 2, le));
      break;
    case 4: // LONG
      entry.value = Array.from({ length: count }, (_, i) => u32(buf, from + i * 4, le));
      break;
    case 5: // RATIONAL
      entry.value = Array.from({ length: count }, (_, i) => [
        u32(buf, from + i * 8, le),
        u32(buf, from + i * 8 + 4, le),
      ]);
      break;
    default:
      break; // UNDEFINED and the signed types: size is all this needs.
  }
  return entry;
}

function readIfd(buf, offset, le) {
  if (offset <= 0 || offset + 2 > buf.length) return [];
  const count = u16(buf, offset, le);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    const at = offset + 2 + i * 12;
    if (at + 12 > buf.length) break;
    entries.push(decodeEntry(buf, at, le));
  }
  return entries;
}

/**
 * Read the TIFF block sharp hands back.
 *
 * Returns null when the block is absent or unparseable, which is not the same
 * as clean: an unreadable block is reported as unknown rather than as safe.
 */
function readExif(raw) {
  if (!raw || raw.length < 8) return null;

  /*
   * libvips hands the block back with the JPEG APP1 marker's own `Exif\0\0`
   * header still attached, so the TIFF header does not start at byte zero.
   * Missing this is silent: every offset in the file is relative to the TIFF
   * header, so the parse does not fail loudly, it just finds nothing, and a
   * photograph full of coordinates reports as clean. A fixture caught it.
   */
  const exif = raw.toString('latin1', 0, 4) === 'Exif' ? raw.subarray(6) : raw;
  if (exif.length < 8) return null;

  const order = exif.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const le = order === 'II';
  if (u16(exif, 2, le) !== 0x2a) return null;

  const ifd0 = readIfd(exif, u32(exif, 4, le), le);
  if (ifd0.length === 0) return null;

  const pointer = (tag) => ifd0.find((entry) => entry.tag === tag)?.value?.[0] ?? 0;
  const exifIfd = readIfd(exif, pointer(TAG_EXIF_IFD), le);
  const gpsIfd = readIfd(exif, pointer(TAG_GPS_IFD), le);

  const named = [];
  for (const entry of ifd0) {
    const name = DESCRIPTIVE_TAGS.get(entry.tag);
    if (name && entry.value) named.push(`${name}: ${describe(entry)}`);
  }
  for (const entry of exifIfd) {
    const name = EXIF_TAGS.get(entry.tag);
    if (name) named.push(`${name}: ${describe(entry)}`);
  }

  return {
    tagCount: ifd0.length + exifIfd.length + gpsIfd.length,
    named,
    gps: readGps(gpsIfd),
  };
}

function describe(entry) {
  if (typeof entry.value === 'string') return entry.value.slice(0, 60) || '(empty)';
  if (entry.value === null) return `${entry.bytes} bytes`;
  return String(entry.value.slice(0, 4));
}

/**
 * Report the shape of the location, never the location.
 *
 * Decimal places are the useful number: six of them is a doorstep, two is a
 * neighbourhood. Whoever is looking at this needs to know how bad it is, not
 * where the house is.
 */
function readGps(gpsIfd) {
  if (gpsIfd.length === 0) return null;

  const present = [];
  let locating = false;
  let places = 0;

  for (const entry of gpsIfd) {
    const name = GPS_TAGS.get(entry.tag);
    if (name) present.push(name);
    if (LOCATING_TAGS.has(entry.tag)) locating = true;
    if ((entry.tag === 0x0002 || entry.tag === 0x0004) && Array.isArray(entry.value)) {
      places = Math.max(places, precisionOf(entry.value));
    }
  }

  if (present.length === 0) return null;
  return { present, locating, places };
}

/**
 * Degrees/minutes/seconds to a count of decimal places, without ever forming
 * the coordinate. The seconds denominator carries the precision: seconds to
 * 1/100 is about 0.3 metres, which is a specific corner of a specific garden.
 */
function precisionOf(rationals) {
  const seconds = rationals[2];
  if (!Array.isArray(seconds) || !seconds[1]) return 4;
  const subSecond = Math.log10(seconds[1]);
  return Math.round(4 + Math.max(0, subSecond));
}

/* ---- Auditing ---------------------------------------------------------- */

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function inspect(file) {
  const info = await stat(file);
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (error) {
    return { file, unreadable: error.message, bytes: info.size };
  }

  const exif = readExif(meta.exif);
  return {
    file,
    bytes: info.size,
    width: meta.width,
    height: meta.height,
    format: meta.format,
    orientation: meta.orientation,
    exif,
    exifUnparsed: Boolean(meta.exif) && exif === null,
    xmp: meta.xmp?.length ?? 0,
    iptc: meta.iptc?.length ?? 0,
    icc: meta.icc?.length ?? 0,
    comments: meta.comments ?? [],
  };
}

/** True when the file carries a location and must not be committed as it is. */
function locates(report) {
  return Boolean(report.exif?.gps?.locating);
}

/** True when the file carries any metadata at all, location or not. */
function carriesMetadata(report) {
  return Boolean(
    report.exif ||
    report.exifUnparsed ||
    report.xmp ||
    report.iptc ||
    report.comments.length ||
    (report.orientation ?? 1) !== 1,
  );
}

function print(report) {
  if (report.unreadable) {
    console.log(`\n${report.file}`);
    console.log(`  unreadable   ${report.unreadable}`);
    console.log('  VERDICT      cannot be checked. Convert to JPEG or PNG first.');
    return;
  }

  console.log(`\n${report.file}`);
  console.log(
    `  ${report.width} x ${report.height}  ${report.format}  ${kb(report.bytes)}` +
      ((report.orientation ?? 1) !== 1 ? `  orientation ${report.orientation}` : ''),
  );

  const gps = report.exif?.gps;
  if (gps) {
    const shape = gps.locating
      ? `coordinates to about ${gps.places} decimal places`
      : 'no coordinates, but GPS tags present';
    console.log(`  GPS          PRESENT   ${shape}`);
    console.log(`               tags: ${gps.present.join(', ')}`);
  }

  if (report.exif) {
    console.log(`  EXIF         ${report.exif.tagCount} tags`);
    for (const line of report.exif.named) console.log(`               ${line}`);
  } else if (report.exifUnparsed) {
    console.log('  EXIF         present, could not be parsed. Treat as unknown.');
  }

  if (report.xmp) console.log(`  XMP          ${kb(report.xmp)}`);
  if (report.iptc) console.log(`  IPTC         ${kb(report.iptc)}`);
  if (report.icc) console.log(`  ICC          ${kb(report.icc)} (colour profile, harmless)`);
  for (const comment of report.comments) {
    console.log(`  comment      ${String(comment.text ?? comment).slice(0, 60)}`);
  }

  if (locates(report)) {
    console.log('  VERDICT      DO NOT COMMIT. Run `clean` and commit the output.');
  } else if (carriesMetadata(report)) {
    console.log('  VERDICT      no location. Other metadata present; `clean` removes it.');
  } else {
    console.log('  VERDICT      clean.');
  }
}

/* ---- Commands ---------------------------------------------------------- */

async function audit(files) {
  if (files.length === 0) {
    console.error('audit needs at least one file.');
    return 2;
  }
  const reports = await Promise.all(files.map(inspect));
  reports.forEach(print);

  const located = reports.filter(locates);
  console.log('');
  if (located.length > 0) {
    console.error(
      `${located.length} of ${reports.length} carry a location. ` +
        'Commit the cleaned derivative, never the original.',
    );
    return 1;
  }
  console.log(`${reports.length} file(s) audited, none carrying a location.`);
  return 0;
}

async function clean(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const [source, destination] = positional;
  if (!source || !destination) {
    console.error('clean needs a source and a destination.');
    return 2;
  }

  const flag = (name, fallback) => {
    const found = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (found) return Number(found.split('=')[1]);
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? fallback : Number(argv[index + 1]);
  };

  const width = flag('width', 1600);
  const quality = flag('quality', 82);

  const before = await inspect(source);
  print(before);

  const pipeline = sharp(source)
    // Applies the EXIF orientation to the pixels, so dropping the tag does not
    // turn the photograph on its side.
    .rotate()
    .resize({ width, withoutEnlargement: true });

  const extension = path.extname(destination).toLowerCase();
  if (extension === '.webp') pipeline.webp({ quality });
  else if (extension === '.png') pipeline.png();
  else if (extension === '.avif') pipeline.avif({ quality });
  else pipeline.jpeg({ quality, mozjpeg: true });

  // sharp drops metadata unless asked to keep it. This never asks.
  await pipeline.toFile(destination);

  const after = await inspect(destination);
  print(after);

  if (locates(after) || carriesMetadata(after)) {
    console.error(`\n${destination} still carries metadata. Do not commit it.`);
    return 1;
  }
  console.log(`\nWrote ${destination}. Commit this one, not the original.`);
  return 0;
}

async function walk(directory, found = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, found);
    else if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }
  return found;
}

async function scan(dirs) {
  const roots = dirs.length > 0 ? dirs : DEFAULT_SCAN_DIRS;
  const files = (await Promise.all(roots.map((dir) => walk(dir)))).flat();

  if (files.length === 0) {
    console.log(`No images under ${roots.join(', ')}.`);
    return 0;
  }

  const reports = await Promise.all(files.map(inspect));
  const located = reports.filter(locates);
  const unreadable = reports.filter((report) => report.unreadable);

  if (located.length > 0) {
    located.forEach(print);
    console.error(
      `\n${located.length} committed image(s) carry a location. ` +
        'Replace each with a cleaned derivative. Note that git history keeps ' +
        'the original, so a deletion alone does not undo this.',
    );
    return 1;
  }

  for (const report of unreadable) {
    console.warn(`Could not read ${report.file}: ${report.unreadable}`);
  }
  // An EXIF block this script cannot parse is unknown, not safe. Say so.
  for (const report of reports.filter((entry) => entry.exifUnparsed)) {
    console.warn(`Unreadable EXIF in ${report.file}. Check it by hand.`);
  }
  console.log(`${files.length} committed image(s) checked, none carrying a location.`);
  return 0;
}

/* ---- Entry ------------------------------------------------------------- */

const [command, ...rest] = process.argv.slice(2);

const commands = {
  audit: () => audit(rest),
  clean: () => clean(rest),
  scan: () => scan(rest),
};

if (!commands[command]) {
  console.error('Usage: photo-intake.mjs <audit|clean|scan> [...]');
  process.exit(2);
}

process.exit(await commands[command]());
