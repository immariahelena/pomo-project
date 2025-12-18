import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import { z } from "zod";

// Validation schemas
const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(1, "Senha é obrigatória").max(128, "Senha muito longa"),
});

const signupSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128, "Senha muito longa"),
  confirmPassword: z.string(),
  fullName: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is approved
        const { data: profile } = await supabase
          .from("profiles")
          .select("approved")
          .eq("id", session.user.id)
          .single();

        if (!profile?.approved) {
          navigate("/pending-approval");
          return;
        }

        // Check for pending invite
        const pendingToken = localStorage.getItem('pendingInviteToken');
        if (pendingToken) {
          localStorage.removeItem('pendingInviteToken');
          navigate(`/invite/${pendingToken}`);
        } else {
          navigate("/dashboard");
        }
      }
    };
    checkSession();
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate email
      const validation = resetPasswordSchema.safeParse({ email });
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast({
          title: "Erro de validação",
          description: firstError.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        validation.data.email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });

      setIsForgotPassword(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Validate login inputs
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          const firstError = validation.error.errors[0];
          toast({
            title: "Erro de validação",
            description: firstError.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email: validation.data.email,
          password: validation.data.password,
        });

        if (error) throw error;

        // Check if user is approved
        if (authData.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("approved")
            .eq("id", authData.user.id)
            .single();

          if (!profile?.approved) {
            toast({
              title: "Aguardando aprovação",
              description: "Sua conta está aguardando aprovação do administrador.",
            });
            navigate("/pending-approval");
            return;
          }
        }

        toast({
          title: "Login realizado com sucesso!",
          description: "Redirecionando...",
        });

        // Check for pending invite
        const pendingToken = localStorage.getItem('pendingInviteToken');
        if (pendingToken) {
          localStorage.removeItem('pendingInviteToken');
          navigate(`/invite/${pendingToken}`);
        } else {
          navigate("/dashboard");
        }
      } else {
        // Validate signup inputs
        const validation = signupSchema.safeParse({
          email,
          password,
          confirmPassword,
          fullName
        });

        if (!validation.success) {
          const firstError = validation.error.errors[0];
          toast({
            title: "Erro de validação",
            description: firstError.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: validation.data.email,
          password: validation.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: validation.data.fullName,
            },
          },
        });

        if (error) throw error;

        // Assign default 'collaborator' role to new user
        if (data.user) {
          await supabase.from("user_roles").insert({
            user_id: data.user.id,
            role: "collaborator",
          });
        }

        toast({
          title: "Conta criada com sucesso!",
          description: "Você já pode fazer login.",
        });

        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-fundo-branco rounded-full flex items-center justify-center">
              <img src="/pomo.png" className="img" alt="Pomo Project" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-6 text-sm">
            <button
              onClick={() => navigate("/")}
              className="text-foreground hover:text-primary transition-colors"
            >
              PÁGINA INICIAL
            </button>
            <button
              onClick={() => navigate("/about")}
              className="text-foreground hover:text-primary transition-colors"
            >
              SOBRE NÓS
            </button>
            <button
              onClick={() => navigate("/contact")}
              className="text-foreground hover:text-primary transition-colors"
            >
              CONTATO
            </button>
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-semibold"
            >
              {isLogin ? "INSCREVER-SE" : "CONECTE-SE"}
            </button>
          </nav>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-bold text-primary">
              {isForgotPassword ? "Recuperar Senha" : isLogin ? "Conecte-se" : "Inscrever-se"}
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-6">
            {isForgotPassword ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Endereço de E-mail</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Digite seu e-mail para receber um link de recuperação de senha.
                  </p>
                </div>
              </>
            ) : (
              <>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <div className="relative">
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Daniel Gallego"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={!isLogin}
                        className="pl-10"
                      />
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">
                    {isLogin ? "Nome de Usuário" : "Endereço de E-mail"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      placeholder={isLogin ? "" : "hello@reallygreatsite.com"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="**********"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 pr-10"
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {!isForgotPassword && !isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="**********"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                    className="pl-10 pr-10"
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {isLogin && !isForgotPassword && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Lembre-me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary-light"
              disabled={loading}
            >
              {loading
                ? "Processando..."
                : isForgotPassword
                  ? "Enviar Link de Recuperação"
                  : isLogin
                    ? "Conecte-se"
                    : "Criar Conta"}
            </Button>

            {isForgotPassword ? (
              <div className="text-center text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-primary hover:underline font-medium"
                >
                  Voltar para Login
                </button>
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                {isLogin ? "Ou " : "Ou "}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline font-medium"
                >
                  {isLogin ? "Inscrever-se" : "Conecte-se"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Right Side - Blue Background */}
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-12">
        <div className="text-primary-foreground space-y-4 max-w-md">
          <h2 className="text-3xl font-bold">Bem-vindo ao Pomo Project</h2>
          <p className="text-lg opacity-90">
            Sistema de Gestão de Produções Audiovisuais - Organize seus projetos,
            gerencie equipes e acompanhe o progresso em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
