import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from './lib/utils';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { Calendar } from './components/ui/calendar';
import { Separator } from './components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { BacktestChart } from './components/BacktestChart';
import './App.css';

// Define strategy options
const strategyOptions = [
  { value: 'SMA', label: 'Simple Moving Average' },
  { value: 'EMA', label: 'Exponential Moving Average' },
  { value: 'RSI', label: 'Relative Strength Index' },
  { value: 'MACD', label: 'Moving Average Convergence Divergence' },
];

function App() {
  const [ticker, setTicker] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [strategy, setStrategy] = useState<string>('');
  const [capital, setCapital] = useState<string>('10000'); // Default capital
  const [chartsData, setChartsData] = useState<any>(null); // Placeholder for chart data

  const handleBacktest = async () => {
    // Basic validation
    if (!ticker || !startDate || !endDate || !strategy || !capital) {
      alert('Please fill in all fields.');
      return;
    }

    if (startDate > endDate) {
      alert('Start date cannot be after end date.');
      return;
    }

    const backtestParams = {
      ticker,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      strategy,
      capital: parseFloat(capital),
    };

    console.log('Starting backtest with parameters:', backtestParams);

    try {
      const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/api/backtest/`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backtestParams),
      });

      const data = await response.json();
      console.log('API Response:', data);

      if (!response.ok) {
        // Extract error message from Django's response
        const errorMsg = Object.values(data).join('\n');
        throw new Error(errorMsg || 'An unknown error occurred.');
      }

      setChartsData(data);
    } catch (error: any) {
      console.error('Error during backtest:', error);
      alert(`Failed to run backtest: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-8">
      <header className="w-full max-w-4xl text-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary animate-fade-in-down">
          QuantFlow Backtester
        </h1>
        <p className="text-lg text-textSecondary mt-4 animate-fade-in-up">
          Simulate trading strategies with precision.
        </p>
      </header>

      <Card className="w-full max-w-3xl p-8 shadow-2xl border-border animate-fade-in">
        <CardHeader>
          <CardTitle className="text-3xl text-primary">Backtesting Parameters</CardTitle>
          <p className="text-textSecondary">
            Input your desired parameters to run a backtest.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* TICKER Input */}
            <div className="space-y-2">
              <Label htmlFor="ticker" className="text-muted-foreground">TICKER</Label>
              <Input
                id="ticker"
                placeholder="e.g., AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="bg-muted border-border text-foreground focus:border-primary focus:ring-primary"
              />
            </div>

            {/* Starting Capital */}
            <div className="space-y-2">
              <Label htmlFor="capital" className="text-muted-foreground">Starting Capital (USD)</Label>
              <Input
                id="capital"
                type="number"
                placeholder="e.g., 10000"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="bg-muted border-border text-foreground focus:border-primary focus:ring-primary"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-muted-foreground">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-full justify-start text-left font-normal bg-muted border-border text-foreground hover:bg-muted hover:text-foreground',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border-border">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-muted-foreground">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-full justify-start text-left font-normal bg-muted border-border text-foreground hover:bg-muted hover:text-foreground',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border-border">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Strategy Type */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="strategy" className="text-muted-foreground">Strategy Type</Label>
              <Select onValueChange={setStrategy} value={strategy}>
                <SelectTrigger className="w-full bg-muted border-border text-foreground focus:border-primary focus:ring-primary">
                  <SelectValue placeholder="Select a strategy" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-foreground">
                  {strategyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleBacktest}
            className="w-full py-3 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
          >
            Start Backtesting
          </Button>
        </CardContent>
      </Card>

      {chartsData && (
        <Card className="w-full max-w-3xl mt-12 p-8 shadow-2xl border-border animate-fade-in-up">
          <CardHeader>
            <CardTitle className="text-3xl text-secondary">Backtest Results</CardTitle>
            <p className="text-textSecondary">
              Performance charts and key metrics.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Total Return</p>
                <p className="font-semibold text-lg">{chartsData.metrics?.total_return_pct}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Max Drawdown</p>
                <p className="font-semibold text-lg">{chartsData.metrics?.max_drawdown_pct}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Sharpe Ratio</p>
                <p className="font-semibold text-lg">{chartsData.metrics?.sharpe}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Annual Return (CAGR)</p>
                <p className="font-semibold text-lg">{chartsData.metrics?.cagr_pct}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Total Trades</p>
                <p className="font-semibold text-lg">{chartsData.metrics?.trades}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Win Rate</p>
                <p className="font-semibold text-lg">{chartsData.metrics?.winrate_pct}%</p>
              </div>
            </div>
            {chartsData.price_chart && (
              <BacktestChart data={chartsData} />
            )}
          </CardContent>
        </Card>
      )}


    </div>
  );
}

export default App;
