import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { copy } from "@/lib/copy";
import { toast } from "@/lib/toast";

export function UserMenu() {
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      toast.success(copy.auth.signOut.success);
      void navigate({ to: "/auth/entrar" });
    } catch {
      toast.error(copy.auth.signOut.error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleSignOut}
      loading={isSigningOut}
      aria-label={copy.auth.signOut.action}
    >
      <LogOut aria-hidden="true" className="size-4" />
      <span className="max-sm:sr-only">{copy.auth.signOut.action}</span>
    </Button>
  );
}

export default UserMenu;
