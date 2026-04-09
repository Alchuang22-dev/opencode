import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { ToolRegistry } from "../../tool/registry"
import { Worktree } from "../../worktree"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { MCP } from "../../mcp"
import { Session } from "../../session"
import { zodToJsonSchema } from "zod-to-json-schema"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { WorkspaceRoutes } from "./workspace"
import path from "path"
import fs from "fs/promises"

const iotdbSettingsSchema = z.object({
  iotdb_home: z.string(),
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  probe_all_confignodes: z.boolean(),
  probe_all_ainodes: z.boolean(),
  probe_all_datanodes: z.boolean(),
  sql_dialect: z.enum(["tree", "table"]),
  policy: z.object({
    enable_table_ddl: z.boolean(),
    enable_write_dml: z.boolean(),
    enable_database_ddl: z.boolean(),
    enable_timeseries_ddl: z.boolean(),
    enable_sql_driver: z.boolean(),
    sql_driver_mode: z.enum(["readonly", "ddl", "full"]),
  }),
})
type IotdbSettings = z.infer<typeof iotdbSettingsSchema>

function boolToEnv(value: boolean) {
  return value ? "true" : "false"
}

function resolveTimeSeekRoot() {
  if (process.env.TIMESEEK_ROOT) return path.resolve(process.env.TIMESEEK_ROOT)
  return path.resolve(Instance.directory, "..")
}

function connectorFiles() {
  const root = resolveTimeSeekRoot()
  const dir = path.join(root, "connectors", "iotdb")
  return {
    envPath: path.join(dir, ".env"),
    yamlPath: path.join(dir, "connection.yaml"),
  }
}

function parseEnv(content: string) {
  const result: Record<string, string> = {}
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const idx = line.indexOf("=")
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    result[key] = value
  }
  return result
}

function asBool(value: string | undefined, fallback: boolean) {
  if (!value) return fallback
  const normalized = value.toLowerCase()
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") return true
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") return false
  return fallback
}

async function readIotdbSettings(): Promise<IotdbSettings> {
  const { envPath } = connectorFiles()
  const env = await fs.readFile(envPath, "utf8").then(parseEnv)
  return {
    iotdb_home: env.TIMESEEK_IOTDB_HOME ?? "",
    host: env.IOTDB_HOST ?? "127.0.0.1",
    port: Number(env.IOTDB_PORT ?? "6667"),
    user: env.IOTDB_USER ?? "root",
    password: env.IOTDB_PASSWORD ?? "root",
    database: env.IOTDB_DATABASE ?? "test",
    probe_all_confignodes: asBool(env.TIMESEEK_IOTDB_PROBE_ALL_CONFIGNODES, false),
    probe_all_ainodes: asBool(env.TIMESEEK_IOTDB_PROBE_ALL_AINODES, false),
    probe_all_datanodes: asBool(env.TIMESEEK_IOTDB_PROBE_ALL_DATANODES, false),
    sql_dialect: env.IOTDB_SQL_DIALECT === "tree" ? "tree" : "table",
    policy: {
      enable_table_ddl: asBool(env.IOTDB_ENABLE_TABLE_DDL, true),
      enable_write_dml: asBool(env.IOTDB_ENABLE_WRITE_DML, true),
      enable_database_ddl: asBool(env.IOTDB_ENABLE_DATABASE_DDL, true),
      enable_timeseries_ddl: asBool(env.IOTDB_ENABLE_TIMESERIES_DDL, true),
      enable_sql_driver: asBool(env.IOTDB_ENABLE_SQL_DRIVER, true),
      sql_driver_mode:
        env.IOTDB_SQL_DRIVER_MODE === "readonly" || env.IOTDB_SQL_DRIVER_MODE === "ddl" || env.IOTDB_SQL_DRIVER_MODE === "full"
          ? env.IOTDB_SQL_DRIVER_MODE
          : "full",
    },
  }
}

