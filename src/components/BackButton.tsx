import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft } from "lucide-react";

const BackButton = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isHome = location.pathname === "/";
  const needsConfirm = location.pathname.startsWith("/game");

  if (isHome) return null;

  return (
    <>
      <div className="fixed left-4 top-4 z-50">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (needsConfirm) setConfirmOpen(true);
            else navigate(-1);
          }}
          aria-label="Go back"
          className="backdrop-blur supports-[backdrop-filter]:bg-background/70"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the game?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to exit? Your current round progress may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate(-1)}>Exit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BackButton;
