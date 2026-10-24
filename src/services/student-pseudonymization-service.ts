import { createHmac } from "node:crypto";
import { database } from "@/lib/database";
import { getAliasSecret } from "./chatgpt-auth-service";

interface StudentIdentity {
  id: string;
  firstName: string;
  lastName: string;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const accentGroups: Record<string, string> = {
  a: "aáàäâãå", c: "cç", e: "eéèëê", i: "iíìïî", n: "nñ", o: "oóòöôõ", u: "uúùüû", y: "yýÿ",
};

function foldIdentity(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es").replace(/\s+/gu, " ").trim();
}

function identityPattern(value: string) {
  return [...value.normalize("NFC")].map((character) => {
    if (/\s/u.test(character)) return "\\s+";
    const base = foldIdentity(character);
    return accentGroups[base] ? `[${accentGroups[base]}]` : escapeRegExp(character);
  }).join("");
}

function replaceWholeText(value: string, search: string, replacement: string) {
  if (!search.trim()) return value;
  return value.replace(new RegExp(`(?<![\\p{L}\\p{N}])${identityPattern(search)}(?![\\p{L}\\p{N}])`, "giu"), replacement);
}

function containsWholeText(value: string, search: string) {
  if (!search.trim()) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${identityPattern(search)}(?![\\p{L}\\p{N}])`, "iu").test(value);
}

function identityFragments(student: StudentIdentity) {
  const parts = [student.firstName, student.lastName]
    .flatMap((value) => value.split(/[\s'’_-]+/u))
    .filter(Boolean);
  return [...new Set([student.id, `${student.firstName} ${student.lastName}`, student.firstName, student.lastName, ...parts])];
}

function redactContactData(value: string) {
  return value
    .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu, "DATO_CONTACTO")
    .replace(/(?<![\p{L}\p{N}_])\+?[\d(][\d()\s.-]{5,23}\d(?![\p{L}\p{N}_])/gu, (candidate) => {
      const digits = candidate.replace(/\D/gu, "");
      return digits.length >= 7 && digits.length <= 15 ? "DATO_CONTACTO" : candidate;
    });
}

function containsContactData(value: string) {
  return redactContactData(value) !== value;
}

function mapUnknown(value: unknown, transform: (text: string) => string): unknown {
  if (typeof value === "string") return transform(value);
  if (Array.isArray(value)) return value.map((item) => mapUnknown(item, transform));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapUnknown(item, transform)]));
  }
  return value;
}

export class StudentPseudonymizer {
  private readonly replacements: Array<{ source: string; target: string }>;
  private readonly aliases: Array<{ alias: string; student: StudentIdentity }>;

  constructor(students: StudentIdentity[], conversationKey: string, secret: string) {
    this.aliases = students.map((student) => ({
      student,
      alias: `ALUMNO_${createHmac("sha256", secret).update(`${conversationKey}:${student.id}`).digest("hex").toUpperCase()}`,
    }));
    if (new Set(this.aliases.map(({ alias }) => alias)).size !== this.aliases.length) {
      throw new Error("No se pudieron generar identificadores de alumnado únicos.");
    }
    const owners = new Map<string, Set<string>>();
    for (const student of students) {
      for (const fragment of identityFragments(student)) {
        const key = foldIdentity(fragment);
        const ids = owners.get(key) ?? new Set<string>();
        ids.add(student.id);
        owners.set(key, ids);
      }
    }
    this.replacements = this.aliases.flatMap(({ student, alias }) => identityFragments(student)
      .filter((source) => owners.get(foldIdentity(source))?.size === 1)
      .map((source) => ({ source, target: alias })))
      .sort((left, right) => right.source.length - left.source.length);
  }

  pseudonymizeText(value: string) {
    let result = redactContactData(value.normalize("NFC"));
    for (const replacement of this.replacements) result = replaceWholeText(result, replacement.source, replacement.target);
    return result;
  }

  depseudonymizeText(value: string) {
    let result = value;
    for (const { alias, student } of this.aliases) result = result.replaceAll(alias, `${student.firstName} ${student.lastName}`);
    return result;
  }

  pseudonymize<T>(value: T): T {
    return mapUnknown(value, (text) => this.pseudonymizeText(text)) as T;
  }

  depseudonymize<T>(value: T): T {
    return mapUnknown(value, (text) => this.depseudonymizeText(text)) as T;
  }
}

export function assertNoStudentIdentityInCloudPayload(students: StudentIdentity[], value: unknown) {
  const inspect = (candidate: unknown): void => {
    if (typeof candidate === "string") {
      const text = candidate.normalize("NFC");
      for (const student of students) {
        if (identityFragments(student).some((identity) => containsWholeText(text, identity))) {
          throw new Error("La petición a ChatGPT contenía una identidad real de alumnado y ha sido bloqueada localmente.");
        }
      }
      if (containsContactData(text)) throw new Error("La petición a ChatGPT contenía datos de contacto y ha sido bloqueada localmente.");
      return;
    }
    if (Array.isArray(candidate)) candidate.forEach(inspect);
    else if (candidate && typeof candidate === "object") {
      for (const [key, item] of Object.entries(candidate)) { inspect(key); inspect(item); }
    }
  };
  inspect(value);
}

export async function assertCloudPayloadIsPseudonymized(value: unknown) {
  const students = await database.student.findMany({ select: { id: true, firstName: true, lastName: true } });
  assertNoStudentIdentityInCloudPayload(students, value);
}

export async function createStudentPseudonymizer(conversationKey: string) {
  const [students, secret] = await Promise.all([
    database.student.findMany({ select: { id: true, firstName: true, lastName: true } }),
    getAliasSecret(),
  ]);
  return new StudentPseudonymizer(students, conversationKey, secret);
}
