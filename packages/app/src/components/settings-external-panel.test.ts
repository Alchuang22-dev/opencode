import { describe, expect, test } from "bun:test"
import {
  EXTERNAL_SETTINGS_FALLBACK_ICON,
  externalSettingsPanelTabValue,
  isValidExternalSettingsUrl,
  normalizeExternalSettingsPanels,
  resolveExternalSettingsIcon,
} from "./settings-external-panel"

describe("external settings panel helpers", () => {
  test("filters disabled panels and defaults section to server", () => {
    const panels = normalizeExternalSettingsPanels({
      enabled: {
        title: "Enabled",
        url: "http://127.0.0.1:8765/settings",
      },
      disabled: {
        title: "Disabled",
        url: "http://127.0.0.1:8765/disabled",
        enabled: false,
      },
      desktop: {
        title: "Desktop",
        url: "https://service.example.com/settings",
        section: "desktop",
      },
    })

    expect(panels.map((panel) => panel.id)).toEqual(["enabled", "desktop"])
    expect(panels[0].section).toBe("server")
    expect(panels[1].section).toBe("desktop")
  })

  test("falls back for unknown icons", () => {
    expect(resolveExternalSettingsIcon("mcp")).toBe("mcp")
    expect(resolveExternalSettingsIcon("not-a-real-icon")).toBe(EXTERNAL_SETTINGS_FALLBACK_ICON)

    const panels = normalizeExternalSettingsPanels({
      service: {
        title: "Service",
        url: "https://service.example.com/settings",
        icon: "not-a-real-icon",
      },
    })

    expect(panels[0].icon).toBe(EXTERNAL_SETTINGS_FALLBACK_ICON)
  })

  test("validates external settings URLs", () => {
    expect(isValidExternalSettingsUrl("https://service.example.com/settings")).toBe(true)
    expect(isValidExternalSettingsUrl("http://127.0.0.1:8765/settings")).toBe(true)
    expect(isValidExternalSettingsUrl("file:///tmp/settings.html")).toBe(false)
    expect(isValidExternalSettingsUrl("javascript:alert(1)")).toBe(false)
    expect(isValidExternalSettingsUrl("not a url")).toBe(false)
  })

  test("builds stable tab values", () => {
    expect(externalSettingsPanelTabValue("my-service")).toBe("external-settings:my-service")
  })
})
