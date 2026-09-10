import React from "react";
import { Animated404ErrorView } from "../../components/feedback/Animated404ErrorView";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="w-full py-4 animate-fade-in">
      <Animated404ErrorView
        statusCode="404"
        title="Look like you're lost"
        subtitle="The page you are looking for is not available or has been moved."
        homePath="#/overview"
        homeLabel="Return to Dashboard"
        showTryAgain={true}
        showBackButton={true}
      />
    </div>
  );
};

export default NotFoundPage;
