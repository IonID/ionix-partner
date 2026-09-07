-- Porecla de Telegram a operatorului, ca AIONA să poată arăta numele lui real.
ALTER TABLE "applications" ADD COLUMN "statusChangedByTelegramUsername" TEXT;
