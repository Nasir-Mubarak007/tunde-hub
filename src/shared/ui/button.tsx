/**
 * Shared button. Shadcn style part on tokens: server pages render it,
 * client only at the interactive edge. Takes variant, size, and the wide
 * flag plus normal button or link props, returns the element.
 */
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "solid" | "quiet" | "chat";
export type ButtonSize = "default" | "small";

type Common = {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly wide?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
};

function classes(
  variant: ButtonVariant,
  size: ButtonSize,
  wide: boolean,
  extra: string | undefined,
): string {
  return [
    "button",
    `button--${variant}`,
    size === "small" ? "button--small" : "",
    wide ? "button--wide" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonAsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    readonly href?: undefined;
  };

type ButtonAsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & {
    readonly href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/** Renders a button or a link styled as a button. Takes the props, returns the element. */
export function Button(props: ButtonProps) {
  const { variant = "solid", size = "default", wide = false, className, children, ...rest } = props;
  const cls = classes(variant, size, wide, className);
  if ("href" in rest && typeof rest.href === "string") {
    const { href, ...anchor } = rest as ButtonAsLink;
    return (
      <a className={cls} href={href} {...anchor}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...(rest as ButtonAsButton)}>
      {children}
    </button>
  );
}
