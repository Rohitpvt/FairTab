import { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { RoutePending } from "./components/feedback/FeedbackStates";

// Lazy-loaded feature pages
const OverviewPage = lazy(() => import("./features/dashboard/OverviewPage"));
const GroupsPage = lazy(() => import("./features/groups/GroupsPage"));
const CreateGroupPage = lazy(() => import("./features/groups/CreateGroupPage"));
const GroupDetailPage = lazy(() => import("./features/groups/GroupDetailPage"));
const GroupSettingsPage = lazy(() => import("./features/groups/GroupSettingsPage"));
const InvitationListPage = lazy(() => import("./features/invitations/InvitationListPage"));
const InvitationAcceptPage = lazy(() => import("./features/invitations/InvitationAcceptPage"));
const ExpensesPage = lazy(() => import("./features/expenses/ExpensesPage"));
const CreateExpenseFlow = lazy(() => import("./features/expenses/CreateExpenseFlow"));
const EditExpenseFlow = lazy(() => import("./features/expenses/EditExpenseFlow"));
const ExpenseDetailPage = lazy(() => import("./features/expenses/ExpenseDetailPage"));
const OCRReviewPage = lazy(() => import("./features/receipts/OCRReviewPage"));
const SettlementsPage = lazy(() => import("./features/settlements/SettlementsPage"));
const RecordSettlementFlow = lazy(() => import("./features/settlements/RecordSettlementFlow"));
const SettlementDetailPage = lazy(() => import("./features/settlements/SettlementDetailPage"));
const AnalyticsPage = lazy(() => import("./features/analytics/AnalyticsPage"));
const BudgetDashboard = lazy(() => import("./features/budgets/BudgetDashboard"));
const RecurringPage = lazy(() => import("./features/recurring/RecurringPage"));
const NotificationsPage = lazy(() => import("./features/notifications/NotificationsPage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));
const NotFoundPage = lazy(() => import("./features/error/NotFoundPage"));
const SmartInsightsPage = lazy(() => import("./features/insights/SmartInsightsPage").then(m => ({ default: m.SmartInsightsPage })));

// Lazy-loaded auth pages
const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const RegisterPage = lazy(() => import("./features/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./features/auth/ForgotPasswordPage"));
const VerifyEmailPage = lazy(() => import("./features/auth/VerifyEmailPage"));
const OnboardingFlow = lazy(() => import("./features/onboarding/OnboardingFlow"));

import { AppActionProvider } from "./app/providers/AppActionProvider";
import { AuthProvider } from "./features/auth/AuthProvider";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  VerifyEmailRoute,
  OnboardingRoute
} from "./features/auth/RouteGuards";
import { EmulatorIndicator } from "./components/ui/EmulatorIndicator";

export function App() {
  return (
    <HashRouter>
      <AppActionProvider>
        <AuthProvider>
          <Routes>
            {/* Public-only authentication routes */}
            <Route element={<PublicOnlyRoute />}>
              <Route
                path="auth/login"
                element={
                  <Suspense fallback={<RoutePending />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route
                path="auth/register"
                element={
                  <Suspense fallback={<RoutePending />}>
                    <RegisterPage />
                  </Suspense>
                }
              />
              <Route
                path="auth/forgot-password"
                element={
                  <Suspense fallback={<RoutePending />}>
                    <ForgotPasswordPage />
                  </Suspense>
                }
              />
            </Route>

            {/* Email verification route */}
            <Route element={<VerifyEmailRoute />}>
              <Route
                path="auth/verify-email"
                element={
                  <Suspense fallback={<RoutePending />}>
                    <VerifyEmailPage />
                  </Suspense>
                }
              />
            </Route>

            {/* Direct Invitation Acceptance Route (Open access, custom auth checks inside) */}
            <Route
              path="invitations/:invitationId"
              element={
                <Suspense fallback={<RoutePending />}>
                  <InvitationAcceptPage />
                </Suspense>
              }
            />
            <Route
              path="invite/:token"
              element={
                <Suspense fallback={<RoutePending />}>
                  <InvitationAcceptPage />
                </Suspense>
              }
            />
            <Route
              path="join/:token"
              element={
                <Suspense fallback={<RoutePending />}>
                  <InvitationAcceptPage />
                </Suspense>
              }
            />

            {/* Onboarding route */}
            <Route element={<OnboardingRoute />}>
              <Route
                path="onboarding"
                element={
                  <Suspense fallback={<RoutePending />}>
                    <OnboardingFlow />
                  </Suspense>
                }
              />
            </Route>

            {/* Protected application routes nested under AppShell */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppShell />}>
                {/* Default Redirect to Overview */}
                <Route index element={<Navigate to="/overview" replace />} />

                {/* Lazy loaded paths */}
                <Route
                  path="overview"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <OverviewPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <GroupsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/new"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <CreateGroupPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <GroupDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/expenses/new"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <CreateExpenseFlow />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/receipts/new"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <OCRReviewPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/expenses/:expenseId"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <ExpenseDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/expenses/:expenseId/edit"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <EditExpenseFlow />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/settings"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <GroupSettingsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="invitations"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <InvitationListPage />
                    </Suspense>
                  }
                />
                <Route
                  path="expenses"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <ExpensesPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/settlements"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <SettlementsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/settlements/new"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <RecordSettlementFlow />
                    </Suspense>
                  }
                />
                <Route
                  path="groups/:groupId/settlements/:settlementId"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <SettlementDetailPage />
                    </Suspense>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <AnalyticsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="budgets"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <BudgetDashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="insights"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <SmartInsightsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="recurring"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <RecurringPage />
                    </Suspense>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <NotificationsPage />
                    </Suspense>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <SettingsPage />
                    </Suspense>
                  }
                />

                {/* Fallback 404 under AppShell */}
                <Route
                  path="*"
                  element={
                    <Suspense fallback={<RoutePending />}>
                      <NotFoundPage />
                    </Suspense>
                  }
                />
              </Route>
            </Route>
          </Routes>
          <EmulatorIndicator />
        </AuthProvider>
      </AppActionProvider>
    </HashRouter>
  );
}

export default App;
