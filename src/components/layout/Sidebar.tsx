import { useNavigate, useLocation } from "react-router-dom";
import { Home, Video, Trophy, Bell, Settings, LogOut, Shield, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [unreadCount, setUnreadCount] = useState(0);
  const { isAdmin } = useUserRole();

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to realtime notifications
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

  return (
    <aside className="w-20 bg-card border-r border-border flex flex-col items-center py-6 space-y-8">
      {menuItems.map((item) => (
        <div key={item.path} className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(item.path)}
            className={`p-3 rounded-lg transition-colors ${
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-6 w-6" />
          </Button>
          {item.badge && item.badge > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-error text-error-foreground"
            >
              {item.badge > 99 ? "99+" : item.badge}
            </Badge>
          )}
        </div>
      ))}
      
      {isAdmin && adminItems.map((item) => (
        <div key={item.path}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(item.path)}
            className={`p-3 rounded-lg transition-colors ${
              location.pathname === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-sidebar-accent"
            }`}
          >
            <item.icon className="h-6 w-6" />
          </Button>
        </div>
      ))}
      
      <div className="flex-1" />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/settings")}
        className="p-3 hover:bg-sidebar-accent rounded-lg transition-colors"
      >
        <Settings className="h-6 w-6 text-muted-foreground" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleLogout}
        className="p-3 hover:bg-destructive/10 rounded-lg transition-colors"
      >
        <LogOut className="h-6 w-6 text-muted-foreground" />
      </Button>
    </aside>
  );
};

export default Sidebar;
