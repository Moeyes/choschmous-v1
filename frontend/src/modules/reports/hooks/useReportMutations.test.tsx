import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useReportDownload } from "./useReportMutations";

const { apiDownloadReport, apiGetSurveyStatus } = vi.hoisted(() => ({
    apiDownloadReport: vi.fn(),
    apiGetSurveyStatus: vi.fn(),
}));

vi.mock("../api", () => ({ apiDownloadReport, apiGetSurveyStatus }));

function wrapper({ children }: { children: ReactNode }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useReportDownload", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiDownloadReport.mockResolvedValue(new Blob(["report-bytes"]));
        // jsdom implements neither of these, and triggerDownload calls both.
        window.URL.createObjectURL = vi.fn(() => "blob:mock-url");
        window.URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends only the required params when org/source are absent", async () => {
        const { result } = renderHook(() => useReportDownload(), { wrapper });

        await result.current.mutateAsync({ key: "roster", event_id: 12, format: "xlsx" });

        expect(apiDownloadReport).toHaveBeenCalledWith("roster", { event_id: 12, format: "xlsx" });
    });

    it("includes org_id and source only when provided", async () => {
        const { result } = renderHook(() => useReportDownload(), { wrapper });

        await result.current.mutateAsync({
            key: "roster",
            event_id: 12,
            org_id: 4,
            source: "actual",
            format: "pdf",
        });

        expect(apiDownloadReport).toHaveBeenCalledWith("roster", {
            event_id: 12,
            org_id: 4,
            source: "actual",
            format: "pdf",
        });
    });

    it("triggers a browser download named <key>_<event_id>.<format> on success", async () => {
        const { result } = renderHook(() => useReportDownload(), { wrapper });

        await result.current.mutateAsync({ key: "medals", event_id: 99, format: "xlsx" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(window.URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });
});
