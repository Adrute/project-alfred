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

function replaceWholeText(value: string, search: string, replacement: string) {
  if (!search.trim()) return value;
  return value.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(search)}(?![\\p{L}\\p{N}])`, "giu"), replacement);
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
    const firstNameCounts = new Map<string, number>();
    const lastNameCounts = new Map<string, number>();
    for (const student of students) {
      const first = student.firstName.toLocaleLowerCase("es");
      const last = student.lastName.toLocaleLowerCase("es");
      firstNameCounts.set(first, (firstNameCounts.get(first) ?? 0) + 1);
      lastNameCounts.set(last, (lastNameCounts.get(last) ?? 0) + 1);
    }
    this.aliases = students.map((student) => ({
      student,
      alias: `ALUMNO_${createHmac("sha256", secret).update(`${conversationKey}:${student.id}`).digest("hex").slice(0, 10).toUpperCase()}`,
    }));
    this.replacements = this.aliases.flatMap(({ student, alias }) => {
      const values = [
        `${student.firstName} ${student.lastName}`,
        student.id,
        ...(firstNameCounts.get(student.firstName.toLocaleLowerCase("es")) === 1 ? [student.firstName] : []),
        ...(lastNameCounts.get(student.lastName.toLocaleLowerCase("es")) === 1 ? [student.lastName] : []),
      ];
      return values.map((source) => ({ source, target: alias }));
    }).sort((left, right) => right.source.length - left.source.length);
  }

  pseudonymizeText(value: string) {
    let result = value;
    for (const replacement of this.replacements) result = replaceWholeText(result, replacement.source, replacement.target);
    return result
      .replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu, "DATO_CONTACTO")
      .replace(/(?<!\d)(?:\+34\s*)?(?:\d[\s.-]*){9}(?!\d)/g, "DATO_CONTACTO");
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

export async function createStudentPseudonymizer(conversationKey: string) {
  const [students, secret] = await Promise.all([
    database.student.findMany({ select: { id: true, firstName: true, lastName: true } }),
    getAliasSecret(),
  ]);
  return new StudentPseudonymizer(students, conversationKey, secret);
}
