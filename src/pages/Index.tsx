import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Scattergories Online — Play Free</title>
        <meta name="description" content="Play Scattergories online with a clean, modern UI. Start a solo round now and get ready for realtime multiplayer soon." />
        <link rel="canonical" href="/" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div
          className="w-full max-w-3xl mx-auto text-center p-10 rounded-lg"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
        >
          <h1 className="text-4xl font-bold mb-4">Play Scattergories Online</h1>
          <p className="text-lg text-muted-foreground mb-8">Fast rounds, random letters, and beautiful design. Try a solo round now.</p>
          <Button asChild>
            <Link to="/game">Start a Solo Round</Link>
          </Button>
        </div>
      </div>
    </>
  );
};

export default Index;
