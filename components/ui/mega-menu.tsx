// component.tsx
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import * as React from "react"

export type MegaMenuItem = {
  id: number
  label: string
  subMenus?: {
    title: string
    items: {
      label: string
      description: string
      icon: React.ElementType
    }[]
  }[]
  link?: string
}

export interface MegaMenuProps extends React.HTMLAttributes<HTMLUListElement> {
  items: MegaMenuItem[]
  className?: string
}

const MegaMenu = React.forwardRef<HTMLUListElement, MegaMenuProps>(
  ({ items, className, ...props }, ref) => {
    const [openMenu, setOpenMenu] = React.useState<string | null>(null)
    const [isHover, setIsHover] = React.useState<number | null>(null)

    const handleHover = (menuLabel: string | null) => {
      setOpenMenu(menuLabel)
    }

    return (
      <ul
        ref={ref}
        className={`relative flex items-center space-x-0 ${className || ""}`}
        {...props}
      >
        {items.map((navItem) => (
          <li
            key={navItem.label}
            className="relative"
            onMouseEnter={() => handleHover(navItem.label)}
            onMouseLeave={() => handleHover(null)}
          >
            <button
              className="text-muted-foreground hover:text-foreground group relative flex cursor-pointer items-center justify-center gap-1 px-4 py-1.5 text-sm transition-colors duration-300"
              onMouseEnter={() => setIsHover(navItem.id)}
              onMouseLeave={() => setIsHover(null)}
            >
              <span>{navItem.label}</span>
              {navItem.subMenus && (
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-300 group-hover:rotate-180 ${
                    openMenu === navItem.label ? "rotate-180" : ""
                  }`}
                />
              )}
              {(isHover === navItem.id || openMenu === navItem.label) && (
                <motion.div
                  layoutId="hover-bg"
                  className="bg-muted absolute inset-0 size-full"
                  style={{
                    borderRadius: 99,
                  }}
                />
              )}
            </button>

            <AnimatePresence>
              {openMenu === navItem.label && navItem.subMenus && (
                <div className="absolute top-full left-0 z-[60] w-auto pt-2">
                  <motion.div
                    className="border-border bg-background w-max border p-4 shadow-lg"
                    style={{
                      borderRadius: 16,
                    }}
                    layoutId="menu"
                  >
                    <div className="flex w-fit shrink-0 space-x-9 overflow-hidden">
                      {navItem.subMenus.map((sub) => (
                        <motion.div layout className="w-full" key={sub.title}>
                          <h3 className="text-muted-foreground mb-4 text-sm font-medium capitalize">
                            {sub.title}
                          </h3>
                          <ul className="space-y-6">
                            {sub.items.map((item) => {
                              const Icon = item.icon
                              return (
                                <li key={item.label}>
                                  <a
                                    href="#"
                                    className="group flex items-start space-x-3"
                                  >
                                    <div className="border-border text-foreground group-hover:bg-foreground group-hover:text-background flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-300">
                                      <Icon className="h-5 w-5 flex-none" />
                                    </div>
                                    <div className="w-max leading-5">
                                      <p className="text-foreground shrink-0 text-sm font-medium">
                                        {item.label}
                                      </p>
                                      <p className="text-muted-foreground group-hover:text-foreground shrink-0 text-xs transition-colors duration-300">
                                        {item.description}
                                      </p>
                                    </div>
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    )
  }
)

MegaMenu.displayName = "MegaMenu"

export default MegaMenu
