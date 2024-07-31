import { vi } from "vitest";

export const mockAxios = {
  post: vi.fn(),
};

vi.mock("axios", () => ({ ...mockAxios, default: mockAxios }));
