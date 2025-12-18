import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  link?: string;
  created_at: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    checkAuth();
    fetchNotifications();

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar notificações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

      if (error) throw error;
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Erro ao marcar como lida",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Todas as notificações foram marcadas como lidas",
      });
      
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✅";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      default:
        return "ℹ️";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter(
    (notification) =>
      notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto w-full">
        <Header onSearch={setSearchQuery} />

        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Notificações</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {unreadCount > 0
                  ? `Você tem ${unreadCount} notificação${unreadCount > 1 ? "ões" : ""} não lida${unreadCount > 1 ? "s" : ""}`
                  : "Você não tem notificações não lidas"}
              </p>
            </div>

            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" className="gap-2 w-full sm:w-auto">
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Marcar todas como lidas</span>
                <span className="sm:hidden">Marcar todas</span>
              </Button>
            )}
          </div>

          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16">
                <Bell className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <p className="text-sm sm:text-lg text-muted-foreground text-center">
                  {searchQuery
                    ? "Nenhuma notificação encontrada com esse termo"
                    : "Nenhuma notificação ainda"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-colors ${
                    !notification.read ? "bg-primary/5 border-primary/20" : ""
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    if (notification.link) {
                      navigate(notification.link);
                    }
                  }}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <span className="text-xl sm:text-2xl">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold mb-1 text-sm sm:text-base">
                              {notification.title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Notifications;
