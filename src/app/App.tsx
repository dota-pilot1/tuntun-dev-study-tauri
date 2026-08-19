import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../features/auth/auth-store";
import LoginScreen from "../features/auth/LoginScreen";
import StaffAppShell from "../widgets/app-shell/StaffAppShell";
import HomeModule from "../widgets/home/HomeModule";
import HospitalPlaybookModule from "../widgets/hospital-playbook/HospitalPlaybookModule";
import ChatbotModule from "../widgets/chatbot/ChatbotModule";
import HandoffModule from "../widgets/handoff/HandoffModule";
import SettingsPage from "../widgets/settings/SettingsPage";
import ProfilePage from "../widgets/profile/ProfilePage";
import type { StaffViewId } from "../shared/config/app-modules";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function StaffConsole() {
  const [active, setActive] = useState<StaffViewId>("home");

  return (
    <StaffAppShell active={active} onSelect={setActive}>
      {active === "home" ? (
        <HomeModule onSelect={setActive} />
      ) : active === "playbook" ? (
        <HospitalPlaybookModule />
      ) : active === "chatbot" ? (
        <ChatbotModule />
      ) : active === "handoff" ? (
        <HandoffModule />
      ) : active === "settings" ? (
        <SettingsPage />
      ) : (
        <ProfilePage />
      )}
    </StaffAppShell>
  );
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const restoring = useAuthStore((s) => s.restoring);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  if (restoring) {
    return (
      <div className="grid h-screen place-items-center bg-surface-muted text-text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {user ? <StaffConsole /> : <LoginScreen />}
    </QueryClientProvider>
  );
}
