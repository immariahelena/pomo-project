import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2, UserPlus } from "lucide-react";

interface InvitationInfo {
  valid: boolean;
  error?: string;
  project_id?: string;
  project_name?: string;
  created_by_name?: string;
  expires_at?: string;
}

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuthAndFetchInvitation();
  }, [token]);

  const checkAuthAndFetchInvitation = async () => {
    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      // Fetch invitation details
      if (token) {
        const { data, error } = await supabase.rpc('get_invitation_by_token', {
          _token: token
        });

        if (error) throw error;
        setInvitation(data as unknown as InvitationInfo);
      }
    } catch (error: any) {
      console.error("Error fetching invitation:", error);
      setInvitation({ valid: false, error: "Erro ao carregar convite" });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!user || !token) return;

    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('accept_project_invitation', {
        _token: token,
        _user_id: user.id
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; project_id?: string; message?: string };

      if (result.success) {
        toast({
          title: "Convite aceito!",
          description: result.message || "Você agora é colaborador do projeto.",
        });
        navigate(`/projects/${result.project_id}`);
      } else {
        toast({
          title: "Erro ao aceitar convite",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao aceitar convite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleLoginRedirect = () => {
    // Store the invite token to process after login
    localStorage.setItem('pendingInviteToken', token || '');
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando convite...</span>
        </div>
      </div>
    );
  }

  if (!invitation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Convite Inválido</CardTitle>
            <CardDescription>
              {invitation?.error || "Este convite não é válido ou já expirou."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/")} variant="outline">
              Voltar para o início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Convite para Projeto</CardTitle>
          <CardDescription>
            Você foi convidado para colaborar em um projeto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-1">Projeto</p>
              <p className="font-semibold text-lg">{invitation.project_name}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Convidado por: <span className="font-medium text-foreground">{invitation.created_by_name}</span></p>
            </div>
          </div>

          {user ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                <div className="flex items-center justify-center gap-2 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Logado como {user.email}</span>
                </div>
              </div>
              <Button 
                onClick={handleAcceptInvitation} 
                className="w-full" 
                size="lg"
                disabled={accepting}
              >
                {accepting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  "Aceitar Convite"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Faça login ou crie uma conta para aceitar o convite
              </p>
              <Button onClick={handleLoginRedirect} className="w-full" size="lg">
                Entrar ou Criar Conta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
