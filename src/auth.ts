import { app, messagingService, prismaClient } from ".";
import { Request, Response } from "express";
import { Router } from "express";
import { waitForMessage, waitForReply } from "./utils/message_utils";
import { rescueNumbers } from "./utils/regex_utils";
import { jidDecode, S_WHATSAPP_NET } from "@adiwajshing/baileys";
import { User } from "@prisma/client";

export const router = Router();

router.post("/auth/phone", async (req: Request, res: Response) => {
    const phone = req.body.phone;
    if (typeof phone !== "string") return res.status(400).send("phone must be a string");

    const number = rescueNumbers(phone)[0];
    const jid = number + S_WHATSAPP_NET;

    let user = await prisma?.user.findFirst({ where: { phone: number } });

    const requestMsg = await messagingService.sendMessage(jid, {
        text: "Hey!\nThere's been an attemp to login to your account.\nShould I authorize it?",
        buttons: [
            { buttonId: "yes", buttonText: { displayText: "Yes" } },
            { buttonId: "no", buttonText: { displayText: "No" } },
        ],
    });

    if (!requestMsg) return res.status(500).send("failed to send message");

    const reply = await waitForReply(requestMsg, jid, {
        filter(message) {
            const buttonId = message.raw?.message?.buttonsResponseMessage?.selectedButtonId;
            return buttonId === "yes" || buttonId === "no";
        },
        timeout: 1000 * 30,
    }).catch((err) => {
        console.error(err);
        requestMsg.reply("Timed out. Please try logging in again.");
        return undefined;
    });

    if (!reply) return res.status(401).send("timed out");

    const buttonId = reply.raw?.message?.buttonsResponseMessage?.selectedButtonId;
    if (buttonId === "yes") {
        const authResultMessage = reply.reply("Authorized!");
        const data = { name: reply.raw?.pushName ?? "" };
        if (!user) {
            user = await prismaClient?.user.create({ data: { name: data.name, phone: number, email: number } });
        } else {
            user = await prismaClient?.user.update({
                data: { name: data.name },
                where: { id: user.id },
            });
        }
        return res.status(200).json({
            success: true,
            user
        });
    } else {
        const authResultMessage = reply.reply("Denied entry!");
        return res.status(401).send();
    }
});
