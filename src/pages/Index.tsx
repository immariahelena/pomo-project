import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, Users, Clock, Shield, Menu, X } from "lucide-react";
import "./index.css";

const Index = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: Video,
      title: "Gestão de Projetos",
      description: "Organize todos os seus projetos audiovisuais em um só lugar",
    },
    {
      icon: Users,
      title: "Colaboração em Equipe",
      description: "Trabalhe junto com sua equipe de forma eficiente",
    },
    {
      icon: Clock,
      title: "Controle de Prazos",
      description: "Acompanhe deadlines e mantenha tudo no prazo",
    },
    {
      icon: Shield,
      title: "Seguro e Confiável",
      description: "Seus dados protegidos com segurança de ponta",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-fundo-branco rounded-full flex items-center justify-center">
              <img src="/pomo.png" alt="" className="img" />
            </div>
            <span className="text-xl sm:text-2xl font-bold">Pomo Projects</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-4 items-center">
            <Button variant="ghost" onClick={() => navigate("/about")}>
              Sobre Nós
            </Button>
            <Button variant="ghost" onClick={() => navigate("/contact")}>
              Contato
            </Button>
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Começar Agora
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-4 space-y-2">
            <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/about"); setMobileMenuOpen(false); }}>
              Sobre Nós
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/contact"); setMobileMenuOpen(false); }}>
              Contato
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
              Entrar
            </Button>
            <Button className="w-full" onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}>
              Começar Agora
            </Button>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-2">
          Gestão de Projetos Audiovisuais
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto">
          Organize, colabore e entregue seus projetos audiovisuais com eficiência.
          Tudo que você precisa em uma plataforma completa.
        </p>
        <Button size="lg" onClick={() => navigate("/auth")} className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6">
          Começar Gratuitamente
        </Button>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-4 sm:p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
            >
              <feature.icon className="h-10 w-10 sm:h-12 sm:w-12 text-primary mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm sm:text-base text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
        <div className="bg-primary/10 rounded-xl sm:rounded-2xl p-6 sm:p-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">
            Pronto para revolucionar sua produção?
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
            Junte-se a centenas de profissionais que já usam nossa plataforma
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6">
            Criar Conta Grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 text-center text-muted-foreground">
          <p className="text-sm sm:text-base">&copy; 2025 PomoProjects. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
