import { useNavigate, useLocation } from "react-router-dom";
import { Home, Video, Trophy, Bell, Settings, LogOut, Shield, HelpCircle, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchUnreadCount();

    const channel = supabase
      .channel("sidebar-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const menuItems = [
    { icon: Home, path: "/dashboard", label: "Dashboard" },
    { icon: Video, path: "/projects", label: "Projetos" },
    { icon: Trophy, path: "/achievements", label: "Conquistas" },
    { icon: Bell, path: "/notifications", label: "Notificações", badge: unreadCount },
    ...(isAdmin ? [] : [{ icon: HelpCircle, path: "/support", label: "Suporte" }]),
  ];

  const adminItems = [
    { icon: Shield, path: "/admin/users", label: "Admin" },
    { icon: HelpCircle, path: "/admin-support", label: "Tickets" },
  ];

  const SidebarContent = ({ showLabels = false }: { showLabels?: boolean }) => (
    <div className={`flex flex-col items-center py-6 space-y-4 ${showLabels ? 'items-start px-4' : ''}`}>
      {menuItems.map((item) => (
        <div key={item.path} className={`relative ${showLabels ? 'w-full' : ''}`}>
          <Button
            variant="ghost"
            size={showLabels ? "default" : "icon"}
            onClick={() => handleNavigate(item.path)}
            className={`p-3 rounded-lg transition-colors ${showLabels ? 'w-full justify-start gap-3' : ''} ${
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
            {showLabels && <span>{item.label}</span>}
          </Button>
          {item.badge && item.badge > 0 && (
            <Badge 
              className={`absolute h-5 w-5 flex items-center justify-center p-0 text-xs bg-error text-error-foreground ${
                showLabels ? 'top-2 right-2' : '-top-1 -right-1'
              }`}
            >
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </div>
      ))}
      
      {isAdmin && adminItems.map((item) => (
        <div key={item.path} className={showLabels ? 'w-full' : ''}>
          <Button
            variant="ghost"
            size={showLabels ? "default" : "icon"}
            onClick={() => handleNavigate(item.path)}
            className={`p-3 rounded-lg transition-colors ${showLabels ? 'w-full justify-start gap-3' : ''} ${
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
            {showLabels && <span>{item.label}</span>}
          </Button>
        </div>
      ))}
      
      <div className="flex-1" />
      
      <Button
        variant="ghost"
        size={showLabels ? "default" : "icon"}
        onClick={() => handleNavigate("/settings")}
        className={`p-3 hover:bg-sidebar-accent rounded-lg transition-colors ${showLabels ? 'w-full justify-start gap-3' : ''}`}
      >
        <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
        {showLabels && <span className="text-muted-foreground">Configurações</span>}
      </Button>
      
      <Button
        variant="ghost"
        size={showLabels ? "default" : "icon"}
        onClick={handleLogout}
        className={`p-3 hover:bg-destructive/10 rounded-lg transition-colors ${showLabels ? 'w-full justify-start gap-3' : ''}`}
      >
        <LogOut className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
        {showLabels && <span className="text-muted-foreground">Sair</span>}
      </Button>
    </div>
  );

  // Mobile: Show hamburger menu that opens sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="fixed top-4 left-4 z-50 bg-card shadow-md"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 bg-card">
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <img src="/pomo.png" alt="" className="w-10 h-10" />
                <span className="font-bold">Pomo Projects</span>
              </div>
            </div>
            <SidebarContent showLabels />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Show regular sidebar
  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center h-screen sticky top-0">
      <SidebarContent />
    </aside>
  );
};

export default Sidebar;
