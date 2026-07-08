import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

beforeEach(() => localStorage.clear());

const renderLanding = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <LandingPage />
    </MemoryRouter>,
  );

describe("LandingPage", () => {
  it("shows the create-Room action when no last Room is stored", async () => {
    renderLanding();
    expect(
      await screen.findByRole("button", { name: /create room/i }),
    ).toBeInTheDocument();
  });

  it("shows the create form on ?create even with a last Room stored", async () => {
    localStorage.setItem("scrum-tools:lastRoom", "some-room");
    renderLanding("/?create=1");
    // Must not redirect away; the create action is visible.
    expect(
      await screen.findByRole("button", { name: /create room/i }),
    ).toBeInTheDocument();
  });

  it("blocks creating a Room with an empty name", async () => {
    renderLanding();
    const button = await screen.findByRole("button", { name: /create room/i });
    await userEvent.click(button);
    expect(await screen.findByText(/room name is required/i)).toBeInTheDocument();
  });
});
