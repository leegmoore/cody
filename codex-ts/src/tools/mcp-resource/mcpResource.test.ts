import { describe, it, expect } from "vitest";
import {
  listMcpResources,
  listMcpResourceTemplates,
  readMcpResource,
  type ListMcpResourcesParams,
  type ListMcpResourceTemplatesParams,
  type ReadMcpResourceParams,
  MCP_RESOURCE_TOOL_SPECS,
} from "./mcpResource.js";

describe("listMcpResources", () => {
  it("should list resources from all servers when server not specified", async () => {
    const params: ListMcpResourcesParams = {};

    const result = await listMcpResources(params);

    expect(result.success).toBe(true);
    const data = JSON.parse(result.content);
    expect(data.resources).toEqual([]);
    expect(data.server).toBeUndefined();
  });

  it("should list resources from specific server", async () => {
    const params: ListMcpResourcesParams = {
      server: "test-server",
    };

    const result = await listMcpResources(params);

    expect(result.success).toBe(true);
    const data = JSON.parse(result.content);
    expect(data.server).toBe("test-server");
    expect(data.resources).toEqual([]);
  });

  it("should accept cursor when server specified", async () => {
    const params: ListMcpResourcesParams = {
      server: "test-server",
      cursor: "next-page-token",
    };

    const result = await listMcpResources(params);

    expect(result.success).toBe(true);
  });

  it("should reject cursor without server", async () => {
    const params: ListMcpResourcesParams = {
      cursor: "next-page-token",
    };

    await expect(listMcpResources(params)).rejects.toThrow(
      "cursor can only be used when a server is specified",
    );
  });

  it("should return empty array for stub implementation", async () => {
    const params: ListMcpResourcesParams = {
      server: "any-server",
    };

    const result = await listMcpResources(params);
    const data = JSON.parse(result.content);

    expect(data.resources).toHaveLength(0);
  });

  it("should not return nextCursor in stub", async () => {
    const params: ListMcpResourcesParams = {
      server: "test-server",
    };

    const result = await listMcpResources(params);
    const data = JSON.parse(result.content);

    expect(data.nextCursor).toBeUndefined();
  });

  it("should handle empty server name", async () => {
    const params: ListMcpResourcesParams = {
      server: "",
    };

    const result = await listMcpResources(params);

    expect(result.success).toBe(true);
  });
});

describe("listMcpResourceTemplates", () => {
  it("should list templates from all servers when server not specified", async () => {
    const params: ListMcpResourceTemplatesParams = {};

    const result = await listMcpResourceTemplates(params);

    expect(result.success).toBe(true);
    const data = JSON.parse(result.content);
    expect(data.resourceTemplates).toEqual([]);
    expect(data.server).toBeUndefined();
  });

  it("should list templates from specific server", async () => {
    const params: ListMcpResourceTemplatesParams = {
      server: "test-server",
    };

    const result = await listMcpResourceTemplates(params);

    expect(result.success).toBe(true);
    const data = JSON.parse(result.content);
    expect(data.server).toBe("test-server");
    expect(data.resourceTemplates).toEqual([]);
  });

  it("should accept cursor when server specified", async () => {
    const params: ListMcpResourceTemplatesParams = {
      server: "test-server",
      cursor: "next-page-token",
    };

    const result = await listMcpResourceTemplates(params);

    expect(result.success).toBe(true);
  });

  it("should reject cursor without server", async () => {
    const params: ListMcpResourceTemplatesParams = {
      cursor: "next-page-token",
    };

    await expect(listMcpResourceTemplates(params)).rejects.toThrow(
      "cursor can only be used when a server is specified",
    );
  });

  it("should return empty array for stub implementation", async () => {
    const params: ListMcpResourceTemplatesParams = {
      server: "any-server",
    };

    const result = await listMcpResourceTemplates(params);
    const data = JSON.parse(result.content);

    expect(data.resourceTemplates).toHaveLength(0);
  });

  it("should not return nextCursor in stub", async () => {
    const params: ListMcpResourceTemplatesParams = {
      server: "test-server",
    };

    const result = await listMcpResourceTemplates(params);
    const data = JSON.parse(result.content);

    expect(data.nextCursor).toBeUndefined();
  });
});

