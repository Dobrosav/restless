export type Language = 'TypeScript' | 'Java' | 'C#' | 'Go' | 'Python' | 'Swift' | 'Rust' | 'Kotlin' | 'Ruby' | 'Dart' | 'PHP' | 'C++' | 'Scala' | 'GraphQL' | 'Zod';

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function generateModels(jsonStr: string, rootClassName: string = 'Root', lang: Language): string {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Invalid JSON');
  }

  const classes = new Map<string, Record<string, string>>();

  function parseObject(obj: any, name: string) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    const fields: Record<string, string> = {};
    for (const [key, val] of Object.entries(obj)) {
      const type = getType(val);
      if (type === 'object') {
        const nestedName = capitalize(key);
        parseObject(val, nestedName);
        fields[key] = nestedName;
      } else if (type === 'array') {
        const arr = val as any[];
        if (arr.length > 0) {
          const firstType = getType(arr[0]);
          if (firstType === 'object') {
            const nestedName = capitalize(key) + 'Item';
            parseObject(arr[0], nestedName);
            fields[key] = `array_${nestedName}`;
          } else {
            fields[key] = `array_${firstType}`;
          }
        } else {
          fields[key] = 'array_any';
        }
      } else {
        fields[key] = type;
      }
    }
    classes.set(name, fields);
  }

  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && typeof parsed[0] === 'object') {
      parseObject(parsed[0], rootClassName);
    }
  } else if (typeof parsed === 'object') {
    parseObject(parsed, rootClassName);
  } else {
    throw new Error('JSON root must be an object or an array of objects');
  }

  return formatClasses(classes, lang);
}

function formatClasses(classes: Map<string, Record<string, string>>, lang: Language): string {
  let result = '';
  
  classes.forEach((fields, className) => {
    switch (lang) {
      case 'TypeScript':
        result += `export interface ${className} {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const tsType = mapTypeScript(type);
          result += `  ${key}: ${tsType};\n`;
        }
        result += `}\n\n`;
        break;
      case 'Java':
        result += `public class ${className} {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const javaType = mapJava(type);
          result += `    private ${javaType} ${key};\n`;
        }
        result += `\n    // Getters and Setters omitted for brevity\n}\n\n`;
        break;
      case 'C#':
        result += `public class ${className} \n{\n`;
        for (const [key, type] of Object.entries(fields)) {
          const csType = mapCSharp(type);
          result += `    public ${csType} ${capitalize(key)} { get; set; }\n`;
        }
        result += `}\n\n`;
        break;
      case 'Go':
        result += `type ${className} struct {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const goType = mapGo(type);
          result += `\t${capitalize(key)} ${goType} \`json:"${key}"\`\n`;
        }
        result += `}\n\n`;
        break;
      case 'Python':
        result += `from dataclasses import dataclass\nfrom typing import Any, List, Optional\n\n`
        if (result.indexOf('from dataclasses') !== 0) {
          result = result.replace(/^.*dataclasses.*\n.*\n\n/, ''); 
          if (!result.includes('from dataclasses')) {
             result = `from dataclasses import dataclass\nfrom typing import Any, List, Optional\n\n` + result;
          }
        }
        result += `@dataclass\nclass ${className}:\n`;
        let hasFields = false;
        for (const [key, type] of Object.entries(fields)) {
          const pyType = mapPython(type);
          result += `    ${key}: ${pyType}\n`;
          hasFields = true;
        }
        if (!hasFields) result += `    pass\n`;
        result += `\n`;
        break;
      case 'Swift':
        result += `struct ${className}: Codable {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const swiftType = mapSwift(type);
          result += `    let ${key}: ${swiftType}?\n`;
        }
        result += `}\n\n`;
        break;
      case 'Rust':
        if (!result.includes('serde')) {
            result = `use serde::{Serialize, Deserialize};\n\n` + result;
        }
        result += `#[derive(Serialize, Deserialize, Debug)]\npub struct ${className} {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const rustType = mapRust(type);
          result += `    pub ${key}: Option<${rustType}>,\n`;
        }
        result += `}\n\n`;
        break;
      case 'Kotlin':
        result += `data class ${className}(\n`;
        const entries = Object.entries(fields);
        entries.forEach(([key, type], index) => {
          const ktType = mapKotlin(type);
          result += `    val ${key}: ${ktType}?${index < entries.length - 1 ? ',' : ''}\n`;
        });
        result += `)\n\n`;
        break;
      case 'Ruby':
        result += `class ${className}\n`;
        const attr_accessor = Object.keys(fields).map(k => `:${k}`).join(', ');
        if (attr_accessor) {
            result += `  attr_accessor ${attr_accessor}\n`;
        }
        result += `end\n\n`;
        break;
      case 'Dart':
        result += `class ${className} {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const dartType = mapDart(type);
          result += `  ${dartType}? ${key};\n`;
        }
        result += `\n  ${className}({`;
        for (const [key, _] of Object.entries(fields)) {
          result += `this.${key}, `;
        }
        result += `});\n}\n\n`;
        break;
      case 'PHP':
        result += `class ${className} {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const phpType = mapPHP(type);
          const docType = type.startsWith('array_') ? `array<${mapPHP(type.substring(6))}>` : phpType;
          result += `    /** @var ${docType} */\n`;
          result += `    public ?${phpType} $${key};\n`;
        }
        result += `}\n\n`;
        break;
      case 'C++':
        if (!result.includes('<string>')) {
           result = `#include <string>\n#include <vector>\n#include <any>\n\n` + result;
        }
        result += `class ${className} {\npublic:\n`;
        for (const [key, type] of Object.entries(fields)) {
          const cppType = mapCpp(type);
          result += `    ${cppType} ${key};\n`;
        }
        result += `};\n\n`;
        break;
      case 'Scala':
        result += `case class ${className}(\n`;
        const scalaEntries = Object.entries(fields);
        scalaEntries.forEach(([key, type], index) => {
          const scalaType = mapScala(type);
          result += `    ${key}: Option[${scalaType}]${index < scalaEntries.length - 1 ? ',' : ''}\n`;
        });
        result += `)\n\n`;
        break;
      case 'GraphQL':
        result += `type ${className} {\n`;
        for (const [key, type] of Object.entries(fields)) {
          const gqlType = mapGraphQL(type);
          result += `  ${key}: ${gqlType}\n`;
        }
        result += `}\n\n`;
        break;
      case 'Zod':
        if (!result.includes('import { z }')) {
           result = `import { z } from "zod";\n\n` + result;
        }
        result += `export const ${className}Schema = z.object({\n`;
        for (const [key, type] of Object.entries(fields)) {
          const zodType = mapZod(type);
          result += `  ${key}: ${zodType},\n`;
        }
        result += `});\n\n`;
        result += `export type ${className} = z.infer<typeof ${className}Schema>;\n\n`;
        break;
    }
  });

  return result.trim();
}

