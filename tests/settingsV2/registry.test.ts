import { describe, it, expect } from "vitest";
import {
  categories,
  fields,
  searchSettings,
  validateRegistry,
} from "../../src/features/settingsV2/SettingsRegistry";
describe("Settings registry", () => {
  it("has six categories, every subsection covered and unique ids", () => {
    expect(categories).toHaveLength(6);
    expect(() => validateRegistry(fields)).not.toThrow();
    for (const category of categories)
      for (const section of category.sections)
        expect(
          fields.some(
            (field) =>
              field.category === category.id && field.section === section,
          ),
        ).toBe(true);
    expect(() => validateRegistry([fields[0], fields[0]])).toThrow("Duplicate");
  });
  it.each([
    "микрофон",
    "меня плохо слышно",
    "наушники",
    "камера",
    "шум",
    "тема",
    "уведомления",
    "горячие клавиши",
    "экран",
  ])("finds %s", (query) =>
    expect(searchSettings(query).length).toBeGreaterThan(0),
  );
  it("finds advanced fields and normalizes case, whitespace and ё", () => {
    expect(searchSettings(" ШУМ ")[0].advanced).toBe(true);
    expect(searchSettings("  ")).toEqual([]);
    expect(searchSettings("несуществующая настройка")).toEqual([]);
    expect(searchSettings("темная")).toEqual(searchSettings("тёмная"));
  });
  it('routes specific controls into their visible media panel', () => {
    expect(searchSettings('эхоподавление')[0]).toMatchObject({id:'echo',section:'Микрофон',control:'[aria-label="Эхоподавление"]'});
    expect(searchSettings('компрессор')[0]).toMatchObject({id:'filters',section:'Расширенная обработка',advanced:true});
  });
});
