import React from "react";
import { AuthLayout } from "./AuthLayout";
import { LoginForm } from "./LoginForm";

export const LoginPage: React.FC = () => {
  return (
    <AuthLayout
      title="Welcome to FairTab"
      subtitle="Every expense, fairly shared. Sign in to your account."
    >
      <LoginForm />
    </AuthLayout>
  );
};

export default LoginPage;
