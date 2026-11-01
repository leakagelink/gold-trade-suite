import { describe, expect, it } from "vitest";
import { canCloseOwnTrade, userTradeCloseParams } from "./userTradeClose";

describe("user trade closing", () => {
  it("allows users to close their own open trades", () => {
    expect(canCloseOwnTrade({ user_id: "owner", status: "open" }, "owner")).toBe(true);
  });
  it("does not allow closing another user's trades", () => {
    expect(canCloseOwnTrade({ user_id: "other", status: "open" }, "owner")).toBe(false);
  });
  it("does not allow closing a trade twice", () => {
    expect(canCloseOwnTrade({ user_id: "owner", status: "closed" }, "owner")).toBe(false);
  });
  it("settles at the supplied current price without forcing a loss", () => {
    expect(userTradeCloseParams("trade", 110, 0.055)).toEqual({
      p_position_id: "trade", p_close_price: 110, p_close_brokerage: 0.055, p_force_loss: false,
    });
  });
});