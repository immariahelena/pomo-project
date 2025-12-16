import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, Users, Heart, Zap } from "lucide-react";

const About = () => {
  const navigate = useNavigate();

  const values = [
    {
      icon: Target,
      title: "Missão",
      description: "Simplificar a gestão de projetos audiovisuais, proporcionando ferramentas eficientes para profissionais criativos.",
    },
    {
      icon: Users,
      title: "Colaboração",
      description: "Facilitamos o trabalho em equipe, conectando pessoas e ideias para criar projetos extraordinários.",
    },
    {
      icon: Heart,
      title: "Paixão",
      description: "Somos apaixonados por audiovisual e tecnologia, e isso reflete em cada funcionalidade da plataforma.",
    },
    {
      icon: Zap,
      title: "Inovação",
      description: "Buscamos constantemente novas formas de melhorar a produtividade e criatividade dos nossos usuários.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <img src="/pomo.png" alt="Pomo Projects" className="w-10 h-10" />
            </div>
            <span className="text-2xl font-bold">Pomo Projects</span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Sobre Nós
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Somos uma plataforma dedicada a transformar a maneira como profissionais audiovisuais 
            gerenciam seus projetos, facilitando a colaboração e aumentando a produtividade.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card border border-border rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl font-bold mb-6">Nossa História</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                A Pomo Projects nasceu da necessidade de profissionais da indústria audiovisual 
                que buscavam uma solução completa e intuitiva para gerenciar seus projetos.
              </p>
              <p>
                Percebemos que as ferramentas existentes não atendiam às demandas específicas 
                do setor audiovisual, com suas particularidades de workflow, prazos apertados 
                e necessidade constante de colaboração entre equipes diversas.
              </p>
              <p>
                Desde então, temos nos dedicado a desenvolver uma plataforma que não apenas 
                organiza tarefas, mas que realmente compreende o processo criativo e as 
                necessidades únicas de cada projeto audiovisual.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Nossos Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => (
              <div
                key={value.title}
                className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow"
              >
                <value.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-primary/10 rounded-2xl p-12">
            <h2 className="text-3xl font-bold mb-4">
              Faça Parte da Nossa Comunidade
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Junte-se a centenas de profissionais que já transformaram sua forma de trabalhar
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8 py-6">
              Começar Gratuitamente
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-6 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 PomoProjects. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default About;
