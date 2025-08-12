import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Keep session in sync and redirect when authenticated
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => navigate("/"), 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Sign in failed", description: error.message });
    } else {
      toast({ title: "Welcome back", description: "Signed in successfully." });
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Sign up failed", description: error.message });
    } else {
      toast({ title: "Check your email", description: "Confirm to complete sign up." });
      // Ensure a profile gets created after confirmation on first login (handled elsewhere)
    }
  };

  return (
    <>
      <Helmet>
        <title>{mode === "signin" ? "Login" : "Create Account"} — Scattergories Online</title>
        <meta name="description" content="Sign in or create an account to save your wins and streaks on the leaderboard." />
        <link rel="canonical" href="/auth" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/10 to-background">
        <Card className="w-full max-w-md bg-background/70 backdrop-blur-xl border">
          <CardHeader>
            <CardTitle>{mode === "signin" ? "Sign in" : "Create an account"}</CardTitle>
            <CardDescription>
              {mode === "signin" ? "Welcome back!" : "Register to keep your wins and streaks."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="flex items-center gap-2">
              {mode === "signin" ? (
                <Button onClick={handleSignIn} disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
              ) : (
                <Button onClick={handleSignUp} disabled={loading}>{loading ? "Creating…" : "Sign up"}</Button>
              )}
              <Button variant="secondary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
