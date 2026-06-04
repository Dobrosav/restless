import { describe, it, expect } from 'vitest'
import { generateModels } from './jsonToModels'

const simpleJson = '{"name": "John", "age": 30, "active": true}'
const nestedJson = '{"user": {"name": "John", "address": {"city": "Belgrade"}}}'
const arrayJson = '{"tags": ["a", "b"], "items": [{"id": 1, "title": "Test"}]}'
const rootArrayJson = '[{"id": 1, "name": "Item"}]'

describe('generateModels', () => {
  describe('Error handling', () => {
    it('should throw on invalid JSON', () => {
      expect(() => generateModels('not json', 'Root', 'TypeScript')).toThrow('Invalid JSON')
    })

    it('should throw when root is a primitive', () => {
      expect(() => generateModels('"just a string"', 'Root', 'TypeScript')).toThrow(
        'JSON root must be an object or an array of objects'
      )
    })

    it('should throw when root is a number', () => {
      expect(() => generateModels('42', 'Root', 'TypeScript')).toThrow(
        'JSON root must be an object or an array of objects'
      )
    })

    it('should handle root array of objects', () => {
      const result = generateModels(rootArrayJson, 'Item', 'TypeScript')
      expect(result).toContain('export interface Item')
      expect(result).toContain('id: number')
      expect(result).toContain('name: string')
    })

    it('should handle empty object', () => {
      const result = generateModels('{}', 'Empty', 'TypeScript')
      expect(result).toContain('export interface Empty')
    })

    it('should handle empty array', () => {
      // Empty array has no items to infer type from
      const result = generateModels('[]', 'Root', 'TypeScript')
      expect(result).toBe('')
    })

    it('should handle null values', () => {
      const result = generateModels('{"field": null}', 'Root', 'TypeScript')
      expect(result).toContain('field: any')
    })
  })

  describe('TypeScript generation', () => {
    it('should generate correct types for simple object', () => {
      const result = generateModels(simpleJson, 'Person', 'TypeScript')
      expect(result).toContain('export interface Person')
      expect(result).toContain('name: string')
      expect(result).toContain('age: number')
      expect(result).toContain('active: boolean')
    })

    it('should handle nested objects', () => {
      const result = generateModels(nestedJson, 'Root', 'TypeScript')
      expect(result).toContain('export interface Root')
      expect(result).toContain('user: User')
      expect(result).toContain('export interface User')
      expect(result).toContain('address: Address')
      expect(result).toContain('export interface Address')
      expect(result).toContain('city: string')
    })

    it('should handle arrays', () => {
      const result = generateModels(arrayJson, 'Root', 'TypeScript')
      expect(result).toContain('tags: string[]')
      expect(result).toContain('items: ItemsItem[]')
      expect(result).toContain('export interface ItemsItem')
    })

    it('should handle empty arrays as any[]', () => {
      const result = generateModels('{"data": []}', 'Root', 'TypeScript')
      expect(result).toContain('data: any[]')
    })
  })

  describe('Java generation', () => {
    it('should generate correct Java class', () => {
      const result = generateModels(simpleJson, 'Person', 'Java')
      expect(result).toContain('public class Person')
      expect(result).toContain('private String name')
      expect(result).toContain('private Double age')
      expect(result).toContain('private Boolean active')
    })

    it('should handle nested objects in Java', () => {
      const result = generateModels(nestedJson, 'Root', 'Java')
      expect(result).toContain('private User user')
      expect(result).toContain('public class User')
    })

    it('should handle arrays in Java', () => {
      const result = generateModels(arrayJson, 'Root', 'Java')
      expect(result).toContain('List<String> tags')
      expect(result).toContain('List<ItemsItem> items')
    })
  })

  describe('C# generation', () => {
    it('should generate correct C# class', () => {
      const result = generateModels(simpleJson, 'Person', 'C#')
      expect(result).toContain('public class Person')
      expect(result).toContain('public string Name { get; set; }')
      expect(result).toContain('public double Age { get; set; }')
      expect(result).toContain('public bool Active { get; set; }')
    })
  })

  describe('Go generation', () => {
    it('should generate correct Go struct', () => {
      const result = generateModels(simpleJson, 'Person', 'Go')
      expect(result).toContain('type Person struct')
      expect(result).toContain('Name string `json:"name"`')
      expect(result).toContain('Age float64 `json:"age"`')
      expect(result).toContain('Active bool `json:"active"`')
    })

    it('should handle arrays in Go', () => {
      const result = generateModels(arrayJson, 'Root', 'Go')
      expect(result).toContain('[]string')
      expect(result).toContain('[]ItemsItem')
    })
  })

  describe('Python generation', () => {
    it('should generate correct Python dataclass', () => {
      const result = generateModels(simpleJson, 'Person', 'Python')
      expect(result).toContain('from dataclasses import dataclass')
      expect(result).toContain('@dataclass')
      expect(result).toContain('class Person:')
      expect(result).toContain('name: str')
      expect(result).toContain('age: float')
      expect(result).toContain('active: bool')
    })

    it('should handle nested objects in Python', () => {
      const result = generateModels(nestedJson, 'Root', 'Python')
      expect(result).toContain("user: 'User'")
    })

    it('should handle null values in Python', () => {
      const result = generateModels('{"field": null}', 'Root', 'Python')
      expect(result).toContain('field: Any')
    })
  })

  describe('Swift generation', () => {
    it('should generate correct Swift struct', () => {
      const result = generateModels(simpleJson, 'Person', 'Swift')
      expect(result).toContain('struct Person: Codable')
      expect(result).toContain('let name: String?')
      expect(result).toContain('let age: Double?')
      expect(result).toContain('let active: Bool?')
    })
  })

  describe('Rust generation', () => {
    it('should generate correct Rust struct', () => {
      const result = generateModels(simpleJson, 'Person', 'Rust')
      expect(result).toContain('use serde::{Serialize, Deserialize}')
      expect(result).toContain('#[derive(Serialize, Deserialize, Debug)]')
      expect(result).toContain('pub struct Person')
      expect(result).toContain('pub name: Option<String>')
      expect(result).toContain('pub age: Option<f64>')
      expect(result).toContain('pub active: Option<bool>')
    })

    it('should handle null values in Rust', () => {
      const result = generateModels('{"field": null}', 'Root', 'Rust')
      expect(result).toContain('Option<serde_json::Value>')
    })
  })

  describe('Kotlin generation', () => {
    it('should generate correct Kotlin data class', () => {
      const result = generateModels(simpleJson, 'Person', 'Kotlin')
      expect(result).toContain('data class Person(')
      expect(result).toContain('val name: String?')
      expect(result).toContain('val age: Double?')
      expect(result).toContain('val active: Boolean?')
    })

    it('should handle trailing commas correctly', () => {
      const result = generateModels('{"a": 1, "b": 2}', 'Root', 'Kotlin')
      const lines = result.split('\n')
      // last field should not have comma
      const lastField = lines.filter(l => l.trim().startsWith('val')).pop()
      expect(lastField).not.toContain(',')
    })
  })

  describe('Ruby generation', () => {
    it('should generate correct Ruby class', () => {
      const result = generateModels(simpleJson, 'Person', 'Ruby')
      expect(result).toContain('class Person')
      expect(result).toContain('attr_accessor :name, :age, :active')
      expect(result).toContain('end')
    })
  })

  describe('Dart generation', () => {
    it('should generate correct Dart class', () => {
      const result = generateModels(simpleJson, 'Person', 'Dart')
      expect(result).toContain('class Person')
      expect(result).toContain('String? name')
      expect(result).toContain('double? age')
      expect(result).toContain('bool? active')
      expect(result).toContain('Person({')
    })
  })

  describe('PHP generation', () => {
    it('should generate correct PHP class', () => {
      const result = generateModels(simpleJson, 'Person', 'PHP')
      expect(result).toContain('class Person')
      expect(result).toContain('public ?string $name')
      expect(result).toContain('public ?float $age')
      expect(result).toContain('public ?bool $active')
    })

    it('should generate doc comments for arrays', () => {
      const result = generateModels(arrayJson, 'Root', 'PHP')
      expect(result).toContain('@var')
    })
  })

  describe('C++ generation', () => {
    it('should generate correct C++ class', () => {
      const result = generateModels(simpleJson, 'Person', 'C++')
      expect(result).toContain('#include <string>')
      expect(result).toContain('#include <vector>')
      expect(result).toContain('class Person')
      expect(result).toContain('std::string name')
      expect(result).toContain('double age')
      expect(result).toContain('bool active')
    })

    it('should handle arrays in C++', () => {
      const result = generateModels(arrayJson, 'Root', 'C++')
      expect(result).toContain('std::vector<std::string> tags')
    })
  })

  describe('Scala generation', () => {
    it('should generate correct Scala case class', () => {
      const result = generateModels(simpleJson, 'Person', 'Scala')
      expect(result).toContain('case class Person(')
      expect(result).toContain('name: Option[String]')
      expect(result).toContain('age: Option[Double]')
      expect(result).toContain('active: Option[Boolean]')
    })
  })

  describe('GraphQL generation', () => {
    it('should generate correct GraphQL type', () => {
      const result = generateModels(simpleJson, 'Person', 'GraphQL')
      expect(result).toContain('type Person {')
      expect(result).toContain('name: String')
      expect(result).toContain('age: Float')
      expect(result).toContain('active: Boolean')
    })
  })

  describe('Zod generation', () => {
    it('should generate correct Zod schema', () => {
      const result = generateModels(simpleJson, 'Person', 'Zod')
      expect(result).toContain('import { z } from "zod"')
      expect(result).toContain('export const PersonSchema = z.object({')
      expect(result).toContain('name: z.string().optional()')
      expect(result).toContain('age: z.number().optional()')
      expect(result).toContain('active: z.boolean().optional()')
      expect(result).toContain('export type Person = z.infer<typeof PersonSchema>')
    })

    it('should handle nested objects with lazy references', () => {
      const result = generateModels(nestedJson, 'Root', 'Zod')
      expect(result).toContain('z.lazy(() => UserSchema).optional()')
    })

    it('should handle arrays in Zod', () => {
      const result = generateModels(arrayJson, 'Root', 'Zod')
      expect(result).toContain('z.array(z.string().optional()).optional()')
    })
  })

  describe('Custom root class name', () => {
    it('should use provided root class name', () => {
      const result = generateModels(simpleJson, 'UserProfile', 'TypeScript')
      expect(result).toContain('export interface UserProfile')
    })

    it('should capitalize nested class names', () => {
      const result = generateModels(nestedJson, 'Root', 'TypeScript')
      expect(result).toContain('export interface User')
      expect(result).toContain('export interface Address')
    })
  })

  describe('Complex nested structures', () => {
    it('should handle deeply nested objects', () => {
      const deep = '{"level1": {"level2": {"level3": {"value": "deep"}}}}'
      const result = generateModels(deep, 'Root', 'TypeScript')
      expect(result).toContain('export interface Root')
      expect(result).toContain('export interface Level1')
      expect(result).toContain('export interface Level2')
      expect(result).toContain('export interface Level3')
      expect(result).toContain('value: string')
    })

    it('should handle arrays of objects with nested objects', () => {
      const json = '{"users": [{"name": "Alice", "profile": {"bio": "Hello"}}]}'
      const result = generateModels(json, 'Root', 'TypeScript')
      expect(result).toContain('users: UsersItem[]')
      expect(result).toContain('export interface UsersItem')
      expect(result).toContain('profile: Profile')
      expect(result).toContain('export interface Profile')
      expect(result).toContain('bio: string')
    })

    it('should handle arrays of primitives', () => {
      const json = '{"numbers": [1, 2, 3], "flags": [true, false]}'
      const result = generateModels(json, 'Root', 'TypeScript')
      expect(result).toContain('numbers: number[]')
      expect(result).toContain('flags: boolean[]')
    })
  })
})
