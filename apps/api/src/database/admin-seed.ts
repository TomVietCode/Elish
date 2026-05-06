import { User } from "src/users/user.entity";
import { DataSource } from "typeorm";
import * as bcrypt from 'bcryptjs'
import { Role } from "@english-platform/shared";

async function seed() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User],
    synchronize: false,
  })

  await ds.initialize()
  const repo = ds.getRepository(User)

  const email = process.env.ADMIN_EMAIL
  const exists = await repo.findOne({ where: { email } })
  if (exists) {
    console.log("Admin user already exists. Skipping.")
    await ds.destroy()
    return
  }
  const rawPassword = process.env.ADMIN_PASSWORD || 'Admin@123'
  const passwordHash = await bcrypt.hash(rawPassword, 12)

  const admin = repo.create({
    email,
    passwordHash,
    displayName: 'Admin',
    role: Role.ADMIN,
  })
  await repo.save(admin)
  console.log(`Admin user created: ${email}`)
  await ds.destroy()
}

seed().catch(console.error) 