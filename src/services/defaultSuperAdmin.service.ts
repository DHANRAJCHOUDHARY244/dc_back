import {
  PROTECTED_SUPER_ADMIN_EMAIL,
  PROTECTED_SUPER_ADMIN_NAME,
  PROTECTED_SUPER_ADMIN_USERNAME,
} from "@config/protectedUsers.config";
import { roleRepository, userRepository } from "@repositories";
import { generate_Hash_Password } from "@services/generalHelper.service";
import { Roles } from "src/data/dataInserter";

/**
 * Ensures the protected Super Admin exists with email verified.
 * On existing accounts: heals verification, active status, and SUPER_ADMIN role.
 * Optional env: DEFAULT_SUPER_ADMIN_PASSWORD (only used when creating a new account).
 */
export async function seedDefaultSuperAdmin(): Promise<void> {
  const email = PROTECTED_SUPER_ADMIN_EMAIL.toLowerCase();

  const superRole: any = await roleRepository.findOne(
    { name: Roles.SUPER_ADMIN },
    { select: "id name", lean: true },
  );
  if (!superRole?.id) {
    console.warn("seedDefaultSuperAdmin: SUPER_ADMIN role not found — skip");
    return;
  }

  const existing: any = await userRepository.findOne({ email }, { lean: true });

  if (existing) {
    const needsHeal =
      !existing.is_verified ||
      existing.is_active === false ||
      Number(existing.role_id) !== Number(superRole.id);

    if (needsHeal) {
      await userRepository.updateById(existing.id, {
        $set: {
          is_verified: true,
          is_active: true,
          role_id: superRole.id,
          must_change_password: false,
        },
      });
      console.log(`Protected Super Admin healed: ${email}`);
    }
    return;
  }

  const plainPassword = process.env.DEFAULT_SUPER_ADMIN_PASSWORD;
  if (!plainPassword) {
    console.warn(
      `Protected Super Admin not created (${email}): set DEFAULT_SUPER_ADMIN_PASSWORD in .env for first-time bootstrap`,
    );
    return;
  }

  const password = await generate_Hash_Password(plainPassword);
  await userRepository.create({
    name: PROTECTED_SUPER_ADMIN_NAME,
    username: PROTECTED_SUPER_ADMIN_USERNAME,
    email,
    password,
    is_verified: true,
    is_active: true,
    role_id: superRole.id,
    must_change_password: false,
  });

  console.log(`Protected Super Admin created: ${email} (email verified)`);
}
