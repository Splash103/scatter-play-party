import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCallback } from "react";

export default function HomeButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const goHome = useCallback(() => {
    const isGame = location.pathname.startsWith("/game");
    const inRoom = !!searchParams.get("room");
    if (isGame && inRoom) {
      const ok = window.confirm("Leave the room and return to Home?");
      if (!ok) return;
    }
    navigate("/");
  }, [location.pathname, navigate, searchParams]);

  // Don't show home button on game page
  if (location.pathname.startsWith("/game")) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50">
      <Button variant="secondary" size="sm" onClick={goHome} aria-label="Go home">
        Home
      </Button>
    </div>
  );
}
