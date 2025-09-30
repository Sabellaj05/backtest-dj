
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
      dates: string[];
      close: number[];
      sma1: number[];
      sma2: number[];
      buys: { date: string; price: number }[];
      sells: { date: string; price: number }[];
    };
    equity_chart: {
      dates: string[];
      equity: number[];
    };
  };
}

// Helper function to format numbers as currency
const currencyFormatter = (value: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

export function BacktestChart({ data }: BacktestChartProps) {
  console.log('BacktestChart received data:', data);

  // 1. Transform data for Recharts
  const transformedPriceData = data.price_chart.dates.map((date, i) => ({
    date,
    close: data.price_chart.close[i],
    sma1: data.price_chart.sma1[i],
    sma2: data.price_chart.sma2[i],
  }));

  console.log('Transformed price data for chart:', transformedPriceData);

  const transformedEquityData = data.equity_chart.dates.map((date, i) => ({
    date,
    equity: data.equity_chart.equity[i],
  }));

  return (
    <div className="space-y-8 mt-6">
      {/* Chart 1: Price, SMAs, and Trades */}
      <div>
        <h3 className="text-lg font-semibold text-secondary mb-4">Price & Trades</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={transformedPriceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(str) => new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(val) => currencyFormatter(val)}
              domain={['dataMin - 10', 'dataMax + 10']}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
              formatter={(value: number) => currencyFormatter(value)}
            />
            <Legend />
            <Line type="monotone" dataKey="close" stroke="hsl(var(--primary))" dot={false} name="Close Price" />
            <Line type="monotone" dataKey="sma1" stroke="hsl(var(--secondary))" dot={false} name="SMA (10)" />
            <Line type="monotone" dataKey="sma2" stroke="hsl(var(--accent))" dot={false} name="SMA (20)" />
            <Scatter data={data.price_chart.buys} fill="#22c55e" shape="triangle" name="Buy" />
            <Scatter data={data.price_chart.sells} fill="#ef4444" shape="cross" name="Sell" />
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
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(str) => new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              tickFormatter={(val) => currencyFormatter(val)}
              domain={['dataMin - 100', 'dataMax + 100']}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              labelFormatter={(label) => new Date(label).toLocaleDateString()}
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
