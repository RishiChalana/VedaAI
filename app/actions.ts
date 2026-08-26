"use server";

import { prisma } from "../auth";
import { MappedQuestion } from "../lib/assessment-mapping";

export async function saveReviewToDatabase(questions: MappedQuestion[]) {
  // For the prototype phase, we'll create a default teacher, classroom, student, and assessment
  // if they don't exist, to act as foreign keys for our submission.

  // 1. Get or Create Default Teacher
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@vedaai.com" },
    update: {},
    create: {
      name: "Madhur Khang",
      email: "teacher@vedaai.com",
      school: "Delhi Public School",
    },
  });

  // 2. Get or Create Default Classroom
  let classroom = await prisma.classroom.findFirst({ where: { teacherId: teacher.id } });
  if (!classroom) {
    classroom = await prisma.classroom.create({
      data: { name: "10th Grade Computer Science", teacherId: teacher.id },
    });
  }

  // 3. Get or Create Default Student
  let student = await prisma.student.findFirst({ where: { classroomId: classroom.id } });
  if (!student) {
    student = await prisma.student.create({
      data: { name: "Aarav Sharma", rollNo: "12", classroomId: classroom.id },
    });
  }

  // 4. Get or Create Default Assessment
  let assessment = await prisma.assessment.findFirst({ where: { classroomId: classroom.id } });
  if (!assessment) {
    assessment = await prisma.assessment.create({
      data: { title: "Midterm Exam 2024", subject: "Computer Science", maxMarks: 40.5, classroomId: classroom.id },
    });
  }

  // 5. Calculate total score
  const totalScore = questions.reduce((sum, q) => sum + (q.score || 0), 0);

  // 6. Save or Update the Submission
  const submission = await prisma.submission.findFirst({
    where: { studentId: student.id, assessmentId: assessment.id }
  });

  if (submission) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        score: totalScore,
        mappingData: JSON.stringify(questions),
        status: "REVIEWING",
      }
    });
  } else {
    await prisma.submission.create({
      data: {
        studentId: student.id,
        assessmentId: assessment.id,
        score: totalScore,
        mappingData: JSON.stringify(questions),
        status: "REVIEWING",
      }
    });
  }

  return { success: true };
}

export async function loadReviewFromDatabase() {
  const submission = await prisma.submission.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!submission || !submission.mappingData) {
    return null;
  }

  try {
    return JSON.parse(submission.mappingData) as MappedQuestion[];
  } catch {
    return null;
  }
}