describe("readMcpResource", () => {
  it("should reject missing server field", async () => {
    const params = {
      uri: "file:///test.txt",
    } as ReadMcpResourceParams;

    await expect(readMcpResource(params)).rejects.toThrow(
      "missing server field",
    );
  });

  it("should reject missing uri field", async () => {
    const params = {
      server: "test-server",
    } as ReadMcpResourceParams;

    await expect(readMcpResource(params)).rejects.toThrow("missing uri field");
  });

  it("should reject empty server", async () => {
    const params: ReadMcpResourceParams = {
      server: "",
      uri: "file:///test.txt",
    };

    await expect(readMcpResource(params)).rejects.toThrow(
      "missing server field",
    );
  });

  it("should reject empty uri", async () => {
    const params: ReadMcpResourceParams = {
      server: "test-server",
      uri: "",
    };

    await expect(readMcpResource(params)).rejects.toThrow("missing uri field");
  });

  it("should throw not implemented error for valid request", async () => {
    const params: ReadMcpResourceParams = {
      server: "test-server",
      uri: "file:///test.txt",
    };

    await expect(readMcpResource(params)).rejects.toThrow(
      "not yet implemented",
    );
  });

  it("should include server and uri in error message", async () => {
    const params: ReadMcpResourceParams = {
      server: "my-server",
      uri: "resource://data.json",
    };

    await expect(readMcpResource(params)).rejects.toThrow("my-server");
    await expect(readMcpResource(params)).rejects.toThrow(
      "resource://data.json",
    );
  });
});

describe("MCP_RESOURCE_TOOL_SPECS", () => {
  it("should have spec for list_mcp_resources", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.list_mcp_resources;

    expect(spec.name).toBe("list_mcp_resources");
    expect(spec.description).toContain("List available resources");
  });

  it("should have spec for list_mcp_resource_templates", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.list_mcp_resource_templates;

    expect(spec.name).toBe("list_mcp_resource_templates");
    expect(spec.description).toContain("templates");
  });

  it("should have spec for read_mcp_resource", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.read_mcp_resource;

    expect(spec.name).toBe("read_mcp_resource");
    expect(spec.description).toContain("Read content");
  });

  it("should have server and cursor parameters for list_mcp_resources", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.list_mcp_resources;
    const props = spec.parameters.properties;

    expect(props.server).toBeDefined();
    expect(props.cursor).toBeDefined();
  });

  it("should have server and cursor parameters for list_mcp_resource_templates", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.list_mcp_resource_templates;
    const props = spec.parameters.properties;

    expect(props.server).toBeDefined();
    expect(props.cursor).toBeDefined();
  });

  it("should require server and uri for read_mcp_resource", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.read_mcp_resource;

    expect(spec.parameters.required).toContain("server");
    expect(spec.parameters.required).toContain("uri");
  });

  it("should have server and uri parameters for read_mcp_resource", () => {
    const spec = MCP_RESOURCE_TOOL_SPECS.read_mcp_resource;
    const props = spec.parameters.properties;

    expect(props.server).toBeDefined();
    expect(props.uri).toBeDefined();
  });

  it("should not allow additional properties", () => {
    expect(
      MCP_RESOURCE_TOOL_SPECS.list_mcp_resources.parameters
        .additionalProperties,
    ).toBe(false);
    expect(
      MCP_RESOURCE_TOOL_SPECS.list_mcp_resource_templates.parameters
        .additionalProperties,
    ).toBe(false);
    expect(
      MCP_RESOURCE_TOOL_SPECS.read_mcp_resource.parameters.additionalProperties,
    ).toBe(false);
  });
});
