import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Shield, Users, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";
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

type UserWithRole = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  approved: boolean;
  approved_at: string | null;
};

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    if (!roleLoading && isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, roleLoading, navigate]);

  const fetchUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase.functions.invoke('list-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setUsers(data.users);
    } catch (error: any) {
      console.error("Erro ao carregar usuários:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: error.message || "Erro desconhecido ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as "admin" | "manager" | "collaborator" | "client" })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ 
            user_id: userId, 
            role: newRole as "admin" | "manager" | "collaborator" | "client" 
          });

        if (error) throw error;
      }

      toast({
        title: "Função atualizada!",
        description: "A função do usuário foi alterada com sucesso.",
      });

      setEditingUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar função",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteUserId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Usuário removido!",
        description: "O usuário foi deletado com sucesso.",
      });

      setDeleteUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar usuário",
        description: error.message,
        variant: "destructive",
      });
      setDeleteUserId(null);
    }
  };

  const handleApproveUser = async (userId: string, approve: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("profiles")
        .update({
          approved: approve,
          approved_at: approve ? new Date().toISOString() : null,
          approved_by: approve ? user?.id : null,
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: approve ? "Usuário aprovado!" : "Aprovação revogada!",
        description: approve 
          ? "O usuário agora pode acessar o sistema." 
          : "O acesso do usuário foi revogado.",
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar aprovação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "manager":
        return "secondary";
      case "collaborator":
        return "outline";
      case "client":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "manager":
        return "Gerente";
      case "collaborator":
        return "Colaborador";
      case "client":
        return "Cliente";
      default:
        return role;
    }
  };

  const getApprovalBadge = (approved: boolean) => {
    if (approved) {
      return (
        <Badge variant="default" className="bg-green-600 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" />
          Aprovado
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-yellow-600 text-white text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Pendente
      </Badge>
    );
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (roleLoading || loading) {
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
        <Header onSearch={setSearchQuery} />

        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Gerenciamento de Usuários
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Controle os usuários e suas permissões no sistema
            </p>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Users className="h-5 w-5" />
                Usuários do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm sm:text-base">
                  {searchQuery
                    ? "Nenhum usuário encontrado com esse termo"
                    : "Nenhum usuário encontrado"}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((user) => (
                    <div 
                      key={user.id} 
                      className="p-3 sm:p-4 border rounded-lg bg-card space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {getApprovalBadge(user.approved)}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingUserId === user.id ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select
                                value={newRole || user.role}
                                onValueChange={setNewRole}
                              >
                                <SelectTrigger className="w-[140px] sm:w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                  <SelectItem value="manager">Gerente</SelectItem>
                                  <SelectItem value="collaborator">Colaborador</SelectItem>
                                  <SelectItem value="client">Cliente</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleRoleChange(user.id, newRole || user.role)}
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingUserId(null);
                                  setNewRole("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Badge
                                variant={getRoleBadgeVariant(user.role)}
                                className="cursor-pointer"
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setNewRole(user.role);
                                }}
                              >
                                {getRoleLabel(user.role)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(user.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {user.approved ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApproveUser(user.id, false)}
                              title="Revogar acesso"
                            >
                              <XCircle className="h-4 w-4 text-yellow-600" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApproveUser(user.id, true)}
                              title="Aprovar acesso"
                            >
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteUserId(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;