function mapTypeScript(type: string): string {
  if (type.startsWith('array_')) return `${mapTypeScript(type.substring(6))}[]`;
  if (type === 'number' || type === 'string' || type === 'boolean') return type;
  if (type === 'null') return 'any';
  return type;
}

function mapJava(type: string): string {
  if (type.startsWith('array_')) return `List<${mapJava(type.substring(6))}>`;
  if (type === 'number') return 'Double';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'Boolean';
  if (type === 'null') return 'Object';
  return type;
}

function mapCSharp(type: string): string {
  if (type.startsWith('array_')) return `List<${mapCSharp(type.substring(6))}>`;
  if (type === 'number') return 'double';
  if (type === 'string') return 'string';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'object';
  return type;
}

function mapGo(type: string): string {
  if (type.startsWith('array_')) return `[]${mapGo(type.substring(6))}`;
  if (type === 'number') return 'float64';
  if (type === 'string') return 'string';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'interface{}';
  return type;
}

function mapPython(type: string): string {
  if (type.startsWith('array_')) return `List['${mapPython(type.substring(6))}']`;
  if (type === 'number') return 'float';
  if (type === 'string') return 'str';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'Any';
  return `'${type}'`;
}

function mapSwift(type: string): string {
  if (type.startsWith('array_')) return `[${mapSwift(type.substring(6))}]`;
  if (type === 'number') return 'Double';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'Bool';
  if (type === 'null') return 'AnyCodable';
  return type;
}

function mapRust(type: string): string {
  if (type.startsWith('array_')) return `Vec<${mapRust(type.substring(6))}>`;
  if (type === 'number') return 'f64';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'serde_json::Value';
  return type;
}

function mapKotlin(type: string): string {
  if (type.startsWith('array_')) return `List<${mapKotlin(type.substring(6))}>`;
  if (type === 'number') return 'Double';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'Boolean';
  if (type === 'null') return 'Any';
  return type;
}

function mapDart(type: string): string {
  if (type.startsWith('array_')) return `List<${mapDart(type.substring(6))}>`;
  if (type === 'number') return 'double';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'dynamic';
  return type;
}

function mapPHP(type: string): string {
  if (type.startsWith('array_')) return `array`;
  if (type === 'number') return 'float';
  if (type === 'string') return 'string';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'mixed';
  return type;
}

function mapCpp(type: string): string {
  if (type.startsWith('array_')) return `std::vector<${mapCpp(type.substring(6))}>`;
  if (type === 'number') return 'double';
  if (type === 'string') return 'std::string';
  if (type === 'boolean') return 'bool';
  if (type === 'null') return 'std::any';
  return type;
}

function mapScala(type: string): string {
  if (type.startsWith('array_')) return `List[${mapScala(type.substring(6))}]`;
  if (type === 'number') return 'Double';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'Boolean';
  if (type === 'null') return 'Any';
  return type;
}

function mapGraphQL(type: string): string {
  if (type.startsWith('array_')) return `[${mapGraphQL(type.substring(6))}]`;
  if (type === 'number') return 'Float';
  if (type === 'string') return 'String';
  if (type === 'boolean') return 'Boolean';
  if (type === 'null') return 'String';
  return type;
}

function mapZod(type: string): string {
  if (type.startsWith('array_')) return `z.array(${mapZod(type.substring(6))}).optional()`;
  if (type === 'number') return 'z.number().optional()';
  if (type === 'string') return 'z.string().optional()';
  if (type === 'boolean') return 'z.boolean().optional()';
  if (type === 'null') return 'z.any().optional()';
  return `z.lazy(() => ${type}Schema).optional()`;
}
