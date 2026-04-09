"use client"

import { createContext, use, useEffect, useState } from "react"
import { twMerge } from "tailwind-merge"

const AvatarContext = createContext<{
  src?: string | null
  alt?: string
} | null>(null)
const useAvatarContext = () => {
  const ctx = use(AvatarContext)
  if (!ctx) throw new Error("Avatar subcomponents must be used within Avatar")
  return ctx
}

export interface AvatarProps {
  src?: string | null
  initials?: string
  alt?: string
  className?: string
  isSquare?: boolean
  size?:
    | "xs"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "2xl"
    | "3xl"
    | "4xl"
    | "5xl"
    | "6xl"
    | "7xl"
    | "8xl"
    | "9xl"
}

export function Avatar({
  src = null,
  isSquare = false,
  size = "md",
  initials,
  alt = "",
  className,
  children,
  ...props
}: AvatarProps & React.ComponentPropsWithoutRef<"span">) {
  return (
    <AvatarContext value={{ src, alt }}>
      <span
        data-slot="avatar"
        {...props}
        className={twMerge(
          "outline-fg/(--ring-opacity) inline-grid size-(--avatar-size) shrink-0 align-middle outline-1 -outline-offset-1 [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1 *:size-(--avatar-size)",
          size === "xs" && "[--avatar-size:--spacing(5)]",
          size === "sm" && "[--avatar-size:--spacing(6)]",
          size === "md" && "[--avatar-size:--spacing(8)]",
          size === "lg" && "[--avatar-size:--spacing(10)]",
          size === "xl" && "[--avatar-size:--spacing(12)]",
          size === "2xl" && "[--avatar-size:--spacing(14)]",
          size === "3xl" && "[--avatar-size:--spacing(16)]",
          size === "4xl" && "[--avatar-size:--spacing(20)]",
          size === "5xl" && "[--avatar-size:--spacing(24)]",
          size === "6xl" && "[--avatar-size:--spacing(28)]",
          size === "7xl" && "[--avatar-size:--spacing(32)]",
          size === "8xl" && "[--avatar-size:--spacing(36)]",
          size === "9xl" && "[--avatar-size:--spacing(42)]",
          isSquare
            ? "rounded-(--avatar-radius) *:rounded-(--avatar-radius)"
            : "rounded-full *:rounded-full",
          className
        )}
      >
        {children ? (
          children
        ) : (
          <>
            {initials && (
              <svg
                className="font-md size-full fill-current p-[5%] text-[48px] uppercase select-none"
                viewBox="0 0 100 100"
                aria-hidden={alt ? undefined : "true"}
              >
                {alt && <title>{alt}</title>}
                <text
                  x="50%"
                  y="50%"
                  alignmentBaseline="middle"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  dy=".125em"
                >
                  {initials}
                </text>
              </svg>
            )}
            {src && (
              <img
                className="size-full object-cover object-center"
                src={src}
                alt={alt}
              />
            )}
          </>
        )}
      </span>
    </AvatarContext>
  )
}

interface AvatarImageProps extends React.ComponentPropsWithoutRef<"img"> {
  src?: string
  alt?: string
}

export function AvatarImage({
  src,
  alt,
  className,
  ...props
}: AvatarImageProps) {
  const ctx = useAvatarContext()
  return (
    <img
      className={twMerge("size-full object-cover object-center", className)}
      src={src ?? ctx.src ?? undefined}
      alt={alt ?? ctx.alt ?? ""}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<"span"> {
  delayMs?: number
}

export function AvatarFallback({
  delayMs,
  className,
  children,
  ...props
}: AvatarFallbackProps) {
  const [show, setShow] = useState(delayMs === undefined)

  useEffect(() => {
    if (delayMs !== undefined) {
      const timer = setTimeout(() => setShow(true), delayMs)
      return () => clearTimeout(timer)
    }
  }, [delayMs])

  if (!show) return null

  return (
    <span
      className={twMerge(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
