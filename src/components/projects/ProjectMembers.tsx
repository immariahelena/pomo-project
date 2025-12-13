import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Users, UserPlus, Trash2, Crown, Link, Copy, Check, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectMembersProps {
  projectId: string;
  projectOwnerId: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface AvailableUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Invitation {
  id: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export const ProjectMembers = ({ projectId, projectOwnerId }: ProjectMembersProps) => {
  const { toast } = useToast();
  const { canManageProjects } = useUserRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("collaborator");
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<AvailableUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
    fetchMembers();
    fetchOwnerProfile();
    fetchInvitations();
  }, [projectId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchOwnerProfile = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", projectOwnerId)
        .single();
      
      if (data) {
        setOwnerProfile(data);
      }
    } catch (error) {
      console.error("Erro ao buscar perfil do dono:", error);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId);

      if (error) throw error;

      const membersWithProfiles = await Promise.all(
        (data || []).map(async (member) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", member.user_id)
            .single();
          
          return { ...member, profile };
        })
      );

      setMembers(membersWithProfiles);
      await fetchAvailableUsers(membersWithProfiles);
    } catch (error: any) {
      console.error("Erro ao buscar membros:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async (currentMembers: Member[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isAdmin = roleData?.role === 'admin';
      let availableProfiles: AvailableUser[] = [];

      if (isAdmin) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .order("full_name");

        if (error) throw error;
        availableProfiles = data || [];
      } else {
        const { data: teamUserIds, error: teamError } = await supabase
          .rpc('get_team_users_for_manager', { _manager_id: user.id });

        if (teamError) {
          console.error("Erro ao buscar usuários da equipe:", teamError);
          setAvailableUsers([]);
          return;
        }

        if (teamUserIds && teamUserIds.length > 0) {
          const userIds = teamUserIds.map((r: { user_id: string }) => r.user_id);
          const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", userIds)
            .order("full_name");

          if (error) throw error;
          availableProfiles = data || [];
        }
      }

      const memberIds = currentMembers.map(m => m.user_id);
      const available = availableProfiles.filter(
        user => !memberIds.includes(user.id) && user.id !== projectOwnerId
      );

      setAvailableUsers(available);
    } catch (error: any) {
      console.error("Erro ao buscar usuários disponíveis:", error);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from("project_invitations")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar convites:", error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("project_members")
        .insert({
          project_id: projectId,
          user_id: selectedUserId,
          role: selectedRole,
          added_by: user?.id,
        });

      if (error) throw error;

      const selectedUser = availableUsers.find(u => u.id === selectedUserId);
      await supabase.from("notifications").insert({
        user_id: selectedUserId,
        title: "Você foi adicionado a um projeto",
        message: `Você foi adicionado como ${selectedRole === 'collaborator' ? 'colaborador' : 'visualizador'} em um projeto.`,
        type: "info",
        link: `/projects/${projectId}`,
      });

      toast({
        title: "Membro adicionado",
        description: `${selectedUser?.full_name} foi adicionado ao projeto.`,
      });

      setDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("collaborator");
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar membro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberId) return;

    try {
      const memberToRemove = members.find(m => m.id === removeMemberId);
      
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("id", removeMemberId);

      if (error) throw error;

      if (memberToRemove) {
        await supabase.from("notifications").insert({
          user_id: memberToRemove.user_id,
          title: "Você foi removido de um projeto",
          message: "Você foi removido de um projeto.",
          type: "info",
        });
      }

      toast({
        title: "Membro removido",
        description: "O membro foi removido do projeto.",
      });

      setRemoveMemberId(null);
      fetchMembers();
    } catch (error: any) {
      toast({
        title: "Erro ao remover membro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateInviteLink = async () => {
    setGeneratingLink(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("project_invitations")
        .insert({
          project_id: projectId,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Link gerado!",
        description: "O link de convite foi criado com sucesso.",
      });

      fetchInvitations();
      
      const inviteUrl = `${window.location.origin}/invite/${data.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken(data.token);
      setTimeout(() => setCopiedToken(null), 3000);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar link",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyInviteLink = async (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    toast({
      title: "Link copiado!",
      description: "O link de convite foi copiado para a área de transferência.",
    });
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from("project_invitations")
        .update({ status: "revoked" })
        .eq("id", invitationId);

      if (error) throw error;

      toast({
        title: "Convite revogado",
        description: "O link de convite foi invalidado.",
      });

      fetchInvitations();
    } catch (error: any) {
      toast({
        title: "Erro ao revogar convite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatExpirationDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const isOwner = currentUserId === projectOwnerId;
  const canManage = canManageProjects || isOwner;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Equipe do Projeto
        </CardTitle>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Colaborador</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="team" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="team">Da Equipe</TabsTrigger>
                  <TabsTrigger value="invite">Por Link</TabsTrigger>
                </TabsList>
                
                <TabsContent value="team" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Selecione um usuário da sua equipe</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um usuário" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Nenhum usuário disponível na sua equipe
                          </SelectItem>
                        ) : (
                          availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {availableUsers.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Adicione usuários à sua equipe na página de Equipes ou use o convite por link.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Função no projeto</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collaborator">Colaborador</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddMember} disabled={!selectedUserId}>
                      Adicionar
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="invite" className="space-y-4 pt-4">
                  <div className="text-center space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <Link className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Gere um link de convite para compartilhar com qualquer pessoa. 
                        O link expira em 7 dias.
                      </p>
                    </div>
                    
                    <Button 
                      onClick={handleGenerateInviteLink} 
                      className="w-full gap-2"
                      disabled={generatingLink}
                    >
                      <Link className="h-4 w-4" />
                      {generatingLink ? "Gerando..." : "Gerar Link de Convite"}
                    </Button>

                    {invitations.length > 0 && (
                      <div className="space-y-2 pt-4 border-t">
                        <p className="text-sm font-medium text-left">Links ativos:</p>
                        {invitations.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>Expira em {formatExpirationDate(inv.expires_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleCopyInviteLink(inv.token)}
                              >
                                {copiedToken === inv.token ? (
                                  <Check className="h-3 w-3 text-success" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => handleRevokeInvitation(inv.id)}
                              >
                                <XCircle className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {ownerProfile && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={ownerProfile.avatar_url || undefined} />
                <AvatarFallback>{getInitials(ownerProfile.full_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{ownerProfile.full_name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Crown className="h-3 w-3 text-warning" />
                  Gestor do Projeto
                </div>
              </div>
            </div>
            <Badge variant="secondary">Dono</Badge>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground py-4">Carregando...</p>
        ) : members.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhum colaborador adicionado ainda.
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={member.profile?.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.profile ? getInitials(member.profile.full_name) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.profile?.full_name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === "collaborator" ? "Colaborador" : "Visualizador"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {member.role === "collaborator" ? "Colaborador" : "Visualizador"}
                </Badge>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRemoveMemberId(member.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <AlertDialog open={!!removeMemberId} onOpenChange={() => setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro do projeto? Ele perderá o acesso ao projeto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
