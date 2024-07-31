// this import must be at the top
import { mockAxios } from "./setupAxiosMock";
import { cloudName } from "../../config";
import { describe, expect, it } from "vitest";
import { uploadFileToCloudinary } from "./cloudinaryService";

describe("Cloudinary Service", () => {
  describe("uploadFileToCloudinary", () => {
    it("should upload file to Cloudinary and return URL", async () => {
      _setMockAxiosResponse({ data: { url: "https://example.com/image.jpg" } });
      const file = new File(["file-content"], "file-name.jpg", { type: "image/jpeg" });

      const type = "image";

      const result = await uploadFileToCloudinary(file, type);

      const expectedUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`;
      expect(mockAxios.post).toHaveBeenCalledWith(expectedUrl, expect.any(FormData));

      expect(result).toBe("https://example.com/image.jpg");
    });

    it("should handle errors gracefully", async () => {
      mockAxios.post.mockReset();
      mockAxios.post.mockImplementationOnce(async () => {
        throw new Error("Upload failed");
      });

      const file = new File(["file-content"], "file-name.jpg", { type: "image/jpeg" });
      const type = "image";

      const result = await uploadFileToCloudinary(file, type);

      expect(result).toBe("");
    });

    it("should upload video file to Cloudinary and return URL", async () => {
      _setMockAxiosResponse({ data: { url: "https://example.com/video.mp4" } });
      const file = new File(["file-content"], "file-name.mp4", { type: "video/mp4" });
      const type = "video";

      const result = await uploadFileToCloudinary(file, type);

      const expectedUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`;
      expect(mockAxios.post).toHaveBeenCalledWith(expectedUrl, expect.any(FormData));

      expect(result).toBe("https://example.com/video.mp4");
    });

    it("should handle empty file gracefully", async () => {
      const file = new File([], "empty-file.jpg", { type: "image/jpeg" });
      const type = "image";

      const result = await uploadFileToCloudinary(file, type);

      expect(result).toBe("");
    });
  });
});

function _setMockAxiosResponse(response: any) {
  mockAxios.post.mockImplementationOnce(async () => response);
}
