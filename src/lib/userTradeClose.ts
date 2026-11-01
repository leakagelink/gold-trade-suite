export function canCloseOwnTrade(
  position: { user_id: string; status: string },
  userId: string | undefined,
) {
  return !!userId && position.user_id === userId && position.status === "open";
}

export function userTradeCloseParams(positionId: string, price: number, brokerage: number) {
  return {
    p_position_id: positionId,
    p_close_price: price,
    p_close_brokerage: brokerage,
    p_force_loss: false,
  };
}