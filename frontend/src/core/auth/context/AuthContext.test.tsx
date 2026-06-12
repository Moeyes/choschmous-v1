import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { UserRole, type User } from "@/core/auth/types";

const { loginUser, logoutUser, refreshAccessToken, getCurrentUser } = vi.hoisted(() => ({
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  refreshAccessToken: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/core/auth/services", () => ({
  loginUser,
  logoutUser,
  refreshAccessToken,
  getCurrentUser,
}));

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="role">{auth.role ?? "none"}</span>
      <span data-testid="error">{auth.error ?? "none"}</span>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>,
  );
}

const MOCK_USER: User = {
  id: "1",
  username: "admin",
  email: "admin@test.com",
  role: UserRole.ADMIN,
  is_active: true,
  is_superuser: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("starts in loading state", () => {
    renderProvider();
    expect(screen.getByTestId("loading").textContent).toBe("true");
  });

  it("restores session on mount when getCurrentUser succeeds", async () => {
    getCurrentUser.mockResolvedValue(MOCK_USER);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("role").textContent).toBe(UserRole.ADMIN);
  });

  it("resolves to logged-out state on mount failure", async () => {
    getCurrentUser.mockRejectedValue(new Error("No session"));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("role").textContent).toBe("none");
  });

  it("normalizes unknown roles to GUEST", async () => {
    getCurrentUser.mockResolvedValue({
      ...MOCK_USER,
      role: "unknown" as UserRole,
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("role").textContent).toBe("GUEST");
    });
  });

  it("throws when useAuth is used outside provider", () => {
    const Test = () => {
      useAuth();
      return null;
    };
    expect(() => render(<Test />)).toThrow("useAuth must be used within <AuthProvider>");
  });
});
