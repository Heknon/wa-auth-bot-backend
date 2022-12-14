import {
    AnyMessageContent,
    WAMessage,
} from "@adiwajshing/baileys/lib/Types/Message";
import {isJidGroup} from "@adiwajshing/baileys/lib/WABinary/jid-utils";
import { messagingService } from "../../";
import {
    getMediaPath,
    getMessageMedia,
    getMessageMediaType,
    saveMessageMedia,
} from "../../utils/media_utils";
import { getQuotedMessage, getMessageBody } from "../../utils/message_utils";
import {Placeholder} from "../messaging_service";
import { BotClient } from "../whatsapp_bot";
import MessageModel from "./message_model";
import Metadata from "./metadata";

export default class Message {
    public model: MessageModel;
    private _quoted: Message | undefined;
    private _media: Buffer | undefined;

    public raw: WAMessage | undefined;

    constructor(
        model: MessageModel,
        raw: WAMessage | undefined = undefined,
        quoted: Message | undefined = undefined,
    ) {
        this.model = model;
        this.raw = raw;
        this._quoted = quoted;
    }

    public inGroup() {
        return isJidGroup(this.model.to);
    }

    /**
     * Will be true if the message is from the bot
     */
    public get fromBot() {
        return this.model.from == BotClient.currentClientId;
    }

    public get sender() {
        if (isJidGroup(this.to)) return this.from;

        if (this.fromBot && this.raw?.key.fromMe) return BotClient.currentClientId;
        return this.fromBot ? this.to : this.from;
    }

    public static async fromWAMessage(
        message: WAMessage,
        metadata: Metadata | undefined = undefined,
    ): Promise<Message> {
        const fromGroup = isJidGroup(message.key.remoteJid!);
        const fromMe = fromGroup
            ? message.key.participant! == BotClient.currentClientId ||
              message.participant! == BotClient.currentClientId ||
              message.key.fromMe
            : message.key.fromMe;
        const from = fromMe
            ? BotClient.currentClientId
            : fromGroup
            ? message.key.participant ?? message.participant
            : message.key.remoteJid!;
        const to = fromGroup ? message.key.remoteJid! : fromMe ? message.key.remoteJid! : BotClient.currentClientId;

        let quoted: WAMessage | undefined = getQuotedMessage(message);
        const mediaBlocked = metadata?.meta.get("media") == false;

        return new Message(
            new MessageModel(
                message.key.id!,
                Number(message.messageTimestamp!),
                getMessageBody(message),
                !mediaBlocked ? getMediaPath(message) : undefined,
                getMessageMediaType(message),
                quoted?.key?.id ?? undefined,
                from!,
                to!,
                metadata,
            ),
            message,
            quoted ? await this.fromWAMessage(quoted!) : undefined,
        );
    }

    public static calculateSaveId(message: WAMessage) {
        return `${message.key.id}-${message.key.remoteJid}-${message.messageTimestamp}-${message.key.participant}`;
    }

    public get from() {
        return this.model.from;
    }

    public get to() {
        return this.model.to;
    }

    public get content() {
        return this.model.content;
    }

    public get id() {
        return this.model.id;
    }

    public get mediaPath() {
        return this.model.mediaPath;
    }

    public get media() {
        if (this._media) return this._media;

        return getMessageMedia(this).then(async (f) => {
            if (f) return f;
            if (!this.raw) return;
            await saveMessageMedia(this.raw);
            this._media = await getMessageMedia(this);
            return this._media;
        });
    }

    // no checks to actually get message media from WA. Not recommended.
    public get cachedMedia(): Buffer | undefined {
        return this._media;
    }

    public get mediaType() {
        return this.model.mediaType;
    }

    public get metadata() {
        return this.model.metadata;
    }

    public get timestamp() {
        return this.model.timestamp;
    }

    public get mentions() {
        return this.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
    }

    public async getQuoted(): Promise<Message | undefined> {
        return this._quoted;
    }

    public reply(
        content: string,
        quote: boolean = false,
        {
            privateReply = false,
            metadata,
            placeholder,
        }: {
            privateReply?: boolean;
            metadata?: Metadata;
            placeholder?: Placeholder;
        } = {},
    ) {
        return messagingService.reply(this, content, quote, {privateReply, metadata, placeholder});
    }

    public replyAdvanced(
        content: AnyMessageContent,
        quote: boolean = false,
        {
            privateReply = false,
            metadata,
            placeholder,
        }: {
            privateReply?: boolean;
            metadata?: Metadata;
            placeholder?: Placeholder;
        } = {},
    ) {
        return messagingService.replyAdvanced(this, content, quote, {privateReply, metadata, placeholder});
    }
}
