import * as React from "react"
import { cn } from "@/lib/utils"

const SidebarContext = React.createContext({ open: true, setOpen: () => {} })

export function SidebarProvider({ children, defaultOpen = true, className, ...props }) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <div className={cn("min-h-screen w-full", className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({ className, children, ...props }) {
  const { open } = React.useContext(SidebarContext)
  return (
    <aside
      data-state={open ? "open" : "closed"}
      data-app-sidebar
      className={cn(
        // Stack header/content vertically and keep a fixed width. Display is
        // controlled by Layout (`hidden md:flex`); without `flex-col` that
        // `md:flex` defaulted to row layout, which crushed the menu into a
        // thin column (labels showed as "Hor", "Bib Rea", ...). `shrink-0`
        // stops wide page content from squeezing the sidebar below its
        // w-64/w-16 width. `overflow-hidden` + the `group/sidebar` marker let
        // the collapsed (w-16) state hide labels instead of overflowing.
        "group/sidebar flex-col shrink-0 h-screen overflow-hidden border-r bg-background text-sm transition-all duration-200 ease-in-out",
        open ? "w-64" : "w-16",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

export function SidebarHeader({ className, ...props }) {
  return <div className={cn("overflow-hidden p-3 border-b", className)} {...props} />
}

export function SidebarContent({ className, ...props }) {
  return <div data-sidebar-content className={cn("flex-1 min-h-0 p-2 overflow-y-auto overflow-x-hidden", className)} {...props} />
}

export function SidebarMenu({ className, ...props }) {
  return <ul className={cn("space-y-1", className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }) {
  return <li className={cn("", className)} {...props} />
}

export const SidebarMenuButton = React.forwardRef(
  ({ className, asChild = false, isActive = false, children, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button"
    const innerClass = cn(
      "flex min-w-0 items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent text-left transition-colors",
      "[&>svg]:shrink-0 [&>span]:min-w-0 [&>span]:truncate",
      "group-data-[state=closed]/sidebar:justify-center group-data-[state=closed]/sidebar:px-0 group-data-[state=closed]/sidebar:[&>span]:hidden",
      isActive && "bg-accent text-accent-foreground",
      className
    )
    if (asChild) {
      return (
        <span ref={ref} className={innerClass} {...props}>
          {children}
        </span>
      )
    }
    return (
      <Comp ref={ref} className={innerClass} {...props}>
        {children}
      </Comp>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

export function SidebarTrigger({ className, ...props }) {
  const { open, setOpen } = React.useContext(SidebarContext)
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent",
        className
      )}
      aria-label="Toggle sidebar"
      {...props}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    </button>
  )
}

export default Sidebar
