import { useNavigate } from "@solidjs/router"
import { useCommand } from "@/context/command"
import { useLanguage } from "@/context/language"

export function SwarmCommand() {
  const command = useCommand()
  const language = useLanguage()
  const navigate = useNavigate()

  command.register("swarm", () => [
    {
      id: "swarm.new",
      title: language.t("swarm.new"),
      category: language.t("swarm.title"),
      onSelect: () => navigate("/swarm/new"),
    },
  ])

  return null
}
