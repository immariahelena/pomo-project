import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Users, UserPlus, Trash2, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

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

export const ProjectMembers = ({ projectId, projectOwnerId }: ProjectMembersProps) => {
  const { toast } = useToast();
  const { canManageProjects } = useUserRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("collaborator");
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<AvailableUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchMembers();
    fetchOwnerProfile();
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

      // Fetch profiles for each member
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
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");

      if (error) throw error;

      // Filter out users who are already members or the owner
      const memberIds = currentMembers.map(m => m.user_id);
      const available = (data || []).filter(
        user => !memberIds.includes(user.id) && user.id !== projectOwnerId
      );

      setAvailableUsers(available);
    } catch (error: any) {
      console.error("Erro ao buscar usuários disponíveis:", error);
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

      // Notify the new member
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

      // Notify the removed member
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Membro ao Projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Selecione um usuário</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhum usuário disponível
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
                  <p className="text-xs text-muted-foreground">
                    Colaboradores podem interagir com tarefas e comunicações. Visualizadores apenas visualizam.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddMember} disabled={!selectedUserId}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Owner */}
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

        {/* Members */}
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
