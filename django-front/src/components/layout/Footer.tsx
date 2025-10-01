import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col space-y-4">
          {/* Links */}
          <div className="flex flex-wrap justify-center items-center gap-2">
            <Button 
              variant="link"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => alert('Privacy Policy coming soon!')}
            >
              Privacy Policy
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button 
              variant="link"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => alert('Terms of Service coming soon!')}
            >
              Terms of Service
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button 
              variant="link"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => alert('Contact coming soon!')}
            >
              Contact
            </Button>
          </div>

          {/* Copyright */}
          <div className="text-sm text-muted-foreground text-center">
            © 2025 QuantFlow. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
