import {
  AttributePath,
  BindingDeclaration,
  BindingValue,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  ScenarioBinding,
  ScenarioBindings,
} from "@deep-spec/kernel-domain";
import { err, type Json, type Result } from "@deep-spec/kernel-infrastructure";

export function decodeDeclaredBindings(raw: Readonly<Record<string, Json>>): Result<DeclaredBindings, string> {
  const values: Parameters<typeof DeclaredBindings.of>[0][number][] = [];
  for (const [key, value] of Object.entries(raw)) {
    const path = AttributePath.parse(key);
    if (!path.ok) return err(JSON.stringify(path.error));
    const declared = Declaration.parse(value);
    if (!declared.ok) return err(JSON.stringify(declared.error));
    values.push(BindingDeclaration.of(path.value, DeclaredBindingValue.of(declared.value)));
  }
  const bindings = DeclaredBindings.parse(values);
  return bindings.ok ? bindings : err(JSON.stringify(bindings.error));
}

export function decodeScenarioBindings(raw: Readonly<Record<string, Json>>): Result<ScenarioBindings, string> {
  const declarations = decodeDeclaredBindings(raw);
  if (!declarations.ok) return declarations;
  const values: Parameters<typeof ScenarioBindings.of>[0][number][] = [];
  for (const declaration of declarations.value) {
    const path = declaration.path();
    const declared = declaration.value();
    const value = BindingValue.resolve(declared);
    if (!value.ok) return err(`${path.asString()}: ${value.error}`);
    values.push(ScenarioBinding.of(path, value.value));
  }
  const bindings = ScenarioBindings.parse(values);
  return bindings.ok ? bindings : err(JSON.stringify(bindings.error));
}
