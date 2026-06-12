import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText("Default");
    expect(el.className).toContain("bg-primary-50");
    expect(el.className).toContain("text-primary");
  });

  it("applies variant classes", () => {
    render(<Badge variant="success">Success</Badge>);
    const el = screen.getByText("Success");
    expect(el.className).toContain("bg-success-bg");
    expect(el.className).toContain("text-success");
  });

  it("applies size classes", () => {
    render(<Badge size="xs">Small</Badge>);
    const el = screen.getByText("Small");
    expect(el.className).toContain("px-2 py-0.5");
  });

  it("renders dot indicator when dot=true", () => {
    const { container } = render(<Badge dot>With Dot</Badge>);
    const spans = container.querySelectorAll("span");
    const dotSpan = Array.from(spans).find((s) => s.className.includes("h-1.5 w-1.5"));
    expect(dotSpan).toBeTruthy();
  });

  it("does not render dot when dot=false", () => {
    const { container } = render(<Badge>No Dot</Badge>);
    const spans = container.querySelectorAll("span");
    const dotSpan = Array.from(spans).find((s) => s.className.includes("h-1.5 w-1.5"));
    expect(dotSpan).toBeFalsy();
  });

  it("merges custom className", () => {
    render(<Badge className="custom-class">Custom</Badge>);
    const el = screen.getByText("Custom");
    expect(el.className).toContain("custom-class");
  });

  it("renders outline variant correctly", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const el = screen.getByText("Outline");
    expect(el.className).toContain("bg-transparent");
    expect(el.className).toContain("border-border");
  });
});
