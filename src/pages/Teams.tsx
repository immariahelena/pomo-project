import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Users, Plus, Trash2, UserPlus, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

interface Team {
  id: string;
  name: string;
  description: string | null;
  manager_id: string;
  created_at: string;
  member_count?: number;
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
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

const Teams = () => {
  const { toast } = useToast();
  const { canManageProjects, isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  // Form states
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  useEffect(() => {
    if (!roleLoading && !canManageProjects) {
      navigate("/dashboard");
      return;
    }
    fetchTeams();
  }, [roleLoading, canManageProjects]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch member count for each team
      const teamsWithCount = await Promise.all(
        (data || []).map(async (team) => {
          const { count } = await supabase
            .from("team_members")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);

          return { ...team, member_count: count || 0 };
        })
      );

      setTeams(teamsWithCount);
    } catch (error: any) {
      console.error("Erro ao buscar equipes:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", teamId);

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

      setTeamMembers(membersWithProfiles);
      await fetchAvailableUsers(membersWithProfiles, teamId);
    } catch (error: any) {
      console.error("Erro ao buscar membros:", error);
    }
  };

  const fetchAvailableUsers = async (currentMembers: TeamMember[], teamId: string) => {
    try {
      // Get all collaborators (users with collaborator role)
      const { data: collaboratorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "collaborator");

      if (rolesError) throw rolesError;

      if (!collaboratorRoles || collaboratorRoles.length === 0) {
        setAvailableUsers([]);
        return;
      }

      const collaboratorIds = collaboratorRoles.map(r => r.user_id);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", collaboratorIds)
        .order("full_name");

      if (error) throw error;

      // Filter out users who are already members
      const memberIds = currentMembers.map(m => m.user_id);
      const available = (data || []).filter(user => !memberIds.includes(user.id));

      setAvailableUsers(available);
    } catch (error: any) {
      console.error("Erro ao buscar usuários disponíveis:", error);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("teams").insert({
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || null,
        manager_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Equipe criada",
        description: `A equipe "${newTeamName}" foi criada com sucesso.`,
      });

      setCreateDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
      fetchTeams();
    } catch (error: any) {
      toast({
        title: "Erro ao criar equipe",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamId) return;

    try {
      const { error } = await supabase
        .from("teams")
        .delete()
        .eq("id", deleteTeamId);

      if (error) throw error;

      toast({
        title: "Equipe excluída",
        description: "A equipe foi excluída com sucesso.",
      });

      setDeleteTeamId(null);
      if (selectedTeam?.id === deleteTeamId) {
        setSelectedTeam(null);
        setTeamMembers([]);
      }
      fetchTeams();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir equipe",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId || !selectedTeam) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("team_members").insert({
        team_id: selectedTeam.id,
        user_id: selectedUserId,
        added_by: user?.id,
      });

      if (error) throw error;

      const addedUser = availableUsers.find(u => u.id === selectedUserId);
      toast({
        title: "Membro adicionado",
        description: `${addedUser?.full_name} foi adicionado à equipe.`,
      });

      setAddMemberDialogOpen(false);
      setSelectedUserId("");
      fetchTeamMembers(selectedTeam.id);
      fetchTeams();
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
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", removeMemberId);

      if (error) throw error;

      toast({
        title: "Membro removido",
        description: "O membro foi removido da equipe.",
      });

      setRemoveMemberId(null);
      if (selectedTeam) {
        fetchTeamMembers(selectedTeam.id);
        fetchTeams();
      }
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

  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team);
    fetchTeamMembers(team.id);
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">Minhas Equipes</h1>
                <p className="text-muted-foreground">
                  Gerencie suas equipes e colaboradores
                </p>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nova Equipe
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Equipe</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Nome da Equipe</Label>
                      <Input
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Ex: Equipe de Produção"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição (opcional)</Label>
                      <Textarea
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        placeholder="Descreva o propósito desta equipe..."
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>
                        Criar Equipe
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Teams List */}
              <div className="lg:col-span-1 space-y-4">
                <h2 className="text-lg font-semibold">Equipes</h2>
                {loading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : teams.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Você ainda não tem equipes.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Crie uma equipe para começar a adicionar colaboradores.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  teams.map((team) => (
                    <Card
                      key={team.id}
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedTeam?.id === team.id ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => handleSelectTeam(team)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">{team.name}</h3>
                            {team.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {team.description}
                              </p>
                            )}
                            <Badge variant="secondary" className="mt-2">
                              {team.member_count} {team.member_count === 1 ? "membro" : "membros"}
                            </Badge>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTeamId(team.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Team Members */}
              <div className="lg:col-span-2">
                {selectedTeam ? (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>{selectedTeam.name}</CardTitle>
                        {selectedTeam.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedTeam.description}
                          </p>
                        )}
                      </div>
                      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            Adicionar Membro
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Selecione um colaborador</Label>
                              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um colaborador" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableUsers.length === 0 ? (
                                    <SelectItem value="none" disabled>
                                      Nenhum colaborador disponível
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
                              <p className="text-xs text-muted-foreground">
                                Apenas usuários com função "Colaborador" podem ser adicionados.
                              </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                              <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleAddMember} disabled={!selectedUserId}>
                                Adicionar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {teamMembers.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          Nenhum membro adicionado ainda.
                        </p>
                      ) : (
                        teamMembers.map((member) => (
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
                                <p className="font-medium">
                                  {member.profile?.full_name || "Usuário"}
                                </p>
                                <p className="text-xs text-muted-foreground">Colaborador</p>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setRemoveMemberId(member.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Selecione uma equipe para ver os membros
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Delete Team Dialog */}
      <AlertDialog open={!!deleteTeamId} onOpenChange={() => setDeleteTeamId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta equipe? Todos os membros serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!removeMemberId} onOpenChange={() => setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro da equipe?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Teams;
