import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import type { PreviewResponse } from "./api/types";

// These tests drive the real UI and stub only `fetch`, i.e. the network boundary.

const twoMembers: PreviewResponse = {
  name: "Viewed but not purchased",
  asOf: "2026-09-29T00:00:00.000Z",
  total: 2,
  conditionCount: 2,
  members: [
    {
      anonymousId: "anon_1001",
      evidence: [
        { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7, observedCount: 3 },
        { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7, observedCount: 0 },
      ],
    },
    {
      anonymousId: "anon_1002",
      evidence: [
        { eventType: "product_view", operator: "at_least", count: 2, withinDays: 7, observedCount: 2 },
        { eventType: "purchase", operator: "exactly", count: 0, withinDays: 7, observedCount: 0 },
      ],
    },
  ],
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const previewButton = () => screen.getByRole("button", { name: /preview audience/i });

describe("App", () => {
  it("sends the rule to the backend and shows members with evidence", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, twoMembers));
    const user = userEvent.setup();
    render(<App />);

    await user.click(previewButton());

    expect(await screen.findByRole("status")).toHaveProperty("textContent", "2 users match.");
    expect(screen.getByText("anon_1001")).toBeTruthy();
    expect(screen.getByText("Product view: at least 2 in the last 7 days — observed 3")).toBeTruthy();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:4000/v1/audiences/preview");
    expect(JSON.parse(init!.body as string)).toMatchObject({ asOf: "2026-09-29T00:00:00.000Z" });
  });

  it("shows an empty state when nobody matches", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ...twoMembers, total: 0, members: [] }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(previewButton());

    expect(await screen.findByText("No users match this rule")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an API failure with a working retry", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse(200, twoMembers));
    const user = userEvent.setup();
    render(<App />);

    await user.click(previewButton());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't reach the audience service");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("anon_1001")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("blocks invalid input on the client and never calls the API", async () => {
    const user = userEvent.setup();
    render(<App />);

    const count = screen.getAllByLabelText("Times")[0]!;
    await user.clear(count);
    await user.click(previewButton());

    expect(screen.getByText("Enter a number")).toBeTruthy();
    expect(count.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(count);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows server validation errors next to the matching field", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request is invalid",
          details: [{ path: "conditions[1].count", message: "must be at most 10000" }],
        },
      }),
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(previewButton());

    expect(await screen.findByText("Some fields need fixing")).toBeTruthy();
    expect(screen.getByText("must be at most 10000")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull(); // retrying the same input can't help
  });

  it("supports keyboard-only rule editing: add focuses the new row, remove is labelled", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "+ Add condition" }));
    expect(document.activeElement?.id).toBe("conditions-2-eventType");

    await user.keyboard("{Tab}{Tab}{Tab}{Tab}{Enter}"); // operator → times → days → remove
    expect(screen.queryByRole("group", { name: "Condition 3" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove condition 2" })).toBeTruthy();
  });

  it("flags results as out of date after the rule is edited", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, twoMembers));
    const user = userEvent.setup();
    render(<App />);

    await user.click(previewButton());
    await screen.findByText("anon_1001");
    await user.type(screen.getByLabelText("Audience name"), "!");

    expect(screen.getByText(/rule has changed since this preview/i)).toBeTruthy();
  });
});
