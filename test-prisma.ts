import { prisma } from './auth';

async function test() {
  try {
    const teacher = await prisma.user.upsert({
      where: { email: "teacher@vedaai.com" },
      update: {},
      create: {
        name: "Madhur Khang",
        email: "teacher@vedaai.com",
        school: "Delhi Public School",
      },
    });
    console.log("Success:", teacher);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
