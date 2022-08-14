import express, { Express } from "express";
import dotenv from "dotenv";
import { router } from "./auth";
import { BotClient } from "./bot/whatsapp_bot";
import MessagingService from "./bot/messaging_service";
import { json as jsonBodyParser } from "body-parser";
import { prisma } from "./db/client";

dotenv.config();

export const prismaClient = prisma;
export const messagingService = new MessagingService();
export const whatsappBot = new BotClient("./session", (ev) => {
    ev.on("messages.upsert", async (m) => {
        for (const msg of m.messages) {
            if (msg.message?.protocolMessage) return;
            if (msg.key.fromMe) return;

            const message = messagingService.messageInterceptor(msg);
        }
    });
});
whatsappBot.start();

export const app: Express = express();
const port = process.env.PORT;

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});

app.use(jsonBodyParser());
app.use(router);
