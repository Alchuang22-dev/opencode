import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import type { IconProps } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { Show, type Component } from "solid-js"
import { SettingsList } from "./settings-list"

export type ExternalSettingsPanelSection = "desktop" | "server"

export type ExternalSettingsPanelConfig = {
  title: string
  url: string
  description?: string
  icon?: string
  section?: ExternalSettingsPanelSection
  mode?: "link" | (string & {})
  enabled?: boolean
}

const EXTERNAL_SETTINGS_ICONS = [
  "mcp",
  "server",
  "settings-gear",
  "link",
  "providers",
  "models",
  "sliders",
  "terminal",
  "task",
] as const satisfies readonly IconProps["name"][]

export const EXTERNAL_SETTINGS_FALLBACK_ICON = "settings-gear" satisfies IconProps["name"]

export type ExternalSettingsIcon = (typeof EXTERNAL_SETTINGS_ICONS)[number]

export type NormalizedExternalSettingsPanel = ExternalSettingsPanelConfig & {
  id: string
  section: ExternalSettingsPanelSection
  mode: string
  icon: ExternalSettingsIcon
  validUrl: boolean
  available: boolean
}

export function externalSettingsPanelTabValue(id: string) {
  return `external-settings:${id}`
}

export function resolveExternalSettingsIcon(icon: string | undefined): ExternalSettingsIcon {
  if (EXTERNAL_SETTINGS_ICONS.includes(icon as ExternalSettingsIcon)) return icon as ExternalSettingsIcon
  return EXTERNAL_SETTINGS_FALLBACK_ICON
}

export function isValidExternalSettingsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function normalizeExternalSettingsPanels(input: Record<string, ExternalSettingsPanelConfig> | undefined) {
  return Object.entries(input ?? {})
    .filter(([, panel]) => panel.enabled !== false)
    .map(
      ([id, panel]): NormalizedExternalSettingsPanel => ({
        ...panel,
        id,
        section: panel.section ?? "server",
        mode: panel.mode ?? "link",
        icon: resolveExternalSettingsIcon(panel.icon),
        validUrl: isValidExternalSettingsUrl(panel.url),
        available: panel.mode === undefined || panel.mode === "link",
      }),
    )
}

export const SettingsExternalPanel: Component<{ panel: NormalizedExternalSettingsPanel }> = (props) => {
  const language = useLanguage()

  const open = () => {
    if (!props.panel.validUrl || !props.panel.available) return
    window.open(props.panel.url, "_blank", "noopener,noreferrer")
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8 max-w-[720px]">
          <div class="flex items-center gap-2 min-w-0">
            <Icon name={props.panel.icon} class="size-4 shrink-0 text-icon-base" />
            <h2 class="text-16-medium text-text-strong truncate">{props.panel.title}</h2>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 max-w-[720px]">
        <Show when={props.panel.description}>
          <p class="text-14-regular text-text-base">{props.panel.description}</p>
        </Show>

        <SettingsList>
          <div class="flex flex-col gap-4 py-4">
            <div class="flex flex-col gap-1">
              <span class="text-12-medium text-text-weak">URL</span>
              <span class="text-14-regular text-text-strong break-all">{props.panel.url}</span>
            </div>
            <Show when={!props.panel.available}>
              <p class="text-13-regular text-text-weak">{language.t("settings.external.unavailable")}</p>
            </Show>
            <Show when={!props.panel.validUrl}>
              <p class="text-13-regular text-text-danger-base">{language.t("settings.external.invalidUrl")}</p>
            </Show>
            <Button
              class="self-start"
              size="large"
              variant="primary"
              icon="square-arrow-top-right"
              disabled={!props.panel.validUrl || !props.panel.available}
              onClick={open}
            >
              {language.t("settings.external.open")}
            </Button>
          </div>
        </SettingsList>
      </div>
    </div>
  )
}
