import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    role: "",
    avatar_url: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      setProfile({
        full_name: profileData?.full_name || "",
        email: user.email || "",
        role: rolesData?.role || "collaborator",
        avatar_url: profileData?.avatar_url || "",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro",
          description: "Por favor, selecione uma imagem válida",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Erro",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${user.id}/${oldPath}`]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });

      toast({
        title: "Avatar atualizado!",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto w-full">
        <Header />

        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-4xl">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Configurações</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie suas informações pessoais e preferências
            </p>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Perfil</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl sm:text-2xl">
                    {profile.full_name[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left">
                  <p className="font-medium">{profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <div className="mt-2">
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        asChild
                      >
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Enviando..." : "Alterar foto"}
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Input
                    id="role"
                    value={profile.role}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Entre em contato com um administrador para alterar sua função
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full sm:w-auto">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
