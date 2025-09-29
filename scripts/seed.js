import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const plainPassword = "admin123";
  const hashed = await bcrypt.hash(plainPassword, 10);

  await prisma.user.create({
    data: {
      username: "admin",
      password: hashed,
      role: "admin",
    },
  });

  console.log(
    `Admin user created: username: "admin", password: "${plainPassword}"`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
