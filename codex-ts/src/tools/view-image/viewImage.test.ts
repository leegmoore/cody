import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { viewImage, type ViewImageParams } from "./viewImage.js";

describe("viewImage", () => {
  let testDir: string;
  let testImagePath: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    testDir = await fs.mkdtemp(join(tmpdir(), "codex-view-image-test-"));

    // Create a test PNG image (1x1 transparent pixel)
    testImagePath = join(testDir, "test.png");
    const pngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    await fs.writeFile(testImagePath, pngData);
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should successfully view an image with absolute path", async () => {
    const result = await viewImage({ path: testImagePath });

    expect(result.success).toBe(true);
    expect(result.content).toContain("attached local image path");
    expect(result.content).toContain(testImagePath);
  });

  it("should successfully view an image with relative path", async () => {
    const relativePath = "test.png";
    const result = await viewImage({
      path: relativePath,
      workdir: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.content).toContain("attached local image path");
  });

  it("should throw error for non-existent image", async () => {
    const nonExistentPath = join(testDir, "nonexistent.png");

    await expect(viewImage({ path: nonExistentPath })).rejects.toThrow(
      "unable to locate image",
    );
  });

  it("should throw error when path is a directory", async () => {
    const dirPath = join(testDir, "subdir");
    await fs.mkdir(dirPath);

    await expect(viewImage({ path: dirPath })).rejects.toThrow("is not a file");
  });

  it("should handle JPG images", async () => {
    const jpgPath = join(testDir, "test.jpg");
    // Minimal valid JPEG header
    const jpegData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
    ]);
    await fs.writeFile(jpgPath, jpegData);

    const result = await viewImage({ path: jpgPath });

    expect(result.success).toBe(true);
    expect(result.content).toContain(jpgPath);
  });

  it("should handle JPEG images", async () => {
    const jpegPath = join(testDir, "test.jpeg");
    const jpegData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
    ]);
    await fs.writeFile(jpegPath, jpegData);

    const result = await viewImage({ path: jpegPath });

    expect(result.success).toBe(true);
  });

  it("should handle GIF images", async () => {
    const gifPath = join(testDir, "test.gif");
    // Minimal GIF header
    const gifData = Buffer.from(
      "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
    );
    await fs.writeFile(gifPath, gifData);

    const result = await viewImage({ path: gifPath });

    expect(result.success).toBe(true);
  });

  it("should handle WebP images", async () => {
    const webpPath = join(testDir, "test.webp");
    await fs.writeFile(webpPath, Buffer.from("RIFF\x00\x00\x00\x00WEBP"));

    const result = await viewImage({ path: webpPath });

    expect(result.success).toBe(true);
  });

  it("should resolve relative path with custom workdir", async () => {
    const subdir = join(testDir, "images");
    await fs.mkdir(subdir);

    const imagePath = join(subdir, "image.png");
    const pngData = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    await fs.writeFile(imagePath, pngData);

    const result = await viewImage({
      path: "image.png",
      workdir: subdir,
    });

    expect(result.success).toBe(true);
  });

  it("should handle absolute workdir that is relative", async () => {
    // Even if workdir is not absolute, it should be resolved
    const result = await viewImage({
      path: testImagePath,
      workdir: ".", // Relative workdir
    });

    expect(result.success).toBe(true);
  });

  it("should include full path in result content", async () => {
    const result = await viewImage({ path: testImagePath });

    expect(result.content).toContain(testImagePath);
    expect(result.content).toContain("attached local image path");
  });

  it("should handle SVG images", async () => {
    const svgPath = join(testDir, "test.svg");
    await fs.writeFile(
      svgPath,
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );

    const result = await viewImage({ path: svgPath });

    expect(result.success).toBe(true);
  });

  it("should handle BMP images", async () => {
    const bmpPath = join(testDir, "test.bmp");
    // Minimal BMP header
    await fs.writeFile(bmpPath, Buffer.from("BM"));

    const result = await viewImage({ path: bmpPath });

    expect(result.success).toBe(true);
  });

  it("should handle images with unknown extensions", async () => {
    const unknownPath = join(testDir, "test.unknown");
    await fs.writeFile(unknownPath, Buffer.from("fake image data"));

    const result = await viewImage({ path: unknownPath });

    expect(result.success).toBe(true);
  });
});
