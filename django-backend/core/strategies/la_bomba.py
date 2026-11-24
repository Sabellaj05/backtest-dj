from backtesting import Strategy
from backtesting.lib import crossover
from backtesting.test import SMA


class LaBomba(Strategy):
    """
    Risk-managed SMA crossover strategy ("La Bomba"):
    - Enters long when SMA(10) crosses above SMA(50).
    - Enters short when SMA(10) crosses below SMA(50).
    - Risk management:
        - Stop Loss: 1%
        - Take Profit: 2%
        - Break Even: Moves stop loss to entry price once unrealized gain reaches +1%.
    """

    n1 = 10
    n2 = 50
    stop_loss_pct = 0.01
    take_profit_pct = 0.02
    breakeven_pct = 0.01

    def init(self):
        """Initialize moving average indicators."""
        self.sma1 = self.I(SMA, self.data.Close, self.n1)
        self.sma2 = self.I(SMA, self.data.Close, self.n2)

    def next(self):
        """Evaluate break-even trailing rules and crossover entry signals on each bar."""
        price = self.data.Close[-1]

        for trade in self.trades:
            if trade.is_long:
                pnl_pct = (price / trade.entry_price) - 1
            else:
                pnl_pct = (trade.entry_price / price) - 1

            if pnl_pct >= self.breakeven_pct:
                if trade.is_long and trade.sl < trade.entry_price:
                    trade.sl = trade.entry_price
                elif trade.is_short and trade.sl > trade.entry_price:
                    trade.sl = trade.entry_price

        if not self.position:
            if crossover(self.sma1, self.sma2):
                sl = price * (1 - self.stop_loss_pct)
                tp = price * (1 + self.take_profit_pct)
                self.buy(sl=sl, tp=tp)
            elif crossover(self.sma2, self.sma1):
                sl = price * (1 + self.stop_loss_pct)
                tp = price * (1 - self.take_profit_pct)
                self.sell(sl=sl, tp=tp)
