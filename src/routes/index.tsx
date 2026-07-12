import { createFileRoute } from "@tanstack/react-router";
import { PantryScreen } from "@/components/frigg/PantryScreen";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <PantryScreen />;
}