async function writeIotdbSettings(settings: IotdbSettings) {
  const { envPath, yamlPath } = connectorFiles()
  const envContent = [
    `TIMESEEK_IOTDB_HOME=${settings.iotdb_home}`,
    `IOTDB_HOST=${settings.host}`,
    `IOTDB_PORT=${settings.port}`,
    `IOTDB_USER=${settings.user}`,
    `IOTDB_PASSWORD=${settings.password}`,
    `IOTDB_DATABASE=${settings.database}`,
    `TIMESEEK_IOTDB_PROBE_ALL_CONFIGNODES=${boolToEnv(settings.probe_all_confignodes)}`,
    `TIMESEEK_IOTDB_PROBE_ALL_AINODES=${boolToEnv(settings.probe_all_ainodes)}`,
    `TIMESEEK_IOTDB_PROBE_ALL_DATANODES=${boolToEnv(settings.probe_all_datanodes)}`,
    `IOTDB_SQL_DIALECT=${settings.sql_dialect}`,
    `IOTDB_ENABLE_TABLE_DDL=${boolToEnv(settings.policy.enable_table_ddl)}`,
    `IOTDB_ENABLE_WRITE_DML=${boolToEnv(settings.policy.enable_write_dml)}`,
    `IOTDB_ENABLE_DATABASE_DDL=${boolToEnv(settings.policy.enable_database_ddl)}`,
    `IOTDB_ENABLE_TIMESERIES_DDL=${boolToEnv(settings.policy.enable_timeseries_ddl)}`,
    `IOTDB_ENABLE_SQL_DRIVER=${boolToEnv(settings.policy.enable_sql_driver)}`,
    `IOTDB_SQL_DRIVER_MODE=${settings.policy.sql_driver_mode}`,
    "",
  ].join("\n")

  const yamlContent = [
    "iotdb:",
    `  iotdb_home: ${settings.iotdb_home}`,
    `  host: ${settings.host}`,
    `  port: ${settings.port}`,
    `  user: ${settings.user}`,
    `  database: ${settings.database}`,
    `  probe_all_confignodes: ${boolToEnv(settings.probe_all_confignodes)}`,
    `  probe_all_ainodes: ${boolToEnv(settings.probe_all_ainodes)}`,
    `  probe_all_datanodes: ${boolToEnv(settings.probe_all_datanodes)}`,
    `  sql_dialect: ${settings.sql_dialect}`,
    "  policy:",
    `    enable_table_ddl: ${boolToEnv(settings.policy.enable_table_ddl)}`,
    `    enable_write_dml: ${boolToEnv(settings.policy.enable_write_dml)}`,
    `    enable_sql_driver: ${boolToEnv(settings.policy.enable_sql_driver)}`,
    `    sql_driver_mode: ${settings.policy.sql_driver_mode}`,
    "",
  ].join("\n")

  await fs.writeFile(envPath, envContent, "utf8")
  await fs.writeFile(yamlPath, yamlContent, "utf8")
}

