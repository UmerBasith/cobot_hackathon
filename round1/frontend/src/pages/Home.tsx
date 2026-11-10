import { Categories, CTA, Features, Footer, Hero, HowItWorks, Impact, LiveDemo, Navbar, Problem, Team } from "@/sections/Landing";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <LiveDemo />
        <Categories />
        <Features />
        <Impact />
        <Team />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
