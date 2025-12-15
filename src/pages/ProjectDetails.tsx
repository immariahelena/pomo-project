import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Calendar, User, MessageSquare, Send, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileLinkManager } from "@/components/projects/FileLinkManager";
import { ActivityLog } from "@/components/projects/ActivityLog";
import { ProjectMembers } from "@/components/projects/ProjectMembers";
import { z } from "zod";

const statusColors = {
  planning: { bg: "bg-secondary", text: "text-secondary-foreground", label: "Planejamento" },
  in_production: { bg: "bg-warning", text: "text-warning-foreground", label: "Em Produção" },
  in_review: { bg: "bg-primary", text: "text-primary-foreground", label: "Em Revisão" },
  completed: { bg: "bg-success", text: "text-success-foreground", label: "Finalizado" },
  delayed: { bg: "bg-error", text: "text-error-foreground", label: "Atrasado" },
};

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    assigned_to: "",
    due_date: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editMessageContent, setEditMessageContent] = useState("");
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchProjectDetails();
    fetchTasks();
    fetchMessages();
    fetchProfiles();

    // Subscribe to real-time messages
    const messagesChannel = supabase
      .channel(`project-${id}-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${id}`,
        },
        (payload) => {
          fetchMessages();
        }
      )
      .subscribe();

    // Subscribe to real-time tasks updates
    const tasksChannel = supabase
      .channel(`project-${id}-tasks`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${id}`,
        },
        (payload) => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setCurrentUser(session.user);
  };

  const fetchProjectDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setProject(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar projeto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Buscar perfis dos usuários atribuídos
      const tasksWithProfiles = await Promise.all(
        (data || []).map(async (task) => {
          if (task.assigned_to) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", task.assigned_to)
              .single();
            
            return { ...task, profiles: profile };
          }
          return task;
        })
      );
      
      setTasks(tasksWithProfiles);
    } catch (error: any) {
      console.error("Erro ao carregar tarefas:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar mensagens:", error);
        throw error;
      }
      
      console.log("Mensagens carregadas:", data);
      setMessages(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar mensagens:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchProfiles = async () => {
    try {
      // Buscar membros do projeto
      const { data: members, error: membersError } = await supabase
        .from("project_members")
        .select("user_id")
        .eq("project_id", id);

      if (membersError) throw membersError;

      // Buscar criador do projeto
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("created_by")
        .eq("id", id)
        .single();

      if (projectError) throw projectError;

      // Combinar IDs únicos: criador + membros
      const memberIds = members?.map(m => m.user_id) || [];
      const allIds = [...new Set([projectData.created_by, ...memberIds])];

      if (allIds.length === 0) {
        setProfiles([]);
        return;
      }

      // Buscar perfis apenas dos membros do projeto
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", allIds)
        .order("full_name");

      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);
    } catch (error: any) {
      console.error("Erro ao carregar perfis:", error);
    }
  };

  const taskSchema = z.object({
    title: z.string().trim().min(1, "Título é obrigatório").max(200, "Título muito longo"),
    description: z.string().trim().max(1000, "Descrição muito longa").optional(),
    status: z.enum(["todo", "in_progress", "completed"]),
    priority: z.enum(["low", "medium", "high"]),
    assigned_to: z.string().uuid().optional().or(z.literal("")),
    due_date: z.string().optional(),
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({
        title: "Erro de autenticação",
        description: "Você precisa estar logado para criar tarefas.",
        variant: "destructive",
      });
      return;
    }

    try {
      const validatedData = taskSchema.parse(taskForm);

      if (editingTask) {
        // Atualizar tarefa existente
        const { error } = await supabase
          .from("tasks")
          .update({
            title: validatedData.title,
            description: validatedData.description || null,
            status: validatedData.status,
            priority: validatedData.priority,
            assigned_to: validatedData.assigned_to || null,
            due_date: validatedData.due_date || null,
          })
          .eq("id", editingTask.id);

        if (error) throw error;

        toast({
          title: "Tarefa atualizada!",
          description: "A tarefa foi atualizada com sucesso.",
        });
      } else {
        // Criar nova tarefa
        const { error } = await supabase.from("tasks").insert({
          project_id: id,
          title: validatedData.title,
          description: validatedData.description || null,
          status: validatedData.status,
          priority: validatedData.priority,
          stage_id: null,
          assigned_to: validatedData.assigned_to || null,
          due_date: validatedData.due_date || null,
          created_by: currentUser.id,
        });

        if (error) throw error;

        toast({
          title: "Tarefa criada com sucesso!",
          description: "A tarefa foi adicionada ao projeto.",
        });
      }

      setTaskDialogOpen(false);
      setEditingTask(null);
      setTaskForm({
        title: "",
        description: "",
        status: "todo",
        priority: "medium",
        assigned_to: "",
        due_date: "",
      });
      fetchTasks();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Erro ao salvar tarefa:", error);
        toast({
          title: editingTask ? "Erro ao atualizar tarefa" : "Erro ao criar tarefa",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to || "",
      due_date: task.due_date || "",
    });
    setTaskDialogOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", deleteTaskId);

      if (error) throw error;

      toast({
        title: "Tarefa excluída",
        description: "A tarefa foi removida com sucesso.",
      });

      setDeleteTaskId(null);
      fetchTasks();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCloseTaskDialog = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
    setTaskForm({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assigned_to: "",
      due_date: "",
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    try {
      const { data: newMessageData, error } = await supabase
        .from("messages")
        .insert({
          project_id: id,
          user_id: currentUser.id,
          content: messageContent,
        })
        .select()
        .single();

      if (error) throw error;

      // Adiciona a mensagem imediatamente à lista local
      if (newMessageData) {
        setMessages((prev) => [newMessageData, ...prev]);
      }

      // Create notification
      await supabase.from("notifications").insert({
        user_id: currentUser.id,
        title: "Nova atualização no projeto",
        message: `Nova comunicação adicionada ao projeto: ${project.name}`,
        type: "info",
        link: `/projects/${id}`,
      });

      toast({
        title: "Atualização adicionada",
        description: "Comunicação registrada no projeto",
      });
    } catch (error: any) {
      setNewMessage(messageContent);
      toast({
        title: "Erro ao adicionar atualização",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = (message: any) => {
    setEditingMessage(message);
    setEditMessageContent(message.content);
  };

  const handleUpdateMessage = async () => {
    if (!editMessageContent.trim() || !editingMessage) return;

    try {
      const { error } = await supabase
        .from("messages")
        .update({ content: editMessageContent })
        .eq("id", editingMessage.id);

      if (error) throw error;

      fetchMessages();
      setEditingMessage(null);
      setEditMessageContent("");

      toast({
        title: "Mensagem atualizada",
        description: "A comunicação foi atualizada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar mensagem",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async () => {
    if (!deleteMessageId) return;

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", deleteMessageId);

      if (error) throw error;

      fetchMessages();
      setDeleteMessageId(null);

      toast({
        title: "Mensagem excluída",
        description: "A comunicação foi removida com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao excluir mensagem",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Projeto não encontrado</p>
          <Button onClick={() => navigate("/projects")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const statusInfo = statusColors[project.status as keyof typeof statusColors];

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <Header onSearch={setSearchQuery} />

        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{project.name}</h1>
                <Badge className={`${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </Badge>
              </div>
              {project.description && (
                <p className="text-muted-foreground mt-2">{project.description}</p>
              )}
            </div>
          </div>

          {/* Project Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {project.client_name || "Não informado"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Início
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {project.start_date
                    ? format(new Date(project.start_date), "dd/MM/yyyy", { locale: ptBR })
                    : "Não definida"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {project.due_date
                    ? format(new Date(project.due_date), "dd/MM/yyyy", { locale: ptBR })
                    : "Não definida"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="team">Equipe</TabsTrigger>
              <TabsTrigger value="tasks">Tarefas ({filteredTasks.length})</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="activity">Atividades</TabsTrigger>
              <TabsTrigger value="communication">
                <MessageSquare className="h-4 w-4 mr-2" />
                Comunicação
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Resumo do Projeto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Descrição</h3>
                    <p className="text-muted-foreground">
                      {project.description || "Sem descrição"}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Estatísticas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold">{tasks.length}</p>
                        <p className="text-sm text-muted-foreground">Tarefas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{messages.length}</p>
                        <p className="text-sm text-muted-foreground">Mensagens</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="team">
              <ProjectMembers projectId={id!} projectOwnerId={project.created_by} />
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4">
              <div className="flex justify-end mb-4">
                <Dialog open={taskDialogOpen} onOpenChange={(open) => {
                  if (open) {
                    setTaskDialogOpen(true);
                  } else {
                    handleCloseTaskDialog();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" onClick={() => setTaskDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Nova Tarefa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTask ? "Editar Tarefa" : "Criar Nova Tarefa"}
                      </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateTask} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-title">Título *</Label>
                        <Input
                          id="task-title"
                          value={taskForm.title}
                          onChange={(e) =>
                            setTaskForm({ ...taskForm, title: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-description">Descrição</Label>
                        <Textarea
                          id="task-description"
                          value={taskForm.description}
                          onChange={(e) =>
                            setTaskForm({ ...taskForm, description: e.target.value })
                          }
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-assigned">Atribuir a</Label>
                        <Select
                          value={taskForm.assigned_to || "unassigned"}
                          onValueChange={(value) =>
                            setTaskForm({ ...taskForm, assigned_to: value === "unassigned" ? "" : value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um usuário" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Ninguém</SelectItem>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                          </Select>
                        </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="task-status">Status</Label>
                          <Select
                            value={taskForm.status}
                            onValueChange={(value) =>
                              setTaskForm({ ...taskForm, status: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">A Fazer</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="completed">Concluída</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-priority">Prioridade</Label>
                          <Select
                            value={taskForm.priority}
                            onValueChange={(value) =>
                              setTaskForm({ ...taskForm, priority: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Baixa</SelectItem>
                              <SelectItem value="medium">Média</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-due-date">Prazo</Label>
                          <Input
                            id="task-due-date"
                            type="date"
                            value={taskForm.due_date}
                            onChange={(e) =>
                              setTaskForm({ ...taskForm, due_date: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCloseTaskDialog}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit">
                          {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {filteredTasks.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-muted-foreground">
                      {searchQuery ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa criada ainda"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold">{task.title}</h3>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.description}
                            </p>
                          )}
                          {task.profiles && (
                            <p className="text-sm text-muted-foreground mt-2">
                              Atribuído a: {task.profiles.full_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{task.status}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditTask(task)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTaskId(task.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              
              <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTask}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            <TabsContent value="links">
              <FileLinkManager projectId={id!} />
            </TabsContent>

            <TabsContent value="activity">
              <ActivityLog projectId={id!} />
            </TabsContent>

            <TabsContent value="communication">
              <Card className="h-[600px] flex flex-col">
                <CardHeader>
                  <CardTitle>Atualizações e Comunicações</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                    {messages.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhuma atualização ainda. Adicione a primeira comunicação!
                      </p>
                    ) : (
                      messages.map((message) => (
                        <Card key={message.id} className="border-l-4 border-l-primary">
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm flex-1">{message.content}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(message.created_at), "dd/MM/yy HH:mm", {
                                    locale: ptBR,
                                  })}
                                </p>
                                {currentUser?.id === message.user_id && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => handleEditMessage(message)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7"
                                      onClick={() => setDeleteMessageId(message.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Adicione uma atualização sobre o projeto..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      rows={2}
                    />
                    <Button onClick={handleSendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Edit Message Dialog */}
              <Dialog open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Editar Mensagem</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      value={editMessageContent}
                      onChange={(e) => setEditMessageContent(e.target.value)}
                      rows={4}
                      placeholder="Edite sua mensagem..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingMessage(null);
                          setEditMessageContent("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={handleUpdateMessage}>
                        Salvar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Delete Message Dialog */}
              <AlertDialog open={!!deleteMessageId} onOpenChange={(open) => !open && setDeleteMessageId(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteMessage}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default ProjectDetails;
