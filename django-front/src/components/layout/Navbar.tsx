import { TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  return (
    <nav className="w-full border-b border-border bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Left side */}
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-foreground">
              QuantFlow
            </span>
          </div>

          {/* Navigation Links - Right side */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost"
              onClick={() => alert('About section coming soon!')}
            >
              About
            </Button>
            <Button 
              variant="ghost"
              onClick={() => alert('Docs section coming soon!')}
            >
              Docs
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
