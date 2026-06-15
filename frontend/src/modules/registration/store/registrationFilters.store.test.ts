import { describe, it, expect, beforeEach } from "vitest";
import { useRegistrationFiltersStore } from "./registrationFilters.store";

const get = () => useRegistrationFiltersStore.getState();

describe("registrationFilters store", () => {
    beforeEach(() => {
        get().reset();
    });

    it("starts with empty filters on page 1", () => {
        expect(get()).toMatchObject({ search: "", page: 1, categoryId: "", gender: "" });
    });

    it("setSearch updates the term and resets to page 1", () => {
        get().setPage(5);
        get().setSearch("dara");
        expect(get().search).toBe("dara");
        expect(get().page).toBe(1);
    });

    it("setPage changes the page without touching other filters", () => {
        get().setSearch("dara");
        get().setPage(3);
        expect(get().page).toBe(3);
        expect(get().search).toBe("dara");
    });

    it("setCategoryId resets to page 1", () => {
        get().setPage(4);
        get().setCategoryId("7");
        expect(get().categoryId).toBe("7");
        expect(get().page).toBe(1);
    });

    it("setGender resets to page 1", () => {
        get().setPage(4);
        get().setGender("male");
        expect(get().gender).toBe("male");
        expect(get().page).toBe(1);
    });

    it("reset restores every field to its initial value", () => {
        get().setSearch("x");
        get().setCategoryId("2");
        get().setGender("female");
        get().setPage(9);
        get().reset();
        expect(get()).toMatchObject({ search: "", page: 1, categoryId: "", gender: "" });
    });
});
