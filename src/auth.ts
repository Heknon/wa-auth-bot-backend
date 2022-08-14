import { app, messagingService } from ".";
import { Request, Response } from "express";
import { Router } from "express";

export const router = Router();

router.get("/", (req: Request, res: Response) => {
    messagingService.sendMessage('972585551784@s.whatsapp.net', {text: "Hello!"});
    res.json({
        message: "Hello Worldffsdsfdsd",
    })
});
