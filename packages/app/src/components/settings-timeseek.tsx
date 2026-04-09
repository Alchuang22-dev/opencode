import { Button } from "@opencode-ai/ui/button"
import { showToast } from "@opencode-ai/ui/toast"
import { TextField } from "@opencode-ai/ui/text-field"
import { Select } from "@opencode-ai/ui/select"
import { Switch } from "@opencode-ai/ui/switch"
import { createEffect, createResource, createSignal, type Component, type ParentProps, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useGlobalSDK } from "@/context/global-sdk"

type IotdbSettings = {
  iotdb_home: string
  host: string
  port: number
  user: string
  password: string
  database: string
  probe_all_confignodes: boolean
  probe_all_ainodes: boolean
  probe_all_datanodes: boolean
  sql_dialect: "tree" | "table"
  policy: {
    enable_table_ddl: boolean
    enable_write_dml: boolean
    enable_database_ddl: boolean
    enable_timeseries_ddl: boolean
    enable_sql_driver: boolean
    sql_driver_mode: "readonly" | "ddl" | "full"
  }
}

export const SettingsTimeSeek: Component = () => {
  const language = useLanguage()
  const globalSDK = useGlobalSDK()
  const [saving, setSaving] = createSignal(false)
  const [form, setForm] = createStore<IotdbSettings>({
    iotdb_home: "",
    host: "",
    port: 6667,
    user: "",
    password: "",
    database: "",
    probe_all_confignodes: false,
    probe_all_ainodes: false,
    probe_all_datanodes: false,
    sql_dialect: "table",
    policy: {
      enable_table_ddl: true,
      enable_write_dml: true,
      enable_database_ddl: true,
      enable_timeseries_ddl: true,
      enable_sql_driver: true,
      sql_driver_mode: "full",
    },
  })

  const endpoint = () => `${globalSDK.url}/experimental/timeseek/iotdb-settings`

  const [settings, { refetch }] = createResource(async () => {
    const response = await fetch(endpoint(), {
      headers: {
        "content-type": "application/json",
      },
    })
    if (!response.ok) throw new Error(`Failed to load settings: ${response.status}`)
    return (await response.json()) as IotdbSettings
  })

  createEffect(() => {
    const value = settings()
    if (!value) return
    setForm(value)
  })

  const dialectOptions = [
    { value: "tree" as const, label: "tree" },
    { value: "table" as const, label: "table" },
  ]
  const modeOptions = [
    { value: "readonly" as const, label: "readonly" },
    { value: "ddl" as const, label: "ddl" },
    { value: "full" as const, label: "full" },
  ]

  const save = async () => {
    setSaving(true)
    try {
      const response = await fetch(endpoint(), {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error(`Failed to save settings: ${response.status}`)
      const updated = (await response.json()) as IotdbSettings
      setForm(updated)
      showToast({
        variant: "success",
        icon: "circle-check",
        title: "TimeSeek settings saved",
        description: "Updated connectors/iotdb/.env and connectors/iotdb/connection.yaml",
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      showToast({
        title: language.t("common.requestFailed"),
        description: message,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8 max-w-[720px]">
          <h2 class="text-16-medium text-text-strong">TimeSeek IoTDB</h2>
          <p class="text-13-regular text-text-weak">
            Edit and save connector settings to `timeseek/connectors/iotdb/.env` and `connection.yaml`.
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-8 max-w-[720px]">
        <Show when={!settings.loading} fallback={<div class="text-14-regular text-text-weak">Loading...</div>}>
          <div class="bg-surface-raised-base px-4 rounded-lg">
            <SettingsRow title="IoTDB Home">
              <TextField value={form.iotdb_home} onChange={(value) => setForm("iotdb_home", value)} />
            </SettingsRow>
            <SettingsRow title="Host">
              <TextField value={form.host} onChange={(value) => setForm("host", value)} />
            </SettingsRow>
            <SettingsRow title="Port">
              <TextField value={String(form.port)} onChange={(value) => setForm("port", Number(value || 0))} />
            </SettingsRow>
            <SettingsRow title="User">
              <TextField value={form.user} onChange={(value) => setForm("user", value)} />
            </SettingsRow>
            <SettingsRow title="Password">
              <TextField type="password" value={form.password} onChange={(value) => setForm("password", value)} />
            </SettingsRow>
            <SettingsRow title="Database">
              <TextField value={form.database} onChange={(value) => setForm("database", value)} />
            </SettingsRow>
            <SettingsRow title="Probe All ConfigNodes">
              <Switch checked={form.probe_all_confignodes} onChange={(checked) => setForm("probe_all_confignodes", checked)} />
            </SettingsRow>
            <SettingsRow title="Probe All AINodes">
              <Switch checked={form.probe_all_ainodes} onChange={(checked) => setForm("probe_all_ainodes", checked)} />
            </SettingsRow>
            <SettingsRow title="Probe All DataNodes">
              <Switch checked={form.probe_all_datanodes} onChange={(checked) => setForm("probe_all_datanodes", checked)} />
            </SettingsRow>
            <SettingsRow title="SQL Dialect">
              <Select
                options={dialectOptions}
                current={dialectOptions.find((x) => x.value === form.sql_dialect)}
                value={(x) => x.value}
                label={(x) => x.label}
                onSelect={(value) => value && setForm("sql_dialect", value.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>
            <SettingsRow title="Enable Table DDL">
              <Switch
                checked={form.policy.enable_table_ddl}
                onChange={(checked) => setForm("policy", "enable_table_ddl", checked)}
              />
            </SettingsRow>
            <SettingsRow title="Enable Write DML">
              <Switch
                checked={form.policy.enable_write_dml}
                onChange={(checked) => setForm("policy", "enable_write_dml", checked)}
              />
            </SettingsRow>
            <SettingsRow title="Enable Database DDL">
              <Switch
                checked={form.policy.enable_database_ddl}
                onChange={(checked) => setForm("policy", "enable_database_ddl", checked)}
              />
            </SettingsRow>
            <SettingsRow title="Enable Timeseries DDL">
              <Switch
                checked={form.policy.enable_timeseries_ddl}
                onChange={(checked) => setForm("policy", "enable_timeseries_ddl", checked)}
              />
            </SettingsRow>
            <SettingsRow title="Enable SQL Driver">
              <Switch
                checked={form.policy.enable_sql_driver}
                onChange={(checked) => setForm("policy", "enable_sql_driver", checked)}
              />
            </SettingsRow>
            <SettingsRow title="SQL Driver Mode">
              <Select
                options={modeOptions}
                current={modeOptions.find((x) => x.value === form.policy.sql_driver_mode)}
                value={(x) => x.value}
                label={(x) => x.label}
                onSelect={(value) => value && setForm("policy", "sql_driver_mode", value.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </SettingsRow>
          </div>
        </Show>

        <div class="flex items-center gap-3">
          <Button variant="secondary" onClick={() => void refetch()}>
            Reload
          </Button>
          <Button onClick={() => void save()} disabled={saving()}>
            {saving() ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}

const SettingsRow: Component<ParentProps<{ title: string }>> = (props) => {
  return (
    <div class="py-3 border-b border-border-weak-base last:border-none flex items-center justify-between gap-4">
      <div class="text-14-regular text-text-strong">{props.title}</div>
      <div class="min-w-[220px]">{props.children}</div>
    </div>
  )
}
