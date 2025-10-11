
import {
  Line, 
  LineChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid, 
  ResponsiveContainer, 
  Scatter, 
  ComposedChart
} from "recharts";

// Define the structure of the props the component will receive
interface BacktestChartProps {
  data: {
    price_chart: {
      dates: number[];
      close: (number | null)[];
      sma1: (number | null)[];
      sma2: (number | null)[];
      buy_signals: (number | null)[];
      sell_signals: (number | null)[];
    };
    equity_chart: {
      dates: number[];
      equity: (number | null)[];
    };
  };
}

// Helper function to format numbers as currency
const currencyFormatter = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

// Helper function to format timestamp for chart labels
const dateFormatter = (timestamp: number) => {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  // Add time if it's not midnight (i.e., not daily data)
  if (date.getHours() !== 0 || date.getMinutes() !== 0) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString('en-US', options);
};

export function BacktestChart({ data }: BacktestChartProps) {
  // 1. Transform data for Recharts
  const transformedPriceData = data.price_chart.dates.map((date, i) => ({
    date, // date is a timestamp
    close: data.price_chart.close[i],
    sma1: data.price_chart.sma1[i],
    sma2: data.price_chart.sma2[i],
    buy_signal: data.price_chart.buy_signals[i],
    sell_signal: data.price_chart.sell_signals[i],
  }));

  const transformedEquityData = data.equity_chart.dates.map((date, i) => ({
    date, // date is a timestamp
    equity: data.equity_chart.equity[i],
  }));

  return (
    <div className="space-y-8 mt-6">
      {/* Chart 1: Price, Trades, and Equity Curve */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Price & Trades</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={transformedPriceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={dateFormatter}
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(val) => currencyFormatter(val)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelFormatter={dateFormatter}
              formatter={(value: number, name: string) => [currencyFormatter(value), name]}
            />
            <Legend />
            <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" dot={false} name="Close Price" />
            <Line type="monotone" dataKey="sma1" stroke="hsl(var(--secondary))" dot={false} name="SMA (10)" />
            <Line type="monotone" dataKey="sma2" stroke="hsl(var(--accent))" dot={false} name="SMA (20)" />
            <Scatter dataKey="buy_signal" fill="#22c55e" shape="triangle" name="Buy" />
            <Scatter dataKey="sell_signal" fill="#ef4444" shape="cross" name="Sell" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Equity Curve */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Equity Curve</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={transformedEquityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              type="number"
              domain={['dataMin', 'dataMax']}
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={dateFormatter} 
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(val) => currencyFormatter(val)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelFormatter={dateFormatter}
              formatter={(value: number) => currencyFormatter(value)}
            />
            <Legend />
            <Line type="monotone" dataKey="equity" stroke="hsl(var(--primary))" dot={false} name="Portfolio Value" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
