import { describe, it, expect, beforeEach } from "vitest";
import { useSportsFiltersStore } from "./sportsFilters.store";

const get = () => useSportsFiltersStore.getState();

describe("sportsFilters store", () => {
    beforeEach(() => {
        get().reset();
    });

    it("starts empty on page 1", () => {
        expect(get()).toMatchObject({ search: "", page: 1 });
    });

    it("setSearch resets to page 1", () => {
        get().setPage(4);
        get().setSearch("foot");
        expect(get().search).toBe("foot");
        expect(get().page).toBe(1);
    });

    it("setPage changes only the page", () => {
        get().setSearch("foot");
        get().setPage(2);
        expect(get().page).toBe(2);
        expect(get().search).toBe("foot");
    });

    it("reset restores the initial state", () => {
        get().setSearch("x");
        get().setPage(9);
        get().reset();
        expect(get()).toMatchObject({ search: "", page: 1 });
    });

    describe("getQueryParams — pagination math (limit 200)", () => {
        it("offsets by zero on page 1", () => {
            expect(get().getQueryParams()).toEqual({ skip: 0, limit: 200 });
        });

        it("offsets by (page-1) * limit on later pages", () => {
            get().setPage(3);
            expect(get().getQueryParams()).toEqual({ skip: 400, limit: 200 });
        });
    });
});
