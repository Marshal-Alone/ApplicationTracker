import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.warn("404 route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface-page))] px-4">
      <div className="text-center max-w-sm space-y-3">
        <p className="font-mono-num text-[13px] text-[hsl(var(--ink-muted))]">404</p>
        <h1 className="text-[24px] font-medium text-[hsl(var(--ink-primary))]">
          Page not found
        </h1>
        <p className="text-[14px] text-[hsl(var(--ink-secondary))]">
          No view matches {location.pathname}.
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center h-9 px-4 rounded-[8px] bg-[hsl(var(--ink-primary))] text-[hsl(var(--surface-card))] text-[13px] font-medium hover:bg-[hsl(0_0%_18%)] transition-ui"
          >
            Return to overview
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
