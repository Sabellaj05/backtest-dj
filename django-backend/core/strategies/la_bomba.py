from backtesting import Strategy
from backtesting.lib import crossover
from backtesting.test import SMA

class LaBomba(Strategy):
    """
    Estrategia "LA BOMBA":
    - Compra cuando la SMA de 10 cruza hacia arriba a la SMA de 50.
    - Vende cuando la SMA de 10 cruza hacia abajo a la SMA de 50.
    - Gestión de Riesgo:
        - Stop Loss: 1%
        - Take Profit: 2%
        - Break Even: Mueve el SL al precio de entrada cuando la ganancia es del 1%.
    """
    n1 = 10
    n2 = 50
    stop_loss_pct = 0.01
    take_profit_pct = 0.02
    breakeven_pct = 0.01

    def init(self):
        """Inicializa los indicadores."""
        self.sma1 = self.I(SMA, self.data.Close, self.n1)
        self.sma2 = self.I(SMA, self.data.Close, self.n2)

    def next(self):
        """Define la lógica de la estrategia para cada vela."""
        price = self.data.Close[-1]

        # --- Lógica de Break Even ---
        # Itera sobre las operaciones abiertas para ajustar el SL a break even si es necesario.
        for trade in self.trades:
            # Calcula el PnL porcentual manualmente
            if trade.is_long:
                pnl_pct = (price / trade.entry_price) - 1
            else: # Venta corta
                pnl_pct = (trade.entry_price / price) - 1

            # Si la ganancia supera el umbral de break even
            if pnl_pct >= self.breakeven_pct:
                if trade.is_long and trade.sl < trade.entry_price:
                    trade.sl = trade.entry_price
                elif trade.is_short and trade.sl > trade.entry_price:
                    trade.sl = trade.entry_price

        # --- Lógica de Entrada ---
        # Si no hay una posición abierta, busca señales de cruce.
        if not self.position:
            # Señal de Compra: SMA1 cruza por encima de SMA2
            if crossover(self.sma1, self.sma2):
                sl = price * (1 - self.stop_loss_pct)
                tp = price * (1 + self.take_profit_pct)
                self.buy(sl=sl, tp=tp)

            # Señal de Venta Corta: SMA2 cruza por encima de SMA1
            elif crossover(self.sma2, self.sma1):
                sl = price * (1 + self.stop_loss_pct)
                tp = price * (1 - self.take_profit_pct)
                self.sell(sl=sl, tp=tp)
