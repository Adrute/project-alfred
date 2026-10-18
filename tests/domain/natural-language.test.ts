import { describe, expect, it } from "vitest";
import { parseBulkStudentCommand, parseTeachingScheduleCommand } from "@/domain/natural-language";

describe("natural language batch commands", () => {
  it("extracts every full student name and the target classroom", () => {
    expect(parseBulkStudentCommand("Añade a Ana López, Bruno García y Carla Ruiz a 2.º ESO C")).toEqual({
      classroomReference: "2.º ESO C",
      students: [
        { firstName: "Ana", lastName: "López" },
        { firstName: "Bruno", lastName: "García" },
        { firstName: "Carla", lastName: "Ruiz" },
      ],
    });
  });

  it("turns each mentioned teaching day into a separate schedule entry", () => {
    const result = parseTeachingScheduleCommand(
      "Durante 2026-2027 tengo Inglés con 4.º ESO A los lunes y miércoles de 9:00 a 10:00; Matemáticas con 2.º ESO B los martes de 11:15 a 12:10",
    );
    expect(result?.academicYear).toBe("2026-2027");
    expect(result?.entries).toEqual([
      expect.objectContaining({ subjectName: "Inglés", classroomName: "4.º ESO A", dayOfWeek: 1, startMinute: 540, endMinute: 600 }),
      expect.objectContaining({ subjectName: "Inglés", classroomName: "4.º ESO A", dayOfWeek: 3, startMinute: 540, endMinute: 600 }),
      expect.objectContaining({ subjectName: "Matemáticas", classroomName: "2.º ESO B", dayOfWeek: 2, startMinute: 675, endMinute: 730 }),
    ]);
  });

  it("does not infer a missing end time", () => {
    expect(parseTeachingScheduleCommand("Tengo Inglés con 4.º ESO A los lunes a las 9:00")).toBeNull();
  });
});
