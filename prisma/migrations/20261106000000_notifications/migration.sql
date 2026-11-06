-- Fase 5: notificaciones
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'SENDING' AFTER 'PENDING';

ALTER TABLE "Appointment" ADD COLUMN "manageTokenEnc" TEXT;

ALTER TABLE "Notification" ADD COLUMN "providerMessageId" TEXT;
