import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, Users, Clock, Shield } from "lucide-react";
import "./index.css";

const Index = () => {
  const navigate = useNavigate();

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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-fundo-branco rounded-full flex items-center justify-center">
              <img src="/pomo.png"  alt="" className="img" />
            </div>
            
            <span className="text-2xl font-bold">Pomo Projects</span>
          </div>
          <div className="flex gap-4 items-center">
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
         <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent pb-2">
          Gestão de Projetos Audiovisuais
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Organize, colabore e entregue seus projetos audiovisuais com eficiência.
          Tudo que você precisa em uma plataforma completa.
        </p>
        <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 py-6">
          Começar Gratuitamente
        </Button>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
            >
              <feature.icon className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="bg-primary/10 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para revolucionar sua produção?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Junte-se a centenas de profissionais que já usam nossa plataforma
          </p>
          <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 py-6">
            Criar Conta Grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-6 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 PomoProjects.  Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

