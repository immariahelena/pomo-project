import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ProjectCard from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProject, setEditingProject] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    clientName: "",
    status: "planning",
    startDate: "",
    dueDate: "",
  });

  useEffect(() => {
    checkAuth();
    fetchProjects();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setCanCreate(true);
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar projetos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingProject) {
        const { error } = await supabase
          .from("projects")
          .update({
            name: formData.name,
            description: formData.description,
            client_name: formData.clientName,
            status: formData.status,
            start_date: formData.startDate || null,
            due_date: formData.dueDate || null,
          })
          .eq("id", editingProject.id);

        if (error) throw error;

        toast({
          title: "Projeto atualizado com sucesso!",
          description: "As alterações foram salvas.",
        });
      } else {
        const { error } = await supabase.from("projects").insert({
          name: formData.name,
          description: formData.description,
          client_name: formData.clientName,
          status: formData.status,
          start_date: formData.startDate || null,
          due_date: formData.dueDate || null,
          created_by: user?.id,
        });

        if (error) throw error;

        toast({
          title: "Projeto criado com sucesso!",
          description: "O projeto foi adicionado à lista.",
        });
      }

      setOpen(false);
      setEditingProject(null);
      setFormData({
        name: "",
        description: "",
        clientName: "",
        status: "planning",
        startDate: "",
        dueDate: "",
      });
      fetchProjects();
    } catch (error: any) {
      toast({
        title: editingProject ? "Erro ao atualizar projeto" : "Erro ao criar projeto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        description: project.description || "",
        clientName: project.client_name || "",
        status: project.status,
        startDate: project.start_date || "",
        dueDate: project.due_date || "",
      });
      setOpen(true);
    }
  };

  const handleDelete = (projectId: string) => {
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!projectToDelete) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Usuário não autenticado");
      }

      const { data, error } = await supabase.functions.invoke('delete-project', {
        body: { projectId: projectToDelete },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Projeto excluído com sucesso!",
        description: "O projeto foi removido da lista.",
      });

      fetchProjects();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir projeto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <Header onSearch={setSearchQuery} />

        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Projetos</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gerencie todos os seus projetos audiovisuais
              </p>
            </div>

            {canCreate && (
              <Dialog 
                open={open} 
                onOpenChange={(isOpen) => {
                  setOpen(isOpen);
                  if (!isOpen) {
                    setEditingProject(null);
                    setFormData({
                      name: "",
                      description: "",
                      clientName: "",
                      status: "planning",
                      startDate: "",
                      dueDate: "",
                    });
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2 w-full sm:w-auto">
                    <Plus className="h-4 w-4" />
                    Novo Projeto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProject ? "Editar Projeto" : "Criar Novo Projeto"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Projeto *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientName">Cliente</Label>
                        <Input
                          id="clientName"
                          value={formData.clientName}
                          onChange={(e) =>
                            setFormData({ ...formData, clientName: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) =>
                            setFormData({ ...formData, status: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning">Planejamento</SelectItem>
                            <SelectItem value="in_production">Em Produção</SelectItem>
                            <SelectItem value="in_review">Em Revisão</SelectItem>
                            <SelectItem value="completed">Finalizado</SelectItem>
                            <SelectItem value="delayed">Atrasado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Data de Início</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) =>
                            setFormData({ ...formData, startDate: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Data de Entrega</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) =>
                            setFormData({ ...formData, dueDate: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          setEditingProject(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingProject ? "Salvar Alterações" : "Criar Projeto"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.
                  Todos os dados relacionados ao projeto também serão excluídos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm sm:text-base text-muted-foreground">
                {searchQuery
                  ? "Nenhum projeto encontrado com esse termo"
                  : "Nenhum projeto cadastrado ainda"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  name={project.name}
                  clientName={project.client_name}
                  status={project.status}
                  dueDate={project.due_date}
                  description={project.description}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Projects;
