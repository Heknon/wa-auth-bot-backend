import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { router } from "./auth";
import { useMultiFileAuthState } from "@adiwajshing/baileys";
import { BotClient } from "./bot/whatsapp_bot";
import MessagingService from "./bot/messaging_service";

dotenv.config();

export const messagingService = new MessagingService();
export const whatsappBot = new BotClient("./session", (ev) => {
    ev.on("messages.upsert", async (m) => {
        for (const msg of m.messages) {
            if (msg.message?.protocolMessage) return;
            if (msg.key.fromMe) return;

            console.log(`${msg.key.remoteJid} - ${msg.message?.conversation}`);
        }
    });
});
whatsappBot.start();

export const app: Express = express();
const port = process.env.PORT;

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});

app.use(router);
