import { describe, it, expect } from "vitest";
import {
  EncodedImage,
  ImageProcessingError,
  MAX_WIDTH,
  MAX_HEIGHT,
  createImageProcessingError,
  loadAndResizeToFit,
} from "./index";

describe("Constants", () => {
  it("should define MAX_WIDTH", () => {
    expect(MAX_WIDTH).toBe(2048);
  });

  it("should define MAX_HEIGHT", () => {
    expect(MAX_HEIGHT).toBe(768);
  });
});

describe("EncodedImage", () => {
  it("should create encoded image", () => {
    const image: EncodedImage = {
      bytes: Buffer.from("test"),
      mime: "image/png",
      width: 100,
      height: 50,
    };
    expect(image.bytes).toBeInstanceOf(Buffer);
    expect(image.mime).toBe("image/png");
    expect(image.width).toBe(100);
    expect(image.height).toBe(50);
  });

  it("should convert to data URL", () => {
    const image: EncodedImage = {
      bytes: Buffer.from("hello"),
      mime: "image/jpeg",
      width: 200,
      height: 100,
    };
    const dataUrl = `data:${image.mime};base64,${image.bytes.toString("base64")}`;
    expect(dataUrl).toContain("data:image/jpeg;base64,");
    expect(dataUrl).toContain(Buffer.from("hello").toString("base64"));
  });
});

describe("ImageProcessingError", () => {
  it("should create Read error", () => {
    const error = createImageProcessingError("Read", {
      path: "/test/image.png",
      message: "File not found",
    });
    expect(error).toBeInstanceOf(ImageProcessingError);
    expect(error.type).toBe("Read");
    expect(error.path).toBe("/test/image.png");
    expect(error.message).toContain("read");
    expect(error.message).toContain("/test/image.png");
  });

  it("should create Decode error", () => {
    const error = createImageProcessingError("Decode", {
      path: "/test/bad.png",
      message: "Invalid PNG",
    });
    expect(error).toBeInstanceOf(ImageProcessingError);
    expect(error.type).toBe("Decode");
    expect(error.path).toBe("/test/bad.png");
    expect(error.message).toContain("decode");
    expect(error.message).toContain("/test/bad.png");
  });

  it("should create Encode error", () => {
    const error = createImageProcessingError("Encode", {
      format: "png",
      message: "Encoding failed",
    });
    expect(error).toBeInstanceOf(ImageProcessingError);
    expect(error.type).toBe("Encode");
    expect(error.format).toBe("png");
    expect(error.message).toContain("encode");
    expect(error.message).toContain("png");
  });
});

describe("Image Utilities (stub)", () => {
  it("should export loadAndResizeToFit as undefined (requires native impl)", () => {
    expect(loadAndResizeToFit).toBeUndefined();
  });
});
