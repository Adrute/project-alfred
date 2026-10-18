import type { NewStudent } from "@/domain/student-admin";
import type { TeachingSchedule } from "@/domain/planning";

const classroomPattern = String.raw`\d{1,2}\s*(?:\.?º|o|°)?\s*(?:ESO|Primaria|Bachillerato|Infantil|FP)\s*[A-Z]?`;
const dayNumbers: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

function academicStage(classroomName: string) {
  const text = normalize(classroomName);
  if (text.includes("eso")) return "Educación Secundaria Obligatoria";
  if (text.includes("bachillerato")) return "Bachillerato";
  if (text.includes("primaria")) return "Educación Primaria";
  if (text.includes("infantil")) return "Educación Infantil";
  if (text.includes("fp")) return "Formación Profesional";
  return "";
}

function minuteOfDay(value: string) {
  const [hours, minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export function parseBulkStudentCommand(message: string): { classroomReference: string; students: NewStudent[] } | null {
  if (!/\b(?:añad|anad|agreg|matricul|dar de alta)/i.test(normalize(message))) return null;
  const classroom = new RegExp(String.raw`\b(?:a|en)\s+(${classroomPattern})\b`, "iu").exec(message);
  if (!classroom || classroom.index === undefined) return null;
  const command = message.slice(0, classroom.index)
    .replace(/^.*?\b(?:añade|añadir|anade|anadir|agrega|agregar|matricula|matricular|dar de alta)\b/iu, "")
    .replace(/^\s*(?:a\s+)?(?:los?\s+)?(?:alumnos?|estudiantes?)?\s*/iu, "")
    .trim();
  const names = command.split(/\s*(?:,|;|\n|\by\b)\s*/iu).map((item) => item.trim()).filter(Boolean);
  const students = names.map((name) => {
    const parts = name.split(/\s+/);
    return { firstName: parts.shift() ?? "", lastName: parts.join(" ") };
  }).filter((student) => student.firstName && student.lastName);
  return students.length >= 2 ? { classroomReference: classroom[1].trim(), students } : null;
}

export function parseTeachingScheduleCommand(message: string): TeachingSchedule | null {
  const academicYearMatch = message.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2})\b/);
  const academicYear = academicYearMatch ? `${academicYearMatch[1]}-${academicYearMatch[2]}` : "";
  const expression = new RegExp(
    String.raw`(?:\b(?:tengo|doy|imparto)\s+|(?:^|[;\n]|\by\s+(?=[\p{L}]))\s*)([\p{L}][\p{L}\s]{1,60}?)\s+(?:con|en)\s+(${classroomPattern})\s+(?:los?\s+)?((?:(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(?:\s*(?:,|y)\s*)?)+)\s+(?:de|desde|a\s+las?)\s+(\d{1,2}(?::\d{2})?)\s*(?:a|hasta|-)\s*(\d{1,2}(?::\d{2})?)`,
    "giu",
  );
  const entries: TeachingSchedule["entries"] = [];
  for (const match of message.matchAll(expression)) {
    const subjectName = match[1].trim().replace(/^(?:y\s+)/iu, "");
    const classroomName = match[2].trim();
    const educationalStage = academicStage(classroomName);
    const startMinute = minuteOfDay(match[4]);
    const endMinute = minuteOfDay(match[5]);
    for (const day of normalize(match[3]).match(/lunes|martes|miercoles|jueves|viernes|sabado|domingo/g) ?? []) {
      entries.push({ classroomName, educationalStage, subjectName, dayOfWeek: dayNumbers[day], startMinute, endMinute, room: null });
    }
  }
  if (!entries.length) return null;
  return { academicYear, timezone: "Europe/Madrid", entries };
}
