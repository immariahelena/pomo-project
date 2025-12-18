import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PendingApproval = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserEmail(session.user.email || null);

      // Check if user is already approved
      const { data: profile } = await supabase
        .from("profiles")
        .select("approved")
        .eq("id", session.user.id)
        .single();

      if (profile?.approved) {
        navigate("/dashboard");
      }
    };

    checkAuth();

    // Subscribe to profile changes for real-time approval
    const channel = supabase
      .channel('approval-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        async (payload) => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && payload.new.id === session.user.id && payload.new.approved) {
            toast({
              title: "Acesso aprovado!",
              description: "Seu acesso foi aprovado. Redirecionando...",
            });
            navigate("/dashboard");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, toast]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("approved")
        .eq("id", session.user.id)
        .single();

      if (profile?.approved) {
        toast({
          title: "Acesso aprovado!",
          description: "Seu acesso foi aprovado. Redirecionando...",
        });
        navigate("/dashboard");
      } else {
        toast({
          title: "Ainda aguardando",
          description: "Seu acesso ainda está pendente de aprovação.",
        });
      }
    } catch (error) {
      console.error("Erro ao verificar status:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Aguardando Aprovação</CardTitle>
          <CardDescription>
            Sua conta foi criada com sucesso, mas está aguardando aprovação do administrador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userEmail && (
            <p className="text-sm text-muted-foreground text-center">
              Conta: <span className="font-medium text-foreground">{userEmail}</span>
            </p>
          )}
          
          <p className="text-sm text-muted-foreground text-center">
            Você receberá acesso ao sistema assim que um administrador aprovar sua conta.
            Esta página será atualizada automaticamente quando seu acesso for liberado.
          </p>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={handleCheckStatus} 
              disabled={checking}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              {checking ? "Verificando..." : "Verificar Status"}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
