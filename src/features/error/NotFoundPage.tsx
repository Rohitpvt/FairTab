import React from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center select-none animate-fade-in">
      <div className="p-4 rounded-full bg-warning/10 text-warning mb-5">
        <HelpCircle className="h-10 w-10 animate-bounce" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-text-primary mb-2">
        Page Not Found
      </h1>
      <p className="text-sm text-text-muted max-w-sm mb-6 leading-relaxed">
        The section you are trying to access does not exist or has been deferred for later construction.
      </p>
      <Button variant="gradient" onClick={() => navigate("/overview")} size="md">
        Return to Dashboard
      </Button>
    </div>
  );
};
export default NotFoundPage;
