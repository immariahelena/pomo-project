import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Filter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeaderProps {
  onSearch?: (query: string) => void;
  onFilter?: () => void;
}

const Header = ({ onSearch, onFilter }: HeaderProps) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    let channel: any = null;
    
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(profileData);

        channel = supabase
          .channel('profile-changes')
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          }, (payload) => {
            setProfile(payload.new);
          })
          .subscribe();
      }
    };
    fetchUserData();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <header className="bg-card border-b border-border px-4 sm:px-8 py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className={`flex items-center gap-3 ${isMobile ? 'ml-14' : ''}`}>
          <div className="w-10 h-10 rounded-full overflow-hidden">
            <Avatar className="w-full h-full">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name} />}
              <AvatarFallback className="bg-primary text-primary-foreground">
                {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div>
            <p className="text-sm font-medium">
              Olá, {profile?.full_name || "Usuário"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              className="pl-10 w-full sm:w-64"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          {onFilter && (
            <Button variant="ghost" size="icon" onClick={onFilter}>
              <Filter className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
