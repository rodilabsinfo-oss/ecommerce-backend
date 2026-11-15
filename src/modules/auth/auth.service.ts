import { createHash } from 'node:crypto';
import type { StaffRole } from '../../generated/prisma/enums.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword, newToken, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface StaffContext {
  id: string;
  storeId: string;
  name: string;
  email: string;
  role: StaffRole;
  sessionId: string;
}

// Always hash something, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = await hashPassword('not-a-real-password');

export async function login(storeId: string, email: string, password: string, meta: { ip?: string; userAgent?: string }) {
  const staff = await prisma.staffUser.findUnique({ where: { storeId_email: { storeId, email: email.toLowerCase() } } });
  const ok = await verifyPassword(password, staff?.passwordHash ?? DUMMY_HASH);
  if (!staff || !ok || !staff.isActive) throw new AppError(401, 'INVALID_LOGIN', 'Email or password is wrong');

  const token = newToken();
  const expiresAt = new Date(Date.now() + env.SESSION_DAYS * 86_400_000);
  await prisma.$transaction([
    prisma.staffSession.create({
      data: { staffId: staff.id, tokenHash: sha256(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 200) },
    }),
    prisma.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } }),
  ]);

  return { token, expiresAt, staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role } };
}

/** Looks up a session token. Extends it on use ("stay signed in while active"). */
export async function resolveSession(token: string): Promise<StaffContext | null> {
  const session = await prisma.staffSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { staff: true },
  });
  if (!session || session.expiresAt < new Date() || !session.staff.isActive) return null;

  // Touch at most once an hour to keep writes low.
  if (Date.now() - session.lastUsedAt.getTime() > 3_600_000) {
    await prisma.staffSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + env.SESSION_DAYS * 86_400_000) },
    });
  }
  const { staff } = session;
  return { id: staff.id, storeId: staff.storeId, name: staff.name, email: staff.email, role: staff.role, sessionId: session.id };
}

export const logout = (sessionId: string) => prisma.staffSession.delete({ where: { id: sessionId } }).catch(() => undefined);

export async function changePassword(staffId: string, currentSessionId: string, current: string, next: string) {
  const staff = await prisma.staffUser.findUniqueOrThrow({ where: { id: staffId } });
  if (!(await verifyPassword(current, staff.passwordHash))) throw new AppError(400, 'WRONG_PASSWORD', 'Current password is wrong');
  await prisma.$transaction([
    prisma.staffUser.update({ where: { id: staffId }, data: { passwordHash: await hashPassword(next) } }),
    // Sign out every other device.
    prisma.staffSession.deleteMany({ where: { staffId, id: { not: currentSessionId } } }),
  ]);
}
