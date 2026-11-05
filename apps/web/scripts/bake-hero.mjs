import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "src", "assets");
const MASTER = path.join(ASSETS, "hero-skyline.jpg");
const WIDTHS = [480, 768, 1080, 1440, 1920];
const LEGACY = ["hero-skyline-682.avif", "hero-skyline-682.webp"];

const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;

const resize = (width) =>
  sharp(MASTER).resize({
    width,
    withoutEnlargement: true,
  });

await mkdir(ASSETS, { recursive: true });

const writes = WIDTHS.flatMap((width) => {
  const base = path.join(ASSETS, `hero-skyline-${width}`);
  return [
    {
      file: `${base}.avif`,
      run: () => resize(width).avif({ quality: 50 }).toFile(`${base}.avif`),
    },
    {
      file: `${base}.webp`,
      run: () => resize(width).webp({ quality: 78 }).toFile(`${base}.webp`),
    },
    {
      file: `${base}.jpg`,
      run: () =>
        resize(width)
          .jpeg({ mozjpeg: true, progressive: true, quality: 82 })
          .toFile(`${base}.jpg`),
    },
  ];
});

const results = await Promise.all(
  writes.map(async ({ file, run }) => ({ file, info: await run() }))
);

for (const { file, info } of results) {
  console.log(
    `wrote ${path.basename(file)} ${info.width}x${info.height} ${formatBytes(info.size)}`
  );
}

await Promise.all(
  LEGACY.map(async (name) => {
    const file = path.join(ASSETS, name);
    try {
      await unlink(file);
      console.log(`removed legacy ${name}`);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
  })
);
