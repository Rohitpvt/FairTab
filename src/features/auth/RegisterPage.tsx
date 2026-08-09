import React from "react";
import { AuthLayout } from "./AuthLayout";
import { RegisterForm } from "./RegisterForm";

export const RegisterPage: React.FC = () => {
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Register an account to split transactions and optimize debts."
    >
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
