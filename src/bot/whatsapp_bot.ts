import makeWASocket, {
    WASocket,
    BaileysEventEmitter,
    DisconnectReason,
} from "@adiwajshing/baileys";
import { Boom } from "@hapi/boom";
import { existsSync, mkdirSync } from "fs";
import { messagingService } from "../";
import { botTrafficLogger, logger, storeLogger } from "../logger";
import { getClientID } from "../utils/client_utils";
import { AuthManager } from "./auth_manager";

export class BotClient {
    public static currentClientId: string | undefined;
    private authManager: AuthManager;

    public client: WASocket | undefined | null;
    public eventListener: BaileysEventEmitter | undefined;

    private isRunning: boolean = false;

    private updatedGroupMetadata = false;

    private registerListeners: (listener: BaileysEventEmitter, client: BotClient) => void;

    /**
     *
     * @param session_path store path.
     * @param registerListeners App may run into an error and crash. The client tries to reconnect. if successful listeners need to be re-registered
     */
    constructor(
        session_path = "./session",
        registerListeners: (listener: BaileysEventEmitter, client: BotClient) => void
    ) {
        const storePath = `${session_path}/store`;
        const authPath = `${session_path}/auth`;
        if (!existsSync(session_path)) {
            mkdirSync(session_path);
        }
        if (!existsSync(storePath)) {
            mkdirSync(storePath);
        }

        this.authManager = new AuthManager(authPath);

        // this.store = makeInMemoryStore({
        //     logger: storeLogger,
        // });

        // this.store.readFromFile(storePath + "/baileys_store_multi.json");
        // // save every 5m
        // this.store.writeToFile(storePath + "/baileys_store_multi.json");
        // setInterval(() => {
        //     this.store.writeToFile(storePath + "/baileys_store_multi.json");
        // }, 1000 * 60 * 2);

        this.client = undefined;
        this.eventListener = undefined;
        this.registerListeners = registerListeners;
    }

    public async start() {
        logger.info("Starting bot client connection");
        if (!(await this.authManager.isInitialized)) {
            throw new Error("Failed to initialize auth manager");
        }

        this.client = makeWASocket({
            logger: botTrafficLogger,
            printQRInTerminal: true,
            auth: await this.authManager.getState(),
            getMessage: async (message) => {
                logger.info(
                    `Attempting to fetch message ${message.remoteJid ? `${message.remoteJid}-` : ""}${message.id}`,
                    {jid: message.remoteJid, id: message.id},
                );

                const res = message.id
                    ? messagingService.getSentMessage(message.remoteJid ?? undefined, message.id)
                    : undefined;

                return res;
            },
            msgRetryCounterMap: this.authManager.messageRetryMap,
            retryRequestDelayMs: 1000,
        });

        messagingService.setClient(this.client);
        this.isRunning = true;
        // this.store.bind(this.client.ev);
        logger.info("BOT CLIENT - has started");
        this.eventListener = this.client.ev;

        this.registerListeners(this.eventListener, this);
        this.eventListener.on("connection.update", (update) => {
            if (!this.isRunning) {
                logger.info("BOT CLIENT - connection.update - not running, exiting.");
                return;
            }

            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                logger.info("BOT CLIENT - NEW QR CODE");
                logger.info(qr)
            }

            logger.info(`BOT CLIENT - CONNECTION UPDATE: ${connection}`, { connection, lastDisconnect });
            if (lastDisconnect?.error) {
                logger.error(lastDisconnect.error.stack);
            }
            if (connection === "close") {
                // reconnect if not logged out
                const shouldReconnect =
                    (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    logger.info("BOT CLIENT - disconnected, trying to reconnect");
                    this.start();
                } else {
                    logger.info("BOT CLIENT - connection closed");
                }
            } else if (connection == "open") {
                logger.info("BOT CLIENT - connection opened");
                BotClient.currentClientId = getClientID(this.client!);
                if (!this.updatedGroupMetadata) {
                    // this.updateGroupMetadata();
                    this.updatedGroupMetadata = true;
                }
            }
        });
        // listen for when the auth credentials is updated
        this.eventListener.on("creds.update", () => this.authManager.saveAuthState());

        logger.info("BOT CLIENT - Registered listeners");
    }

    public async restart() {
        this.start();
    }

    public close() {
        logger.info("Closing bot client connection");
        this.isRunning = false;
        this.client?.end(undefined);
        logger.info("Closed bot client connection");
    }

    private async updateGroupMetadata() {
        // let counter = 0;
        // let errorCounter = 0;
        // for (const chat of this.store.chats["array"]) {
        //     if (chat.id.endsWith("@g.us") && !this.store.groupMetadata[chat.id]) {
        //         try {
        //             counter++;
        //             this.store.groupMetadata[chat.id] = await this.client!.groupMetadata(chat.id);
        //         } catch (e) {
        //             errorCounter++;
        //         }
        //     }
        // }
        // console.log(counter - errorCounter + "/" + counter + " groups updated");
    }
}
