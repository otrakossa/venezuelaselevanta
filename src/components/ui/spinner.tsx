import { cn } from "@/lib/utils"
import { HeartbeatLoader } from "@/components/HeartbeatLoader"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <HeartbeatLoader
      className={cn("size-4", className)}
      {...(props as React.ComponentProps<"svg">)}
    />
  )
}

export { Spinner }
