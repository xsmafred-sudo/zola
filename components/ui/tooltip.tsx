"use client"

import type { TooltipProps as TooltipPrimitiveProps } from "react-aria-components"
import {
  Button,
  composeRenderProps,
  OverlayArrow,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "react-aria-components"
import { twJoin } from "tailwind-merge"
import type { VariantProps } from "tailwind-variants"
import { tv } from "tailwind-variants"

const tooltipStyles = tv({
  base: [
    "group max-w-sm origin-(--trigger-anchor-point) rounded-lg border border-(--tooltip-border) px-2.5 py-1.5 text-sm/6 will-change-transform [--tooltip-border:var(--color-muted-fg)]/30 dark:shadow-none *:[strong]:font-medium",
  ],
  variants: {
    inverse: {
      true: [
        "border-transparent bg-fg text-bg",
        "**:[.text-muted-fg]:text-bg/60",
      ],
      false: "bg-overlay text-overlay-fg",
    },
    isEntering: {
      true: [
        "fade-in animate-in",
        "placement-left:slide-in-from-right-1 placement-right:slide-in-from-left-1 placement-top:slide-in-from-bottom-1 placement-bottom:slide-in-from-top-1",
      ],
    },
    isExiting: {
      true: [
        "fade-in direction-reverse animate-in",
        "placement-left:slide-out-to-right-1 placement-right:slide-out-to-left-1 placement-top:slide-out-to-bottom-1 placement-bottom:slide-out-to-top-1",
      ],
    },
  },
  defaultVariants: {
    inverse: false,
  },
})

interface TooltipProps
  extends React.ComponentProps<typeof TooltipTriggerPrimitive> {
  delayDuration?: number
  tooltip?: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

const Tooltip = ({
  delayDuration,
  tooltip,
  side,
  className,
  children,
  ...props
}: TooltipProps) => {
  const placement = side ? `${side} center` : undefined
  return (
    <TooltipTriggerPrimitive delay={delayDuration} {...props}>
      {children}
      {tooltip && (
        <TooltipPrimitive
          placement={placement as TooltipPrimitiveProps["placement"]}
          className={twJoin(
            "group bg-overlay text-overlay-fg entering:fade-in animate-in max-w-sm origin-(--trigger-anchor-point) rounded-lg border border-(--tooltip-border) px-2.5 py-1.5 text-sm/6 will-change-transform [--tooltip-border:var(--color-muted-fg)]/30 dark:shadow-none *:[strong]:font-medium",
            className
          )}
        >
          {tooltip}
        </TooltipPrimitive>
      )}
    </TooltipTriggerPrimitive>
  )
}

interface TooltipContentProps
  extends Omit<TooltipPrimitiveProps, "children">,
    VariantProps<typeof tooltipStyles> {
  arrow?: boolean
  children?: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
}

const placementSideMap: Record<string, string> = {
  top: "top",
  bottom: "bottom",
  left: "left",
  right: "right",
}

const TooltipContent = ({
  offset = 10,
  arrow = true,
  inverse,
  side,
  children,
  ...props
}: TooltipContentProps) => {
  const placement = side
    ? (placementSideMap[side] as TooltipPrimitiveProps["placement"])
    : undefined
  return (
    <TooltipPrimitive
      {...props}
      offset={offset}
      placement={placement}
      className={composeRenderProps(props.className, (className, renderProps) =>
        tooltipStyles({
          ...renderProps,
          inverse,
          className,
        })
      )}
    >
      {arrow && (
        <OverlayArrow className="group">
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            className={twJoin(
              "group-placement-bottom:rotate-180 group-placement-left:-rotate-90 group-placement-right:rotate-90 block forced-colors:fill-[Canvas] forced-colors:stroke-[ButtonBorder]",
              inverse
                ? "fill-fg stroke-transparent"
                : "fill-overlay stroke-(--tooltip-border)"
            )}
          >
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      )}
      {children}
    </TooltipPrimitive>
  )
}

interface TooltipTriggerProps extends React.ComponentProps<typeof Button> {
  asChild?: boolean
  disabled?: boolean
  suppressHydrationWarning?: boolean
}

const TooltipTrigger = ({
  asChild,
  disabled,
  suppressHydrationWarning,
  children,
  className,
  ...props
}: TooltipTriggerProps) => {
  if (asChild) {
    return <>{children}</>
  }
  return (
    <Button
      className={className}
      isDisabled={disabled}
      // @ts-expect-error - suppressHydrationWarning is a React DOM prop not in react-aria types
      suppressHydrationWarning={suppressHydrationWarning}
      {...props}
    >
      {children}
    </Button>
  )
}

const TooltipProvider = ({
  children,
  delayDuration = 700,
}: {
  children: React.ReactNode
  delayDuration?: number
  skipDelayDuration?: number
}) => (
  <TooltipTriggerPrimitive delay={delayDuration}>
    {children}
  </TooltipTriggerPrimitive>
)

export type { TooltipProps, TooltipContentProps }
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