export const ExperimentalRoutes = lazy(() =>
  new Hono()
    .get(
      "/tool/ids",
      describeRoute({
        summary: "List tool IDs",
        description:
          "Get a list of all available tool IDs, including both built-in tools and dynamically registered tools.",
        operationId: "tool.ids",
        responses: {
          200: {
            description: "Tool IDs",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string()).meta({ ref: "ToolIDs" })),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(await ToolRegistry.ids())
      },
    )
    .get(
      "/tool",
      describeRoute({
        summary: "List tools",
        description:
          "Get a list of available tools with their JSON schema parameters for a specific provider and model combination.",
        operationId: "tool.list",
        responses: {
          200: {
            description: "Tools",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .array(
                      z
                        .object({
                          id: z.string(),
                          description: z.string(),
                          parameters: z.any(),
                        })
                        .meta({ ref: "ToolListItem" }),
                    )
                    .meta({ ref: "ToolList" }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          provider: z.string(),
          model: z.string(),
        }),
      ),
      async (c) => {
        const { provider, model } = c.req.valid("query")
        const tools = await ToolRegistry.tools({ providerID: provider, modelID: model })
        return c.json(
          tools.map((t) => ({
            id: t.id,
            description: t.description,
            // Handle both Zod schemas and plain JSON schemas
            parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
          })),
        )
      },
    )
    .post(
      "/worktree",
      describeRoute({
        summary: "Create worktree",
        description: "Create a new git worktree for the current project and run any configured startup scripts.",
        operationId: "worktree.create",
        responses: {
          200: {
            description: "Worktree created",
            content: {
              "application/json": {
                schema: resolver(Worktree.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.create.schema),
      async (c) => {
        const body = c.req.valid("json")
        const worktree = await Worktree.create(body)
        return c.json(worktree)
      },
    )
    .route("/workspace", WorkspaceRoutes())
    .get(
      "/worktree",
      describeRoute({
        summary: "List worktrees",
        description: "List all sandbox worktrees for the current project.",
        operationId: "worktree.list",
        responses: {
          200: {
            description: "List of worktree directories",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string())),
              },
            },
          },
        },
      }),
      async (c) => {
        const sandboxes = await Project.sandboxes(Instance.project.id)
        return c.json(sandboxes)
      },
    )
    .delete(
      "/worktree",
      describeRoute({
        summary: "Remove worktree",
        description: "Remove a git worktree and delete its branch.",
        operationId: "worktree.remove",
        responses: {
          200: {
            description: "Worktree removed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.remove.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.remove(body)
        await Project.removeSandbox(Instance.project.id, body.directory)
        return c.json(true)
      },
    )
    .post(
      "/worktree/reset",
      describeRoute({
        summary: "Reset worktree",
        description: "Reset a worktree branch to the primary default branch.",
        operationId: "worktree.reset",
        responses: {
          200: {
            description: "Worktree reset",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.reset.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.reset(body)
        return c.json(true)
      },
    )
    .get(
      "/session",
      describeRoute({
        summary: "List sessions",
        description:
          "Get a list of all OpenCode sessions across projects, sorted by most recently updated. Archived sessions are excluded by default.",
        operationId: "experimental.session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.GlobalInfo.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          directory: z.string().optional().meta({ description: "Filter sessions by project directory" }),
          roots: z.coerce.boolean().optional().meta({ description: "Only return root sessions (no parentID)" }),
          start: z.coerce
            .number()
            .optional()
            .meta({ description: "Filter sessions updated on or after this timestamp (milliseconds since epoch)" }),
          cursor: z.coerce
            .number()
            .optional()
            .meta({ description: "Return sessions updated before this timestamp (milliseconds since epoch)" }),
          search: z.string().optional().meta({ description: "Filter sessions by title (case-insensitive)" }),
          limit: z.coerce.number().optional().meta({ description: "Maximum number of sessions to return" }),
          archived: z.coerce.boolean().optional().meta({ description: "Include archived sessions (default false)" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const limit = query.limit ?? 100
        const sessions: Session.GlobalInfo[] = []
        for await (const session of Session.listGlobal({
          directory: query.directory,
          roots: query.roots,
          start: query.start,
          cursor: query.cursor,
          search: query.search,
          limit: limit + 1,
          archived: query.archived,
        })) {
          sessions.push(session)
        }
        const hasMore = sessions.length > limit
        const list = hasMore ? sessions.slice(0, limit) : sessions
        if (hasMore && list.length > 0) {
          c.header("x-next-cursor", String(list[list.length - 1].time.updated))
        }
        return c.json(list)
      },
    )
    .get(
      "/resource",
      describeRoute({
        summary: "Get MCP resources",
        description: "Get all available MCP resources from connected servers. Optionally filter by name.",
        operationId: "experimental.resource.list",
        responses: {
          200: {
            description: "MCP resources",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), MCP.Resource)),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await MCP.resources())
      },
    )
    .get(
      "/timeseek/iotdb-settings",
      describeRoute({
        summary: "Get TimeSeek IoTDB settings",
        description: "Read TimeSeek IoTDB connector settings from connectors/iotdb/.env.",
        operationId: "experimental.timeseek.iotdb.get",
        responses: {
          200: {
            description: "IoTDB settings",
            content: {
              "application/json": {
                schema: resolver(iotdbSettingsSchema),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(await readIotdbSettings())
      },
    )
    .patch(
      "/timeseek/iotdb-settings",
      describeRoute({
        summary: "Update TimeSeek IoTDB settings",
        description: "Update TimeSeek IoTDB connector settings in connectors/iotdb/.env and connection.yaml.",
        operationId: "experimental.timeseek.iotdb.update",
        responses: {
          200: {
            description: "Updated IoTDB settings",
            content: {
              "application/json": {
                schema: resolver(iotdbSettingsSchema),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", iotdbSettingsSchema),
      async (c) => {
        const body = c.req.valid("json")
        await writeIotdbSettings(body)
        return c.json(body)
      },
    ),
)
