import React from "react";
import { AuthLayout } from "./AuthLayout";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const ForgotPasswordPage: React.FC = () => {
  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your account email to dispatch a secure password reset link."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
