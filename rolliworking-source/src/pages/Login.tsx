import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  usePageMeta({
    title: "Sign in • Rolliworks",
    description: "Employee sign-in for the Rolliworks watch repair dashboard.",
    canonicalPath: "/login",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      toast.success("Signed in");

      const from = (location.state as any)?.from;
      navigate(typeof from === "string" ? from : "/", { replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Employee access only. Contact an administrator to get an account.</CardDescription>
          </CardHeader>

          <form onSubmit={submit} className="space-y-4">
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : "Sign in"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </section>
    </main>
  );
};

export default Login;
