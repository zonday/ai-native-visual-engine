export interface PropMeta {
  key: string;
  type: "string" | "number" | "boolean" | "json";
  default?: unknown;
  required?: boolean;
  description?: string;
}

export interface ComponentMeta {
  type: string;
  title: string;
  description: string;
  category: "display" | "layout" | "interaction" | "container";
  props: PropMeta[];
  ai: {
    usage: string[];
    antiPatterns: string[];
    relatedComponents?: string[];
  };
}

export interface ComponentConstraint {
  type: "structural" | "layout" | "semantic" | "theme";
  rule: string;
}

export interface PluginDefinition {
  meta: ComponentMeta;
  constraints: ComponentConstraint[];
}
